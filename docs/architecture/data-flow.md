# Data Flow - Tok dat aplikací

> **Architekturní dokumentace** - Jak proudí data od INSYS databáze přes Symfony API až do React komponent

## 🌊 Přehled toku dat

```
MSSQL/INSYS ←→ InsysService ←→ API Controller ←→ DataEnricher ←→ JSON API ←→ React App
     ↑              ↑               ↑               ↑            ↑         ↑
   External      Business        REST API        Server-side   HTTP      Client
  Database        Logic          Endpoint        HTML/SVG    Response   Rendering
```

## 📊 Podrobný tok dat

### 1. **INSYS/MSSQL → InsysService**

#### Development (USE_TEST_DATA=true)
```php
// MockMSSQLService.php
public function getPrikazy(int $intAdr, ?int $year = null): array 
{
    // Čte test data z var/testdata.json
    $data = $this->getTestData();
    return $data['prikazy'][$year ?? '2024'] ?? [];
}
```

#### Production (USE_TEST_DATA=false)
```php
// InsysService.php  
public function getPrikazy(int $intAdr, ?int $year = null): array
{
    // Připojuje se k reálné MSSQL INSYS databázi
    return $this->mssqlConnector->query(
        'SELECT * FROM znackarske_prikazy WHERE INT_ADR = ? AND rok = ?',
        [$intAdr, $year]
    );
}
```

### 2. **InsysService → API Controller**

```php
// src/Controller/Api/InsysController.php
#[Route('/api/insys/prikazy')]
public function getPrikazy(Request $request): JsonResponse
{
    $user = $this->getUser(); // Symfony Security
    $year = $request->query->get('year');
    
    try {
        // 1. Získá raw data z INSYS
        $prikazy = $this->insysService->getPrikazy($user->getIntAdr(), $year);
        
        // 2. Obohatí o HTML/SVG komponenty
        $enrichedPrikazy = $this->dataEnricher->enrichPrikazyList($prikazy);
        
        // 3. Vrátí JSON
        return new JsonResponse($enrichedPrikazy);
    } catch (Exception $e) {
        return new JsonResponse(['error' => $e->getMessage()], 500);
    }
}
```

### 3. **DataEnricherService - Server-side HTML generování**

```php
// src/Service/DataEnricherService.php
public function enrichPrikazDetail(array $detail): array
{
    // Obohatí každý předmět o HTML komponenty
    foreach ($detail['predmety'] as &$predmet) {
        // Server generuje SVG značky
        $predmet['Znacka_HTML'] = $this->znackaService->renderZnacka(
            $predmet['Barva_Znacky'],
            $predmet['Tvar_Znacky'], 
            $predmet['Presun'],
            24
        );
        
        // Server generuje TIM náhledy
        $predmet['Tim_HTML'] = $this->timService->timPreview($predmet);
        
        // Nahradí transport ikony v textu
        $predmet['Popis'] = $this->transportIconService->replaceIconsInText(
            $predmet['Popis']
        );
    }
    
    return $detail;
}
```

### 4. **JSON API → React App**

```javascript
// assets/js/apps/prikazy/App.jsx
const App = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        // Fetch ze Symfony API
        fetch('/api/insys/prikazy?year=2025', {
            credentials: 'same-origin'  // Symfony session auth
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            setData(data);
            setLoading(false);
        })
        .catch(error => {
            console.error('API Error:', error);
            setError(error.message);
        });
    }, []);
    
    return (
        <MaterialReactTable
            data={data}
            columns={columns}
        />
    );
};
```

## 🔄 Specifické data flow scénáře

### Scenario 1: **Zobrazení seznamu příkazů**

```
1. User → /prikazy (Twig route)
2. Twig template → <div data-app="prikazy">
3. React mount → fetch('/api/insys/prikazy?year=2025')
4. InsysController → insysService->getPrikazy(user.intAdr, 2025)
5. InsysService → MockMSSQLService nebo MSSQL query
6. DataEnricher → enrichPrikazyList() - přidá HTML ikony
7. JSON Response → [{Popis_ZP: "Text s &BUS ikonami"}, ...]
8. React renders → Material React Table s server HTML
```

### Scenario 2: **Detail příkazu s TIM náhledy**

