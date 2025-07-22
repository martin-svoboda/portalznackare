# Environment Configuration

> **Configuration dokumentace** - Environment variables, DDEV setup a production konfigurace

## 🌍 Přehled environment

**Local Development:** DDEV + PostgreSQL + Mock INSYS data  
**Production:** LAMP stack + PostgreSQL + Real MSSQL INSYS  
**Config management:** Symfony .env files s environment-specific overrides

### Environment hierarchy
```bash
# Načítací pořadí (poslední má prioritu)
.env                    # Default values (committed)
.env.local             # Local overrides (not committed) 
.env.$APP_ENV          # Environment-specific (committed)
.env.$APP_ENV.local    # Environment-specific local (not committed)

# Real environment variables (highest priority)
export APP_ENV=prod
```

## 📝 Environment Variables

### Symfony Framework
```bash
###> symfony/framework-bundle ###
APP_ENV=dev                           # dev|prod|test
APP_SECRET=CHANGE_ME_IN_PRODUCTION    # Random secret key
###< symfony/framework-bundle ###
```

**APP_ENV použití:**
- `dev` - Development s debug toolbar, profiler, hot reload
- `prod` - Production optimized, cached, no debug info  
- `test` - PHPUnit testing environment

**APP_SECRET požadavky:**
- Minimum 32 znaků
- Náhodné znaky pro cryptographic operations
- MUSÍ být unique per environment
- Nikdy necháchat default hodnotu v produkci

### Database Configuration
```bash
###> doctrine/doctrine-bundle ###
# PostgreSQL pro DDEV local development
DATABASE_URL="postgresql://db:db@db:5432/db?serverVersion=16&charset=utf8"

# Production MySQL/MariaDB alternative
# DATABASE_URL="mysql://user:pass@host:3306/dbname?serverVersion=8.0.32&charset=utf8mb4"

# SQLite pro quick testing  
# DATABASE_URL="sqlite:///%kernel.project_dir%/var/data_%kernel.environment%.db"
###< doctrine/doctrine-bundle ###
```

**Database URL formát:**
```bash
# PostgreSQL (recommended)
postgresql://user:password@host:port/database?serverVersion=16&charset=utf8

# MySQL/MariaDB
mysql://user:password@host:port/database?serverVersion=8.0.32&charset=utf8mb4

# SQLite
sqlite:///%kernel.project_dir%/var/data.db
```

### INSYS Integration
```bash
###> INSYS Configuration ###
# Toggle mezi mock data a real MSSQL
USE_TEST_DATA=true                    # true=mock, false=real MSSQL

# MSSQL connection pro real INSYS (když USE_TEST_DATA=false)
INSYS_DB_HOST=mssql.server.cz
INSYS_DB_NAME=insys_production
INSYS_DB_USER=portal_user
INSYS_DB_PASS=secure_password
###< INSYS Configuration ###
```

**USE_TEST_DATA behavior:**
- `true` - Používá mock data z `WP-src/Functions/testdata.json`
- `false` - Připojuje se k real MSSQL INSYS databázi
- Development: vždy `true` (DDEV nemá MSSQL)
- Production: `false` pro real data

### CORS Configuration
```bash
###> nelmio/cors-bundle ###
# Regex pattern pro allowed origins
CORS_ALLOW_ORIGIN='^https?://(localhost|127\.0\.0\.1|dev\.portalznackare\.cz|portalznackare\.cz)(:[0-9]+)?$'
###< nelmio/cors-bundle ###
```

**CORS pattern vysvětlení:**
- `localhost` a `127.0.0.1` - Local development
- `dev.portalznackare.cz` - Staging environment  
- `portalznackare.cz` - Production domain
- `(:[0-9]+)?` - Optional port pro dev servery

## 🐳 DDEV Configuration

