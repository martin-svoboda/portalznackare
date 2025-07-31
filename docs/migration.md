# Analýza migrace z WordPress pluginu

Porovnání původního WordPress pluginu (WP-src/) s našou Symfony implementací.

## 📋 Přehled původního WordPress systému

### **Architektura WP pluginu:**
```
Plugin.php                    # Main plugin class
├── Api/
│   ├── InsysApi.php          # INSYS/MSSQL API endpoints  
│   └── PortalApi.php         # Portal API endpoints
├── Models/
│   ├── MetodikaModel.php     # Metodika data model
│   └── ReportModel.php       # Report data model (hlášení)
├── PostTypes/
│   └── MetodikaPostType.php  # WordPress custom post type
├── Repositories/
│   ├── MetodikaRepository.php
│   └── ReportRepository.php
├── Taxonomies/
│   └── MetodikaTaxonomy.php  # WordPress taxonomy
└── portal/                   # React SPA
    ├── auth/                 # Autentifikace komponenty
    ├── prikazy/              # Příkazy komponenty
    ├── metodika/             # Metodika komponenty
    ├── downloads/            # Downloads komponenty
    └── user/                 # User dashboard
```

## 🔄 Srovnání implementací

### **1. Architektura**

| Aspekt | WordPress Plugin | Naše Symfony implementace |
|--------|------------------|---------------------------|
| **Typ** | SPA React v WP | Hybrid Twig + React micro-apps |
| **Routing** | React Router | Symfony routing + React islands |
| **State Management** | Global React context | Lokální state v micro-apps |
| **Backend** | WordPress REST API | Symfony API controllers |
| **Database** | WordPress + custom tables | Doctrine ORM entities |
| **File Management** | WordPress Media Library | Custom file management systém |

### **2. Autentifikace**

**WordPress:**
```php
// WP session based
wp_verify_nonce($nonce, 'wp_rest');
is_user_logged_in();
```

**Naše implementace:**
```php
// Symfony Security
class InsysAuthenticator implements AuthenticatorInterface
class InsysUserProvider implements UserProviderInterface
```

### **3. File Upload System**

**WordPress (chybí v původním pluginu):**
- Používá WordPress Media Library
- Základní upload bez pokročilých funkcí
- Žádné hash tokeny pro security

**Naše implementace:**
```php
class FileUploadService {
    // ✅ Hash-based deduplication
    // ✅ Public/private file distinction  
    // ✅ Usage tracking
    // ✅ Soft delete with grace period
    // ✅ Thumbnail generation
    // ✅ Security tokens in URLs
}
```

## ✅ Co už máme implementováno

### **Backend API parity:**

| Endpoint | WordPress | Symfony | Status |
|----------|-----------|---------|--------|
| Login | `/wp-json/portal/v1/login` | `/api/insys/login` | ✅ |
| User info | `/wp-json/insys/v1/user` | `/api/insys/user` | ✅ |
| Příkazy list | `/wp-json/insys/v1/prikazy` | `/api/insys/prikazy` | ✅ |
| Příkaz detail | `/wp-json/insys/v1/prikaz/{id}` | `/api/insys/prikaz/{id}` | ✅ |
| Report GET | `/wp-json/portal/v1/report` | `/api/portal/report` | ✅ |
| Report POST | `/wp-json/portal/v1/report` | `/api/portal/report` | ✅ |
| Metodika terms | `/wp-json/portal/v1/metodika-terms` | `/api/portal/methodologies` | ✅ |
| Downloads | `/wp-json/portal/v1/downloads` | `/api/portal/downloads` | ✅ |

### **Frontend komponenty:**

| Komponenta | WordPress | Symfony | Status |
|------------|-----------|---------|--------|
| Login form | `auth/LoginForm.tsx` | `assets/js/components/auth/LoginForm.tsx` | ✅ |
| User widget | `auth/UserWidget.tsx` | `assets/js/components/auth/UserWidget.tsx` | ✅ |
| Příkazy list | `prikazy/Prikazy.tsx` | `assets/js/apps/prikazy/App.jsx` | ✅ |
| Hlášení form | `prikazy/HlaseniPrikazu.tsx` | `assets/js/apps/hlaseni-prikazu/App.jsx` | ✅ |
| Part A form | `prikazy/components/PartAForm.tsx` | `assets/js/apps/hlaseni-prikazu/components/PartAForm.jsx` | ✅ |
| Part B form | `prikazy/components/PartBForm.tsx` | `assets/js/apps/hlaseni-prikazu/components/PartBForm.jsx` | ✅ |
| File upload | `prikazy/components/FileUploadZone.tsx` | `assets/js/apps/hlaseni-prikazu/components/AdvancedFileUpload.jsx` | ✅ |
| Dashboard | `user/Dashboard.tsx` | `templates/pages/dashboard.html.twig` | ✅ |

