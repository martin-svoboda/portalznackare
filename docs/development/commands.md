# Console Commands - Reference

> **Kompletní přehled** všech vlastních i systémových konzolových příkazů aplikace Portál značkaře.

## Vlastní příkazy aplikace

### `app:user:manage` - Správa uživatelů

Hlavní příkaz pro správu uživatelů, rolí a synchronizaci s INSYZ systémem.

```bash
# Seznam aktivních uživatelů
php bin/console app:user:manage list

# Filtrování
php bin/console app:user:manage list --filter=admin      # Pouze admini
php bin/console app:user:manage list --filter=recent      # Nedávno aktivní
php bin/console app:user:manage list --search="Novák"     # Hledání podle jména/emailu

# Detail uživatele (podle INT_ADR nebo emailu)
php bin/console app:user:manage show 12345
php bin/console app:user:manage show user@example.com

# Synchronizace uživatele z INSYZ
php bin/console app:user:manage sync 12345

# Správa rolí
php bin/console app:user:manage role 12345 --role=ROLE_ADMIN --add       # Přidat roli
php bin/console app:user:manage role 12345 --role=ROLE_ADMIN             # Odebrat roli
php bin/console app:user:manage role user@example.com --role=ROLE_VEDOUCI --add

# Aktivace/deaktivace účtu
php bin/console app:user:manage activate 12345
php bin/console app:user:manage deactivate 12345
```

**Dostupné role:**

| Role | Popis |
|------|-------|
| `ROLE_USER` | Základní role (automaticky všichni) |
| `ROLE_VEDOUCI` | Vedoucí dvojice (sync z INSYZ) |
| `ROLE_ADMIN` | Administrátor |
| `ROLE_SUPER_ADMIN` | Super admin (systémová nastavení) |

**Výstup `show`:** Tabulka vlastností uživatele, preference, poslední audit log aktivita.

---

### `insyz:audit` - INSYZ audit systém

Správa a monitoring INSYZ API audit logů.

```bash
# Stav audit systému (konfigurace, aktivní features)
php bin/console insyz:audit status

# Zobrazení konfigurace
php bin/console insyz:audit config

# Úprava konfigurace
php bin/console insyz:audit config --set enabled=false
php bin/console insyz:audit config --set retention_days=60
php bin/console insyz:audit config --set log_requests=false --set log_responses=false

# Statistiky výkonu
php bin/console insyz:audit stats                         # Výchozí: 24 hodin
php bin/console insyz:audit stats --period="1 hour"
php bin/console insyz:audit stats --period="7 days"

# Čištění starých logů
php bin/console insyz:audit cleanup --dry-run             # Náhled bez smazání
php bin/console insyz:audit cleanup                       # Smazání dle retention policy
```

**Konfigurovatelné možnosti:**

| Volba | Typ | Popis |
|-------|-----|-------|
| `enabled` | boolean | Zapnout/vypnout audit |
| `log_requests` | boolean | Logování požadavků |
| `log_responses` | boolean | Logování odpovědí |
| `log_mssql_queries` | boolean | Logování MSSQL dotazů |
| `log_cache_operations` | boolean | Logování cache operací |
| `log_user_agents` | boolean | Logování user agentů |
| `log_ip_addresses` | boolean | Logování IP adres |
| `retention_days` | integer | Doba uchování logů (dny) |
| `slow_query_threshold_ms` | integer | Práh pomalých dotazů (ms) |

**Výstup `stats`:** Top endpointy, top MSSQL procedury, cache efektivita (hit rate).

---

### `app:files:cleanup` - Čištění dočasných souborů

```bash
php bin/console app:files:cleanup
```

Smaže expired a soft-deleted dočasné soubory přes FileUploadService.

---

### `app:test-user-roles` - Test rolí (debugging)

```bash
php bin/console app:test-user-roles
```

Výstup: Aktuální uživatel, role jako JSON, stav ROLE_ADMIN a ROLE_SUPER_ADMIN grantů.
**Pozn.:** V konzoli bez session bude uživatel `null`.

---

## Symfony systémové příkazy

### Cache

```bash
# Vyčištění cache poolů
php bin/console cache:pool:clear app.api_cache
php bin/console cache:pool:clear app.long_cache

# Debug info o cache poolu
php bin/console debug:cache-pool app.api_cache

# Kompletní vyčištění cache
php bin/console cache:clear
php bin/console cache:clear --env=prod
```

### Messenger (asynchronní úlohy)

```bash
# Spuštění workeru
php bin/console messenger:consume async
php bin/console messenger:consume async --limit=10        # Zpracuj max 10 zpráv

# Statistiky fronty
php bin/console messenger:stats

# Selhané zprávy
php bin/console messenger:failed:show
php bin/console messenger:failed:retry
```

### Doctrine (databáze)

```bash
# Migrace
php bin/console doctrine:migrations:migrate --no-interaction
php bin/console doctrine:migrations:status
php bin/console doctrine:migrations:diff                  # Vygenerovat novou migraci

# Schema info
php bin/console doctrine:schema:validate
```

### Debug

```bash
# Přehled rout
php bin/console debug:router
php bin/console debug:router --show-controllers

# Přehled services
php bin/console debug:container --tag=controller.service_arguments

# Event listeners
php bin/console debug:event-dispatcher
```

---

## Použití s DDEV (development)

V lokálním vývoji prefix `ddev exec`:

```bash
ddev exec php bin/console app:user:manage list
ddev exec php bin/console insyz:audit status
ddev exec php bin/console cache:clear
```

## Použití na produkci (SSH)

```bash
ssh user@server
cd /path/to/project
php bin/console app:user:manage list --filter=admin
```

---

## Deployment příkazy

Při nasazení se automaticky spouští (viz `deploy/deploy.sh`):

```bash
php bin/console cache:clear --env=prod
php bin/console doctrine:migrations:migrate --no-interaction
php bin/console messenger:stats
```

---

**Související dokumentace:** [User Management](../features/user-management.md) | [Audit Logging](../features/audit-logging.md) | [Development](development.md) | [Background Jobs](background-jobs.md)
**Hlavní přehled:** [../overview.md](../overview.md)
**Aktualizováno:** 2026-03-01
