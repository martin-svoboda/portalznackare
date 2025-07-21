# Portál značkaře - Claude AI Context

## O projektu
Portál značkaře je aplikace na **hybridní Symfony 6.4 LTS + React micro-apps** architektuře pro správu turistického značení. Aplikace slouží značkařům KČT pro evidenci příkazů, hlášení práce a správu dokumentace.

## Technický stack
- **Backend:** Symfony 6.4 LTS, PHP 8.3
- **Frontend:** Hybrid - Twig templating + React 18 micro-apps, Tailwind CSS + BEM
- **React UI:** Material UI pouze pro tabulky (Material React Table), jinak Tailwind
- **Databáze:** PostgreSQL (nový obsah) + MSSQL (stávající data přes mock)
- **Development:** DDEV, Webpack Encore
- **URL:** https://portalznackare.ddev.site

## Architektura
```
Twig Pages → React Apps → Symfony API → Mock MSSQL Service
           ↘ Tailwind+BEM  ↘ PostgreSQL (Doctrine ORM)
```

### Hybrid přístup
- **Symfony/Twig** pro routing, layouts, autentifikaci a statické stránky
- **React apps** pouze pro komplexní UI komponenty (tabulky, formuláře)
- **Material UI** pouze pro Material React Table komponenty
- **Tailwind CSS + BEM** pro veškerý ostatní styling

## Projektová struktura

