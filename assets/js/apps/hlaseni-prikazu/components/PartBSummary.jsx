import React from 'react';
import { IconInfoCircle } from '@tabler/icons-react';

/**
 * Komponenta pro zobrazení souhrnu části B hlášení
 * Znovupoužitelná v StepContent i admin rozhraní
 * Pracuje pouze s daty z reportu (bez head dat)
 */
export const PartBSummary = ({ 
    formData, 
    title = "Souhrn části B" 
}) => {
    // Detekce typu na základě dat - pokud má Stavy_Tim, je to TIM příkaz
    const isTIMOrder = formData?.Stavy_Tim && Object.keys(formData.Stavy_Tim).length > 0;
    
    return (
        <div className="card">
            <div className="card__header">
                <div className="flex items-center gap-2">
                    <IconInfoCircle size={20} />
                    <h4 className="card__title">
                        {title} - {isTIMOrder ? "Stavy TIM" : "Hlášení o činnosti"}
                    </h4>
                </div>
            </div>
            <div className="card__content">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        {isTIMOrder ? (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Počet TIM:</span>
                                    <span className="text-sm">{Object.keys(formData.Stavy_Tim).length}</span>
                                </div>
                                {formData.Obnovene_Useky && (() => {
                                    const renewedSections = Object.values(formData.Obnovene_Useky || {})
                                        .filter(usek => usek.Usek_Obnoven);
                                    
                                    if (renewedSections.length > 0) {
                                        return (
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">Obnovené úseky:</span>
                                                <span className="text-sm">{renewedSections.length}</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </>
                        ) : (
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Hlášení vyplněno:</span>
                                <span className="text-sm">{formData.Koment_Usek?.trim().length > 0 ? "Ano" : "Ne"}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Stav části B:</span>
                            <span className={`inline-block px-2 py-1 text-xs rounded ${formData.Cast_B_Dokoncena ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'}`}>
                                {formData.Cast_B_Dokoncena ? "Dokončeno" : "Nedokončeno"}
                            </span>
                        </div>
                    </div>
                    <div>
                        {formData.Koment_Usek && (
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                    {isTIMOrder ? "Poznámka k trase:" : "Hlášení o činnosti:"}
                                </p>
                                <p className="text-sm">{formData.Koment_Usek}</p>
                            </div>
                        )}
                        {formData.Prilohy_Usek && formData.Prilohy_Usek.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Počet příloh:</p>
                                <p className="text-sm">{formData.Prilohy_Usek.length}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};