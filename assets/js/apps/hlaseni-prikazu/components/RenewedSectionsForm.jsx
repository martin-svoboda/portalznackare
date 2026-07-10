import React, { useEffect } from 'react';
import {IconRoute, IconInfoCircle} from '@tabler/icons-react';
import {renderHtmlContent, replaceTextWithIcons} from "../../../utils/htmlUtils";
import {getUsekId, isValidUsek} from "../../../utils/prikaz";
import {STAV_PROVEDENI, jeProvedena} from "../../../utils/stavProvedeni";

export const RenewedSectionsForm = ({
                                        useky = [],
                                        Obnovene_Useky = {},
                                        onObnoveneUsekyChange,
                                        disabled = false
                                    }) => {

    // Ignorovat úseky bez platného ID (chybná data z INSYZ)
    const validUseky = useky.filter(isValidUsek);
    
    // Zajistit, že Obnovene_Useky obsahuje VŠECHNY platné úseky příkazu – do INSYZ XML
    // musí jít všechny. Chybějící doplní jako Neprovedena (Usek_Obnoven=2 dle číselníku
    // StavProvedeniEnum), u existujících doplní chybějící Usek_Delka a Typ_Useku z INSYZ.
    useEffect(() => {
        if (validUseky.length === 0) return;

        const updated = { ...Obnovene_Useky };
        let hasChanges = false;

        validUseky.forEach(usek => {
            const id = getUsekId(usek);
            const delka = usek?.Delka_ZU ? parseFloat(usek.Delka_ZU) : 0;
            const typ = usek?.Typ_Useku ?? '';

            if (!updated[id]) {
                updated[id] = { Usek_Obnoven: STAV_PROVEDENI.NEPROVEDENA, Usek_Delka: delka, Typ_Useku: typ };
                hasChanges = true;
            } else {
                const patch = {};
                if (typeof updated[id].Usek_Delka === 'undefined') patch.Usek_Delka = delka;
                if (!updated[id].Typ_Useku && typ) patch.Typ_Useku = typ;
                if (Object.keys(patch).length) {
                    updated[id] = { ...updated[id], ...patch };
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            onObnoveneUsekyChange(updated);
        }
    }, [useky, Obnovene_Useky, onObnoveneUsekyChange]);
    
    // Helper pro zpracování změn obnovy úseků
    const handleSectionRenewalChange = (usekId, field, value) => {
        const updated = {...Obnovene_Useky};

        // Najít úsek pro získání délky
        const usek = validUseky.find(u => getUsekId(u) === usekId);

        if (!updated[usekId]) {
            updated[usekId] = {
                Usek_Obnoven: STAV_PROVEDENI.NEPROVEDENA,
                Usek_Delka: usek?.Delka_ZU ? parseFloat(usek.Delka_ZU) : 0,
                Typ_Useku: usek?.Typ_Useku ?? ''
            };
        }

        // Vždy aktualizovat délku a typ úseku z aktuálních INSYZ dat
        if (usek?.Delka_ZU) {
            updated[usekId].Usek_Delka = parseFloat(usek.Delka_ZU);
        }
        if (usek?.Typ_Useku) {
            updated[usekId].Typ_Useku = usek.Typ_Useku;
        }

        updated[usekId][field] = value;

        // Neprovedené záznamy se NEMAŽOU – všechny úseky musí zůstat v datech i XML
        // (Usek_Obnoven = 2 Neprovedena).

        onObnoveneUsekyChange(updated);
    };


    // Pokud nejsou k dispozici žádné úseky
    if (!validUseky || validUseky.length === 0) {
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
                <p>Označte úseky, které jste během značkařské činnosti obnovili.</p>

                {/* Responzivní grid tabulka */}
                <div className="overflow-x-auto">
                    <div className="min-w-full">
                        {/* Hlavička pro desktop */}
                        <div className="hidden md:grid md:grid-cols-9 gap-4 pb-2 border-b border-gray-300 dark:border-gray-600 mb-4">
                            <div className="col-span-5">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Úsek</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Délka</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Obnoven</span>
                            </div>
                        </div>

                        {/* Úseky */}
                        <div className="space-y-4">
                            {validUseky.map((usek, index) => {
                                const usekId = getUsekId(usek);
                                const usekData = Obnovene_Useky[usekId] || {
                                    Usek_Obnoven: STAV_PROVEDENI.NEPROVEDENA
                                };
                                const provedena = jeProvedena(usekData.Usek_Obnoven);

                                return (
                                    <div key={usekId || index}
                                         className="border-b border-gray-200 dark:border-gray-700 pb-4">
                                        <div className="grid grid-cols-1 md:grid-cols-9 gap-4 items-center">
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

                                            {/* Toggle obnovy */}
                                            <div className="col-span-1 md:col-span-2">
                                                <div className="md:hidden text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                    Obnoven
                                                </div>
                                                <div className="inline-flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
                                                    <button
                                                        type="button"
                                                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                                                            !provedena
                                                                ? 'bg-red-600 text-white'
                                                                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                        }`}
                                                        onClick={() => handleSectionRenewalChange(
                                                            usekId,
                                                            'Usek_Obnoven',
                                                            STAV_PROVEDENI.NEPROVEDENA
                                                        )}
                                                        disabled={disabled}
                                                    >
                                                        Ne
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                                                            provedena
                                                                ? 'bg-green-600 text-white'
                                                                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                        }`}
                                                        onClick={() => handleSectionRenewalChange(
                                                            usekId,
                                                            'Usek_Obnoven',
                                                            STAV_PROVEDENI.PROVEDENA
                                                        )}
                                                        disabled={disabled}
                                                    >
                                                        Ano
                                                    </button>
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
                    </ul>
                </div>
            </div>
        </div>
    );
};