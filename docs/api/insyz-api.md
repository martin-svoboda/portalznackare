# INSYZ API Reference

> **API dokumentace** - Endpointy pro integraci s KČT databází (MSSQL) - příkazy, uživatelé, sazby

## 🏛️ Přehled INSYZ API

**Base URL:** `/api/insyz/`  
**Účel:** Integrace s databází KČT systému pro práci s příkazy, uživateli a sazbami  
**Autentifikace:** Session-based (Symfony Security)  
**Data zdroj:** MSSQL databáze (produkce) nebo test data (development)

### Klíčové funkce
- **Data enrichment:** Automatické obohacování o HTML značky a ikony
- **Test/Production mode:** Přepínání mezi mock daty a live MSSQL
- **Authorization:** Kontrola oprávnění na úrovni příkazů
- **Error handling:** Strukturované chybové odpovědi
- **Audit logging:** Kompletní audit všech INSYZ API volání
- **Performance tracking:** MSSQL procedure timing a cache analytics
- **Cache support:** Intelligent caching pro optimalizaci výkonu

## 📋 Endpointy

### 🔐 POST `/api/insyz/login`

Přihlášení do INSYZ systému (alternativa k Symfony auth).

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

### 👤 GET `/api/insyz/user`

Načte detail aktuálně přihlášeného uživatele z INSYZ.

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

### 📋 GET `/api/insyz/prikazy`

Načte seznam příkazů pro aktuálního uživatele s automatickým obohacováním dat.

**Autentifikace:** Vyžadováno  
**Query parametry:**
- `year` (optional) - Rok pro filtrování (default: aktuální rok)

**Request:**
```bash
GET /api/insyz/prikazy?year=2025
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

### 📖 GET `/api/insyz/prikaz/{id}`

Načte detail konkrétního příkazu s kompletním obohacováním dat o značky a TIM náhledy.

**Autentifikace:** Vyžadováno  
**Path parametry:**
- `id` - ID příkazu (INT_ADR authorization check)

**Request:**
```bash
GET /api/insyz/prikaz/123
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

### 🗺️ GET `/api/insyz/zp-useky/{id}`

Načte úseky (průběh tras přes TIM body) pro daný značkařský příkaz.

**Autentifikace:** Vyžadováno
**Path parametry:**
- `id` - ID značkařského příkazu

**Request:**
```bash
GET /api/insyz/zp-useky/53821
```

**Response:**
```json
[
    {
        "Druh": "Usek",
        "EvCi_Tra": "133604",
        "Kod_ZU": "C",
        "Poradi_odbocky_na_TIM": "0",
        "Poradi_TIM_v_trase": "11",
        "EvCi_TIM": "PS207"
    },
    {
        "Druh": "Odbocka TIM 1",
        "EvCi_Tra": "169221",
        "Kod_ZU": "A",
        "Poradi_odbocky_na_TIM": "1",
        "Poradi_TIM_v_trase": "1",
        "EvCi_TIM": "PS351"
    }
]
```

**Pole:**
| Pole | Popis |
|---|---|
| `Druh` | Typ záznamu (`Usek`, `Odbocka TIM N`) |
| `EvCi_Tra` | Evidenční číslo trasy |
| `Kod_ZU` | Kód značení úseku |
| `Poradi_odbocky_na_TIM` | Pořadí odbočky (`0` = hlavní trasa) |
| `Poradi_TIM_v_trase` | Pořadí TIM bodu v trase |
| `EvCi_TIM` | Evidenční číslo TIM |

**Chyby:**
- `401` - Nepřihlášený uživatel
- `500` - Chyba načítání úseků

---

### 💰 GET `/api/insyz/sazby`

Načte aktuální sazby pro výpočet náhrad (mock data).

**Autentifikace:** Vyžadováno  
**Query parametry:**
- `date` (optional) - Datum pro konkrétní sazby (default: dnes)
- `raw` (dev only) - Vrátí surová data bez obohacení

