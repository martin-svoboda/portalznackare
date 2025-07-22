# API Reference - Přehled

> **API dokumentace** - Kompletní přehled všech API endpointů aplikace Portál značkaře

## 🔗 API Architektura

Aplikace má **hybridní API** architekturu:

```
Frontend (React) → Symfony API → Backend Services
                               ↘ INSYS Database (MSSQL)
                               ↘ Portal Database (PostgreSQL)
```

**Klíčové principy:**
- **Session-based auth:** Symfony Security s INSYS integrací
- **JSON API:** Všechny endpointy vrací JSON response
- **Data enrichment:** Automatické obohacování dat v API vrstvě
- **Test/Production modes:** Přepínání mezi mock a live daty

## 📋 API Skupiny

### 🔐 [Authentication API](authentication-api.md)
- **Base URL:** `/api/auth/`
- **Účel:** Symfony Security autentifikace a session management
- **Endpointy:** status, login, logout

### 🏛️ [INSYS API](insys-api.md) 
- **Base URL:** `/api/insys/`
- **Účel:** Integrace s KČT databází (MSSQL) - příkazy, uživatelé, ceníky
- **Endpointy:** login, user, prikazy, prikaz, ceniky

### 🏠 [Portal API](portal-api.md)
- **Base URL:** `/api/portal/`
- **Účel:** Lokální funkcionalita (PostgreSQL) - reporty, CMS obsah
- **Endpointy:** report, reports/user, reports/statistics, metodika, downloads

### 📁 [File Management API](file-api.md)
- **Base URL:** `/api/portal/files/`
- **Účel:** Upload, správa a serving souborů s hash deduplikací
- **Endpointy:** upload, /{id}, usage tracking

### 🧪 [Test API](test-api.md)
- **Base URL:** `/api/test/`
- **Účel:** Development a debugging endpointy
- **Endpointy:** connection testing, mock data access

## 🚀 Rychlé příklady

### **Přihlášení a základní workflow**
```bash
# 1. Přihlášení
curl -X POST "https://portalznackare.ddev.site/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test"}'

# 2. Kontrola stavu přihlášení
curl "https://portalznackare.ddev.site/api/auth/status"

# 3. Načtení příkazů
curl "https://portalznackare.ddev.site/api/insys/prikazy?year=2025"

# 4. Detail příkazu (s enriched daty)
curl "https://portalznackare.ddev.site/api/insys/prikaz/123"
```

### **File upload workflow**
```javascript
// Upload souboru s metadata
const formData = new FormData();
formData.append('files', file);
formData.append('path', 'reports/2025/praha/1/123');
formData.append('is_public', 'false');

const response = await fetch('/api/portal/files/upload', {
    method: 'POST',
    body: formData,
    credentials: 'same-origin'
});
```

## 📝 API Konvence

### **Response formáty**
```json
// Úspěšná odpověď
{
    "success": true,
    "data": [...],
    "message": "Operation successful"
}

// Chybová odpověď  
{
    "error": "Validation failed",
    "details": {...}
}
```

### **HTTP Status kódy**
- `200` - OK (úspěch)
- `204` - No Content (prázdná odpověď)  
- `400` - Bad Request (chybný požadavek)
- `401` - Unauthorized (nepřihlášený)
- `403` - Forbidden (nemá oprávnění)
- `404` - Not Found (nenalezeno)
- `500` - Internal Server Error (chyba serveru)

### **Autentifikace**
```javascript
// Všechny požadavky vyžadující autentifikaci
fetch('/api/insys/user', {
    credentials: 'same-origin'  // Důležité pro session cookies
});
```

### **Error handling**
```javascript
// Standardní error handling
try {
    const response = await fetch('/api/insys/prikazy');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
} catch (error) {
    console.error('API call failed:', error.message);
}
```

## 🔧 Development Tools

### **Test endpointy**
```bash
# Test připojení INSYS
curl "https://portalznackare.ddev.site/api/test/mssql-connection"

# Test mock dat
curl "https://portalznackare.ddev.site/api/test/insys-prikazy"

# Test login mechanismu
curl -X POST "https://portalznackare.ddev.site/api/test/login-test" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "hash": "test123"}'
```

### **Symfony Profiler**
- **URL:** `/_profiler` (development mode)
- **API profiling:** Automaticky pro všechny API požadavky
- **Debugging:** Výkon, SQL queries, security info

### **Route debugging**
```bash
# Seznam všech API routes
ddev exec bin/console debug:router | grep api

# Detail konkrétní route
ddev exec bin/console debug:router api_insys_prikazy
```

## 📊 Současný stav API

### ✅ **Plně implementované**
- **Authentication API** - Symfony Security integrace s INSYS
- **INSYS API** - Kompletní příkazy, uživatelé, ceníky s data enrichment
- **Portal API** - Reporty hlášení s validací a stavy
- **File Management API** - Upload, hash deduplikace, usage tracking
- **Test API** - Development a debugging nástroje

### 🚧 **TODO implementace**
- CMS API pro správu obsahu (metodiky, downloads)
- Advanced search API
- User management API pro adminy
- Batch operations API
- Export/import API

## 🔗 Detailní dokumentace

- **[Authentication API](authentication-api.md)** - Přihlášení, session management
- **[INSYS API](insys-api.md)** - Příkazy, uživatelé, ceníky z KČT databáze
- **[Portal API](portal-api.md)** - Reporty, statistiky, CMS obsah
- **[File Management API](file-api.md)** - Upload, správa souborů, tracking
- **[Test API](test-api.md)** - Development endpointy

---

**Funkcionální dokumentace:** [../features/](../features/)  
**Aktualizováno:** 2025-07-21