/**
 * API služba pro komunikaci se Symfony backendem
 * Sdílená mezi všemi micro-aplikacemi
 */

const API_BASE_URL = '/api';

export interface ApiResponse<T = any> {
    success?: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Základní API volání
 */
export async function apiCall<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    };

    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    } else if (data && method === 'GET') {
        const params = new URLSearchParams(data);
        return apiCall(`${endpoint}?${params}`, 'GET');
    }

    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                response.status,
                errorData.message || `HTTP ${response.status}`
            );
        }

        return await response.json();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new Error('Network error');
    }
}

/**
 * API endpoints
 */
export const api = {
    // Auth
    auth: {
        login: (username: string, password: string) =>
            apiCall<ApiResponse>('/auth/login', 'POST', { username, password }),
        logout: () =>
            apiCall<ApiResponse>('/auth/logout', 'POST'),
        status: () =>
            apiCall<{ authenticated: boolean; user: any }>('/auth/status'),
    },

    // Příkazy
    prikazy: {
        list: (params?: { year?: number; int_adr?: number }) =>
            apiCall<any[]>('/insys/prikazy', 'GET', params),
        detail: (id: number) =>
            apiCall<any>('/portal/prikaz', 'GET', { id }),
        report: (id: number) =>
            apiCall<any>('/portal/report', 'GET', { id_zp: id }),
        saveReport: (data: any) =>
            apiCall<ApiResponse>('/portal/report', 'POST', data),
    },

    // Insys
    insys: {
        user: () =>
            apiCall<any>('/insys/user'),
        ceniky: (date?: string) =>
            apiCall<any>('/insys/ceniky', 'GET', { date }),
    },
};