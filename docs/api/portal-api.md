# Portal API Reference

> **API dokumentace** - Lokální funkcionalita (PostgreSQL) - reporty hlášení, statistiky a CMS obsah

## 🏠 Přehled Portal API

**Base URL:** `/api/portal/`  
**Účel:** Lokální funkcionalita postavená na PostgreSQL databázi  
**Autentifikace:** Session-based (všechny endpointy vyžadují přihlášení)  
**Data:** Reports, statistics, CMS content (metodiky, downloads)

### Klíčové funkce
- **Reports management:** CRUD operace s hlášeními práce
- **State management:** Workflow s ReportStateEnum
- **Validation:** DTO validace s Symfony Validator
- **Statistics:** Agregace dat pro dashboardy
- **CMS content:** Metodiky a downloads (TODO)

## 📋 Report Management Endpointy

### 📖 GET `/api/portal/report`

Načte existující hlášení práce pro konkrétní příkaz.

**Autentifikace:** Vyžadováno  
**Query parametry:**
- `id_zp` - ID příkazu (povinný)

**Request:**
```bash
GET /api/portal/report?id_zp=123
```

**Response (existující hlášení):**
```json
{
    "id": 456,
    "id_zp": 123,
    "cislo_zp": "ZP001/2025",
    "int_adr": 1234,
    "je_vedouci": false,
    "state": "draft",
    "data_a": {
        "datum_prace": "2025-01-15",
        "hodiny_celkem": 8.5,
        "popis_prace": "Obnova značení na trase"
    },
    "data_b": {
        "doprava": {
            "typ": "vlastni_auto",
            "km": 150,
            "nahrada_km": 900
        },
        "stravne": {
            "pocet_hodin": 8.5,
            "nahrada": 160
        }
    },
    "calculation": {
        "celkova_nahrada": 1060,
        "breakdown": {
            "doprava": 900,
            "stravne": 160
        }
    },
    "created_at": "2025-01-15T08:00:00+01:00",
    "updated_at": "2025-01-15T14:30:00+01:00"
}
```

**Response (žádné hlášení):**
```
HTTP 204 No Content
null
```

**Backend logic:**
```php
// src/Controller/Api/ReportController.php
public function getReport(Request $request): JsonResponse {
    $idZp = $request->query->getInt('id_zp');
    $intAdr = $this->getUser()->getIntAdr();
    
    $report = $this->reportRepository->findByOrderAndUser($idZp, $intAdr);
    
    if (!$report) {
        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }
    
    // Serialize s groups pro security
    $data = $this->serializer->serialize($report, 'json', [
        'groups' => ['report:read']
    ]);
    
    return new JsonResponse(json_decode($data));
}
```

**Chyby:**
- `400` - Chybí parametr id_zp
- `401` - Nepřihlášený uživatel
- `500` - Chyba načítání dat

---

### 💾 POST `/api/portal/report`

Uloží nebo aktualizuje hlášení práce s kompletní validací.

**Autentifikace:** Vyžadováno  
**Content-Type:** `application/json`

**Request:**
```json
{
    "id_zp": 123,
    "cislo_zp": "ZP001/2025",
    "je_vedouci": false,
    "state": "draft",
    "data_a": {
        "datum_prace": "2025-01-15",
        "hodiny_celkem": 8.5,
        "popis_prace": "Obnova značení na trase Karlštejn",
        "ucastnici": [
            {
                "jmeno": "Jan Novák", 
                "hodiny": 8.5
            }
        ]
    },
    "data_b": {
        "doprava": {
            "typ": "vlastni_auto",
            "km": 150,
            "sazba_km": 6,
            "nahrada_km": 900
        },
        "stravne": {
            "pocet_hodin": 8.5,
            "sazba": "tarif3",
            "nahrada": 160
        },
        "ubytovani": {
            "noci": 0,
            "nahrada": 0
        }
    },
    "calculation": {
        "celkova_nahrada": 1060,
        "breakdown": {
            "doprava": 900,
            "stravne": 160,
            "ubytovani": 0
        },
        "metadata": {
            "calculation_date": "2025-01-15T14:30:00+01:00",
            "tariffs_version": "2025.1"
        }
    }
}
```

**Response:**
```json
{
    "id": 456,
    "id_zp": 123,
    "cislo_zp": "ZP001/2025", 
    "state": "draft",
    "data_a": { /* ... */ },
    "data_b": { /* ... */ },
    "calculation": { /* ... */ },
    "je_vedouci": false,
    "created_at": "2025-01-15T08:00:00+01:00",
    "updated_at": "2025-01-15T14:35:00+01:00"
}
```

