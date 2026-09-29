# User Management - Správa uživatelů

> **Funkcionální oblast** - Lokální správa uživatelů synchronizovaná s INSYZ databází

## 🔄 Přehled systému

### Hybridní architektura
```
INSYZ (MSSQL)          Portal (PostgreSQL)
    User Data      →      User Entity
    (master)              (local copy)
       ↓                      ↓
   Authentication         Preferences
                         Settings
                         Roles
                         Audit Trail
```

**Klíčové principy:**
- **INSYZ = master data** - Základní údaje (jméno, email, INT_ADR)
- **Local DB = rozšíření** - Role, preference, nastavení, audit
- **INT_ADR = univerzální ID** - Propojení napříč systémy
- **Automatická synchronizace** - Při každém přihlášení

## 📋 User Entity

### Databázový model
```php
User {
    id: int                 // Lokální ID
    int_adr: int           // INSYZ identifikátor (UNIQUE)
    email: string
    jmeno: string
    prijmeni: string
    roles: json            // ["ROLE_USER", "ROLE_ADMIN"]
    preferences: json      // Uživatelské preference
    settings: json         // Aplikační nastavení
    is_active: bool        // Aktivní účet
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime
}
```

### Role v systému
- **ROLE_USER** - Základní role (automaticky)
- **ROLE_VEDOUCI** - Vedoucí dvojice (z INSYZ)
- **ROLE_ADMIN** - Administrátor portálu
- **ROLE_SUPER_ADMIN** - Superadmin (nebezpečné operace)

## 🔐 Synchronizace s INSYZ

### Při přihlášení
```php
1. Uživatel zadá INSYZ credentials
2. InsyzAuthenticator ověří v MSSQL
3. InsyzUserProvider načte INSYZ data
4. Kontrola lokální DB:
   - Existuje? → UPDATE z INSYZ dat
   - Neexistuje? → CREATE nový záznam
5. Aktualizace last_login_at
```

### Synchronizovaná pole
- `int_adr` - Nikdy se nemění
- `email` - Aktualizováno z INSYZ
- `jmeno`, `prijmeni` - Aktualizováno z INSYZ
- `ROLE_VEDOUCI` - Podle INSYZ Vedouci_dvojice

### Lokální pole (nesynchronizovaná)
- `roles` - Kromě ROLE_VEDOUCI
- `preferences` - Uživatelské nastavení
- `settings` - Aplikační konfigurace
- `is_active` - Lokální aktivace/deaktivace – deaktivovaný účet se nepřihlásí (`App\Security\UserChecker`) a běžící session skončí do 5 min (`InsyzUserProvider::refreshUser`)

## 🛠️ Správa uživatelů

### Administrační rozhraní
**Přístup:** `/admin/` (dashboard), `/admin/uzivatele` (seznam uživatelů) – `ROLE_ADMIN`
(`#[IsGranted]` na `AdminController` + `access_control ^/admin`). V `security.yaml` není `role_hierarchy`,
takže `ROLE_SUPER_ADMIN` sám o sobě do administrace nepustí – superadmin musí mít i `ROLE_ADMIN`.

**Stránky (server-side Twig, bez vlastního API):**
- **Dashboard** (`/admin/`) – počty uživatelů (celkem, aktivní, admini, přihlášení za 7 dní), hlášení podle stavu,
  audit záznamy (dnes / 7 dní), INSYZ volání a chyby dnes, posledních 10 audit záznamů
- **Uživatelé** (`/admin/uzivatele`) – jen výpis tabulkou (ID, jméno, email, role, aktivní, poslední přihlášení);
  role ani aktivaci v UI měnit nelze – slouží k tomu console command níže
- **Audit logy** (`/admin/audit-logy`) – posledních 100 záznamů `audit_logs`
- **INSYZ monitoring** (`/admin/insyz-monitoring`) – posledních 100 záznamů `insyz_audit_logs`
- **Systémová nastavení** (`/admin/system-nastaveni`) – jen `ROLE_SUPER_ADMIN`