### DŮLEŽITÉ: Původní aplikace a migrace
- **WP-src/portal/** - Zcela původní React aplikace z WordPress pluginu
- **assets/js-backup-20250719-160846/** - Částečně převedená aplikace (backup)
- **assets/js/apps/** - Nové micro-aplikace (aktuální)

### Backend (Symfony)
```
src/
├── Controller/
│   ├── Api/                      # REST API endpointy
│   │   ├── InsysController.php    # INSYS/MSSQL API
│   │   ├── PortalController.php   # Portal/PostgreSQL API
│   │   └── AuthController.php     # Autentifikace API
│   └── AppController.php          # Twig page controllers
├── Entity/                       # Doctrine entity (PostgreSQL)
├── Repository/                   # Database repositories
├── Security/                     # Symfony Security
│   ├── InsysAuthenticator.php     # Custom authenticator
│   ├── InsysUserProvider.php      # User provider
│   └── ApiAuthenticationEntryPoint.php
├── Service/                      # Business logika
│   ├── MockMSSQLService.php      # Mock služba pro MSSQL data
│   ├── InsysService.php          # INSYS API wrapper
│   ├── DataEnricherService.php   # Data enrichment
│   ├── TimService.php            # TIM ikony
│   └── ZnackaService.php         # Značky
└── Twig/                         # Twig extensions
    └── KctExtension.php          # Custom Twig funkce
```

### Frontend (Hybrid Twig + React)
```
assets/
├── js/
│   └── apps/                      # React micro-apps
│       ├── prikazy/               # Seznam příkazů
│       │   ├── App.jsx            # Main component
│       │   ├── index.jsx          # Entry point
│       │   └── components/        # Shared components
│       │       ├── PrikazStavBadge.jsx
│       │       ├── PrikazTypeIcon.jsx
│       │       └── textIconReplacer.jsx
│       └── prikaz-detail/         # Detail příkazu
│           ├── App.jsx            # Main component
│           └── index.jsx          # Entry point
├── css/
│   ├── app.scss                   # Main stylesheet
│   └── components/                # BEM components
│       ├── variables.scss         # CSS variables pro dark mode
│       ├── base.scss             # Base styles a resets
│       ├── alert.scss            # Alert component (.alert)
│       ├── action-card.scss      # Action card (.action-card)
│       ├── breadcrumbs.scss      # Navigation (.breadcrumbs)
│       ├── button.scss           # Buttons (.btn)
│       ├── form.scss             # Form elements (.form)
│       ├── navigation.scss       # Main navigation (.nav)
│       └── statistics.scss       # Statistics cards (.stats)
└── images/                        # Static assets (značky, ikony)

templates/
├── base.html.twig                 # Main layout
├── components/                    # Reusable Twig components
│   ├── alert.html.twig           # Alert messages
│   ├── action-card.html.twig     # Action cards
│   ├── login-form.html.twig      # Login form
│   ├── page-header.html.twig     # Page headers
│   ├── statistics-card.html.twig # Stats display
│   └── kct/                      # KČT specific components
│       └── znacka.html.twig      # Značka component
└── pages/                         # Page templates
    ├── dashboard.html.twig        # Dashboard
    ├── prikazy.html.twig         # Příkazy list (React app)
    ├── prikaz-detail.html.twig   # Příkaz detail (React app)
    ├── downloads.html.twig       # Downloads page
    └── metodika.html.twig        # Metodika page
```

## API Endpointy

### INSYS API (MSSQL mock data)
```
POST /api/insys/login             # Přihlášení (JSON i form data)
GET  /api/insys/user              # Detail uživatele  
GET  /api/insys/prikazy           # Seznam příkazů (s filtrem roku)
GET  /api/insys/prikaz/{id}       # Detail příkazu
```

### Portal API (PostgreSQL data)
```
GET  /api/portal/methodologies    # Metodiky
GET  /api/portal/downloads        # Ke stažení

# File Management API
POST /api/portal/files/upload     # Upload souboru s path a is_public parametrem
GET  /api/portal/files/{id}       # Detail souboru
DELETE /api/portal/files/{id}     # Smazání souboru (soft-delete)
POST /api/portal/files/usage      # Přidat usage tracking
DELETE /api/portal/files/usage    # Odebrat usage tracking

# File Serving (automatické routing podle typu)
GET /uploads/{path}/{token}/{filename}  # Chráněné soubory s hash tokenem
GET /uploads/{path}/{filename}          # Veřejné soubory bez tokenu
```

### Autentifikace
- **Test přihlášení:** username: `test`, password: `test`
- **Symfony Security** s custom authenticator
- **Session-based** auth s JSON API podporou

## React Apps - Micro-frontend přístup

### Aplikace v provozu
1. **Prikazy List** (`/prikazy`) - Material React Table se seznamem příkazů
2. **Prikaz Detail** (`/prikaz/{id}`) - Detail view s informacemi o příkazu

### Jak fungují React apps
```javascript
// Entry point (index.jsx)
const container = document.querySelector('[data-app="prikazy"]');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}

// V Twig template
<div data-app="prikazy"></div>
{{ encore_entry_script_tags('app-prikazy') }}
```

### Material React Table použití
```javascript
// Pouze pro tabulky - s automatickým dark mode
const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
);

useEffect(() => {
    const observer = new MutationObserver(() => {
        setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });
    return () => observer.disconnect();
}, []);

const theme = createTheme({
    palette: {
        mode: isDarkMode ? 'dark' : 'light',
    },
});

<ThemeProvider theme={theme}>
    <MaterialReactTable table={table} />
</ThemeProvider>
```

### Webpack konfigurace
```javascript
// webpack.config.js
.addEntry('app-prikazy', './assets/js/apps/prikazy/index.jsx')
.addEntry('app-prikaz-detail', './assets/js/apps/prikaz-detail/index.jsx')
```

## Styling konvence - Tailwind CSS + BEM

### BEM metodika s Tailwind
```scss
// assets/css/components/button.scss
.btn {
    @apply px-4 py-2 rounded font-medium transition-colors;
    
    &--primary {
        @apply bg-blue-600 text-white hover:bg-blue-700;
        @apply dark:bg-blue-700 dark:hover:bg-blue-800;
    }
    
    &--secondary {
        @apply bg-gray-200 text-gray-800 hover:bg-gray-300;
        @apply dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600;
    }
    
    &--danger {
        @apply bg-red-600 text-white hover:bg-red-700;
        @apply dark:bg-red-700 dark:hover:bg-red-800;
    }
}
```

### Dark mode konvence
```scss
// Vždy používej dark: prefixy
.card {
    @apply bg-white text-gray-900;
    @apply dark:bg-gray-800 dark:text-gray-100;
    
    &__header {
        @apply border-b border-gray-200;
        @apply dark:border-gray-700;
    }
}

// CSS proměnné pro dynamické hodnoty
:root {
    --primary-color: #3b82f6;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --danger-color: #ef4444;
}

.dark {
    --primary-color: #60a5fa;
    --success-color: #34d399;
    --warning-color: #fbbf24;
    --danger-color: #f87171;
}
```

### Twig template použití
```twig
{# BEM třídy #}
<div class="card card--elevated">
    <div class="card__header">
        <h2 class="card__title">Nadpis</h2>
    </div>
    <div class="card__body">
        <p class="card__text">Obsah karty</p>
    </div>
</div>

{# Komponenty s parametry #}
{% include 'components/alert.html.twig' with {
    type: 'warning',
    title: 'Upozornění',
    content: 'Zpráva pro uživatele'
} %}

{# Tailwind utility třídy #}
<div class="flex items-center justify-between p-4 bg-white dark:bg-gray-800">
    <span class="text-sm text-gray-600 dark:text-gray-400">Status</span>
    <span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded dark:bg-green-900 dark:text-green-200">
        Aktivní
    </span>
</div>
```

## Důležité principy

### Komponenty a opakovatelnost
**DŮLEŽITÉ**: Jakmile se nějaký prvek bude opakovat nebo je možnost že se bude opakovat, vytvoří se jako samostatná komponenta. To platí pro:
- JavaScript/JSX komponenty
- Twig komponenty
- PHP třídy a služby
- CSS/SCSS komponenty

Příklady:
- Loader - vytvořen jako sdílená komponenta místo opakování inline kódu
- Alert komponenty - reusable Twig komponenty
- Form prvky - sdílené komponenty pro jednotné UI

## Coding Standards

### React (JSX)
```javascript
// Komponenty - PascalCase, JSX pro jednoduchost
const App = () => {
    // Hooks na začátku
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Event handlers
    const handleClick = (id) => {
        // Logic here
    };
    
    // Render
    return (
        <div className="container">
            <h1 className="text-2xl font-bold">Nadpis</h1>
        </div>
    );
};

// Files: App.jsx pro hlavní komponenty, index.jsx pro entry pointy
// Export default vždy na konci
export default App;
```

### Tabler Icons v React
```javascript
// Vždy použij Tabler Icons místo custom SVG
import { 
    IconArrowLeft, 
    IconTool, 
    IconDownload,
    IconEdit 
} from '@tabler/icons-react';

<IconArrowLeft size={16} />
<IconTool size={20} className="text-blue-600" />
```

### Twig
```twig
{# Komponenty s BEM třídami #}
<div class="alert alert--{{ type|default('info') }}">
    <div class="alert__content">
        {% if title is defined and title %}
            <h3 class="alert__title">{{ title }}</h3>
        {% endif %}
        <div class="alert__body">{{ content }}</div>
    </div>
</div>

{# Dark mode support #}
<div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
```

### PHP (Symfony)
```php
// Controllers - clean actions
#[Route('/prikazy', name: 'app_prikazy')]
public function prikazy(): Response
{
    return $this->render('pages/prikazy.html.twig');
}

// API responses s error handling
try {
    $data = $this->insysService->getPrikazy($year);
    return new JsonResponse($data);
} catch (\Exception $e) {
    return new JsonResponse(['error' => $e->getMessage()], 500);
}

// Services s dependency injection
public function __construct(
    private MockMSSQLService $mockService,
    private DataEnricherService $enricher
) {}
```

## Development workflow

### Příkazy
```bash
# Development
ddev start                        # Spustí DDEV
ddev npm run watch               # Webpack watching
ddev npm run build               # Production build

# Testování API
curl https://portalznackare.ddev.site/api/insys/prikazy
curl -X POST https://portalznackare.ddev.site/api/insys/login \
  -d "username=test&password=test"

# Symfony
ddev exec bin/console cache:clear
ddev exec bin/console debug:router
ddev exec bin/console debug:autowiring
```

### Debugging
- **Symfony Profiler:** `/_profiler` v dev módu
- **React DevTools:** pro React komponenty  
- **Browser DevTools:** pro CSS a JavaScript
- **Symfony Debug Toolbar:** pro API calls a autentifikaci

## Specifické konvence projektu

### Názvy souborů
- **React komponenty:** `App.jsx`, `ComponentName.jsx` (PascalCase)
- **React entry points:** `index.jsx`
- **Twig templates:** `kebab-case.html.twig`
- **SCSS soubory:** `kebab-case.scss`
- **PHP třídy:** `PascalCase.php`

### Organizace React apps
```
assets/js/apps/app-name/
├── App.jsx              # Hlavní komponenta
├── index.jsx            # Entry point pro webpack
└── components/          # Sdílené komponenty jen pro tuto app
    ├── ComponentA.jsx
    └── ComponentB.jsx
```

### BEM komponenty
```scss
// Jeden komponent = jeden SCSS soubor
// assets/css/components/card.scss
.card {
    // Base styles
    @apply bg-white rounded-lg shadow;
    @apply dark:bg-gray-800;
    
    // Elements
    &__header {
        @apply p-4 border-b border-gray-200;
        @apply dark:border-gray-700;
    }
    
    &__body {
        @apply p-4;
    }
    
    &__title {
        @apply text-lg font-semibold text-gray-900;
        @apply dark:text-gray-100;
    }
    
    // Modifiers
    &--elevated {
        @apply shadow-lg;
    }
    
    &--compact {
        .card__header,
        .card__body {
            @apply p-2;
        }
    }
}
```

## Časté úkoly

### Přidání nové React aplikace
1. Vytvoř složku `assets/js/apps/app-name/`
2. Vytvoř `App.jsx` a `index.jsx`
3. Přidej webpack entry do `webpack.config.js`
   ```javascript
   .addEntry('app-name', './assets/js/apps/app-name/index.jsx')
   ```
4. Vytvoř Twig template s `data-app="app-name"`
5. Přidej Symfony route do `AppController`

### Přidání nové BEM komponenty
1. Vytvoř `assets/css/components/component-name.scss`
2. Implementuj s BEM strukturou a Tailwind @apply
3. Importuj v `assets/css/app.scss`
4. Vytvoř odpovídající Twig komponentu v `templates/components/`

### Přidání nové Twig komponenty
1. Vytvoř `templates/components/component-name.html.twig`
2. Definuj parametry pomocí `{% set %}`
3. Implementuj s BEM třídami a dark mode supportem
4. Použij `{% include %}` v template

### Přidání nového API endpointu
1. Přidej metodu do příslušného API Controller
2. Přidej `#[Route]` atribut
3. Implementuj error handling a validaci
4. Test pomocí curl nebo API klienta

## Mock MSSQL Service

### Test data struktura
```json
{
    "users": {
        "test": {
            "INT_ADR": 12345,
            "JMENO": "Test",
            "PRIJMENI": "Značkař"
        }
    },
    "prikazy": [
        {
            "ID_Znackarske_Prikazy": 1,
            "Cislo_ZP": "ZP001/2025",
            "Druh_ZP_Naz": "Údržba značení",
            "Stav_ZP_Naz": "Přidělený"
        }
    ]
}
```

### API mock odpovědi
- **Login:** Ověří test/test credentials
- **Prikazy:** Vrací mock data s možností filtru roku
- **User:** Vrací mock uživatelské data

## KČT rozšíření (Twig)

### Značky a TIM ikony
```twig
{# Značka komponent #}
{{ kct_znacka('cervena', 'horizontal', 16) }}

{# TIM ikony #}
{{ kct_tim('hrad', 24) }}
{{ kct_tim('vrchol', 20, 'blue') }}

{# Text s ikonami #}
{{ kct_text_with_icons('Trasa vede k &HRAD a &VRCHOL', 16) }}
```

## Migrace poznámky

### Aktuální stav (✅ Hotovo)
- Hybrid Symfony/Twig + React architektura
- Material UI pouze pro tabulky (Material React Table)
- Tailwind CSS + BEM pro veškerý styling
- Dark mode funkcionalita s automatickou detekcí
- Reusable Twig komponenty s BEM strukturou
- Symfony Security integrace s test přihlášením
- React apps jako micro-frontend

### Klíčové rozdíly oproti SPA
- **Pages:** Twig templating místo React routing
- **Styling:** Tailwind + BEM místo CSS-in-JS nebo UI knihoven
- **Apps:** Micro-apps místo monolitické SPA
- **Bundle:** Separátní webpack entries místo jednoho
- **State:** Lokální state v apps místo globálního

## File Management System

### Veřejné vs. Chráněné soubory

**Chráněné soubory (s hash tokenem v URL):**
- Hlášení příkazů a jejich přílohy  
- Interní dokumenty
- Uživatelské soubory
- **URL struktura:** `/uploads/reports/2025/kkz/obvod/prikaz-id/hash_token/filename.jpg`
- **Robots.txt:** Zakázáno indexování

**Veřejné soubory (bez hash tokenu):**
- Metodiky, návody, dokumentace
- Galerie, veřejné přílohy
- **URL struktura:** `/uploads/methodologies/category/filename.jpg`
- **Robots.txt:** Povoleno indexování

### Použití v React komponentách

```javascript
// Chráněné soubory (výchozí)
<AdvancedFileUpload
    storagePath={`reports/${year}/${kkz}/${obvod}/${prikazId}`}
    isPublic={false} // výchozí
/>

// Veřejné soubory
<AdvancedFileUpload
    storagePath="methodologies/znaceni"
    isPublic={true}
/>
```

### FileUploadService helper metody

```php
// Automatické rozpoznání podle cesty
$service->uploadFile($file, $user, 'reports/2025/praha/1/123'); // chráněný
$service->uploadFile($file, $user, 'methodologies/general');     // veřejný

// Explicitní nastavení
$service->uploadFile($file, $user, $path, ['is_public' => true]);

// Helper metody
$service->generateReportPath(2025, 'praha', '1', 123);
$service->generateMethodologyPath('znaceni');
$service->generateDownloadPath('forms');
$service->generateGalleryPath('akce-2025');
```

## Při práci s kódem

### VŽDY používej
1. **JSX** místo TypeScript pro jednoduchost
2. **Material UI pouze pro tabulky** (Material React Table)
3. **Tailwind + BEM** pro veškerý ostatní styling
4. **Twig komponenty** pro opakující se UI
5. **Symfony Security** pro autentifikaci
6. **Dark mode support** ve všech komponentách

### Architekturní pravidla
- **React pouze pro komplexní UI** (tabulky, složité formuláře)
- **Twig pro routing, layout a statický obsah**
- **Material UI jen pro Material React Table**
- **Tailwind všude ostatně**
- **BEM metodika** pro komponenty
- **Dark mode povinný** ve všech stylech

### Styling workflow
1. Vytvoř BEM komponentu v `assets/css/components/`
2. Použij Tailwind `@apply` direktivy
3. Přidej dark mode varianty
4. Vytvoř odpovídající Twig komponentu
5. Testuj v light i dark mode

### Performance
- **Malé webpack bundles** díky micro-apps
- **Server-side rendering** pro statický obsah
- **Client-side interaktivita** jen kde potřeba
- **CSS optimalizace** přes PostCSS a Tailwind JIT

Tento kontext poskytuje kompletní informace o aktuální hybridní architektuře projektu s důrazem na Tailwind + BEM styling a Material UI pouze pro tabulky!