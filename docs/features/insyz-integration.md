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

### 1. **InsyzService** - Hlavní integrace (`src/Service/InsyzService.php`)
- Závislosti: `MssqlConnector`, `KernelInterface`, `ApiCacheService`, `InsyzAuditLogger`, `TokenStorageInterface`
- Přepínání režimu: `useTestData()` → `$_ENV['USE_TEST_DATA'] === 'true'`
- `connect($procedure, $args, $multiple)` – volání procedury přes `MssqlConnector` + zápis do INSYZ auditu
- `getTestData($endpoint, $params)` – mock data z `var/mock-data/api/insyz/{endpoint}.json`
  (fallback `{endpoint}/data.json`), také zapisuje audit (procedura `TEST_DATA`)
- Veřejné metody: `loginUser()`, `getUser()`, `getUserForTeam()`, `getUserHeader()`, `getPrikazy()`,
  `getPrikaz($intAdr, $id, $skipOwnerCheck)`, `getSazby()`, `getZpUseky()`, `submitReportToInsyz()`,
  `updatePassword()`, `getSystemParameters()`, `validatePasswordStrength()`, `createPasswordHash()`

### 2. **Mock data (USE_TEST_DATA=true)**
Samostatná mock služba neexistuje – režim řeší přímo `InsyzService::getTestData()`. Soubory:
```
var/mock-data/api/insyz/
├── user/{int_adr}.json
├── prikazy/{int_adr}-{rok}.json
├── prikaz/{id}.json
├── zp-useky/{id}.json
├── sazby/sazby.json
├── system-parameters/…
└── web-zapis-pwd/…
```
Generují se exportem z [INSYZ API Testeru](../development/insyz-api-tester.md) (`/api/insyz/export*`, jen dev).

### 3. **MssqlConnector** - Production databáze
```php
// src/Service/MssqlConnector.php
class MssqlConnector {
    // PDO připojení k MSSQL serveru
    public function callProcedure(string $procedure, array $args): array;
    public function callProcedureMultiple(string $procedure, array $args): array;
    
    // Volá ho InsyzService::connect() – procedury: trasy.WEB_Login, trasy.ZNACKAR_DETAIL,
    // trasy.PRIKAZY_SEZNAM, trasy.ZP_Detail, trasy.ZP_Useky, trasy.ZP_Sazby, trasy.ZP_Zapis_XML,
    // trasy.WEB_Zapis_Pwd, trasy.WEB_SystemoveParametry
}
```

### 4. **DataEnricherService** - Obohacování dat
```php
// src/Service/DataEnricherService.php
class DataEnricherService {
    public function __construct(
        private ZnackaService $znackaService,
        private TimService $timService,
        private TransportIconService $transportIconService,
        private ReportRepository $reportRepository,
        private EntityManagerInterface $entityManager
    ) {}
    
    // Přidá HTML/SVG komponenty k INSYZ datům
    public function enrichPrikazyList(array $prikazy): array;
    public function enrichPrikazDetail(array $detail, bool $forPdf = false): array;
}
```

## 🌐 API endpointy

