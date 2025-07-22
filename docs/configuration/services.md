# Services and Dependency Injection

> **Configuration dokumentace** - Symfony services, dependency injection a service tagy

## 🏗️ Přehled Service Container

**Dependency Injection:** Automatické injektování závislostí do services  
**Autowiring:** Symfony automaticky rozpozná typehints a injektuje správné services  
**Autoconfiguration:** Services jsou automaticky registrovány podle interface/parent class  
**Service Tags:** Speciální metadata pro event listeners, Twig extensions atd.

### Service container principy
- **Service = objekt** vytvořený containerem
- **Dependency injection** místo manual instantiation
- **Single instance** (default) - stejná instance všude
- **Lazy loading** - service se vytvoří až když je potřeba

## ⚙️ Services Configuration

### Default Configuration
```yaml
# config/services.yaml
services:
    # Default nastavení pro všechny services v tomto souboru
    _defaults:
        autowire: true      # Automaticky injektuje dependencies
        autoconfigure: true # Automaticky registruje podle typu
    
    # Registruje všechny třídy v src/ jako services
    App\:
        resource: '../src/'
        exclude:
            - '../src/DependencyInjection/'
            - '../src/Entity/'          # Entity nejsou services
            - '../src/Kernel.php'
```

**Autowiring:**
- Symfony analyzuje constructor typehints
- Automaticky injektuje správné services
- Funguje pro většinu případů bez konfigurace

**Autoconfiguration:**
- Command → automaticky registrován jako console command
- EventListener → automaticky tagován pro events
- TwigExtension → automaticky registrován do Twig

### Explicit Service Configuration
```yaml
# Services vyžadující speciální konfiguraci
App\Service\MockMSSQLService:
    arguments:
        $projectDir: '%kernel.project_dir%'

App\Controller\FileServeController:
    arguments:
        $projectDir: '%kernel.project_dir%'

App\Controller\HelpController:
    arguments:
        $projectDir: '%kernel.project_dir%'
```

**Explicitní arguments:**
- Když autowiring nemůže rozpoznat parameter
- Pro scalar values (string, int, bool)
- Pro parameters z container parameters

## 🏷️ Service Tags

### Event Listener Tag
```yaml
# API Exception listener pro JSON error responses
App\EventListener\ApiExceptionListener:
    tags:
        - { name: kernel.event_listener, event: kernel.exception, priority: 100 }
```

**Event listener properties:**
- `name: kernel.event_listener` - Identifikuje jako event listener
- `event: kernel.exception` - Specific event to listen to
- `priority: 100` - Vyšší číslo = dříve vykonáno

### Twig Extension Tag
```yaml
# Twig extension pro KČT komponenty
App\Twig\KctExtension:
    tags:
        - { name: twig.extension }
```

**Twig extension:**
- Automaticky registruje functions/filters do Twig
- `kct_znacka()`, `kct_tim()` functions
- Přístupné ve všech Twig templates

## 📦 Dostupné Services

### Core Services

#### MockMSSQLService
```php
// src/Service/MockMSSQLService.php
class MockMSSQLService
{
    public function __construct(
        private string $projectDir
    ) {
        $this->dataFile = $projectDir . '/WP-src/Functions/testdata.json';
    }
    
    public function getUserByEmail(string $email): ?array
    public function validatePassword(string $email, string $password): bool
    public function getPrikazy(?int $intAdr = null, ?int $year = null): array
    public function getPrikaz(int $id): ?array
}
```

**Účel:** Mock MSSQL data pro local development
- Čte test data z JSON souboru
- Simuluje INSYS/MSSQL responses
- Používá se když `USE_TEST_DATA=true`

#### InsysService
```php
// src/Service/InsysService.php  
class InsysService
{
    public function __construct(
        private MockMSSQLService $mockService,
        private MssqlConnector $mssqlConnector
    ) {}
    
    public function getUserByUsername(string $username): ?array
    public function validateCredentials(string $username, string $password): bool
    public function getPrikazy(int $intAdr, ?int $year = null): array
    public function getPrikaz(int $id): ?array
}
```

**Účel:** Wrapper pro INSYS komunikaci
- Přepíná mezi mock a real MSSQL
- Unified interface pro controllers
- Business logic pro INSYS data

