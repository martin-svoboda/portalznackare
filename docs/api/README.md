# API Reference

Přehled všech API endpointů aplikace Portál značkaře.

## 🔗 API Architektury

Aplikace má **hybrid API** architekturu:

```
Frontend (React) → Symfony API → Backend Services
                               ↘ INSYS Database (MSSQL)
                               ↘ Portal Database (PostgreSQL)
```

## 📋 API Skupiny

### 🏛️ INSYS API
- **Účel:** Integrace s databází KČT (MSSQL)
- **Base URL:** `/api/insys/`
- **Data:** Příkazy, uživatelé, ceníky z INSYS systému
- **Endpointy:** `/user`, `/prikazy`, `/prikaz/{id}`, `/ceniky`, `/login`

### 🏠 Portal API
- **Účel:** Lokální funkcionalita (PostgreSQL)
- **Base URL:** `/api/portal/`
- **Data:** Reporty hlášení (zatím implementované)
- **Endpointy:** `/report` (GET/POST)

### 🧪 Test API
- **Účel:** Debugging a zdravotní kontroly
- **Base URL:** `/api/test/`
- **Endpointy:** `/insys-user`, `/insys-prikazy`, `/mssql-connection`, `/login-test`

## 🚀 Rychlé příklady

### Test API připojení
```bash
# Test INSYS připojení
curl "https://dev.portalznackare.cz/api/test/mssql-connection"

# Test INSYS uživatelských dat
curl "https://dev.portalznackare.cz/api/test/insys-user"

# Test Portal API reporty
curl "https://dev.portalznackare.cz/api/portal/report?id_zp=1"
```

### Autentifikace
```javascript
// Login
const response = await fetch('/api/insys/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        email: 'admin@portal.local',
        password: 'admin123'
    })
});
```

### Získání dat
```javascript
// Příkazy z INSYS (vyžaduje přihlášení)
const prikazy = await fetch('/api/insys/prikazy?year=2025')
    .then(r => r.json());

// Reporty hlášení z Portal API
const report = await fetch('/api/portal/report?id_zp=1')
    .then(r => r.json());
```

## 📝 API Konvence

### Response formáty
```javascript
// Úspěšná odpověď
{
    "data": [...],
    "meta": {
        "total": 42,
        "page": 1,
        "limit": 20
    }
}

// Chybová odpověď
{
    "error": {
        "message": "Validation failed",
        "code": 400,
        "details": {...}
    }
}
```

### HTTP Status kódy
- `200` - OK (úspěch)
- `201` - Created (vytvořeno)
- `400` - Bad Request (chybný požadavek)
- `401` - Unauthorized (nepřihlášený)
- `403` - Forbidden (nemá oprávnění)
- `404` - Not Found (nenalezeno)
- `500` - Internal Server Error (chyba serveru)

### Pagination
```javascript
// Request
GET /api/portal/methodologies?page=2&limit=10

// Response
{
    "data": [...],
    "meta": {
        "current_page": 2,
        "per_page": 10,
        "total": 156,
        "last_page": 16
    }
}
```

## 🔧 Development nástroje

### Debug endpointy
```bash
# Test INSYS připojení
GET /api/test/mssql-connection

# Test INSYS uživatelských dat
GET /api/test/insys-user

# Test INSYS příkazů
GET /api/test/insys-prikazy

# Test login
POST /api/test/login-test
```

### Symfony Profiler
- **URL:** `/_profiler` (development mode)
- **API profiling:** Automaticky pro všechny API požadavky

## 📚 Současný stav API

### ✅ Implementované endpointy
- **INSYS API:** Plně funkční integrace s MSSQL databází
- **Portal API:** Základní reporty hlášení (GET/POST `/api/portal/report`)
- **Test API:** Debugging a health check endpointy
- **Autentifikace:** Symfony Security s INSYS integrací

### 🚧 Plánované rozšíření
- CMS API pro metodiky, stránky, příspěvky
- File management API
- User management API
- Taxonomy API (kategorie, tagy)

## 🛠️ Postman Collection

```json
{
    "info": {
        "name": "Portál značkaře API",
        "description": "API collection pro development"
    },
    "item": [
        {
            "name": "Login",
            "request": {
                "method": "POST",
                "header": [{"key": "Content-Type", "value": "application/json"}],
                "body": {
                    "raw": "{\"email\":\"admin@portal.local\",\"password\":\"admin123\"}"
                },
                "url": "{{base_url}}/api/insys/login"
            }
        }
    ],
    "variable": [
        {"key": "base_url", "value": "https://portalznackare.ddev.site"}
    ]
}
```

---

**Tip:** Pro aktuální API endpointy použij `bin/console debug:router | grep api`