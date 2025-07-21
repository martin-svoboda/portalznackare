import React from 'react';

const formatKm = (km) => km ? parseFloat(km).toFixed(1) : '0';
const replaceTextWithIcons = (text, size = 14) => text || '';

// Color mapping
const barvaDleKodu = (kod) => {
    switch(kod) {
        case 'CE': return 'red';
        case 'MO': return 'blue';
        case 'ZE': return 'green';
        case 'ZL': return 'yellow';
        default: return 'gray';
    }
};

const colorClasses = {
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

// Zástupný placeholder pro značku (bude řešeno přes Twig/PHP jako hotové HTML)
const ZnackaPlaceholder = ({ size }) => (
    <div 
        className="flex items-center justify-center bg-gray-200 rounded text-xs"
        style={{ width: size, height: size }}
    >
        Z
    </div>
);

export const PrikazUseky = ({ useky, soubeh }) => {
    return (
        <>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <tbody>
                        {useky.map((usek) => (
                            <tr key={usek.Kod_ZU} className="border-b border-gray-200 dark:border-gray-700">
                                <td className="py-3 px-2">
                                    <ZnackaPlaceholder size={30} />
                                </td>
                                <td className="py-3 px-2">
                                    {replaceTextWithIcons(usek.Nazev_ZU, 14)}
                                </td>
                                <td className="py-3 px-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span>{formatKm(usek.Delka_ZU)} Km</span>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${colorClasses[barvaDleKodu(usek.Barva_Kod)]}`}>
                                            {usek.Barva_Naz}
                                        </span>
                                        <span className="text-sm">
                                            {usek.Druh_Odbocky || usek.Druh_Znaceni}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Možný souběh/křížení tras */}
            {soubeh && soubeh.length > 1 && (
                <>
                    <div className="flex flex-wrap items-center gap-4 mt-5">
                        <div className="text-base font-bold">
                            Možný souběh/křížení tras:
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {soubeh.map((row, index) => (
                                <ZnackaPlaceholder key={index} size={30} />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </>
    );
};