**Backend processing:**
```php
public function saveReport(Request $request): JsonResponse {
    $user = $this->getUser();
    $data = json_decode($request->getContent(), true);
    
    // DTO validation
    $reportDto = $this->serializer->deserialize(
        $request->getContent(), 
        ReportDto::class, 
        'json'
    );
    
    $violations = $this->validator->validate($reportDto);
    if (count($violations) > 0) {
        return new JsonResponse([
            'error' => 'Chyby validace',
            'violations' => $this->formatViolations($violations)
        ], 400);
    }
    
    // Find existing nebo create new
    $report = $this->reportRepository->findByOrderAndUser($data['id_zp'], $user->getIntAdr());
    
    if (!$report) {
        $report = new Report();
        $report->setIdZp($data['id_zp']);
        $report->setIntAdr($user->getIntAdr());
    }
    
    // Check editability
    if (!$report->isEditable()) {
        return new JsonResponse([
            'error' => 'Hlášení nelze upravovat ve stavu: ' . $report->getState()->getLabel()
        ], 403);
    }
    
    // Map data and save
    $this->mapDtoToEntity($data, $report);
    $this->reportRepository->save($report, true);
    
    return new JsonResponse(/* serialized report */);
}
```

**State workflow:**
```php
// src/Enum/ReportStateEnum.php
enum ReportStateEnum: string {
    case DRAFT = 'draft';           // Rozpracováno (editovatelné)
    case SEND = 'send';             // Odesláno ke zpracování (locked)
    case SUBMITTED = 'submitted';   // TODO: Odesláno do INSYS  
    case APPROVED = 'approved';     // TODO: Schváleno v INSYS
    case REJECTED = 'rejected';     // TODO: Zamítnuto (opět editovatelné)
    
    public function isEditable(): bool {
        return in_array($this, [self::DRAFT, self::REJECTED]);
    }
}
```

**Chyby:**
- `400` - Neplatná JSON data nebo chybí id_zp
- `401` - Nepřihlášený uživatel  
- `403` - Hlášení není editovatelné (wrong state)
- `422` - Validation errors
- `500` - Chyba ukládání

---

### 📊 GET `/api/portal/reports/user`

Načte seznam všech hlášení aktuálního uživatele.

**Autentifikace:** Vyžadováno  
**Query parametry:**
- `state` - Filtr podle stavu (optional, např. `draft`, `send`)

**Request:**
```bash
GET /api/portal/reports/user?state=draft
```

**Response:**
```json
[
    {
        "id": 456,
        "id_zp": 123,
        "cislo_zp": "ZP001/2025",
        "state": "draft",
        "created_at": "2025-01-15T08:00:00+01:00",
        "updated_at": "2025-01-15T14:30:00+01:00",
        "calculation": {
            "celkova_nahrada": 1060
        }
    },
    {
        "id": 457,
        "id_zp": 124,
        "cislo_zp": "ZP002/2025", 
        "state": "send",
        "created_at": "2025-01-10T09:00:00+01:00",
        "updated_at": "2025-01-12T16:45:00+01:00",
        "calculation": {
            "celkova_nahrada": 850
        }
    }
]
```

**Backend:**
```php
public function getUserReports(Request $request): JsonResponse {
    $user = $this->getUser();
    $state = $request->query->get('state');
    
    $stateEnum = null;
    if ($state && ReportStateEnum::tryFrom($state)) {
        $stateEnum = ReportStateEnum::from($state);
    }
    
    $reports = $this->reportRepository->findByUser($user->getIntAdr(), $stateEnum);
    
    $data = $this->serializer->serialize($reports, 'json', [
        'groups' => ['report:read']
    ]);
    
    return new JsonResponse(json_decode($data));
}
```

**Chyby:**
- `401` - Nepřihlášený uživatel
- `500` - Chyba načítání seznamu

---

### 📈 GET `/api/portal/reports/statistics`

Načte statistiky hlášení a náhrad za zadané období.

**Autentifikace:** Vyžadováno  
**Query parametry:**
- `from` - Datum od (optional, default: -30 days)
- `to` - Datum do (optional, default: now)

**Request:**
```bash
GET /api/portal/reports/statistics?from=2025-01-01&to=2025-01-31
```

