# Hlášení příkazů - Workflow hlášení práce

> **Funkcionální oblast** - Kompletní systém pro hlášení, vyúčtování a kalkulaci kompenzací za práci značkařů

> **Programátorská poznámka:** Aplikace používá české Snake_Case parametry podle [konvence názvů](../development/development.md#konvence-názvů-parametrů).

## 🎯 Přehled funkcionality

Hlášení příkazů umožňuje značkařům vykazovat provedenou práci a automaticky vypočítávat náhrady podle sazeb KČT. Systém podporuje draft mode a asynchronní odeslání do INSYZ systému.

### Workflow hlášení
```
INSYZ Příkaz → React Formulář → Kalkulace → PostgreSQL → INSYZ Submission
     ↓              ↓             ↓           ↓            ↓
   Detail       Část A + B    Sazby KČT   Draft/Send   Async Worker
```

## 🔧 Backend komponenty

### 1. **ReportController** - API pro hlášení
```php
// src/Controller/Api/PortalController.php
#[Route('/api/portal/report')]
class PortalController extends AbstractController {
    
    #[Route('', methods: ['GET'])]
    public function getReport(Request $request): JsonResponse {
        // Načte existující hlášení pro příkaz
        $report = $this->reportRepository->findOneBy([
            'idZp' => $request->query->get('id_zp'),
            'intAdr' => $this->getUser()->getIntAdr()
        ]);
        
        return new JsonResponse(['report' => $report]);
    }
    
    #[Route('', methods: ['POST'])]
    public function saveReport(Request $request): JsonResponse {
        // Uloží hlášení jako draft nebo odešle ke zpracování
        if ($reportDto->state === 'send') {
            $this->messageBus->dispatch($message);
            // Zpracování probíhá v systemd workeru (portal-messenger-<env>)
            // Detail viz docs/development/background-jobs.md
        }
    }
}
```

### 2. **Report Entity** - Databázový model
Report ukládá strukturovaná data jako JSON:
- **Identifikace:** ID příkazu, číslo příkazu, uživatel
- **Data:** Část A (vyúčtování), Část B (činnost), kompenzace
- **Workflow:** draft → send → submitted → approved/rejected

## ⚛️ React Frontend

### Aplikační struktura
React aplikace `hlaseni-prikazu` používá **3-krokový formulář**:

```jsx
// assets/js/apps/hlaseni-prikazu/App.jsx
const App = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        Skupiny_Cest: [],
        Noclezne: [],
        Vedlejsi_Vydaje: []
    });
    
    // Načtení dat při startu
    useEffect(() => {
        loadReportData();  // Existující hlášení z DB
        loadPriceList();   // Aktuální sazby KČT
        loadTeamMembers(); // Tým z INSYZ
    }, [prikazId]);
};
```

### Část A - Vyúčtování formulář
**Záložkové rozhraní:**
- **Doprava** - Cestovní segmenty s real-time kalkulací  
- **Ubytování** - Noclehárny s příložkami
- **Výdaje** - Vedlejší náklady
- **Řidič** - SPZ vozidel a hlavní řidič pro zvýšenou sazbu

#### Cestovní segmenty
Podporované dopravní prostředky:
- **AUV** - Auto vlastní (vyžaduje km + SPZ)
- **V** - Vlak (vyžaduje náklady + doklady)
- **P** - Pěšky
- **K** - Kolo

**Live preview kalkulace** se aktualizuje při každé změně podle sazeb KČT.

#### Hlavní řidič a zvýšená sazba
**Klíčová změna (2025-08-06):** Globální výběr místo per skupina

```jsx
// Zobrazuje unikátní řidiče napříč skupinami
const uniqueDrivers = useMemo(() => {
    const driverMap = new Map();
    travelGroups.forEach(group => {
        if (group.Ridic && !driverMap.has(group.Ridic)) {
            const totalKm = calculateTotalKmForDriver(group.Ridic);
            driverMap.set(group.Ridic, { ...driver, totalKm });
        }
    });
    return Array.from(driverMap.values());
}, [travelGroups]);
```

### Část B - Hlášení činnosti
**Dynamické zobrazení podle typu příkazu:**
- **Obnovy (O)** - TIM hodnocení s předměty a fotografiemi
- **Ostatní typy** - Textové hlášení činnosti s přílohami

#### TIM hodnocení (pro Obnovy)
**Struktura:**
1. **TIM karty** - Seskupení podle turistických míst
2. **Středové pravidlo** - Ano/Ne radio button
3. **Předměty** - Hodnocení stavu (1-4) + rok výroby
4. **Fotografie** - Upload pro TIM a předměty

### Automatická kalkulace kompenzací
```javascript
// utils/compensationCalculator.js
export function calculateCompensation(formData, priceList, userIntAdr) {
    const result = {
        transport: 0,    // Doprava (jen řidiči)
        meals: 0,        // Stravné podle hodin
        reward: 0,       // Odměna podle hodin
        accommodation: 0,// Ubytování (kdo platil)
        expenses: 0,     // Výdaje (kdo platil)
        total: 0
    };
    
    // Hlavní řidič = zvýšená sazba na VŠECHNY AUV jízdy
    const isUserMainDriver = formData.Hlavni_Ridic === userIntAdr;
    const rate = isUserMainDriver ? priceList.jizdneZvysene : priceList.jizdne;
    
    // Kalkulace podle sazeb KČT
    return result;
}
```

## 🔄 Workflow procesu

### 1. **Inicializace hlášení**
```javascript
// Automatické načítání při startu
1. GET /api/insyz/prikaz/{id} - Detail příkazu z INSYZ
2. GET /api/portal/report?id_zp={id} - Existující hlášení (draft)
3. GET /api/insyz/sazby?date=... - Aktuální sazby KČT
4. Inicializace formuláře (prázdný nebo draft)
```

#### Zdroj složení značkařů + varování při změně
Tým značkařů (`teamMembers`) řídí členy skupin cest, plátce nocležného/výdajů i výpočet náhrad:
- **Nové hlášení** → tým z živé hlavičky příkazu (`extractTeamMembers`, sloty `INT_ADR_1..3`).
- **Existující hlášení** → tým z uloženého snapshotu `reportData.znackari` (zazálohuje se při každém uložení v `useFormSaving`).

Když se po vzniku hlášení změní složení značkařů v příkazu (přidání/odebrání), snapshot je zastaralý. `App.jsx` proto detekuje nesoulad (`teamMismatch`) a pod hlavičkou zobrazí komponentu **`TeamMismatchWarning`** s výpisem *Přidáni / Odebráni* a tlačítkem **„Načíst aktuální složení z příkazu"**:
- Tým se sjednotí s aktuální hlavičkou a draft se uloží (`handleSyncTeam`).
- **Odebraní** značkaři se vyčistí z `Cestujci`, `Ridic`, `Hlavni_Ridic`, `Zaplatil` (nocležné/výdaje) a `Presmerovani_Vyplat`.
- **Přidaní** se pouze zpřístupní k výběru — do skupin cest je vedoucí zařadí ručně.
- Banner se zobrazí jen pro editovatelné hlášení (`canEdit`).

### 2. **Vyplnění formuláře**
**Uživatel postupně vyplní:**
1. Cestovní segmenty (odkud, kam, čas, doprava)
2. Ubytování (místo, zařízení, částka, kdo platil)
3. Vedlejší výdaje (popis, částka, kdo platil)  
4. Řidič a vozidlo (pokud auto segment)
5. TIM hodnocení nebo textové hlášení činnosti

**Realtime kalkulace** při každé změně podle sazeb.

### 3. **Uložení a odeslání**
```javascript
// Draft workflow
onClick(saveDraft): {
    state: 'draft',     // Uloží pouze do PostgreSQL
    is_editable: true   // Lze pokračovat později
}

// Submit workflow
onClick(submitForApproval): {
    state: 'send',            // Trigger async processing
    polling: true             // Sleduje změnu state → submitted/rejected
}
```

## 📤 INSYZ Submission - Asynchronní zpracování

Trvalý systemd worker (`portal-messenger-prod` / `-dev`) konzumuje frontu zpráv z `messenger_messages` a posílá hlášení do INSYZ přes stored procedure `trasy.ZP_Zapis_XML`. Kompletní popis architektury, retry policy a troubleshootingu: [docs/development/background-jobs.md](../development/background-jobs.md).

```
1. Frontend: "Odeslat ke schválení"
2. Backend: state='send' → messageBus->dispatch()
3. Worker (systemd): XML generation → MSSQL submit
4. Status: state='submitted' nebo 'rejected'
5. Frontend: polling state → notifikace uživateli
```

### Náhled XML v administraci
Na detailu hlášení (`/admin/hlaseni/{id}`, app [`admin-report-detail`](../../assets/js/apps/admin-report-detail/App.jsx)) je tab **„XML pro INSYZ"** – zobrazí XML vygenerované z aktuálních dat hlášení (stejná struktura jako při odeslání), s možností kopírovat a otevřít raw. Endpoint: `GET /admin/api/reports/{id}/xml` (vrací `application/xml`), generuje [`XmlGenerationService`](../../src/Service/XmlGenerationService.php). Slouží k ladění/kontrole obsahu před i po odeslání.

### Smart retry logika
```php
// SendToInsyzHandler rozlišuje chyby
private function shouldRetry(\Exception $e): bool {
    $message = strtolower($e->getMessage());
    
    // Retry: timeout, connection, network  
    if (strpos($message, 'timeout') !== false) return true;
    
    // No retry: authentication, invalid data
    if (strpos($message, 'authentication') !== false) return false;
    
    return true; // Default: retry s backoff
}
```

### Timeout protection (3-vrstvé)
- **Frontend:** 45s timeout s AbortController
- **Backend:** 30s database statement timeout  
- **Worker:** 60s process timeout

## 📊 Data struktury

### Report JSON structure
```json
{
    "id_zp": 12345,
    "cislo_zp": "ZP001/2025",
    "znackari": [{"INT_ADR": 1234, "Znackar": "Jan Novák"}],
    "data_a": {
        "Datum_Provedeni": "2025-08-06",
        "Skupiny_Cest": [{
            "Ridic": 1234,
            "SPZ": "1A2 3456",
            "Cesty": [{
                "Druh_Dopravy": "AUV",
                "Kilometry": 50,
                "Misto_Odjezdu": "Praha",
                "Misto_Prijezdu": "Karlštejn"
            }]
        }],
        "Hlavni_Ridic": 1234,
        "Zvysena_Sazba": true
    },
    "data_b": {
        "Stavy_Tim": {"TIM123": {"Stav": 2, "Rok_vyroby": 2023}},
        "Koment_Usek": "Značení obnoveno"
    },
    "calculation": {"1234": {"transport": 245, "total": 1080}},
    "state": "send"
}
```

### Datové kontrakty pro INSYZ XML (důležité)
XML se generuje v `XmlGenerationService` z `data_a` + `data_b` + `calculation`. Tvar vstupních dat musí být konzistentní, jinak vzniknou chyby v XML:

- **`Stavy_Tim[EvCi_TIM].Predmety`** = **objekt klíčovaný `ID_PREDMETY`** (NE pole). Předvyplnění z INSYZ ([App.jsx](../../assets/js/apps/hlaseni-prikazu/App.jsx)) i editace ([PartBForm.jsx](../../assets/js/apps/hlaseni-prikazu/components/PartBForm.jsx)) musí používat stejný tvar – jinak se v XML objeví každý `<Predmet>` dvakrát (klíče `0,1,2` z pole + reálná ID).
- **`Obnovene_Useky`** = objekt klíčovaný **ID úseku z INSYZ** – `ID_TRASY_Odbocky` (odbočka), jinak `ID_Trasy_ZU`. NE `EvCi_Tra` (to je evidenční číslo trasy). Helper `getUsekId()` v [RenewedSectionsForm.jsx](../../assets/js/apps/hlaseni-prikazu/components/RenewedSectionsForm.jsx).
- **`calculation[INT_ADR].Noclezne[]`** musí obsahovat i pole **`Datum`** (z `data_a.Noclezne[].Datum`) – doplňuje [compensationCalculator.js](../../assets/js/apps/hlaseni-prikazu/utils/compensationCalculator.js). Bez něj se datum noclehu do XML nedostane.
- **`Presmerovani_Vyplat`** (`{ z_INT_ADR: na_INT_ADR }`) z `data_a` jde do XML i do přehledu ZP – zobrazuje [ReportProvedeniSummary.jsx](../../assets/js/components/prikazy/ReportProvedeniSummary.jsx).

> Pozn.: opravy ve frontendu platí pro **nová/znovuuložená hlášení**. Pro hromadnou opravu už uložených dat slouží konzolový příkaz níže.

### Hromadná oprava uložených dat (CLI)
Příkaz [`app:reports:fix-xml-data`](../../src/Command/FixReportXmlDataCommand.php) převede uložená data hlášení do konzistentního tvaru pro INSYZ XML (datum noclehu, de-duplikace předmětů, překlíčování `Obnovene_Useky` z `EvCi_Tra` na ID úseku). Logika je v [`ReportXmlDataFixer`](../../src/Service/ReportXmlDataFixer.php), je idempotentní.

```bash
# DRY-RUN (výchozí, nic nezapíše) – vypíše, co by se změnilo
ddev exec php bin/console app:reports:fix-xml-data

# Zápis všech hlášení (se zálohou původních dat do history)
ddev exec php bin/console app:reports:fix-xml-data --force

# Jen konkrétní hlášení / jen daný stav
ddev exec php bin/console app:reports:fix-xml-data 16 --force
ddev exec php bin/console app:reports:fix-xml-data --state=draft --force
```

Bezpečnost: dry-run je default; před zápisem se původní `data_a`/`data_b`/`calculation` uloží do `history` (akce `admin_data_fix`) pro případný rollback; příkaz **nikdy znovu neodesílá do INSYZ** (stav se nemění). Překlíčování úseků potřebuje úseky příkazu z INSYZ – nejednoznačné odbočky (sdílené `EvCi_Tra`) i nenalezené úseky vynechá a vypíše jako varování.

### Report states
- **draft** - Rozpracováno (editovatelné)
- **send** - Odesláno ke zpracování (async)
- **submitted** - Přijato INSYZ systémem
- **approved** - Schváleno v INSYZ
- **rejected** - Zamítnuto (opět editovatelné)

## 🔍 Validace a kontroly

### Frontend validace
```javascript
const canCompletePartA = useMemo(() => {
    const hasSegments = formData.Skupiny_Cest.length > 0;
    const segmentsValid = formData.Skupiny_Cest.every(group =>
        group.Cesty.every(seg => 
            seg.Druh_Dopravy && seg.Misto_Odjezdu && seg.Misto_Prijezdu
        )
    );
    return hasSegments && segmentsValid;
}, [formData]);
```

### Backend validace
Symfony validátory kontrolují:
- **Identifikace:** Platné ID příkazu a uživatele
- **Stavy:** Pouze povolené přechody (draft→send→submitted)
- **Kompletnost:** Před odesláním všechny povinné údaje

## 🧪 Testing workflow

### Test přihlášení  
- Username: `test` / Password: `test`

### Testovací scénáře
1. **Draft ukládání** - Vyplnit část A, uložit, obnovit stránku
2. **Kalkulace** - Auto segment s km → zkontrolovat výpočet  
3. **TIM hodnocení** - Obnova → vyplnit všechny předměty
4. **Hlavní řidič** - Test výběru z unikátních řidičů
5. **Async odeslání** - Submit → sledovat polling

```bash
# API testování
curl "https://portalznackare.ddev.site/api/portal/report?id_zp=123"
curl -X POST "/api/portal/report" -d '{"state": "draft", ...}'
```

## 🛠️ Troubleshooting

### Časté problémy

#### 1. **Kalkulace se neaktualizuje**
```javascript
// Zkontroluj načtení sazeb
useEffect(() => {
    if (priceList) {
        const calculation = calculateCompensation(formData, priceList);
        setCalculation(calculation);
    }
}, [formData, priceList]); // Dependencies!
```

#### 2. **Hlavní řidič se neukládá**
- Ověř výběr v části "Řidič" 
- Zkontroluj že je aktivní "Zvýšená sazba"
- Debug: `console.log(formData.Hlavni_Ridic)`

#### 3. **Worker neběží po submit**
```bash
# On-demand worker se spustí automaticky při submit
# Nebo manuálně:
php bin/console messenger:consume async --limit=1
```

#### 4. **Timeout při odesílání**
Frontend zobrazí: "Odesílání trvá déle než obvykle"
- Zkontroluj síť a server load
- Počkej 1-2 minuty a zkontroluj stav hlášení

#### 5. **TIM položky chybí**
- Pouze pro příkazy typu "O" (Obnova)
- Zkontroluj že příkaz obsahuje úseky s předměty
- Verify: GET `/api/insyz/prikaz/{id}` → `predmety[]`

---

**Propojené funkcionality:** [File Management](file-management.md) | [INSYZ Integration](insyz-integration.md)  
**API Reference:** [../api/portal-api.md](../api/portal-api.md)  
**Technical details:** [../development/background-jobs.md](../development/background-jobs.md)  
**Aktualizováno:** 2026-06-26