# INSYS API Tester

Vývojářský nástroj pro testování INSYS API endpointů a export mock dat do lokálního prostředí.

## Přehled

INSYS API Tester je React aplikace dostupná pouze v dev prostředí na URL `/test-insys-api`. Umožňuje:

- **Testování všech INSYS API endpointů** s jednoduchým formulářem
- **Export surových dat** z INSYS do JSON souborů  
- **Hromadný export** příkazů včetně detailů
- **Automatické ukládání** do správné souborové struktury

## Technická implementace

### Architektura

```
templates/pages/insys-test.html.twig    → Twig template s mount pointem
assets/js/apps/insys-tester/           → React aplikace
src/Controller/InsysTestController.php  → Controller (pouze dev)
src/Controller/Api/InsysController.php  → API endpointy s export funkcemi
```

### React komponenty

- **App.jsx** - hlavní komponenta s formulářem a JSON viewerem
- **index.jsx** - mount point pro aplikaci
- Používá `react-json-view-lite` pro zobrazení JSON dat

### Automatické načítání endpointů

Controller automaticky načítá všechny INSYS API endpointy ze Symfony Routeru:

```php
private function getInsysEndpoints(): array
{
    $routes = $this->router->getRouteCollection();
    // Filtruje pouze '/api/insys/*' endpointy (kromě export)
    // Vrací: path, method
}
```

## Použití

### ⚠️ Důležité požadavky

**Všechny INSYS API endpointy vyžadují přihlášeného uživatele.** Aplikace funguje se session-based autentizací - data se načítají pro právě přihlášeného uživatele stejně jako v běžné aplikaci.

**Před použitím aplikace:**
1. **Přihlaste se** do hlavní aplikace (`/login`)
2. **Ověřte přihlášení** - data budou načítána pro váš účet (INT_ADR)
3. **Všechna volání** používají vaše oprávnění a přístupová práva

### Základní testování

1. **Otevřít aplikaci**: `https://portalznackare.ddev.site/test-insys-api`
2. **Vybrat endpoint** z dropdown seznamu
3. **Zadat parametry** pomocí key-value párů:
   - Path parametry se automaticky nahradí v URL
   - Ostatní parametry se pošlou jako query parametry (GET) nebo body (POST)
4. **Odeslat požadavek** - zobrazí se surová data z INSYS
5. **Exportovat data** - uloží se na server do správné struktury

### Příklady použití

#### User data
```
Endpoint: GET /api/insys/user
Parametry: (žádné)
→ Načte data přihlášeného uživatele
→ Export: var/mock-data/api/insys/user/4133.json
```

#### Seznam příkazů
```
Endpoint: GET /api/insys/prikazy
Parametry: year = 2024
→ URL: /api/insys/prikazy?year=2024&raw=1
→ Export: var/mock-data/api/insys/prikazy/4133-2024.json
```

#### Detail příkazu
```
Endpoint: GET /api/insys/prikaz/{id}
Parametry: id = 123
→ URL: /api/insys/prikaz/123?raw=1
→ Export: var/mock-data/api/insys/prikaz/123.json
```

### Hromadný export příkazů

Pro endpointy s `/prikazy` se zobrazí speciální tlačítko **"Exportovat detaily"**:

1. **Načíst seznam příkazů** (např. rok 2024)
2. **Kliknout "Exportovat detaily"**
3. **Aplikace automaticky**:
   - Uloží seznam příkazů
   - Projde všechny příkazy a stáhne jejich detaily
   - Uloží každý detail do separátního souboru
   - Vytvoří metadata soubor s přehledem exportu

## Souborová struktura exportů

### Struktura mock dat

```
var/mock-data/
└── api/
    └── insys/
        ├── user/
        │   └── {INT_ADR}.json              # Data uživatele
        │
        ├── prikazy/
        │   ├── {INT_ADR}-{year}.json       # Seznam příkazů uživatele
        │   └── {INT_ADR}-{year}.json
        │
        ├── prikaz/
        │   ├── {id}.json                   # Detail příkazu
        │   └── {id}.json
        │
        └── ceniky/
            └── ceniky-{date}.json          # Ceníky
```

### Mapování endpointů na soubory

