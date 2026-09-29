# Audit Logging - Kompletní systém auditních záznamů

> **Funkcionální oblast** - Dvojitý audit systém pro aplikační logování a INSYZ API monitoring s kompletní ochranou a přehledem

## 📊 Přehled systému

### Dvojitý audit systém
```
Aplikační audit:
Doctrine události → AuditEventListener → AuditLogger → audit_logs (PostgreSQL)
Přihlášení       → InsyzAuthenticator → AuditLogger → audit_logs

INSYZ audit:
InsyzService (každé volání procedury / TEST_DATA) → InsyzAuditLogger → insyz_audit_logs (PostgreSQL)
                                                       ↑
                                             system_options insyz_audit.*
```

**Klíčové funkce:**
- **Dvojitý audit systém** - Oddělené aplikační a INSYZ API logování
- **Automatické CRUD logování** - Create/Update/Delete operace (aplikační)
- **INSYZ API monitoring** - Kompletní MSSQL API volání (nové)
- **Jeden záznam na volání procedury** - loguje centrálně `InsyzService::logInsyzCall()`
- **INT_ADR tracking** - Univerzální identifikátor uživatele
- **Sensitive data masking** - Ochrana citlivých údajů
- **Performance tracking** - MSSQL procedure timing a cache analytics
- **Konfigurovatelné** - Per-entity a per-API nastavení

## 📋 Audit Entity modely

### 1. AuditLog Entity (Aplikační audit, tabulka `audit_logs`)
```php
AuditLog {
    id: int
    user: ?User            // vazba na lokálního uživatele
    int_adr: ?int          // KČT identifikátor uživatele
    action: string         // "user_login", "entity_update"...
    entity_type: ?string   // "User", "Report"...
    entity_id: ?string     // ID upravované entity
    old_values: ?json      // Původní hodnoty
    new_values: ?json      // Nové hodnoty
    ip_address: ?string
    user_agent: ?string
    created_at: datetime
}
```

