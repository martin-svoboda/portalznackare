import React from 'react';

const stavMap = {
    'Nové': { color: 'gray' },
    'Vystavený': { color: 'indigo' },
    'Přidělený': { color: 'blue' },
    'Provedený': { color: 'teal' },
    'Předaný KKZ': { color: 'green' },
    'Zaúčtovaný': { color: 'lime' },
};

export function PrikazStavBadge({ stav }) {
    const conf = stavMap[stav] || { color: 'gray' };
    
    // Mapování barev na Tailwind třídy
    const colorClasses = {
        gray: 'bg-gray-100 text-gray-800 border-gray-200',
        indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        blue: 'bg-blue-100 text-blue-800 border-blue-200',
        teal: 'bg-teal-100 text-teal-800 border-teal-200',
        green: 'bg-green-100 text-green-800 border-green-200',
        lime: 'bg-lime-100 text-lime-800 border-lime-200',
    };

    const baseClasses = 'inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border';
    const colorClass = colorClasses[conf.color] || colorClasses.gray;

    // SVG ikony pro jednotlivé stavy
    const getIcon = () => {
        switch (stav) {
            case 'Nové':
                return (
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    </svg>
                );
            case 'Vystavený':
                return (
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <path d="M9 12l2 2 4-4"/>
                    </svg>
                );
            case 'Přidělený':
                return (
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>
                    </svg>
                );
            case 'Provedený':
                return (
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                );
            case 'Předaný KKZ':
                return (
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        <path d="M9 14l2 2 4-4"/>
                    </svg>
                );
            case 'Zaúčtovaný':
                return (
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
                        <path d="M16 8h4l3 4-3 4h-4"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                    </svg>
                );
            default:
                return (
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    </svg>
                );
        }
    };

    return (
        <span 
            className={`${baseClasses} ${colorClass}`}
            title={stav}
        >
            {getIcon()}
            {stav}
        </span>
    );
}