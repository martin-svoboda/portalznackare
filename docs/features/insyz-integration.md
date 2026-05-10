# INSYZ Integration - Napojení na KČT databázi

> **Funkcionální oblast** - Kompletní systém pro komunikaci s INSYZ/MSSQL databází KČT

## 🎯 Přehled funkcionality

INSYZ integrace poskytuje přístup k datům KČT systému (příkazy, uživatelé, sazby) prostřednictvím MSSQL databáze. Systém má dva režimy: **development** s mock daty a **production** s reálným MSSQL připojením.

### Workflow integrace
```
Development: Mock Data → InsyzService → API → React
Production:  MSSQL/INSYZ → MssqlConnector → InsyzService → API → React
```

## 🔧 Backend komponenty

### 1. **InsyzService** - Hlavní integrace (čisté bez auditu)
```php
// src/Service/InsyzService.php  
class InsyzService {
    public function __construct(
        private MssqlConnector $connector,
        private KernelInterface $kernel,
        private ApiCacheService $cacheService  // NOVÉ: Cache optimalizace
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
    
    // Mock implementace stejných metod jako InsyzService
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
    
    // Používá INSYZ stored procedures:
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
    
    // Přidá HTML/SVG komponenty k INSYZ datům
    public function enrichPrikazyList(array $prikazy): array;
    public function enrichPrikazDetail(array $detail): array;
}
```

## 🌐 API endpointy

### INSYZ API Controller + Audit Logging
```php
// src/Controller/Api/InsyzController.php
#[Route('/api/insyz')]
class InsyzController extends AbstractController {
    public function __construct(
        private InsyzService $insyzService,
        private InsyzAuditLogger $auditLogger  // NOVÉ: INSYZ API audit
    ) {}
    
    #[Route('/login', methods: ['POST'])]
    public function login(Request $request): JsonResponse;
    // POST /api/insyz/login + MSSQL audit log
    
    #[Route('/user', methods: ['GET'])]  
    public function getInsyzUser(Request $request): JsonResponse;
    // GET /api/insyz/user + performance tracking
    
    #[Route('/prikazy', methods: ['GET'])]
    public function getPrikazy(Request $request): JsonResponse;
    // GET /api/insyz/prikazy + cache analytics
    
    #[Route('/prikaz/{id}', methods: ['GET'])]
    public function getPrikaz(Request $request, int $id): JsonResponse;
    // GET /api/insyz/prikaz/{id} + MSSQL procedure logging
    
    #[Route('/submit-report', methods: ['POST'])]
    public function submitReport(Request $request): JsonResponse;
    // POST /api/insyz/submit-report + kompletní audit trail
}

// "Jeden log na proces" architektura:
// Každý endpoint = právě 1 audit log (success XOR error)
```

### INSYZ Audit Logging System
```php
// Automatické audit logování všech INSYZ API volání
class InsyzAuditLogger {
    // Loguje do insyz_audit_logs tabulky:
    // - Endpoint + HTTP metoda
    // - MSSQL procedure name a timing
    // - Request params (sanitized) 
    // - Response metadata (bez citlivých dat)
    // - Cache hit/miss
    // - Performance metrics
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

### INSYZ stored procedures

#### WEB_Login
```sql
EXEC trasy.WEB_Login @Email='email@example.com', @WEBPwdHash='hashedPassword'
-- Vrací jeden řádek se sjednocenou strukturou (i při neúspěchu):
--   INT_ADR (NULL při chybě), Email_nalezen, Heslo_se_shoduje, WEBUser,
--   Zablokovano, Platnost, Platnost_DO, KontrolaPlatnostiPwdWEB
-- Detail: docs/api/insyz-stored-procedures.md a docs/features/authentication.md
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
INSYZ_DB_HOST=insyz.server.com
INSYZ_DB_NAME=INSYZ_DATABASE
INSYZ_DB_USER=portal_user
INSYZ_DB_PASS=secure_password
```

### Automatické přepínání
```php
// InsyzService automaticky detekuje režim
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

## 🚀 Performance Cache System

### Cache architektura pro INSYZ data
**Implementace:** `ApiCacheService` s inteligentní cache strategií pro optimalizaci MSSQL dotazů.

#### Cache layer workflow:
```
Frontend Request → InsyzController → InsyzService → ApiCacheService
                                                         ↓
                                                  Cache HIT/MISS
                                                         ↓
                                                 INSYZ/MSSQL (jen při miss)
```