#### FileUploadService
```php
// src/Service/FileUploadService.php
class FileUploadService
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private string $uploadDir
    ) {}
    
    public function uploadFile(
        UploadedFile $file,
        ?User $uploadedBy = null,
        ?string $storagePath = null,
        array $metadata = []
    ): FileAttachment
    
    public function generateSecureUrl(FileAttachment $file): string
    public function addUsage(FileAttachment $file, string $entityType, int $entityId): void
    public function removeUsage(FileAttachment $file, string $entityType, int $entityId): void
}
```

**Účel:** Správa uploadů a souborů
- Hash-based deduplication
- Security token generation
- Usage tracking pro garbage collection
- Public/private file rozdělení

### Visual Component Services

#### ZnackaService
```php
// src/Service/ZnackaService.php
class ZnackaService
{
    public function __construct(
        private ColorService $colorService
    ) {}
    
    public function znacka(
        string $barva,
        string $typ = 'horizontal',
        string $druh = 'pasova',
        int $size = 12,
        array $options = []
    ): string
}
```

**Účel:** Generování SVG turistických značek
- Různé typy značek (pásová, šipka, směrovka)
- Konfigurovatelné barvy a velikosti
- Vrací inline SVG HTML

#### TimService  
```php
// src/Service/TimService.php
class TimService
{
    public function tim(string $type, int $size = 16, ?string $color = null): string
    public function timPreview(array $item): ?string
}
```

**Účel:** Generování TIM (turistické informační místo) ikon
- SVG ikony pro různé typy TIM
- Automatická detekce typu z dat
- Inline SVG s Tailwind classes

#### TransportIconService
```php
// src/Service/TransportIconService.php
class TransportIconService
{
    private const ICON_MAP = [
        '&BUS' => '/images/bus.svg',
        '&TRAM' => '/images/tram.svg',
        '&ZST' => '/images/zst.svg',
        // ...
    ];
    
    public function replaceIconsInText(string $text): string
}
```

**Účel:** Nahrazování textových tagů za ikony
- Převádí &BUS → SVG ikona
- Používá se v popiscích tras
- Cachuje SVG pro performance

### Data Processing Services

#### DataEnricherService
```php
// src/Service/DataEnricherService.php
class DataEnricherService
{
    public function __construct(
        private ZnackaService $znackaService,
        private TimService $timService,
        private TransportIconService $transportIconService
    ) {}
    
    public function enrichPrikazyList(array $prikazy): array
    public function enrichPrikazDetail(array $detail): array
}
```

**Účel:** Obohacování dat z INSYS o HTML komponenty
- Přidává HTML značky do dat
- Nahrazuje text ikony za SVG
- Centralizovaná logika pro data enrichment

#### CzechVocativeService
```php
// src/Service/CzechVocativeService.php
class CzechVocativeService
{
    public function getVocative(string $name, ?string $gender = null): string
}
```

**Účel:** České skloňování - 5. pád
- Automatická detekce pohlaví
- Pravidla pro české skloňování
- Používá se pro personalizaci

## 🔌 Dependency Injection Patterns

### Constructor Injection (preferovaný)
```php
class MyService
{
    public function __construct(
        private OtherService $otherService,
        private EntityManagerInterface $entityManager
    ) {}
}
```

**Výhody:**
- Immutable dependencies
- Testovatelnost (mock injection)
- Explicitní závislosti

### Parameter Injection
```yaml
# config/services.yaml
App\Service\MyService:
    arguments:
        $uploadDir: '%kernel.project_dir%/var/uploads'
        $debugMode: '%kernel.debug%'
```

```php
class MyService
{
    public function __construct(
        private string $uploadDir,
        private bool $debugMode
    ) {}
}
```

### Service Locator Pattern
```php
// Pro dynamické service selection
class ServiceFactory
{
    public function __construct(
        private ServiceLocatorInterface $locator
    ) {}
    
    public function create(string $type): ServiceInterface
    {
        return $this->locator->get($type);
    }
}
```

## 🏭 Service Factories

### Vytvoření factory service
```php
// src/Service/ReportGeneratorFactory.php
class ReportGeneratorFactory
{
    public function __construct(
        private EntityManagerInterface $em,
        private TranslatorInterface $translator
    ) {}
    
    public function createGenerator(string $type): ReportGeneratorInterface
    {
        return match($type) {
            'pdf' => new PdfReportGenerator($this->em),
            'excel' => new ExcelReportGenerator($this->em),
            default => throw new \InvalidArgumentException()
        };
    }
}
```

