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
- **Local DB sync:** Automatická synchronizace s PostgreSQL při přihlášení
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

**Response (úspěch):**
```json
{
    "success": true,
    "user": {...},
    "message": "Přihlášení bylo úspěšné"
}
```

### POST `/api/auth/logout`
Odhlášení uživatele a zrušení session.

**Response:**
```json
{
    "success": true,
    "message": "Odhlášení bylo úspěšné"
}
```

## 🛠️ Backend Security komponenty

### 1. **InsyzAuthenticator** - Custom authenticator

```php
// src/Security/InsyzAuthenticator.php
class InsyzAuthenticator extends AbstractAuthenticator 
{
    public function supports(Request $request): ?bool {
        // Podporuje pouze POST na /api/auth/login
        return $request->getPathInfo() === '/api/auth/login' 
            && $request->isMethod('POST');
    }
    
    public function authenticate(Request $request): Passport {
        // Hybrid JSON/form support
        if ($request->getContentType() === 'json') {
            $data = json_decode($request->getContent(), true);
            $username = $data['username'] ?? '';
            $password = $data['password'] ?? '';
        } else {
            // Standard HTML form data
            $username = $request->request->get('username', '');
            $password = $request->request->get('password', '');
        }
        
        // INSYZ ověření
        $intAdr = $this->insyzService->loginUser($username, $password);
        
        // Vytvoř passport s user badge
        return new SelfValidatingPassport(
            new UserBadge((string)$intAdr, function ($userIdentifier) {
                return $this->userProvider->loadUserByIdentifier($userIdentifier);
            }),
            [new RememberMeBadge()]
        );
    }
}
```

### 2. **InsyzUserProvider** - User loading z INSYZ + DB sync

```php
// src/Security/InsyzUserProvider.php
class InsyzUserProvider implements UserProviderInterface 
{
    public function loadUserByIdentifier(string $identifier): UserInterface {
        // Identifier je INT_ADR z INSYZ
        $userData = $this->insyzService->getUser((int)$identifier);
        
        // Synchronizace s lokální DB
        $dbUser = $this->userRepository->findByIntAdr((int)$identifier);
        
        if (!$dbUser) {
            // Vytvoř nového uživatele v DB
            $dbUser = User::createFromInsyzData($userData);
            $this->entityManager->persist($dbUser);
        } else {
            // Aktualizuj existujícího
            $dbUser->updateFromInsyzData($userData);
        }
        
        // Ulož last_login_at
        $dbUser->setLastLoginAt(new \DateTimeImmutable());
        $this->entityManager->flush();
        
        // Vytvoř session User objekt
        $user = new \App\Entity\User(
            (string)($userData['INT_ADR'] ?? ''),
            $userData['eMail'] ?? '',
            $userData['Jmeno'] ?? '',
            $userData['Prijmeni'] ?? ''
        );
        
        // Role assignment - kombinace INSYZ + lokální DB
        $roles = $dbUser->getRoles();
        if (!empty($userData['Vedouci_dvojice']) && $userData['Vedouci_dvojice'] === '1') {
            if (!in_array('ROLE_VEDOUCI', $roles)) {
                $roles[] = 'ROLE_VEDOUCI';
            }
        }
        $user->setRoles($roles);
        
        return $user;
    }
}
```

### 3. **ApiAuthenticationEntryPoint** - API error handling

```php
// src/Security/ApiAuthenticationEntryPoint.php
class ApiAuthenticationEntryPoint implements AuthenticationEntryPointInterface 
{
    public function start(Request $request, AuthenticationException $authException = null): Response {
        // JSON error pro neautentifikované API požadavky
        return new JsonResponse([
            'error' => true,
            'message' => 'Authentication required',
            'code' => 401
        ], Response::HTTP_UNAUTHORIZED);
    }
}
```

### 4. **User Entities** - Session vs DB

```php
// src/Entity/User.php - Session User (implements UserInterface)
class User implements UserInterface 
{
    // Lightweight session object
    public function __construct(
        private string $intAdr,
        private string $email, 
        private string $jmeno,
        private string $prijmeni,
        private array $roles = ['ROLE_USER']
    ) {}
}

// src/Entity/User.php - DB User Entity (Doctrine)
#[ORM\Entity(repositoryClass: UserRepository::class)]
class User 
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    private ?int $id = null;
    
    #[ORM\Column(unique: true)]
    private int $intAdr;
    
    #[ORM\Column(type: 'json')]
    private array $roles = ['ROLE_USER'];
    
    #[ORM\Column(type: 'json')]
    private array $preferences = [];
    
    #[ORM\Column(type: 'json')]
    private array $settings = [];
    
    #[ORM\Column]
    private bool $isActive = true;
    
    // Synchronizace s INSYZ
    public static function createFromInsyzData(array $data): self;
    public function updateFromInsyzData(array $data): self;
}
```

