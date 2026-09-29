# Authentication - Autentifikace a zabezpečení

> **Funkcionální oblast** - Kompletní systém přihlašování, autorizace a zabezpečení aplikace

## 🔐 Přehled authentication systému

### Architektura autentifikace
```
User Input → InsyzAuthenticator → InsyzUserProvider → Symfony Security → Session
            ↓                    ↓                   ↓               ↓
      INSYZ Validation    Load User Data        Create User      Store Session
                                 ↓                   ↓
                          Local DB Sync         Update User Entity
```

**Klíčové principy:**
- **Hybrid autentifikace:** JSON API + HTML forms
- **Session-based:** Přihlášení uloženo v session, ne JWT tokeny
- **INSYZ integrace:** Ověření credentials přes INSYZ/MSSQL
- **Local DB sync:** Uživatel se z INSYZ načte a uloží do PostgreSQL, jen když v lokální DB není (nebo není aktivní)
- **Role-based access:** ROLE_USER, ROLE_VEDOUCI (INSYZ) + ROLE_ADMIN (local)

## 📋 API Endpointy

### GET `/api/auth/status`
Zkontroluje stav přihlášení aktuálního uživatele.

**Response (přihlášený):**
```json
{
    "authenticated": true,
    "user": {
        "INT_ADR": 1234,
        "Jmeno": "Test",
        "Prijmeni": "Značkář",
        "Email": "test@test.com",
        "roles": ["ROLE_USER"]
    }
}
```

**Response (nepřihlášený):**
```json
{
    "authenticated": false,
    "user": null
}
```

### POST `/api/auth/login`
Přihlášení uživatele (zpracovává Symfony Security).

**Request:**
```json
{
    "username": "test",
    "password": "test"
}
```

Přijímá JSON i klasický formulář (`username`, `password`). Jako každé `/api/*` volání vyžaduje hlavičku
`X-CSRF-Token` (přidává ji obal `fetch` v layoutu, viz [configuration.md](../configuration.md)).

**Response (JSON request, úspěch)** – vrací `InsyzAuthenticator::onAuthenticationSuccess()`:
```json
{
    "success": true,
    "redirect_url": null,
    "user": {"INT_ADR": 1234, "Jmeno": "...", "Prijmeni": "...", "eMail": "...", "Prukaz_znackare": "...", "roles": ["ROLE_USER"]}
}
```
U formulářového požadavku následuje redirect (na uloženou `login_redirect_url`, jinak `/`).

**Omezení neúspěšných pokusů** (`InsyzAuthenticator` + `InsyzClientThrottler`, konfigurace v `services.yaml`):
- per e-mail (normalizovaný, malá písmena): 5 neúspěchů / 15 min; per IP: 20 / 15 min,
- při blokaci se INSYZ nevolá a pokus se nepočítá (blokace se neprodlužuje) → `429`
  s hláškou „Příliš mnoho neúspěšných pokusů o přihlášení. Zkuste to znovu za X min.“,
- úspěšné přihlášení nuluje čítač e-mailu (IP ne),
- `POST /api/insyz/login` (ověření údajů bez přihlášení) jen pro `ROLE_ADMIN` – INSYZ tester.
- Testy: `tests/Security/InsyzAuthenticatorThrottleTest.php`

### `/api/auth/logout`
Odhlášení řeší Symfony firewall (`logout.path`), po odhlášení **redirect na `/`** (žádná JSON odpověď).
Je ve výjimkách `ApiCsrfListener` – volá se obyčejným odkazem.

### GET `/api/auth/me` (`AuthApiController`, `ROLE_USER`)
Detail přihlášeného uživatele z DB (serializační skupina `user:read`) a odvozená oprávnění:
```json
{
    "user": {"id": 1, "intAdr": 1234, "email": "...", "jmeno": "...", "prijmeni": "...", "roles": ["ROLE_USER"], "...": "..."},
    "permissions": {
        "can_manage_users": false, "can_view_audit_logs": false, "can_manage_system_options": false,
        "can_export_data": false, "is_super_admin": false
    },
    "from_session": false,
    "database_user_found": true
}
```
Když uživatel v DB není, vrací jen `int_adr`, `email`, `jmeno`, `prijmeni`, `roles` s `from_session: true`.

