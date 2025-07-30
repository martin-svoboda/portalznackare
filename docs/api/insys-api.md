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
        "Druh_ZP": "O",
        "Druh_ZP_Naz": "Obnova značení",
        "Stav_ZP_Naz": "Přidělený",
        "Popis_ZP": "Obnova značení <span class=\"transport-icon\">🚌</span> Karlštejn",
        "Znackar": "Jan Novák",
        "Je_Vedouci": true,
        "Vyuctovani": false,
        "Datum_Zadani": "2025-01-15",
        "Datum_Splneni": null
    }
]
```

**Backend processing:**
```php
// 1. InsysService načte raw data
$prikazy = $this->insysService->getPrikazy($intAdr, $year);

// 2. DataEnricherService obohatí data
$enrichedPrikazy = $this->dataEnricher->enrichPrikazyList($prikazy);
// - Nahradí dopravní ikony (&BUS → HTML)
// - Zpracuje texty v Popis_ZP a Poznamka
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
        "Druh_ZP": "O",
        "Druh_ZP_Naz": "Obnova značení",
        "Stav_ZP_Naz": "Přidělený",
        "Popis_ZP": "Obnova značení Karlštejn",
        "Znackar": "Jan Novák",
        "Je_Vedouci": 1
    },
    "predmety": [
        {
            "EvCi_TIM": "1234",
            "Predmet_Index": "A",
            "Druh_Predmetu": "S",
            "Smerovani": "P",
            "Barva_Kod": "CE", 
            "Druh_Presunu": "PZT",
            "Radek1": "Karlštejn",
            "Radek2": "(hrad)",
            "KM1": "2.5",
            "Znacka_HTML": "<svg>...</svg>",
            "Tim_HTML": "<div style=\"...\">TIM náhled</div>",
            "Naz_TIM": "Karlštejn <span class=\"transport-icon\">🏰</span>"
        }
    ],
    "useky": [
        {
            "Nazev_ZU": "Karlštejn - Hrad",
            "Delka_ZU": "2.5",
            "Barva_Kod": "CE",
            "Druh_Presunu": "PZT",
            "Znacka_HTML": "<svg>...</svg>"
        }
    ]
}
```

**Backend processing:**
```php  
// 1. InsysService načte a ověří oprávnění
$prikaz = $this->insysService->getPrikaz($intAdr, $id);
// - Kontrola INT_ADR v response datech
// - Strukturované head/predmety/useky

// 2. DataEnricherService kompletní obohacení
$enriched = $this->dataEnricher->enrichPrikazDetail($prikaz);
// - Znacka_HTML: SVG značky podle Barva_Kod + tvar
// - Tim_HTML: Komplexní TIM náhledy s šipkami
// - Naz_TIM: Dopravní ikony v názvech
// - Úseky: Značky a texty s ikonami
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
    "jizdne": 6,
    "jizdneZvysene": 8,
    "tarifDobaOd1": 0,
    "tarifDobaDo1": 4,
    "tarifStravne1": 0,
    "tarifNahrada1": 0,
    "tarifDobaOd2": 4,
    "tarifDobaDo2": 5,
    "tarifStravne2": 0,
    "tarifNahrada2": 150,
    "tarifDobaOd3": 5,
    "tarifDobaDo3": 8,
    "tarifStravne3": 160,
    "tarifNahrada3": 150,
    "tarifDobaOd4": 8,
    "tarifDobaDo4": 12,
    "tarifStravne4": 160,
    "tarifNahrada4": 300,
    "tarifDobaOd5": 12,
    "tarifDobaDo5": 18,
    "tarifStravne5": 250,
    "tarifNahrada5": 300,
    "tarifDobaOd6": 18,
    "tarifDobaDo6": 24,
    "tarifStravne6": 390,
    "tarifNahrada6": 300,
    "date": "2025-01-15"
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

**Response:**
```json
{
    "success": true,
    "message": "Data byla úspěšně uložena na server",
    "filename": "4133.json",
    "path": "var/mock-data/api/insys/user/4133.json"
}
```

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

**Response:**
```json
{
    "success": true,
    "message": "Exportováno 15 příkazů a 15 detailů",
    "exported": ["Seznam příkazů 2024", "Detaily 15 příkazů"],
    "metadata_file": "batch-export-metadata-2025-01-15-143022.json"
}
```

## 🔧 Backend implementace

