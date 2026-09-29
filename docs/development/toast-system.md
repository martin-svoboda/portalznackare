# Toast Notification System

> **Jednotný systém notifikací** pro procesní operace v aplikaci Portál značkaře

## Architektura

```
Toast Manager → Toast Container (React Portal) → Individual Toasts
     ↓                    ↓                           ↓
Event System       Global DOM Container        Auto-dismiss + Animations
```

**Klíčové komponenty:**
- **BEM + Tailwind only** - žádné externí UI knihovny
- **Dark mode support** - automatická synchronizace s aplikací
- **Event-driven architecture** - globální správa přes events
- **React Portal** - renderování mimo React strom

## Core Files

```
assets/css/components/toast.scss          # BEM styling s dark mode
assets/js/components/shared/Toast.jsx     # Jednotlivý toast komponenta  
assets/js/components/shared/ToastContainer.jsx  # Global container s React Portal
assets/js/utils/toastManager.js           # Toast state management
assets/js/utils/notifications.js          # Unified API s backward compatibility
assets/js/toast-system.js                 # Global initialization entry point
```

## API Reference

### Základní použití

```javascript
import { 
    showSuccessToast, 
    showErrorToast, 
    showWarningToast, 
    showInfoToast 
} from '../../utils/notifications.js';

// Success toast (auto-dismiss 5s)
showSuccessToast('Soubor byl úspěšně nahrán');

// Error toast (zůstává dokud uživatel nezavře)
showErrorToast('Chyba při nahrávání', { 
    title: 'Upload selhal', 
    duration: 0  // 0 = no auto-dismiss
});

// Warning s custom duration
showWarningToast('Můžete nahrát max 5 souborů', { 
    duration: 7000 
});

// Info toast
showInfoToast('Probíhá zpracování...', {
    title: 'Zpracování',
    showProgress: false  // bez progress baru
});
```

### API Error Handling

```javascript
import { showApiError, handleApiResponse } from '../../utils/notifications.js';

// Automatické parsování backend errorů
try {
    const response = await fetch('/api/endpoint');
    const data = await response.json();
    
    if (!response.ok) {
        showApiError(data); // Parsuje Symfony error formáty
        return;
    }
    
    showSuccessToast('Operace dokončena');
} catch (error) {
    showApiError(error, 'Nastala neočekávaná chyba');
}

// Nebo pomocná funkce pro celý response workflow
const data = await handleApiResponse(response, {
    successMessage: 'Data úspěšně uložena',
    errorMessage: 'Chyba při ukládání dat'
});
```

### Advanced Configuration

```javascript
// Custom toast s úplnou konfigurací
showToast({
    type: 'success',
    title: 'Custom Title',
    message: 'Detailed message text',
    duration: 8000,           // 8 sekund
    showProgress: true,       // progress bar
    id: 'unique-toast-id'     // custom ID pro dismissal
});

// Dismiss specific toast
import { dismissToast, clearAllToasts } from '../../utils/notifications.js';
dismissToast('unique-toast-id');
clearAllToasts(); // vyčistí všechny
```

## Toast Categories

### ✅ Procesní notifikace (Toast)

```javascript
// File operations
showSuccessToast('Soubor nahrán');
showErrorToast('Upload selhal');

// Form operations
showSuccessToast('Hlášení uloženo');
showWarningToast('Některá pole nejsou vyplněna');

// API operations
showApiError(apiResponse);
showInfoToast('Odesílám data...');

// Background processes
showSuccessToast('Worker úspěšně spuštěn');
showErrorToast('Worker crashed');
```

### 🔕 Statické informace (In-component alerts)

```jsx
// Tyto zůstávají jako komponenta alerty, NIKOLI toast
{!priceList && (
    <div className="alert alert--warning">
        <strong>Varování:</strong> Ceník nebyl nalezen.
    </div>
)}

{errors.email && (
    <div className="alert alert--danger">
        {errors.email}
    </div>
)}
```

## Styling

Toast komponenta používá BEM metodologii s Tailwind utility třídami:

```scss
// assets/css/components/toast.scss
.toast {
    // Typy notifikací s KČT brand colors
    &--success { @apply border-l-green-500; }
    &--error { @apply border-l-red-500; }
    &--warning { @apply border-l-yellow-500; }
    &--info { @apply border-l-blue-500; }
    
    // Dark mode automaticky
    @apply bg-white dark:bg-gray-800;
    @apply text-gray-900 dark:text-white;
}
```

## Troubleshooting

### Toast se nezobrazují

```bash
# Zkontroluj webpack build
npm run watch

# Zkontroluj global toast container
document.getElementById('toast-root'); # Měl by existovat

# Zkontroluj console errors
# Developer Tools → Console → React errors?
```

### Progress bar nefunguje

```javascript
// Duration musí být > 0 pro progress bar
showToast({ 
    message: 'Text', 
    duration: 5000,        // ✅ 5s = progress bar
    showProgress: true     // ✅ explicit enable
});

showToast({ 
    message: 'Text', 
    duration: 0,           // ❌ 0 = no progress bar
    showProgress: true     // ❌ ignored
});
```

### Toast systém není initialized

V `base.html.twig` musí být načtený toast-system.js entry:
```twig
{{ encore_entry_script_tags('toast-system') }}
```

---

**Related:** [Debug System](development.md) | [API](../api.md)  
**Architecture:** [../architecture.md](../architecture.md)  
**Updated:** 2025-08-07