**Request:**
```bash
GET /api/insyz/sazby?date=2025-01-15
```

**Response:**
```json
{
    "...": "..."
}
```

**Chyby:**
- `401` - Nepřihlášený uživatel
- `500` - Chyba načítání sazeb

---

### 📤 POST `/api/insyz/submit-report`

Odeslání hlášení příkazu do INSYZ systému.

**Autentifikace:** Vyžadováno

**Request:**
```json
{
    "xml_data": "<xml>...</xml>"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Hlášení bylo úspěšně odesláno do INSYZ",
    "result": {...}
}
```

**Chyby:**
- `400` - Chybí parametr xml_data
- `401` - Nepřihlášený uživatel
- `500` - Chyba při odesílání hlášení do INSYZ

---

### ⚙️ GET `/api/insyz/system-parameters`

Získání systémových parametrů z INSYZ.

**Autentifikace:** Vyžadováno

**Response:**
```json
[
    {
        "Nazev_parametru": "MIN_PASSWORD_LENGTH",
        "Hodnota": "8",
        "Popis": "Minimální délka hesla"
    }
]
```

**Chyby:**
- `401` - Nepřihlášený uživatel
- `500` - Chyba načítání parametrů

---

### 🔒 POST `/api/insyz/update-password`

Aktualizace hesla uživatele v INSYZ.

**Autentifikace:** Vyžadováno

**Request:**
```json
{
    "password": "noveHeslo123"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Heslo bylo úspěšně aktualizováno"
}
```

**Chyby:**
- `400` - Chybí parametr password
- `401` - Nepřihlášený uživatel
- `500` - Chyba při aktualizaci hesla

---

## 🔧 Development endpointy

### 📤 POST `/api/insyz/export` 

**Pouze DEV prostředí** - Export dat z API responses do mock souborů.

**Autentifikace:** Vyžadováno  
**Použití:** [INSYZ API Tester](../development/insyz-api-tester.md)

**Request:**
```json
{
    "endpoint": "/api/insyz/user",
    "response": "/* API response data */",
    "params": "/* request parameters */"
}
```

**Response:** `{"success": true, "filename": "4133.json"}`

---

### 📦 POST `/api/insyz/export/batch-prikazy`

**Pouze DEV prostředí** - Hromadný export příkazů včetně jejich detailů a ZP úseků.

Pro každý příkaz ze seznamu se stáhne a uloží:
- detail příkazu → `var/mock-data/api/insyz/prikaz/{id}.json`
- ZP úseky příkazu → `var/mock-data/api/insyz/zp-useky/{id}.json` (prázdný výsledek se neukládá)

Seznam příkazů se ukládá do `var/mock-data/api/insyz/prikazy/{int_adr}-{year}.json`.
Chyba u jednotlivého příkazu export nezastaví.

**Autentifikace:** Vyžadováno  
**Použití:** [INSYZ API Tester](../development/insyz-api-tester.md)

**Request:**
```json
{
    "prikazy": "/* array of commands */",
    "year": 2024
}
```

**Response:** `{"success": true, "message": "Exportováno X příkazů, Y detailů a Z sad ZP úseků", "exported": [...], "metadata_file": "..."}`



## 🧪 Testování

```bash
# Test INSYZ API s audit loggingem
curl -X POST "https://portalznackare.ddev.site/api/insyz/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "hash": "test123"}'

# Zkontrolovat audit log
curl "https://portalznackare.ddev.site/api/insyz-audit-logs?endpoint=/api/insyz/login"
```

---

**Funkcionální dokumentace:** [../features/insyz-integration.md](../features/insyz-integration.md)  
**Audit logging:** [../features/audit-logging.md](../features/audit-logging.md)  
**Admin API:** [admin-api.md](admin-api.md#insyz-audit-api)  
**Development nástroje:** [../development/insyz-api-tester.md](../development/insyz-api-tester.md)  
**Aktualizováno:** 2026-02-14