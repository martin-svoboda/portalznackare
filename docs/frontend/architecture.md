# Assets JavaScript Structure

## Jednoduchá Micro-frontend architektura

### Struktura složek:

```
assets/js/
├── apps/                    # React micro-aplikace
│   ├── prikazy/            # Správa příkazů (komplexní tabulky)
│   ├── metodika/           # Metodika vyhledávání
│   ├── reports/            # Hlášení příkazů (formuláře)
│   └── admin/              # Administrace
│
├── shared/                  # Sdílené služby a utility
│   ├── services/           # API komunikace
│   ├── hooks/              # React hooks
│   ├── utils/              # Utility funkce  
│   └── types/              # TypeScript typy
│
└── entries/               # Webpack entry points
    ├── app-prikazy.tsx
    ├── app-metodika.tsx
    └── app-reports.tsx
```

## Princip fungování:

### **KČT Komponenty = PHP/Twig only**
- Značky, TIM arrows, ikony → **PHP Services + Twig**
- Generují hotový HTML/SVG
- Použitelné v Twig šablonách i React (přes dangerouslySetInnerHTML)

### **React pouze pro komplexní UI**
- Tabulky s filtrováním
- Formuláře s validací
- Interaktivní funkce

### **1. V Twig šablonách:**
```twig
{# Hotové komponenty z PHP #}
{{ kct_znacka('CE', 'pasova', 24) }}
{{ kct_tim_arrow('1', 'left', 32) }}
{{ 'Text {ce} s ikonami'|kct_replace_icons }}
```

### **2. V React aplikacích:**
```typescript
// API už vrací obohacená data s HTML
function PrikazRow({ prikaz }) {
    return (
        <tr>
            <td dangerouslySetInnerHTML={{__html: prikaz.znacka_html}} />
            <td dangerouslySetInnerHTML={{__html: prikaz.popis_html}} />
        </tr>
    );
}
```

### **3. API obohacování:**
```php
// InsysController
$prikazy = $this->insysService->getPrikazy($intAdr);
$enriched = $this->dataEnricher->enrichPrikazyList($prikazy);
return new JsonResponse($enriched);

// Výsledek:
{
  "Cislo_ZP": "001",
  "Barva_Kod": "CE", 
  "znacka_html": "<svg>...</svg>",    // ← Hotový HTML
  "popis_html": "Text s <svg>...</svg> ikonami"  // ← Hotový HTML
}
```

## Webpack konfigurace:

```javascript
Encore
    // React micro-apps
    .addEntry('app-prikazy', './assets/js/entries/app-prikazy.tsx')
    .addEntry('app-metodika', './assets/js/entries/app-metodika.tsx')
    
    // CSS pro PHP/Twig komponenty
    .addStyleEntry('components', './assets/css/components.css')
    
    // Tailwind
    .enablePostCssLoader()
```

## Výhody:

✅ **Jednoduché** - jedna implementace v PHP/Twig  
✅ **Rychlé** - HTML se generuje na serveru  
✅ **Údržné** - změna jen v PHP službách  
✅ **Flexibilní** - funguje všude  
✅ **DRY** - žádné duplicity