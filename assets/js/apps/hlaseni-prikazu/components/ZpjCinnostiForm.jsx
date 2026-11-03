import React from 'react';
import { IconClipboardList } from '@tabler/icons-react';
import { jeProvedena } from '../../../utils/stavProvedeni';
import { ProvedeniToggle } from './ProvedeniToggle';
import { zapisStavCinnosti, kmCinnosti } from '../utils/zpjCinnosti';

/**
 * Činnosti příkazu ZP-J v části B (INSYZ-219) – stejné rozložení a přepínač Ne/Ano jako
 * obnova úseků u ZP-O. Km z INSYZ jsou jen informativní, na portálu se nemění.
 * Zadání a poznámka k ZP jsou v hlavičce příkazu, tady se neopakují.
 */
export const ZpjCinnostiForm = React.memo(({ formData, setFormData, cinnosti, disabled = false }) => {
    const stavy = formData.Cinnosti || {};

    const onStav = (id, provedeni) => {
        setFormData(prev => ({
            ...prev,
            Cinnosti: zapisStavCinnosti(prev.Cinnosti, id, provedeni)
        }));
    };

    return (
        <div className="card">
            <div className="card__header">
                <div className="flex items-center gap-2">
                    <IconClipboardList size={20}/>
                    <h3 className="card__title">Činnosti příkazu</h3>
                </div>
            </div>
            <div className="card__content">
                <p>Označte činnosti, které jste provedli.</p>

                {(cinnosti || []).length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                        K tomuto příkazu nepřišly z INSYZ žádné činnosti.
                    </p>
                ) : (
                    <div className="mt-4">
                        <div className="hidden md:grid md:grid-cols-9 gap-4 pb-2 border-b border-gray-300 dark:border-gray-600 mb-4">
                            <div className="col-span-5">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Činnost</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Výkon</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Provedena</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {cinnosti.map((cinnost) => {
                                const id = String(cinnost.ID_ZP_JCCin);
                                const km = kmCinnosti(cinnost);

                                return (
                                    <div key={id} className="border-b border-gray-200 dark:border-gray-700 pb-4">
                                        <div className="grid grid-cols-1 md:grid-cols-9 gap-4 items-center">
                                            <div className="col-span-1 md:col-span-5 text-sm">
                                                {cinnost.Popis_Cinnosti}
                                            </div>

                                            <div className="col-span-1 md:col-span-2">
                                                <div className="md:hidden text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                    Výkon
                                                </div>
                                                <span className="text-sm font-medium">
                                                    {km !== null ? `${km.toFixed(1)} km` : '–'}
                                                </span>
                                            </div>

                                            <div className="col-span-1 md:col-span-2">
                                                <div className="md:hidden text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                    Provedena
                                                </div>
                                                <ProvedeniToggle
                                                    provedena={jeProvedena(stavy[id]?.Provedeni)}
                                                    onChange={(stav) => onStav(id, stav)}
                                                    disabled={disabled}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
