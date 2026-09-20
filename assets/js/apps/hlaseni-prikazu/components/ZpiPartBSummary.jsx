import React, { useMemo } from 'react';
import { IconMapPin } from '@tabler/icons-react';
import { seskupTimyZpi, pocetProvedenychTimu } from '../../../utils/prikaz';
import { replaceTextWithIcons } from '../../../utils/htmlUtils';
import { STAV_PROVEDENI } from '../../../utils/stavProvedeni';
import { ZPI_STAVY, CINNOST_POPIS, identifikatorPolozky, stavPolozky } from '../utils/zpiStavy';

/**
 * Souhrn části B pro příkazy ZP-I (INSYZ-280, Michal 13. 9. 2026).
 *
 * ZP-O souhrn (`PartBSummary`) sem nepatří – ukazoval by zachovalost, rok výroby,
 * orientaci, středové pravidlo, komentář ke značkařskému úseku a průběh trasy, což
 * jsou pole, která ZP-I nesbírá. Tady jde jen o to, co se na TIMu dělalo a jestli
 * to bylo provedeno.
 */

const STAV_TRIDA = {
    [STAV_PROVEDENI.PROVEDENA]: 'text-green-600 dark:text-green-400 font-medium',
    [STAV_PROVEDENI.NEPROVEDENA]: 'text-red-500 font-medium',
    [STAV_PROVEDENI.ODLOZENA]: 'text-orange-600 dark:text-orange-400 font-medium'
};

const popisStavu = (kod) => ZPI_STAVY.find(volba => volba.value === kod)?.label;

/**
 * Popis položky do souhrnu – u předmětu jeho evidenční číslo a druh, u servisu text zásahu.
 */
const popisPolozky = (item) => {
    if (item.Cinnost === 'servis') {
        return item.TIM_Text?.trim() || item.Popis?.trim() || 'Servisní zásah bez bližšího popisu';
    }

    const evidencni = `${item.EvCi_TIM}${item.Predmet_Index ?? ''}`.trim();

    return [evidencni, item.Druh_Predmetu_Naz].filter(Boolean).join(' — ');
};

export const ZpiPartBSummary = ({
    formData,
    predmety = null,
    servisTimy = [],
    compact = false
}) => {
    const timy = useMemo(
        () => seskupTimyZpi(predmety || [], servisTimy || []),
        [predmety, servisTimy]
    );

    const stavyTim = formData?.Stavy_Tim || {};
    const textSize = compact ? 'text-sm' : 'text-base';
    const smallTextSize = compact ? 'text-xs' : 'text-sm';
    const blockStyle = compact
        ? 'space-y-1'
        : 'space-y-2 mb-4 border-b border-gray-200 dark:border-gray-700 pb-4';

    if (timy.length === 0) {
        return (
            <div className={smallTextSize}>
                K tomuto příkazu nejsou žádné TIMy k instalaci, odinstalaci ani servisu.
            </div>
        );
    }

    const provedenych = pocetProvedenychTimu(stavyTim);

    return (
        <div className="space-y-6">
            {timy.map(tim => {
                const zaznamTimu = stavyTim[tim.EvCi_TIM] || {};
                const pocetFotek = Object.keys(zaznamTimu.Prilohy_TIM || {}).length;

                return (
                    <div key={tim.EvCi_TIM} className={blockStyle}>
                        <h4 className={`font-medium ${textSize} flex items-center`}>
                            <IconMapPin size={16} className="mr-2"/>
                            <span>{replaceTextWithIcons(tim.Naz_TIM)}</span>
                            <span className="ml-1">(TIM {tim.EvCi_TIM})</span>
                        </h4>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-300 dark:border-gray-600">
                                        <th className={`${smallTextSize} font-semibold text-gray-600 dark:text-gray-400 text-left py-1 pr-4`}>Úkol</th>
                                        <th className={`${smallTextSize} font-semibold text-gray-600 dark:text-gray-400 text-left py-1 pr-4`}>Položka</th>
                                        <th className={`${smallTextSize} font-semibold text-gray-600 dark:text-gray-400 text-left py-1`}>Stav</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tim.items.map(item => {
                                        const stav = stavPolozky(stavyTim, tim.EvCi_TIM, item)?.Provedeni;

                                        return (
                                            <tr
                                                key={identifikatorPolozky(item)}
                                                className="border-b border-gray-200 dark:border-gray-700"
                                            >
                                                <td className={`${smallTextSize} py-2 pr-4`}>
                                                    {CINNOST_POPIS[item.Cinnost]}
                                                </td>
                                                <td className={`${smallTextSize} py-2 pr-4 ${item.Cinnost === 'odinstalace' ? 'line-through opacity-75' : ''}`}>
                                                    {popisPolozky(item)}
                                                </td>
                                                <td className={`${smallTextSize} py-2`}>
                                                    {popisStavu(stav) ? (
                                                        <span className={STAV_TRIDA[stav]}>{popisStavu(stav)}</span>
                                                    ) : (
                                                        <span className="text-red-500 font-bold">chybí stav</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {zaznamTimu.Koment_TIM && (
                            <div className={smallTextSize}>
                                <span className="font-medium">Komentář k TIMu:</span> {zaznamTimu.Koment_TIM}
                            </div>
                        )}

                        {pocetFotek > 0 && (
                            <div className={smallTextSize}>
                                <span className="font-medium">Fotografie TIMu:</span> {pocetFotek} souborů
                            </div>
                        )}
                    </div>
                );
            })}

            <div className={`${smallTextSize} flex justify-between`}>
                <span className="font-medium">TIMy započítané do náhrady (aspoň jedna položka provedena):</span>
                <span className={provedenych > 0 ? 'font-medium' : 'text-red-500 font-bold'}>
                    {provedenych} z {timy.length}
                </span>
            </div>
        </div>
    );
};
