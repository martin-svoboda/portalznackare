# Deployment přehled

> **Deployment dokumentace** - Automatické nasazování aplikace na DEV a PROD servery

## 🚀 Deployment proces

Aplikace používá **GitHub Actions** pro automatický deployment:

### Deployment strategie
- **DEV server** - automaticky při push do `main` branch
- **PROD server** - automaticky při vytvoření git tagu

### Server konfigurace
```
DEV:  https://dev.portalznackare.cz  (37.235.105.56:/www/hosting/portalznackare.cz/dev/)
PROD: https://portalznackare.cz      (37.235.105.56:/www/hosting/portalznackare.cz/www/)
```

## 📋 Deployment workflow

### 1. Build fáze
- **PHP 8.3** setup s extensions (pdo_pgsql, pdo_sqlsrv)
- **Composer** install dependencies
- **Node.js 18** setup
- **npm** build frontend assets

### 2. Deploy fáze
- **rsync** synchronizace souborů na server
- **composer install** na serveru
- **Symfony** cache clear a migrations
- **Permissions** nastavení pro www-data

### 3. Health check
- Test API endpointů
- INSYZ/MSSQL connection test
- Error log monitoring

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
1. Deploy na PROD server
2. Backup předchozí verze
3. Health check produkce
4. Vytvoření GitHub Release

## 🔍 Monitoring

### Health check endpoints
- `/api/test/mssql-connection` - Test INSYZ databáze
- `/api/test/insyz-user` - Test API funkcionality
- `/api/test/insyz-prikazy` - Test dat z INSYZ

### Log soubory
- **DEV:** `/var/log/dev.log`
- **PROD:** `/var/log/prod.log`

## 🛠️ Rollback

V případě problémů:
1. Backupy jsou automaticky vytvářeny v `/backup/`
2. Rollback pomocí: `cp -r /backup/portal-znackare-YYYYMMDD-HHMMSS/* /www/hosting/portalznackare.cz/www/`

## 🔐 GitHub Secrets

Požadované secrets v repository:
- `SSH_PRIVATE_KEY` - SSH klíč pro přístup na server

---

**Deployment workflow:** [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml)  
**Hlavní dokumentace:** [overview.md](overview.md)  
**Aktualizováno:** 2025-07-21