## 🔍 Co nám chybí oproti WP pluginu

### **1. Metodika systém**

**WordPress implementace:**
```php
// Custom Post Type + Taxonomy
class MetodikaPostType extends AbstractCustomPostType
class MetodikaTaxonomy 
class MetodikaRepository

// API endpoints
GET /wp-json/portal/v1/metodika
GET /wp-json/portal/v1/metodika-terms
```

**Naše implementace:**
```php
// ❌ Chybí kompletní metodika systém
// ❌ Nemáme Doctrine entity pro metodiky
// ❌ Nemáme kategorie/taxonomie
// ❌ Chybí admin rozhraní pro správu metodik
```

### **2. Downloads systém**

**WordPress:**
```php
// Nastavení v admin panelu
$this->settings->get_option('downloads');
// API vrací kategorie + soubory
public function get_downloads($request)
```

**Naše implementace:**
```php
// ✅ Máme mock API endpoint
// ❌ Chybí databázové entity
// ❌ Chybí admin rozhraní pro správu
```

### **3. Static content systém**

**WordPress:**
```php
// Post/Page content přes WP API
public function get_post_data($request) {
    // WordPress posts/pages
    // Dynamic content loading
}
```

**Naše implementace:**
```twig
{# ✅ Máme statické Twig templaty #}
{# ❌ Chybí dynamické content loading #}
{# ❌ Nemáme CMS pro editaci obsahu #}
```

## 🚀 Priority pro doplnění

### **Vysoká priorita**

#### **1. Metodika systém**
```php
// Potřebujeme implementovat:
class Metodika extends AbstractEntity
class MetodikaCategory extends AbstractEntity  
class MetodikaRepository
class MetodikaController

// + admin rozhraní pro:
- Vytváření/editace metodik
- Kategorizace 
- Upload PDF souborů
- Publikování/draft
```

#### **2. Downloads systém**
```php
// Rozšířit stávající file management:
class Download extends AbstractEntity
class DownloadCategory extends AbstractEntity

// + admin rozhraní pro:
- Kategorie ke stažení
- Upload souborů
- Organizace do kategorií
```

### **Střední priorita**

#### **3. Content Management**
```php
// Pro editovatelný obsah:
class Page extends AbstractEntity
class PageController

// Nebo integrace s:
- Existing CMS (pokud potřeba)
- Static file based content
```

#### **4. Admin rozhraní**
```twig
{# /admin dashboard s: #}
- Správa metodik
- Správa downloads  
- Správa souborů (už máme v plánu)
- Uživatelé a oprávnění
```

### **Nízká priorita**

#### **5. WordPress parity features**
- Custom taxonomie systém
- WordPress-style shortcodes
- Gutenberg blocks equivalent

## 📊 Funkční pokrytí

### **✅ Kompletně implementováno (90%+)**
- Autentifikace systém
- INSYS API integrace  
- Hlášení příkazů (Part A + B)
- File upload s pokročilými funkcemi
- Uživatelské rozhraní

### **🔶 Částečně implementováno (30-70%)**
- Downloads API (mock data)
- Static content (Twig templaty)

### **❌ Chybí kompletně (0%)**
- Metodika management systém
- Downloads management systém  
- Content management systém
- Admin rozhraní pro správu

## 🎯 Doporučený postup implementace

### **Fáze 1: Core Missing Features**
1. **Metodika entities + repository**
2. **Downloads entities + repository** 
3. **Basic admin rozhraní**

### **Fáze 2: Admin Interface**
1. **Metodika management UI**
2. **Downloads management UI**
3. **File management UI** (už v TODO.md)

### **Fáze 3: Polish & Advanced**
1. **Content management** (pokud potřeba)
2. **Advanced admin features**
3. **WordPress import tool** (migrace dat)

## 💡 Architektural Insights

### **Naše výhody oproti WP:**
- ✅ **Lepší file management** - hash security, usage tracking
- ✅ **Type safety** - Doctrine entities vs WP arrays
- ✅ **Better performance** - micro-apps vs SPA
- ✅ **Security** - Symfony Security vs WP auth
- ✅ **Maintainability** - clean architecture

