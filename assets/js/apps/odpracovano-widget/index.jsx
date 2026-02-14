import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createDebugLogger } from '../../utils/debug';

const logger = createDebugLogger('OdpracovanoWidget');

const container = document.querySelector('[data-app="odpracovano-widget"]');

if (container) {
    logger.lifecycle('Mounting OdpracovanoWidget app');

    const root = createRoot(container);
    root.render(<App container={container} />);

    logger.lifecycle('OdpracovanoWidget app mounted successfully');
}