### **InsysController** - API vrstva
```php
// src/Controller/Api/InsysController.php
class InsysController extends AbstractController {
    public function __construct(
        private InsysService $insysService,
        private DataEnricherService $dataEnricher
    ) {}
    
    #[Route('/prikazy', methods: ['GET'])]
    public function getPrikazy(Request $request): JsonResponse {
        $user = $this->getUser(); // Symfony Security
        $year = $request->query->get('year');
        
        $prikazy = $this->insysService->getPrikazy($user->getIntAdr(), $year);
        $enriched = $this->dataEnricher->enrichPrikazyList($prikazy);
        
        return new JsonResponse($enriched);
    }
}
```

### **InsysService** - Data layer
```php
// src/Service/InsysService.php  
class InsysService {
    public function getPrikazy(int $intAdr, ?int $year = null): array {
        if ($this->useTestData()) {
            // Mock data z var/testdata.json
            return $this->getTestData()['prikazy'][$year] ?? [];
        }
        
        // Produkční MSSQL stored procedure
        return $this->connect("trasy.PRIKAZY_SEZNAM", [$intAdr, $year]);
    }
    
    public function getPrikaz(int $intAdr, int $id): array {
        // Načte multi-resultset z stored procedure
        $result = $this->connect("trasy.ZP_Detail", [$id], true);
        
        // Ověří oprávnění (INT_ADR v response)
        if (!$this->checkUserAccess($intAdr, $result[0][0])) {
            throw new Exception('Nemáte oprávnění k tomuto příkazu');
        }
        
        return [
            'head' => $result[0][0],      // Hlavička
            'predmety' => $result[1],     // TIM předměty
            'useky' => $result[2]         // Úseky tras
        ];
    }
}
```

### **DataEnricherService** - HTML enrichment
```php
// src/Service/DataEnricherService.php
class DataEnricherService {
    public function enrichPrikazDetail(array $detail): array {
        // Obohacení předmětů
        $detail['predmety'] = array_map(function($predmet) {
            // SVG značka podle barvy a tvaru
            $predmet['Znacka_HTML'] = $this->znackaService->znacka(
                $predmet['Barva_Kod'],
                $predmet['Druh_Odbocky_Kod'] ?? $predmet['Druh_Znaceni_Kod'],
                $predmet['Druh_Presunu'],
                24
            );
            
            // Komplexní TIM náhled
            $predmet['Tim_HTML'] = $this->timService->timPreview($predmet);
            
            // Dopravní ikony v textech
            $predmet['Naz_TIM'] = $this->transportIconService->replaceIconsInText($predmet['Naz_TIM']);
            
            return $predmet;
        }, $detail['predmety']);
        
        return $detail;
    }
}
```

## 🧪 Testování

### **Development endpointy**
```bash
# Test připojení a dat
curl "https://portalznackare.ddev.site/api/test/insys-user"
curl "https://portalznackare.ddev.site/api/test/insys-prikazy"
curl "https://portalznackare.ddev.site/api/test/mssql-connection"

# Test login procesu
curl -X POST "https://portalznackare.ddev.site/api/test/login-test" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "hash": "test123"}'
```

### **Produkční testování**
```bash
# Autentified requests s session cookie
curl -c cookies.txt -X POST "https://portalznackare.ddev.site/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test"}'

curl -b cookies.txt "https://portalznackare.ddev.site/api/insys/prikazy?year=2025"
curl -b cookies.txt "https://portalznackare.ddev.site/api/insys/prikaz/123"
```

## 🛠️ Troubleshooting

### **Chyby připojení**
- Zkontroluj `USE_TEST_DATA=true` v `.env.local`
- Ověř MSSQL connection parametry pro produkci
- Zkontroluj var/testdata.json pro mock data

### **Authorization errors**
- Ověř přihlášení přes `/api/auth/status`
- Zkontroluj INT_ADR matching v příkazech
- Session cookies musí být správně nastavené

### **Data enrichment problémy**
- Zkontroluj DataEnricherService dostupnost
- Ověř služby ZnackaService, TimService, TransportIconService
- Kontrola HTML výstupu v response

---

**Funkcionální dokumentace:** [../features/insys-integration.md](../features/insys-integration.md)  
**API přehled:** [overview.md](overview.md)  
**Development nástroje:** [../development/insys-api-tester.md](../development/insys-api-tester.md)  
**Aktualizováno:** 2025-07-30