### 2. InsyzAuditLog Entity (INSYZ audit, tabulka `insyz_audit_logs`)
```php
InsyzAuditLog {
    id: int
    endpoint: string        // název procedury nebo "login" / endpoint u TEST_DATA
    method: string         // u volání z InsyzService vždy "CALL"
    status: string         // "success", "error"
    user: ?User            // vazba na lokálního uživatele
    int_adr: int           // KČT identifikátor (0, když není znám)
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
Konstanty v `AuditLog::ACTION_*`; skutečně se zapisují tyto akce:
```php
'user_login'          // Úspěšné přihlášení (InsyzAuthenticator → AuditLogger::logLogin)
'user_login_failed'   // Neúspěšné přihlášení (AuditLogger::logFailedLogin)
'entity_create'       // AuditEventListener (Doctrine postPersist)
'entity_update'       // AuditEventListener (Doctrine postUpdate)
'entity_delete'       // AuditEventListener (Doctrine postRemove)
'user_sync'           // app:user:manage sync
'user_role_change'    // app:user:manage role
'user_status_change'  // app:user:manage activate/deactivate
```
Ostatní konstanty (`user_logout`, `report_*`, `file_*`, `user_settings_change`) a metody
`logLogout()`, `logCreate()`, `logUpdate()`, `logDelete()`, `logReportAction()`, `logFileOperation()`
v `AuditLogger` existují, ale v kódu se nevolají. `ApiMonitoringService` (akce `api_request`) je
zaregistrovaná služba, kterou nic nepoužívá.

#### INSYZ audit (insyz_audit_logs)
Zapisuje `InsyzService` přes `InsyzAuditLogger::logMssqlProcedureCall()`:
- skutečné volání procedury (`connect()`) – `endpoint` i `mssql_procedure` = název procedury
- login – `endpoint` = `login`, procedura `trasy.WEB_Login`
- režim `USE_TEST_DATA=true` – `mssql_procedure` = `TEST_DATA`

Používané procedury: `trasy.WEB_Login`, `trasy.ZNACKAR_DETAIL`, `trasy.PRIKAZY_SEZNAM`, `trasy.ZP_Detail`,
`trasy.ZP_Useky`, `trasy.ZP_Sazby`, `trasy.ZP_Zapis_XML`, `trasy.WEB_Zapis_Pwd`, `trasy.WEB_SystemoveParametry`.

## 🔧 Konfigurace

### 1. Aplikační audit konfigurace (SystemOption `audit.log_entities`)
Výchozí hodnota vkládaná migrací `Version20250808110000` (klíč entity = krátký název třídy):
```json
{
    "User": {"enabled": true, "events": ["create", "update", "delete"], "masked_fields": ["password", "token"]},
    "Report": {"enabled": true, "events": ["create", "update", "delete"], "masked_fields": []},
    "FileAttachment": {"enabled": true, "events": ["create", "delete"], "masked_fields": ["storage_path"]}
}
```
(Migrace původně zakládá klíč `HlaseniPrikazu`; lokální DB má `Report` – ověřte na konkrétním serveru.)
`AuditLog` a `SystemOption` se neaudituje nikdy (ochrana proti rekurzi). Další options: `audit.retention_days` (90),
`audit.log_ip_addresses`.

### 2. INSYZ audit konfigurace (SystemOption `insyz_audit.*`)
Samostatné klíče, které čte `InsyzAuditLogger` (výchozí hodnota v kódu):
```
insyz_audit.enabled               (true)  – zapnutí celého INSYZ auditu
insyz_audit.log_requests          (true)  – ukládat request parametry
insyz_audit.log_responses         (true)  – ukládat souhrn odpovědi (response_summary)
insyz_audit.log_mssql_queries     (true)  – logovat volání procedur
insyz_audit.log_cache_operations  (true)
insyz_audit.retention_days        (90)    – retence pro cleanup
```
`enabled`, `log_requests`, `log_responses` a `retention_days` lze měnit na `/admin/system-nastaveni`
(ROLE_SUPER_ADMIN) nebo `php bin/console insyz:audit config --set klic=hodnota`.

### Masked Fields
Citlivá pole jsou automaticky maskována:
```json
// Původní data
{
    "password": "secretPassword123",
    "email": "user@example.com"
}

