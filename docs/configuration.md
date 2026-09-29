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

# INSYZ integrace - MSSQL (KČT data)
USE_TEST_DATA=true               # Dev: true, Prod: false
INSYZ_DB_HOST=mssql.server.com
INSYZ_DB_NAME=INSYZ_DB
INSYZ_DB_USER=portal_user
INSYZ_DB_PASS=secure_password

# Debug systém
DEBUG_PHP=false                  # Backend debugging
DEBUG_LOG=false                  # Backend logging
DEBUG_APPS=false                 # Frontend console logging

# HTTP Basic Auth (volitelné)
HTTP_AUTH_USER=developer         # Pokud nastaveno, vyžaduje autorizaci
HTTP_AUTH_PASS=secure_pass

# Tajné hodnoty – v .env je jen placeholder/prázdno, skutečné hodnoty v .env.local na serveru
INSYZ_REPORT_HASH_SECRET=...     # Podpis URL náhledu hlášení, identický s INSYZ
CI_HEALTHCHECK_TOKEN=...         # Token pro /api/test/* z CI (= GitHub secret HEALTHCHECK_TOKEN); prázdný = jen admin

# Desktopový klient INSYZ (POST /api/insyz-client/db-password) – viz docs/api.md (Desktopový klient INSYZ)
INSYZ_CLIENT_REQUIRE_HTTPS=true  # false jen v lokálním vývoji; jinak požadavek po HTTP → 401
INSYZ_PWD_DB6273_2=              # Hesla vydávaných DB účtů (config/services.yaml, insyz_client.accounts)
INSYZ_PWD_DB6266_2=
INSYZ_PWD_DB6285_2=

# CORS (config/packages/nelmio_cors.yaml) – regex povolených originů
CORS_ALLOW_ORIGIN='^https?://(localhost|127\.0\.0\.1|dev\.portalznackare\.cz|portalznackare\.cz)(:[0-9]+)?$'

# Messenger – proměnná je v .env, ale config/packages/messenger.yaml ji NEPOUŽÍVÁ
# (transporty async/failed mají DSN natvrdo doctrine://default)
MESSENGER_TRANSPORT_DSN=doctrine://default?auto_setup=0
```

## 🔒 Security Configuration

### Session Management
```yaml
# config/packages/framework.yaml
framework:
    session:
        handler_id: null          # výchozí PHP session handler
        cookie_secure: auto
        cookie_samesite: lax
        gc_maxlifetime: 28800     # 8 hodin (pracovní den)
        cookie_lifetime: 28800
