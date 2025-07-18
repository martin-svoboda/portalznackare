import { notifications } from "@mantine/notifications";

// TODO: Replace with proper config
const API_BASE_URL = '/api';

function addQueryArgs(url: string, params: Record<string, any>): string {
	const searchParams = new URLSearchParams();
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			searchParams.append(key, String(value));
		}
	});
	const queryString = searchParams.toString();
	return queryString ? `${url}?${queryString}` : url;
}

export async function apiCall<T = any>(
	endpoint: string,
	method: 'GET' | 'POST' = 'GET',
	data?: Record<string, any>
): Promise<T> {
	try {
		let url = API_BASE_URL + endpoint;
		const options: RequestInit = {
			method,
			headers: {
				'Content-Type': 'application/json',
				'X-Requested-With': 'XMLHttpRequest', // Pro rozpoznání AJAX requestů v Symfony
			},
			credentials: 'same-origin', // Posílat cookies pro session
		};

		if (method === 'GET' && data) {
			url = addQueryArgs(url, data);
		} else if (method !== 'GET') {
			options.body = JSON.stringify(data);
		}

		console.log('call API:', url);
		const response = await fetch(url, options);

		const responseData = await response.json();

		if (!response.ok) {
			// Pokud má chybová odpověď message z Symfony, použij ji
			const errorMessage = responseData?.message || `HTTP error! status: ${response.status}`;
			throw new Error(errorMessage);
		}

		return responseData;
	} catch (error: any) {
		console.error(`API error at ${endpoint}:`, error);
		notifications.show({
			color: 'red',
			title: 'Chyba při získávání dat',
			message: error.message,
			autoClose: 5000,
		});
		throw error;
	}
}

// Legacy alias for compatibility
export const apiRequest = apiCall;