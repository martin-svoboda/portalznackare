import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.querySelector('[data-app="admin-cms-page-editor"]');
if (container) {
    const pageId = container.dataset.pageId;
    const root = createRoot(container);
    root.render(<App pageId={pageId ? parseInt(pageId) : null} />);
}
