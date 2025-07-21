import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Mount aplikace na element s data-app="prikazy"
const container = document.querySelector('[data-app="prikazy"]');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}