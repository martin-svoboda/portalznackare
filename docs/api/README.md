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

### 🏛️ [INSYS API](insys.md)
- **Účel:** Integrace s databází KČT (MSSQL)
- **Base URL:** `/api/insys/`
- **Data:** Příkazy, uživatelé, ceníky z INSYS systému

### 🏠 [Portal API](portal.md) 
- **Účel:** Lokální funkcionalita (PostgreSQL)
- **Base URL:** `/api/portal/`
- **Data:** Metodiky, reporty, soubory, uživatelské nastavení

### 🔐 [Autentifikace](authentication.md)
- **Hybrid systém:** INSYS login + Symfony Security
- **Session management:** Cookie-based
- **Role-based access:** Symfony voters

## 🚀 Rychlé příklady

### Test API připojení
```bash
# Test INSYS API
curl "https://portalznackare.ddev.site/api/insys/user"

# Test Portal API  
curl "https://portalznackare.ddev.site/api/portal/methodologies"
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
// Příkazy z INSYS
const prikazy = await fetch('/api/insys/prikazy?year=2025')
    .then(r => r.json());

// Metodiky z Portal API
const metodiky = await fetch('/api/portal/methodologies')
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
GET /api/test/insys-user

# Test dat
GET /api/test/insys-prikazy

# Health check
GET /api/health
```

### Symfony Profiler
- **URL:** `/_profiler` (development mode)
- **API profiling:** Automaticky pro všechny API požadavky

## 📚 Detailní dokumentace

- **[INSYS API](insys.md)** - Integrace s databází KČT
- **[Portal API](portal.md)** - Lokální funkcionalita
- **[Autentifikace](authentication.md)** - Přihlášení a oprávnění

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