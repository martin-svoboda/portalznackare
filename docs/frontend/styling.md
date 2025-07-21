# BEM Component CSS Structure

Nová CSS architektura kombinuje **Tailwind CSS** s **BEM metodikou** pro vytvoření udržitelného a škálovatelného stylování.

## Struktura

```
assets/css/
├── app.scss                 # Hlavní SCSS soubor (import všeho)
├── components/              # BEM komponenty
│   ├── layout.scss         # Layout prvky (sections, grids, containers)
│   ├── card.scss           # Card komponenty (dashboard, action, list cards)
│   ├── form.scss           # Formulářové prvky (inputs, buttons, labels)
│   ├── typography.scss     # Texty, nadpisy, seznamy
│   ├── alert.scss          # Upozornění, flash messages, toasts
│   ├── navigation.scss     # Navigace, menu, breadcrumbs, tabs
│   └── table.scss          # Tabulky, data grids
└── components.css          # Legacy CSS (bude postupně migrováno)
```

## Princip fungování

### 1. Tailwind CSS jako základ
- Atomické utility třídy pro základní stylování
- Používá se v kombinaci s `@apply` v SCSS

### 2. BEM komponenty pro opakované prvky
- **Block**: `.card`, `.form`, `.alert` 
- **Element**: `.card__header`, `.form__input`, `.alert__message`
- **Modifier**: `.card--elevated`, `.form--inline`, `.alert--danger`

### 3. Tailwind @apply v komponentách
```scss
.card {
  @apply bg-white rounded-lg shadow-sm border border-gray-200;
  
  &__header {
    @apply px-6 py-4 border-b border-gray-200;
  }
  
  &--elevated {
    @apply shadow-lg;
  }
}
```

## Použití v šablonách

### Twig šablony
```twig
<div class="card card--elevated">
  <div class="card__header">
    <h3 class="card__title">Nadpis karty</h3>
  </div>
  <div class="card__content">
    <p class="text text--muted">Obsah karty</p>
  </div>
</div>
```

### React komponenty
```tsx
function Card({ elevated, children }) {
  return (
    <div className={`card ${elevated ? 'card--elevated' : ''}`}>
      {children}
    </div>
  );
}
```

## Dostupné komponenty

### Layout
- `.main-content`, `.section`, `.grid`, `.flex-layout`
- `.container`, `.sidebar-layout`, `.header-layout`

### Cards  
- `.card`, `.dashboard-card`, `.action-card`, `.list-card`

### Forms
- `.form`, `.form-group`, `.form-input`, `.btn`
- Všechny varianty buttonů: `--primary`, `--secondary`, `--danger`

### Typography
- `.heading`, `.page-title`, `.text`, `.paragraph`
- `.link`, `.list`, `.quote`, `.code`

### Alerts
- `.alert`, `.flash-message`, `.toast`, `.banner`
- Varianty: `--success`, `--warning`, `--danger`, `--info`

### Navigation
- `.nav`, `.sidebar-nav`, `.breadcrumb`, `.tabs`
- `.dropdown`, `.mobile-menu`, `.step-nav`

### Tables
- `.table`, `.data-table`, `.responsive-table`
- `.action-table`, `.selectable-table`

## Build proces

1. **SCSS kompilace**: `assets/css/app.scss` → CSS
2. **Tailwind processing**: Automatické generování utility tříd
3. **PostCSS**: Autoprefixer a další optimalizace
4. **Webpack**: Bundling a minifikace

## Výhody tohoto přístupu

✅ **DRY princip** - Jeden styl pro Twig i React  
✅ **Škálovatelnost** - BEM pro větší komponenty, Tailwind pro detaily  
✅ **Údržba** - Centralizované stylování v SCSS souborech  
✅ **Performance** - Tailwind purging nepoužitých CSS  
✅ **Flexibilita** - Možnost kombinovat BEM a utility třídy  

## Migrace starých stylů

Stávající inline styly postupně přepisuj na BEM třídy:

```twig
<!-- Před -->
<div style="background: white; padding: 2rem; border-radius: var(--border-radius);">

<!-- Po -->
<div class="card">
```