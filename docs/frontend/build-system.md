# Assets Build Instructions

## 🚀 Quick Start

Pro buildování CSS a JS assets spusť:

```bash
# Instalace závislostí (první spuštění)
npm install

# Development build
npm run dev

# Watch mode (automatický rebuild při změnách)
npm run watch

# Production build
npm run build
```

## 📁 Struktura

```
assets/
├── css/                    # CSS/SCSS soubory
│   ├── app.scss           # Hlavní stylesheet
│   └── components/        # BEM komponenty
├── js/                    # JavaScript/TypeScript
│   ├── apps/              # React micro-aplikace
│   └── entries/           # Webpack entry points
└── images/                # Obrázky a SVG
```

## 🛠️ Build System

- **Webpack Encore** - Pro bundling a asset management
- **Tailwind CSS** - Utility-first CSS framework  
- **SCSS** - Pro BEM komponenty s Tailwind @apply
- **TypeScript** - Pro React aplikace
- **PostCSS** - Pro Tailwind processing

## 🎯 BEM + Tailwind Architektura

Kombinujeme BEM komponenty s Tailwind utility třídami:

### V SCSS komponentách:
```scss
.card {
  @apply bg-white rounded-lg shadow-sm border border-gray-200;
  
  &__header {
    @apply px-6 py-4 border-b border-gray-200;
  }
}
```

### V Twig šablonách:
```twig
<div class="card">
  <div class="card__header">
    <h3 class="card__title">Nadpis</h3>
  </div>
</div>
```

## 🔧 Troubleshooting

### Problém s chybějícími soubory
Pokud webpack hlásí chybějící soubory, zkontroluj:
1. Existují všechny entry pointy v `webpack.config.js`?
2. Jsou správně nastavené cesty v `assets/js/entries/`?

### Tailwind třídy nefungují
1. Zkontroluj `tailwind.config.js` content paths
2. Ujisti se, že `@import 'tailwindcss/...'` je v `app.scss`
3. Spusť `npm run dev` pro rebuild

### React aplikace se nenačítá
1. Zkontroluj konzoli prohlížeče
2. Ujisti se, že HTML obsahuje správný `#app-{name}` element
3. Ověř, že entry point existuje v `assets/js/entries/`