## 🔧 Security konfigurace

### Symfony Security (config/packages/security.yaml)

```yaml
security:
    providers:
        insyz_provider:
            id: App\Security\InsyzUserProvider
    
    firewalls:
        # API endpoints firewall
        api:
            pattern: ^/api
            stateless: false                    # Session-based, ne stateless
            provider: insyz_provider
            context: shared_context             # Sdílený kontext mezi API a web
            entry_point: App\Security\ApiAuthenticationEntryPoint
            custom_authenticator: App\Security\InsyzAuthenticator
            remember_me:
                secret: '%kernel.secret%'
                lifetime: 604800                # 1 týden
            logout:
                path: /api/auth/logout
                target: /
                
        # Web pages firewall 
        main:
            pattern: ^/
            provider: insyz_provider
            context: shared_context             # Sdílený s API
    
    access_control:
        # Public API endpoints
        - { path: ^/api/auth/login, roles: PUBLIC_ACCESS }
        - { path: ^/api/auth/status, roles: PUBLIC_ACCESS }
        - { path: ^/api/test/, roles: PUBLIC_ACCESS }
        
        # Protected API endpoints
        - { path: ^/api, roles: ROLE_USER }
```


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

### 2. **Session management**

```php
// Workflow po úspěšném přihlášení:
1. InsyzAuthenticator ověří credentials přes INSYZ
2. InsyzUserProvider načte user data z INSYZ  
3. Symfony vytvoří authenticated session
4. Subsequent API calls automaticky authorized

// Session data uložena:
- User object s INSYZ daty (INT_ADR, jméno, email, roles)
- Remember me cookie (pokud selected)
- Session storage (default: files)
```

### 3. **Authorization check**

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

### 4. **React authentication check**

```javascript
// Auth check v React apps
useEffect(() => {
    fetch('/api/auth/status', {
        credentials: 'same-origin'
    })
    .then(response => {
        if (response.status === 401) {
            // Redirect k přihlášení
            window.location.href = '/dashboard';
            return;
        }
        return response.json();
    })
    .then(data => {
        if (data.authenticated) {
            setUser(data.user);
        }
    });
}, []);

// API calls s automatickou session auth
const response = await fetch('/api/insyz/prikazy', {
    credentials: 'same-origin'  // Session cookies
});
```

## 🔒 Security features

### 1. **CSRF Protection**
```php
// Pro HTML forms (automaticky v Twig)
<input type="hidden" name="_token" value="{{ csrf_token('authenticate') }}">

// API calls mají CSRF disabled pro JSON content-type
```

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
```php
// Session timeout (Symfony default)
// session.gc_maxlifetime = 1440 sekund (24 min)

// Secure cookies v production
// session.cookie_secure = true  (HTTPS only)
// session.cookie_httponly = true (no JS access)
```

### 4. **Role-based access**
```php
// Role hierarchy
ROLE_USER         // Základní přihlášený uživatel
ROLE_VEDOUCI      // Vedoucí dvojice (z INSYZ)
ROLE_ADMIN        // Administrátor portálu (lokální)
ROLE_SUPER_ADMIN  // Superadmin (nebezpečné operace)

// Access control v controllers
if (!$this->isGranted('ROLE_ADMIN')) {
    throw new AccessDeniedException();
}

// Role management přes Admin API
PUT /api/users/{id}/roles
{
    "roles": ["ROLE_USER", "ROLE_ADMIN"]
}
```



## 🔐 Production security checklist

### Environment variables
```bash
# .env.local (production)
APP_ENV=prod
APP_SECRET=random-32-character-secret-key-here
SESSION_HANDLER_DSN=redis://localhost:6379  # Pro Redis sessions

# INSYZ credentials  
USE_TEST_DATA=false
INSYZ_DB_HOST=secure.mssql.server
INSYZ_DB_USER=limited_portal_user  # Ne admin!
INSYZ_DB_PASS=complex_secure_password
```

### Security headers
```yaml
# TODO: Implementovat security headers
# - Content-Security-Policy
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - Strict-Transport-Security (HTTPS)
```

### Session security
```php
// TODO: Redis session storage pro production
// session.save_handler = redis
// session.save_path = "tcp://localhost:6379"
```

---

**User Management:** [user-management.md](user-management.md)  
**Audit Logging:** [audit-logging.md](audit-logging.md)  
**Admin API:** [../api/admin-api.md](../api/admin-api.md)  
**INSYZ Integration:** [insyz-integration.md](insyz-integration.md)  
**API Reference:** [../api/insyz-api.md](../api/insyz-api.md)  
**Configuration:** [../configuration.md](../configuration.md)  
**Aktualizováno:** 2025-08-08