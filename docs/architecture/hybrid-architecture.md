# Hybrid Architecture - Twig + React

> **Architekturní dokumentace** - Jak funguje hybridní přístup Twig server-side rendering s React micro-aplikacemi

## 🎯 Koncept hybrid architektury

### Základní princip
```
Symfony Router → Twig Template → React Mount Point → React App
                ↓
            Server HTML      +     Client Interactivity
```

**Proč hybrid místo SPA?**
- **SEO optimalizace:** Server-side rendering pro statický obsah
- **Rychlé načítání:** HTML okamžitě dostupné, React se hydratuje postupně
- **Selektivní interaktivita:** React pouze tam kde potřeba
- **Bezpečnost:** Autentifikace a routing řešeny server-side

## 🏗️ Architektura komponenty

### 1. **Twig Template (Server-side)**
```twig
{# templates/pages/prikazy.html.twig #}
{% extends 'base.html.twig' %}

{% block body %}
    <div class="container">
        {# Server-rendered header #}
        {% include 'components/page-header.html.twig' with {
            title: 'Moje příkazy',
            breadcrumbs: [...]
        } %}

        {# Conditional logic server-side #}
        {% if not app.user %}
            {% include 'components/alert.html.twig' with {
                type: 'warning',
                message: 'Pro zobrazení příkazů se musíte přihlásit.'
            } %}
        {% else %}
            {# React mount point #}
            <div data-app="prikazy">
                {% include 'components/loader.html.twig' %}
            </div>
        {% endif %}
    </div>
{% endblock %}

{# React app injection #}
{% block javascripts %}
    {{ parent() }}
    {{ encore_entry_script_tags('app-prikazy') }}
{% endblock %}
```

### 2. **React Entry Point (Client-side)**
```javascript
// assets/js/apps/prikazy/index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Mount na specifický element
const container = document.querySelector('[data-app="prikazy"]');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
```

### 3. **React App (Client-side)**
```javascript  
// assets/js/apps/prikazy/App.jsx
const App = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch data from Symfony API
        fetch('/api/insys/prikazy')
            .then(r => r.json())
            .then(data => {
                setData(data);
                setLoading(false);
            });
    }, []);

    return (
        <MaterialReactTable
            data={data}
            // ... table configuration
        />
    );
};
```

## 📦 Webpack konfigurace

### Micro-apps struktura
```javascript
// webpack.config.js
Encore
    // Separátní CSS bundle
    .addStyleEntry('app-styles', './assets/css/app.scss')
    
    // Každá React app = separátní entry  
    .addEntry('app-prikazy', './assets/js/apps/prikazy/index.jsx')
    .addEntry('app-prikaz-detail', './assets/js/apps/prikaz-detail/index.jsx')
    .addEntry('app-hlaseni-prikazu', './assets/js/apps/hlaseni-prikazu/index.jsx')
    
    // Aliasy pro import paths
    .addAliases({
        '@': path.resolve(__dirname, 'assets/js'),
        '@components': path.resolve(__dirname, 'assets/js/components')
    });
```

### Bundle loading strategie
```twig
{# base.html.twig - Global styles #}
{% block stylesheets %}
    {{ encore_entry_link_tags('app-styles') }}
{% endblock %}

{# Specifická page - specifický React bundle #}
{% block javascripts %}
    {{ parent() }}
    {{ encore_entry_script_tags('app-prikazy') }}  {# Pouze pro tuto stránku #}
{% endblock %}
```

## 🔄 Data flow

### Server → Client data passing

#### 1. **API-based (preferovaný přístup)**
```javascript
// React app volá Symfony API
useEffect(() => {
    fetch('/api/insys/prikazy?year=2025')
        .then(response => response.json())
        .then(data => setData(data));
}, []);
```

#### 2. **Inline data passing** 
```twig
{# Twig template #}
<div data-app="prikaz-detail" 
     data-prikaz-id="{{ id }}"
     data-user="{{ app.user ? {
         INT_ADR: app.user.intAdr,
         name: app.user.fullName
     }|json_encode|e('html_attr') : '{}' }}">
</div>
```

```javascript
// React app čte data attributes
const container = document.querySelector('[data-app="prikaz-detail"]');
const prikazId = container?.dataset?.prikazId;
const currentUser = container?.dataset?.user ? 
    JSON.parse(container.dataset.user) : null;
```

#### 3. **Server-rendered HTML consumption**
```twig
{# Symfony generuje HTML server-side #}
{% for predmet in detail.predmety %}
    <div class="tim-preview">
        {{ predmet.Tim_HTML|raw }}  {# HTML z TimService #}
        {{ predmet.Znacka_HTML|raw }}  {# SVG ze ZnackaService #}
    </div>
{% endfor %}
```

