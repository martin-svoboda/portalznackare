import React from 'react';
import {
    IconSquare,
    IconSquareArrowRight,
    IconEdit,
    IconCheckbox,
    IconCopyCheck,
    IconCash, IconSquareX,
} from '@tabler/icons-react';

const stavMap = {
    'Nové': {
        icon: IconSquare, 
        className: '!bg-gray-100 !text-gray-800 dark:!bg-gray-900 dark:!text-gray-200'
    },
    'Vystavený': {
        icon: IconSquareArrowRight, 
        className: '!bg-indigo-100 !text-indigo-800 dark:!bg-indigo-900 dark:!text-indigo-200'
    },
    'Přidělený': {
        icon: IconEdit, 
        className: '!bg-blue-100 !text-blue-800 dark:!bg-blue-900 dark:!text-blue-200'
    },
    'Provedený': {
        icon: IconCheckbox, 
        className: '!bg-teal-100 !text-teal-800 dark:!bg-teal-900 dark:!text-teal-200'
    },
    'Předaný KKZ': {
        icon: IconCopyCheck, 
        className: '!bg-green-100 !text-green-800 dark:!bg-green-900 dark:!text-green-200'
    },
    'Zaúčtovaný': {
        icon: IconCash, 
        className: '!bg-lime-100 !text-lime-800 dark:!bg-lime-900 dark:!text-lime-200'
    },
    'Stornovaný': {
        icon: IconSquareX, 
        className: '!bg-red-100 !text-red-800 dark:!bg-red-900 dark:!text-red-200'
    },
};

export function PrikazStavBadge({stav}) {
    const conf = stavMap[stav] || {
        icon: IconSquare, 
        className: '!bg-gray-100 !text-gray-800 dark:!bg-gray-900 dark:!text-gray-200'
    };
    const Icon = conf.icon;

    return (
        <span
            className={`badge badge--md ${conf.className}`}
            title={stav}
        >
            <Icon size={14} className="mr-1"/>
            {stav}
        </span>
    );
}