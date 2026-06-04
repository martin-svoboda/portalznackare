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
**Aktualizováno:** 2025-08-07