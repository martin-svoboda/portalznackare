import React from 'react';
import { createRoot } from 'react-dom/client';
import MediaLibraryAdmin from './App.jsx';

// Mount the app
const container = document.querySelector('[data-app="admin-media-library"]');
if (container) {
    const root = createRoot(container);
    root.render(<MediaLibraryAdmin />);
}
