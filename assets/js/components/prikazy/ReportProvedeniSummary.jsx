import React from 'react';
import {IconCrown} from '@tabler/icons-react';
import {StateBadge} from '@utils/stateBadge';

/**
 * Prezentační souhrn hlášení (obsah karty „Hlášení příkazu") – stav, dokončení
 * Části A/B, datum provedení a per-značkař rozpad z ULOŽENÉ kalkulace.
 * Žádné fetchování, žádný přepočet.
 *
 * @param {string} state - stav hlášení
 * @param {Array} znackari - členové týmu (s INT_ADR, Znackar, Je_Vedouci)
 * @param {Object} calculation - uložená kalkulace klíčovaná INT_ADR
 * @param {Object} [presmerovani] - přesměrování výplat z dataA.Presmerovani_Vyplat ({ z_INT_ADR: na_INT_ADR })
 * @param {string} [datumProvedeni] - ISO datum provedení (z dataA.Datum_Provedeni)
 * @param {boolean} [castADokoncena]
 * @param {boolean} [castBDokoncena]
 * @param {boolean} [showAll=false] - zobrazit rozpad všech značkařů (admin/vedoucí)
 * @param {number|string} [currentUserIntAdr] - INT_ADR přihlášeného (když !showAll)
 */
export const ReportProvedeniSummary = ({
    state,
    znackari = [],
    calculation = {},
    presmerovani = {},
    datumProvedeni = null,
    castADokoncena = false,
    castBDokoncena = false,
    showAll = false,
    currentUserIntAdr = null,
}) => {
    const jmenoZnackare = (intAdr) =>
        (znackari || []).find(z => z.INT_ADR == intAdr)?.Znackar || `INT_ADR ${intAdr}`;

    const presmerovaniList = Object.entries(presmerovani || {})
        .filter(([, naIntAdr]) => naIntAdr);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StateBadge state={state}/>
                <span className={`badge badge--sm ${castADokoncena ? 'badge--success' : 'badge--danger'}`}>
                    Část A: {castADokoncena ? 'Dokončeno' : 'Nedokončeno'}
                </span>
                <span className={`badge badge--sm ${castBDokoncena ? 'badge--success' : 'badge--danger'}`}>
                    Část B: {castBDokoncena ? 'Dokončeno' : 'Nedokončeno'}
                </span>
                <div className="space-y-2">
                    <span className="text-sm text-gray-600">Provedení:</span>
                    {datumProvedeni && (
                        <span className="text-sm">
                            {new Date(datumProvedeni).toLocaleDateString('cs-CZ')}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                {(znackari || []).map((znackar, i) => {
                    const calc = calculation?.[znackar.INT_ADR];
                    const canShow = (showAll || currentUserIntAdr == znackar.INT_ADR) && calc;
                    return (
                        <div
                            key={i}
                            className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border dark:border-gray-700 text-sm">
                            {canShow ? (
                                <>
                                    <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700 flex gap-4 items-center">
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold">{znackar.Znackar}</span>
                                            {znackar.Je_Vedouci && (
                                                <IconCrown size={18} color="#ffd700" title="Vedoucí" aria-label="Vedoucí"/>
                                            )}
                                        </div>
                                        <div>
                                            <strong>Celkem: {calc.Celkem_Kc || 0} Kč</strong>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div><strong>Čas práce:</strong> {calc.Cas_Prace_Celkem || 0} h</div>
                                        <div><strong>Náhrady:</strong> {calc.Nahrada_Prace || 0} Kč</div>
                                        <div>
                                            <strong>Jízdné:</strong> {calc.Jizdne_Celkem || 0} Kč
                                            {calc.Zvysena_Sazba && (
                                                <span className="badge badge--light badge--warning">Zvýšené</span>
                                            )}
                                        </div>
                                        <div><strong>Stravné:</strong> {calc.Stravne || 0} Kč</div>
                                        <div><strong>Noclezné:</strong> {calc.Noclezne_Celkem || 0} Kč</div>
                                        <div><strong>Vedlejší výdaje:</strong> {calc.Vedlejsi_Vydaje_Celkem || 0} Kč</div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <span className="font-bold">{znackar.Znackar}</span>
                                    {znackar.Je_Vedouci && (
                                        <IconCrown size={18} color="#ffd700" title="Vedoucí" aria-label="Vedoucí"/>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {presmerovaniList.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border dark:border-gray-700 text-sm">
                    <div className="font-bold mb-2">Přesměrování výplat</div>
                    <ul className="space-y-1">
                        {presmerovaniList.map(([zIntAdr, naIntAdr]) => (
                            <li key={zIntAdr}>
                                {jmenoZnackare(zIntAdr)} → {jmenoZnackare(naIntAdr)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
