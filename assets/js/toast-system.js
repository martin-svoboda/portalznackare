/**
 * Toast systém - globální inicializace
 * Automaticky se spouští na všech stránkách a vytváří toast kontejner
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContainer } from './components/shared/ToastContainer.jsx';
import { setContainerReady } from './utils/toastManager.js';

// Inicializovat toast systém po načtení stránky
document.addEventListener('DOMContentLoaded', () => {
    // Vytvořit toast root element
    const toastRoot = document.createElement('div');
    toastRoot.id = 'toast-root';
    toastRoot.setAttribute('data-app', 'toast-system');
    document.body.appendChild(toastRoot);

    // Připojit React Toast Container
    const root = createRoot(toastRoot);
    root.render(React.createElement(ToastContainer, {
        position: 'top-right',
        maxToasts: 5
    }));

    // Označit toast systém jako připravený
    setContainerReady(true);
    
    // Debug log
    if (window.debugTwig) {
        window.debugTwig.log('TOAST', 'Toast systém globálně inicializován');
    }
});

// Export pro možnost manuální inicializace (pokud by bylo potřeba)
export { ToastContainer } from './components/shared/ToastContainer.jsx';
export * from './utils/toastManager.js';