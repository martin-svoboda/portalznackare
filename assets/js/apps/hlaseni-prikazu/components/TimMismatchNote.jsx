import React from 'react';
import {smerovaniLabel} from '../utils/timMismatch';

/**
 * Nenápadná oranžová poznámka o nesouladu s INSYZ. Není to chyba –
 * jen upozornění, aby se data ověřila a případně opravila v INSYZ.
 *
 * @param {Object} diff - { Rok_Vyroby?: string, Smerovani?: string } pro daný předmět
 * @param {string} field - 'Rok_Vyroby' | 'Smerovani'
 */
export const TimMismatchNote = ({diff, field}) => {
    if (!diff || diff[field] == null || diff[field] === '') {
        return null;
    }

    const value = field === 'Smerovani' ? smerovaniLabel(diff[field]) : diff[field];

    return (
        <span className="text-xs text-orange-600 dark:text-orange-400 ml-2">
            V INSYZ je evidováno {value}
        </span>
    );
};
