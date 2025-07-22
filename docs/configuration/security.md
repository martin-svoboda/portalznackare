# Security Configuration

> **Configuration dokumentace** - Symfony Security, authentication, firewalls a access control

## 🔐 Přehled security architektury

**Authentication:** Custom InsysAuthenticator s INSYS/MSSQL backend  
**Session Management:** Symfony session s remember_me funkčností  
**API Security:** Shared context mezi web a API firewalls  
**Access Control:** Role-based s PUBLIC_ACCESS a ROLE_USER

### Security komponenty
- **InsysUserProvider** - User loading z INSYS databáze
- **InsysAuthenticator** - Custom autentifikace logika
- **ApiAuthenticationEntryPoint** - JSON error responses pro API
- **Shared Context** - Session sdílení mezi firewalls

## 🛡️ Firewall Configuration

### Dev Firewall (Profiler)
```yaml
# config/packages/security.yaml
firewalls:
    dev:
        pattern: ^/(_(profiler|wdt)|css|images|js)/
        security: false
```

**Účel:** Vypíná security pro development tools
- Symfony Web Profiler (`/_profiler`)
- Web Debug Toolbar (`/_wdt`)
- Static assets (CSS, images, JS)

### API Firewall
```yaml
api:
    pattern: ^/api
    stateless: false                # Session-based auth
    provider: insys_provider
    context: shared_context         # Share session s main firewall
    entry_point: App\Security\ApiAuthenticationEntryPoint
    custom_authenticator: App\Security\InsysAuthenticator
    remember_me:
        secret: '%kernel.secret%'
        lifetime: 604800            # 1 týden
        path: /
        domain: ~
    logout:
        path: /api/auth/logout
        target: /
```

**Klíčové vlastnosti:**
- **Pattern:** Všechny `/api/*` cesty
- **Stateless: false** - API používá sessions (ne JWT)
- **Shared context** - Session data sdílená s web firewallem
- **Remember me** - 1 týden persistent login
- **Custom entry point** - JSON error responses

### Main Firewall (Web)
```yaml
main:
    pattern: ^/                     # Všechny ostatní cesty
    lazy: true                      # Načte se až když potřeba
    provider: insys_provider
    context: shared_context         # Share session s API firewall
```

**Vlastnosti:**
- **Lazy loading** - Security se aktivuje až při potřebě
- **Shared context** - Stejná session jako API
- **Pattern:** Fallback pro všechny cesty

## 👤 User Provider Configuration

### INSYS Provider
```yaml
# config/packages/security.yaml
providers:
    insys_provider:
        id: App\Security\InsysUserProvider
```

**InsysUserProvider implementace:**
```php
// src/Security/InsysUserProvider.php
class InsysUserProvider implements UserProviderInterface
{
    public function __construct(
        private InsysService $insysService
    ) {}
    
    public function loadUserByIdentifier(string $identifier): UserInterface
    {
        // Load user from INSYS database
        $userData = $this->insysService->getUserByUsername($identifier);
        
        if (!$userData) {
            throw new UserNotFoundException();
        }
        
        return new User(
            $userData['JMENO'] . ' ' . $userData['PRIJMENI'],
            $userData['INT_ADR'],
            ['ROLE_USER']
        );
    }
    
    public function refreshUser(UserInterface $user): UserInterface
    {
        // Refresh user data z databáze
        return $this->loadUserByIdentifier($user->getUserIdentifier());
    }
    
    public function supportsClass(string $class): bool
    {
        return User::class === $class;
    }
}
```

## 🔑 Authentication System

### Custom Authenticator
```php
// src/Security/InsysAuthenticator.php
class InsysAuthenticator extends AbstractLoginFormAuthenticator
{
    public function authenticate(Request $request): Passport
    {
        $username = $request->request->get('username');
        $password = $request->request->get('password');
        
        if (null === $username || null === $password) {
            throw new CustomUserMessageAuthenticationException('Username and password required');
        }
        
        return new Passport(
            new UserBadge($username),
            new PasswordCredentials($password),
            [new RememberMeBadge()]
        );
    }
    
    public function checkCredentials($credentials, UserInterface $user): bool
    {
        // Ověření credentials proti INSYS databázi
        return $this->insysService->validateCredentials(
            $credentials['username'],
            $credentials['password']
        );
    }
    
    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        // Redirect po úspěšném přihlášení
        if ($this->isApiRequest($request)) {
            return new JsonResponse(['status' => 'success']);
        }
        
        return new RedirectResponse($this->urlGenerator->generate('app_dashboard'));
    }
}
```

