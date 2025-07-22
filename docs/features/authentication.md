# Authentication - Autentifikace a zabezpečení

> **Funkcionální oblast** - Kompletní systém přihlašování, autorizace a zabezpečení aplikace

## 🔐 Přehled authentication systému

### Architektura autentifikace
```
User Input → InsysAuthenticator → InsysUserProvider → Symfony Security → Session
            ↓                    ↓                   ↓               ↓
      INSYS Validation    Load User Data        Create User      Store Session
```

**Klíčové principy:**
- **Hybrid autentifikace:** JSON API + HTML forms
- **Session-based:** Přihlášení uloženo v session, ne JWT tokeny
- **INSYS integrace:** Ověření credentials přes INSYS/MSSQL
- **Role-based access:** ROLE_USER, ROLE_VEDOUCI podle INSYS dat

## 🛠️ Backend Security komponenty

### 1. **InsysAuthenticator** - Custom authenticator

```php
// src/Security/InsysAuthenticator.php
class InsysAuthenticator extends AbstractAuthenticator 
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
        
        // INSYS ověření
        $intAdr = $this->insysService->loginUser($username, $password);
        
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

### 2. **InsysUserProvider** - User loading z INSYS

```php
// src/Security/InsysUserProvider.php
class InsysUserProvider implements UserProviderInterface 
{
    public function loadUserByIdentifier(string $identifier): UserInterface {
        // Identifier je INT_ADR z INSYS
        $userData = $this->insysService->getUser((int)$identifier);
        
        // Vytvoř User objekt z INSYS dat
        $user = new User(
            (string)($userData['INT_ADR'] ?? ''),
            $userData['eMail'] ?? '',
            $userData['Jmeno'] ?? '',
            $userData['Prijmeni'] ?? ''
        );
        
        // Role assignment podle INSYS dat
        $roles = ['ROLE_USER'];
        if (!empty($userData['Vedouci_dvojice']) && $userData['Vedouci_dvojice'] === '1') {
            $roles[] = 'ROLE_VEDOUCI';
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

### 4. **User Entity** - Plain PHP class

```php
// src/Entity/User.php (není Doctrine entity!)
class User implements UserInterface 
{
    public function __construct(
        private string $intAdr,
        private string $email, 
        private string $jmeno,
        private string $prijmeni,
        private array $roles = ['ROLE_USER']
    ) {}
    
    // Gettery pro INSYS data
    public function getIntAdr(): string;
    public function getJmeno(): string;
    public function getPrijmeni(): string;
    public function getEmail(): string;
    public function getPrukazZnackare(): ?string;
    
    // UserInterface implementation
    public function getRoles(): array;
    public function getUserIdentifier(): string;
    public function eraseCredentials(): void;
}
```

## 🔧 Security konfigurace

### Symfony Security (config/packages/security.yaml)

```yaml
security:
    providers:
        insys_provider:
            id: App\Security\InsysUserProvider
    
    firewalls:
        # API endpoints firewall
        api:
            pattern: ^/api
            stateless: false                    # Session-based, ne stateless
            provider: insys_provider
            context: shared_context             # Sdílený kontext mezi API a web
            entry_point: App\Security\ApiAuthenticationEntryPoint
            custom_authenticator: App\Security\InsysAuthenticator
            remember_me:
                secret: '%kernel.secret%'
                lifetime: 604800                # 1 týden
            logout:
                path: /api/auth/logout
                target: /
                
        # Web pages firewall 
        main:
            pattern: ^/
            provider: insys_provider
            context: shared_context             # Sdílený s API
    
    access_control:
        # Public API endpoints
        - { path: ^/api/auth/login, roles: PUBLIC_ACCESS }
        - { path: ^/api/auth/status, roles: PUBLIC_ACCESS }
        - { path: ^/api/test/, roles: PUBLIC_ACCESS }
        
        # Protected API endpoints
        - { path: ^/api, roles: ROLE_USER }
```

## 🌐 API Endpointy

### AuthController - Authentication API

```php
// src/Controller/Api/AuthController.php
#[Route('/api/auth')]
class AuthController extends AbstractController {
    
    #[Route('/login', methods: ['POST'])]
    public function login(): JsonResponse {
        // InsysAuthenticator automaticky zpracuje přihlášení
        // Tento endpoint vrací user data po úspěšném přihlášení
        $user = $this->getUser();
        
        return new JsonResponse([
            'success' => true,
            'user' => [
                'INT_ADR' => $user->getIntAdr(),
                'Jmeno' => $user->getJmeno(),
                'Prijmeni' => $user->getPrijmeni(),
                'roles' => $user->getRoles()
            ]
        ]);
    }
    
    #[Route('/status', methods: ['GET'])]
    public function status(): JsonResponse {
        // Zkontroluj jestli je uživatel přihlášený
        $user = $this->getUser();
        
        if (!$user instanceof User) {
            return new JsonResponse(['authenticated' => false]);
        }
        
        return new JsonResponse([
            'authenticated' => true,
            'user' => [/* user data */]
        ]);
    }
    
    #[Route('/logout')]
    public function logout(): void {
        // Symfony firewall automaticky zpracuje odhlášení
        throw new \Exception('Handled by Symfony Security');
    }
}
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
1. InsysAuthenticator ověří credentials přes INSYS
2. InsysUserProvider načte user data z INSYS  
3. Symfony vytvoří authenticated session
4. Subsequent API calls automaticky authorized

// Session data uložena:
- User object s INSYS daty (INT_ADR, jméno, email, roles)
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
$prikazy = $this->insysService->getPrikazy($user->getIntAdr(), $year);
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
const response = await fetch('/api/insys/prikazy', {
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
// Role assignment v InsysUserProvider
$roles = ['ROLE_USER'];
if ($userData['Vedouci_dvojice'] === '1') {
    $roles[] = 'ROLE_VEDOUCI';  // Team leader role
}

// Access control v controllers
if (!$this->isGranted('ROLE_VEDOUCI')) {
    throw new AccessDeniedException();
}
```

## 🧪 Testing authentication

### Test credentials
```bash
# Development test credentials
Email: test@test.com
Password: test123
# Vrací: INT_ADR, ROLE_USER + ROLE_VEDOUCI
```

### Test API calls
```bash
# Test login
curl -X POST https://portalznackare.ddev.site/api/test/login-test \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","hash":"test123"}'

# Test auth status
curl https://portalznackare.ddev.site/api/auth/status \
  -H "Cookie: PHPSESSID=your_session_id"

# Test protected endpoint  
curl https://portalznackare.ddev.site/api/test/insys-user \
  -H "Cookie: PHPSESSID=your_session_id"
```

### Debug authentication
```php
// Debug log v InsysAuthenticator
error_log("Authentication attempt for: " . $username);
error_log("INSYS returned INT_ADR: " . $intAdr);

// Session debug
$session = $request->getSession();
error_log("Session ID: " . $session->getId());
error_log("User in session: " . ($this->getUser() ? 'yes' : 'no'));
```

## 🛠️ Troubleshooting

### Časté problémy

#### 1. **Session not persisting**
```javascript
// ❌ ŠPATNĚ - chybí credentials
fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({...})
});

// ✅ SPRÁVNĚ - s credentials pro session cookies
fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',  // Klíčové pro session!
    body: JSON.stringify({...})
});
```

#### 2. **CORS issues s credentials**
```yaml
# config/packages/nelmio_cors.yaml
nelmio_cors:
    defaults:
        allow_credentials: true
        origin_regex: true
        allow_origin: ['%env(CORS_ALLOW_ORIGIN)%']
        allow_methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        allow_headers: ['Content-Type', 'Authorization']
```

#### 3. **Role assignment not working**
```php
// Debug role assignment
$userData = $this->insysService->getUser($intAdr);
dump($userData['Vedouci_dvojice']);  // Mělo by být "1" pro leaders

// Debug final user roles
$user = $this->userProvider->loadUserByIdentifier($intAdr);
dump($user->getRoles());  // Mělo by obsahovat ROLE_VEDOUCI
```

#### 4. **API 401 errors**
```php
// Zkontroluj firewall konfiguraci
// API firewall MUSÍ být před main firewall!
api:
    pattern: ^/api
    # ... config
main:
    pattern: ^/     # Toto musí být DRUHÉ
```

## 🔐 Production security checklist

### Environment variables
```bash
# .env.local (production)
APP_ENV=prod
APP_SECRET=random-32-character-secret-key-here
SESSION_HANDLER_DSN=redis://localhost:6379  # Pro Redis sessions

# INSYS credentials  
USE_TEST_DATA=false
INSYS_DB_HOST=secure.mssql.server
INSYS_DB_USER=limited_portal_user  # Ne admin!
INSYS_DB_PASS=complex_secure_password
```

### Security headers
```yaml
# TODO: Implement security headers
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

**INSYS Integration:** [insys-integration.md](insys-integration.md)  
**API Reference:** [../api/authentication-api.md](../api/authentication-api.md)  
**Configuration:** [../configuration/security.md](../configuration/security.md)  
**Aktualizováno:** 2025-07-21