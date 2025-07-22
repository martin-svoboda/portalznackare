# Czech Localization - České skloňování

> **Topics dokumentace** - České skloňování jmen, oslovení a lokalizace

## 🇨🇿 Přehled české lokalizace

**Vokativ (5. pád):** Automatické skloňování jmen pro oslovení  
**Knihovna:** granam/czech-vocative pro správné české skloňování  
**Použití:** Dashboard pozdravy, emailové komunikace, personalizace  
**Integrace:** CzechVocativeService jako Symfony service

### Proč používat české skloňování?
- **Profesionální dojem** - správné oslovení v češtině
- **Personalizace** - uživatel se cítí více osloven
- **Jazyková správnost** - respekt k českému jazyku

## 📚 Granam Czech Vocative knihovna

### Instalace
```bash
composer require granam/czech-vocative
```

### Základní použití
```php
use Granam\CzechVocative\CzechName;

$czechName = new CzechName();
echo $czechName->vocative('Martin');  // "Martine"
echo $czechName->vocative('Petra');   // "Petro"
echo $czechName->vocative('Jiří');    // "Jiří"
```

**Vlastnosti knihovny:**
- Automatická detekce pohlaví podle jména
- Podpora složených jmen
- Fallback pro cizí jména
- Výjimky pro nepravidelná jména

## 🔧 CzechVocativeService

### Service implementace
```php
// src/Service/CzechVocativeService.php
class CzechVocativeService 
{
    /**
     * Převede jméno do 5. pádu (vokativ)
     */
    public function toVocative(string $name): string 
    {
        if (empty(trim($name))) {
            return $name;
        }
        
        try {
            $czechName = new CzechName();
            return $czechName->vocative($name);
        } catch (\Exception $e) {
            // Fallback pro cizí jména
            return $name;
        }
    }
    
    /**
     * Vytvoří oslovení s předponou
     */
    public function createGreeting(string $name, string $prefix = 'Dobrý den'): string 
    {
        if (empty(trim($name))) {
            return $prefix;
        }
        
        $vocativeName = $this->toVocative($name);
        return $prefix . ', ' . $vocativeName;
    }
    
    /**
     * Oslovení podle času dne
     */
    public function createTimeBasedGreeting(string $name): string 
    {
        $hour = (int) date('H');
        
        if ($hour >= 5 && $hour < 10) {
            $greeting = 'Dobré ráno';
        } elseif ($hour >= 10 && $hour < 18) {
            $greeting = 'Dobrý den';
        } elseif ($hour >= 18 && $hour < 22) {
            $greeting = 'Dobrý večer';
        } else {
            $greeting = 'Dobrou noc';
        }
        
        return $this->createGreeting($name, $greeting);
    }
}
```

### Service registrace
```yaml
# config/services.yaml
services:
    App\Service\CzechVocativeService: ~  # Auto-registered díky autowiring
```

## 🎯 Použití v aplikaci

### Dashboard Controller
```php
// src/Controller/AppController.php
#[Route('/nastenka', name: 'app_dashboard')]
public function dashboard(CzechVocativeService $vocativeService): Response
{
    $user = $this->getUser();
    $greeting = '';
    
    if ($user) {
        $firstName = $user->getJmeno() ?? '';
        
        if (!empty($firstName)) {
            $greeting = $vocativeService->createTimeBasedGreeting($firstName);
        }
    }
    
    return $this->render('pages/dashboard.html.twig', [
        'greeting' => $greeting
    ]);
}
```

### Twig template
```twig
{# templates/pages/dashboard.html.twig #}
{% if greeting %}
    <h1 class="text-2xl font-bold mb-4">{{ greeting }}!</h1>
{% else %}
    <h1 class="text-2xl font-bold mb-4">Vítejte na portálu značkaře!</h1>
{% endif %}
```

### Email templates
```twig
{# templates/emails/notification.html.twig #}
<p>{{ vocative_service.createGreeting(user.jmeno, 'Vážený') }},</p>

<p>rádi bychom Vás informovali o nových příkazech...</p>

<p>S pozdravem,<br>
Tým Portálu značkaře</p>
```

## 📖 Příklady skloňování

### Mužská jména
```php
$service->toVocative('Martin');    // "Martine"
$service->toVocative('Pavel');     // "Pavle"
$service->toVocative('Jiří');      // "Jiří"
$service->toVocative('Tomáš');     // "Tomáši"
$service->toVocative('Jan');       // "Jane"
$service->toVocative('Petr');      // "Petře"
```

### Ženská jména
```php
$service->toVocative('Petra');     // "Petro"
$service->toVocative('Jana');      // "Jano"
$service->toVocative('Marie');     // "Marie"
$service->toVocative('Lucie');     // "Lucie"
$service->toVocative('Tereza');    // "Terezo"
$service->toVocative('Barbora');   // "Barbaro"
```

### Složená jména
```php
$service->toVocative('Jan Pavel');      // "Jane Pavle"
$service->toVocative('Marie Anna');     // "Marie Anno"
$service->toVocative('Petr Novák');     // "Petře Nováku"
```

### Cizí jména (fallback)
```php
$service->toVocative('John');      // "John" (bez změny)
$service->toVocative('Michael');   // "Michael" (bez změny)
$service->toVocative('李明');       // "李明" (bez změny)
```

## 🌐 Další lokalizační aspekty

### Formátování data a času
```php
// České formátování data
setlocale(LC_TIME, 'cs_CZ.UTF-8');
echo strftime('%e. %B %Y'); // "21. července 2025"

// Symfony IntlDateFormatter
$formatter = new \IntlDateFormatter(
    'cs_CZ',
    \IntlDateFormatter::LONG,
    \IntlDateFormatter::NONE
);
echo $formatter->format(new \DateTime()); // "21. července 2025"
```