### GET `/api/auth/csrf-token` (veřejný)
Vrátí nový API token pro aktuální session: `{"token": "..."}` (`Cache-Control: no-store`). Volá ho obal `fetch`,
když server odpoví `403` s hlavičkou `X-CSRF-Invalid`. Viz [configuration.md](../configuration.md).

## 🛠️ Backend Security komponenty

### 1. **InsyzAuthenticator** (`src/Security/InsyzAuthenticator.php`)
- `supports()` – jen `POST /api/auth/login`
- `authenticate()` – čte `username`/`password` z JSON nebo formuláře, kontroluje throttling, volá
  `InsyzService::loginUser()` a vrací `SelfValidatingPassport` s `UserBadge(INT_ADR)` a `RememberMeBadge`
- `onAuthenticationSuccess()` – nastaví `last_login_at`, doplní výchozí preference
  (`UserPreferenceService::ensureUserPreferences()`), zapíše `user_login` do auditu, vrátí JSON nebo redirect
- `onAuthenticationFailure()` – započítá pokus do throttlingu a zapíše `user_login_failed`

### 2. **InsyzUserProvider** (`src/Security/InsyzUserProvider.php`)
- `loadUserByIdentifier(INT_ADR)` – když uživatel **existuje v DB a je aktivní**, vrátí ho bez volání INSYZ;
  jinak načte `InsyzService::getUser()` (dataset `[0][0]`) a zavolá `UserRepository::findOrCreateFromInsyzData()`
  (vytvoření nebo `User::updateFromInsyzData()` – lokální `ROLE_ADMIN`/`ROLE_SUPER_ADMIN` zůstávají,
  `ROLE_VEDOUCI` podle `Vedouci_dvojice`)
- `refreshUser()` – uživatele znovu načte, jen pokud je jeho `updated_at` starší než 5 minut

### 3. **ApiAuthenticationEntryPoint** (`src/Security/ApiAuthenticationEntryPoint.php`)
Nepřihlášený požadavek na `/api/*` → JSON `{"error": true, "message": "Authentication required", "code": 401}`;
ostatní URL → redirect na `/prihlaseni?redirect=<původní URL>`.

### 4. **User entita** (`src/Entity/User.php`)
Jediná třída – Doctrine entita i `UserInterface` pro session. Pole viz [user-management.md](user-management.md);
synchronizace `createFromInsyzData()` / `updateFromInsyzData()`.

## 🔧 Security konfigurace

### Symfony Security (config/packages/security.yaml)
Zkráceně (úplná konfigurace v souboru):
```yaml
security:
    providers:
        insyz_provider:
            id: App\Security\InsyzUserProvider
    firewalls:
        dev:                      # jen statické ^/(css|images|js)/, security: false
        main:
            pattern: ^/
            lazy: true
            provider: insyz_provider
            custom_authenticator: App\Security\InsyzAuthenticator
            remember_me: { lifetime: 604800 }   # 1 týden
            logout: { path: /api/auth/logout, target: / }
            entry_point: App\Security\ApiAuthenticationEntryPoint
    access_control:
        - { path: ^/(_profiler|_wdt), roles: ROLE_SUPER_ADMIN }
        - { path: ^/api/auth/login, roles: PUBLIC_ACCESS }
        - { path: ^/api/auth/status, roles: PUBLIC_ACCESS }
        - { path: ^/api/auth/csrf-token$, roles: PUBLIC_ACCESS }
        - { path: ^/api/test/, roles: PUBLIC_ACCESS }                      # ověření v TestControlleru
        - { path: ^/api/insyz-client/db-password$, roles: PUBLIC_ACCESS }
        - { path: ^/admin, roles: ROLE_ADMIN }
        - { path: ^/api, roles: ROLE_USER }
        # + stránky /prikazy, /prikaz/, /profil, /metodika, /napoveda, /downloads → ROLE_USER
```
`role_hierarchy` není definována – `ROLE_SUPER_ADMIN` neobsahuje automaticky `ROLE_ADMIN`.