```javascript
// React používá server HTML jako základ
const serverRenderedContent = container.innerHTML;
// React může tento obsah dále obohacovat
```

## 🎨 Styling integration

### CSS Architecture
```scss
// app.scss - Global styles (server i client)
@import 'tailwindcss/base';
@import 'tailwindcss/components'; 
@import 'tailwindcss/utilities';

// BEM komponenty pro Twig
@import 'components/card';
@import 'components/alert';
@import 'components/navigation';

// Dark mode support
.dark {
    color-scheme: dark;
}
```

### Twig + React styling consistency
```twig
{# Twig používá BEM + Tailwind #}
<div class="card card--elevated bg-white dark:bg-gray-800">
    <div class="card__header">{{ title }}</div>
</div>
```

```jsx
{/* React používá stejné Tailwind třídy */}
<div className="card card--elevated bg-white dark:bg-gray-800">
    <div className="card__header">{title}</div>
</div>
```

### Dark mode synchronizace
```javascript
// React automaticky detekuje dark mode z document
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

// Material UI theme synchronizace
const theme = createTheme({
    palette: {
        mode: isDarkMode ? 'dark' : 'light',
    },
});
```

## 🔧 Development workflow

### 1. **Nová hybrid stránka**
```bash
# 1. Vytvoř Twig template
touch templates/pages/nova-stranka.html.twig

# 2. Vytvoř React app (pokud potřeba)
mkdir assets/js/apps/nova-app
touch assets/js/apps/nova-app/index.jsx
touch assets/js/apps/nova-app/App.jsx

# 3. Přidej webpack entry
# Do webpack.config.js:
# .addEntry('app-nova-app', './assets/js/apps/nova-app/index.jsx')

# 4. Vytvoř Symfony route
# Do AppController.php nebo config/routes.yaml
```

### 2. **Debug hybrid aplikace**
```javascript
// React DevTools pro client-side debugging
console.log('React app mounted:', container);

// Symfony Profiler pro server-side debugging  
// /_profiler v dev módu

// Network tab pro API calls debugging
fetch('/api/endpoint').then(response => {
    console.log('API response:', response);
});
```

## 📋 Best practices

### 1. **Kdy použít React vs. Twig**
```
✅ Použij React pro:
- Komplexní tabulky (Material React Table)
- Formuláře s real-time validací  
- File upload s progress barem
- Interaktivní dashboardy

✅ Použij Twig pro:
- Statický obsah a navigace
- Server-side podmíněnou logiku
- SEO kritické stránky
- Jednoduché formuláře
```

### 2. **State management**
```javascript
// ❌ ŠPATNĚ - Global state pro micro-apps
const GlobalContext = createContext();

// ✅ SPRÁVNĚ - Lokální state v každé app
const App = () => {
    const [localState, setLocalState] = useState();
    // State je izolovaný v této aplikaci
};
```

### 3. **Performance optimalizace**
```twig
{# Conditional script loading #}
{% if app.user and page_requires_react %}
    {{ encore_entry_script_tags('app-specific-bundle') }}
{% endif %}
```

```javascript
// Lazy loading komponent
const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Loader />}>
    <HeavyComponent />
</Suspense>
```

## 🔍 Debugging hybrid aplikací

### Server-side debugging
```php
// AppController.php
public function prikazy(): Response 
{
    dump('Twig template rendered'); // Debug output
    return $this->render('pages/prikazy.html.twig');
}
```

### Client-side debugging
```javascript
// React app debugging
useEffect(() => {
    console.log('React app hydrated');
    console.log('Mount container:', container);
    console.log('Initial props:', container.dataset);
}, []);
```

### Network debugging
```bash
# API calls monitoring
curl https://portalznackare.ddev.site/api/insys/prikazy
```

### React → Twig DOM updates
```javascript
// React může updatovat Twig-generované elementy
useEffect(() => {
    // Update Twig page header from React data
    const prikazIdElement = document.querySelector('.page__header .prikaz-id');
    if (prikazIdElement && head?.Cislo_ZP) {
        prikazIdElement.textContent = head.Cislo_ZP;
    }
    
    const prikazDescElement = document.querySelector('.page__header .prikaz-description');
    if (prikazDescElement && head?.Druh_ZP) {
        prikazDescElement.textContent = getPrikazDescription(head.Druh_ZP);
    }
}, [head]);
```

---

**Principles:** [principles.md](principles.md)  
**Data Flow:** [data-flow.md](data-flow.md)  
**Frontend:** [../frontend/architecture.md](../frontend/architecture.md)  
**Hlavní dokumentace:** [../overview.md](../overview.md)  
**Aktualizováno:** 2025-07-22