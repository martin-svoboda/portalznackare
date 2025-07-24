# Globální Frontend Architektura

Kompletní přehled globální architektury pro všechny React aplikace v Portál značkaře.

## Struktura souborů

```
assets/js/
├── apps/                    # Micro-frontend aplikace
│   ├── hlaseni-prikazu/    # Aplikace pro hlášení příkazů
│   ├── prikazy/            # Seznam příkazů
│   ├── prikaz-detail/      # Detail příkazu
│   └── [app-name]/         # Další aplikace
├── components/             # Globální React komponenty
│   ├── shared/            # Sdílené UI komponenty
│   └── prikazy/           # Komponenty specifické pro příkazy
├── hooks/                 # Globální React hooks
│   ├── useDebounce.js     # Debouncing hook
│   ├── useApi.js          # API operations hook
│   └── [custom-hooks].js  # Další hooks
├── services/              # Globální services
│   ├── ApiService.js      # API komunikace s debug podporou
│   ├── api.ts             # Legacy API service (TypeScript)
│   └── [other-services].js
├── utils/                 # Globální utility funkce
│   ├── debug.js           # Debug systém
│   ├── formUtils.js       # Form utilities
│   ├── dateUtils.js       # Date utilities
│   └── [other-utils].js
└── templates/             # Šablony pro nové aplikace
    ├── ReactAppTemplate.jsx
    └── index.jsx
```

## Aplikační struktura

### Každá aplikace má strukturu:
```
app-name/
├── App.jsx               # Main component (POUZE UI + event handlers)
├── index.jsx             # Mount point
├── components/           # App-specific komponenty
│   ├── ComponentA.jsx    # UI komponenty s React.memo
│   └── ComponentB.jsx
└── utils/                # App-specific business logika
    ├── appLogic.js       # Business rules
    ├── validation.js     # Validační pravidla
    └── helpers.js        # Helper funkce
```

## Globální Services

### ApiService.js
```javascript
import { ApiService } from '../services/ApiService';

// Základní API volání
const result = await ApiService.request('/api/endpoint', {
    method: 'POST',
    data: { key: 'value' }
});

// Specializované metody
const prikazy = await ApiService.prikazy.list({ year: 2024 });
const report = await ApiService.prikazy.reports.get(prikazId);
```

### Funkce:
- **Centralizované API volání** s debug podporou
- **Error handling** s vlastní ApiError třídou
- **Performance monitoring** s automatickým měřením
- **Timeout support** (default 30s)
- **Specializované endpointy** pro prikazy, insys, files, auth

## Globální Hooks

### useDebounce.js
```javascript
import { useDebounce } from '../hooks/useDebounce';

const debouncedValue = useDebounce(inputValue, 500);
```

### useApi.js
```javascript
import { useApi, usePrikazyApi, useFileApi } from '../hooks/useApi';

// Základní hook
const { loading, error, execute, api } = useApi();

// Specializované hooks
const { loadPrikazyList, loadPrikazDetail } = usePrikazyApi();
const { uploadFile, deleteFile } = useFileApi();
```

## Globální Utils

### formUtils.js
- **Form validation** (`validateRequired`, `validateEmail`, `validateNumber`)
- **Date handling** (`formatDateForInput`, `parseDateFromInput`)
- **Field updaters** (`createFieldUpdater`, `createArrayFieldHelper`)
- **File validation** (`validateFileSize`, `validateFileType`)
- **Currency formatting** (`formatCurrency`)

### dateUtils.js
- **Czech locale formatting** (`formatDateCZ`, `formatTimeCZ`)
- **Date calculations** (`addDays`, `daysDifference`, `isToday`)
- **Working days** (`isWorkingDay`, `addWorkingDays`)
- **Relative time** (`getRelativeTime`)

### debug.js
- **Centralizovaný debug systém** s ENV kontrolou
- **Barevné kategorie** logů (API, State, Performance, Error)
- **Performance měření** (`measurePerformance`, `measureAsyncPerformance`)
- **Component specific** loggery

## Debug Systém

### Konfigurace (.env.local)
```bash
DEBUG_APPS=true    # Zapnout JS console logging
```

### Použití v komponentách
```javascript
import { createDebugLogger } from '../utils/debug';

const logger = createDebugLogger('ComponentName');

// Lifecycle events
logger.lifecycle('Component mounted', { props });

// API calls
logger.api('POST', '/api/endpoint', data, response);

// State changes
logger.state('formData', oldValue, newValue);

// Errors (vždy logované)
logger.error('Something failed', error);

// Performance
logger.performance('Heavy operation', 150); // ms
```

