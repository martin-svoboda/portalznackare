# Konfigurace aplikace

> **Configuration dokumentace** - Environment variables, služby, zabezpečení a HTTP autentifikace

## 🌍 Environment Configuration

### Environment hierarchy
```bash
# Načítací pořadí (poslední má prioritu)
.env                    # Default values (committed)
.env.local             # Local overrides (not committed) 
.env.$APP_ENV          # Environment-specific (committed)
.env.$APP_ENV.local    # Environment-specific local (not committed)
```

### Základní proměnné
```bash
# Aplikace
APP_ENV=dev|prod
APP_SECRET=your-secret-key

# Databáze - PostgreSQL (aplikační data)
DATABASE_URL="postgresql://user:pass@localhost:5432/portal_znackare"

# INSYS integrace - MSSQL (KČT data)
USE_TEST_DATA=true               # Dev: true, Prod: false
INSYS_DB_HOST=mssql.server.com
INSYS_DB_NAME=INSYS_DB
INSYS_DB_USER=portal_user
INSYS_DB_PASS=secure_password

# Debug systém
DEBUG_PHP=false                  # Backend debugging
DEBUG_LOG=false                  # Backend logging
DEBUG_APPS=false                 # Frontend console logging

# HTTP Basic Auth (volitelné)
HTTP_AUTH_USER=developer         # Pokud nastaveno, vyžaduje autorizaci
HTTP_AUTH_PASS=secure_pass
```

## 🔒 Security Configuration

### Session Management
```yaml
# config/packages/framework.yaml
framework:
    session:
        handler_id: session.handler.native_file
        cookie_secure: auto
        cookie_httponly: true
        cookie_samesite: lax
```

### CSRF Protection
```yaml
# config/packages/framework.yaml
framework:
    csrf_protection: true
```

### HTTP Basic Auth
Volitelná HTTP Basic autentifikace aktivovaná environment proměnnými:

```php
// src/EventListener/HttpBasicAuthListener.php
public function onKernelRequest(RequestEvent $event): void {
    $authUser = $_ENV['HTTP_AUTH_USER'] ?? null;
    $authPass = $_ENV['HTTP_AUTH_PASS'] ?? null;
    
    // Pokud nejsou definované, neověřovat
    if (empty($authUser) || empty($authPass)) {
        return;
    }
    
    // Ověření HTTP Basic Auth
}
```

### Symfony Security
```yaml
# config/packages/security.yaml
security:
    providers:
        insys_provider:
            id: App\Security\InsysUserProvider
    
    firewalls:
        api:
            pattern: ^/api
            stateless: false
            provider: insys_provider
            custom_authenticator: App\Security\InsysAuthenticator
        main:
            pattern: ^/
            provider: insys_provider
            context: shared_context
    
    access_control:
        - { path: ^/api/auth/login, roles: PUBLIC_ACCESS }
        - { path: ^/api/test/, roles: PUBLIC_ACCESS }
        - { path: ^/api, roles: ROLE_USER }
```

## 🛠️ Services Configuration

### Core Services
```yaml
# config/services.yaml
services:
    # INSYS Integration
    App\Service\InsysService:
        arguments:
            $useTestData: '%env(bool:USE_TEST_DATA)%'
    
    # Visual Components
    App\Service\ZnackaService: ~
    App\Service\TimService: ~
    App\Service\DataEnricherService: ~
    
    # File Management
    App\Service\FileUploadService:
        arguments:
            $uploadDirectory: '%kernel.project_dir%/public/uploads'
```

### INSYS Service
```php
// src/Service/InsysService.php
class InsysService {
    public function __construct(
        private bool $useTestData,
        private MockMSSQLService $mockService,
        private string $insysDbHost,
        private string $insysDbName,
        private string $insysDbUser,
        private string $insysDbPass
    ) {}
    
    public function getConnection(): \PDO {
        if ($this->useTestData) {
            throw new \Exception('Mock mode - no real connection');
        }
        
        $dsn = "sqlsrv:Server={$this->insysDbHost};Database={$this->insysDbName}";
        return new \PDO($dsn, $this->insysDbUser, $this->insysDbPass);
    }
}
```

### Visual Services
Služby pro generování značek a TIM náhledů:

```php
// ZnackaService - generování SVG značek podle KČT standardů
// TimService - generování HTML náhledů TIM dat
// DataEnricherService - obohacování API dat o HTML značky
```

### File Services
```php
// FileUploadService - upload s hash deduplikací
// FileAttachment Entity - tracking souborů a usage
```

## 🏗️ Service Patterns

### Dependency Injection
```php
class SomeController extends AbstractController {
    public function __construct(
        private InsysService $insysService,
        private ZnackaService $znackaService,
        private DataEnricherService $enricher
    ) {}
}
```

### Environment-based Services
```yaml
# Conditional service registration
services:
    App\Controller\Api\TestController:
        condition: '%kernel.debug%'  # Only in debug mode
```

### Service Decoration
```php
// Decorator pattern pro data enrichment
class EnrichedInsysService {
    public function __construct(
        private InsysService $insysService,
        private DataEnricherService $enricher
    ) {}
}
```

## 🔧 Development vs Production

### Local Development (DDEV)
```bash
# .env.local (auto-generated by DDEV)
APP_ENV=dev
DATABASE_URL="postgresql://db:db@db:5432/db"
USE_TEST_DATA=true
DEBUG_PHP=true
DEBUG_LOG=true
DEBUG_APPS=true
```

### Production
```bash
# .env.local.prod
APP_ENV=prod
APP_SECRET=secure-production-secret
USE_TEST_DATA=false
DEBUG_PHP=false
DEBUG_LOG=false
DEBUG_APPS=false

# Real INSYS credentials
INSYS_DB_HOST=production.mssql.server
INSYS_DB_USER=limited_portal_user
INSYS_DB_PASS=complex_secure_password
```

## 📊 Monitoring a Logging

### Error Logging
```yaml
# config/packages/monolog.yaml
monolog:
    channels: ['insys', 'portal', 'visual']
    handlers:
        main:
            type: stream
            path: '%kernel.logs_dir%/%kernel.environment%.log'
```

### Performance Monitoring
- Symfony Profiler (dev only)
- Custom logging pro INSYS volání
- File upload monitoring

---

**Related Documentation:**  
**Architecture:** [architecture.md](architecture.md)  
**Development:** [development/getting-started.md](development/getting-started.md)  
**Aktualizováno:** 2025-07-31