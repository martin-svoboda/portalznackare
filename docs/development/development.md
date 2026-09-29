# Development Guide

> **Vývojové nástroje a debug systém** pro efektivní vývoj a ladění aplikace Portál značkaře

## Debug Systém

### Konfigurace

Debug systém používá environment proměnné pro aktivaci různých úrovní logování.

**Environment proměnné:**
- `DEBUG_PHP=true/false` - Backend debugging
- `DEBUG_LOG=true/false` - Backend detailed logging  
- `DEBUG_APPS=true/false` - Frontend console logging

**Detailní konfigurace:** [../configuration.md](../configuration.md)

### Aktivace v aplikaci

Debug stav se předává z backendu do frontendu přes Twig template:

```twig
{# V base template nebo konkrétní stránce #}
<div id="app-root" data-debug="{{ app.debug ? 'true' : 'false' }}"></div>
```

## Frontend Debug Logger

### Základní použití

```javascript
import { log } from '../../utils/debug';

const MyComponent = () => {
    log.info('Component mounted');
    
    return <div>Content</div>;
};
```

### Dostupné metody

#### 1. Info (debug mode only)
```javascript
log.info('Component mounted', { props });
log.info('Data loaded', data);
log.info('Save started', formData);
```

#### 2. API Volání (debug mode only)
```javascript
log.api('POST', '/api/endpoint', requestData);
log.api('GET', '/api/data'); // bez data
```

#### 3. Varování (debug mode only)
```javascript
log.warn('Deprecated function used', { functionName: 'oldFunction' });
log.warn('Performance issue detected');
```

#### 4. Chyby (vždy loguje)
```javascript
try {
    // risky operation
} catch (error) {
    log.error('Operation failed', error);
}
```

## Výstup v konzoli

### Formát zpráv
```
[14:32:15] ℹ️ Component mounted
[14:32:16] 🔄 GET /api/data
[14:32:17] ⚠️ Performance issue detected
[14:32:18] ❌ Operation failed
```

## Best Practices

### 1. Systematické logování
```javascript
import { log } from '../../utils/debug';

const MyComponent = ({ data }) => {
    useEffect(() => {
        log.info('Component mounted', { dataLength: data.length });
    }, []);
    
    return <div>...</div>;
};
```

### 2. API volání
```javascript
const fetchData = async () => {
    log.api('GET', '/api/data');
    
    try {
        const response = await fetch('/api/data');
        const result = await response.json();
        return result;
    } catch (error) {
        log.error('API call failed', error);
        throw error;
    }
};
```

### 3. Form handling
```javascript
const handleSubmit = (formData) => {
    log.info('Form submission started', formData);
    
    try {
        const validation = validateForm(formData);
        if (validation.isValid) {
            submitForm(formData);
        }
    } catch (error) {
        log.error('Form validation failed', error);
    }
};
```

## Debug v různých prostředích

### Development
- Všechny logy aktivní
- Podrobné informace
- Performance monitoring

### Staging  
- Pouze chyby a kritické události
- Omezené API logy

### Production
- Pouze chyby
- Minimální performance impact

## Test API Endpointy

**Base URL:** `/api/test/`  
**Účel:** Diagnostika a CI health check  
**Přístup:** přihlášený `ROLE_ADMIN`/`ROLE_SUPER_ADMIN`, nebo hlavička `X-Healthcheck-Token` = `CI_HEALTHCHECK_TOKEN`; jinak `403`

### GET `/api/test/insyz-user`
Vrací `InsyzService::getUser(5620)` – datasety `trasy.ZNACKAR_DETAIL` pro pevně daný INT_ADR 5620
(v režimu `USE_TEST_DATA` z `var/mock-data/api/insyz/user/5620.json`).

### GET `/api/test/insyz-prikazy`
Vrací `InsyzService::getPrikazy(5620, 2026)` – pevně daný INT_ADR a rok.

### GET `/api/test/mssql-connection`
Test MSSQL připojení a konfigurace.

**Response (test mode):**
```json
{
    "status": "test_mode",
    "message": "Using test data, MSSQL not tested"  
}
```

