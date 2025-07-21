import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Najdi DOM element pro aplikaci
const container = document.querySelector('[data-app="hlaseni-prikazu"]');

if (container) {
    const root = createRoot(container);
    root.render(<App />);
}