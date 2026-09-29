# Deployment přehled

> **Deployment dokumentace** - Automatické nasazování aplikace na DEV a PROD servery

## 🚀 Deployment proces

Aplikace používá **GitHub Actions** pro automatický deployment:

### Deployment strategie
- **DEV server** - automaticky při push do `main` branch
- **PROD server** - automaticky při push libovolného git tagu (`tags: '*'`)

### Server konfigurace
```
DEV:  https://dev.portalznackare.cz  (37.235.105.56:/www/hosting/portalznackare.cz/dev/)
PROD: https://portalznackare.cz      (37.235.105.56:/www/hosting/portalznackare.cz/www/)
```

## 📋 Deployment workflow

Jeden job `deploy` v `.github/workflows/deploy.yml` (runner `ubuntu-22.04`).

### 1. Build fáze (na runneru)
- **PHP 8.3** setup s extensions (pdo, pdo_pgsql, pdo_sqlsrv…), `composer install` (u tagu `--no-dev`)
- **Node.js 18**, `npm ci`, `npm run build` → `public/build` se nahrává na server hotové

### 2. Deploy fáze
- **rsync `--delete`** na server; vynechává `.git`, `.github`, `node_modules`, `vendor`, `*.md`, `.env.local*`,
  `public/uploads`, celý `var/` (na serveru zůstává cache, logy, `var/xml-exports`) a `/.ddev`, `/tests`, `/docs`, `/user-docs`
- **PROD:** před rsync záloha jen toho, co deploy mění a není v repu: `pg_dump` databáze (`DATABASE_URL` z `.env.local`)
  + kopie `.env.local` do `/backup/portal-znackare-{db,env}-YYYYMMDD-HHMMSS`; ponechávají se **2 poslední**.
  Když dump selže, deploy se zastaví.
- SSH na server jako `root` (jediný dostupný přístup) s **připnutým klíčem serveru** v workflow (žádný `StrictHostKeyChecking=no`)
- na serveru: oprávnění 755/644, `composer install` (PROD `--no-dev`, běží jako root), kontrola `.env.local`
  (když chybí, deploy skončí chybou), pak `chown -R www-data:www-data .`
- Symfony příkazy běží jako **`www-data`** (`sudo -u www-data php bin/console`): `cache:clear`,
  `doctrine:migrations:migrate --allow-no-migration` (PROD navíc `cache:warmup`) – cache tak nevlastní root a
  není potřeba `chmod 777`
- `deploy/setup-messenger.sh dev|prod` – instalace/restart systemd služby `portal-messenger-{dev|prod}`
- PROD: `systemctl reload php8.3-fpm`

> **Selhání `cache:clear` nebo migrace deploy zastaví** (`set -e`) – workflow skončí chybou a messenger worker
> se nerestartuje. Nevratné: soubory už jsou nasazené, na PROD je před deployem záloha v `/backup/`.

### 3. Health check (po deployi)
- **DEV:** HTTP kód `/`, `/api/test/mssql-connection`, doba odezvy `/api/test/insyz-user`
- **PROD:** jen `/api/test/mssql-connection`
- Neúspěch (kód ≠ 200) vypíše varování a konec logu (`var/log/dev.log` / `var/log/api.log`); **když je nastavený
  `HEALTHCHECK_TOKEN`, workflow skončí chybou** (bez tokenu jen varování)

## 🔑 Požadavky na serveru

### Environment konfigurace
Na serveru musí existovat `.env.local` s příslušnou konfigurací.

**Detailní konfigurace:** [configuration.md](configuration.md)

### Server requirements
- **PHP 8.3** s extensions: pdo, pdo_pgsql, pdo_sqlsrv
- **PostgreSQL 16+** pro aplikační data
- **MSSQL driver** pro INSYZ připojení
- **composer** pro PHP dependencies
- **www-data** user permissions

## 🏷️ Release proces

### Vytvoření release
```bash
# Vytvoř tag pro produkční release
git tag 1.0.0
git push origin 1.0.0
```

### Automatické akce při tagu
1. Záloha databáze (`pg_dump`) + `.env.local` do `/backup/` (2 poslední)
2. Deploy na PROD server
3. Health check produkce (s nastaveným `HEALTHCHECK_TOKEN` blokující)
4. Vytvoření GitHub Release (`softprops/action-gh-release`, `generate_release_notes: true`) – vznikne vždy,
   když předchozí kroky neselžou. Text releasu („Health check prošel“, „API endpointy ověřeny“) je **pevný** a
   nereflektuje skutečný výsledek health checku.

## 🔍 Monitoring

### Health check endpoints
- `/api/test/mssql-connection` - Test INSYZ databáze
- `/api/test/insyz-user` - Test API funkcionality
- `/api/test/insyz-prikazy` - Test dat z INSYZ

**Přístup:** jen přihlášený admin, nebo CI s hlavičkou `X-Healthcheck-Token`.
Token = `CI_HEALTHCHECK_TOKEN` v `.env.local` na serveru a stejná hodnota v GitHub secret
`HEALTHCHECK_TOKEN` (workflow ho předává krokům Health check DEV/PROD). Bez nastavení vrací 403.

### Log soubory
Podle `config/packages/monolog.yaml`: v `APP_ENV=dev` `var/log/dev-YYYY-MM-DD.log` a `api-YYYY-MM-DD.log` (rotace, 7 dní); v `APP_ENV=prod` jde hlavní log
do `php://stderr` (log PHP-FPM) a API kanál navíc do rotujícího `var/log/api*.log`. Detail:
[production-logging.md](deployment/production-logging.md).

## 🛠️ Rollback

Automatický rollback workflow nemá.
1. **Kód:** nový tag na starším commitu spustí běžný PROD deploy té verze (kód je v repu).
2. **Databáze:** před každým PROD deployem `/backup/portal-znackare-db-*.sql.gz` (2 poslední). Obnova ručně, např.
   `gunzip -c /backup/portal-znackare-db-….sql.gz | psql "<DATABASE_URL bez ?parametrů>"` – přepíše data vzniklá po záloze.
3. **`.env.local`:** kopie `/backup/portal-znackare-env-*`.
4. `public/uploads` a `var/` deploy nemění, proto se při deployi nezálohují.

## 🔐 GitHub Secrets

Požadované secrets v repository:
- `SSH_PRIVATE_KEY` - SSH klíč pro přístup na server (uživatel `root`)
- `HEALTHCHECK_TOKEN` - stejná hodnota jako `CI_HEALTHCHECK_TOKEN` v `.env.local` na serveru
- `GITHUB_TOKEN` - automatický, pro vytvoření releasu

---

**Deployment workflow:** [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)  
**Hlavní dokumentace:** [overview.md](overview.md)  
**Aktualizováno:** 2026-09-27