**Technická implementace:**
- Controller: `src/Controller/AdminController.php`, šablony `templates/admin/*.html.twig`
- Layout: `templates/admin.html.twig` (samostatný layout, `<html class="admin">`, vkládá `components/api-token.html.twig`)
- React appky v administraci: `admin-reports-list`, `admin-report-detail`, `admin-cms-pages`,
  `admin-cms-page-editor`, `admin-media-library` (`assets/js/apps/`)

### Console Command
```bash
# Seznam všech uživatelů (aktivní)
php bin/console app:user:manage list

# Seznam s filtry
php bin/console app:user:manage list --filter=admin
php bin/console app:user:manage list --filter=recent
php bin/console app:user:manage list --search="Jan"

# Synchronizace uživatele z INSYZ
php bin/console app:user:manage sync 12345

# Správa rolí
php bin/console app:user:manage role 12345 --role=ROLE_ADMIN --add
php bin/console app:user:manage role user@example.com --role=ROLE_SUPER_ADMIN --add
php bin/console app:user:manage role 12345 --role=ROLE_ADMIN      # odstranit

# Detailní info o uživateli
php bin/console app:user:manage show 12345
php bin/console app:user:manage show user@example.com

# Aktivovat/deaktivovat účet
php bin/console app:user:manage activate 12345
php bin/console app:user:manage deactivate user@example.com

# Nápověda
php bin/console app:user:manage --help
```

### Admin API
REST API pro správu uživatelů neexistuje. Přehled admin endpointů:
[API – Administrace](../api.md#administrace).

### Repository metody (`UserRepository`)
```php
$userRepository->findByIntAdr($intAdr);
$userRepository->findByEmail($email);
$userRepository->findOrCreateFromInsyzData($insyzData);   // vytvoření/aktualizace při přihlášení a sync
$userRepository->findByRole('ROLE_ADMIN');
$userRepository->findAdmins();
$userRepository->findRecentlyActive($days);
$userRepository->search($query);
$userRepository->getStatistics();
```

## 🔍 Audit Trail

Logují se přihlášení a neúspěšná přihlášení (`InsyzAuthenticator` → `AuditLogger::logLogin()` / `logFailedLogin()`;
`logLogout()` existuje, ale nikde se nevolá),
změny rolí a aktivace z `app:user:manage` (`AuditLogger::logByIntAdr()`) a změny entit podle
konfigurace `audit.log_entities` (`AuditEventListener`).

Viz [Audit Logging](audit-logging.md) pro detaily.

## 📦 Services

### UserRepository
- CRUD operace
- Pokročilé vyhledávání
- Statistiky uživatelů

### InsyzUserProvider  
- Synchronizace při přihlášení
- Vytváření User entit
- Mapování INSYZ → Local

### AuditLogger
- Automatické logování změn
- INT_ADR jako identifikátor

## 🚨 Bezpečnostní pravidla

1. **Nikdy neměnit INT_ADR** - Klíč pro INSYZ
2. **INSYZ data jsou read-only** - Změny jen v INSYZ
3. **Role validace** - Pouze povolené role
4. **Audit vše** - Každá změna je logována
5. **Session-based** - Žádné API tokeny

## 🔧 Konfigurace

### INSYZ připojení
Proměnné `INSYZ_DB_*` a `USE_TEST_DATA` – viz [configuration.md](../configuration.md).
Retence audit logů se nastavuje system option `audit.retention_days` (stránka `/admin/system-nastaveni`),
ne proměnnou prostředí.

### System Options
```json
{
    "audit.log_entities": {
        "User": {
            "enabled": true,
            "events": ["create", "update"],
            "masked_fields": ["password"]
        }
    }
}
```

## 📊 Statistiky

Statistiky uživatelů zobrazuje dashboard `/admin/` (počítá je přímo `AdminController::dashboard()`);
`UserRepository::getStatistics()` je k dispozici pro další použití. Samostatné statistické API endpointy neexistují.

---

**API dokumentace:** [../api.md](../api.md#administrace)  
**Audit systém:** [audit-logging.md](audit-logging.md)  
**Autentifikace:** [authentication.md](authentication.md)  
**Aktualizováno:** 2026-09-27