**Response:**
```json
{
    "period": {
        "from": "2025-01-01",
        "to": "2025-01-31"
    },
    "compensation": {
        "total_amount": 15500,
        "total_reports": 12,
        "average_per_report": 1291.67,
        "breakdown": {
            "doprava": 8200,
            "stravne": 6100,
            "ubytovani": 1200
        }
    },
    "summary": {
        "by_state": {
            "draft": 3,
            "send": 7,
            "submitted": 2,
            "approved": 0,
            "rejected": 0
        },
        "total_working_hours": 156.5,
        "total_km": 2450
    }
}
```

**Backend queries:**
```php
public function getStatistics(Request $request): JsonResponse {
    $from = new \DateTimeImmutable($request->query->get('from', '-30 days'));
    $to = new \DateTimeImmutable($request->query->get('to', 'now'));
    
    // Complex aggregation queries
    $statistics = $this->reportRepository->getCompensationStatistics($from, $to);
    $summary = $this->reportRepository->getReportsSummaryByState();
    
    return new JsonResponse([
        'period' => [
            'from' => $from->format('Y-m-d'),
            'to' => $to->format('Y-m-d')
        ],
        'compensation' => $statistics,
        'summary' => $summary
    ]);
}
```

**Chyby:**
- `401` - Nepřihlášený uživatel
- `500` - Chyba načítání statistik

## 🚧 CMS Content Endpointy (TODO)

### 📚 GET `/api/portal/metodika`

Načte seznam metodik (zatím TODO).

**Response:**
```json
{
    "message": "Endpoint /metodika není zatím implementován - bude implementován v další fázi"
}
```

---

### 📥 GET `/api/portal/downloads`

Načte soubory ke stažení (zatím TODO).

**Response:**
```json
{
    "message": "Endpoint /downloads není zatím implementován - bude implementován v další fázi"
}
```

---

### 📄 GET `/api/portal/post`

Načte obsah stránek/příspěvků (zatím TODO).

**Response:**
```json
{
    "message": "Endpoint /post není zatím implementován - bude implementován v další fázi"
}
```

## 🏗️ Backend implementace

### **ReportRepository** - Database queries
```php
// src/Repository/ReportRepository.php
class ReportRepository extends ServiceEntityRepository {
    public function findByOrderAndUser(int $idZp, int $intAdr): ?Report {
        return $this->createQueryBuilder('r')
            ->andWhere('r.idZp = :id_zp')
            ->andWhere('r.intAdr = :int_adr')
            ->setParameter('id_zp', $idZp)
            ->setParameter('int_adr', $intAdr)
            ->getQuery()
            ->getOneOrNullResult();
    }
    
    public function findByUser(int $intAdr, ?ReportStateEnum $state = null): array {
        $qb = $this->createQueryBuilder('r')
            ->andWhere('r.intAdr = :int_adr')
            ->setParameter('int_adr', $intAdr)
            ->orderBy('r.updatedAt', 'DESC');
            
        if ($state) {
            $qb->andWhere('r.state = :state')
               ->setParameter('state', $state);
        }
        
        return $qb->getQuery()->getResult();
    }
    
    public function getCompensationStatistics(\DateTimeInterface $from, \DateTimeInterface $to): array {
        // Complex aggregation query s JSON data extraction
        $sql = "
            SELECT 
                COUNT(*) as total_reports,
                SUM(CAST(JSON_EXTRACT(calculation, '$.celkova_nahrada') AS DECIMAL(10,2))) as total_amount,
                AVG(CAST(JSON_EXTRACT(calculation, '$.celkova_nahrada') AS DECIMAL(10,2))) as average_per_report,
                SUM(CAST(JSON_EXTRACT(calculation, '$.breakdown.doprava') AS DECIMAL(10,2))) as doprava,
                SUM(CAST(JSON_EXTRACT(calculation, '$.breakdown.stravne') AS DECIMAL(10,2))) as stravne,
                SUM(CAST(JSON_EXTRACT(calculation, '$.breakdown.ubytovani') AS DECIMAL(10,2))) as ubytovani
            FROM report 
            WHERE updated_at BETWEEN :from AND :to
        ";
        
        $conn = $this->getEntityManager()->getConnection();
        $stmt = $conn->prepare($sql);
        $result = $stmt->executeQuery(['from' => $from, 'to' => $to]);
        
        return $result->fetchAssociative();
    }
}
```

