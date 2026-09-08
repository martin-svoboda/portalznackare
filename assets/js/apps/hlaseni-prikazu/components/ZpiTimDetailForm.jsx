import React from 'react';
import { IconTool, IconTrash, IconPlus } from '@tabler/icons-react';
import { AdvancedFileUpload } from '../../../components/shared/forms/AdvancedFileUpload';
import { renderHtmlContent, replaceTextWithIcons } from '../../../utils/htmlUtils';
import { getAttachmentsAsArray, setAttachmentsFromArray } from '../utils/attachmentUtils';
import {
    ZPI_STAVY,
    CINNOST_POPIS,
    identifikatorPolozky,
    stavPolozky
} from '../utils/zpiStavy';

const CINNOST_IKONA = {
    servis: IconTool,
    odinstalace: IconTrash,
    instalace: IconPlus
};

const CINNOST_BADGE = {
    servis: 'badge badge--warning badge--light',
    odinstalace: 'badge badge--danger badge--light',
    instalace: 'badge badge--success badge--light'
};

/**
 * Náhled předmětu – stejné zobrazení jako v hlášení ZP-O (INSYZ-280 bod 5.3).
 * U odinstalace je přeškrtnutý (bod 5.4); o tom rozhoduje činnost z `Co_Provest`,
 * nikdy `Stav_TIM`.
 */
const NahledPredmetu = ({ item }) => {
    const preskrtnout = item.Cinnost === 'odinstalace';

    return (
        <div className={preskrtnout ? 'predmet--odinstalace opacity-75' : ''}>
            {item.Tim_HTML ? renderHtmlContent(item.Tim_HTML) : (
                <>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">
                            {item.EvCi_TIM}{item.Predmet_Index}
                        </span>
                        <span className="text-sm font-medium">
                            {replaceTextWithIcons(item.Radek1)}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {item.Druh_Predmetu_Naz && (
                            <span className="badge badge--sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {item.Druh_Predmetu_Naz}
                            </span>
                        )}
                        {item.Barva && item.Barva_Kod && (
                            <span className={`badge badge--kct-${item.Barva_Kod.toLowerCase()}`}>
                                {item.Barva}
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

/**
 * Servisní zásah – krátký text (TIM_Text) a rozšířený popis (Popis, až 1000 znaků),
 * INSYZ-280 bod 5.1.
 */
const NahledServisu = ({ item }) => (
    <div>
        {item.TIM_Text?.trim() && (
            <div className="font-medium">{item.TIM_Text}</div>
        )}
        {item.Popis?.trim() && (
            <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line mt-1">
                {item.Popis}
            </div>
        )}
        {!item.TIM_Text?.trim() && !item.Popis?.trim() && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
                Servisní zásah bez bližšího popisu
            </span>
        )}
    </div>
);

/**
 * Detail jednoho TIMu v části B hlášení ZP-I: položky s činnostmi a stavem provedení,
 * komentář a fotografie k TIMu (INSYZ-280 body 5 a 6).
 */
export const ZpiTimDetailForm = ({
    tim,
    stavyTim,
    onStavPolozky,
    onZmenaTimu,
    storagePath,
    reportId,
    disabled = false
}) => {
    const zaznamTimu = stavyTim?.[tim.EvCi_TIM] || {};

    return (
        <div className="space-y-4">
            {tim.items.map((item) => {
                const id = identifikatorPolozky(item);
                const stav = stavPolozky(stavyTim, tim.EvCi_TIM, item);
                const Ikona = CINNOST_IKONA[item.Cinnost];

                return (
                    <div
                        key={id}
                        className="border-b border-gray-200 dark:border-gray-600 pb-3 last:border-b-0"
                    >
                        <div className="flex flex-col md:flex-row gap-4 md:items-start">
                            <div className="flex-[2]">
                                <div className={`${CINNOST_BADGE[item.Cinnost]} mb-2`}>
                                    {Ikona && <Ikona size={14} className="mr-1"/>}
                                    {CINNOST_POPIS[item.Cinnost]}
                                </div>

                                {item.Cinnost === 'servis'
                                    ? <NahledServisu item={item}/>
                                    : <NahledPredmetu item={item}/>}
                            </div>

                            <div className="flex-1">
                                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                    Stav provedení
                                </div>
                                <div className="flex flex-col gap-1">
                                    {ZPI_STAVY.map((volba) => (
                                        <label
                                            key={volba.value}
                                            className="flex items-center gap-2 text-sm cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name={`provedeni-${tim.EvCi_TIM}-${id}`}
                                                value={volba.value}
                                                checked={stav?.Provedeni === volba.value}
                                                onChange={() => onStavPolozky(tim, item, volba.value)}
                                                disabled={disabled}
                                            />
                                            {volba.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            <div>
                <label className="form__label font-medium mb-2 block">
                    Komentář k TIMu
                </label>
                <textarea
                    className="form__textarea"
                    placeholder="Poznámka k provedení na tomto TIMu..."
                    value={zaznamTimu.Koment_TIM || ''}
                    onChange={(e) => onZmenaTimu(tim, { Koment_TIM: e.target.value })}
                    rows={3}
                    disabled={disabled}
                />
            </div>

            <div>
                <label className="form__label font-medium mb-2 block">
                    Fotografie k TIMu
                </label>
                <AdvancedFileUpload
                    id={`zpi-tim-${tim.EvCi_TIM}`}
                    files={getAttachmentsAsArray(zaznamTimu.Prilohy_TIM || {})}
                    onFilesChange={(files) => onZmenaTimu(tim, {
                        Prilohy_TIM: setAttachmentsFromArray(files)
                    })}
                    maxFiles={20}
                    accept="image/jpeg,image/png,image/heic,application/pdf"
                    disabled={disabled}
                    maxSize={15}
                    storagePath={storagePath}
                    usageType="reports"
                    entityId={reportId}
                    fieldName={`Stavy_Tim/${tim.EvCi_TIM}/Prilohy_TIM`}
                />
            </div>
        </div>
    );
};
