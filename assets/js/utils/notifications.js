/**
 * Jednotné notifikační API
 * Používá vlastní toast systém místo console/alert fallbacků
 */

import { 
    showToast, 
    showSuccessToast, 
    showErrorToast, 
    showWarningToast, 
    showInfoToast,
    showApiError,
    showApiSuccess
} from './toastManager.js';

/**
 * Hlavní notifikační funkce (backward compatibility)
 * @param {string} type - typ notifikace: success, error, warning, info
 * @param {string} message - zpráva k zobrazení
 * @param {Object} options - další konfigurace
 */
export function showNotification(type, message, options = {}) {
    // Pokud existuje legacy window.flashMessage, použij ho pro Symfony flash messages
    if (window.flashMessage && options.legacy !== false) {
        try {
            window.flashMessage(message, type);
            return;
        } catch (e) {
            console.warn('Legacy flashMessage failed, using toast system:', e);
        }
    }
    
    // Mapování typů pro kompatibilitu
    const typeMapping = {
        'error': 'error',
        'danger': 'error',
        'success': 'success',
        'warning': 'warning',
        'notice': 'info',
        'info': 'info'
    };
    
    const toastType = typeMapping[type] || 'info';
    
    return showToast({
        type: toastType,
        message,
        ...options
    });
}

/**
 * Zobrazit úspěšnou notifikaci
 * @param {string} message - zpráva
 * @param {Object} options - konfigurace
 */
export function showSuccess(message, options = {}) {
    return showSuccessToast(message, options);
}

/**
 * Zobrazit chybovou notifikaci
 * @param {string|Object|Error} error - chyba nebo zpráva
 * @param {Object} options - konfigurace
 */
export function showError(error, options = {}) {
    if (typeof error === 'object' && error !== null) {
        return showApiError(error, options.defaultMessage);
    }
    return showErrorToast(error, options);
}

/**
 * Zobrazit varovnou notifikaci
 * @param {string} message - zpráva
 * @param {Object} options - konfigurace
 */
export function showWarning(message, options = {}) {
    return showWarningToast(message, options);
}

/**
 * Zobrazit informační notifikaci
 * @param {string} message - zpráva
 * @param {Object} options - konfigurace
 */
export function showInfo(message, options = {}) {
    return showInfoToast(message, options);
}

/**
 * Zpracovat API response a zobrazit odpovídající notifikaci
 * @param {Response|Object} response - fetch response nebo response objekt
 * @param {Object} options - konfigurace
 */
export async function handleApiResponse(response, options = {}) {
    try {
        let data;
        
        // Pokud je to fetch Response objekt
        if (response instanceof Response) {
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                showApiError(errorData, options.errorMessage || 'Nastala chyba při komunikaci se serverem');
                return null;
            }
            data = await response.json().catch(() => ({}));
        } else {
            data = response;
        }
        
        // Zobrazit success pokud je specifikována zpráva
        if (options.successMessage || data.message) {
            showApiSuccess(options.successMessage || data.message);
        }
        
        return data;
        
    } catch (error) {
        console.error('Error handling API response:', error);
        showApiError(error, options.errorMessage || 'Nastala neočekávaná chyba');
        return null;
    }
}

/**
 * Parsovat error z různých zdrojů
 * @param {any} error - error k parsování
 * @return {Object} strukturovaný error objekt
 */
export function parseError(error) {
    const result = {
        message: 'Nastala neočekávaná chyba',
        title: 'Chyba',
        details: null
    };
    
    try {
        if (typeof error === 'string') {
            result.message = error;
        } else if (error instanceof Error) {
            result.message = error.message;
            result.details = error.stack;
        } else if (error?.message) {
            result.message = error.message;
            result.title = error.title || result.title;
            result.details = error.details || error.trace;
        } else if (error?.error) {
            result.message = error.error;
        }
        
        // Symfony validation errors
        if (error?.violations && Array.isArray(error.violations)) {
            result.message = error.violations.map(v => v.message).join(', ');
            result.title = 'Chyba validace';
        }
        
    } catch (parseError) {
        console.error('Chyba při parsování error objektu:', parseError);
    }
    
    return result;
}

// Export všech funkcí pro kompatibilitu
export {
    showToast,
    showSuccessToast,
    showErrorToast, 
    showWarningToast,
    showInfoToast,
    showApiError,
    showApiSuccess
} from './toastManager.js';

// Default export pro convenience
export default {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    handleApiResponse,
    parseError
};