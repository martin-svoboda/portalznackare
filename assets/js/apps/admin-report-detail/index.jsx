import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Mount aplikaci pouze pokud existuje kontejner
const container = document.querySelector('[data-app="admin-report-detail"]');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}