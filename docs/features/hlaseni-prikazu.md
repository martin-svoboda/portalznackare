# Hlášení příkazů - Workflow hlášení práce

> **Funkcionální oblast** - Kompletní systém pro hlášení, vyúčtování a kalkulaci kompenzací za práci značkařů

> **Programátorská poznámka:** Aplikace používá české Snake_Case parametry podle [konvence názvů](../development/development.md#konvence-názvů-parametrů).

## 💡 Důležité upozornění

**Lokální databáze vs. INSYS submission:**
- **Lokální PostgreSQL** slouží k ukládání a načítání vyplněných dat
- Možnost ukládat i **rozepsaná/nedokončená** hlášení (draft mode)
- **Finální odeslání** do INSYS systému je **zatím ve vývoji** (TODO)
- Dokumentace obsahuje navržený workflow pro budoucí implementaci

## 📋 Přehled hlášení příkazů

### Architektura workflow
```
INSYS Příkaz → React Formulář → Validace → PostgreSQL Report → INSYS Submission
     ↓              ↓            ↓              ↓                ↓
Ceníky KČT    Část A + B    Symfony API    Local Storage    Final Send
              kalkulace     Controller     (drafts/edits)   (TODO)
```

**Klíčové principy:**
- **Lokální databáze:** PostgreSQL pro ukládání a načítání rozepsaných hlášení
- **Draft system:** Možnost ukládat nedokončená hlášení a pokračovat později
- **JSON storage:** Strukturovaná data v PostgreSQL JSON sloupcích
- **State management:** Draft → Send → Submitted → Approved/Rejected (INSYZ submission)
- **Auto-calculation:** Automatické výpočty podle ceníků KČT
- **File attachments:** Doklady a fotografie s chráněným přístupem
- **Asynchronous submission:** Symfony Messenger pro odesílání do INSYZ systému

## 🛠️ Backend Components

### 1. **Report Entity** - Databázový model

```php
// src/Entity/Report.php
class Report {
    private int $idZp;              // ID příkazu z INSYS
    private string $cisloZp;        // Číslo příkazu (ZP001/2025)
    private int $intAdr;            // INT_ADR uživatele
    private bool $jeVedouci = false;
    
    // Strukturovaná data jako JSON
    private array $dataA = [];      // Část A - Vyúčtování
    private array $dataB = [];      // Část B - Hlášení činnosti/TIM
    private array $calculation = []; // Vypočtené kompenzace
    
    // Workflow stavy
    private ReportStateEnum $state = ReportStateEnum::DRAFT;
    private ?\DateTimeImmutable $dateSend = null;
    
    public function isEditable(): bool {
        return in_array($this->state, [ReportStateEnum::DRAFT, ReportStateEnum::REJECTED]);
    }
    // ...
}
```

### 2. **Report States** - Workflow stavy

```php
enum ReportStateEnum: string {
    case DRAFT = 'draft';           // Rozpracováno (lokálně, editovatelné)
    case SEND = 'send';             // Odesláno ke zpracování (asynchronní)
    case SUBMITTED = 'submitted';   // Přijato systémem INSYZ
    case APPROVED = 'approved';     // Schváleno v INSYZ
    case REJECTED = 'rejected';     // Zamítnuto v INSYZ (opět editovatelné)
}
```

### 3. **ReportController** - API endpointy

```php
#[Route('/api/portal/report')]
class ReportController extends AbstractController {
    
    #[Route('', methods: ['GET'])]
    public function getReport(Request $request): JsonResponse {
        $report = $this->reportRepository->findOneBy([
            'idZp' => $request->query->get('id_zp'),
            'intAdr' => $this->getUser()->getIntAdr()
        ]);
        
        return new JsonResponse([
            'report' => $report ? [
                'state' => $report->getState()->value,
                'data_a' => $report->getDataA(),
                'data_b' => $report->getDataB(),
                'calculation' => $report->getCalculation(),
                'is_editable' => $report->isEditable()
            ] : null
        ]);
    }
    
    #[Route('', methods: ['POST'])]
    public function saveReport(Request $request): JsonResponse {
        $reportDto = $this->serializer->deserialize($request->getContent(), ReportDto::class, 'json');
        
        $violations = $this->validator->validate($reportDto);
        if (count($violations) > 0) {
            return new JsonResponse(['errors' => $violations], 400);
        }
        
        $report = $this->reportRepository->findOneBy([
            'idZp' => $reportDto->idZp,
            'intAdr' => $this->getUser()->getIntAdr()
        ]) ?? new Report();
        
        if ($report->getId() && !$report->isEditable()) {
            return new JsonResponse(['error' => 'Report není v editovatelném stavu'], 403);
        }
        
        // Nastavení dat
        $report->setDataA($reportDto->dataA->toArray());
        $report->setDataB($reportDto->dataB->toArray());
        $report->setState(ReportStateEnum::from($reportDto->state));
        
        if ($reportDto->state === 'send') {
            $report->setDateSend(new \DateTimeImmutable());
            // Dispatch asynchronní zpracování pomocí Symfony Messenger
        }
        
        $this->entityManager->persist($report);
        $this->entityManager->flush();
        
        return new JsonResponse(['success' => true]);
    }
    
    // ...
}
```

### 4. **Data Transfer Objects** - Validace

```php
class ReportDto {
    #[Assert\NotBlank]
    #[Assert\Positive]
    public int $idZp;
    
    #[Assert\Valid]
    public PartADto $dataA;
    
    #[Assert\Valid]  
    public PartBDto $dataB;
    
    #[Assert\Choice(['draft', 'send'])]
    public string $state = 'draft';
    // ...
}

class PartADto {
    #[Assert\Valid]
    public array $travelSegments = [];
    
    #[Assert\Valid]
    public array $accommodations = [];
    
    #[Assert\Valid]
    public array $expenses = [];
    // ...
}

class TravelSegmentDto {
    #[Assert\Choice(['auto', 'vlak', 'autobus', 'mhd', 'pesi'])]
    public string $transport;
    
    #[Assert\NotBlank]
    public string $from;
    
    #[Assert\NotBlank]
    public string $to;
    
    #[Assert\When(expression: 'this.transport == "auto"', constraints: [new Assert\Positive()])]
    public ?int $kilometers = null;
    // ...
}
```

## ⚛️ React Frontend - Hlášení aplikace

### Aplikační struktura

React aplikace `hlaseni-prikazu` používá multi-step formulář:

```jsx
const App = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        dataA: { travelSegments: [], accommodations: [], expenses: [] },
        dataB: { timItems: [], activityReport: '' }
    });
    
    // Načtení dat při startu
    useEffect(() => {
        loadReportData();  // Načte existující hlášení z DB
        loadPriceList();   // Načte ceníky pro kalkulaci
    }, [prikazId]);
    
    return (
        <div>
            {/* Stepper progress bar */}
            <Stepper currentStep={currentStep} steps={steps} />
            
            {/* Dynamické zobrazení kroků */}
            {currentStep === 1 && <PartAForm {...formData} />}
            {currentStep === 2 && <PartBForm {...formData} />}
            {currentStep === 3 && <Summary {...formData} />}
        </div>
    );
};
```

### Část A - Vyúčtování formulář

```jsx
const PartAForm = ({ data, onChange, priceList }) => {
    const [activeTab, setActiveTab] = useState('travel');
    
    // Real-time kalkulace při změně dat
    useEffect(() => {
        if (priceList) {
            const calculation = calculateCompensation(data, priceList);
            onCalculationChange(calculation);
        }
    }, [data, priceList]);
    
    return (
        <div>
            {/* Tab navigation */}
            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tab value="travel" label="Doprava" />
                <Tab value="accommodation" label="Ubytování" />
                <Tab value="expenses" label="Výdaje" />
                <Tab value="driver" label="Řidič" />
            </Tabs>
            
            {/* Dynamický obsah podle aktivní záložky */}
            {activeTab === 'travel' && <TravelSegmentsForm {...data} />}
            {activeTab === 'accommodation' && <AccommodationForm {...data} />}
            {activeTab === 'expenses' && <ExpensesForm {...data} />}
            {activeTab === 'driver' && <DriverForm {...data} />}
        </div>
    );
};
```

#### Cestovní segmenty
```jsx
const TravelSegmentsForm = ({ segments, onChange }) => (
    <div>
        {segments.map(segment => (
            <div key={segment.id} className="segment-card">
                <select value={segment.transport} onChange={e => updateSegment(segment.id, 'transport', e.target.value)}>
                    <option value="auto">Auto</option>
                    <option value="vlak">Vlak</option>
                    <option value="autobus">Autobus</option>
                </select>
                
                <input placeholder="Odkud" value={segment.from} onChange={...} />
                <input placeholder="Kam" value={segment.to} onChange={...} />
                <input type="time" value={segment.startTime} onChange={...} />
                <input type="time" value={segment.endTime} onChange={...} />
                
                {segment.transport === 'auto' && (
                    <input type="number" placeholder="Km" value={segment.kilometers} />
                )}
                
                {/* Live preview kalkulace */}
                <div className="calculation-preview">
                    Náhrada: {calculateSegmentCompensation(segment, priceList)} Kč
                </div>
            </div>
        ))}
        
        <button onClick={addSegment}>Přidat segment</button>
    </div>
);
```

### Část B - Hlášení činnosti

```jsx
const PartBForm = ({ data, onChange, prikazType, predmety }) => {
    const isObnovaType = prikazType === 'O';
    
    // Dynamické zobrazení podle typu příkazu
    return isObnovaType ? (
        <TimItemsForm 
            timReports={data.timReports}
            predmety={predmety}
            onChange={onChange}
        />
    ) : (
        <ActivityReportForm 
            report={data.routeComment}
            attachments={data.routeAttachments}
            onChange={onChange}
        />
    );
};
```

#### TIM hodnocení (pro Obnovy)
```jsx
const TimItemsForm = ({ timReports, predmety }) => {
    // Seskupení položek podle TIM
    const timGroups = groupItemsByTIM(predmety);
    
    return (
        <div>
            {timGroups.map(timGroup => (
                <TimCard key={timGroup.EvCi_TIM}>
                    <h3>{timGroup.Naz_TIM}</h3>
                    
                    {/* Středové pravidlo */}
                    <RadioGroup 
                        name="centerRule"
                        value={timReport?.centerRuleCompliant}
                        onChange={value => updateTimReport(timGroup.EvCi_TIM, {centerRuleCompliant: value})}
                    />
                    
                    {/* Hodnocení jednotlivých položek */}
                    {timGroup.items.map(item => (
                        <TimItemRow key={item.ID_PREDMETY}>
                            <span>{item.Radek1}</span>
                            <select value={getItemStatus(item)?.state || ''} onChange={...}>
                                <option value="1">1 - Nová</option>
                                <option value="2">2 - Zachovalá</option>
                                <option value="3">3 - Nevyhovující</option>
                                <option value="4">4 - Zcela chybí</option>
                            </select>
                            {needsYearInput && <input type="number" placeholder="Rok" />}
                        </TimItemRow>
                    ))}
                    
                    {/* Fotografie TIMu */}
                    <AdvancedFileUpload 
                        storagePath={generateStoragePath()} 
                        files={timReport?.photos || []}
                    />
                </TimCard>
            ))}
        </div>
    );
};
```

### Automatická kalkulace kompenzací

```javascript
export function calculateCompensation(formData, priceList, userIntAdr, isUserDriver = false, higherKmRate = false) {
    const result = { 
        transport: 0,      // Doprava (pouze řidič)
        meals: 0,          // Stravné podle hodin
        reward: 0,         // Odměna podle hodin
        accommodation: 0,  // Ubytování (kdo platil)
        expenses: 0,       // Výdaje (kdo platil)
        total: 0,          // Celkem
        workHours: 0       // Odpracované hodiny
    };
    
    if (!priceList) return result;
    
    // 1. Výpočet pracovních hodin (od nejdřívějšího startu po nejpozdější konec)
    result.workHours = calculateWorkHours(formData.travelSegments);
    
    // 2. Doprava - pouze pro označeného řidiče
    if (isUserDriver) {
        const kmRate = higherKmRate ? priceList.km_sazba_zvysena : priceList.km_sazba;
        result.transport = formData.travelSegments
            .filter(s => s.transportType === 'AUV')
            .reduce((sum, s) => sum + (s.kilometers * kmRate), 0);
    }
    
    // 3. Stravné a odměna podle odpracovaných hodin
    if (result.workHours >= 5) {
        const tier = result.workHours >= 12 ? '12h_vice' : 
                     result.workHours >= 8 ? '8_12h' : '5_8h';
        result.meals = priceList[`stravne_${tier}`];
        result.reward = priceList[`odmena_${tier}`];
    }
    
    // 4. Ubytování a výdaje - pouze pro toho kdo platil
    result.accommodation = formData.accommodations
        .filter(a => a.paidByMember === userIntAdr)
        .reduce((sum, a) => sum + a.amount, 0);
        
    result.expenses = formData.additionalExpenses
        .filter(e => e.paidByMember === userIntAdr)
        .reduce((sum, e) => sum + e.amount, 0);
    
    result.total = Object.values(result).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    
    return result;
}
```

## 🔄 Kompletní workflow procesu

### 1. **Inicializace hlášení**
```javascript
1. Načti INSYS příkaz details (/api/insys/prikaz/{id})
2. Načti existující hlášení (/api/portal/report?id_zp={id})
3. Načti ceníky pro kalkulaci (/api/insys/ceniky?date=...)
4. Inicializuj formulář s daty nebo prázdný
```

### 2. **Část A - Vyúčtování workflow**
```javascript
// Uživatel postupně vyplní:
1. Cestovní segmenty (odkud, kam, čas, dopravní prostředek)
2. Ubytování (místo, zařízení, částka, kdo platil)
3. Vedlejší výdaje (popis, částka, kdo platil)
4. Řidič a vozidlo (pokud auto segment)
5. Přesměrování plateb (kdo dostane čí kompenzaci)

// Realtime kalkulace při každé změně
const calculation = calculateCompensation(formData, priceList);
```

### 3. **Část B - Hlášení činnosti**
```javascript
if (prikazType === 'O') {
    // OBNOVY - TIM hodnocení
    timItems.forEach(item => {
        // Stav: 1-Nová, 2-Zachovalá, 3-Nevyhovující, 4-Zcela chybí
        // Pro 1,2: + rok výroby, orientace
    });
} else {
    // OSTATNÍ TYPY - textové hlášení
    activityReport = "Popis provedené činnosti...";
}

// File upload pro fotografie a doklady
files = uploadFiles(storagePath: `reports/2025/${kkz}/${obvod}/${prikazId}`);
```

### 4. **Kontrola a kalkulace**
```javascript
const finalCalculation = {
    transport: 245,      // Doprava (jen řidič)
    meals: 120,          // Stravné podle hodin
    reward: 180,         // Odměna podle hodin  
    total: 1080,         // Celkem
    workHours: 8.5       // Odpracované hodiny
};

// Pro vedoucí: kalkulace pro celý tým
if (jeVedouci) {
    allMembersCalculations = calculateForAllMembers(...);
}
```

### 5. **Finalizace a odeslání**
```javascript
const reportData = {
    id_zp: prikazId,
    data_a: { travelSegments: [...], accommodations: [...] },
    data_b: { timItems: [...] || activityReport: "..." },
    calculation: finalCalculation,
    state: "send"  // "draft" = uložit lokálně, "send" = připravit k odeslání
};

// Uložení do lokální PostgreSQL databáze
await fetch('/api/portal/report', {
    method: 'POST',
    body: JSON.stringify(reportData)
});

// Dispatch do Symfony Messenger pro asynchronní zpracování
```

## 🔒 Validace a kontroly

### Frontend validace

```javascript
const canCompletePartA = useMemo(() => {
    const hasSegments = formData.dataA.travelSegments.length > 0;
    const segmentsValid = formData.dataA.travelSegments.every(seg => 
        seg.transport && seg.from && seg.to && seg.startTime && seg.endTime &&
        (seg.transport !== 'auto' || seg.kilometers)
    );
    
    const needsDriver = formData.dataA.travelSegments.some(seg => seg.transport === 'auto');
    const hasDriverInfo = !needsDriver || formData.dataA.driverInfo.intAdr;
    
    return hasSegments && segmentsValid && hasDriverInfo;
}, [formData.dataA]);

const canCompletePartB = useMemo(() => {
    if (prikazType === 'O') {
        return timItems.every(item => {
            const timItem = formData.dataB.timItems.find(ti => ti.id === item.ID_usek);
            return timItem?.state && (!['1', '2'].includes(timItem.state) || timItem.yearMade);
        });
    } else {
        return formData.dataB.activityReport.trim().length >= 10;
    }
}, [formData.dataB, prikazType, timItems]);
```

### Backend validace

```php
class ReportDto {
    #[Assert\NotBlank, Assert\Positive]
    public int $idZp;
    
    #[Assert\Valid]
    public PartADto $dataA;
    
    #[Assert\Choice(['draft', 'send'])]
    public string $state = 'draft';
    // ...
}

// Controller validation
if ($report->getId() && !$report->isEditable()) {
    return new JsonResponse(['error' => 'Report není v editovatelném stavu'], 403);
}

if ($reportDto->state === 'send') {
    $violations = $this->validateForSend($reportDto);
    if (count($violations) > 0) {
        return new JsonResponse(['errors' => $violations], 400);
    }
}
```

## 🧪 Testing workflow

### Test přihlášení
- Username: `test`
- Password: `test`

### Testovací scénáře

1. **Draft ukládání**: Vyplnit část A, uložit jako draft, obnovit stránku
2. **Kalkulace**: Přidat auto segment s km, zkontrolovat výpočet
3. **TIM hodnocení**: Pro příkaz typu Obnova vyplnit všechny TIM položky
4. **File upload**: Nahrát doklady a fotografie, ověřit zobrazení

### Rychlý test API
```bash
# Načtení hlášení
curl "https://portalznackare.ddev.site/api/portal/report?id_zp=123"

# Uložení draftu
curl -X POST "https://portalznackare.ddev.site/api/portal/report" \
  -H "Content-Type: application/json" \
  -d '{"id_zp": 123, "state": "draft", "data_a": {...}, "data_b": {...}}'
```

## 📤 INSYZ Submission - Asynchronní zpracování

### Implementace pomocí Symfony Messenger

**Aktuální stav:** Hlášení se odesílají asynchronně do INSYZ pomocí background jobs

#### 1. **Message Bus Pattern**
```php
// Dispatch z controlleru při state = 'send'
$message = new SendToInsyzMessage(
    $report->getId(),
    [
        'id_zp' => $report->getIdZp(),
        'cislo_zp' => $report->getCisloZp(),
        'znackari' => $report->getTeamMembers(),
        'data_a' => $report->getDataA(),
        'data_b' => $report->getDataB(),
        'calculation' => $report->getCalculation()
    ],
    $this->getParameter('kernel.environment')
);

$this->messageBus->dispatch($message);
```

#### 2. **Background Handler**
```php
#[AsMessageHandler]
class SendToInsyzHandler
{
    public function __invoke(SendToInsyzMessage $message): void
    {
        $report = $this->reportRepository->find($message->getReportId());
        
        // Test mode: 70% úspěch, 30% chyba
        if ($message->getEnvironment() === 'test') {
            $result = $this->simulateInsyzCall($message->getReportData());
        } else {
            $result = $this->callInsyzApi($message->getReportData());
        }
        
        // Aktualizace stavu podle výsledku
        if ($result['success']) {
            $report->setState(ReportStateEnum::SUBMITTED);
        } else {
            $report->setErrorMessage($result['error']);
        }
        
        $this->entityManager->flush();
    }
}
```

#### 3. **Real-time Status Polling**
Frontend používá **useStatusPolling** hook pro sledování zpracování:

```javascript
const { isPolling, pollCount } = useStatusPolling(
    prikazId, 
    formData, 
    setFormData, 
    formData.status === 'send'
);

// Automaticky kontroluje stav každých 5 sekund
// Zobrazuje notifikace při změně stavu
// Zastavuje polling při finálních stavech
```

**Dokumentace background jobs:** [../development/development.md#background-jobs-symfony-messenger](../development/development.md#background-jobs-symfony-messenger)

## 🛠️ Troubleshooting

### Časté problémy a řešení

1. **Kalkulace se neaktualizuje**
   - Zkontrolovat, zda se načetly ceníky správně
   - Ověřit správné dependencies v useEffect
   - Zkontrolovat console.log pro priceList data

2. **Report se neukládá**
   - Ověřit stav hlášení (pouze draft/rejected lze editovat)
   - Zkontrolovat unique constraint (1 hlášení na příkaz)
   - Ověřit autentifikaci uživatele

3. **TIM položky se nezobrazují**
   - Pouze pro příkazy typu "O" (Obnova)
   - Zkontrolovat, zda příkaz obsahuje úseky s předměty
   - Ověřit správné načtení predmety z API

4. **TypeError při kliknutí na radiobutton**
   ```javascript
   // Problém: timReport je undefined
   // Řešení: použít optional chaining nebo default hodnotu
   onChange={() => updateTimReport(timId, {
       ...(timReport || {}),  // Fix
       centerRuleCompliant: true
   })}
   ```

---

**Propojené funkcionality:** [File Management](file-management.md) | [INSYS Integration](insys-integration.md)  
**API Reference:** [../api/portal-api.md](../api/portal-api.md)  
**Frontend:** [../architecture.md](../architecture.md)  
**Aktualizováno:** 2025-08-03 - Přidána konvence Czech Snake_Case parametrů