import React, { useMemo, useState } from 'react';
import {
    IconChevronDown,
    IconChevronUp,
    IconMapPin,
    IconCheck
} from '@tabler/icons-react';
import { seskupTimyZpi } from '../../../utils/prikaz';
import { replaceTextWithIcons } from '../../../utils/htmlUtils';
import { ZpiTimDetailForm } from './ZpiTimDetailForm';
import { STAV_PROVEDENI } from '../../../utils/stavProvedeni';
import {
    CINNOST_POPIS,
    cestaProPrilohy,
    stavTimu,
    zapisStavPolozky,
    zapisStavCelehoTimu
} from '../utils/zpiStavy';

/**
 * Část B hlášení pro příkazy ZP-I (INSYZ-280 bod 5).
 *
 * Ukazuje TIMy příkazu – sjednocení TIMů z předmětů a ze servisního datasetu, protože
 * servisní TIM je samostatný TIM bez předmětů. Uvnitř TIMu jdou položky v pořadí
 * servis → odinstalace → instalace.
 */
export const ZpiTimOverview = ({
    formData,
    setFormData,
    head,
    predmety,
    servisTimy,
    prikazId,
    reportId,
    disabled = false
}) => {
    const [rozbalene, setRozbalene] = useState(new Set());

    const timy = useMemo(
        () => seskupTimyZpi(predmety || [], servisTimy || []),
        [predmety, servisTimy]
    );

    const stavyTim = formData.Stavy_Tim || {};
    const storagePath = cestaProPrilohy(prikazId, head, formData);

    const prepnoutRozbaleni = (evCiTim) => {
        setRozbalene(prev => {
            const nove = new Set(prev);
            nove.has(evCiTim) ? nove.delete(evCiTim) : nove.add(evCiTim);
            return nove;
        });
    };

    const onStavPolozky = (tim, item, provedeni) => {
        setFormData(prev => ({
            ...prev,
            Stavy_Tim: zapisStavPolozky(prev.Stavy_Tim || {}, tim, item, provedeni)
        }));
    };

    const onCelyTim = (tim) => {
        setFormData(prev => ({
            ...prev,
            Stavy_Tim: zapisStavCelehoTimu(prev.Stavy_Tim || {}, tim, STAV_PROVEDENI.PROVEDENA)
        }));
    };

    const onZmenaTimu = (tim, zmeny) => {
        setFormData(prev => ({
            ...prev,
            Stavy_Tim: {
                ...prev.Stavy_Tim,
                [tim.EvCi_TIM]: {
                    EvCi_TIM: tim.EvCi_TIM,
                    Predmety: {},
                    Prilohy_TIM: {},
                    ...(prev.Stavy_Tim?.[tim.EvCi_TIM] || {}),
                    ...zmeny
                }
            }
        }));
    };

    if (timy.length === 0) {
        return (
            <div className="alert alert--info">
                <div className="alert__content">
                    <div className="alert__message">
                        K tomuto příkazu nejsou žádné TIMy k instalaci, odinstalaci ani servisu.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <IconMapPin size={20}/>
                <h4 className="text-lg font-semibold">
                    Turistická informační místa ({timy.length})
                </h4>
            </div>

            {timy.map((tim) => {
                const { vyplneno, celkem, hotovo } = stavTimu(stavyTim, tim);
                const jeRozbaleny = rozbalene.has(tim.EvCi_TIM);
                const cinnosti = [...new Set(tim.items.map(i => i.Cinnost))];

                return (
                    <div key={tim.EvCi_TIM} className="card">
                        <div className="card__header">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        className="btn btn--sm btn--secondary"
                                        onClick={() => prepnoutRozbaleni(tim.EvCi_TIM)}
                                        aria-label={jeRozbaleny ? 'Sbalit TIM' : 'Rozbalit TIM'}
                                    >
                                        {jeRozbaleny ? <IconChevronUp size={16}/> : <IconChevronDown size={16}/>}
                                    </button>

                                    <div>
                                        <div className="font-bold">
                                            {tim.EvCi_TIM} {replaceTextWithIcons(tim.Naz_TIM)}
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {cinnosti.map(cinnost => (
                                                <span
                                                    key={cinnost}
                                                    className="badge badge--sm badge--secondary badge--light"
                                                >
                                                    {CINNOST_POPIS[cinnost]}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className={`badge ${hotovo ? 'badge--success' : 'badge--warning'} badge--light`}>
                                        {vyplneno} / {celkem}
                                    </span>
                                    {!disabled && (
                                        <button
                                            type="button"
                                            className="btn btn--sm btn--secondary"
                                            onClick={() => onCelyTim(tim)}
                                            title="Označit všechny položky tohoto TIMu jako provedené"
                                        >
                                            <IconCheck size={16} className="mr-1"/>
                                            Celý TIM proveden
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {jeRozbaleny && (
                            <div className="card__content">
                                <ZpiTimDetailForm
                                    tim={tim}
                                    stavyTim={stavyTim}
                                    onStavPolozky={onStavPolozky}
                                    onZmenaTimu={onZmenaTimu}
                                    storagePath={storagePath}
                                    reportId={reportId}
                                    disabled={disabled}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