// V audit logu (AuditEventListener)
{
    "password": "***",
    "email": "user@example.com"
}
```

## 🛠️ Použití

### 1. Aplikační audit použití

#### Automatické logování (AuditEventListener)
Doctrine listener (`prePersist/postPersist`, `preUpdate/postUpdate`, `postRemove`) zapíše `entity_create`,
`entity_update` nebo `entity_delete`, pokud to povoluje `SystemOptionService::isAuditEnabled($entita, $udalost)`.

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

### 2. INSYZ audit použití
Controllery INSYZ audit neřeší. Každé volání procedury v `InsyzService` (`connect()`, `loginUser()`,
testovací data) volá privátní `logInsyzCall()` → `InsyzAuditLogger::logMssqlProcedureCall()`; do
`response_summary` jde jen zkrácený souhrn výsledku (`createResultSummary()`).

### 3. Repository queries

#### Aplikační audit queries (`AuditLogRepository`)
```php
$auditLogRepository->findByIntAdr($intAdr);
$auditLogRepository->findByUser($user);
$auditLogRepository->findByEntity('Report', '123');
$auditLogRepository->findByAction('user_login');
$auditLogRepository->search($criteria, $limit, $offset);
$auditLogRepository->getActivityStatistics($since);
$auditLogRepository->getUserActivityByIntAdr($intAdr);
$auditLogRepository->cleanupOldLogs($daysToKeep);   // nevolá ho žádný command
```

#### INSYZ audit queries (`InsyzAuditLogRepository`)
```php
$insyzAuditLogRepository->findByIntAdr($intAdr);
$insyzAuditLogRepository->findByEndpoint(...);
$insyzAuditLogRepository->findSlowQueries(2000);
$insyzAuditLogRepository->findSlowMssqlQueries(5000);
$insyzAuditLogRepository->findErrors();
$insyzAuditLogRepository->getEndpointStatistics($start, $end);
$insyzAuditLogRepository->getMssqlProcedureStatistics($start, $end);
$insyzAuditLogRepository->getCacheStatistics($start, $end);
$insyzAuditLogRepository->cleanupOldLogs($retentionDays);
```

## 📊 Admin rozhraní

REST API pro audit logy neexistuje. K dispozici jsou Twig stránky (`AdminController`, `ROLE_ADMIN`):
- `/admin/audit-logy` – posledních 100 záznamů `audit_logs` (čas, uživatel, akce, entita, IP)
- `/admin/insyz-monitoring` – posledních 100 záznamů `insyz_audit_logs`
- `/admin/` – počty audit záznamů (dnes / 7 dní), INSYZ volání a chyby dnes, posledních 10 záznamů
- `/admin/system-nastaveni` – nastavení retence a INSYZ auditu (`ROLE_SUPER_ADMIN`)

Filtrování, export a statistiky INSYZ auditu nabízí console command `insyz:audit` (viz níže).
Viz [api.md](../api.md#administrace).

## 🔒 Bezpečnostní aspekty

### Přístupová práva
- **Prohlížení (admin stránky):** ROLE_ADMIN
- **Nastavení retence / INSYZ auditu:** ROLE_SUPER_ADMIN (`/admin/system-nastaveni`)
- **Cleanup:** jen console `insyz:audit cleanup` (INSYZ audit)

### Retention politika
- **Aplikační audit:** option `audit.retention_days` (90) – automatický cleanup `audit_logs` v kódu není
  (`AuditLogRepository::cleanupOldLogs()` se nevolá)
- **INSYZ audit:** option `insyz_audit.retention_days` (výchozí v kódu 90) – mazání přes
  `php bin/console insyz:audit cleanup` (plánování cronem v repozitáři není)

### Ochrana dat

#### Aplikační audit
- `AuditEventListener` maskuje pole z `masked_fields` a vestavěný seznam citlivých klíčů (`password`, `api_key`, …) na `***`
- `AuditLogger` navíc nahrazuje citlivé klíče (`password`, `token`, `secret`, `api_key`, `private_key`) za `***REDACTED***`

#### INSYZ API audit
- **Response data sanitization** - Jen metadata, ne citlivé obsahy
- **Request params filtering** - Automatické maskování hesel/tokenů
- **MSSQL procedure params** - Sanitized (bez osobních údajů v raw SQL)
- **Cache data protection** - Žádné cache keys obsahující osobní data

## 🧪 Testování

### 1. Aplikační audit testování
```bash
# Přihlaste se v prohlížeči (vznikne user_login), pak:
ddev exec psql -c "SELECT action, entity_type, entity_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10"
```

### 2. INSYZ audit testování
```bash
# Po práci v portálu (načtení příkazů, detailu…):
ddev exec psql -c "SELECT endpoint, method, status, duration_ms, mssql_procedure FROM insyz_audit_logs ORDER BY created_at DESC LIMIT 10"
ddev exec psql -c "SELECT endpoint, AVG(duration_ms), COUNT(*) FROM insyz_audit_logs WHERE created_at > NOW() - INTERVAL '1 day' GROUP BY endpoint"
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

**Admin stránky:** [../api.md](../api.md#administrace) | **INSYZ API:** [../api.md](../api.md#insyz-data)  
**INSYZ integrace:** [insyz-integration.md](insyz-integration.md)  
**Konfigurace:** [../configuration.md](../configuration.md)  
**Hlavní přehled:** [../overview.md](../overview.md)  
**Aktualizováno:** 2026-09-27