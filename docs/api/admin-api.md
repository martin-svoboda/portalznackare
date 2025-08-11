# Admin API Reference

> **API dokumentace** - Zabezpečené administrační endpointy vyžadující ROLE_ADMIN nebo vyšší

## 🔐 Přehled Admin API

**Base URL:** `/api/`  
**Autentifikace:** Session-based, vyžaduje minimálně ROLE_ADMIN  
**Role:** ROLE_ADMIN, ROLE_SUPER_ADMIN  
**Format:** JSON request/response

### Dostupné API controllery
- **UserApiController** - Správa uživatelů a rolí
- **AuditLogApiController** - Prohlížení audit logů  
- **SystemOptionApiController** - Systémová nastavení
- **AuthApiController** - Info o aktuálním uživateli

## 👥 User Management API

### GET `/api/users`
Seznam uživatelů s filtrováním a paginací.

**Query parametry:**
- `page` - Číslo stránky (default: 1)
- `limit` - Počet záznamů (max 100)
- `search` - Fulltext vyhledávání  
- `role` - Filtr podle role
- `active` - Pouze aktivní (true/false)
- `recent_days` - Nedávno aktivní

**Response:**
```json
{
    "data": [{
        "id": 1,
        "int_adr": 1234,
        "email": "user@kct.cz",
        "jmeno": "Jan",
        "prijmeni": "Novák",
        "roles": ["ROLE_USER", "ROLE_ADMIN"],
        "is_active": true,
        "last_login_at": "2025-01-15T10:00:00+01:00"
    }],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 45,
        "pages": 3
    }
}
```

### GET `/api/users/{id}`
Detail konkrétního uživatele.

### PUT `/api/users/{id}/roles`  
Aktualizace rolí uživatele.

**Request:**
```json
{
    "roles": ["ROLE_USER", "ROLE_VEDOUCI", "ROLE_ADMIN"]
}
```

### PUT `/api/users/{id}/activate`
Aktivace/deaktivace uživatele.

**Request:**
```json
{
    "active": true
}
```

### PUT `/api/users/{id}/settings` | `/preferences`
Aktualizace nastavení nebo preferencí (admin nebo vlastní uživatel).

### GET `/api/users/stats`
Statistiky uživatelů.

**Response:**
```json
{
    "total_users": 150,
    "active_users": 142,
    "admin_users": 5,
    "recent_logins": 38
}
```

### POST `/api/users/{intAdr}/sync` 
⚠️ **Vyžaduje ROLE_SUPER_ADMIN**  
Synchronizace uživatele z INSYZ (not implemented yet).

## 📋 Audit Logs API

### GET `/api/audit-logs`
Seznam audit logů s pokročilým filtrováním.

**Query parametry:**
- `page`, `limit` - Paginace
- `user_id` nebo `int_adr` - Filtr podle uživatele
- `action` - Typ akce (user_login, entity_update...)
- `entity_type` - Typ entity
- `date_from`, `date_to` - Časový rozsah
- `last_hours`, `last_days` - Rychlé filtry
- `search` - Hledání v hodnotách

**Response:**
```json
{
    "data": [{
        "id": 123,
        "action": "user_role_change",
        "int_adr": 1234,
        "entity_type": "User",
        "entity_id": "45",
        "old_values": {"roles": ["ROLE_USER"]},
        "new_values": {"roles": ["ROLE_USER", "ROLE_ADMIN"]},
        "created_at": "2025-01-15T14:30:00+01:00"
    }],
    "pagination": {...}
}
```

### GET `/api/audit-logs/{id}`
Detail konkrétního záznamu.

### GET `/api/audit-logs/user/{intAdr}`
Audit logy konkrétního uživatele.

### GET `/api/audit-logs/entity/{entityType}/{entityId}`
Historie změn konkrétní entity.

### GET `/api/audit-logs/stats`
Statistiky audit logů.

**Query parametry:**
- `days` - Počet dní zpět (default: 30)

### GET `/api/audit-logs/actions`
Seznam dostupných akcí pro filtrování.

### GET `/api/audit-logs/export`
⚠️ **Vyžaduje ROLE_SUPER_ADMIN**  
Export do CSV (max 10k záznamů).

### DELETE `/api/audit-logs/cleanup`
⚠️ **Vyžaduje ROLE_SUPER_ADMIN**  
Vymazání starých logů.

**Query parametry:**
- `days` - Kolik dní ponechat (min 30)

## ⚙️ System Options API

### GET `/api/system-options`
Seznam systémových nastavení.

**Query parametry:**
- `autoload_only` - Pouze autoload options
- `search` - Vyhledávání podle názvu

### GET `/api/system-options/{optionName}`
Detail konkrétní option.

### GET `/api/system-options/{optionName}/value`
Pouze hodnota option.

### PUT `/api/system-options/{optionName}`
Aktualizace hodnoty.

**Request:**
```json
{
    "value": {...},
    "autoload": true
}
```

### PUT `/api/system-options/bulk`
⚠️ **Vyžaduje ROLE_SUPER_ADMIN**  
Hromadná aktualizace.

### GET `/api/system-options/audit-config`
Konfigurace audit logování.

### PUT `/api/system-options/audit-config/{entityName}`
Aktualizace audit konfigurace pro entitu.

