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

/**
 * Vytvořit debug logger pro specifickou komponentu
 * @param {string} componentName - Název komponenty
 * @returns {object} Logger instance
 */
export const createDebugLogger = (componentName) => ({
    lifecycle: (message, data = null) => {
        if (!debugEnabled) return;
        console.log(`[${new Date().toLocaleTimeString('cs-CZ')}] 🔄 [${componentName}] ${message}`, data || '');
    },
    
    api: (method, url, requestData = null, responseData = null) => {
        if (!debugEnabled) return;
        if (responseData) {
            console.log(`[${new Date().toLocaleTimeString('cs-CZ')}] ✅ [${componentName}] ${method} ${url}`, { request: requestData, response: responseData });
        } else {
            console.log(`[${new Date().toLocaleTimeString('cs-CZ')}] 📤 [${componentName}] ${method} ${url}`, requestData || '');
        }
    },
    
    state: (stateName, oldValue = null, newValue = null) => {
        if (!debugEnabled) return;
        console.log(`[${new Date().toLocaleTimeString('cs-CZ')}] 📊 [${componentName}] State: ${stateName}`, { old: oldValue, new: newValue });
    },

    error: (message, error = null) => {
        console.error(`[${new Date().toLocaleTimeString('cs-CZ')}] ❌ [${componentName}] ${message}`, error || '');
    },
    
    performance: (operationName, duration) => {
        if (!debugEnabled) return;
        console.log(`[${new Date().toLocaleTimeString('cs-CZ')}] ⚡ [${componentName}] ${operationName}: ${duration}ms`);
    },
    
    custom: (message, data = null) => {
        if (!debugEnabled) return;
        console.log(`[${new Date().toLocaleTimeString('cs-CZ')}] 💬 [${componentName}] ${message}`, data || '');
    }
});

// Export pro zpětnou kompatibilitu
export default log;