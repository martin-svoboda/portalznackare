# Migrační průvodce pro refaktorování React aplikací

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
import { createDebugLogger } from '../../../utils/debug';

const logger = createDebugLogger('[NázevAplikace]Logic');

/**
 * Hlavní business funkce aplikace
 */
export const processApplicationData = (rawData) => {
    const startTime = performance.now();
    
    if (!Array.isArray(rawData) || rawData.length === 0) {
        logger.data('Žádná data ke zpracování', { dataLength: rawData?.length || 0 });
        return [];
    }
    
    // Business logika zde
    const processed = rawData.filter(item => item.isActive)
                            .map(item => transformItem(item))
                            .sort((a, b) => a.priority - b.priority);
    
    const endTime = performance.now();
    logger.performance('Zpracování dat aplikace', endTime - startTime);
    
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
import { createDebugLogger } from '../../../utils/debug';

const logger = createDebugLogger('[NázevAplikace]Validation');

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
        logger.data('Validace formuláře selhala', { errors });
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
import { createDebugLogger } from '../../utils/debug';
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
    const logger = createDebugLogger('MojeAplikace');
    logger.lifecycle('Aplikace - Komponenta připojena');
    
    // UI state pouze
    const [selectedItem, setSelectedItem] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // API hooks místo přímých volání
    const { loadData, loading, error, data } = useApi();
    
    // Debug render
    logger.render({ 
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
            logger.error('Validace formuláře selhala', validation.errors);
            return;
        }
        
        // Použij API hook nebo utility funkci
        saveData(formData);
    }, []);
    
    const handleItemSelect = useCallback((item) => {
        logger.action('Položka vybrána', { itemId: item.id });
        setSelectedItem(item);
    }, [logger]);
    
    // Cleanup
    useEffect(() => {
        return () => {
            logger.lifecycle('Aplikace - Komponenta se odpojuje');
        };
    }, [logger]);
    
    if (loading) {
        logger.render('Vykreslování stavu načítání');
        return <LoadingSpinner />;
    }
    
    if (error) {
        logger.error('Chyba při načítání dat', error);
        return <ErrorMessage error={error} />;
    }
    
    logger.render('Vykreslování hlavního obsahu', { 
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
import { createDebugLogger } from '../../utils/debug';

const logger = createDebugLogger('NázevKomponenty');
```

### 5.2 Lifecycle logging

```javascript
useEffect(() => {
    logger.lifecycle('Komponenta připojena');
    return () => {
        logger.lifecycle('Komponenta se odpojuje');
    };
}, [logger]);
```

### 5.3 Action logging

```javascript
const handleUserAction = useCallback((data) => {
    logger.action('Uživatelská akce', { data });
    // Akce zde
}, [logger]);
```

### 5.4 Performance logging

```javascript
const processData = useMemo(() => {
    const startTime = performance.now();
    const result = heavyProcessing(data);
    const endTime = performance.now();
    
    logger.performance('Zpracování dat', endTime - startTime);
    return result;
}, [data, logger]);
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