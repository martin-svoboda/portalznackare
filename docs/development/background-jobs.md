# Background Jobs (Symfony Messenger)

> **Asynchronní zpracování** úloh v pozadí — primárně odesílání hlášení do systému INSYZ.

## Přehled

Symfony Messenger zpracovává úlohy mimo HTTP request přes Message Bus pattern. Zprávy jsou persistované v PostgreSQL (`doctrine` transport) a konzumovány **trvalým systemd workerem**, jeden pro každé prostředí (prod, dev).

## Architektura

```
HTTP request (PortalController)
    │
    ├─ dispatch(SendToInsyzMessage)        → uloží zprávu do messenger_messages
    ├─ response → state='send'              (frontend pak sleduje změnu)
    │
    │  (asynchronně, na pozadí)
    ▼
systemd worker (portal-messenger-<env>)
    │
    └─ SendToInsyzHandler::__invoke()
        │
        ├─ generateReportXml()
        ├─ InsyzService::submitReportToInsyz()  →  MSSQL: trasy.ZP_Zapis_XML
        ├─ úspěch  →  state='submitted'  + history 'insyz_submitted'
        └─ chyba   →  state='rejected'   + history 'insyz_error'
                       (shouldRetry → re-throw → Messenger retry policy)
```

**Žádný sync fallback ani on-demand worker přes `exec()`.** Pokud worker neběží, zprávy se hromadí ve frontě a po obnovení workeru se zpracují.

## Messenger konfigurace

`config/packages/messenger.yaml`:

```yaml
framework:
    messenger:
        transports:
            async:
                dsn: 'doctrine://default'
                options:
                    auto_setup: true
            failed:
                dsn: 'doctrine://default?queue_name=failed'
        routing:
            App\Message\SendToInsyzMessage:
                senders: ['async']
                retry_strategy:
                    max_retries: 3
                    delay: 1000
                    multiplier: 2
                    max_delay: 10000
```

## Retry logika

Handler rozlišuje retryable a permanent chyby (`SendToInsyzHandler::shouldRetry()`):

- **Retry** — `timeout`, `connection`, `network`, `temporary`, `unavailable` a neznámé chyby
- **No retry** — `authentication`, `authorization`, `invalid`, `malformed`, `parse error`

Při permanent chybě se report označí `rejected` a zpráva NENÍ re-thrown → messenger ji nepokouší dál.

## Production setup (systemd)

Aplikace má dvě nezávislé instance na stejném serveru:

| Prostředí | Cesta | Service |
|---|---|---|
| Produkce | `/www/hosting/portalznackare.cz/www` | `portal-messenger-prod` |
| Dev | `/www/hosting/portalznackare.cz/dev` | `portal-messenger-dev` |

Service soubory jsou v repu: `deploy/portal-messenger-prod.service`, `deploy/portal-messenger-dev.service`.

### Instalace / aktualizace

CI deploy (`.github/workflows/deploy.yml`) volá automaticky po nasazení kódu:

```bash
./deploy/setup-messenger.sh prod    # nebo dev
```

Skript zkopíruje aktuální `.service` soubor do `/etc/systemd/system/`, udělá `daemon-reload`, povolí a (re)startuje službu. Je idempotentní — opakované spuštění jen restartuje.

### Klíčové parametry workeru

- `--time-limit=3600` — worker se sám ukončí po hodině (systemd ho restartuje); brání memory leakům dlouhoběžícího PHP
- `--memory-limit=256M` — pokud worker překročí, sám se ukončí
- `Restart=always`, `RestartSec=10` — automatický restart při pádu
- Logy jdou do journalu (`journalctl -u portal-messenger-<env>`)

### Bezpečnostní hardening

V service souboru:
- `ProtectSystem=strict` — write povolen jen v `ReadWritePaths`
- `ProtectHome=true`, `PrivateTmp=true`, `NoNewPrivileges=true`
- `ReadWritePaths=<projekt>/var` — worker zapisuje jen do `var/`

### Citlivé proměnné

Service soubor **nikdy** neobsahuje DATABASE_URL ani jiné credentials. Worker je spuštěn z `WorkingDirectory=` a Symfony si je načte z `.env.local` projektu.

## Monitoring