## 🔄 Authentication flow

### 1. **Login proces** 

#### JSON API login
```javascript
// React/AJAX login
const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',  // Důležité pro session cookies
    body: JSON.stringify({
        username: 'test@test.com',
        password: 'test123'
    })
});

const result = await response.json();
if (result.success) {
    // Přihlášení úspěšné, session vytvořena
    console.log('User:', result.user);
}
```

#### HTML Form login  
```html
<!-- Twig template login form -->
<form action="/api/auth/login" method="POST">
    <input type="text" name="username" placeholder="Email" required>
    <input type="password" name="password" placeholder="Heslo" required>
    <button type="submit">Přihlásit</button>
</form>
```

### 2. **Security validation po WEB_Login**

Procedura `WEB_Login` vrací jeden řádek se sjednocenou strukturou jak při úspěchu,
tak při neúspěchu (`INT_ADR=NULL` při chybě). `validateLoginResponse()` projde
flagy v pořadí od nejzákladnější chyby k nejspecifičtější a hází českou hlášku
určenou přímo pro uživatele:

```php
// InsyzService::validateLoginResponse() - src/Service/InsyzService.php

1. Email_nalezen — Je email v INSYZ?
   if (Email_nalezen !== '1')
       → "Zadaný email nebyl v INSYZ nalezen."

2. Heslo_se_shoduje — Sedne hash hesla?
   if (Heslo_se_shoduje !== '1')
       → "Zadané heslo je chybné — zkontrolujte zadané heslo,
          případně kontaktujte svého předsedu pro reset hesla."

3. WEBUser — Má uživatel povolen web přístup?
   if (WEBUser !== '1')
       → "Nemáte přístup k webovému rozhraní —
          kontaktujte svého předsedu o povolení uživatele pro web."

4. Zablokovano — Je účet zablokován?
   if (Zablokovano !== '0')
       → "Váš přístup byl zablokován —
          kontaktujte svého předsedu pro více informací."

5. KontrolaPlatnostiPwdWEB + Platnost_DO — Vypršela platnost hesla?
   if (KontrolaPlatnostiPwdWEB !== '0' && Platnost_DO < dnes)
       → "Platnost vašeho hesla vypršela —
          kontaktujte svého předsedu pro reset hesla."

6. Defense-in-depth: po všech kontrolách musí být INT_ADR neprázdné,
   jinak fallback "Chyba přihlášení, zkontrolujte údaje a zkuste to znovu."
```

Všechny kontroly používají `isset()` guard — pokud starší verze SP některý
flag neposílá, kontrola se přeskočí (graceful fallback během přechodu).

**Audit logging:**
- **Úspěšné přihlášení:** `status='success'`, `INT_ADR` = číslo uživatele
- **Zamítnuté přihlášení:** `status='error'`, `INT_ADR` = číslo uživatele pokud SP vrátila (jinak NULL), `error_message` = konkrétní česká hláška z `validateLoginResponse()`

**Příklad response (úspěšné přihlášení):**
```json
{
  "records": 1,
  "sample": [{
    "INT_ADR": "4133",
    "Email_nalezen": "1",
    "Heslo_se_shoduje": "1",
    "WEBUser": "1",
    "Zablokovano": "0",
    "Platnost": "OK",
    "Platnost_DO": "2026-09-02",
    "KontrolaPlatnostiPwdWEB": "0"
  }]
}
```

**Příklad response (špatné heslo):**
```json
{
  "records": 1,
  "sample": [{
    "INT_ADR": null,
    "Email_nalezen": "1",
    "Heslo_se_shoduje": "0",
    "WEBUser": "0",
    "Zablokovano": "0",
    "Platnost": null,
    "Platnost_DO": null,
    "KontrolaPlatnostiPwdWEB": "0"
  }]
}
```

### 3. **Session management**

