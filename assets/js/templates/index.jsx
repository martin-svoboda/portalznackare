/**
 * Template index.jsx for React applications
 * Standard mount point for all micro-frontend apps
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import TemplateApp from './ReactAppTemplate';

// Mount the app
const container = document.querySelector('[data-app="template-app"]');
if (container) {
    const root = createRoot(container);
    root.render(<TemplateApp />);
}