```bash
# Stav workera
systemctl status portal-messenger-prod
systemctl status portal-messenger-dev

# Živé logy
sudo journalctl -u portal-messenger-prod -f
sudo journalctl -u portal-messenger-prod --since "1 hour ago"

# Velikost fronty
php bin/console dbal:run-sql "SELECT COUNT(*), queue_name FROM messenger_messages GROUP BY queue_name"

# Statistiky
php bin/console messenger:stats
```

## Frontend chování

Frontend má 45s timeout (`useFormSaving.js`). Po `state='send'` ukáže "Odesílání do INSYZ probíhá..." a periodicky polluje stav reportu, dokud nepřejde na `submitted` nebo `rejected`.

## Troubleshooting

### Hlášení zůstávají ve stavu `send` (Odesílání do INSYZ)

Worker buď neběží, nebo padá v cyklu.

```bash
systemctl status portal-messenger-prod          # Active?
sudo journalctl -u portal-messenger-prod --since "10 minutes ago" --no-pager

# Pokud služba neexistuje vůbec:
ls /etc/systemd/system/portal-messenger-*.service
# pokud chybí, deploy.yml ji měl nainstalovat — viz Setup výše
```

Klíčový diagnostický dotaz — kolik visí zpráv ve frontě a jaká je poslední history u stuck reportu:

```bash
php bin/console dbal:run-sql "SELECT COUNT(*) FROM messenger_messages WHERE queue_name='default'"

php bin/console dbal:run-sql "SELECT r.id, r.state, (r.history::jsonb -> -1 ->> 'action') AS last_action FROM reports r WHERE r.state = 'send' ORDER BY r.date_updated DESC LIMIT 10"
```

Pokud `last_action = dispatch_to_insyz` a zpráva čeká ve frontě → worker není zapnutý nebo padá.

### Manuální zpracování zaseknutých zpráv

Pokud z nějakého důvodu worker nemůže běžet a chceš jednorázově dohnat frontu:

```bash
cd /www/hosting/portalznackare.cz/www
php bin/console messenger:consume async --limit=100 --time-limit=600 -vv
```

### Failed jobs

Zprávy, které vyčerpaly retry policy, jdou do transportu `failed`:

```bash
php bin/console messenger:failed:show
php bin/console messenger:failed:retry         # zkusit znovu
php bin/console messenger:failed:remove <id>   # zahodit
```

### Restart workera bez deploye

Po manuální úpravě konfigurace:

```bash
sudo systemctl restart portal-messenger-prod
```

### Audit chyb INSYZ submission

Každé volání `trasy.ZP_Zapis_XML` se loguje do `insyz_audit_logs`:

```bash
php bin/console dbal:run-sql "SELECT created_at, status, error_message, duration_ms FROM insyz_audit_logs WHERE procedure_name = 'trasy.ZP_Zapis_XML' ORDER BY created_at DESC LIMIT 20"
```

## Development workflow

Lokálně (DDEV) typicky spouštíš worker manuálně, ne přes systemd:

```bash
ddev exec php bin/console messenger:consume async --limit=10 -vv
```

Nebo zpracuj jednu zprávu a hned ukonči:

```bash
ddev exec php bin/console messenger:consume async --limit=1 --time-limit=30 -vvv
```

## Klíčové soubory

| Soubor | Účel |
|---|---|
| `src/Message/SendToInsyzMessage.php` | DTO zprávy |
| `src/MessageHandler/SendToInsyzHandler.php` | Handler — XML, MSSQL, state transitions |
| `src/Controller/Api/PortalController.php` | Dispatch v `POST /api/portal/report` |
| `src/Service/InsyzService.php` | `submitReportToInsyz()` — MSSQL `trasy.ZP_Zapis_XML` |
| `src/Service/XmlGenerationService.php` | Generování XML pro INSYZ |
| `config/packages/messenger.yaml` | Transport + retry config |
| `deploy/portal-messenger-*.service` | systemd units |
| `deploy/setup-messenger.sh` | Instalátor systemd unitů (volá CI) |
| `.github/workflows/deploy.yml` | CI deploy včetně setup-messenger.sh |

---

**Related:** [Hlášení příkazů](../features/hlaseni-prikazu.md) | [INSYZ Integration](../features/insyz-integration.md)
**Updated:** 2026-06-04
