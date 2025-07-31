/**
 * Jednoduchá API utilita pro všechny aplikace
 * Automaticky loguje a zobrazuje notifikace
 */

import { log } from './debug';
import { showNotification } from './notifications';

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
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = errorData.message || `HTTP ${response.status}`;
            throw new ApiError(response.status, message);
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
        apiCall(url, { ...options, method: 'GET', data }),
    post: (url, data, options = {}) => 
        apiCall(url, { ...options, method: 'POST', data }),
    put: (url, data, options = {}) => 
        apiCall(url, { ...options, method: 'PUT', data }),
    delete: (url, options = {}) => 
        apiCall(url, { ...options, method: 'DELETE' }),

    // Specifické endpointy pro snadné použití
    prikazy: {
        list: (params) => api.get('/insys/prikazy', params),
        detail: (id) => api.get(`/insys/prikaz/${id}`),
        report: (id) => {
            const params = { id_zp: id };
            return api.get('/portal/report', params);
        },
        saveReport: (data) => api.post('/portal/report', data, { 
            showSuccess: true, 
            successMessage: 'Hlášení bylo uloženo' 
        })
    },

    insys: {
        user: () => api.get('/insys/user'),
        ceniky: (date) => api.get('/insys/ceniky', { date })
    },

    auth: {
        login: (username, password) => api.post('/auth/login', { username, password }),
        logout: () => api.post('/auth/logout'),
        status: () => api.get('/auth/status')
    }
};

export default api;