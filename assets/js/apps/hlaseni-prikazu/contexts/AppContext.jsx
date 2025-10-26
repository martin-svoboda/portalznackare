import React, { createContext, useContext, useState } from 'react';
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
    const [appData] = useState(initialData);

    log.info('AppProvider mounted', {
        hasUsersDetails: !!appData?.usersDetails,
        hasTariffRates: !!appData?.tariffRates,
        hasHead: !!appData?.head,
        teamMembersCount: appData?.teamMembers?.length || 0
    });

    return (
        <AppContext.Provider value={appData}>
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
