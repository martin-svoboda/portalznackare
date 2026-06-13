import React from 'react';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

// Jméno značkaře - snapshot ukládá pole "Znackar", hlavička "name"
const memberName = (m) => m?.name || m?.Znackar || m?.Jmeno || `INT_ADR ${m?.INT_ADR ?? '?'}`;

/**
 * Varování zobrazené pod hlavičkou hlášení, když se uložené složení značkařů
 * neshoduje s aktuální hlavičkou příkazu (přidaný / odebraný značkař).
 *
 * @param {Array} added    - značkaři v hlavičce, kteří chybí v uloženém hlášení
 * @param {Array} removed  - značkaři v uloženém hlášení, kteří už nejsou v hlavičce
 * @param {Function} onConfirm - sjednotí hlášení s aktuální hlavičkou
 * @param {boolean} disabled
 */
export const TeamMismatchWarning = ({ added = [], removed = [], onConfirm, disabled = false }) => {
    if (added.length === 0 && removed.length === 0) {
        return null;
    }

    return (
        <div className="alert alert--warning">
            <div className="flex items-start gap-3">
                <IconAlertTriangle size={24} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                    <p className="font-semibold">
                        Složení značkařů v příkazu se neshoduje s uloženým hlášením.
                    </p>

                    {added.length > 0 && (
                        <p>
                            <span className="font-medium">Přidáni:</span>{' '}
                            {added.map(memberName).join(', ')}
                        </p>
                    )}

                    {removed.length > 0 && (
                        <p>
                            <span className="font-medium">Odebráni:</span>{' '}
                            {removed.map(memberName).join(', ')}
                        </p>
                    )}

                    <p className="text-sm">
                        Načtením se hlášení sjednotí s aktuálním složením příkazu.
                        {removed.length > 0 && ' Odebraní značkaři budou odstraněni ze skupin cest a z plátců nocležného a vedlejších výdajů.'}
                        {added.length > 0 && ' Přidané je poté potřeba ručně zařadit do skupin cest.'}
                    </p>

                    <button
                        type="button"
                        className="btn btn--warning btn--sm"
                        onClick={onConfirm}
                        disabled={disabled}
                    >
                        <IconRefresh size={16} />
                        Načíst aktuální složení z příkazu
                    </button>
                </div>
            </div>
        </div>
    );
};
