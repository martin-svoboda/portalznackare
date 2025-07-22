# Hlášení příkazů - Workflow hlášení práce

> **Funkcionální oblast** - Kompletní systém pro hlášení, vyúčtování a kalkulaci kompenzací za práci značkařů

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
- **State management:** Draft → Send → (TODO: INSYS submission)
- **Auto-calculation:** Automatické výpočty podle ceníků KČT
- **File attachments:** Doklady a fotografie s chráněným přístupem
- **Final submission:** TODO - odeslání finálních hlášení do INSYS systému

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
    case SEND = 'send';             // Odesláno ke zpracování (lokálně, uzamčené)
    case SUBMITTED = 'submitted';   // TODO: Odesláno do INSYS
    case APPROVED = 'approved';     // TODO: Schváleno v INSYS
    case REJECTED = 'rejected';     // TODO: Zamítnuto v INSYS (opět editovatelné)
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
            // TODO: Spustit INSYS submission
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

```jsx
const App = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        dataA: { travelSegments: [], accommodations: [], expenses: [] },
        dataB: { timItems: [], activityReport: '' }
    });
    const [calculation, setCalculation] = useState({});
    const [priceList, setPriceList] = useState(null);
    
    useEffect(() => {
        loadReportData();
        loadPriceList();
    }, [prikazId]);
    
    const loadReportData = async () => {
        const response = await fetch(`/api/portal/report?id_zp=${prikazId}`);
        const data = await response.json();
        
        if (data.report) {
            setFormData({ dataA: data.report.data_a, dataB: data.report.data_b });
            setCalculation(data.report.calculation);
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Progress bar */}
            <div className="mb-8">
                {/* Progress steps UI ... */}
            </div>
            
            {/* Step content */}
            {currentStep === 1 && (
                <PartAForm 
                    data={formData.dataA}
                    onChange={(dataA) => setFormData(prev => ({...prev, dataA}))}
                    priceList={priceList}
                    onCalculationChange={setCalculation}
                />
            )}
            
            {currentStep === 2 && (
                <PartBForm 
                    data={formData.dataB}
                    onChange={(dataB) => setFormData(prev => ({...prev, dataB}))}
                    prikazType={prikazDetails?.Druh_ZP_Kod}
                />
            )}
            
            {/* Navigation */}
            <div className="flex justify-between mt-8">
                <button onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}>
                    Zpět
                </button>
                <button onClick={handleNext}>
                    {currentStep === 4 ? 'Uložit' : 'Další'}
                </button>
            </div>
        </div>
    );
};
```

### Část A - Vyúčtování formulář

```jsx
const PartAForm = ({ data, onChange, priceList, onCalculationChange }) => {
    const [activeTab, setActiveTab] = useState('travel');
    
    useEffect(() => {
        if (priceList) {
            const calculation = calculateCompensation(data, priceList);
            onCalculationChange(calculation);
        }
    }, [data, priceList]);
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Část A - Vyúčtování</h2>
            
            {/* Tab navigation */}
            <div className="flex border-b">
                {['travel', 'accommodation', 'expenses', 'driver'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}>
                        {/* Tab titles ... */}
                    </button>
                ))}
            </div>
            
            {/* Tab content */}
            {activeTab === 'travel' && (
                <TravelSegmentsForm
                    segments={data.travelSegments}
                    onChange={(segments) => onChange({...data, travelSegments: segments})}
                    priceList={priceList}
                />
            )}
            
            {/* Other tabs ... */}
        </div>
    );
};

const TravelSegmentsForm = ({ segments, onChange, priceList }) => {
    const addSegment = () => {
        const newSegment = { id: Date.now(), transport: '', from: '', to: '', ... };
        onChange([...segments, newSegment]);
    };
    
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Cestovní segmenty</h3>
                <button onClick={addSegment} className="btn btn--primary">
                    Přidat segment
                </button>
            </div>
            
            {segments.map((segment, index) => (
                <div key={segment.id} className="p-4 border rounded-lg">
                    <div className="grid grid-cols-3 gap-4">
                        {/* Transport, from, to, times */}
                        <select value={segment.transport} onChange={...}>
                            <option value="auto">Auto</option>
                            <option value="vlak">Vlak</option>
                            {/* ... */}
                        </select>
                        
                        <input type="text" value={segment.from} onChange={...} />
                        <input type="text" value={segment.to} onChange={...} />
                        
                        {segment.transport === 'auto' && (
                            <input type="number" value={segment.kilometers} onChange={...} />
                        )}
                        
                        {/* Preview kalkulace */}
                        {segment.transport && priceList && (
                            <div className="mt-2 p-2 bg-blue-50 rounded">
                                Náhrada: {calculateSegmentCompensation(segment, priceList)} Kč
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
```

### Část B - Hlášení činnosti