### API Entry Point
```php  
// src/Security/ApiAuthenticationEntryPoint.php
class ApiAuthenticationEntryPoint implements AuthenticationEntryPointInterface
{
    public function start(Request $request, AuthenticationException $authException = null): Response
    {
        return new JsonResponse([
            'error' => 'Authentication required',
            'message' => 'Please login to access this resource'
        ], 401);
    }
}
```

## 🚪 Access Control Rules

### Public Endpoints
```yaml
# config/packages/security.yaml
access_control:
    # Public API endpoints
    - { path: ^/api/auth/login, roles: PUBLIC_ACCESS }
    - { path: ^/api/auth/status, roles: PUBLIC_ACCESS }
    - { path: ^/api/test/mssql-connection, roles: PUBLIC_ACCESS }
    - { path: ^/api/test/login-test, roles: PUBLIC_ACCESS }
```

**Veřejně přístupné endpointy:**
- `/api/auth/login` - Login endpoint
- `/api/auth/status` - Auth status check
- `/api/test/*` - Development testing endpoints

### Protected Endpoints
```yaml
# Protected API endpoints (requires authentication)
- { path: ^/api, roles: ROLE_USER }
```

**Chráněné endpointy:**
- Všechny `/api/*` kromě výše uvedených public
- Require ROLE_USER (získává se po successful login)

## 🔒 Password Hashing

### Production Hashing
```yaml
# config/packages/security.yaml
password_hashers:
    Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface: 'auto'
```

**Auto hashing:**
- Symfony vybírá nejlepší dostupný algoritmus
- Aktuálně Argon2i nebo bcrypt
- Automatic migration mezi algoritmy

### Test Environment Optimization
```yaml
# config/packages/security.yaml when@test:
password_hashers:
    Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface:
        algorithm: auto
        cost: 4              # Nejnižší možná hodnota pro bcrypt
        time_cost: 3         # Nejnižší možná hodnota pro argon2
        memory_cost: 10      # Nejnižší možná hodnota pro argon2
```

**Test optimalizace:**
- Redukuje computational cost
- Urychluje test suite
- Bezpečnost v testech není kritická

## 🍪 Session Management

### Session Configuration
```yaml
# Symfony defaults (implicit configuration)
# config/packages/framework.yaml
framework:
    session:
        handler_id: null            # Use default PHP session handler
        cookie_secure: auto         # Secure v HTTPS, non-secure v HTTP
        cookie_samesite: lax        # SameSite cookie protection
        cookie_lifetime: 0          # Session cookies (expire on browser close)
        gc_maxlifetime: 1440        # Session file lifetime (24 minutes)
```

### Remember Me Configuration
```yaml
# V API firewall
remember_me:
    secret: '%kernel.secret%'       # Encrypt remember-me tokens
    lifetime: 604800                # 1 týden (7 * 24 * 3600)
    path: /                         # Celá aplikace
    domain: ~                       # Current domain
```

**Remember Me behavior:**
- Vytváří persistent cookie
- Automatické přihlášení po expiraci session
- Secure token-based implementation

## 🌐 CORS Security

### CORS Configuration
```yaml
# config/packages/nelmio_cors.yaml
nelmio_cors:
    defaults:
        allow_credentials: true                    # Allow cookies/auth
        allow_origin: ['%env(CORS_ALLOW_ORIGIN)%']
        allow_headers: ['*']
        allow_methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        expose_headers: ['Link']
        max_age: 3600
    paths:
        '^/api/':
            allow_origin: ['*']                    # API je více permissive
            allow_headers: ['*']
            allow_methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
            max_age: 3600
```

**Security considerations:**
- `allow_credentials: true` - Potřebné pro session auth
- `allow_origin` z environment - Kontrolované origins
- Separate API rules - API může mít jiná pravidla než web

### CORS Environment Configuration
```bash
# .env
CORS_ALLOW_ORIGIN='^https?://(localhost|127\.0\.0\.1|dev\.portalznackare\.cz|portalznackare\.cz)(:[0-9]+)?$'

# .env.prod.local  
CORS_ALLOW_ORIGIN='^https://portalznackare\.cz$'
```

## 🔍 Security Debugging

### Security Debugging Commands
```bash
# Zobraz security configuration
ddev exec bin/console debug:security

# Test specific firewall
ddev exec bin/console debug:router | grep api

# Zkontroluj access control rules
ddev exec bin/console debug:config security access_control

# Test user provider
ddev exec bin/console security:encode-password
```

