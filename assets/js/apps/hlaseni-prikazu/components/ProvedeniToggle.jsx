import React from 'react';
import { STAV_PROVEDENI } from '../../../utils/stavProvedeni';

/**
 * Přepínač Ne/Ano pro stav provedení (číselník StavProvedeniEnum: 2 Neprovedena, 3 Provedena).
 * Sdílí obnova úseků u ZP-O a činnosti u ZP-J.
 */
export const ProvedeniToggle = React.memo(({ provedena, onChange, disabled = false }) => {
    const tlacitko = (aktivni, aktivniTrida) => `px-3 py-1.5 text-sm font-medium transition-colors ${
        aktivni
            ? aktivniTrida
            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`;

    return (
        <div className="inline-flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
            <button
                type="button"
                className={tlacitko(!provedena, 'bg-red-600 text-white')}
                onClick={() => onChange(STAV_PROVEDENI.NEPROVEDENA)}
                disabled={disabled}
            >
                Ne
            </button>
            <button
                type="button"
                className={tlacitko(provedena, 'bg-green-600 text-white')}
                onClick={() => onChange(STAV_PROVEDENI.PROVEDENA)}
                disabled={disabled}
            >
                Ano
            </button>
        </div>
    );
});