```jsx
const PartBForm = ({ data, onChange, prikazType, timItems }) => {
    const isObnovaType = prikazType === 'O';
    
    if (isObnovaType) {
        return (
            <TimItemsForm
                timItems={data.timItems}
                availableItems={timItems}
                onChange={(timItems) => onChange({...data, timItems})}
            />
        );
    }
    
    return (
        <ActivityReportForm
            report={data.activityReport}
            onChange={(activityReport) => onChange({...data, activityReport})}
        />
    );
};

const TimItemsForm = ({ timItems, availableItems, onChange }) => {
    const updateTimItem = (itemId, updates) => {
        onChange(timItems.map(item => item.id === itemId ? { ...item, ...updates } : item));
    };
    
    const completedItems = timItems.filter(item => 
        item.state && (item.state === '1' || item.state === '2' ? item.yearMade : true)
    ).length;
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Část B - Hlášení činnosti (TIM)</h2>
                <div className="text-sm text-gray-600">
                    Dokončeno: {completedItems}/{availableItems.length} položek
                </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" 
                     style={{ width: `${(completedItems / availableItems.length) * 100}%` }} />
            </div>
            
            {/* TIM položky */}
            {availableItems.map((availableItem, index) => {
                const timItem = timItems.find(item => item.id === availableItem.ID_usek) || {
                    id: availableItem.ID_usek, state: '', yearMade: '', comment: ''
                };
                
                return (
                    <div key={availableItem.ID_usek} className="p-4 border rounded-lg">
                        <h3 className="font-semibold mb-2">{availableItem.nazev}</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {/* Item info */}
                            <div>
                                <div><strong>Typ:</strong> {availableItem.typ}</div>
                                <div><strong>Poloha:</strong> {availableItem.poloha}</div>
                            </div>
                            
                            {/* Hodnocení */}
                            <div className="space-y-4">
                                <select value={timItem.state} 
                                        onChange={(e) => updateTimItem(timItem.id, {state: e.target.value})}>
                                    <option value="">Vyberte stav...</option>
                                    <option value="1">1 - Nová</option>
                                    <option value="2">2 - Zachovalá</option>
                                    <option value="3">3 - Nevyhovující</option>
                                    <option value="4">4 - Zcela chybí</option>
                                </select>
                                
                                {['1', '2'].includes(timItem.state) && (
                                    <input type="number" value={timItem.yearMade} 
                                           onChange={(e) => updateTimItem(timItem.id, {yearMade: e.target.value})} 
                                           placeholder="Rok výroby" />
                                )}
                                
                                <textarea value={timItem.comment} 
                                          onChange={(e) => updateTimItem(timItem.id, {comment: e.target.value})}
                                          placeholder="Komentář..." />
                            </div>
                        </div>
                    </div>
                );
            })}
            
            {/* File upload */}
            <AdvancedFileUpload
                storagePath={`reports/2025/${user.kkz}/${user.obvod}/${prikazId}`}
                isPublic={false}
            />
        </div>
    );
};
```

### Automatická kalkulace kompenzací

```javascript
export function calculateCompensation(formData, priceList, userIntAdr, isUserDriver = false, higherKmRate = false) {
    const result = { transport: 0, meals: 0, reward: 0, accommodation: 0, expenses: 0, total: 0, workHours: 0 };
    
    if (!priceList) return result;
    
    // Výpočet pracovních hodin
    result.workHours = calculateWorkHours(formData.dataA.travelSegments);
    
    // Doprava (pouze pro řidiče)
    if (isUserDriver) {
        result.transport = calculateTransportCompensation(formData.dataA.travelSegments, priceList, higherKmRate);
    }
    
    // Stravné + odměna podle odpracovaných hodin
    const mealAndReward = calculateMealsAndReward(result.workHours, priceList);
    result.meals = mealAndReward.meals;
    result.reward = mealAndReward.reward;
    
    // Ubytování a výdaje (jen pro toho kdo platil)
    result.accommodation = calculateAccommodationCompensation(formData.dataA.accommodations, userIntAdr);
    result.expenses = calculateExpensesCompensation(formData.dataA.expenses, userIntAdr);
    
    result.total = result.transport + result.meals + result.reward + result.accommodation + result.expenses;
    
    return result;
}

function calculateWorkHours(travelSegments) {
    if (!travelSegments.length) return 0;
    
    let earliestStart = null;
    let latestEnd = null;
    
    travelSegments.forEach(segment => {
        const startTime = new Date(`1970-01-01T${segment.startTime}:00`);
        const endTime = new Date(`1970-01-01T${segment.endTime}:00`);
        
        if (!earliestStart || startTime < earliestStart) earliestStart = startTime;
        if (!latestEnd || endTime > latestEnd) latestEnd = endTime;
    });
    
    // Handle overnight trips
    if (latestEnd < earliestStart) {
        latestEnd.setDate(latestEnd.getDate() + 1);
    }
    
    return Math.max(0, (latestEnd - earliestStart) / (1000 * 60 * 60));
}

function calculateMealsAndReward(workHours, priceList) {
    if (workHours >= 5 && workHours < 8) {
        return { meals: priceList.stravne_5_8h, reward: priceList.odmena_5_8h };
    } else if (workHours >= 8 && workHours < 12) {
        return { meals: priceList.stravne_8_12h, reward: priceList.odmena_8_12h };
    } else if (workHours >= 12) {
        return { meals: priceList.stravne_12h_vice, reward: priceList.odmena_12h_vice };
    }
    
    return { meals: 0, reward: 0 };
}

// ...
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

// TODO: Implementovat finální odeslání do INSYS
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

### API testing
```bash
# Vytvoření nového hlášení
curl -X POST "https://portalznackare.ddev.site/api/portal/report" \
  -d '{"id_zp": 123, "state": "draft", "data_a": {"travelSegments": [...] }}'

