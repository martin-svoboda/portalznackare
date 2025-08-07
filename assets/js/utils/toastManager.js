/**
 * Toast Manager - globální správa toast notifikací
 * Poskytuje API pro zobrazování toast zpráv napříč aplikací
 */

// Toast queue pro případy kdy kontejner ještě není ready
let toastQueue = [];
let isContainerReady = false;

/**
 * Označit kontejner jako připravený
 */
export const setContainerReady = (ready = true) => {
    isContainerReady = ready;
    
    // Zpracovat queue pokud kontejner je ready
    if (ready && toastQueue.length > 0) {
        toastQueue.forEach(toast => showToast(toast));
        toastQueue = [];
    }
};

/**
 * Hlavní funkce pro zobrazení toast notifikace
 * @param {Object} options - konfigurace toast
 * @param {string} options.type - typ toast: success, error, warning, info
 * @param {string} options.message - zpráva k zobrazení
 * @param {string} [options.title] - volitelný titul
 * @param {number} [options.duration=5000] - doba zobrazení v ms (0 = bez auto-dismiss)
 * @param {boolean} [options.showProgress=true] - zobrazit progress bar
 * @param {string} [options.id] - vlastní ID, jinak auto-generované
 */
export const showToast = (options) => {
    const toastData = {
        id: options.id || `toast-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        type: options.type || 'info',
        message: options.message || '',
        title: options.title,
        duration: options.duration !== undefined ? options.duration : 5000,
        showProgress: options.showProgress !== false,
        ...options
    };

    // Pokud kontejner není ready, přidat do fronty
    if (!isContainerReady) {
        toastQueue.push(toastData);
        return toastData.id;
    }

    // Vyslat event pro ToastContainer
    const event = new CustomEvent('add-toast', {
        detail: toastData
    });
    window.dispatchEvent(event);

    return toastData.id;
};

/**
 * Zobrazit success toast
 * @param {string} message - zpráva
 * @param {Object} options - další konfigurace
 */
export const showSuccessToast = (message, options = {}) => {
    return showToast({
        type: 'success',
        message,
        ...options
    });
};

/**
 * Zobrazit error toast
 * @param {string} message - zpráva  
 * @param {Object} options - další konfigurace
 */
export const showErrorToast = (message, options = {}) => {
    return showToast({
        type: 'error',
        message,
        duration: 0, // Error toasty se neautomaticky nezavírají
        ...options
    });
};

/**
 * Zobrazit warning toast
 * @param {string} message - zpráva
 * @param {Object} options - další konfigurace
 */
export const showWarningToast = (message, options = {}) => {
    return showToast({
        type: 'warning',
        message,
        duration: 7000, // Trochu delší pro warning
        ...options
    });
};

/**
 * Zobrazit info toast
 * @param {string} message - zpráva
 * @param {Object} options - další konfigurace
 */
export const showInfoToast = (message, options = {}) => {
    return showToast({
        type: 'info',
        message,
        ...options
    });
};

/**
 * Odstranit konkrétní toast
 * @param {string} id - ID toast k odstranění
 */
export const dismissToast = (id) => {
    const event = new CustomEvent('remove-toast', {
        detail: { id }
    });
    window.dispatchEvent(event);
};

/**
 * Odstranit všechny toasty
 */
export const clearAllToasts = () => {
    const event = new CustomEvent('clear-toasts');
    window.dispatchEvent(event);
    toastQueue = []; // Vyčistit i queue
};

/**
 * Parsovat error z API response a zobrazit jako toast
 * @param {Object|string|Error} error - error k parsování
 * @param {string} [defaultMessage] - fallback zpráva
 */
export const showApiError = (error, defaultMessage = 'Nastala neočekávaná chyba') => {
    let message = defaultMessage;
    let title = 'Chyba';
    
    try {
        // Parsovat různé formáty errorů
        if (typeof error === 'string') {
            message = error;
        } else if (error instanceof Error) {
            message = error.message;
        } else if (error?.message) {
            message = error.message;
            title = error.title || title;
        } else if (error?.error) {
            message = error.error;
        } else if (error?.detail) {
            message = error.detail;
        }
        
        // Backend validation errors
        if (error?.errors && Array.isArray(error.errors)) {
            message = error.errors.map(err => err.message || err).join(', ');
            title = 'Chyba validace';
        }
        
        // Symfony error format
        if (error?.type && error?.trace) {
            title = 'Chyba serveru';
            if (error.file && error.line) {
                console.error(`Server error in ${error.file}:${error.line}`, error);
            }
        }
        
    } catch (parseError) {
        console.error('Chyba při parsování error objektu:', parseError);
        message = defaultMessage;
    }

    return showErrorToast(message, { title });
};

/**
 * Zobrazit success toast pro API operaci
 * @param {string} message - success zpráva
 * @param {Object} options - další konfigurace
 */
export const showApiSuccess = (message, options = {}) => {
    return showSuccessToast(message, {
        title: 'Úspěch',
        ...options
    });
};

// Export všech funkcí jako default objekt pro convenience
export default {
    showToast,
    showSuccessToast,
    showErrorToast,
    showWarningToast,
    showInfoToast,
    dismissToast,
    clearAllToasts,
    showApiError,
    showApiSuccess,
    setContainerReady
};