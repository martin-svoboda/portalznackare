# Audit Logging - Kompletní systém auditních záznamů

> **Funkcionální oblast** - Dvojitý audit systém pro aplikační logování a INSYZ API monitoring s kompletní ochranou a přehledem

## 📊 Přehled systému

### Dvojitý audit systém (NOVÝ)
```
Aplikační audit:
User Action → AuditLogger → audit_logs → PostgreSQL
                  ↓
           EventListener → Automatic CRUD logging

INSYZ API audit:  
API Request → InsyzAuditLogger → insyz_audit_logs → PostgreSQL
                  ↓
           Controller → "Jeden log na proces"
                  ↓
           SystemOption → Konfigurace & monitoring
```

**Klíčové funkce:**
- **Dvojitý audit systém** - Oddělené aplikační a INSYZ API logování
- **Automatické CRUD logování** - Create/Update/Delete operace (aplikační)
- **INSYZ API monitoring** - Kompletní MSSQL API volání (nové)
- **"Jeden log na proces"** - Zjednodušená architektura bez duplicit
- **INT_ADR tracking** - Univerzální identifikátor uživatele
- **Sensitive data masking** - Ochrana citlivých údajů
- **Performance tracking** - MSSQL procedure timing a cache analytics
- **Konfigurovatelné** - Per-entity a per-API nastavení

## 📋 Audit Entity modely

### 1. AuditLog Entity (Aplikační audit)
```php
AuditLog {
    id: int
    action: string          // "user_login", "entity_update", "report_create"...
    int_adr: ?int          // KČT identifikátor uživatele
    user_id: ?int          // Lokální user ID (fallback)
    entity_type: ?string   // "User", "Report"...
    entity_id: ?string     // ID upravované entity
    old_values: ?json      // Původní hodnoty
    new_values: ?json      // Nové hodnoty
    ip_address: ?string    // IP adresa
    user_agent: ?string    // Browser info
    extra_data: ?json      // Dodatečné informace
    created_at: datetime   // Čas akce
}
```

### 2. InsyzAuditLog Entity (INSYZ API audit)
```php
InsyzAuditLog {
    id: int
    endpoint: string        // "/api/insyz/prikazy", "/api/insyz/user"...
    method: string         // "GET", "POST"
    status: string         // "success", "error"
    user_id: ?int          // Lokální user ID
    int_adr: ?int          // KČT identifikátor uživatele
    mssql_procedure: string // "trasy.PRIKAZY_SEZNAM", "TEST_DATA"...
    duration_ms: int       // Celková doba reqestu (ms)
    mssql_duration_ms: ?int // Doba MSSQL volání (ms)
    cache_hit: bool        // Zda byla použita cache
    request_params: ?json  // Sanitized request parametry
    response_summary: ?json // Metadata z response (ne celá data)
    error_message: ?string // Chybová zpráva při error
    ip_address: ?string    // IP adresa
    user_agent: ?string    // Browser info
    created_at: datetime   // Čas volání
}
```

### Typy akcí

#### Aplikační audit (audit_logs)
```php
// Systémové akce
'user_login'              // Přihlášení (InsyzUserProvider)
'user_logout'             // Odhlášení
'user_login_failed'       // Neúspěšné přihlášení

// CRUD operace (automatické via EventListener)
'entity_create'           // Vytvoření entity
'entity_update'           // Úprava entity
'entity_delete'           // Smazání entity

// Specifické akce
'report_create'           // Vytvoření hlášení (ReportController)
'report_update'           // Úprava hlášení (ReportController)
'user_role_change'        // Změna role (UserApiController)
'user_settings_change'    // Změna nastavení (UserApiController)
'system_option_change'    // Změna konfigurace (SystemOptionApiController)
'audit_config_change'     // Změna audit nastavení
'api_request'             // API volání (ApiMonitoringService)
'suspicious_activity'     // Podezřelá aktivita
```

