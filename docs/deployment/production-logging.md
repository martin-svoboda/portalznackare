# Production Logging Configuration

## 🎯 Production Ready Logging

Aplikace používá environment-aware logging systém, který automaticky přizpůsobí detailnost logování podle prostředí.

## 📋 Environment Variables

| Proměnná | Development | Staging | Production | Popis |
|----------|-------------|---------|------------|-------|
| `DEBUG_PHP` | `true` | `false` | `false` | Detailní PHP debug logy |
| `DEBUG_LOG` | `true` | `true` | `false` | Info/warning logy |  
| `DEBUG_APPS` | `true` | `false` | `false` | Frontend console logy |

## 🔧 PHP Backend Logging

### Logger Utility (`src/Utils/Logger.php`)

```php
use App\Utils\Logger;

// Vždy se loguje - production ready
Logger::error('Critical error occurred');
Logger::exception('Database error', $exception);

// Loguje pouze při DEBUG_LOG=true
Logger::info('User logged in successfully');

// Loguje pouze při DEBUG_PHP=true  
Logger::debug('Detailed debug information');
```

### Výhody

- ✅ **Zero performance impact** v produkci
- ✅ **Automatic environment detection** 
- ✅ **Critical errors always logged**
- ✅ **Stack traces only in debug mode**

## 🌐 Frontend JavaScript Logging

### Debug Utility (`assets/js/utils/debug.js`)

```javascript
import { log } from '../../utils/debug';

// Vždy se loguje - production ready
log.error('API request failed', error);

// Loguje pouze při DEBUG_APPS=true (via data-debug attribute)
log.info('User action completed', data);
log.api('POST', '/api/endpoint', requestData);
```

### Component Logger

```javascript
import { createDebugLogger } from '../../utils/debug';
const logger = createDebugLogger('ComponentName');

logger.error('Component error'); // Always logged
logger.lifecycle('Component mounted'); // Debug only
logger.performance('Operation took', 150); // Debug only  
```

## 📊 Log Levels

### Always Logged (Production Safe)
- `Logger::error()` - Critical PHP errors
- `Logger::exception()` - Exception details
- `log.error()` - Frontend errors

### Development/Staging Only
- `Logger::info()` - Info messages
- `Logger::debug()` - Detailed debug info  
- `log.info()` - Frontend info
- `log.api()` - API call details

## 🚀 Production Deployment

### 1. Environment Setup
```bash
# Zkopírujte .env.local.example do .env.local a nastavte:
DEBUG_PHP=false
DEBUG_LOG=false  
DEBUG_APPS=false
APP_ENV=prod
USE_TEST_DATA=false
```

### 2. Build Process
```bash
# Frontend build automatically disables debug logs
npm run build

# Clear PHP cache
php bin/console cache:clear --env=prod
```

### 3. Verification
```bash
# Test logging works correctly
grep "Logger::" /path/to/logs/prod.log
```

## 🔍 Monitoring

### Production Log Monitoring
```bash
# Monitor critical errors only
tail -f /var/log/app/prod.log | grep "ERROR"

# Monitor INSYZ integration
tail -f /var/log/app/prod.log | grep "INSYZ"
```

### Log Rotation
```logrotate
/var/log/app/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 www-data www-data
}
```

## 🔒 Security Notes

- ❌ **Never log sensitive data** (passwords, API keys)
- ✅ **Log sanitized data only** in production
- ✅ **Stack traces disabled** in production
- ✅ **Structured logging** for better parsing

## 🐛 Debugging Issues

### Enable Debug Mode Temporarily
```bash
# Enable for specific investigation
DEBUG_LOG=true php bin/console messenger:consume async

# Re-deploy with DEBUG_LOG=false after investigation
```

### Frontend Debug Mode
```html
<!-- Add to specific page for debugging -->
<div data-debug="true" style="display:none;"></div>
```

## 📈 Performance Impact

| Mode | PHP Overhead | JS Overhead | Log Volume |
|------|--------------|-------------|------------|
| Production | 0% | 0% | Minimal |
| Staging | <1% | <1% | Medium |  
| Development | <5% | <5% | High |

---

**Výsledek:** Zero-overhead logging v produkci s možností rychlého zapnutí debuggingu při potřebě.