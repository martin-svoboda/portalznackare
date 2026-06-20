import React, { createContext, useContext } from 'react';
import { log } from '../../../utils/debug';

// Vytvoření Context pro read-only aplikační data
const AppContext = createContext(null);

/**
 * AppProvider - Provider pro globální aplikační data
 *
 * Poskytuje read-only data z API všem child komponentám:
 * - usersDetails: Data uživatelů včetně kvalifikací
 * - tariffRates: Sazby pro výpočty náhrad
 * - head: Hlavička příkazu
 * - predmety: TIM předměty
 * - useky: Úseky tras
 * - teamMembers: Členové týmu
 *
 * @param {Object} props.initialData - Počáteční data z API
 * @param {ReactNode} props.children - Child komponenty
 */
export function AppProvider({ children, initialData }) {
    // POZOR: nepoužívat useState(initialData) – to zamrzne hodnotu při prvním
    // mountu a ignoruje pozdější změny (např. po sjednocení týmu se výpočet
    // náhrad neaktualizoval, dokud se stránka nereloadla). Předáváme aktuální
    // initialData přímo, aby context reflektoval změny (teamMembers, usersDetails…).
    log.info('AppProvider render', {
        hasUsersDetails: !!initialData?.usersDetails,
        hasTariffRates: !!initialData?.tariffRates,
        hasHead: !!initialData?.head,
        teamMembersCount: initialData?.teamMembers?.length || 0
    });

    return (
        <AppContext.Provider value={initialData}>
            {children}
        </AppContext.Provider>
    );
}

/**
 * Custom hook pro přístup k aplikačním datům
 *
 * @returns {Object} Aplikační data
 * @throws {Error} Pokud je použit mimo AppProvider
 *
 * @example
 * const { usersDetails, tariffRates, teamMembers } = useAppData();
 */
export function useAppData() {
    const context = useContext(AppContext);

    if (context === null) {
        throw new Error('useAppData musí být použit uvnitř AppProvider');
    }

    return context;
}

// Export contextu pro případné pokročilé použití
export { AppContext };
