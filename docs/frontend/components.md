# Frontend komponenty

> **React komponenty a CSS systém** - Přehled komponent, styling systému a práce s BEM + Tailwind

## Přehled komponent

Frontend aplikace používá hybrid architekturu s React micro-apps a sdílenými komponentami:

### 🎨 Micro-apps
- **Prikazy List** - Tabulka příkazů s filtry
- **Prikaz Detail** - Detail příkazu s TIM náhledy
- **Prikaz Hlaseni** - Formulář hlášení práce

### 🧩 Shared komponenty
- **Loader** - Loading indikátor
- **MapaTrasy** - Mapa s body tras
- **PrikazHead** - Hlavička příkazu
- **PrikazUseky** - Seznam úseků

### 🏷️ Prikazy komponenty
- **PrikazStavBadge** - Badge stavu příkazu
- **PrikazTypeIcon** - Ikona typu příkazu

### 🛠️ Utility funkce
- **renderHtmlContent** - Bezpečné HTML vykreslování
- **replaceTextWithIcons** - Nahrazování ikon v textu

### 🎨 Icon System
- **Tabler Icons** - SVG sprite systém pro ikony
- **React Import** - `@tabler/icons-react` komponenty  
- **Twig Funkce** - `tabler_icon()` pro templates

---

## CSS Component System

### 🎨 CSS Variables (Obecné proměnné)

Aplikace používá **CSS custom properties** pro brand barvy a obecné hodnoty dostupné v celé aplikaci:

#### **KČT Brand Colors:**
```scss
// assets/css/components/variables.scss
:root {
  --color-kct-green: #009C00;   // Zelená značka
  --color-kct-blue: #1a6dff;    // Modrá značka  
  --color-kct-yellow: #ffdd00;  // Žlutá značka
  --color-kct-red: #e50313;     // Červená značka
  
  // Layout dimensions
  --header-height: 4rem;
  --sidebar-width: 16rem;
}
```

#### **Použití CSS variables:**
```scss
// V jakékoliv CSS komponentě
.my-component {
  background-color: var(--color-kct-red);
  height: var(--header-height);
}

// V inline stylech
style={{backgroundColor: 'var(--color-kct-blue)'}}
```

### 🎨 BEM + Tailwind Hybrid Přístup

Aplikace používá **BEM metodiku** pro komponenty kombinovanou s **Tailwind CSS** pro utility styling:

#### **Základní pravidla:**
1. **BEM komponenty primárně** - struktura, layout, spacing
2. **Tailwind pro specifické úpravy** - barvy, velikosti, marginy
3. **CSS variables** pro brand colors a dynamické hodnoty
4. **Dark mode povinný** - každá komponenta musí podporovat light/dark

### 🏷️ Badge Component System

Badge komponenta je ukázkovým příkladem hybridního přístupu:

#### **Struktura badge komponenty:**
```scss
// assets/css/components/badge.scss
.badge {
  @apply inline-flex items-center px-2 py-1 rounded-md text-xs font-medium;
  @apply transition-colors duration-200;
  
  // Size variants
  &--xs { @apply px-1.5 py-0.5 text-xs; }
  &--sm { @apply px-2 py-1 text-xs; }
  &--md { @apply px-3 py-1.5 text-sm; }
  &--lg { @apply px-4 py-2 text-base; }

  // KČT trail color variants
  &--kct {
    &-ce { background-color: var(--color-kct-red); color: white; }
    &-mo { background-color: var(--color-kct-blue); color: white; }
    &-ze { background-color: var(--color-kct-green); color: white; }
    &-zl { background-color: var(--color-kct-yellow); color: black; }
  }

  // Semantic variants
  &--primary { @apply bg-blue-600 text-white dark:bg-blue-700; }
  &--success { @apply bg-green-600 text-white dark:bg-green-700; }
  &--danger { @apply bg-red-600 text-white dark:bg-red-700; }
}
```

### 📋 Používání Badge v Kódu

#### **1. KČT Trail Colors (přímé BEM třídy):**
```jsx
// Pro KČT barvy značek - použití CSS variables
<span className={`badge badge--kct-${usek.Barva_Kod.toLowerCase()}`}>
  {usek.Barva_Naz}
</span>

// Výsledek: badge badge--kct-ce (červená značka)
```

#### **2. Semantic Colors (BEM varianty):**
```jsx
// Pro obecné statusy - standardní varianty
<span className="badge badge--success">Dokončeno</span>
<span className="badge badge--danger">Chyba</span>
<span className="badge badge--primary">Aktivní</span>
```

#### **3. Custom Colors (BEM + Tailwind):**
```jsx
// Pro specifické případy - BEM struktura + Tailwind barvy
<span className="badge badge--md bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
  Specifický stav
</span>
```

### 🎯 Rozhodovací strom pro styling

#### **Kdy použít jaký přístup:**

```
Potřebuji stylovat komponentu?
├── Je to standardní pattern? 
│   ├── ANO → Použij BEM komponentu (.badge, .card, .btn)
│   └── NE → Pokračuj níže
├── Je to KČT brand prvek?
│   ├── ANO → Použij CSS variables (var(--color-kct-*))
│   └── NE → Pokračuj níže
├── Je to specifická úprava?
│   ├── ANO → BEM struktura + Tailwind třídy
│   └── NE → Čistě Tailwind utility třídy
```

### 🎨 Příklady použití

