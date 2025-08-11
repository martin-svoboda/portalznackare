# Správa příkazů - Zobrazení a správa značkařských příkazů

> **Funkcionální oblast** - Kompletní systém pro zobrazení, filtrování a správu značkařských příkazů značkařů KČT

## 📋 Přehled správy příkazů

### Architektura systému
```
INSYZ Příkazy → API → Material React Table → Detail View
      ↓          ↓           ↓                ↓
   Mock/Live   Enrichment  Filtering      Navigation
      Data      Service    + Search       + Actions
```

**Klíčové principy:**
- **Hybrid UI:** Twig pages + React pro tabulky a komplexní UI
- **Material React Table:** Pouze pro datové tabulky s pokročilými funkcemi  
- **INSYZ data:** Načítání příkazů z INSYZ systému přes API
- **Real-time filtering:** Rok, stav, vyhledávání s instant feedback
- **Responsive design:** Desktop i mobilní rozhraní

## 🛠️ Backend Processing Chain

### 1. **InsyzController** - API endpointy s data enrichment

```php
// src/Controller/Api/InsyzController.php
#[Route('/prikazy', methods: ['GET'])]
public function getPrikazy(Request $request): JsonResponse {
    $year = $request->query->get('year');
    $intAdr = $this->getUser()->getIntAdr();
    
    // 1. Načtení raw dat z INSYZ/Mock
    $prikazy = $this->insyzService->getPrikazy($intAdr, $year);
    
    // 2. Obohacení o HTML komponenty  
    $enrichedPrikazy = $this->dataEnricher->enrichPrikazyList($prikazy);
    
    return new JsonResponse($enrichedPrikazy);
}

#[Route('/prikaz/{id}', methods: ['GET'])]
public function getPrikaz(int $id): JsonResponse {
    $intAdr = $this->getUser()->getIntAdr();
    
    // 1. Načtení detailu s authorization check
    $prikaz = $this->insyzService->getPrikaz($intAdr, $id);
    
    // 2. Obohacení o vizuální komponenty
    $enrichedPrikaz = $this->dataEnricher->enrichPrikazDetail($prikaz);
    
    return new JsonResponse($enrichedPrikaz);
}
```

### 2. **InsyzService** - Data loading s testovací/produkční logiku

```php
// src/Service/InsyzService.php
public function getPrikazy(int $intAdr, ?int $year = null): array {
    if ($this->useTestData()) {
        // Testovací data z var/testdata.json
        return $this->getTestData()['prikazy'][$year] ?? [];
    }
    
    // Produkční MSSQL stored procedure
    return $this->connect("trasy.PRIKAZY_SEZNAM", [$intAdr, $year]);
}

public function getPrikaz(int $intAdr, int $id): array {
    // Načte detail + ověří oprávnění INT_ADR
    $result = $this->connect("trasy.ZP_Detail", [$id], true);
    
    return [
        'head' => $result[0][0],     // Hlavička příkazu
        'predmety' => $result[1],    // TIM předměty  
        'useky' => $result[2]        // Úseky tras
    ];
}
```

### 3. **DataEnricherService** - HTML komponenty a ikony

```php
// src/Service/DataEnricherService.php
public function enrichPrikazyList(array $prikazy): array {
    // Nahradí dopravní ikony v popisech (&BUS, &ŽST → HTML)
    return array_map([$this, 'enrichPrikazData'], $prikazy);
}

public function enrichPrikazDetail(array $detail): array {
    // Obohatí předměty o:
    $detail['predmety'] = array_map(function($predmet) {
        $predmet['Znacka_HTML'] = $this->znackaService->znacka(...); // SVG značky
        $predmet['Tim_HTML'] = $this->timService->timPreview(...);   // TIM náhled
        $predmet['Naz_TIM'] = $this->replaceIconsInText(...);        // Dopravní ikony
        return $predmet;
    }, $detail['predmety']);
    
    return $detail;
}
```

### 4. **Kompletní data flow**

```javascript
// Kompletní tok zpracování dat
1. Request: GET /api/insyz/prikazy?year=2025

2. InsyzController::getPrikazy()
   ├── Security: Ověří přihlášeného uživatele
   ├── InsyzService: Načte raw data (mock/MSSQL)
   └── DataEnricherService: Obohatí o HTML komponenty
       ├── replaceIconsInText(&BUS → <span class="transport-icon">🚌</span>)
       └── enrichPrikazData(popis, poznámka)

3. Response: [{
     "ID_Znackarske_Prikazy": 123,
     "Popis_ZP": "Obnova značení <span class=\"transport-icon\">🚌</span> Karlštejn"
   }]

4. React App: Renderuje Material React Table s enriched daty
```

