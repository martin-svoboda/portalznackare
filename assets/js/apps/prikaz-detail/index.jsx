import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Mount aplikace na element s data-app="prikaz-detail"
const container = document.querySelector('[data-app="prikaz-detail"]');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}