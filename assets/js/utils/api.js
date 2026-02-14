/**
 * Jednoduchá API utilita pro všechny aplikace
 * Automaticky loguje a zobrazuje notifikace
 */

import {log} from './debug';
import {showNotification} from './notifications';

/**
 * API Error třída pro lepší error handling
 */
export class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

/**
 * Základní API request s automatickým logováním a error handling
 */
export async function apiCall(endpoint, options = {}) {
    const {
        method = 'GET',
        data = null,
        showSuccess = false,
        successMessage = 'Operace proběhla úspěšně',
        showError = true,
        errorMessage = null
    } = options;

    // Automaticky přidej /api prefix pokud chybí
    const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;

    const config = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
    };

    // Pro GET requesty s daty použij query string
    let finalUrl = url;
    if (data && method === 'GET') {
        const params = new URLSearchParams(data);
        finalUrl = `${url}?${params}`;
    } else if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
        config.body = JSON.stringify(data);
    }

    // Loguj API volání
    log.api(method, finalUrl, data);

    try {
        const response = await fetch(finalUrl, config);

        // Zpracování 204 No Content - žádné JSON k parsování
        if (response.status === 204) {
            log.api('Odpověď:', finalUrl, 'Žádný obsah (204)');
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // Speciální handling pro autentizační chyby
            if (response.status === 401) {
                // Session vypršela - přesměrovat na login s návratovou URL
                const currentPath = window.location.pathname + window.location.search;
                const loginUrl = '/prihlaseni?redirect=' + encodeURIComponent(currentPath);
                window.location.href = loginUrl;

                // Throw error pro případ, že by redirect nefungoval
                const error = new ApiError(response.status, 'Session vypršela. Přesměrování na přihlášení...');
                error.requiresAuth = true;
                throw error;
            }

            if (response.status === 403) {
                const message = 'Nemáte oprávnění pro přístup k tomuto prostředku.';
                const error = new ApiError(response.status, message);
                error.insufficientPermissions = true;
                throw error;
            }

            // Podrobná chybová zpráva z serveru
            let message = (typeof errorData.error === 'string' ? errorData.error : errorData.message) || `HTTP ${response.status}`;

            // Přidej dodatečné informace pokud jsou k dispozici
            if (errorData.error_code) {
                message += ` (${errorData.error_code})`;
            }

            const error = new ApiError(response.status, message);
            error.errorCode = errorData.error_code;
            error.details = errorData.details;
            error.success = errorData.success;

            throw error;
        }

        const result = await response.json();

        // Zobraz success notifikaci pokud je požadována
        if (showSuccess) {
            showNotification('success', successMessage);
        }

        return result;

    } catch (error) {
        log.error(`API ${method} ${finalUrl} selhalo`, error);

        // Zobraz error notifikaci
        if (showError) {
            const message = errorMessage || error.message || 'Něco se pokazilo';
            showNotification('error', message);
        }

        throw error;
    }
}

/**
 * Pomocné funkce pro různé HTTP metody
 */
export const api = {
    // Základní metody
    get: (url, data, options = {}) =>
        apiCall(url, {...options, method: 'GET', data}),
    post: (url, data, options = {}) =>
        apiCall(url, {...options, method: 'POST', data}),
    put: (url, data, options = {}) =>
        apiCall(url, {...options, method: 'PUT', data}),
    delete: (url, options = {}) =>
        apiCall(url, {...options, method: 'DELETE'}),

    // Specifické endpointy pro snadné použití
    prikazy: {
        list: (params) => api.get('/insyz/prikazy', params),
        detail: (id) => api.get(`/insyz/prikaz/${id}`),
        report: (id) => {
            const params = {id_zp: id};
            return api.get('/portal/report', params);
        },
        saveReport: (data) => api.post('/portal/report', data, {
            showSuccess: true,
            successMessage: 'Hlášení bylo uloženo'
        }),
        zpUseky: (id) => api.get(`/insyz/zp-useky/${id}`)
    },

    insyz: {
        user: (int_adr = '') => api.get('/insyz/user', {int_adr}),
        sazby: (date) => api.get('/insyz/sazby', {date}),
        submitReport: (xmlData) => api.post('/insyz/submit-report', {xml_data: xmlData}, {
            showSuccess: true,
            successMessage: 'Hlášení bylo úspěšně odesláno do INSYZ'
        })
    },

    auth: {
        login: (username, password) => api.post('/auth/login', {username, password}),
        logout: () => api.post('/auth/logout'),
        status: () => api.get('/auth/status')
    }
};

export default api;