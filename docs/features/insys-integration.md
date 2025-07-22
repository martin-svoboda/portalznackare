# INSYS Integration - Napojení na KČT databázi

> **Funkcionální oblast** - Kompletní systém pro komunikaci s INSYS/MSSQL databází KČT

## 🎯 Přehled funkcionality

INSYS integrace poskytuje přístup k datům KČT systému (příkazy, uživatelé, ceníky) prostřednictvím MSSQL databáze. Systém má dva režimy: **development** s mock daty a **production** s reálným MSSQL připojením.

### Workflow integrace
```
Development: Mock Data → InsysService → API → React
Production:  MSSQL/INSYS → MssqlConnector → InsysService → API → React
```

## 🔧 Backend komponenty

### 1. **InsysService** - Hlavní integrace
```php
// src/Service/InsysService.php
class InsysService {
    public function __construct(
        private MssqlConnector $connector,
        private KernelInterface $kernel
    ) {}
    
    // Dynamické přepínání mezi test/prod daty
    private function useTestData(): bool {
        return $_ENV['USE_TEST_DATA'] ?? false;
    }
    
    // Hlavní metody
    public function loginUser(string $email, string $hash): int;
    public function getUser(int $intAdr): array;
    public function getPrikazy(int $intAdr, ?int $year = null): array;
    public function getPrikaz(int $intAdr, int $id): array;
}
```

### 2. **MockMSSQLService** - Development mock
```php
// src/Service/MockMSSQLService.php  
class MockMSSQLService {
    // Čte test data z var/testdata.json
    private function getTestData(): array {
        if ($this->testData === null) {
            $file = $this->projectDir . '/var/testdata.json';
            $this->testData = json_decode(file_get_contents($file), true);
        }
        return $this->testData;
    }
    
    // Mock implementace stejných metod jako InsysService
    public function getPrikazy(int $intAdr, ?int $year = null): array;
    public function getUserByIntAdr(string $intAdr): ?array;
}
```

### 3. **MssqlConnector** - Production databáze
```php
// src/Service/MssqlConnector.php
class MssqlConnector {
    // PDO připojení k MSSQL serveru
    public function callProcedure(string $procedure, array $args): array;
    public function callProcedureMultiple(string $procedure, array $args): array;
    
    // Používá INSYS stored procedures:
    // - trasy.WEB_Login
    // - trasy.ZNACKAR_DETAIL  
    // - trasy.PRIKAZY_SEZNAM
    // - trasy.ZP_Detail
}
```

### 4. **DataEnricherService** - Obohacování dat
```php
// src/Service/DataEnricherService.php
class DataEnricherService {
    public function __construct(
        private ZnackaService $znackaService,
        private TimService $timService,
        private TransportIconService $transportIconService
    ) {}
    
    // Přidá HTML/SVG komponenty k INSYS datům
    public function enrichPrikazyList(array $prikazy): array;
    public function enrichPrikazDetail(array $detail): array;
}
```

## 🌐 API endpointy

### INSYS API Controller
```php
// src/Controller/Api/InsysController.php
#[Route('/api/insys')]
class InsysController extends AbstractController {
    
    #[Route('/login', methods: ['POST'])]
    public function login(Request $request): JsonResponse;
    // POST /api/insys/login
    // Body: {"email": "test@test.com", "hash": "test123"}
    
    #[Route('/user', methods: ['GET'])]  
    public function getInsysUser(Request $request): JsonResponse;
    // GET /api/insys/user (vyžaduje přihlášení)
    
    #[Route('/prikazy', methods: ['GET'])]
    public function getPrikazy(Request $request): JsonResponse;
    // GET /api/insys/prikazy?year=2025
    
    #[Route('/prikaz/{id}', methods: ['GET'])]
    public function getPrikaz(Request $request, int $id): JsonResponse;
    // GET /api/insys/prikaz/12345
}
```

## 📊 Data struktury

### Test data (var/testdata.json)
```json
{
    "user": [{
        "INT_ADR": "1234",
        "Jmeno": "Jan", 
        "Prijmeni": "Novák",
        "eMail": "test@example.com",
        "Kod_KKZ": "S",
        "Kraj": "Středočeský kraj a Praha",
        "Vedouci_dvojice": "1",
        "Prukaz_znackare": "1234-P"
    }],
    "prikazy": {
        "2024": [{
            "ID_Znackarske_Prikazy": "12345",
            "Cislo_ZP": "S/BN/J/24001",
            "Druh_ZP_Naz": "Jiná činnost",
            "Stav_ZP_Naz": "Předaný KKZ",
            "Popis_ZP": "Proveďte průzkum tras v oblasti &BUS zastávek"
        }]
    },
    "detaily": {
        "12345": {
            "head": [/* hlavička příkazu */],
            "predmety": [/* předměty s TIM daty */],
            "useky": [/* úseky trasy - jen u obnovy TZT */]
        }
    }
}
```

### INSYS stored procedures

#### WEB_Login
```sql
EXEC trasy.WEB_Login @Email='email@example.com', @WEBPwdHash='hashedPassword'
-- Vrací: INT_ADR pokud úspěch, jinak prázdný result
```

#### ZNACKAR_DETAIL  
```sql
EXEC trasy.ZNACKAR_DETAIL @INT_ADR=1234
-- Vrací: Kompletní data značkaře
```

#### PRIKAZY_SEZNAM
```sql
EXEC trasy.PRIKAZY_SEZNAM @INT_ADR=1234, @Rok=2025
-- Vrací: Seznam příkazů pro značkaře v daném roce
```

