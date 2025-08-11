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
- `is_active` - Lokální aktivace/deaktivace

## 🛠️ Správa uživatelů

### Administrační rozhraní (NOVÉ)
Od verze 2025-08-10 je k dispozici webové administrační rozhraní:

**Přístup:**
- URL: `/admin/` (dashboard) a `/admin/uzivatele` (správa uživatelů)
- Oprávnění: ROLE_ADMIN nebo vyšší
- Navigace: V hlavním menu sekce "Administrace" pro admin uživatele

**Funkce admin rozhraní:**
- **Dashboard** - Přehled statistik (počty uživatelů, hlášení, audit logů)
- **Správa uživatelů** - Tabulka s filtry, správa rolí, aktivace/deaktivace
- **✅ Audit logy** - Pokročilá tabulka s TanStack Table, grafy aktivit, export CSV
- **INSYZ monitoring** - Sledování API performance a chyb (v přípravě)
- **Systémová nastavení** - Správa system options (v přípravě)

**Technická implementace:**
- Controller: `src/Controller/AdminController.php`
- Layout: `templates/admin.html.twig` extends `base.html.twig` s třídou `.admin`
- React apps: `assets/js/apps/admin/admin-*` využívají existující komponenty
- **Nové knihovny**: TanStack Table v8, Recharts pro grafy
- Žádné custom CSS - používá existující BEM komponenty + Tailwind

**Pokročilé funkce (admin-audit-logs):**
- Server-side pagination, sorting, filtering
- Expandable rows s detailem změn
- Interaktivní grafy (aktivita v čase, rozdělení akcí)
- Export do CSV
- Rychlé filtry (dnes, 7 dní, 30 dní)
- Real-time refresh

### Console Command
```bash
# Seznam všech uživatelů
ddev exec php bin/console app:user:manage

# Přidat admina
ddev exec php bin/console app:user:manage --add-admin 1234

# Odebrat admina  
ddev exec php bin/console app:user:manage --remove-admin 1234

# Aktivovat/deaktivovat
ddev exec php bin/console app:user:manage --activate 1234
ddev exec php bin/console app:user:manage --deactivate 1234

# Info o uživateli
ddev exec php bin/console app:user:manage --info 1234
```

### Admin API
Kompletní správa přes [Admin API](../api/admin-api.md#user-management-api):
- Seznam uživatelů s filtrováním
- Změna rolí
- Aktivace/deaktivace účtů
- Správa preferencí a nastavení

### Repository metody
```php
// Pokročilé vyhledávání
$userRepository->findByRole('ROLE_ADMIN');
$userRepository->findAdmins();
$userRepository->findRecentlyActive($days);
$userRepository->searchByName($query);
```

## 🔍 Audit Trail

Všechny změny uživatelů jsou automaticky logovány:
- Přihlášení/odhlášení
- Změny rolí
- Změny nastavení
- Aktivace/deaktivace

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

### Environment variables
```bash
# INSYZ připojení (read-only)
INSYZ_DB_USER=portal_user
INSYZ_DB_PASS=secure_password

# Audit retention
AUDIT_RETENTION_DAYS=90
```

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

## 📊 Statistiky a reporty

### Dostupné metriky
- Celkový počet uživatelů
- Aktivní vs neaktivní
- Rozdělení podle rolí
- Nedávná aktivita
- Top aktivní uživatelé

### API endpointy
- GET `/api/users/stats` - Základní statistiky
- GET `/api/audit-logs/stats` - Audit statistiky

---

**API dokumentace:** [../api/admin-api.md](../api/admin-api.md)  
**Audit systém:** [audit-logging.md](audit-logging.md)  
**Autentifikace:** [authentication.md](authentication.md)  
**Aktualizováno:** 2025-08-10