```php
// Workflow po úspěšném přihlášení:
1. InsyzAuthenticator ověří credentials přes INSYZ
2. validateLoginResponse() zkontroluje bezpečnostní parametry
3. InsyzUserProvider načte user data z INSYZ
4. Symfony vytvoří authenticated session
5. Subsequent API calls automaticky authorized

// Session data uložena:
- security token s entitou User (INT_ADR, jméno, email, roles)
- Remember me cookie (RememberMeBadge)
- Session storage: výchozí PHP handler (handler_id: null)
```

### 4. **Authorization check**

```php
// V každém protected controllerů
$user = $this->getUser();
if (!$user instanceof User) {
    // Redirect na login nebo 401 JSON
    throw new AccessDeniedException();
}

// Role-based access
if (!$this->isGranted('ROLE_VEDOUCI')) {
    throw new AccessDeniedException('Only team leaders allowed');
}

// Access specific data
$prikazy = $this->insyzService->getPrikazy($user->getIntAdr(), $year);
```

### 5. **React / frontend**
React appky stav přihlášení samy nezjišťují – stránky chrání `access_control` a Twig. API volání posílají
session cookie (same-origin) a hlavičku `X-CSRF-Token` doplňuje globální obal `fetch`. `GET /api/auth/status`
je veřejný endpoint pro zjištění stavu přihlášení (frontend ho aktuálně nevolá).

## 🔒 Security features

### 1. **CSRF Protection**
Formulářový Symfony CSRF token (`_token`) přihlašovací formulář nepoužívá. Všechna volání `/api/*`
a `/admin/api/*` (včetně `POST /api/auth/login`) chrání `ApiCsrfListener` hlavičkou `X-CSRF-Token` –
viz [configuration.md](../configuration.md).

### 2. **Remember Me**
```yaml
# security.yaml - remember me konfigurace
remember_me:
    secret: '%kernel.secret%'
    lifetime: 604800  # 1 týden
    path: /
    domain: ~
```

### 3. **Session Security**
`config/packages/framework.yaml`: `cookie_secure: auto` (secure cookie při HTTPS), `cookie_samesite: lax`,
výchozí PHP session handler; `gc_maxlifetime` i `cookie_lifetime` = 28800 s (8 hodin).

### 4. **Role-based access**
```php
// Role (bez role_hierarchy)
ROLE_USER         // Základní přihlášený uživatel
ROLE_VEDOUCI      // Vedoucí dvojice (z INSYZ)
ROLE_ADMIN        // Administrátor portálu (lokální)
ROLE_SUPER_ADMIN  // Superadmin (nebezpečné operace)

// Access control v controllers
if (!$this->isGranted('ROLE_ADMIN')) {
    throw new AccessDeniedException();
}

// Role se spravují console commandem (REST API pro role neexistuje)
// php bin/console app:user:manage role 12345 --role=ROLE_ADMIN --add
```



## 🔐 Production security checklist

### Environment variables
Viz [configuration.md](../configuration.md) (`APP_SECRET`, `USE_TEST_DATA=false`, `INSYZ_DB_*`, `CI_HEALTHCHECK_TOKEN`…).

### Security headers
Nastavuje `src/EventListener/SecurityHeadersListener.php` (`X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`,
`Referrer-Policy`, `Content-Security-Policy` …).

### Session
`config/packages/framework.yaml`: `handler_id: null` (výchozí PHP session handler), `cookie_secure: auto`,
`cookie_samesite: lax`, session 8 hodin (`gc_maxlifetime` / `cookie_lifetime` 28800).

---

**User Management:** [user-management.md](user-management.md)
**Audit Logging:** [audit-logging.md](audit-logging.md)
**Admin API:** [../api.md](../api.md#administrace)
**INSYZ Integration:** [insyz-integration.md](insyz-integration.md)
**API Reference:** [../api.md](../api.md#přihlášení)
**Configuration:** [../configuration.md](../configuration.md)
**Aktualizováno:** 2026-05-10 - Sjednocená návratová struktura WEB_Login (Email_nalezen, Heslo_se_shoduje, WEBUser); konkrétní české chybové hlášky pro uživatele.