### Authentication Testing
```bash
# Test login endpoint
curl -X POST https://portalznackare.ddev.site/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' \
  -c cookies.txt

# Test protected endpoint s session
curl https://portalznackare.ddev.site/api/insys/prikazy \
  -b cookies.txt

# Test logout
curl -X POST https://portalznackare.ddev.site/api/auth/logout \
  -b cookies.txt
```

### Security Event Logging
```php
// src/EventListener/SecurityEventListener.php  
class SecurityEventListener
{
    public function onSecurityAuthenticationSuccess(AuthenticationSuccessEvent $event)
    {
        $this->logger->info('User logged in', [
            'username' => $event->getAuthenticationToken()->getUser()->getUserIdentifier(),
            'ip' => $this->requestStack->getCurrentRequest()?->getClientIp(),
            'user_agent' => $this->requestStack->getCurrentRequest()?->headers->get('user-agent')
        ]);
    }
    
    public function onSecurityAuthenticationFailure(AuthenticationFailureEvent $event)
    {
        $this->logger->warning('Login attempt failed', [
            'username' => $event->getAuthenticationToken()->getCredentials()['username'] ?? 'unknown',
            'ip' => $this->requestStack->getCurrentRequest()?->getClientIp(),
            'reason' => $event->getAuthenticationException()->getMessage()
        ]);
    }
}
```

## ⚠️ Security Best Practices

### Production Security Checklist
```bash
# 1. APP_SECRET je unique a secure
grep "APP_SECRET=" .env.prod.local
# Should be 32+ random characters

# 2. HTTPS je enforced
# Apache/Nginx configurace má SSL redirect

# 3. Security headers jsou nastavené
# CSP, X-Frame-Options, X-Content-Type-Options

# 4. Database credentials jsou restricted
# INSYS user má pouze SELECT permissions na potřebné tabulky

# 5. File permissions jsou correct
chown -R www-data:www-data var/
chmod -R 755 var/
chmod -R 644 config/
```

### Common Security Pitfalls
```yaml
# ❌ ŠPATNĚ - Broad access control
access_control:
    - { path: ^/, roles: PUBLIC_ACCESS }  # Všechno public!

# ✅ SPRÁVNĚ - Specific rules
access_control:
    - { path: ^/api/auth/login, roles: PUBLIC_ACCESS }
    - { path: ^/api, roles: ROLE_USER }
    - { path: ^/, roles: PUBLIC_ACCESS }  # Web pages jsou public, auth je optional
```

```php
// ❌ ŠPATNĚ - Plain text password comparison  
public function checkCredentials($credentials, UserInterface $user): bool
{
    return $credentials['password'] === $user->getPassword();
}

// ✅ SPRÁVNĚ - Hash verification
public function checkCredentials($credentials, UserInterface $user): bool
{
    return $this->passwordHasher->verify($user->getPassword(), $credentials['password']);
}
```

### Security Headers
```apache
# .htaccess nebo Apache vhost
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
```

## 🧪 Security Testing

### Unit Tests
```php
// tests/Security/InsysAuthenticatorTest.php
class InsysAuthenticatorTest extends WebTestCase
{
    public function testSuccessfulAuthentication()
    {
        $client = static::createClient();
        
        $client->request('POST', '/api/auth/login', [
            'username' => 'test',
            'password' => 'test'
        ]);
        
        $this->assertResponseIsSuccessful();
        $this->assertJson($client->getResponse()->getContent());
    }
    
    public function testFailedAuthentication()
    {
        $client = static::createClient();
        
        $client->request('POST', '/api/auth/login', [
            'username' => 'test',
            'password' => 'wrong_password'
        ]);
        
        $this->assertResponseStatusCodeSame(401);
    }
}
```

### Integration Tests
```php
// tests/Controller/ApiSecurityTest.php
public function testProtectedEndpointRequiresAuth()
{
    $client = static::createClient();
    
    // Request bez authentication
    $client->request('GET', '/api/insys/prikazy');
    $this->assertResponseStatusCodeSame(401);
    
    // Login
    $client->request('POST', '/api/auth/login', [
        'username' => 'test',
        'password' => 'test'  
    ]);
    
    // Request s authentication
    $client->request('GET', '/api/insys/prikazy');
    $this->assertResponseIsSuccessful();
}
```

---

**Environment konfigurace:** [environment.md](environment.md)  
**Services konfigurace:** [services.md](services.md)  
**Authentication features:** [../features/authentication.md](../features/authentication.md)  
**API dokumentace:** [../api/authentication-api.md](../api/authentication-api.md)  
**Aktualizováno:** 2025-07-22