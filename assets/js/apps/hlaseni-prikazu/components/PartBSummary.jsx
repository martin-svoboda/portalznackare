import React, { useMemo } from 'react';
import { 
    IconMapPin,
    IconFileText
} from '@tabler/icons-react';
import {replaceTextWithIcons} from "@utils/htmlUtils";

/**
 * Komponenta pro zobrazení kompletního souhrnu části B hlášení
 * Zobrazuje detailní výpis všech hodnot z formuláře s validací
 * TIM stavy v tabulkovém formátu stejně jako ve formuláři ale kompaktněji
 */
export const PartBSummary = ({ 
    formData, 
    head = null,
    predmety = null,
    compact = false
}) => {
    // Detekce typu na základě dat - pokud má Stavy_Tim, je to TIM příkaz
    const isTIMOrder = formData?.Stavy_Tim && Object.keys(formData.Stavy_Tim).length > 0;
    
    // Seskupení předmětů podle TIM pro tabulkové zobrazení
    const timGroups = useMemo(() => {
        if (!predmety || predmety.length === 0) return {};
        
        const groups = {};
        predmety.forEach(item => {
            if (!item.EvCi_TIM) return;
            if (!groups[item.EvCi_TIM]) {
                groups[item.EvCi_TIM] = {
                    EvCi_TIM: item.EvCi_TIM,
                    Naz_TIM: item.Naz_TIM,
                    items: []
                };
            }
            groups[item.EvCi_TIM].items.push(item);
        });
        return groups;
    }, [predmety]);
    
    const textSize = compact ? "text-sm" : "text-base";
    const smallTextSize = compact ? "text-xs" : "text-sm";
    const blockStyle = compact ? "space-y-1" : "space-y-2 mb-4 border-b border-gray-200 dark:border-gray-700 pb-4";
    
    const statusOptions = {
        "1": "1 - Nová",
        "2": "2 - Zachovalá", 
        "3": "3 - Nevyhovující",
        "4": "4 - Zcela chybí"
    };
    
    return (
        <div className="space-y-6">
            {/* TIM položky - stavy předmětů v tabulkovém formátu */}
            {isTIMOrder && Object.keys(timGroups).length > 0 && Object.values(timGroups).map(timGroup => {
                const timReport = formData.Stavy_Tim?.[timGroup.EvCi_TIM];
                const predmetyInTim = timReport?.Predmety || {};
                
                return (
                    <div key={timGroup.EvCi_TIM} className={blockStyle}>
                        <h4 className={`font-medium ${textSize} flex items-center`}>
                            <IconMapPin size={16} className="mr-2" />
                            <span dangerouslySetInnerHTML={{ __html: timGroup.Naz_TIM }} />
                            <span> (TIM {timGroup.EvCi_TIM})</span>
                        </h4>
                        
                        {/* Tabulka stavů předmětů - kompaktní verze formuláře */}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-300 dark:border-gray-600">
                                        <th className={`${smallTextSize} font-semibold text-gray-600 dark:text-gray-400 text-left py-1 pr-4`}>Předmět</th>
                                        <th className={`${smallTextSize} font-semibold text-gray-600 dark:text-gray-400 text-left py-1 pr-4`}>Stav</th>
                                        <th className={`${smallTextSize} font-semibold text-gray-600 dark:text-gray-400 text-left py-1 pr-4`}>Rok výroby</th>
                                        <th className={`${smallTextSize} font-semibold text-gray-600 dark:text-gray-400 text-left py-1`}>Orientace</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timGroup.items.map(item => {
                                        const itemId = item.ID_PREDMETY?.toString();
                                        const itemStatus = predmetyInTim[itemId];
                                        const isArrow = item.Druh_Predmetu && 'S' === item.Druh_Predmetu.toUpperCase();
                                        const isSponzor = item.Druh_Predmetu && 'P' === item.Druh_Predmetu.toUpperCase();
                                        const needsAdditionalData = itemStatus?.Zachovalost && ['1', '2'].includes(itemStatus.Zachovalost?.toString());
                                        
                                        return (
                                            <tr key={itemId} className="border-b border-gray-200 dark:border-gray-700">
                                                <td className={`${smallTextSize} py-2 pr-4 font-medium`}>
                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-sm font-bold">
                                                                                            {item.EvCi_TIM}{item.Predmet_Index}
                                                                                        </span>
                                                        <span className="text-sm font-medium">
                                                                                            {replaceTextWithIcons(item.Radek1)}
                                                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={`${smallTextSize} py-2 pr-4`}>
                                                    {itemStatus?.Zachovalost ? (
                                                        <span>{statusOptions[itemStatus.Zachovalost] || itemStatus.Zachovalost}</span>
                                                    ) : (
                                                        <span dangerouslySetInnerHTML={{ __html: '<span class="text-red-500 font-bold">chybí stav</span>' }} />
                                                    )}
                                                </td>
                                                <td className={`${smallTextSize} py-2 pr-4`}>
                                                    {needsAdditionalData && !isSponzor ? (
                                                        itemStatus?.Rok_Vyroby ? (
                                                            <span>{itemStatus.Rok_Vyroby}</span>
                                                        ) : (
                                                            <span dangerouslySetInnerHTML={{ __html: '<span class="text-red-500 font-bold">chybí rok</span>' }} />
                                                        )
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className={`${smallTextSize} py-2`}>
                                                    {needsAdditionalData && isArrow ? (
                                                        itemStatus?.Smerovani ? (
                                                            <span>{itemStatus.Smerovani === 'L' ? 'Levá (L)' : 'Pravá (P)'}</span>
                                                        ) : (
                                                            <span dangerouslySetInnerHTML={{ __html: '<span class="text-red-500 font-bold">chybí orientace</span>' }} />
                                                        )
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Středové pravidlo */}
                        <div className={`${smallTextSize} flex justify-between`}>
                            <span className="font-medium">Splnění středového pravidla:</span>
                            {timReport?.Souhlasi_STP !== undefined && timReport?.Souhlasi_STP !== null ? (
                                <span>{timReport.Souhlasi_STP ? 'ANO' : 'NE'}</span>
                            ) : (
                                <span dangerouslySetInnerHTML={{ __html: '<span class="text-red-500 font-bold">neuvedeno</span>' }} />
                            )}
                        </div>

                        {/* Komentáře k TIM */}
                        {timReport?.Koment_STP && (
                            <div className={`${smallTextSize}`}>
                                <span className="font-medium">Komentář k středovému pravidlu:</span> {timReport.Koment_STP}
                            </div>
                        )}

                        {timReport?.Koment_NP && (
                            <div className={`${smallTextSize}`}>
                                <span className="font-medium">Komentář k nosnému prvku:</span> {timReport.Koment_NP}
                            </div>
                        )}

                        {timReport?.Koment_TIM && (
                            <div className={`${smallTextSize}`}>
                                <span className="font-medium">Obecný komentář k TIMu:</span> {timReport.Koment_TIM}
                            </div>
                        )}
                        
                        {/* Přílohy k TIM */}
                        {timReport?.Prilohy_NP && Object.keys(timReport.Prilohy_NP).length > 0 && (
                            <div className={`${smallTextSize}`}>
                                <span className="font-medium">Přílohy k nosnému prvku:</span> {Object.keys(timReport.Prilohy_NP).length} souborů
                            </div>
                        )}
                        
                        {timReport?.Prilohy_TIM && Object.keys(timReport.Prilohy_TIM).length > 0 && (
                            <div className={`${smallTextSize}`}>
                                <span className="font-medium">Fotografie TIMu:</span> {Object.keys(timReport.Prilohy_TIM).length} souborů
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Obnovené úseky */}
            {formData.Obnovene_Useky && Object.keys(formData.Obnovene_Useky).length > 0 && (
                <div className={blockStyle}>
                    <h4 className={`font-medium ${textSize}`}>Obnovené úseky</h4>
                    {Object.entries(formData.Obnovene_Useky).map(([usekId, usek]) => (
                        <div key={usekId} className={`${smallTextSize} flex justify-between`}>
                            <span>Úsek {usekId}:</span>
                            <span>{usek.Usek_Obnoven ? 'Obnoven' : 'Neobnoven'}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Komentář k úseku */}
            <div className={blockStyle}>
                <h4 className={`font-medium ${textSize} flex items-center`}>
                    <IconFileText size={16} className="mr-2" />
                    Komentář ke značkařskému úseku
                </h4>
                <div className={`${smallTextSize}`}>
                    {formData.Koment_Usek?.trim() ? (
                        <div>
                            <p>{formData.Koment_Usek}</p>
                        </div>
                    ) : (
                        <span dangerouslySetInnerHTML={{ __html: '<span class="text-yellow-600 font-bold">Bez komentáře k úseku</span>' }} />
                    )}
                </div>
                
                {/* Přílohy k úseku */}
                {formData.Prilohy_Usek && Object.keys(formData.Prilohy_Usek).length > 0 && (
                    <div className={`${smallTextSize}`}>
                        <span className="font-medium">Fotografické přílohy k úseku:</span> {Object.keys(formData.Prilohy_Usek).length} souborů
                    </div>
                )}
            </div>

            {/* Souhlas s mapou */}
            <div className={compact ? "space-y-2" : "space-y-2"}>
                <h4 className={`font-medium ${textSize}`}>Průběh značené trasy v terénu</h4>
                <div className={`${smallTextSize} flex justify-between`}>
                    <span>Souhlasí trasa s mapou KČT:</span>
                    {formData.Souhlasi_Mapa ? (
                        <span>{formData.Souhlasi_Mapa}</span>
                    ) : (
                        <span dangerouslySetInnerHTML={{ __html: '<span class="text-red-500 font-bold">neuvedeno</span>' }} />
                    )}
                </div>
                <div className={`${smallTextSize} flex justify-between`}>
                    <span>Souhlasí trasa na Mapy.com:</span>
                    {formData.Souhlasi_Mapy_com ? (
                        <span>{formData.Souhlasi_Mapy_com}</span>
                    ) : (
                        <span dangerouslySetInnerHTML={{ __html: '<span class="text-red-500 font-bold">neuvedeno</span>' }} />
                    )}
                </div>

                {formData.Koment_Mapa && (
                    <div className={`${smallTextSize}`}>
                        <span className="font-medium">Komentář k nesouladu:</span> {formData.Koment_Mapa}
                    </div>
                )}
                
                {/* Přílohy k nesouladu */}
                {formData.Prilohy_Mapa && Object.keys(formData.Prilohy_Mapa).length > 0 && (
                    <div className={`${smallTextSize}`}>
                        <span className="font-medium">Přílohy k nesouladu:</span> {Object.keys(formData.Prilohy_Mapa).length} souborů
                    </div>
                )}
            </div>
        </div>
    );
};