Mimo test mode zkusí PDO připojení `sqlsrv` s `INSYZ_DB_*` a `SELECT 1`; vrací `status: success` nebo `500`
(heslo v odpovědi maskované).

### POST `/api/test/login-test`
Test `InsyzService::loginUser()` s debug informacemi (bez vytvoření session).

**Request:**
```json
{
    "email": "test@test.com",
    "hash": "test123"
}
```
(`hash` nebo `password`). **Response:** `{"status": "debug", "config": {...}, "login_result": {"success": true, "int_adr": 5620}}`,
při chybě `500` se `status: error`.

## Nástroje a rozšíření

### Browser Developer Tools
1. **Console filtering**: Použij `%c[ComponentName]` pro filtrování
2. **Network tab**: Pro sledování API volání
3. **Performance tab**: Pro sledování výkonu

### Doporučená rozšíření
- React Developer Tools
- Redux DevTools (pokud používáme)
- Network Monitor

## Troubleshooting

### Debug se nezobrazuje
1. Zkontroluj ENV proměnnou `DEBUG_APPS=true` pomocí `printenv | grep DEBUG`
2. Ověř `data-debug="true"` v DOM elementu aplikace
3. Zkontroluj console filtry v Developer Tools
4. Debug proměnné jsou v `.env` souboru

### Příliš mnoho logů
1. Použij browser console filtry
2. Nastav specifické komponenty
3. Dočasně vypni některé typy logů

### Performance impact
1. Debug kód se spouští pouze v debug módu
2. Produkční build má minimal impact
3. Použij lazy evaluation pro expensive operations

## Příklady implementace

### Kompletní komponenta s debuggingem
```javascript
import React, { useState, useEffect, useCallback } from 'react';
import { log } from '../../utils/debug';

const MyComponent = ({ initialData }) => {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        log.info('Component mounted', { 
            hasInitialData: !!initialData,
            dataLength: initialData?.length || 0 
        });
    }, []);
    
    const handleLoadData = useCallback(async () => {
        log.info('Data loading started');
        setLoading(true);
        
        try {
            log.api('GET', '/api/data');
            const response = await fetch('/api/data');
            const result = await response.json();
            
            setData(result);
            log.info('Data loaded successfully', { count: result.length });
            
        } catch (error) {
            log.error('Failed to load data', error);
        } finally {
            setLoading(false);
            log.info('Data loading finished');
        }
    }, []);
    
    return (
        <div>
            {loading ? 'Loading...' : `Data items: ${data.length}`}
            <button onClick={handleLoadData}>Reload</button>
        </div>
    );
};

export default MyComponent;
```

Tento debug systém umožňuje efektivní ladění a monitoring aplikací ve všech fázích vývoje.

## 📊 API Monitoring a Performance Tools

### ApiMonitoringService - Production monitoring
Komprehensivní monitoring systém pro sledování výkonu a detekci problémů v reálném čase.

#### Monitoring capabilities:
```php
// Automatické API request monitoring (integrated v controllers)
$this->monitoring->logApiRequest($request, $user, $startTime, $responseData, $errorMessage);

// MSSQL query performance tracking  
$this->monitoring->logMssqlQuery($procedure, $params, $startTime, $resultCount, $error);

// Cache performance monitoring
$this->monitoring->logCacheOperation('hit', $cacheKey, $duration);
```

#### Performance thresholds a alerts:
- **Normal API response**: <500ms
- **Warning threshold**: 500ms-2s (logged as warning)
- **Alert threshold**: >2s (automatické upozornění)
- **Slow MSSQL queries**: >5s (požaduje investigaci)
- **Suspicious activity**: >100 requests/minute per user

#### Log destinations a formáty:
```bash
# Development - human readable
tail -f var/log/api.log

# Production - structured JSON pro parsing
tail -f /var/log/api.log | jq '.duration_ms'

# Specific performance monitoring
grep "duration_ms" var/log/api.log | grep -E "duration_ms\":[0-9]{4,}"
```

### Cache Performance Debugging