#### INSYZ API audit (insyz_audit_logs)
```php
// Všechna INSYZ API volání (InsyzController)
Endpointy:
'/api/insyz/login'        // Login proces + MSSQL audit
'/api/insyz/user'         // Uživatelský profil
'/api/insyz/prikazy'      // Seznam příkazů
'/api/insyz/prikaz/{id}'  // Detail příkazu
'/api/insyz/sazby'       // Sazby
'/api/insyz/submit-report' // Odeslání hlášení do INSYZ

MSSQL Procedures:
'trasy.WEB_Login'         // Login autentizace
'trasy.ZNACKAR_DETAIL'    // Detail uživatele
'trasy.PRIKAZY_SEZNAM'    // Seznam příkazů
'trasy.ZP_Detail'         // Detail příkazu
'trasy.ZP_Zapis_XML'      // Zápis hlášení
'TEST_DATA'               // Testovací režim
```

## 🔧 Konfigurace

### 1. Aplikační audit konfigurace (SystemOption)
```json
{
    "audit.log_entities": {
        "User": {
            "enabled": true,
            "events": ["create", "update"],
            "masked_fields": ["password", "api_key"]
        },
        "Report": {
            "enabled": true,
            "events": ["create", "update", "delete", "submit"],
            "masked_fields": []
        },
        "FileAttachment": {
            "enabled": false
        }
    }
}
```

### 2. INSYZ API audit konfigurace (SystemOption)
```json
{
    "insyz_audit": {
        "enabled": true,                    // Zapnout/vypnout INSYZ audit
        "log_responses": false,             // Logovat response data (default false - jen metadata)
        "log_request_params": true,         // Logovat request parametry (sanitized)
        "retention_days": 30,               // Retention policy (dny)
        "excluded_endpoints": [],           // Vyjímky z auditování
        "slow_query_threshold_ms": 2000,    // Alert na pomalé MSSQL queries
        "log_test_data_calls": true,        // Logovat i TEST_DATA volání
        "log_cache_hits": true              // Logovat cache hit/miss
    }
}
```

### Masked Fields
Citlivá pole jsou automaticky maskována:
```json
// Původní data
{
    "password": "secretPassword123",
    "email": "user@example.com"
}

// V audit logu
{
    "password": "***MASKED***",
    "email": "user@example.com"
}
```

## 🛠️ Použití

### 1. Aplikační audit použití

#### Automatické logování (EventListener)
```php
// Automaticky při save/update/delete
$report = new Report();
$entityManager->persist($report);  // → loguje "entity_create" 
$entityManager->flush();

$report->setState('submitted');
$entityManager->flush();           // → loguje "entity_update"
```

#### Manuální logování
```php
// V controlleru nebo service
$this->auditLogger->logByIntAdr(
    $user->getIntAdr(),
    'report_create',
    'Report',
    $report->getId(),
    null,        // Původní hodnoty (pro create null)
    [            // Nové hodnoty
        'id_zp' => $report->getIdZp(),
        'state' => $report->getState()->value
    ]
);
```

### 2. INSYZ API audit použití

#### Automatické logování (InsyzController)
```php
// Každý INSYZ endpoint automaticky loguje "jeden log na proces"
public function getPrikazy(Request $request): JsonResponse 
{
    $startTime = microtime(true);
    
    try {
        $prikazy = $this->insyzService->getPrikazy($intAdr, $year);
        
        // AUTOMATICKÉ audit logování
        $this->auditLogger->logApiSuccess(
            endpoint: '/api/insyz/prikazy',
            method: 'GET', 
            user: $user,
            startTime: $startTime,
            responseData: $prikazy,  // Jen metadata, ne celá data
            mssqlProcedure: 'trasy.PRIKAZY_SEZNAM'
        );
        
        return new JsonResponse($prikazy);
    } catch (Exception $e) {
        $this->auditLogger->logApiError(/* ... */);
    }
}
```

