import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode
} from 'react';
import { apiCall } from '@services/api';

type User = {
	INT_ADR: string;
	Jmeno: string;
	Prijmeni: string;
	roles: string[]; // Pro role-based authorization
	isAdmin?: boolean; // Zkratka pro admin práva
	[K: string]: any;
};

type AuthContextType = {
	loggedIn: boolean;
	intAdr: string | null;
	user: User | null;
	isUserLoading: boolean;
	getIntAdr: () => string | null;
	login: (username: string, password: string) => Promise<boolean>;
	logout: () => Promise<void>;
	refreshUser: () => Promise<void>;
	checkAuthStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

type AuthProviderProps = {
	children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
	const [intAdr, setIntAdr] = useState<string | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [isUserLoading, setIsUserLoading] = useState<boolean>(true);

	// Při prvním načtení zkontrolovat autentizaci v Symfony
	useEffect(() => {
		checkAuthStatus();
	}, []);

	// Jakmile máme intAdr, pokusíme se natáhnout uživatele
	useEffect(() => {
		if (intAdr) {
			refreshUser();
		}
	}, [intAdr]);

	const checkAuthStatus = async () => {
		setIsUserLoading(true);
		try {
			// Zkontrolovat aktuální autentizační stav v Symfony
			const result = await apiCall('/auth/status', 'GET');
			if (result && result.authenticated && result.user) {
				// Uživatel je přihlášen
				const userData = {
					...result.user,
					roles: result.user.roles || [],
					isAdmin: result.user.roles?.includes('ROLE_ADMIN') || false
				};
				setUser(userData);
				setIntAdr(result.user.INT_ADR);
			} else {
				// Uživatel není přihlášen
				setUser(null);
				setIntAdr(null);
			}
		} catch (error) {
			console.error('Chyba při kontrole autentizace:', error);
			// Pouze Symfony session, žádný fallback
			setUser(null);
			setIntAdr(null);
		} finally {
			setIsUserLoading(false);
		}
	};

	const refreshUser = async () => {
		if (!intAdr) {
			setUser(null);
			return;
		}

		setIsUserLoading(true);
		try {
			// Načíst detaily uživatele z INSYS
			const result = await apiCall('/insys/user', 'GET');
			if (Array.isArray(result) && result.length > 0) {
				const userData = {
					...result[0],
					roles: result[0].roles || user?.roles || [],
					isAdmin: result[0].roles?.includes('ROLE_ADMIN') || user?.isAdmin || false
				};
				setUser(userData);
			} else if (result && typeof result === 'object') {
				const userData = {
					...result,
					roles: result.roles || user?.roles || [],
					isAdmin: result.roles?.includes('ROLE_ADMIN') || user?.isAdmin || false
				};
				setUser(userData);
			} else {
				setUser(null);
			}
		} catch (error) {
			console.error('Chyba při načítání uživatele:', error);
			// Zachovat současného uživatele při chybě
		} finally {
			setIsUserLoading(false);
		}
	};

	const login = async (username: string, password: string): Promise<boolean> => {
		try {
			// Přihlášení přes Symfony
			const result = await apiCall('/auth/login', 'POST', { username, password });
			
			if (result && result.success && result.user) {
				// Přihlášení úspěšné
				const userData = {
					...result.user,
					roles: result.user.roles || [],
					isAdmin: result.user.roles?.includes('ROLE_ADMIN') || false
				};
				setUser(userData);
				setIntAdr(result.user.INT_ADR);
				
				// Vyčistit jakékoliv staré localStorage údaje
				localStorage.removeItem('int_adr');
				
				return true;
			} else {
				return false;
			}
		} catch (error) {
			console.error('Chyba při přihlašování:', error);
			return false;
		}
	};

	const logout = async () => {
		try {
			// Odhlášení přes Symfony
			await apiCall('/auth/logout', 'POST');
		} catch (error) {
			console.error('Chyba při odhlašování:', error);
		}
		
		// Vyčistit lokální stav
		setIntAdr(null);
		setUser(null);
		// Vyčistit jakékoliv staré localStorage údaje
		localStorage.removeItem('int_adr');
	};

	const getIntAdr = () => intAdr;

	const loggedIn = !!intAdr;

	const value: AuthContextType = {
		loggedIn,
		intAdr,
		user,
		isUserLoading,
		getIntAdr,
		login,
		logout,
		refreshUser,
		checkAuthStatus,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === null) {
		throw new Error('useAuth musí být použit uvnitř AuthProvider');
	}
	return context;
};