### **Co si můžeme vypůjčit z WP:**
- 📋 **API struktura** - endpoint naming conventions  
- 📋 **Data models** - entity field definitions
- 📋 **Admin UI patterns** - management interfaces
- 📋 **File organization** - kategorie a taxonomie

---

**Celkový stav:** Máme silný základ s pokročilým file managementem, ale chybí nám content management část (metodiky, downloads). Priority jsou jasné a implementace je straightforward.# Migrační průvodce pro refaktorování React aplikací

> **Účel:** Krok za krokem návod pro refaktorování existujících React aplikací podle globální architektury

## Přehled migrace

Tento průvodce vás provede refaktorováním existujících React aplikací do nové globální architektury, která odděluje UI logiku od business logiky a implementuje jednotný debug systém.

### Před refaktorováním
- Aplikace obsahují smíšenou UI a business logiku
- Žádný jednotný debug systém
- Neoptimalizované re-renders
- Rozdílné architektonické přístupy

### Po refaktorování
- Čistá separace UI od business logiky
- Jednotný debug systém s češtinou
- Optimalizované výkonnostní charakteristiky
- Konzistentní architektura napříč aplikacemi

---

## Krok 1: Analýza existující aplikace

### 1.1 Identifikace business logiky

**Co hledat v existujícím kódu:**

```javascript
// ❌ Business logika v komponentě (ŠPATNĚ)
const Component = () => {
    const [data, setData] = useState([]);
    
    const fetchData = async () => {
        const response = await fetch('/api/data');
        const result = await response.json();
        setData(result.filter(item => item.status === 'active'));
    };
    
    const processData = (items) => {
        return items.map(item => ({
            ...item,
            formattedDate: new Date(item.date).toLocaleDateString('cs-CZ')
        }));
    };
};
```

**Identifikuj tyto elementy:**
- [ ] API volání (fetch, axios calls)
- [ ] Data transformace (map, filter, sort)
- [ ] Validační logika
- [ ] Výpočty a algoritmy
- [ ] Formátování dat
- [ ] Error handling logic

### 1.2 Checklist analýzy

```markdown
## Analýza aplikace: [název-aplikace]

### Business logika k přesunu:
- [ ] API volání: _______________
- [ ] Data transformace: _______________
- [ ] Validace: _______________
- [ ] Výpočty: _______________
- [ ] Error handling: _______________

### UI stav k zachování:
- [ ] Modal states: _______________
- [ ] Form states: _______________
- [ ] Loading states: _______________
- [ ] UI toggles: _______________

### Výkonnostní problémy:
- [ ] Chybějící React.memo
- [ ] Chybějící useCallback
- [ ] Chybějící useMemo
- [ ] Zbytečné re-renders
```

---

## Krok 2: Příprava struktury

### 2.1 Vytvoření utils složky

```bash
mkdir assets/js/apps/[nazev-aplikace]/utils
```

### 2.2 Vytvoření základních utility souborů

**appLogic.js** - hlavní business logika:
```javascript
import { log } from '../../../utils/debug';

/**
 * Hlavní business funkce aplikace
 */
export const processApplicationData = (rawData) => {
    const startTime = performance.now();
    
    if (!Array.isArray(rawData) || rawData.length === 0) {
        log.info('Žádná data ke zpracování', { dataLength: rawData?.length || 0 });
        return [];
    }
    
    // Business logika zde
    const processed = rawData.filter(item => item.isActive)
                            .map(item => transformItem(item))
                            .sort((a, b) => a.priority - b.priority);
    
    const endTime = performance.now();
    log.info('Zpracování dat aplikace dokončeno', { duration: endTime - startTime, itemCount: processed.length });
    
    return processed;
};

/**
 * Helper funkce pro transformaci jednotlivé položky
 */
const transformItem = (item) => {
    return {
        ...item,
        formattedDate: formatDateCZ(item.date),
        displayName: item.firstName + ' ' + item.lastName
    };
};
```

**validation.js** - validační logika:
```javascript
import { log } from '../../../utils/debug';

/**
 * Validace formuláře
 */
export const validateForm = (formData) => {
    const errors = {};
    
    if (!formData.name?.trim()) {
        errors.name = 'Jméno je povinné';
    }
    
    if (!formData.email?.includes('@')) {
        errors.email = 'Neplatný email';
    }
    
    const isValid = Object.keys(errors).length === 0;
    
    if (!isValid) {
        log.warn('Validace formuláře selhala', { errors });
    }
    
    return { isValid, errors };
};
```