```

### CSRF Protection
Klíč `csrf_protection` v `framework.yaml` nastaven není (platí výchozí hodnota Symfony). Interní API chrání
`ApiCsrfListener` – viz následující sekce.

### Interní API – jen ze stránek portálu (`ApiCsrfListener`)
Každý požadavek na `/api/*` a `/admin/api/*` musí nést hlavičku `X-CSRF-Token` s tokenem vázaným na session,
jinak `403` (`error_code: CSRF_INVALID`, hlavička `X-CSRF-Invalid: 1`).

- Token vkládá `templates/components/api-token.html.twig` (meta `csrf-token`) do `<head>` layoutů `base` i `admin`.
  Tamtéž je **globální obal `fetch`**, který hlavičku přidá automaticky ke každému volání interního API –
  appky, `api.js` ani inline skripty nic řešit nemusí. Nový layout musí šablonu také vložit.
- Po vypršení session obal zavolá `GET /api/auth/csrf-token`, získá nový token a požadavek jednou zopakuje.
- **Výjimky** (seznam `VYJIMKY` v `src/EventListener/ApiCsrfListener.php`): `/api/insyz-client/` (desktopový klient,
  vlastní ověření), `/api/test/` (CI token), `/api/auth/logout` (odkaz), `/api/auth/csrf-token`.
- Chrání před voláním z cizích webů. Přihlášený uživatel si token vidí, proto oprávnění musí dál kontrolovat
  každý endpoint sám.

### CORS
Jen `config/packages/nelmio_cors.yaml` – whitelist `CORS_ALLOW_ORIGIN`, bez credentials. Cizí origin nedostane
`Access-Control-Allow-Origin`, API je tak čitelné jen ze stejné domény.

### Symfony Profiler (jen `APP_ENV=dev`)
Profiler (`/_profiler`, `/_wdt`) ukládá požadavky **všech** uživatelů včetně cookies, těl POST a konfigurace.
Proto je přístupný jen přihlášenému `ROLE_SUPER_ADMIN` (`access_control` v `security.yaml`; firewall `dev`
ho záměrně nevyjímá). Nepřihlášený je přesměrován na přihlášení, debug toolbar se mu nenačte.

### HTTP Basic Auth
Volitelná HTTP Basic autentifikace aktivovaná environment proměnnými (platí bez výjimek, i pro `/_profiler`):

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
        insyz_provider:
            id: App\Security\InsyzUserProvider
    
    firewalls:
        api:
            pattern: ^/api
            stateless: false
            provider: insyz_provider
            custom_authenticator: App\Security\InsyzAuthenticator
        main:
            pattern: ^/
            provider: insyz_provider
            context: shared_context
    
    access_control:
        - { path: ^/api/auth/login, roles: PUBLIC_ACCESS }
        - { path: ^/api/test/, roles: PUBLIC_ACCESS }   # ověření admin/CI token v TestControlleru
        - { path: ^/api, roles: ROLE_USER }
```

## 🛠️ Services Configuration

### Core Services
```yaml
# config/services.yaml
services:
    # INSYZ Integration
    App\Service\InsyzService:
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

### INSYZ Service
`src/Service/InsyzService.php` – autowiring (`MssqlConnector`, `ApiCacheService`, `InsyzAuditLogger`…).
Režim čte za běhu z `$_ENV['USE_TEST_DATA']` (`'true'` = mock data z `var/mock-data/api/insyz/`,
jinak MSSQL přes `MssqlConnector` s `INSYZ_DB_*`). Detail: [features/insyz-integration.md](features/insyz-integration.md).

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
        private InsyzService $insyzService,
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
class EnrichedInsyzService {
    public function __construct(
        private InsyzService $insyzService,
        private DataEnricherService $enricher
    ) {}
}
```

## 🚀 Cache Configuration

### Redis Cache Pools (Production)
**Optimalizace pro 50 concurrent users** s inteligentním cachováním INSYZ dat.

```yaml
# config/packages/cache.yaml
framework:
    cache:
        prefix_seed: portalznackare_api
        app: cache.adapter.filesystem  # Default fallback
        
        pools:
            # API cache pro INSYZ data  
            app.api_cache:
                adapter: cache.adapter.redis
                provider: 'redis://localhost:6379/0'
                default_lifetime: 600  # 10 minut
                
            # Long-term cache pro user data
            app.long_cache:
                adapter: cache.adapter.redis  
                provider: 'redis://localhost:6379/1'
                default_lifetime: 1800  # 30 minut
```

### Environment-Specific Cache Adapters
```yaml
# config/packages/dev/cache.yaml (Development)
framework:
    cache:
        pools:
            app.api_cache:
                adapter: cache.adapter.filesystem
                default_lifetime: 300  # 5 minut pro rychlé testování
            app.long_cache:
                adapter: cache.adapter.filesystem
                default_lifetime: 900   # 15 minut
                
# config/packages/test/cache.yaml (Testing)
framework:
    cache:
        pools:
            app.api_cache:
                adapter: cache.adapter.array  # In-memory
            app.long_cache:
                adapter: cache.adapter.array
```

### Cache Service Configuration
```yaml
# config/services.yaml
services:
    App\Service\ApiCacheService:
        arguments:
            $apiCache: '@app.api_cache'
            $logger: '@monolog.logger.api'
```

## 📊 Monitoring & Logging Configuration

### Monolog API Logging
**Separátní API logs** pro performance monitoring a debugging.

```yaml
# config/packages/monolog.yaml
monolog:
    channels:
        - deprecation
        - api         # API monitoring channel
        
# Development - separátní soubory pro snadnější debug
when@dev:
    monolog:
        handlers:
            main:
                channels: ["!event", "!api"]  # Exclude API logs
            api:
                type: stream
                path: "%kernel.logs_dir%/api.log"
                level: info
                channels: [api]

# Production - JSON format pro external parsing                
when@prod:
    monolog:
        handlers:
            api:
                type: stream
                path: php://stderr
                level: info
                channels: [api]
                formatter: monolog.formatter.json
```

### API Monitoring Service Setup
```yaml
# config/services.yaml
services:
    App\Service\ApiMonitoringService:
        arguments:
            $logger: '@monolog.logger.api'
            $auditLogger: '@App\Service\AuditLogger'
```

### Performance Environment Variables
```bash
# Additional ENV vars for monitoring
CACHE_DEFAULT_TTL=600                    # Default cache TTL
API_MONITORING_ENABLED=true              # Enable performance monitoring
API_SLOW_QUERY_THRESHOLD=5000           # >5s queries logged as slow
API_RESPONSE_TIME_WARNING=2000          # >2s responses logged as warning
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

# Cache & Monitoring (development)
CACHE_DEFAULT_TTL=300
API_MONITORING_ENABLED=true
API_SLOW_QUERY_THRESHOLD=3000
API_RESPONSE_TIME_WARNING=1000
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

# Cache & Monitoring (production)
CACHE_DEFAULT_TTL=600
API_MONITORING_ENABLED=true
API_SLOW_QUERY_THRESHOLD=5000
API_RESPONSE_TIME_WARNING=2000

# Redis configuration (production only)
REDIS_URL=redis://localhost:6379

# Real INSYZ credentials
INSYZ_DB_HOST=production.mssql.server
INSYZ_DB_USER=limited_portal_user
INSYZ_DB_PASS=complex_secure_password
```

## 📊 Monitoring a Logging

### Error Logging
```yaml
# config/packages/monolog.yaml
monolog:
    channels: ['insyz', 'portal', 'visual']
    handlers:
        main:
            type: stream
            path: '%kernel.logs_dir%/%kernel.environment%.log'
```

### Performance Monitoring
- Symfony Profiler (dev only)
- Custom logging pro INSYZ volání
- File upload monitoring

---

**Related Documentation:**  
**Architecture:** [architecture.md](architecture.md) - Performance a cache architektury  
**Development:** [development/getting-started.md](development/getting-started.md)  
**Monitoring:** [development/development.md](development/development.md) - Performance debugging tools  
**INSYZ Integration:** [features/insyz-integration.md](features/insyz-integration.md) - Cache configuration  
**Aktualizováno:** 2025-08-08