### České řazení (collation)
```php
// Správné řazení s českými znaky
$collator = new \Collator('cs_CZ');
$names = ['Čech', 'Adamec', 'Žák', 'Šimek'];
$collator->sort($names);
// Výsledek: ['Adamec', 'Čech', 'Šimek', 'Žák']
```

### Číselné formáty
```php
// České formátování čísel
$formatter = new \NumberFormatter('cs_CZ', \NumberFormatter::DECIMAL);
echo $formatter->format(1234.56); // "1 234,56"

// Měna
$formatter = new \NumberFormatter('cs_CZ', \NumberFormatter::CURRENCY);
echo $formatter->formatCurrency(1234.56, 'CZK'); // "1 234,56 Kč"
```

## 🧪 Testování skloňování

### Unit testy
```php
// tests/Service/CzechVocativeServiceTest.php
class CzechVocativeServiceTest extends TestCase
{
    private CzechVocativeService $service;
    
    protected function setUp(): void
    {
        $this->service = new CzechVocativeService();
    }
    
    public function testMaleNames(): void
    {
        $this->assertEquals('Martine', $this->service->toVocative('Martin'));
        $this->assertEquals('Pavle', $this->service->toVocative('Pavel'));
        $this->assertEquals('Jiří', $this->service->toVocative('Jiří'));
    }
    
    public function testFemaleNames(): void
    {
        $this->assertEquals('Petro', $this->service->toVocative('Petra'));
        $this->assertEquals('Jano', $this->service->toVocative('Jana'));
        $this->assertEquals('Marie', $this->service->toVocative('Marie'));
    }
    
    public function testEmptyName(): void
    {
        $this->assertEquals('', $this->service->toVocative(''));
        $this->assertEquals('', $this->service->toVocative('   '));
    }
    
    public function testForeignNames(): void
    {
        $this->assertEquals('John', $this->service->toVocative('John'));
        $this->assertEquals('Michael', $this->service->toVocative('Michael'));
    }
    
    public function testTimeBasedGreeting(): void
    {
        // Mock time to morning
        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('createTimeBasedGreeting');
        
        // Test morning greeting
        $this->assertStringContainsString('Dobré ráno', 
            $this->service->createTimeBasedGreeting('Martin'));
    }
}
```

### Integration testy
```php
// tests/Controller/DashboardTest.php
class DashboardTest extends WebTestCase
{
    public function testDashboardGreeting(): void
    {
        $client = static::createClient();
        
        // Login as user
        $client->loginUser($this->createUser('Martin'));
        
        $crawler = $client->request('GET', '/nastenka');
        
        $this->assertResponseIsSuccessful();
        $this->assertSelectorTextContains('h1', 'Martine');
    }
}
```

## 🚀 Best practices

### 1. Graceful fallback
```php
// Vždy mějte fallback pro případ selhání
try {
    $greeting = $vocativeService->toVocative($name);
} catch (\Exception $e) {
    $greeting = $name; // Použij původní jméno
    $logger->warning('Vocative conversion failed', [
        'name' => $name,
        'error' => $e->getMessage()
    ]);
}
```

### 2. Cache výsledků
```php
// Pro často používaná jména
class CachedVocativeService
{
    private array $cache = [];
    
    public function toVocative(string $name): string
    {
        if (!isset($this->cache[$name])) {
            $this->cache[$name] = $this->vocativeService->toVocative($name);
        }
        
        return $this->cache[$name];
    }
}
```

### 3. Validace vstupu
```php
// Očistěte vstup před skloňováním
public function toVocative(string $name): string
{
    $name = trim($name);
    $name = preg_replace('/\s+/', ' ', $name); // Více mezer → jedna
    
    if (empty($name)) {
        return '';
    }
    
    // Pouze první písmeno velké
    $name = mb_convert_case($name, MB_CASE_TITLE, 'UTF-8');
    
    return parent::toVocative($name);
}
```

## 🔍 Debugging

### Symfony profiler
```php
// Přidejte vocative info do profiler
class VocativeDataCollector extends DataCollector
{
    protected function collect(Request $request, Response $response, \Throwable $exception = null)
    {
        $this->data = [
            'conversions' => $this->vocativeService->getConversionLog(),
            'cache_hits' => $this->vocativeService->getCacheHits(),
        ];
    }
}
```

### Console command
```bash
# Test vocative conversion
ddev exec bin/console app:vocative:test "Martin Pavel"
# Output: Martin Pavel → Martine Pavle
```

## 📋 Známé problémy a řešení

### Nepravidelná jména
```php
// Některá jména mají nepravidelné skloňování
private array $irregularNames = [
    'Mojžíš' => 'Mojžíši',
    'Nikola' => 'Nikolo', // ženské i mužské
    // ...
];

public function toVocative(string $name): string
{
    if (isset($this->irregularNames[$name])) {
        return $this->irregularNames[$name];
    }
    
    return parent::toVocative($name);
}
```

### Detekce pohlaví
```php
// Pro nejasná jména můžete přidat hint
$vocativeService->toVocativeWithGender('Nikola', 'female'); // "Nikolo"
$vocativeService->toVocativeWithGender('Nikola', 'male');   // "Nikolo"
```

---

**Related Services:** [../configuration/services.md](../configuration/services.md)  
**Controller Usage:** [../features/authentication.md](../features/authentication.md)  
**Granam Library:** [https://github.com/jaroslavtyc/granam-czech-vocative](https://github.com/jaroslavtyc/granam-czech-vocative)  
**Aktualizováno:** 2025-07-22