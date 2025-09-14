import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createDebugLogger } from '../../utils/debug';

const logger = createDebugLogger('UserPreferences');

// Připojení React aplikace na DOM
const container = document.querySelector('[data-app="user-preferences"]');

if (container) {
    logger.lifecycle('Mounting UserPreferences app');

    // Debug mount
    if (window.debugTwig && typeof window.debugTwig.mount === 'function') {
        window.debugTwig.mount('UserPreferences', '[data-app="user-preferences"]', {
            containerFound: true
        });
    }

    const root = createRoot(container);
    root.render(<App />);

    logger.lifecycle('UserPreferences app mounted successfully');
} else {
    logger.error('Mount container not found', new Error('Container [data-app="user-preferences"] not found'));
}