# Debug Systém

Kompletní debug systém pro vývoj a ladění aplikací v Portál značkaře.

## Konfigurace

### Environment proměnné

V hlavním `.env` souboru jsou nastavené **bezpečné defaulty** pro produkci:

```bash
# BEZPEČNÉ defaulty v .env (commitováno do Git)
DEBUG_PHP=false         # PHP debugging VYPNUTO
DEBUG_LOG=false         # Backend logging VYPNUTO  
DEBUG_APPS=false        # JavaScript console logging VYPNUTO
```

**Pro lokální vývoj** vytvořte `.env.local` nebo použijte DDEV (automatické):

```bash
# Development override v .env.local
DEBUG_PHP=true          # PHP debugging ZAPNUTO
DEBUG_LOG=true          # Backend logging ZAPNUTO
DEBUG_APPS=true         # JavaScript console logging ZAPNUTO
```

**Pro server** použijte `.env.local.server.example` - bezpečné defaulty jsou již v `.env`

### Aktivace v aplikaci

Debug stav se předává z backendu do frontendu přes Twig template:

```twig
{# V base template nebo konkrétní stránce #}
<div id="app-root" data-debug="{{ app.debug ? 'true' : 'false' }}"></div>
```

## Frontend Debug Logger

### Základní použití

```javascript
import { createDebugLogger } from '../../utils/debug';

const logger = createDebugLogger('ComponentName');

const MyComponent = () => {
    logger.lifecycle('Component mounted');
    
    return <div>Content</div>;
};
```

### Typy logování

#### 1. Lifecycle Events
```javascript
logger.lifecycle('Component mounted', { props });
logger.lifecycle('Data loaded', { data });
logger.lifecycle('Save started', { formData });
```

#### 2. API Volání
```javascript
// Před voláním
logger.api('POST', '/api/endpoint', requestData);

// Po odpovědi
logger.api('POST', '/api/endpoint', requestData, responseData);
```

#### 3. State Changes
```javascript
const oldValue = formData;
setFormData(newValue);
logger.state('formData', oldValue, newValue);
```

#### 4. Chyby (vždy loguje)
```javascript
try {
    // risky operation
} catch (error) {
    logger.error('Operation failed', error);
}
```

#### 5. Performance Monitoring
```javascript
logger.performance('Data calculation', 150); // ms

// Nebo s automatickým měřením
import { measurePerformance } from '../../utils/debug';

const result = measurePerformance('Heavy calculation', () => {
    return heavyCalculation();
});
```

#### 6. Data Processing
```javascript
logger.data('Form validation', { formData, isValid });
logger.data('Price list parsed', parsedData);
```

#### 7. Custom Logging
```javascript
logger.custom('User interaction', { 
    action: 'button_click', 
    element: 'save_button' 
});
```

## Výstup v konzoli

### Barevné označení
- 🔵 **Component** - Modrá (lifecycle, renders)
- 🟢 **API** - Zelená (API volání)
- 🟠 **State** - Oranžová (změny stavu)
- 🔴 **Error** - Červená (chyby)
- 🟣 **Performance** - Fialová (výkon)
- 🔵 **Lifecycle** - Cyan (životní cyklus)
- 🔘 **Data** - Šedá (zpracování dat)

### Formát zpráv
```
[ComponentName] Event Type: Detail - 14:32:15
  ├─ Request data: {...}
  └─ Response: {...}
```

## Best Practices

### 1. Systematické logování
```javascript
const MyComponent = ({ data }) => {
    const logger = createDebugLogger('MyComponent');
    
    // Při mount
    useEffect(() => {
        logger.lifecycle('Component mounted', { dataLength: data.length });
    }, []);
    
    // Při každém renderu (jen v debug módu)
    logger.render({ data });
    
    return <div>...</div>;
};
```

### 2. API volání
```javascript
const fetchData = async () => {
    logger.api('GET', '/api/data');
    
    try {
        const response = await fetch('/api/data');
        const result = await response.json();
        
        logger.api('GET', '/api/data', null, result);
        return result;
    } catch (error) {
        logger.error('API call failed', error);
        throw error;
    }
};
```

### 3. Form handling
```javascript
const handleSubmit = (formData) => {
    logger.data('Form submission started', formData);
    
    const validation = validateForm(formData);
    logger.data('Form validation', { isValid: validation.isValid, errors: validation.errors });
    
    if (validation.isValid) {
        submitForm(formData);
    }
};
```

### 4. Performance kritická místa
```javascript
const processLargeDataset = (data) => {
    return measurePerformance('Large dataset processing', () => {
        return data.map(item => processItem(item));
    });
};
```

## Podmíněné logování

### Pouze v debug módu
```javascript
import { isDebugEnabled } from '../../utils/debug';

if (isDebugEnabled()) {
    // Expensive debug operations
    console.table(complexData);
}
```

### Produkční chyby
```javascript
// Chyby se logují vždy, i v produkci
logger.error('Critical error occurred', error);
```

## Debug v různých prostředích

### Development
- Všechny logy aktivní
- Podrobné informace
- Performance monitoring

### Staging  
- Pouze chyby a kritické události
- Omezené API logy

### Production
- Pouze chyby
- Minimální performance impact

## Nástroje a rozšíření

### Browser Developer Tools
1. **Console filtering**: Použij `%c[ComponentName]` pro filtrování
2. **Network tab**: Pro sledování API volání
3. **Performance tab**: Pro sledování výkonu

### Doporučená rozšíření
- React Developer Tools
- Redux DevTools (pokud používáme)
- Network Monitor

## Troubleshooting

### Debug se nezobrazuje
1. Zkontroluj ENV proměnnou `DEBUG_APPS=true` pomocí `ddev exec "printenv | grep DEBUG"`
2. Ověř `data-debug="true"` v DOM elementu aplikace
3. Zkontroluj console filtry v Developer Tools
4. Pro DDEV: debug proměnné jsou nastavené automaticky v `.env`

### Příliš mnoho logů
1. Použij browser console filtry
2. Nastav specifické komponenty
3. Dočasně vypni některé typy logů

### Performance impact
1. Debug kód se spouští pouze v debug módu
2. Produkční build má minimal impact
3. Použij lazy evaluation pro expensive operations

## Příklady implementace

### Kompletní komponenta s debuggingem
```javascript
import React, { useState, useEffect, useCallback } from 'react';
import { createDebugLogger, measurePerformance } from '../../utils/debug';

const MyComponent = ({ initialData }) => {
    const logger = createDebugLogger('MyComponent');
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        logger.lifecycle('Component mounted', { 
            hasInitialData: !!initialData,
            dataLength: initialData?.length || 0 
        });
    }, []);
    
    const handleLoadData = useCallback(async () => {
        logger.lifecycle('Data loading started');
        setLoading(true);
        
        try {
            const result = await measurePerformance('Data fetch', async () => {
                logger.api('GET', '/api/data');
                const response = await fetch('/api/data');
                const data = await response.json();
                logger.api('GET', '/api/data', null, data);
                return data;
            });
            
            const oldData = data;
            setData(result);
            logger.state('data', oldData, result);
            
        } catch (error) {
            logger.error('Failed to load data', error);
        } finally {
            setLoading(false);
            logger.lifecycle('Data loading finished');
        }
    }, [data]);
    
    logger.render({ data, loading });
    
    return (
        <div>
            {loading ? 'Loading...' : `Data items: ${data.length}`}
            <button onClick={handleLoadData}>Reload</button>
        </div>
    );
};

export default MyComponent;
```

Tento debug systém umožňuje efektivní ladění a monitoring aplikací ve všech fázích vývoje.