### DDEV Setup
```bash
# .ddev/config.yaml (automaticky generovaný)
name: portalznackare
type: php
docroot: public
php_version: "8.3"
webserver_type: apache-fpm
router_http_port: "80"
router_https_port: "443"
xdebug_enabled: false
additional_hostnames: []
additional_fqdns: []
database:
  type: postgres
  version: "16"
nodejs_version: "20"
```

### DDEV Services
```bash
# Spuštěné DDEV kontejnery
ddev-portalznackare-web      # Apache + PHP 8.3
ddev-portalznackare-db       # PostgreSQL 16
ddev-portalznackare-router   # Nginx reverse proxy
```

### DDEV Environment Variables
```bash
# Automaticky nastavené v DDEV
DDEV_PROJECT=portalznackare
DDEV_WEBSERVER_TYPE=apache-fpm
DDEV_DATABASE=db:5432
DDEV_HOSTNAME=portalznackare.ddev.site
DDEV_PRIMARY_URL=https://portalznackare.ddev.site
```

## 🏭 Production Configuration

### Environment-specific Files
```bash
# .env.prod (committed, production defaults)
APP_ENV=prod
APP_DEBUG=0
DATABASE_URL="postgresql://prod_user:secure_pass@db.server:5432/portal_prod?serverVersion=16"
USE_TEST_DATA=false
INSYS_DB_HOST=insys.server.cz
INSYS_DB_NAME=insys_production

# .env.prod.local (not committed, server-specific)
APP_SECRET=super_secure_random_32char_secret_key_here
INSYS_DB_USER=production_user
INSYS_DB_PASS=production_password
CORS_ALLOW_ORIGIN='^https?://portalznackare\.cz$'
```

### Production Optimizations
```bash
# Symfony optimalizace v production
APP_ENV=prod
APP_DEBUG=0

# Doctrine optimalizace
# config/packages/doctrine.yaml when@prod:
# - auto_generate_proxy_classes: false
# - query_cache_driver + result_cache_driver enabled
# - proxy_dir v build directory

# Cache warming
bin/console cache:warmup --env=prod
```

### Security considerations
```bash
# Nikdy v .env (committed files):
APP_SECRET=real_secret        # ❌ Use .env.local
INSYS_DB_PASS=real_password   # ❌ Use .env.local  

# Safe v .env (committed files):
APP_ENV=prod                  # ✅ Environment identifier
DATABASE_URL=postgres://user:pass@localhost/db  # ✅ With placeholder values
USE_TEST_DATA=false           # ✅ Boolean flags
CORS_ALLOW_ORIGIN='^https://example\.com$'      # ✅ Public config
```

## ⚙️ Service-specific Configuration

### File Upload Configuration
```bash
# Nikde explicitně nedefinováno, používá defaults
# Symfony default upload limits:
# - post_max_size: 8M (PHP ini)
# - upload_max_filesize: 2M (PHP ini)
# - max_execution_time: 30s (PHP ini)

# Pro produkci doporučené hodnoty:
# post_max_size=50M
# upload_max_filesize=20M  
# max_execution_time=120
```

### Session Configuration  
```bash
# Symfony session (používá defaults)
# - storage: filesystem v var/sessions/
# - lifetime: 1440s (24 min)
# - name: PHPSESSID
# - cookie_secure: auto (true v HTTPS)
# - cookie_samesite: lax
```

### Logging Configuration
```bash
# Monolog konfigurace per environment
# config/packages/monolog.yaml

# Development:
# - console output + file rotation
# - všechny úrovně logged

# Production:  
# - file rotation only
# - error level a výše
# - email alerting pro critical errors
```

## 🔧 Development Workflow

### Local Development Setup
```bash
# 1. DDEV start
ddev start

# 2. Composer install
ddev composer install

# 3. Database migration
ddev exec bin/console doctrine:migrations:migrate

# 4. Frontend build
ddev npm install
ddev npm run watch      # Development watching
# or
ddev npm run build      # Production build

# 5. Clear cache pokud potřeba
ddev exec bin/console cache:clear
```

