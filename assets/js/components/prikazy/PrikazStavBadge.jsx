import React from 'react';
import {
    IconSquare,
    IconSquareArrowRight,
    IconEdit,
    IconCheckbox,
    IconCopyCheck,
    IconCash,
} from '@tabler/icons-react';

const stavMap = {
    'Nové': { icon: IconSquare, color: 'gray' },
    'Vystavený': { icon: IconSquareArrowRight, color: 'indigo' },
    'Přidělený': { icon: IconEdit, color: 'blue' },
    'Provedený': { icon: IconCheckbox, color: 'teal' },
    'Předaný KKZ': { icon: IconCopyCheck, color: 'green' },
    'Zaúčtovaný': { icon: IconCash, color: 'lime' },
};

const colorClasses = {
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    lime: 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200',
};

export function PrikazStavBadge({ stav }) {
    const conf = stavMap[stav] || { icon: IconSquare, color: 'gray' };
    const Icon = conf.icon;
    const colorClass = colorClasses[conf.color] || colorClasses.gray;

    return (
        <span 
            className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${colorClass}`}
            title={stav}
        >
            <Icon size={14} className="mr-1" />
            {stav}
        </span>
    );
}