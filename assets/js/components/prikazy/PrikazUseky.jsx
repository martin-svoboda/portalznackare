import React from 'react';
import { renderHtmlContent, replaceTextWithIcons } from '../../utils/htmlUtils';

const formatKm = (km) => km ? parseFloat(km).toFixed(1) : '0';

// HTML utility functions now imported from shared utils

// Color mapping function now imported from shared utils

// Color classes removed - using BEM badge classes directly

// Komponenta pro vykreslování značek - používá HTML ze serveru
const ZnackaRenderer = ({ htmlString, size = 30 }) => {
    if (htmlString) {
        return renderHtmlContent(htmlString);
    }
    // Fallback placeholder pokud není HTML ze serveru
    return (
        <div 
            className="flex items-center justify-center bg-gray-200 rounded text-xs"
            style={{ width: size, height: size }}
        >
            Z
        </div>
    );
};

export const PrikazUseky = ({ useky, soubeh }) => {
    return (
        <>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <tbody>
                        {useky.map((usek) => (
                            <tr key={usek.Kod_ZU} className="border-b border-gray-200 dark:border-gray-700">
                                <td className="py-3 px-2">
                                    <ZnackaRenderer htmlString={usek.Znacka_HTML} size={30} />
                                </td>
                                <td className="py-3 px-2">
                                    {replaceTextWithIcons(usek.Nazev_ZU, 14)}
                                </td>
                                <td className="py-3 px-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span>{formatKm(usek.Delka_ZU)} Km</span>
                                        <span className={`badge badge--kct-${usek.Barva_Kod.toLowerCase()}`}>
                                            {usek.Barva_Naz}
                                        </span>
                                        <span className="text-sm">
                                            {usek.Druh_Presunu || usek.Druh_Presunu}
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
                                <ZnackaRenderer key={index} htmlString={row.Znacka_HTML} size={30} />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </>
    );
};