#### Cache hit/miss analysis:
```bash
# Monitor cache effectiveness
grep "API Cache MISS" var/log/api.log | grep prikazy
grep "API Cache HIT" var/log/api.log | wc -l

# Cache size monitoring (development filesystem cache)
du -sh var/cache/app.api_cache/

# Redis cache stats (production)
redis-cli info stats | grep keyspace
redis-cli info memory | grep used_memory_human
```

#### Cache debugging commands:
```bash
# Flush specific cache pools
php bin/console cache:pool:clear app.api_cache
php bin/console cache:pool:clear app.long_cache

# Cache pool information  
php bin/console cache:pool:list
php bin/console debug:cache-pool app.api_cache
```

### Performance Profiling Tools

#### API response time analysis:
```bash
# Find slowest endpoints
grep "duration_ms" var/log/api.log | sort -t: -k4 -n | tail -10

# Average response time per endpoint
grep "/api/insyz/prikazy" var/log/api.log | grep duration_ms | awk -F'"duration_ms":' '{print $2}' | awk -F',' '{sum+=$1; count++} END {print sum/count}'

# Error rate monitoring
grep "status.*error" var/log/api.log | wc -l
```

#### MSSQL performance analysis:
```bash
# Slowest MSSQL stored procedures  
grep "MSSQL Query executed" var/log/api.log | grep -E "duration_ms\":[0-9]{4,}"

# Most called procedures
grep "procedure.*trasy\." var/log/api.log | cut -d'"' -f4 | sort | uniq -c | sort -nr
```

### Security Monitoring Tools

#### Suspicious activity detection:
```bash
# Rapid request detection
grep "int_adr" var/log/api.log | cut -d'"' -f8 | sort | uniq -c | sort -nr | head -10

# Failed authentication attempts  
grep "Nepřihlášený uživatel" var/log/api.log | grep -o "ip_address.*" | sort | uniq -c

# Error pattern analysis
grep "error" var/log/api.log | cut -d'"' -f6 | sort | uniq -c | sort -nr
```

#### Security alerts setup:
```bash
# Create monitoring script pro abnormal activity
#!/bin/bash
# Monitor for >50 requests per minute per user
grep "$(date '+%Y-%m-%d %H:%M')" var/log/api.log | cut -d'"' -f8 | sort | uniq -c | awk '$1>50 {print "Alert: User",$2,"made",$1,"requests in last minute"}'
```

## Development Health Check
```bash
# Kompletní health check (development prostředí)
curl -s "https://portalznackare.ddev.site/api/test/insyz-user"
curl -s "https://portalznackare.ddev.site/api/test/mssql-connection"

# Test messenger worker
php bin/console messenger:consume async --limit=1

## Console Commands

### User Management
```bash
# User management command
php bin/console app:user:manage list                    # Seznam aktivních uživatelů
php bin/console app:user:manage list --filter=admin     # Pouze admin uživatelé
php bin/console app:user:manage sync 12345              # Synchronizace z INSYZ
php bin/console app:user:manage role 12345 --role=ROLE_ADMIN --add  # Přidat roli
php bin/console app:user:manage show 12345              # Detail uživatele
php bin/console app:user:manage activate 12345          # Aktivovat účet

# Test roles command  
php bin/console app:test-user-roles                     # Test role systému
```

### File Management
```bash
# Cleanup temporary files
php bin/console app:files:cleanup                       # Vyčistí expired temp soubory
```

### Development Commands
```bash
# Cache management
php bin/console cache:pool:clear app.api_cache
php bin/console cache:pool:clear app.long_cache
php bin/console debug:cache-pool app.api_cache

# Background jobs
php bin/console messenger:consume async --limit=1
```

# Kontrola zaseknutých procesů
ps aux | grep messenger:consume
```

---

**Related:** [Toast System](toast-system.md) | [Getting Started](getting-started.md)  
**Architecture:** [../architecture.md](../architecture.md) - Cache a performance architektury  
**INSYZ Integration:** [../features/insyz-integration.md](../features/insyz-integration.md) - Cache troubleshooting  
**API Integration:** [../api.md](../api.md)  
**Updated:** 2025-08-08