## ⚛️ React Applications

### 1. **Příkazy List** - Material React Table

```jsx
// assets/js/apps/prikazy/App.jsx
const App = () => {
    const [data, setData] = useState([]);
    const [filters, setFilters] = useState({
        year: new Date().getFullYear(),
        jenKeZpracovani: false
    });
    
    const fetchPrikazy = async () => {
        const response = await fetch(`/api/insyz/prikazy?year=${filters.year}`, {
            credentials: 'same-origin'
        });
        const prikazy = await response.json();
        setData(prikazy);
    };
    
    // ...Material React Table konfigurace
};
```

### 2. **Detail příkazu**

```jsx  
// assets/js/apps/prikaz-detail/App.jsx
const App = () => {
    const prikazId = document.querySelector('[data-prikaz-id]')?.dataset.prikazId;
    const [prikaz, setPrikaz] = useState(null);
    
    const loadPrikazDetail = async () => {
        const response = await fetch(`/api/insyz/prikaz/${prikazId}`, {
            credentials: 'same-origin'
        });
        const data = await response.json();
        setPrikaz(data);
    };
    
    // ...render podle typu příkazu
};
```

## 🎨 UI Components

### **Komponenty pro zobrazení**
- **PrikazStavBadge** - barevné stavy s dark mode  
- **PrikazTypeIcon** - Tabler ikony pro typy příkazů
- **Material React Table** - pouze pro datové tabulky s lokalizací

## 🔄 Workflow a navigace

### 1. **Listing workflow**
```javascript
// Návštěvník → /prikazy
1. Twig renderuje page s React kontejnerem
2. React app se inicializuje s data-app="prikazy"
3. Načte data z /api/insyz/prikazy?year=current
4. Zobrazí Material React Table s filtry
5. Click na řádek → navigate do detailu
```

### 2. **Detail workflow**
```javascript
// Návštěvník → /prikaz/{id}
1. Twig renderuje page s data-prikaz-id="{id}"
2. React app načte ID z DOM atributu  
3. Fetch /api/insyz/prikaz/{id}
4. Render detailu podle typu příkazu
5. Akční tlačítka pro další kroky
```

### 3. **Propojení s hlášením**
```javascript
// Z detailu příkazu → hlášení práce
if (isActiveStav(prikaz.Stav_ZP_Naz)) {
    // Zobraz tlačítko "Hlásit práci"
    onClick: () => window.location.href = `/hlaseni-prikazu/${id}`
}
```

## 📊 Data Structure

### INSYZ příkaz response
```json
{
  "ID_Znackarske_Prikazy": 123,
  "Cislo_ZP": "ZP001/2025",
  "Druh_ZP_Kod": "O",
  "Druh_ZP_Naz": "Obnova značení",
  "Stav_ZP_Naz": "Přidělený", 
  "Popis_ZP": "Obnova značení Karlštejn",
  "Znackar": "Jan Novák",
  "Je_Vedouci": true,
  "Vyuctovani": false
}
```

## 🔍 Filtrování a vyhledávání

### **Dostupné filtry:**
- **Rok** - dropdown s posledními lety
- **"Jen ke zpracování"** - checkbox pro aktivní příkazy  
- **Material React Table** - vestavěné filtry a vyhledávání
- **Vizuální zvýraznění** - nezpracované příkazy modře

## 🧪 Testing

```bash
# API testování  
curl "https://portalznackare.ddev.site/api/test/insyz-prikazy?year=2025"
curl "https://portalznackare.ddev.site/api/test/insyz-prikaz/123"
```

## 🛠️ Troubleshooting

### Časté problémy
- **Material React Table** - zkontroluj dark mode detection
- **Filtry** - dependency v useEffect  
- **Navigace** - routing v Symfony pro /prikaz/{id}
- **Data loading** - credentials: 'same-origin' pro API calls

---

**Propojené funkcionality:** [Hlášení příkazů](hlaseni-prikazu.md) | [INSYZ Integration](insyz-integration.md)  
**API Reference:** [../api/insyz-api.md](../api/insyz-api.md)  
**Frontend:** [../architecture.md](../architecture.md)  
**Aktualizováno:** 2025-07-22