**Request:**
```json
{
    "enabled": true,
    "events": ["create", "update", "delete"],
    "masked_fields": ["password", "api_key"]
}
```

### POST/DELETE `/api/system-options/audit-config/{entityName}/masked-fields`
Správa maskovaných polí.

### DELETE `/api/system-options/cache/clear`
⚠️ **Vyžaduje ROLE_SUPER_ADMIN**  
Vymazání cache.

### GET/POST `/api/system-options/export` | `/import`
⚠️ **Vyžaduje ROLE_SUPER_ADMIN**  
Export/import konfigurace.

## 🔑 Auth API

### GET `/api/auth/me`
Informace o aktuálním přihlášeném uživateli.

**Response:**
```json
{
    "user": {
        "id": 1,
        "int_adr": 1234,
        "email": "admin@kct.cz",
        "roles": ["ROLE_USER", "ROLE_ADMIN"]
    },
    "permissions": {
        "can_manage_users": true,
        "can_view_audit_logs": true,
        "can_manage_system_options": true,
        "is_super_admin": false
    }
}
```

## 🔒 Security

### Role-based Access
- **ROLE_ADMIN** - Přístup ke všem admin endpointům
- **ROLE_SUPER_ADMIN** - Nebezpečné operace (cleanup, bulk import)

### Audit Logging
Všechny admin operace jsou automaticky logovány:
- Změny rolí uživatelů
- Úpravy systémových nastavení
- Export/import operací
- Správa INSYZ audit logů

### Rate Limiting
- Export operace jsou omezeny na max 10k záznamů
- Cleanup operace mají minimální dobu retence 30 dní

## 📊 INSYZ Audit API {#insyz-audit-api}

### 📋 GET `/api/insyz-audit-logs`

Administrátorské prohlížení INSYZ API audit logů s pokročilými filtry.

**Autentifikace:** ROLE_ADMIN  
**Účel:** Monitoring INSYZ API performance a troubleshooting

**Query parametry:**
- `int_adr` - Filtr podle uživatele
- `endpoint` - Filtr podle API endpointu 
- `method` - HTTP metoda (GET, POST)
- `status` - success/error
- `mssql_procedure` - Název MSSQL procedure
- `duration_min` - Minimální doba (ms)
- `duration_max` - Maximální doba (ms) 
- `cache_hit` - true/false
- `start_date` - Od (Y-m-d H:i:s)
- `end_date` - Do (Y-m-d H:i:s)
- `page` - Stránkování
- `limit` - Počet záznamů (max 100)

**Response:**
```json
{
    "data": [
        {
            "id": 123,
            "endpoint": "/api/insyz/prikazy",
            "method": "GET",
            "status": "success", 
            "user_id": 1,
            "int_adr": 4133,
            "mssql_procedure": "trasy.PRIKAZY_SEZNAM",
            "duration_ms": 450,
            "mssql_duration_ms": 280,
            "cache_hit": false,
            "request_params": {"year": 2024},
            "response_summary": {"count": 15, "total_size_kb": 12},
            "created_at": "2025-08-08T10:30:00Z"
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 156,
        "pages": 8
    }
}
```

### 📊 GET `/api/insyz-audit-logs/statistics`

Performance statistiky INSYZ API volání pro administrátory.

**Autentifikace:** ROLE_ADMIN

**Query parametry:**
- `start_date` - Od (Y-m-d)
- `end_date` - Do (Y-m-d)
- `group_by` - endpoint/procedure/hour/day

**Response:**
```json
{
    "period": {
        "start": "2025-08-01",
        "end": "2025-08-08", 
        "days": 7
    },
    "totals": {
        "requests": 1245,
        "errors": 23,
        "avg_duration_ms": 387,
        "cache_hit_rate": 0.73
    },
    "endpoints": [
        {
            "endpoint": "/api/insyz/prikazy",
            "count": 450,
            "avg_duration_ms": 312,
            "error_rate": 0.02,
            "cache_hit_rate": 0.89
        }
    ],
    "procedures": [
        {
            "procedure": "trasy.PRIKAZY_SEZNAM",
            "count": 450,
            "avg_mssql_duration_ms": 234,
            "slowest_ms": 1200
        }
    ]
}
```

### 🐌 GET `/api/insyz-audit-logs/slow-queries`

Pomalé MSSQL dotazy pro optimalizaci systému.

**Autentifikace:** ROLE_ADMIN

**Query parametry:**
- `threshold_ms` - Práh pro pomalé query (default: 2000)
- `start_date` - Od (Y-m-d)
- `end_date` - Do (Y-m-d)
- `limit` - Počet záznamů (max 50)

### 🧹 DELETE `/api/insyz-audit-logs/cleanup`

Bulk cleanup starých INSYZ audit logů.

**Autentifikace:** ROLE_SUPER_ADMIN

**Request:**
```json
{
    "older_than_days": 30,
    "dry_run": false
}
```

---

**Funkcionální dokumentace:** [../features/user-management.md](../features/user-management.md)  
**Audit system:** [../features/audit-logging.md](../features/audit-logging.md)  
**API přehled:** [overview.md](overview.md)  
**Aktualizováno:** 2025-08-08