#### TTL strategie per data type:
```php
// Cache lifetimes optimalizované pro usage patterns
private const CACHE_TTL_PRIKAZY_LIST = 300;    // 5 minut - seznam příkazů
private const CACHE_TTL_PRIKAZ_DETAIL = 120;   // 2 minuty - detail příkazu  
private const CACHE_TTL_USER_DATA = 1800;      // 30 minut - uživatelská data
private const CACHE_TTL_SAZBY = 3600;         // 1 hodina - sazby
```

#### Cache keys struktura:
```php
// Unikátní keys per user/data type
$cacheKey = sprintf('api.prikazy.%d.%d', $intAdr, $year ?? date('Y'));
$cacheKey = sprintf('api.prikaz.%d.%d', $intAdr, $prikazId);
$cacheKey = sprintf('api.user.%d', $intAdr);
```

#### Cache invalidation patterns:
```php
// Manuální invalidace při změnách dat
$this->cacheService->invalidateUserCache($intAdr);        // Celá user cache
$this->cacheService->invalidatePrikazCache($intAdr, $id); // Konkrétní příkaz
```

#### Expected performance improvements:
- **MSSQL load reduction**: -70% (cached responses)
- **Response time improvement**: -50% (cache hits)
- **Concurrent user capacity**: 50 users (s cache bufferem)

### Monitoring a Performance Tracking

#### API Monitoring Service
```php  
// Comprehensive request monitoring
$this->monitoring->logApiRequest(
    $request, $user, $startTime, $responseData, $errorMessage
);

// MSSQL query monitoring
$this->monitoring->logMssqlQuery(
    $procedure, $params, $startTime, $resultCount, $error
);
```

#### Monitored performance metrics:
- **Response times** s automatickým upozorněním na >2s requesty
- **MSSQL query timing** s detekcí >5s slow queries
- **Cache hit/miss ratios** pro cache optimalizaci
- **Suspicious activity detection** (rapid requests, repeated calls)
- **Error rate tracking** pro stability monitoring

#### Logging destinations:
- **Development**: `/var/log/api.log` (human readable format)
- **Production**: Structured JSON logs pro external monitoring
- **Audit integration**: Critical API calls v `audit_logs` tabulce

## 🛠️ Troubleshooting

### Performance debugging

#### 1. **Cache performance check**
```bash
# Zkontroluj cache hits/misses v logách
tail -f var/log/api.log | grep "Cache MISS"

# Redis cache status (produkce)
redis-cli info stats

# Filesystem cache size (development)  
du -sh var/cache/
```

#### 2. **Slow query detection**
```bash
# Najdi pomalé MSSQL queries
grep "Slow MSSQL Query" var/log/api.log

# API response time monitoring
grep "duration_ms" var/log/api.log | grep -E "duration_ms\":[0-9]{4,}"
```

### Connection troubleshooting

#### 1. **TEST_DATA není načítána**
```bash
# Zkontroluj environment
echo $USE_TEST_DATA
# Mělo by vrátit: true

# Zkontroluj existenci testdata.json
ls -la var/testdata.json

# Test API call (použij testovací endpoint)
curl "https://portalznackare.ddev.site/api/test/insyz-prikazy"
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
fetch('/api/test/insyz-prikazy')
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
    $prikazy = $this->insyzService->getPrikazy($user->getIntAdr(), $year);
    
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
    $prikazy = $this->insyzService->getPrikazy($user->getIntAdr(), $year);
}
```

### 3. **Credential handling**
```bash
# Production credentials v environment
INSYZ_DB_HOST=secure.server.com
INSYZ_DB_USER=limited_user  # Ne admin account
INSYZ_DB_PASS=complex_secure_password

# Nikdy v kódu:
# ❌ $password = 'hardcoded_password';
```

---

**Data Flow:** [../architecture.md](../architecture.md) - Cache a monitoring architektura  
**API Reference:** [../api/insyz-api.md](../api/insyz-api.md)  
**Configuration:** [../configuration.md](../configuration.md) - Redis + Monolog setup  
**Development nástroje:** [../development/insyz-api-tester.md](../development/insyz-api-tester.md)  
**Monitoring:** [../development/development.md](../development/development.md) - Performance debugging  
**Aktualizováno:** 2025-08-08