#### ZP_Detail
```sql
EXEC trasy.ZP_Detail @ID_Znackarske_Prikazy=12345
-- Vrací: Detailní data příkazu včetně předmětů a TIM dat
```

## 🔄 Development vs Production

### Environment konfigurace
```bash
# .env.local (development)
USE_TEST_DATA=true
# Databázové připojení není potřeba

# .env.local (production)  
USE_TEST_DATA=false
INSYS_DB_HOST=insys.server.com
INSYS_DB_NAME=INSYS_DATABASE
INSYS_DB_USER=portal_user
INSYS_DB_PASS=secure_password
```

### Automatické přepínání
```php
// InsysService automaticky detekuje režim
public function getPrikazy(int $intAdr, ?int $year = null): array {
    if ($this->useTestData()) {
        // Mock data z testdata.json
        $data = $this->getTestData();
        return $data['prikazy'][$year] ?? [];
    }
    
    // Reálný MSSQL call  
    return $this->connect("trasy.PRIKAZY_SEZNAM", [$intAdr, $year ?? date('Y')]);
}
```

## 🎨 Data enrichment

### Server-side HTML generování
```php
// DataEnricherService přidá HTML komponenty
public function enrichPrikazDetail(array $detail): array {
    foreach ($detail['predmety'] as &$predmet) {
        // SVG značky generované server-side
        $predmet['Znacka_HTML'] = $this->znackaService->renderZnacka(
            $predmet['Barva_Znacky'],
            $predmet['Tvar_Znacky'],
            $predmet['Presun'], 
            24
        );
        
        // TIM náhledy jako HTML
        $predmet['Tim_HTML'] = $this->timService->timPreview($predmet);
        
        // Transport ikony v textu (&BUS → HTML ikona)
        $predmet['Popis'] = $this->transportIconService->replaceIconsInText(
            $predmet['Popis']
        );
    }
    return $detail;
}
```

### React consumption
```javascript
// React používá server-generované HTML
const columns = [
    {
        accessorKey: 'Znacka_HTML',
        header: 'Značka',
        Cell: ({ cell }) => (
            <span dangerouslySetInnerHTML={{__html: cell.getValue()}} />
        )
    },
    {
        accessorKey: 'Popis_ZP', 
        header: 'Popis',
        Cell: ({ cell }) => {
            const text = cell.getValue();
            // Pokud obsahuje HTML tagy (z server processing), render jako HTML
            if (text.includes('<')) {
                return <span dangerouslySetInnerHTML={{__html: text}} />;
            }
            return text;
        }
    }
];
```

## 🛠️ Troubleshooting

### Časté problémy

#### 1. **TEST_DATA není načítána**
```bash
# Zkontroluj environment
echo $USE_TEST_DATA
# Mělo by vrátit: true

# Zkontroluj existenci testdata.json
ls -la var/testdata.json

# Test API call (použij testovací endpoint)
curl "https://portalznackare.ddev.site/api/test/insys-prikazy"
```

#### 2. **MSSQL připojení selhává**
```php
// Debug MSSQL connection
try {
    $result = $this->connector->callProcedure("trasy.WEB_Login", [
        '@Email' => 'test@example.com',
        '@WEBPwdHash' => 'hash'
    ]);
    dump($result);
} catch (\Exception $e) {
    dump('MSSQL Error: ' . $e->getMessage());
}
```

#### 3. **API vrací prázdná data**
```javascript
// Debug API response (použij testovací endpoint)
fetch('/api/test/insys-prikazy')
.then(response => {
    console.log('Status:', response.status);
    return response.json();
})
.then(data => {
    console.log('API Data:', data);
    if (Array.isArray(data) && data.length === 0) {
        console.warn('Empty data - zkontroluj rok nebo přihlášení');
    }
});
```

#### 4. **Chybí HTML komponenty v datech**
```php
// Zkontroluj že DataEnricherService je volán
public function getPrikazy(Request $request): JsonResponse {
    $prikazy = $this->insysService->getPrikazy($user->getIntAdr(), $year);
    
    // DŮLEŽITÉ: Enrichment pro HTML komponenty
    $enrichedPrikazy = $this->dataEnricher->enrichPrikazyList($prikazy);
    
    return new JsonResponse($enrichedPrikazy);
}
```

## 🔒 Security considerations

### 1. **SQL Injection protection**
```php
// MssqlConnector používá prepared statements
$stmt = $this->pdo->prepare("EXEC trasy.PRIKAZY_SEZNAM ?, ?");
$stmt->execute([$intAdr, $year]);
```

### 2. **Access control**
```php  
// API endpointy vyžadují přihlášení
public function getPrikazy(Request $request): JsonResponse {
    $user = $this->getUser();
    if (!$user instanceof User) {
        return new JsonResponse(['error' => 'Unauthorized'], 401);
    }
    
    // Uživatel vidí pouze své příkazy
    $prikazy = $this->insysService->getPrikazy($user->getIntAdr(), $year);
}
```

### 3. **Credential handling**
```bash
# Production credentials v environment
INSYS_DB_HOST=secure.server.com
INSYS_DB_USER=limited_user  # Ne admin account
INSYS_DB_PASS=complex_secure_password

# Nikdy v kódu:
# ❌ $password = 'hardcoded_password';
```

---

**Data Flow:** [../architecture/data-flow.md](../architecture/data-flow.md)  
**API Reference:** [../api/insys-api.md](../api/insys-api.md)  
**Configuration:** [../configuration/environment.md](../configuration/environment.md)  
**Aktualizováno:** 2025-07-21