### Registrace factory
```yaml
# config/services.yaml
App\Service\ReportGeneratorFactory: ~

# V controlleru
public function __construct(
    private ReportGeneratorFactory $factory
) {}

public function generate(string $type)
{
    $generator = $this->factory->createGenerator($type);
    return $generator->generate();
}
```

## 🧪 Testing Services

### Unit Testing
```php
// tests/Service/ZnackaServiceTest.php
class ZnackaServiceTest extends TestCase
{
    private ZnackaService $service;
    
    protected function setUp(): void
    {
        $colorService = $this->createMock(ColorService::class);
        $colorService->method('hexToRgb')->willReturn([255, 0, 0]);
        
        $this->service = new ZnackaService($colorService);
    }
    
    public function testZnackaGeneration(): void
    {
        $svg = $this->service->znacka('CE', 'horizontal', 'pasova', 12);
        
        $this->assertStringContainsString('<svg', $svg);
        $this->assertStringContainsString('viewBox', $svg);
    }
}
```

### Integration Testing
```php
// tests/Service/DataEnricherServiceTest.php
class DataEnricherServiceTest extends KernelTestCase
{
    private DataEnricherService $service;
    
    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();
        
        $this->service = $container->get(DataEnricherService::class);
    }
    
    public function testEnrichPrikazDetail(): void
    {
        $data = ['predmety' => [/* test data */]];
        $enriched = $this->service->enrichPrikazDetail($data);
        
        $this->assertArrayHasKey('Znacka_HTML', $enriched['predmety'][0]);
    }
}
```

## 📊 Service Performance

### Lazy Services
```yaml
# Pro heavy services - vytvoří se až při použití
App\Service\HeavyService:
    lazy: true
```

### Service Decoration
```yaml
# Dekorování existující service
App\Service\CachedInsysService:
    decorates: App\Service\InsysService
    arguments: ['@.inner']
```

```php
class CachedInsysService
{
    public function __construct(
        private InsysService $decorated,
        private CacheInterface $cache
    ) {}
    
    public function getPrikazy(int $intAdr, ?int $year = null): array
    {
        $key = sprintf('prikazy_%d_%d', $intAdr, $year ?? date('Y'));
        
        return $this->cache->get($key, function() use ($intAdr, $year) {
            return $this->decorated->getPrikazy($intAdr, $year);
        });
    }
}
```

## 🔍 Debugging Services

### Debug Commands
```bash
# List všech services
ddev exec bin/console debug:container

# Hledání konkrétní service
ddev exec bin/console debug:container znacka

# Detail service
ddev exec bin/console debug:container App\\Service\\ZnackaService

# Autowiring candidates
ddev exec bin/console debug:autowiring

# Service tags
ddev exec bin/console debug:container --tags
```

### Profiler Integration
```php
// Services jsou viditelné v Symfony Profiler
// /_profiler → Services tab

// Pro custom profiler data
class MyService
{
    use ProfilerAwareTrait;
    
    public function doSomething()
    {
        $this->stopwatch->start('my_operation');
        
        // ... operation ...
        
        $this->stopwatch->stop('my_operation');
    }
}
```

## ⚠️ Common Pitfalls

### Circular Dependencies
```php
// ❌ ŠPATNĚ - circular dependency
class ServiceA {
    public function __construct(ServiceB $b) {}
}

class ServiceB {
    public function __construct(ServiceA $a) {}
}

// ✅ SPRÁVNĚ - použij setter injection nebo refactor
class ServiceA {
    private ?ServiceB $b = null;
    
    public function setServiceB(ServiceB $b): void {
        $this->b = $b;
    }
}
```

### Service vs. Entity
```php
// ❌ ŠPATNĚ - Entity jako service
services:
    App\Entity\User: ~

// ✅ SPRÁVNĚ - Repository jako service
services:
    App\Repository\UserRepository: ~
```

### Stateful Services
```php
// ❌ ŠPATNĚ - state v service
class BadService {
    private array $data = [];
    
    public function addData($item) {
        $this->data[] = $item; // State se sdílí mezi requests!
    }
}

// ✅ SPRÁVNĚ - stateless service
class GoodService {
    public function processData(array $data): array {
        return array_map(/* ... */, $data);
    }
}
```

---

**Environment konfigurace:** [environment.md](environment.md)  
**Security konfigurace:** [security.md](security.md)  
**Symfony Services:** [https://symfony.com/doc/current/service_container.html](https://symfony.com/doc/current/service_container.html)  
**Aktualizováno:** 2025-07-22