| API Endpoint | Mock soubor |
|--------------|-------------|
| `GET /api/insys/user` | `api/insys/user/{INT_ADR}.json` |
| `GET /api/insys/prikazy?year=2024` | `api/insys/prikazy/{INT_ADR}-2024.json` |
| `GET /api/insys/prikaz/123` | `api/insys/prikaz/123.json` |
| `GET /api/insys/ceniky` | `api/insys/ceniky/ceniky-{date}.json` |

## Surová vs obohacená data

### Raw parametr

Aplikace automaticky přidává `?raw=1` parametr ke všem požadavkům pro získání surových dat:

```php
// V InsysController.php
$raw = $request->query->get('raw');
if (!$raw) {
    $prikazy = $this->dataEnricher->enrichPrikazyList($prikazy);
}
```

### Rozdíl v datech

- **Běžné aplikace**: `GET /api/insys/prikazy/2024` → obohacená data s HTML ikonami
- **Test aplikace**: `GET /api/insys/prikazy/2024?raw=1` → surová data z INSYS

## MockMSSQLService integrace

Service automaticky načítá exportovaná data:

```php
public function getPrikazy(int $intAdr, int $year): array
{
    // Zkusit načíst z endpoint struktury
    $data = $this->loadMockDataFromEndpoint('api/insys/prikazy', [$intAdr . '-' . $year]);
    if ($data !== null) {
        return $data;
    }
    
    // Fallback na starou strukturu
    $testData = $this->getTestData();
    return $testData['prikazy'][$year] ?? [];
}
```

## Export API endpointy

### Jednotlivý export
```
POST /api/insys/export
{
  "endpoint": "/api/insys/user",
  "response": {...},
  "params": {...}
}
```

### Hromadný export příkazů
```
POST /api/insys/export/batch-prikazy
{
  "prikazy": [...],
  "year": 2024
}
```

## Workflow pro práci s daty

### 1. Export dat z dev serveru

1. **Přihlásit se** na dev server s testovacím účtem
2. **Otevřít** `/test-insys-api`
3. **Exportovat potřebná data**:
   - User data: `GET /api/insys/user` → Export
   - Příkazy: `GET /api/insys/prikazy` + year → Exportovat detaily
   - Ceníky: `GET /api/insys/ceniky` → Export

### 2. Zkopírování do lokálu

```bash
# Na dev serveru
tar -czf mock-data.tar.gz var/mock-data/

# Stáhnout a rozbalit v lokálu
scp dev-server:mock-data.tar.gz .
tar -xzf mock-data.tar.gz
```

### 3. Lokální vývoj

MockMSSQLService automaticky použije exportovaná data místo default mock dat.

## Bezpečnost

- **Pouze dev prostředí**: Aplikace je dostupná pouze když `kernel.environment = dev`
- **Autentizace**: Export endpointy vyžadují přihlášeného uživatele
- **Raw data**: Žádné citlivé informace nejsou obohacovány HTML obsahem

## Rozšiřování

### Přidání nového endpointu

1. **Vytvořit metodu** v `InsysController.php` s route `/api/insys/*`
2. **Endpoint se automaticky objeví** v testeru
3. **Pokud má speciální parametry**, přidat do `determineExportPathFromData()`

### Vlastní export logika

```php
private function determineExportPathFromData(string $endpoint, array $params, array $responseData): array
{
    if (str_contains($endpoint, '/my-endpoint')) {
        return [
            'dir' => 'api/insys/my-endpoint',
            'filename' => 'custom-name.json'
        ];
    }
    // ...
}
```

## Troubleshooting

### Data se neukládají správně
- Zkontrolovat oprávnění složky `var/mock-data/`
- Ověřit, že aplikace běží v dev prostředí

### Parametry se nepředávají
- Path parametry: musí být v `{parametr}` formátu v route
- Query parametry: pro GET requesty se automaticky přidají
- Body parametry: pro POST requesty

### MockMSSQLService nenačítá data
- Zkontrolovat souborovou strukturu v `var/mock-data/`
- Ověřit názvy souborů (musí odpovídat pattern `{INT_ADR}-{year}.json`)

## Related

- [INSYS API Reference](../api/insys-api.md)
- [INSYS Integration](../features/insys-integration.md)
- [INSYS API](../api/insys-api.md)
- [Portal API](../api/portal-api.md)