# Načtení hlášení  
curl "https://portalznackare.ddev.site/api/portal/report?id_zp=123"
```

### React component testing
```jsx
// Test file upload v hlášení
<AdvancedFileUpload
    storagePath={`reports/2025/praha/1/123`}
    isPublic={false}
    maxFiles={15}
/>

// Test kalkulátoru
const testFormData = {
    dataA: {
        travelSegments: [{
            transport: 'auto',
            kilometers: 100,
            startTime: '08:00',
            endTime: '16:00'
        }]
    }
};

const calculation = calculateCompensation(testFormData, mockPriceList, userIntAdr, true);
```

## 📤 INSYS Submission (TODO)

### Navržený workflow pro budoucí implementaci

**Aktuální stav:** Hlášení se ukládají pouze lokálně v PostgreSQL

**Plánovaná implementace:**

#### 1. **INSYS Submission Service**
```php
// TODO: src/Service/InsysSubmissionService.php
class InsysSubmissionService {
    public function submitReportToInsys(Report $report): bool {
        // 1. Validace reportu proti INSYS schématu
        $this->validateForInsys($report);
        
        // 2. Konverze dat do INSYS formátu
        $insysData = $this->convertToInsysFormat($report);
        
        // 3. API volání na INSYS endpoint
        $response = $this->insysApiClient->submitReport($insysData);
        
        // 4. Aktualizace stavu reportu
        if ($response['success']) {
            $report->setState(ReportStateEnum::SUBMITTED);
            $report->setInsysId($response['insys_id']);
        }
        
        return $response['success'];
    }
}
```

#### 2. **Automatické submission**
```php
#[AsEventListener(event: ReportStateChanged::class)]
class ReportSubmissionListener {
    public function onReportStateChanged(ReportStateChanged $event): void {
        $report = $event->getReport();
        
        if ($report->getState() === ReportStateEnum::SEND) {
            $this->messageBus->dispatch(new SubmitReportToInsys($report->getId()));
        }
    }
}
```

#### 3. **Status synchronization**
```php
class SyncReportStatusCommand extends Command {
    protected function execute(InputInterface $input, OutputInterface $output): int {
        $submittedReports = $this->reportRepository->findBy(['state' => [ReportStateEnum::SUBMITTED]]);
        
        foreach ($submittedReports as $report) {
            $insysStatus = $this->insysService->getReportStatus($report->getInsysId());
            
            if ($insysStatus['status'] === 'approved') {
                $report->setState(ReportStateEnum::APPROVED);
            } elseif ($insysStatus['status'] === 'rejected') {
                $report->setState(ReportStateEnum::REJECTED);
            }
        }
        
        return Command::SUCCESS;
    }
}
```

## 🛠️ Troubleshooting

### Časté problémy

#### 1. **Kalkulace se neaktualizuje**
```javascript
// ❌ ŠPATNĚ - missing dependency
useEffect(() => {
    const calc = calculateCompensation(formData, priceList);
    setCalculation(calc);
}, [formData]); // chybí priceList

// ✅ SPRÁVNĚ  
useEffect(() => {
    if (priceList) {
        const calc = calculateCompensation(formData, priceList, userIntAdr, isDriver);
        setCalculation(calc);
    }
}, [formData, priceList, userIntAdr, isDriver]);
```

#### 2. **Report se neukládá lokálně**
```php
// Zkontroluj editovatelnost
if ($report->getState() === ReportStateEnum::SEND) {
    // Report je připravený k odeslání, nelze editovat
}

// Zkontroluj unique constraint
$existingReport = $this->repository->findOneBy(['idZp' => $data['id_zp'], 'intAdr' => $user->getIntAdr()]);
```

#### 3. **TIM položky se nezobrazují**
```javascript
if (prikazDetails?.Druh_ZP_Kod !== 'O') {
    // Není obnova, zobraz textové hlášení místo TIM
}

if (!prikazDetails?.useky?.length) {
    // Žádné TIM položky k hodnocení
}
```

---

**Propojené funkcionality:** [File Management](file-management.md) | [INSYS Integration](insys-integration.md)  
**API Reference:** [../api/portal-api.md](../api/portal-api.md)  
**Frontend:** [../frontend/architecture.md](../frontend/architecture.md)  
**Aktualizováno:** 2025-07-22