---

## Krok 3: Refaktorování hlavní komponenty

### 3.1 Přesun importů

**Před:**
```javascript
import React, {useState, useEffect} from 'react';
```

**Po:**
```javascript
import React, {useState, useEffect, useMemo, useCallback} from 'react';
import { log } from '../../utils/debug';
import { useApi } from '../../hooks/useApi';
import { formatDateCZ } from '../../utils/dateUtils';
import { processApplicationData } from './utils/appLogic';
import { validateForm } from './utils/validation';
```

### 3.2 Refaktorování komponenty

**Před:**
```javascript
const MyApp = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const fetchData = async () => {
        // API logic here
    };
    
    const handleSubmit = (formData) => {
        // Validation and processing here
    };
    
    return <div>UI zde</div>;
};
```

**Po:**
```javascript
const MyAppComponent = () => {
    log.info('Aplikace - Komponenta připojena');
    
    // UI state pouze
    const [selectedItem, setSelectedItem] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // API hooks místo přímých volání
    const { loadData, loading, error, data } = useApi();
    
    // Debug render
    log.info('Vykreslování komponenty', { 
        loading, 
        hasError: !!error, 
        dataCount: data?.length || 0,
        selectedItem: selectedItem?.id 
    });
    
    // Procesování dat pomocí utility funkce
    const processedData = useMemo(() => {
        return processApplicationData(data || []);
    }, [data]);
    
    // Event handlers s useCallback
    const handleSubmit = useCallback((formData) => {
        const validation = validateForm(formData);
        if (!validation.isValid) {
            log.error('Validace formuláře selhala', validation.errors);
            return;
        }
        
        // Použij API hook nebo utility funkci
        saveData(formData);
    }, []);
    
    const handleItemSelect = useCallback((item) => {
        log.info('Položka vybrána', { itemId: item.id });
        setSelectedItem(item);
    }, []);
    
    // Cleanup
    useEffect(() => {
        return () => {
            log.info('Aplikace - Komponenta se odpojuje');
        };
    }, []);
    
    if (loading) {
        log.info('Vykreslování stavu načítání');
        return <LoadingSpinner />;
    }
    
    if (error) {
        log.error('Chyba při načítání dat', error);
        return <ErrorMessage error={error} />;
    }
    
    log.info('Vykreslování hlavního obsahu', { 
        itemCount: processedData.length 
    });
    
    return (
        <div>
            {/* Pouze UI logika zde */}
        </div>
    );
};

// React.memo optimalizace
export const MyApp = React.memo(MyAppComponent, (prevProps, nextProps) => {
    // Porovnání props pokud existují
    return prevProps.someData === nextProps.someData;
});

export default MyApp;
```

---

## Krok 4: Optimalizace výkonu

### 4.1 React.memo implementace

```javascript
// Každá komponenta musí být obalena v React.memo
export const Component = React.memo(ComponentImpl, (prevProps, nextProps) => {
    return (
        prevProps.data === nextProps.data &&
        prevProps.loading === nextProps.loading
    );
});
```

### 4.2 useCallback pro event handlers

```javascript
// ✅ SPRÁVNĚ - s useCallback
const handleClick = useCallback((id) => {
    performAction(id);
}, [performAction]);

// ❌ ŠPATNĚ - bez useCallback
const handleClick = (id) => {
    performAction(id);
};
```

### 4.3 useMemo pro expensive computations

```javascript
// ✅ SPRÁVNĚ - s useMemo
const expensiveValue = useMemo(() => {
    return heavyCalculation(data);
}, [data]);

// ❌ ŠPATNĚ - výpočet při každém render
const expensiveValue = heavyCalculation(data);
```

---

## Krok 5: Debug systém

### 5.1 Přidání debug loggeru

```javascript
import { log } from '../../utils/debug';

```

### 5.2 Lifecycle logging

```javascript
useEffect(() => {
    log.info('Komponenta připojena');
    return () => {
        log.info('Komponenta se odpojuje');
    };
}, []);
```

### 5.3 Action logging

```javascript
const handleUserAction = useCallback((data) => {
    log.info('Uživatelská akce', { data });
    // Akce zde
}, []);
```

### 5.4 Performance logging

```javascript
const processData = useMemo(() => {
    const startTime = performance.now();
    const result = heavyProcessing(data);
    const endTime = performance.now();
    
    log.info('Zpracování dat dokončeno', { duration: endTime - startTime });
    return result;
}, [data]);
```