### **ReportDto** - Validation
```php
// src/Dto/ReportDto.php  
class ReportDto {
    #[Assert\NotBlank]
    #[Assert\Type('integer')]
    public int $id_zp;
    
    #[Assert\NotBlank]
    #[Assert\Length(max: 20)]
    public string $cislo_zp;
    
    #[Assert\Type('boolean')]
    public bool $je_vedouci = false;
    
    #[Assert\Choice(callback: [ReportStateEnum::class, 'values'])]
    public string $state = 'draft';
    
    #[Assert\Valid]
    public array $data_a = [];
    
    #[Assert\Valid] 
    public array $data_b = [];
    
    #[Assert\Valid]
    public array $calculation = [];
}
```

### **Report Entity** - Database model
```php
// src/Entity/Report.php
#[ORM\Entity(repositoryClass: ReportRepository::class)]
class Report {
    #[ORM\Id]
    #[ORM\GeneratedValue]
    private ?int $id = null;
    
    #[ORM\Column]
    private int $idZp;
    
    #[ORM\Column(length: 20)]
    private string $cisloZp;
    
    #[ORM\Column]
    private int $intAdr;
    
    #[ORM\Column]
    private bool $jeVedouci = false;
    
    #[ORM\Column(type: 'string', enumType: ReportStateEnum::class)]
    private ReportStateEnum $state = ReportStateEnum::DRAFT;
    
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $dataA = null;
    
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $dataB = null;
    
    #[ORM\Column(type: 'json', nullable: true)] 
    private ?array $calculation = null;
    
    #[ORM\Column]
    private \DateTimeImmutable $createdAt;
    
    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;
    
    public function isEditable(): bool {
        return $this->state->isEditable();
    }
}
```

## 💻 Frontend integrace

### **Report workflow v React**
```javascript
// Load existing report
const loadReport = async (prikazId) => {
    const response = await fetch(`/api/portal/report?id_zp=${prikazId}`, {
        credentials: 'same-origin'
    });
    
    if (response.status === 204) {
        return null; // No existing report
    }
    
    return await response.json();
};

// Save report (create or update)
const saveReport = async (reportData) => {
    const response = await fetch('/api/portal/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(reportData)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Save failed');
    }
    
    return await response.json();
};

// State management
const [report, setReport] = useState(null);
const [isDraft, setIsDraft] = useState(true);

const handleStateChange = (newState) => {
    if (newState === 'send' && !validateReport(report)) {
        alert('Report není kompletní pro odeslání');
        return;
    }
    
    setReport({...report, state: newState});
    saveReport({...report, state: newState});
};
```

### **Statistics dashboard**
```javascript
// Load statistics for dashboard
const loadStatistics = async (from, to) => {
    const params = new URLSearchParams({
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0]
    });
    
    const response = await fetch(`/api/portal/reports/statistics?${params}`, {
        credentials: 'same-origin'
    });
    
    return await response.json();
};
```

## 🧪 Testování

### **Report CRUD testing**
```bash
# Load existing report  
curl -H "Cookie: PHPSESSID=..." "https://portalznackare.ddev.site/api/portal/report?id_zp=123"

# Save report
curl -X POST "https://portalznackare.ddev.site/api/portal/report" \
  -H "Content-Type: application/json" \
  -H "Cookie: PHPSESSID=..." \
  -d '{"id_zp": 123, "cislo_zp": "ZP001/2025", "state": "draft", "data_a": {...}}'

# Get user reports
curl -H "Cookie: PHPSESSID=..." "https://portalznackare.ddev.site/api/portal/reports/user"

# Get statistics
curl -H "Cookie: PHPSESSID=..." "https://portalznackare.ddev.site/api/portal/reports/statistics?from=2025-01-01&to=2025-01-31"
```

## 🛠️ Troubleshooting

### **Report validation errors**
- Zkontroluj ReportDto constraints
- Ověř JSON structure v data_a, data_b, calculation
- Kontrola required fields a data types

### **State transition problémy** 
- Pouze DRAFT a REJECTED stavy jsou editovatelné
- SEND stav zamyká hlášení pro editaci
- TODO stavy (SUBMITTED, APPROVED) zatím nejsou implementované

### **Statistics queries jsou pomalé**
- Optimalizace JSON extraction queries
- Database indexy na updated_at a int_adr columns
- Cache frequently requested statistics

### **CMS content chybí**
- Metodiky, downloads endpointy jsou zatím TODO
- Mock responses vrací 501 Not Implemented
- Skutečná implementace bude v další fázi

---

**Funkcionální dokumentace:** [../features/hlaseni-prikazu.md](../features/hlaseni-prikazu.md)  
**API přehled:** [overview.md](overview.md)  
**Aktualizováno:** 2025-07-31