#### **PrikazStavBadge - Custom colors:**
```jsx
const stavMap = {
  'Nové': {
    icon: IconSquare,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  },
  'Přidělený': {
    icon: IconEdit,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  }
};

// Použití:
<span className={`badge badge--md ${conf.className}`}>
  <Icon size={14} className="mr-1"/>
  {stav}
</span>
```

#### **Trail Colors - KČT variables:**
```jsx
// Automatické použití podle kódu barvy
<span className={`badge badge--kct-${barvaKod.toLowerCase()}`}>
  {barvaNazev}
</span>
```

### 📁 Struktura CSS souborů

```
assets/css/components/
├── variables.scss      # CSS variables (KČT colors, dimensions)
├── badge.scss         # Badge komponenta s variantami
├── card.scss          # Card komponenta
├── btn.scss           # Button komponenta
├── form.scss          # Form elementy
└── ...
```

### ✅ Best Practices

1. **Vždy začni s BEM komponentou** jako základem
2. **CSS variables pro brand prvky** (KČT barvy, loga)
3. **Tailwind pro fine-tuning** (spacing, responsive, hover stavy)
4. **Dark mode podpora** v každé komponentě
5. **Konzistentní naming** - BEM metodika

---

## 🎨 Tabler Icons System

Aplikace používá **optimalizovaný SVG sprite systém** pro ikony s podporou React i Twig templates.

### 📦 Technická implementace

**SVG Sprite:** `/public/images/tabler-sprite.svg` (4000+ ikon)  
**Výhody:** Jeden HTTP request, čistý HTML, XSS ochrana, automatický cache

### ⚛️ React aplikace

**Import z NPM balíčku:**
```javascript
import { 
    IconArrowLeft, 
    IconTool, 
    IconDownload,
    IconEdit,
    IconCheck,
    IconAlertTriangle 
} from '@tabler/icons-react';

// Základní použití
<IconArrowLeft size={16} />
<IconTool size={20} className="text-blue-600" />
<IconCheck size={14} className="mr-1" />

// V Material React Table
const columns = [
  {
    header: 'Akce',
    cell: ({ row }) => (
      <div className="flex gap-2">
        <IconEdit size={16} className="text-blue-600 cursor-pointer" />
        <IconTrash size={16} className="text-red-600 cursor-pointer" />
      </div>
    )
  }
];
```

### 🏗️ Twig templates

**Funkce `tabler_icon(název, velikost, css_třída, atributy)`:**
```twig
{# Základní použití #}
{{ tabler_icon('home') }}
{{ tabler_icon('user', 20) }}
{{ tabler_icon('settings', 24, 'icon--lg') }}

{# V tlačítkách #}
<button class="btn btn--primary">
    {{ tabler_icon('plus', 16) }}
    Přidat
</button>

{# S CSS třídami pro barvy #}
{{ tabler_icon('check', 20, 'text-green-600 dark:text-green-400') }}
{{ tabler_icon('alert-triangle', 24, 'icon--warning') }}
{{ tabler_icon('download', 16, 'icon--sm icon--primary') }}

{# S dodatečnými HTML atributy #}
{{ tabler_icon('download', 20, 'icon--primary', {
    'data-action': 'download',
    'aria-label': 'Stáhnout soubor'
}) }}

{# V navigaci #}
<a href="/prikazy" class="nav__link">
    {{ tabler_icon('clipboard-list', 20) }}
    Příkazy
</a>
```

### 🎨 CSS Icon Classes

**Automatické třídy:**
```scss
.icon {
    @apply inline-block; // Base styling
}

.icon-tabler {
    stroke: currentColor; // Respektuje text color
}

.icon-tabler-home { /* specifická ikona */ }
```

**Utility třídy pro velikosti:**
```scss
.icon--xs { @apply w-4 h-4; }    // 16px
.icon--sm { @apply w-5 h-5; }    // 20px  
.icon--md { @apply w-6 h-6; }    // 24px (default)
.icon--lg { @apply w-7 h-7; }    // 28px
.icon--xl { @apply w-8 h-8; }    // 32px
```

**Utility třídy pro barvy:**
```scss
.icon--primary { @apply text-blue-600 dark:text-blue-400; }
.icon--success { @apply text-green-600 dark:text-green-400; }
.icon--warning { @apply text-orange-600 dark:text-orange-400; }
.icon--danger { @apply text-red-600 dark:text-red-400; }
.icon--muted { @apply text-gray-500 dark:text-gray-400; }
```

### 🔧 Generovaný HTML výstup

**Twig funkce generuje:**
```html
<svg width="24" height="24" class="icon icon-tabler icon-tabler-home icon--lg">
  <use href="/images/tabler-sprite.svg#tabler-home"></use>
</svg>
```

### 🛡️ Bezpečnostní funkce

- **XSS ochrana:** Všechny vstupy escapované `htmlspecialchars()`
- **Whitelist ikon:** Pouze oficiální Tabler Icons kolekce
- **Statická cesta:** Žádné traversal útoky možné
- **Validace:** Pouze bezpečné HTML atributy

### 🎯 Kdy použít jaký přístup

```
Potřebuji ikonu?
├── React komponenta? → Import z @tabler/icons-react
├── Twig template? → Použij tabler_icon() funkci
├── Inline v textu? → Použij replaceTextWithIcons utility
└── Custom SVG? → Zvažit přidání do Tabler Icons nebo použít image
```

---

**Frontend architektura:** [architecture.md](architecture.md)  
**Hlavní dokumentace:** [../overview.md](../overview.md)  
**Aktualizováno:** 2025-07-22 - Přidán Tabler Icons systém