---

## Krok 6: Twig template úpravy

### 6.1 Přidání debug skriptů

```twig
{% block body %}
    <div data-app="nazev-aplikace">
        <!-- Obsah aplikace -->
    </div>
    
    <script>
        // Debug renderování šablony
        if (window.debugTwig) {
            window.debugTwig.render('NázevStránky', 'pages/nazev.html.twig', {
                uživatel: '{{ app.user ? app.user.jmeno : 'anonymní' }}',
                cesta: '{{ app.request.attributes.get('_route') }}',
                připojovací_bod: '[data-app="nazev-aplikace"]'
            });
            
            // Debug React aplikace připojovací bod
            document.addEventListener('DOMContentLoaded', function() {
                const mountElement = document.querySelector('[data-app="nazev-aplikace"]');
                if (mountElement && window.debugTwig) {
                    window.debugTwig.mount('nazev-aplikace', '[data-app="nazev-aplikace"]', {
                        elementExistuje: !!mountElement,
                        máObsah: mountElement.innerHTML.trim() !== ''
                    });
                }
            });
        }
    </script>
{% endblock %}
```

---

## Krok 7: Testování

### 7.1 Build test

```bash
npm run build
```

### 7.2 Debug test

1. Nastav `DEBUG_APPS=true` v `.env.local`
2. Otevři konzoli v prohlížeči
3. Ověř že se zobrazují české log zprávy

### 7.3 Funkční test

- [ ] Aplikace se načte bez chyb
- [ ] Všechny funkce fungují stejně jako před refaktorováním
- [ ] Debug logy se zobrazují v češtině
- [ ] Performance je zachována nebo zlepšena

---

## Checklist migrace

### ✅ Příprava
- [ ] Analyzoval jsem existující kód
- [ ] Identifikoval jsem business logiku k přesunu
- [ ] Vytvořil jsem strukturu utils/ složky

### ✅ Refaktorování
- [ ] Přesunul jsem business logiku do utils/
- [ ] Komponenta obsahuje pouze UI logiku
- [ ] Přidal jsem debug logger
- [ ] Implementoval jsem React.memo optimalizace
- [ ] Použil jsem useCallback pro event handlers
- [ ] Použil jsem useMemo pro expensive computations

### ✅ Debug systém
- [ ] Všechny log zprávy jsou v češtině
- [ ] Lifecycle events jsou logované
- [ ] User actions jsou logované
- [ ] Performance se měří
- [ ] Errors se logují správně

### ✅ Twig template
- [ ] Přidal jsem debug skripty
- [ ] Template debugging funguje
- [ ] Mount point debugging funguje

### ✅ Testování
- [ ] Build prošel bez chyb
- [ ] Funkcionalita je zachována
- [ ] Debug system funguje
- [ ] Performance je OK

---

## Časté problémy a řešení

### Problém: Import chyby po refaktorování

**Řešení:**
```javascript
// Ověř relativní cesty
import { utils } from './utils/appLogic'; // ✅ Správně
import { utils } from '../utils/appLogic'; // ❌ Špatně
```

### Problém: Nekonečné re-renders

**Řešení:**
```javascript
// Přidej dependency array
useEffect(() => {
    loadData();
}, [loadData]); // ✅ S dependency array

useEffect(() => {
    loadData();
}); // ❌ Bez dependency array
```

### Problém: Debug logy se nezobrazují

**Řešení:**
1. Ověř `.env.local` nastavení: `DEBUG_APPS=true`
2. Zkontroluj import debug loggeru
3. Ujisti se že logger je inicializován před použitím

---

## Příklady úspěšných migrací

### 1. Aplikace prikazy
- **Před:** 150 řádků smíšené logiky
- **Po:** 80 řádků UI + 70 řádků utils
- **Zlepšení:** 40% méně re-renders

### 2. Aplikace prikaz-detail  
- **Před:** 200 řádků s inline API calls
- **Po:** 120 řádků UI + 80 řádků utils
- **Zlepšení:** Jednotný error handling

### 3. Aplikace hlaseni-prikazu
- **Před:** 300 řádků komplexní logiky
- **Po:** 180 řádků UI + 120 řádků utils
- **Zlepšení:** Čitelnější kód, lepší debug

---

**Aktualizováno:** 2025-01-24
**Verze:** 1.0
**Platí pro:** Všechny React aplikace v Portál značkaře