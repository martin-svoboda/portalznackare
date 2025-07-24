/**
 * Jednoduchý debug logger pro všechny aplikace
 * V produkci vypisuje jen chyby, v debug módu vše
 */

const isDebugMode = () => {
    const element = document.querySelector('[data-debug]');
    return element?.dataset?.debug === 'true' || false;
};

const debugEnabled = isDebugMode();

export const log = {
    // Vždy se vypisuje
    error: (message, error = null) => {
        console.error(`[${new Date().toLocaleTimeString('cs-CZ')}] ❌ ${message}`, error || '');
    },
    
    // Vypisuje se jen v debug módu
    info: (message, data = null) => {
        if (!debugEnabled) return;
        console.log(`[${new Date().toLocaleTimeString('cs-CZ')}] ℹ️ ${message}`, data || '');
    },
    
    // Vypisuje se jen v debug módu
    api: (method, url, data = null) => {
        if (!debugEnabled) return;
        console.log(`[${new Date().toLocaleTimeString('cs-CZ')}] 🔄 ${method} ${url}`, data || '');
    },
    
    // Vypisuje se jen v debug módu
    warn: (message, data = null) => {
        if (!debugEnabled) return;
        console.warn(`[${new Date().toLocaleTimeString('cs-CZ')}] ⚠️ ${message}`, data || '');
    }
};

// Export pro zpětnou kompatibilitu
export default log;