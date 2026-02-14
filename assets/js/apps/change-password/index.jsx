import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createDebugLogger } from '../../utils/debug';

const logger = createDebugLogger('ChangePassword');

const container = document.querySelector('[data-app="change-password"]');

if (container) {
    logger.lifecycle('Mounting ChangePassword app');

    if (window.debugTwig && typeof window.debugTwig.mount === 'function') {
        window.debugTwig.mount('ChangePassword', '[data-app="change-password"]', {
            containerFound: true
        });
    }

    const root = createRoot(container);
    root.render(<App />);

    logger.lifecycle('ChangePassword app mounted successfully');
} else {
    logger.error('Mount container not found', new Error('Container [data-app="change-password"] not found'));
}
