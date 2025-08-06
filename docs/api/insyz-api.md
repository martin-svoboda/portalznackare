# INSYS API Reference

> **API dokumentace** - Endpointy pro integraci s KČT databází (MSSQL) - příkazy, uživatelé, ceníky

## 🏛️ Přehled INSYS API

**Base URL:** `/api/insys/`  
**Účel:** Integrace s databází KČT systému pro práci s příkazy, uživateli a ceníky  
**Autentifikace:** Session-based (Symfony Security)  
**Data zdroj:** MSSQL databáze (produkce) nebo test data (development)

### Klíčové funkce
- **Data enrichment:** Automatické obohacování o HTML značky a ikony
- **Test/Production mode:** Přepínání mezi mock daty a live MSSQL
- **Authorization:** Kontrola oprávnění na úrovni příkazů
- **Error handling:** Strukturované chybové odpovědi

## 📋 Endpointy

### 🔐 POST `/api/insys/login`

Přihlášení do INSYS systému (alternativa k Symfony auth).

**Request:**
```json
{
    "email": "test@test.com",
    "hash": "test123"
}
```

**Response:**
```json
{
    "success": true,
    "int_adr": 1234
}
```

**Chyby:**
- `400` - Chybí parametry email/hash
- `401` - Neplatné přihlašovací údaje

---

### 👤 GET `/api/insys/user`

Načte detail aktuálně přihlášeného uživatele z INSYS.

**Autentifikace:** Vyžadováno  

**Response:**
```json
{
    "INT_ADR": 1234,
    "JMENO": "Test",
    "PRIJMENI": "Značkař",
    "EMAIL": "test@test.com",
    "roles": ["ROLE_USER"]
}
```

**Chyby:**
- `401` - Nepřihlášený uživatel
- `500` - Chyba načítání uživatele

---

### 📋 GET `/api/insys/prikazy`

Načte seznam příkazů pro aktuálního uživatele s automatickým obohacováním dat.

**Autentifikace:** Vyžadováno  
**Query parametry:**
- `year` (optional) - Rok pro filtrování (default: aktuální rok)

**Request:**
```bash
GET /api/insys/prikazy?year=2025
```

**Response:**
```json
[
    {
        "ID_Znackarske_Prikazy": 123,
        "Cislo_ZP": "ZP001/2025",
        "Druh_ZP_Naz": "Obnova značení",
        "Stav_ZP_Naz": "Přidělený",
        "Popis_ZP": "Obnova značení <span class=\"transport-icon\">🚌</span> Karlštejn",
        "...": "..."
    }
]
```

**Chyby:**
- `401` - Nepřihlášený uživatel
- `500` - Chyba načítání příkazů

---

### 📖 GET `/api/insys/prikaz/{id}`

Načte detail konkrétního příkazu s kompletním obohacováním dat o značky a TIM náhledy.

**Autentifikace:** Vyžadováno  
**Path parametry:**
- `id` - ID příkazu (INT_ADR authorization check)

**Request:**
```bash
GET /api/insys/prikaz/123
```

**Response:**
```json
{
    "head": {
        "ID_Znackarske_Prikazy": 123,
        "Cislo_ZP": "ZP001/2025",
        "Druh_ZP_Naz": "Obnova značení",
        "...": "..."
    },
    "predmety": [
        {
            "EvCi_TIM": "1234",
            "Barva_Kod": "CE",
            "Znacka_HTML": "<svg>...</svg>",
            "Tim_HTML": "<div>...</div>",
            "...": "..."
        }
    ],
    "useky": ["..."]
}
```

**Chyby:**
- `401` - Nepřihlášený uživatel  
- `403` - Příkaz nepatří uživateli (INT_ADR check)
- `404` - Příkaz nenalezen
- `500` - Chyba načítání detailu

---

### 💰 GET `/api/insys/ceniky`

Načte aktuální ceníky pro výpočet náhrad (mock data).

**Autentifikace:** Vyžadováno  
**Query parametry:**
- `date` (optional) - Datum pro konkrétní ceník (default: dnes)
- `raw` (dev only) - Vrátí surová data bez obohacení

**Request:**
```bash
GET /api/insys/ceniky?date=2025-01-15
```

**Response:**
```json
{
    "...": "..."
}
```

**Chyby:**
- `401` - Nepřihlášený uživatel
- `500` - Chyba načítání ceníků

---

## 🔧 Development endpointy

### 📤 POST `/api/insys/export` 

**Pouze DEV prostředí** - Export dat z API responses do mock souborů.

**Autentifikace:** Vyžadováno  
**Použití:** [INSYS API Tester](../development/insys-api-tester.md)

**Request:**
```json
{
    "endpoint": "/api/insys/user",
    "response": "/* API response data */",
    "params": "/* request parameters */"
}
```

**Response:** `{"success": true, "filename": "4133.json"}`

---

### 📦 POST `/api/insys/export/batch-prikazy`

**Pouze DEV prostředí** - Hromadný export příkazů včetně jejich detailů.

**Autentifikace:** Vyžadováno  
**Použití:** [INSYS API Tester](../development/insys-api-tester.md)

**Request:**
```json
{
    "prikazy": "/* array of commands */",
    "year": 2024
}
```

**Response:** `{"success": true, "exported": [...], "metadata_file": "..."}`


## 🧪 Testování

```bash
# Test s autentizací
curl -X POST "https://portalznackare.ddev.site/api/insys/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "hash": "test123"}'
```

---

**Funkcionální dokumentace:** [../features/insys-integration.md](../features/insys-integration.md)  
**API přehled:** [overview.md](overview.md)  
**Development nástroje:** [../development/insys-api-tester.md](../development/insys-api-tester.md)  
**Aktualizováno:** 2025-07-31