### Environment Variable Testing
```bash
# Test current environment
ddev exec bin/console debug:container --env-vars

# Test specific service
ddev exec bin/console debug:config doctrine

# Test database connection
ddev exec bin/console dbal:run-sql "SELECT 1"

# Test INSYS mock connection
curl https://portalznackare.ddev.site/api/test/mssql-connection
```

### Environment Debugging
```bash
# Zobraz všechny environment variables
ddev exec printenv | grep -E "(APP_|DATABASE_|INSYS_|CORS_)"

# Symfony debug commands
ddev exec bin/console debug:router
ddev exec bin/console debug:autowiring
ddev exec bin/console debug:config framework
```

## 📊 Configuration Validation

### Required Environment Variables
```php
// Symfony automaticky validuje required env vars
// při prvním access. Pro custom validation:

// config/services.yaml parameters:
parameters:
    env(USE_TEST_DATA): ''          # Required
    env(INSYS_DB_HOST): ''          # Required když USE_TEST_DATA=false
    env(DATABASE_URL): ''           # Required vždy
    env(APP_SECRET): ''             # Required vždy
```

### Runtime Checks
```php
// src/Service/ConfigValidationService.php
public function validateConfiguration(): array
{
    $errors = [];
    
    if ($_ENV['APP_ENV'] === 'prod' && $_ENV['APP_SECRET'] === 'CHANGE_ME_IN_PRODUCTION') {
        $errors[] = 'APP_SECRET must be changed in production';
    }
    
    if ($_ENV['USE_TEST_DATA'] === 'false' && empty($_ENV['INSYS_DB_HOST'])) {
        $errors[] = 'INSYS_DB_HOST required when USE_TEST_DATA=false';
    }
    
    return $errors;
}
```

### Health Check Endpoint
```php
// GET /api/test/configuration
public function configurationCheck(): JsonResponse
{
    return new JsonResponse([
        'environment' => $_ENV['APP_ENV'],
        'database_connected' => $this->testDatabaseConnection(),
        'insys_mode' => $_ENV['USE_TEST_DATA'] === 'true' ? 'mock' : 'real',
        'insys_connected' => $this->testInsysConnection(),
        'cache_working' => $this->testCacheConnection(),
    ]);
}
```

## 🚀 Deployment Configuration

### CI/CD Environment Variables
```bash
# GitHub Actions secrets (never in code)
DATABASE_URL=postgresql://...
APP_SECRET=production_secret
INSYS_DB_HOST=production.host
INSYS_DB_USER=prod_user  
INSYS_DB_PASS=prod_password

# Deploy script env setup
export APP_ENV=prod
export DATABASE_URL=$DATABASE_URL
composer install --no-dev --optimize-autoloader
bin/console cache:clear --env=prod
bin/console cache:warmup --env=prod
```

### Server Environment Setup
```bash
# Apache/Nginx environment variables
# /etc/apache2/sites-available/portalznackare.conf
SetEnv APP_ENV prod
SetEnv DATABASE_URL "postgresql://..."
SetEnv USE_TEST_DATA false

# Systemd service environment
# /etc/systemd/system/portalznackare.service
Environment=APP_ENV=prod
Environment=DATABASE_URL=postgresql://...
Environment=USE_TEST_DATA=false
```

### Configuration File Management
```bash
# Production deployment workflow
rsync .env.prod server:/var/www/portalznackare/.env
# Server má .env.local s secrets
# Result: .env + .env.local = complete config

# Backup current .env před deployment
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Validate config po deployment
curl https://portalznackare.cz/api/test/configuration
```

---

**Security konfigurace:** [security.md](security.md)  
**Services konfigurace:** [services.md](services.md)  
**Production deployment:** [../deployment/overview.md](../deployment/overview.md)  
**INSYS integration:** [../features/insys-integration.md](../features/insys-integration.md)  
**Aktualizováno:** 2025-07-22