#### Service methods (čisté bez auditu)
```php
// InsyzService je nyní čistý - bez audit logování
class InsyzService 
{
    public function getPrikazy(int $intAdr, ?int $year = null): array
    {
        // Jen business logika, audit je v Controlleru
        return $this->cacheService->getCachedPrikazy($intAdr, $year, 
            fn() => $this->connector->callProcedure('trasy.PRIKAZY_SEZNAM', [$intAdr, $year])
        );
    }
}
```

### 3. Repository queries

#### Aplikační audit queries
```php
// Vyhledávání v audit_logs
$auditLogs = $auditLogRepository->findByIntAdr($intAdr);
$auditLogs = $auditLogRepository->findByEntity('Report', '123'); 
$auditLogs = $auditLogRepository->findByAction('user_login');

// Statistiky
$stats = $auditLogRepository->getActivityStatistics($since);
$userActivity = $auditLogRepository->getUserActivityByIntAdr($intAdr);
```

#### INSYZ API audit queries
```php
// Vyhledávání v insyz_audit_logs
$insyzLogs = $insyzAuditLogRepository->findByIntAdr($intAdr);
$insyzLogs = $insyzAuditLogRepository->findByEndpoint('/api/insyz/prikazy');
$insyzLogs = $insyzAuditLogRepository->findByMssqlProcedure('trasy.PRIKAZY_SEZNAM');

// Performance statistiky
$endpointStats = $insyzAuditLogRepository->getEndpointStatistics($startDate, $endDate);
$procedureStats = $insyzAuditLogRepository->getMssqlProcedureStatistics($startDate, $endDate);
$cacheStats = $insyzAuditLogRepository->getCacheStatistics($startDate, $endDate);

// Slow queries
$slowQueries = $insyzAuditLogRepository->findSlowQueries($thresholdMs = 2000);
$errorLogs = $insyzAuditLogRepository->findErrorLogs($since);
```

## 📊 Admin rozhraní

### API endpointy

