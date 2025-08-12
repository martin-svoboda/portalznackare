# Globální State Badge System

Tento dokument popisuje jednotný systém pro zobrazování state badges napříč aplikacemi.

## Struktura souborů

### Utility soubor
- **`/assets/js/utils/stateBadge.js`** - Globální funkce a konstanty
  - `STATE_LABELS` - Mapa textových labelů (např. 'draft' → 'Rozpracováno')
  - `STATE_BADGE_CLASSES` - CSS třídy pro badge (např. 'draft' → 'badge--secondary')
  - `getStateLabel(state)` - Vrací český label pro stav
  - `getStateBadgeClass(state)` - Vrací CSS třídu pro badge

### React komponenta
- **`/assets/js/components/StateBadge.jsx`** - Jednotná React komponenta
  - Props: `state` (required), `className` (optional)
  - Automaticky aplikuje správné CSS třídy a label

## Využití v aplikacích

### React aplikace
```javascript
import { StateBadge } from '../../components/StateBadge';
import { getStateLabel } from '../../utils/stateBadge';

// Zobrazení badge
<StateBadge state="draft" />

// Použití v select options
<option value="draft">{getStateLabel('draft')}</option>
```

### Aktualizované aplikace
- ✅ **admin-reports-list** - TanStack Table cell renderer
- ✅ **admin-report-detail** - Info tab a Historie tab  
- ✅ **admin-report-detail** - Select options pro změnu stavu

## Výhody
- **Konzistentnost** - Jednotné labely a barvy napříč aplikacemi
- **Udržovatelnost** - Změna na jednom místě se projeví všude
- **Reusabilita** - Snadné přidání do nových aplikací
- **Type safety** - Centralizované definice stavů

## Dostupné stavy
| Stav | Label | CSS třída |
|------|-------|----------|
| `draft` | Rozpracováno | `badge--secondary` |
| `send` | Odesílání do INSYZ | `badge--warning` |
| `submitted` | Přijato v INSYZ | `badge--primary` |
| `approved` | Schváleno v INSYZ | `badge--success` |
| `rejected` | Zamítnuto v INSYZ | `badge--danger` |

## Rozšíření systému
Pro přidání nového stavu stačí aktualizovat konstanty v `/assets/js/utils/stateBadge.js`.