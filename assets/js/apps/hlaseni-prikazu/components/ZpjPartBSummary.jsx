import React from 'react';
import { IconClipboardList, IconFileText } from '@tabler/icons-react';
import { ZPI_STAVY } from '../utils/zpiStavy';
import { kmCinnosti } from '../utils/zpjCinnosti';

const STAV_TRIDA = {
    3: 'text-green-600 dark:text-green-400',
    2: 'text-red-600 dark:text-red-400',
    4: 'text-orange-600 dark:text-orange-400'
};

/**
 * Souhrn části B u ZP-J (INSYZ-219): stav provedení činností, hlášení a počet fotek.
 */
export const ZpjPartBSummary = React.memo(({ formData, cinnosti }) => {
    const stavy = formData?.Cinnosti || {};

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <h4 className="font-medium flex items-center">
                    <IconClipboardList size={16} className="mr-2"/>
                    Činnosti
                </h4>
                <ul className="text-sm space-y-1">
                    {(cinnosti || []).map(cinnost => {
                        const id = String(cinnost.ID_ZP_JCCin);
                        const provedeni = Number(stavy[id]?.Provedeni);
                        const volba = ZPI_STAVY.find(v => v.value === provedeni);
                        const km = kmCinnosti(cinnost);

                        return (
                            <li key={id} className="flex justify-between gap-3">
                                <span>
                                    {cinnost.Popis_Cinnosti}
                                    {km !== null && ` (${km.toLocaleString('cs-CZ')} km)`}
                                </span>
                                <span className={`font-medium whitespace-nowrap ${STAV_TRIDA[provedeni] || 'text-yellow-600 font-bold'}`}>
                                    {volba ? volba.label : 'Nevyplněno'}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="space-y-2">
                <h4 className="font-medium flex items-center">
                    <IconFileText size={16} className="mr-2"/>
                    Hlášení o značkařské činnosti
                </h4>
                <div className="text-sm">
                    {formData?.Koment_Usek?.trim()
                        ? <p className="whitespace-pre-line">{formData.Koment_Usek}</p>
                        : <span className="text-yellow-600 font-bold">Bez hlášení</span>}
                </div>
                {formData?.Prilohy_Usek && Object.keys(formData.Prilohy_Usek).length > 0 && (
                    <div className="text-sm">
                        <span className="font-medium">Fotografické přílohy:</span> {Object.keys(formData.Prilohy_Usek).length} souborů
                    </div>
                )}
            </div>
        </div>
    );
});