#### Aplikační audit API
Kompletní API v [Admin API](../api/admin-api.md#audit-logs-api):
- `GET /api/audit-logs` - Prohlížení logů s filtrováním  
- `GET /api/audit-logs/export` - Export do CSV
- `GET /api/audit-logs/statistics` - Statistiky aktivit
- `DELETE /api/audit-logs/cleanup` - Cleanup starých záznamů

#### INSYZ API audit API
Kompletní API v [Admin API](../api/admin-api.md#insyz-audit-api):
- `GET /api/insyz-audit-logs` - Prohlížení INSYZ audit logů
- `GET /api/insyz-audit-logs/statistics` - Performance statistiky
- `GET /api/insyz-audit-logs/endpoints` - Endpoint analytics
- `GET /api/insyz-audit-logs/procedures` - MSSQL procedure metrics
- `GET /api/insyz-audit-logs/slow-queries` - Pomalé MSSQL queries
- `DELETE /api/insyz-audit-logs/cleanup` - Cleanup (configurable retention)

### Filtry

#### Aplikační audit filtry
- Podle uživatele (INT_ADR)
- Podle typu akce
- Podle entity
- Časové rozmezí
- Fulltext v hodnotách

#### INSYZ API audit filtry
- Podle uživatele (INT_ADR) 
- Podle endpointu
- Podle MSSQL procedure
- Podle performance (duration_ms)
- Podle cache hit/miss
- Success/Error status
- Časové rozmezí

## 🔒 Bezpečnostní aspekty

### Přístupová práva

#### Aplikační audit
- **Prohlížení:** ROLE_ADMIN
- **Export:** ROLE_SUPER_ADMIN  
- **Cleanup:** ROLE_SUPER_ADMIN

#### INSYZ API audit
- **Prohlížení:** ROLE_ADMIN
- **Performance statistics:** ROLE_ADMIN
- **Export:** ROLE_SUPER_ADMIN
- **Cleanup:** ROLE_SUPER_ADMIN
- **Konfigurace:** ROLE_SUPER_ADMIN

### Retention politika

#### Aplikační audit
- Default: 90 dní
- Konfigurovatelné per typ akce
- Automatický cleanup via command

#### INSYZ API audit  
- Default: 30 dní (performance data)
- Konfigurovatelné via system_options
- Automatický cleanup via InsyzAuditCommand
- Bulk cleanup pro performance

### Ochrana dat

#### Aplikační audit
- Maskování citlivých polí (password, api_key)
- IP adresy jen pro security akce
- Žádné hesla v plain textu

#### INSYZ API audit
- **Response data sanitization** - Jen metadata, ne citlivé obsahy
- **Request params filtering** - Automatické maskování hesel/tokenů
- **MSSQL procedure params** - Sanitized (bez osobních údajů v raw SQL)
- **Cache data protection** - Žádné cache keys obsahující osobní data

## 📈 Rozšíření a budoucí vývoj

### Implementované funkce
- **Kompletní INSYZ API logging** - Všechna MSSQL volání auditována
- **Performance metrics** - MSSQL procedure timing + cache analytics
- **"Jeden log na proces"** - Zjednodušená architektura bez duplicit
- **Dvojitý audit systém** - Oddělené aplikační a INSYZ API logování
- **System_options konfigurace** - Flexibilní nastavení per feature

### Budoucí rozšíření
- **Alert systém** - Notifikace na pomalé MSSQL queries (>2s)
- **Audit report generator** - Pravidelné performance reporty
- **SIEM integrace** - Export INSYZ performance dat do security systémů  
- **Real-time monitoring** - Dashboard pro live INSYZ API monitoring

## 🧪 Testování

### 1. Aplikační audit testování
```bash
# Login test - vytvoří audit log
curl -X POST /api/auth/login -d '{"username":"test","password":"test"}'

# Report operace test
curl -X POST /api/portal/report -d '{"id_zp":123,"cislo_zp":"ZP123"}'

# Zkontrolovat v DB
ddev exec psql -c "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10"

# API test
curl /api/audit-logs?action=user_login
curl /api/audit-logs?entity_type=Report
```

### 2. INSYZ API audit testování
```bash
# INSYZ API testy - vytvoří insyz_audit_logs
curl -X POST /api/insyz/login -d '{"email":"test","hash":"test"}'
curl -X GET /api/insyz/prikazy?year=2024
curl -X GET /api/insyz/prikaz/123
curl -X GET /api/insyz/user

# Zkontrolovat INSYZ audit v DB
ddev exec psql -c "SELECT endpoint, method, status, duration_ms, mssql_procedure FROM insyz_audit_log ORDER BY created_at DESC LIMIT 10"

# Performance test
ddev exec psql -c "SELECT endpoint, AVG(duration_ms), COUNT(*) FROM insyz_audit_log WHERE created_at > NOW() - INTERVAL '1 day' GROUP BY endpoint"

# Cache test
ddev exec psql -c "SELECT cache_hit, COUNT(*) FROM insyz_audit_log GROUP BY cache_hit"
```

### Console commands

Kompletní reference: [Console Commands](../development/commands.md)

```bash
# INSYZ audit status
php bin/console insyz:audit status

# INSYZ audit konfigurace
php bin/console insyz:audit config
php bin/console insyz:audit config --set enabled=true

# INSYZ audit cleanup
php bin/console insyz:audit cleanup --dry-run
php bin/console insyz:audit cleanup

# INSYZ audit statistiky
php bin/console insyz:audit stats --period="24 hours"
php bin/console insyz:audit stats --period="7 days"
```

---

**API dokumentace:** [../api/admin-api.md](../api/admin-api.md#audit-logs-api) | [../api/insyz-api.md](../api/insyz-api.md#insyz-audit-api)  
**INSYZ integrace:** [insyz-integration.md](insyz-integration.md)  
**Konfigurace:** [../configuration.md](../configuration.md)  
**Hlavní přehled:** [../overview.md](../overview.md)  
**Aktualizováno:** 2025-08-08