## Architektura Rules

### ✅ Co SMÍŠ v komponentách:
- JSX render logika
- useState pro UI state (modals, tabs, dropdowns)
- Event handlers které volají utils funkce
- useEffect pro lifecycle management
- useMemo/useCallback pro optimalizace
- Debug logging

### ❌ Co se NESMÍ v komponentách:
- Business logika
- Data transformace
- API volání (používej hooks)
- Složité výpočty
- Form validation logic
- Console.log (používej debug logger)

### Separace odpovědností:

#### Component.jsx
```javascript
const MyComponent = ({ data }) => {
    const logger = createDebugLogger('MyComponent');
    const [isOpen, setIsOpen] = useState(false);
    
    const handleSave = useCallback(() => {
        // Volej utils funkci
        saveData(data);
    }, [data]);
    
    logger.render({ data, isOpen });
    
    return <div>UI only</div>;
};
```

#### utils/componentLogic.js
```javascript
import { ApiService } from '../../services/ApiService';
import { createDebugLogger } from '../../utils/debug';

const logger = createDebugLogger('ComponentLogic');

export const saveData = async (data) => {
    logger.data('Saving data', data);
    
    const validation = validateData(data);
    if (!validation.isValid) {
        throw new Error('Invalid data');
    }
    
    return await ApiService.request('/api/save', {
        method: 'POST',
        data: transformData(data)
    });
};
```

## Performance Optimalizace

### React.memo na všech komponentách
```javascript
const ComponentImpl = ({ prop1, prop2 }) => {
    // Component logic
};

export const Component = React.memo(ComponentImpl, (prevProps, nextProps) => {
    return prevProps.prop1 === nextProps.prop1 && 
           prevProps.prop2 === nextProps.prop2;
});
```

### useCallback pro event handlers
```javascript
const handleClick = useCallback((id) => {
    updateItem(id);
}, [updateItem]);
```

### useMemo pro expensive computations
```javascript
const expensiveValue = useMemo(() => {
    return computeHeavyStuff(data);
}, [data]);
```

### Debouncing pro form inputs
```javascript
const debouncedFormData = useDebounce(formData, 500);

useEffect(() => {
    // Expensive operations only when user stops typing
    performHeavyCalculation(debouncedFormData);
}, [debouncedFormData]);
```

## Template pro nové aplikace

### Použití:
1. Zkopíruj `assets/js/templates/` do `assets/js/apps/new-app/`
2. Přejmenuj soubory a komponenty
3. Uprav `data-app` atribut
4. Implementuj specifickou logiku

### Co template obsahuje:
- ✅ Správnou strukturu komponent
- ✅ Debug logging setup
- ✅ API hooks integration
- ✅ Performance optimalizace
- ✅ Error handling
- ✅ Czech localization

## Migrace existujících aplikací

### Postup:
1. **Analýza** - identifikuj business logiku v komponentách
2. **Extrakce** - přesuň logiku do utils/
3. **Refaktoring** - komponenty pouze pro UI
4. **Debug** - přidej debug logging
5. **Optimalizace** - React.memo + hooks
6. **Testing** - otestuj funkcionalitu

### Checklist:
- [ ] Business logika v utils/
- [ ] Debug logger v komponentě
- [ ] React.memo implementováno
- [ ] Global hooks používány
- [ ] API volání přes ApiService
- [ ] Form validation v utils/
- [ ] Performance optimalizace
- [ ] Error handling

## Best Practices

### 1. Konzistence
- Vždy stejný naming pattern
- Stejná struktura složek
- Jednotný debug logging

### 2. Performance
- React.memo na všech komponentách
- useCallback pro functions
- useMemo pro computations
- Debouncing pro user input

### 3. Debugging
- Logger v každé komponentě
- Lifecycle events logování
- API calls logování
- State changes logování

### 4. Error Handling
- Try-catch v API calls
- User-friendly error messages
- Error logging vždy

### 5. Reusability
- Globální utils pro sdílenou logiku
- Custom hooks pro stateful logic
- Shared components pro UI patterns

Tato architektura zajišťuje **čistý, udržovatelný a performantní** kód ve všech React aplikacích.