```
1. User → /prikaz/12345 (Twig route s ID param)
2. Twig template → <div data-app="prikaz-detail" data-prikaz-id="12345">
3. React mount → reads data-prikaz-id, fetch('/api/insys/prikaz/12345')
4. InsysController → insysService->getPrikaz(12345)
5. DataEnricher → enrichPrikazDetail() 
   - ZnackaService generuje SVG značky
   - TimService generuje TIM HTML náhledy
   - TransportIconService nahrazuje &BUS, &VLAK ikony
6. JSON Response → {predmety: [{Tim_HTML: "<div>...</div>", Znacka_HTML: "<svg>...</svg>"}]}
7. React → dangerouslySetInnerHTML server HTML
```

### Scenario 3: **Hlášení příkazu s file upload**

```
1. User → /prikaz/12345/hlaseni (Twig route)
2. React App → fetch('/api/insys/prikaz/12345') pro základní data
3. User uploads file → FormData POST /api/portal/files/upload
4. FileUploadService → hash calculation, storage, FileAttachment entity
5. User submits hlášení → POST /api/portal/report
6. ReportController → creates/updates Report entity
7. CompensationCalculator → calculates odměny based on form data
8. JSON Response → {success: true, reportId: 456, calculation: {...}}
```

## 🔒 Authentication flow

### Session-based autentifikace

```php
// Symfony Security workflow
1. User → POST /api/insys/login {email, password}
2. InsysAuthenticator → InsysService->loginUser()
3. InsysUserProvider -> loadUser() - načte User object z INSYS
4. Symfony vytvoří authenticated session
5. Subsequent API calls → automaticky authorized via session
6. React apps → credentialsové 'same-origin' pro session cookies
```

```javascript
// React autentifikace check
useEffect(() => {
    fetch('/api/auth/status', {
        credentials: 'same-origin'
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/dashboard'; // Redirect k přihlášení
        }
    });
}, []);
```

## 🎨 Visual component data flow

### Server-side HTML/SVG generování

```php
// TODO: Implementovat server-side SVG generování
// ZnackaService - generuje SVG server-side (PLÁNOVÁNO)
public function renderZnacka(string $barva, string $tvar, string $presun, int $size): string
{
    return sprintf(
        '<svg width="%d" height="%d" viewBox="0 0 24 24">%s</svg>',
        $size, $size,
        $this->generateZnackaPath($barva, $tvar, $presun)
    );
}

// TimService - základní TIM processing (zjednodušeno)
public function timPreview(array $predmet): string
{
    // Poznámka: Skutečné TIM zpracování je složitější
    // než tento příklad - vyžaduje komplexní parsing TIM dat
    return '<div class="tim-preview">TIM náhled pro predmet</div>';
}
```

```javascript
// React - konsumuje server HTML
const renderServerContent = (htmlString) => {
    return <span dangerouslySetInnerHTML={{__html: htmlString}} />;
};

// V MaterialReactTable columns
{
    accessorKey: 'Znacka_HTML',
    header: 'Značka',
    Cell: ({ cell }) => renderServerContent(cell.getValue())
}
```

## 🔧 Error handling flow

### API Error propagation

```php
// Controller level
try {
    $data = $this->insysService->getPrikazy($intAdr, $year);
    return new JsonResponse($data);
} catch (Exception $e) {
    return new JsonResponse([
        'error' => $e->getMessage(),
        'code' => $e->getCode()
    ], 500);
}
```

```javascript
// React level
.catch(error => {
    console.error('API Error:', error);
    if (error.message.includes('401')) {
        // Redirect to login
        window.location.href = '/dashboard';
    } else {
        // Show user friendly error
        setError('Nepodařilo se načíst data. Zkuste to znovu.');
    }
});
```

## 📊 Performance optimalizace

### Performance optimalizace (TODO - není implementováno)

**Plánované optimalizace:**

### 1. **Data caching** (TODO)
```php
// TODO: Implementovat Redis/memory cache
$cacheKey = "prikazy_user_{$intAdr}_year_{$year}";
if ($cached = $this->cache->get($cacheKey)) {
    return $cached;
}
```

### 2. **Selective data loading** (TODO) 
```javascript
// TODO: Lazy loading komponent
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// TODO: Conditional API calls
if (user.isLeader) {
    fetch('/api/insys/team-data');
}
```

### 3. **Server-side optimization** (TODO)
```php
// TODO: Batch processing optimalizace
$enrichedPredmety = array_map(function($predmet) {
    return $this->dataEnricher->enrichPredmet($predmet);
}, $predmety);
```

---

**Principles:** [principles.md](principles.md)  
**Hybrid Architecture:** [hybrid-architecture.md](hybrid-architecture.md)  
**INSYS Integration:** [../features/insys-integration.md](../features/insys-integration.md)  
**API Reference:** [../api/overview.md](../api/overview.md)  
**Aktualizováno:** 2025-07-21