### InsyzController (`src/Controller/Api/InsyzController.php`)
Závislosti: `InsyzService`, `DataEnricherService`, `ReportRepository`. Endpointy (`/api/insyz/login`, `/user`,
`/prikazy`, `/prikaz/{id}`, `/zp-useky/{id}`, `/sazby`, `/submit-report`, `/update-password`,
`/system-parameters`, dev-only `/export*`) viz [api.md](../api.md#insyz-data).

### INSYZ audit
Controller audit neřeší – každé volání procedury (i `TEST_DATA`) zapisuje `InsyzService` přes
`InsyzAuditLogger::logMssqlProcedureCall()` do `insyz_audit_logs` (procedura, doba, parametry, souhrn výsledku,
chyba). Detail: [audit-logging.md](audit-logging.md).

## 📊 Data struktury

### Mock data
Mock soubory mají stejnou strukturu jako odpovědi procedur (např. `prikaz/{id}.json` obsahuje
`head`, `predmety`, `useky`…). Umístění viz výše (`var/mock-data/api/insyz/`).

### INSYZ stored procedures

Procedury, které portál volá (`InsyzService::connect()`, jen při `USE_TEST_DATA=false`; parametry viz kód):

| Procedura | Použití |
|---|---|
| `trasy.WEB_Login` | Přihlášení (`@Email`, `@WEBPwdHash` = SHA1 uppercase). Vrací jeden řádek i při neúspěchu: `INT_ADR` (NULL = neúspěch), `Email_nalezen`, `Heslo_se_shoduje`, `WEBUser`, `Zablokovano`, `Platnost`, `Platnost_DO`, `KontrolaPlatnostiPwdWEB` – viz [authentication.md](authentication.md) |
| `trasy.ZNACKAR_DETAIL` | Profil značkaře (`/api/insyz/user`, přihlášení) |
| `trasy.WEB_Zapis_Pwd` | Změna hesla (`@INT_ADR`, `@WEBPwdHash`) |
| `trasy.PRIKAZY_SEZNAM` | Seznam příkazů značkaře za rok |
| `trasy.ZP_Detail` | Detail příkazu: `head`, `predmety`, třetí dataset. U ZP-O jsou to úseky (`Kod_ZU`…), u ZP-I (druh `S`) servisní TIMy (`EvCi_TIM`, `TIM_Text`, `Popis`…) – rozlišuje `DataEnricherService::jeServisniTimDataset()` a `jeServisniTimDataset()` v `assets/js/utils/prikaz.js` |
| `trasy.ZP_Useky` | Úseky příkazu (`@ID_Znackarske_prikazy`) |
| `trasy.ZP_Sazby` | Sazby náhrad k datu |
| `trasy.ZP_Zapis_XML` | Zápis hlášení (`@Data_XML`, `@Uzivatel`) – volá worker `SendToInsyzHandler` a `/api/insyz/submit-report` |
| `trasy.WEB_SystemoveParametry` | Systémové parametry INSYZ |

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
// InsyzService::getPrikazy()
public function getPrikazy(int $intAdr, ?int $year = null): array
{
    $yearParam = $year ?? date('Y');

    if ($this->useTestData()) {
        return $this->getTestData('prikazy/' . $intAdr . '-' . $yearParam, [$intAdr, $yearParam]);
    }

    return $this->cacheService->getCachedPrikazy($intAdr, $year, function($intAdr, $year) {
        return $this->connect("trasy.PRIKAZY_SEZNAM", [$intAdr, $year ?? date('Y')]);
    });
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

#### Cache invalidation
`ApiCacheService::invalidateUserCache()` a `invalidatePrikazCache()` existují, ale v kódu se nevolají –
data vyprší podle TTL. Cache se používá jen v produkčním režimu (`USE_TEST_DATA=false`).

### Monitoring
- **INSYZ audit** (`insyz_audit_logs`) – doba volání, chyby; stránka `/admin/insyz-monitoring`, command `insyz:audit`
- **Kanál `api` (Monolog)** – `ApiCacheService` loguje „API Cache MISS…“; dev: `var/log/api.log`,
  prod: JSON do stderr + rotující soubor (viz `config/packages/monolog.yaml`)
- `ApiMonitoringService` je zaregistrovaná služba, kterou zatím nic nevolá

## 🛠️ Troubleshooting

### Performance debugging

#### 1. **Cache performance check**
```bash
# Zkontroluj cache hits/misses v logách
tail -f var/log/api.log | grep "Cache MISS"

# Velikost filesystem cache
du -sh var/cache/
```

#### 2. **Slow query detection**
```bash
ddev exec psql -c "SELECT endpoint, duration_ms, created_at FROM insyz_audit_logs WHERE duration_ms > 2000 ORDER BY created_at DESC LIMIT 20"
```

### Connection troubleshooting

#### 1. **TEST_DATA není načítána**
```bash
# Zkontroluj environment (musí být přesně "true")
grep USE_TEST_DATA .env .env.local

# Zkontroluj mock soubory
ls var/mock-data/api/insyz/prikazy/

# Test (admin session nebo hlavička X-Healthcheck-Token)
curl "https://portalznackare.ddev.site/api/test/insyz-prikazy"
```
Chybějící soubor se projeví prázdným výsledkem a chybou „Mock data file not found…“ v `insyz_audit_logs`.

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

#### 3. **Chybí HTML komponenty v datech**
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
**API Reference:** [../api.md](../api.md#insyz-data)  
**Configuration:** [../configuration.md](../configuration.md)  
**Development nástroje:** [../development/insyz-api-tester.md](../development/insyz-api-tester.md)  
**Monitoring:** [../development/development.md](../development/development.md) - Performance debugging  
**Aktualizováno:** 2026-09-27