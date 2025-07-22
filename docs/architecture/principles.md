# Architektonické principy a konvence

> **Dokumentace principů** - Obecné principy, kódovací standardy a konvence používané v projektu

## 🏗️ Architektonické principy

### 1. **Hybrid architektura**
- **Symfony 6.4 LTS** jako backend framework
- **Twig templating** pro server-side rendering a layouty  
- **React 18 micro-apps** pouze pro komplexní interaktivní komponenty
- **PostgreSQL** pro aplikační data + **MSSQL** pro INSYS integraci

### 2. **Micro-frontend přístup**
- React aplikace jako samostatné micro-apps místo monolitické SPA
- Každá React app má vlastní webpack entry point
- Minimální sdílený state, lokální state v každé aplikaci
- Server-side HTML/SVG generování kde možné

### 3. **API-first design**
- RESTful API endpointy pro všechny operace
- Jasné oddělení INSYS API vs. Portal API  
- JSON responses s konzistentní error handling
- Session-based autentifikace s JSON API podporou

## 🛠️ Tech Stack

### Backend
```php
// composer.json - základní závislosti
"php": ">=8.3"
"symfony/framework-bundle": "6.4.*"  
"doctrine/orm": "^3.5"
"nelmio/cors-bundle": "^2.5"
"granam/czech-vocative": "^2.2"   // České skloňování
```

### Frontend  
```json
// package.json - klíčové dependencies
"react": "^18.2.0"
"material-react-table": "^3.2.1"  // Pouze pro tabulky
"@tabler/icons-react": "^2.40.0"  // Ikony
"tailwindcss": "^3.4.0"          // Primary CSS framework

// Poznámka: @mantine/core je legacy z původní SPA, 
// nové komponenty používají nativní React + Tailwind
```

### Build systém
```javascript
// webpack.config.js - micro-apps struktura
.addEntry('app-prikazy', './assets/js/apps/prikazy/index.jsx')
.addEntry('app-prikaz-detail', './assets/js/apps/prikaz-detail/index.jsx')  
.addEntry('app-hlaseni-prikazu', './assets/js/apps/hlaseni-prikazu/index.jsx')
.addStyleEntry('app-styles', './assets/css/app.scss')
```

## 📝 Kódovací konvence

### PHP (Symfony)
```php
// PSR-4 autoloading
namespace App\Controller\Api;
namespace App\Service;
namespace App\Entity;

// Naming conventions
class InsysController extends AbstractController  // PascalCase pro třídy
public function getPrikazy(): JsonResponse      // camelCase pro metody
private string $projectDir                      // camelCase pro proměnné

// Dependency Injection
public function __construct(
    private InsysService $insysService,         // Constructor promotion
    private DataEnricherService $dataEnricher   
) {}
```

### React/JavaScript
```javascript
// Komponenty - PascalCase
const App = () => { /* ... */ };
const AdvancedFileUpload = () => { /* ... */ };

// Soubory
App.jsx                    // Hlavní komponenty
index.jsx                  // Entry pointy  
compensationCalculator.js  // Utility funkce - camelCase

// Hooks a funkce
const [data, setData] = useState([]);
const handleSubmit = (values) => { /* ... */ };

// Export default na konci
export default App;
```

### CSS/SCSS
```scss
// BEM metodika + Tailwind utilities
.card {
    @apply bg-white rounded-lg shadow;
    @apply dark:bg-gray-800;          // Dark mode povinný
    
    &__header {                       // BEM element
        @apply p-4 border-b border-gray-200;
        @apply dark:border-gray-700;
    }
    
    &--elevated {                     // BEM modifier
        @apply shadow-lg;
    }
}

// CSS proměnné pro dynamic values
:root {
    --primary-color: #3b82f6;
}

.dark {
    --primary-color: #60a5fa;
}
```

### Twig Templates
```twig
{# Komponenty s BEM třídami #}
<div class="alert alert--{{ type|default('info') }}">
    {% if title is defined and title %}
        <h3 class="alert__title">{{ title }}</h3>
    {% endif %}
    <div class="alert__body">{{ content }}</div>
</div>

{# Dark mode support všude #}
<div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">

{# KČT rozšíření pro značky #}
{{ kct_znacka('CE', 'PA', 'PZT', 16) }}
{{ kct_tim_preview(predmet_data) }}  {# Vyžaduje kompletní predmet data #}
```

## 📂 Organizace souborů

### Backend struktura
```
src/
├── Controller/
│   ├── Api/              # REST API controllers  
│   └── AppController.php # Twig page controllers
├── Entity/               # Doctrine entities
├── Service/              # Business logika
├── Security/             # Autentifikace komponenty
└── Twig/                 # Custom Twig extensions
```

### Frontend struktura
```
assets/
├── js/
│   ├── apps/             # React micro-aplikace
│   │   ├── prikazy/
│   │   ├── prikaz-detail/
│   │   └── hlaseni-prikazu/
│   ├── components/       # Sdílené React komponenty
│   └── utils/            # Utility funkce
├── css/
│   ├── app.scss          # Main stylesheet 
│   └── components/       # BEM component styles
└── images/               # Static assets
```

## 🎯 Design principy

### 1. **Reusability**
- Jakákoli komponenta/funkce použitá 2x+ → extrahuj do sdílené komponenty
- Twig komponenty pro opakující se UI
- Services pro sdílenou business logiku
- Utility funkce pro časté operace

### 2. **Testability**
- Dependency Injection ve všech service třídách
- Čisté funkce bez side-effects kde možné
- Mock služby pro development (USE_TEST_DATA flag)

### 3. **Security**
- Hash tokeny pro file serving
- CSRF protection na všech forms
- Input validation na API endpoints
- SQL injection protection přes Doctrine ORM

### 4. **Performance**
- Server-side HTML/SVG generování
- Malé webpack bundles díky micro-apps
- Lazy loading React komponent
- CSS optimalizace přes PostCSS

## 🔧 Development workflow

### Environment setup
```bash
# Development s DDEV
ddev start
ddev composer install
ddev npm install
ddev npm run watch      # Live reload
```

### Code style
```bash
# PHP CS Fixer (pokud dostupný)
php-cs-fixer fix

# ESLint/Prettier pro JS (pokud konfigurováno)
npm run lint
```

### Testování
```bash
# Symfony testy
ddev exec bin/console about

# API testy (použij testovací endpointy)
curl https://portalznackare.ddev.site/api/test/insys-prikazy
curl https://portalznackare.ddev.site/api/test/insys-user

# Frontend build test
ddev npm run build
```

## 🚀 Deployment principy

### Environment konfigurace
```bash
# Development (DDEV)
USE_TEST_DATA=true       # Mock MSSQL data

# Production
USE_TEST_DATA=false      # Real MSSQL connection
APP_ENV=prod
```

### Build optimalizace
```javascript
// Production webpack optimalizace
.enableVersioning(Encore.isProduction())
.enableSourceMaps(!Encore.isProduction())
.cleanupOutputBeforeBuild()
```

---

**Souvisejících dokumentace:** [Hybrid Architecture](hybrid-architecture.md)  
**Data Flow:** [data-flow.md](data-flow.md)  
**Hlavní dokumentace:** [../overview.md](../overview.md)  
**Aktualizováno:** 2025-07-21