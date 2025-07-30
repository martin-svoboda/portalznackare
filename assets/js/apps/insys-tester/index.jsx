import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Mount aplikace
const container = document.querySelector('[data-app="insys-tester"]');
if (container) {
    const root = createRoot(container);
    const endpoints = JSON.parse(container.dataset.endpoints || '[]');
    const debug = container.dataset.debug === 'true';
    
    root.render(<App endpoints={endpoints} debug={debug} />);
}