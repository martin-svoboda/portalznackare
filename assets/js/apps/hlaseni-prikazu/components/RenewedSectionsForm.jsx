import React, { useEffect } from 'react';
import {IconRoute, IconInfoCircle} from '@tabler/icons-react';
import {renderHtmlContent, replaceTextWithIcons} from "../../../utils/htmlUtils";

export const RenewedSectionsForm = ({
                                        useky = [],
                                        Obnovene_Useky = {},
                                        onObnoveneUsekyChange,
                                        disabled = false
                                    }) => {
    
    // Inicializace - doplnit Usek_Delka do existujících záznamů
    useEffect(() => {
        const needsUpdate = Object.keys(Obnovene_Useky).some(usekId => {
            const record = Obnovene_Useky[usekId];
            return typeof record.Usek_Delka === 'undefined';
        });
        
        if (needsUpdate && useky.length > 0) {
            const updated = { ...Obnovene_Useky };
            let hasChanges = false;
            
            Object.keys(updated).forEach(usekId => {
                const usek = useky.find(u => u.EvCi_Tra === usekId);
                if (usek?.Delka_ZU && typeof updated[usekId].Usek_Delka === 'undefined') {
                    updated[usekId].Usek_Delka = parseFloat(usek.Delka_ZU);
                    hasChanges = true;
                }
            });
            
            if (hasChanges) {
                onObnoveneUsekyChange(updated);
            }
        }
    }, [useky, Obnovene_Useky, onObnoveneUsekyChange]);
    
    // Helper pro zpracování změn obnovy úseků
    const handleSectionRenewalChange = (usekId, field, value) => {
        const updated = {...Obnovene_Useky};

        // Najít úsek pro získání délky
        const usek = useky.find(u => u.EvCi_Tra === usekId);

        if (!updated[usekId]) {
            updated[usekId] = {
                Usek_Obnoven: false,
                Usek_Obnoven_Km: 0,
                Usek_Delka: usek?.Delka_ZU ? parseFloat(usek.Delka_ZU) : 0
            };
        }

        // Vždy aktualizovat délku úseku (pro případ změn v datech příkazu)
        if (usek?.Delka_ZU) {
            updated[usekId].Usek_Delka = parseFloat(usek.Delka_ZU);
        }

        updated[usekId][field] = value;

        // Při odškrtnutí vynulovat kilometry
        if (field === 'Usek_Obnoven' && !value) {
            updated[usekId].Usek_Obnoven_Km = 0;
        }

        // Odebrat prázdné záznamy (pokud není obnoven a není zadáno km)
        if (!updated[usekId].Usek_Obnoven && updated[usekId].Usek_Obnoven_Km === 0) {
            delete updated[usekId];
        }

        onObnoveneUsekyChange(updated);
    };


    // Pokud nejsou k dispozici žádné úseky
    if (!useky || useky.length === 0) {
        return (
            <div className="card">
                <div className="card__header">
                    <div className="flex items-center gap-2">
                        <IconRoute size={20}/>
                        <h3 className="card__title">Obnovené úseky trasy</h3>
                    </div>
                </div>
                <div className="card__content">
                    <div className="alert alert--info">
                        Pro tento příkaz nejsou k dispozici žádné úseky trasy.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card__header">
                <div className="flex items-center gap-2">
                    <IconRoute size={20}/>
                    <h3 className="card__title">Obnovené úseky trasy</h3>
                </div>
            </div>
            <div className="card__content">
                <p>Označte úseky, které jste během značkařské činnosti obnovili, a zadejte počet obnovených
                    kilometrů.</p>

                {/* Responzivní grid tabulka */}
                <div className="overflow-x-auto">
                    <div className="min-w-full">
                        {/* Hlavička pro desktop */}
                        <div className="hidden md:grid md:grid-cols-12 gap-4 pb-2 border-b border-gray-300 dark:border-gray-600 mb-4">
                            <div className="col-span-5">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Úsek</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Délka</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Obnoven</span>
                            </div>
                            <div className="col-span-3">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Obnoveno km</span>
                            </div>
                        </div>

                        {/* Úseky */}
                        <div className="space-y-4">
                            {useky.map((usek, index) => {
                                const usekData = Obnovene_Useky[usek.EvCi_Tra] || {
                                    Usek_Obnoven: false,
                                    Usek_Obnoven_Km: 0
                                };

                                return (
                                    <div key={usek.EvCi_Tra || index}
                                         className="border-b border-gray-200 dark:border-gray-700 pb-4">
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                            {/* Informace o úseku */}
                                            <div className="col-span-1 md:col-span-5">
                                                <div className="md:hidden text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                    Úsek
                                                </div>
                                                <div className="flex gap-3">
                                                    {usek.Znacka_HTML && (
                                                        <div className="py-3 px-2">
                                                            {renderHtmlContent(usek.Znacka_HTML)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        {usek.Nazev_ZU && (
                                                            <div className="text-xs ">
                                                                {replaceTextWithIcons(usek.Nazev_ZU, 14)}
                                                            </div>
                                                        )}
                                                        {usek.Barva_Kod && (
                                                            <div className="flex flex-wrap items-center gap-2">
                                                            <span
                                                                className={`badge badge--kct-${usek.Barva_Kod.toLowerCase()}`}>
                                                                {usek.Barva_Naz}
                                                            </span>
                                                                <span className="text-sm">
                                                                {usek.Druh_Odbocky || usek.Druh_Znaceni}
                                                            </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Celková délka */}
                                            <div className="col-span-1 md:col-span-2">
                                                <div className="md:hidden text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                    Délka (km)
                                                </div>
                                                <span className="text-sm font-medium">
                                                    {usek?.Delka_ZU && parseFloat(usek.Delka_ZU).toFixed(1)} km
                                                </span>
                                            </div>

                                            {/* Checkbox obnovy */}
                                            <div className="col-span-1 md:col-span-2">
                                                <div className="md:hidden text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                    Obnoven
                                                </div>
                                                <label className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        className="form__checkbox mr-2"
                                                        checked={usekData.Usek_Obnoven}
                                                        onChange={(e) => handleSectionRenewalChange(
                                                            usek.EvCi_Tra,
                                                            'Usek_Obnoven',
                                                            e.target.checked
                                                        )}
                                                        disabled={disabled}
                                                    />
                                                    <span className="text-sm">
                                                        {usekData.Usek_Obnoven ? 'Ano' : 'Ne'}
                                                    </span>
                                                </label>
                                            </div>

                                            {/* Obnovené kilometry */}
                                            <div className="col-span-1 md:col-span-3">
                                                <div className="md:hidden text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                    Obnoveno km
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        className="form__input"
                                                        placeholder="0.0"
                                                        min="0"
                                                        step="0.1"
                                                        value={usekData.Usek_Obnoven_Km || ''}
                                                        onChange={(e) => {
                                                            const value = e.target.value ? parseFloat(e.target.value) : 0;
                                                            const clampedValue = Math.max(0, value);
                                                            handleSectionRenewalChange(
                                                                usek.EvCi_Tra,
                                                                'Usek_Obnoven_Km',
                                                                clampedValue
                                                            );
                                                        }}
                                                        disabled={disabled || !usekData.Usek_Obnoven}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Nápověda */}
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    <strong>Pokyny:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Označte pouze úseky, kde skutečně proběhla obnova značení</li>
                        <li>Zadejte přesnou délku obnoveného úseku v kilometrech</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};