import React, { useState, useMemo } from 'react';
import {
    IconChevronDown,
    IconChevronUp,
    IconPhoto,
    IconX,
    IconAlertTriangle,
    IconMapPin
} from '@tabler/icons-react';
import { AdvancedFileUpload } from './AdvancedFileUpload';
import { RenewedSectionsForm } from './RenewedSectionsForm';
import { renderHtmlContent, replaceTextWithIcons } from '../../../utils/htmlUtils';
import { 
    getAttachmentsAsArray, 
    setAttachmentsFromArray 
} from '../utils/attachmentUtils';
import { calculateExecutionDate } from '../utils/compensationCalculator';
import { toISODateString } from '../../../utils/dateUtils';

const statusOptions = [
    { value: "1", label: "1 - Nová", color: "green" },
    { value: "2", label: "2 - Zachovalá", color: "blue" },
    { value: "3", label: "3 - Nevyhovující", color: "orange" },
    { value: "4", label: "4 - Zcela chybí", color: "red" }
];

const arrowOrientationOptions = [
    { value: "L", label: "Levá (L)" },
    { value: "P", label: "Pravá (P)" }
];

// Helper function for generating safe identifiers
const getItemIdentifier = (item) => {
    // ALWAYS use ID_PREDMETY as primary identifier (unique and safe)
    // If missing, we have a data integrity problem that should be addressed
    if (!item.ID_PREDMETY) {
        console.warn('Item missing ID_PREDMETY:', item);
        return `fallback_${item.EvCi_TIM}_${item.Predmet_Index}_${Date.now()}`;
    }
    return item.ID_PREDMETY.toString();
};

const getLegacyItemIdentifier = (item) => {
    return `${item.EvCi_TIM}_${item.Predmet_Index}`;
};

// HTML utility functions now imported from shared utils

// Export function to validate if all TIM items have status filled
export const validateAllTimItemsCompleted = (predmety, Stavy_Tim) => {
    if (!predmety || predmety.length === 0) return true;
    
    // Get all items that need status
    const allItems = predmety.filter(item => item.EvCi_TIM && item.Predmet_Index);
    
    // Check if each item has a status
    return allItems.every(item => {
        const primaryId = getItemIdentifier(item);
        const legacyId = getLegacyItemIdentifier(item);
        
        // Look for this item in any TIM report
        return Object.values(Stavy_Tim).some(timReport => {
            if (!timReport.Predmety) return false;
            
            // Support both object and array structures during transition
            if (Array.isArray(timReport.Predmety)) {
                // Legacy array structure
                return timReport.Predmety.some(status => 
                    status.ID_PREDMETY === primaryId || 
                    status.ID_PREDMETY === legacyId
                );
            } else if (typeof timReport.Predmety === 'object') {
                // New object structure with ID_PREDMETY as key
                return timReport.Predmety[primaryId] !== undefined || 
                       timReport.Predmety[legacyId] !== undefined;
            }
            
            return false;
        });
    });
};

// Group items by TIM
const groupItemsByTIM = (predmety) => {
    const groups = {};
    predmety.forEach(item => {
        if (!item.EvCi_TIM) return;
        if (!groups[item.EvCi_TIM]) {
            groups[item.EvCi_TIM] = {
                EvCi_TIM: item.EvCi_TIM,
                Naz_TIM: item.Naz_TIM,
                GPS_Sirka: item.GPS_Sirka,
                GPS_Delka: item.GPS_Delka,
                items: []
            };
        }
        groups[item.EvCi_TIM].items.push(item);
    });
    return Object.values(groups);
};

export const PartBForm = ({ formData, setFormData, head, useky, predmety, prikazId, disabled = false }) => {
    // Generate storage path for this report
    const generateStoragePath = () => {
        if (!prikazId) return null;
        
        // Validate and sanitize path components
        const year = calculateExecutionDate(formData).getFullYear();
        const kkz = head?.KKZ?.toString().trim() || 'unknown';
        const obvod = head?.ZO?.toString().trim() || 'unknown';
        const sanitizedPrikazId = prikazId?.toString().trim() || 'unknown';
        
        // Validate year is reasonable
        const validYear = (year >= 2020 && year <= 2030) ? year : new Date().getFullYear();
        
        return `reports/${validYear}/${kkz}/${obvod}/${sanitizedPrikazId}`;
    };
    
    const storagePath = generateStoragePath();
    const [expandedTims, setExpandedTims] = useState(new Set());

    const totalLength = useMemo(() => {
        if (!Array.isArray(useky) || useky.length === 0) return 0;
        return useky.reduce((sum, usek) => sum + Number(usek.Delka_ZU || 0), 0);
    }, [useky]);

    const timGroups = useMemo(() => groupItemsByTIM(predmety || []), [predmety]);

    const updateTimReport = (timId, updates) => {
        const newTimReports = {
            ...formData.Stavy_Tim,
            [timId]: {
                ...formData.Stavy_Tim[timId],
                ...updates
            }
        };
        setFormData(prev => ({ ...prev, Stavy_Tim: newTimReports }));
    };

    const updateItemStatus = (timId, item, status) => {
        const timReport = formData.Stavy_Tim[timId] || {
            EvCi_TIM: timId,
            Koment_NP: "",
            Prilohy_NP: {},
            Predmety: {},
            Prilohy_TIM: {}
        };

        const primaryId = getItemIdentifier(item);
        const legacyId = getLegacyItemIdentifier(item);

        const newPredmety = { ...(timReport.Predmety || {}) };

        newPredmety[primaryId] = {
            ...newPredmety[primaryId],
            ID_PREDMETY: primaryId,
            Zachovalost: newPredmety[primaryId]?.Zachovalost || 1,
            ...status,
            // Complete metadata for full traceability
            metadata: {
                ID_PREDMETY: item.ID_PREDMETY,
                EvCi_TIM: item.EvCi_TIM,
                Predmet_Index: item.Predmet_Index,
                Druh_Predmetu: item.Druh_Predmetu,
                Druh_Predmetu_Naz: item.Druh_Predmetu_Naz,
                Radek1: item.Radek1,
                Barva_Kod: item.Barva_Kod,
                Barva: item.Barva,
                Smerovani: item.Smerovani,
                lastUpdated: new Date().toISOString()
            }
        };

        updateTimReport(timId, {
            ...timReport,
            Predmety: newPredmety
        });
    };

    const getItemStatus = (timId, item) => {
        const timReport = formData.Stavy_Tim[timId];
        if (!timReport || !timReport.Predmety) return undefined;

        const primaryId = getItemIdentifier(item);
        
        // Support both object and array structures during transition
        if (Array.isArray(timReport.Predmety)) {
            // Legacy array structure
            return timReport.Predmety.find(status => 
                status.ID_PREDMETY === primaryId || 
                status.ID_PREDMETY === getLegacyItemIdentifier(item)
            );
        } else {
            // New object structure with ID_PREDMETY as key
            return timReport.Predmety[primaryId];
        }
    };

    const getTimCompletionStatus = (timId) => {
        const timData = timGroups.find(g => g.EvCi_TIM === timId);
        const timReport = formData.Stavy_Tim[timId];

        if (!timData || !timReport) return { completed: false, total: 0, filled: 0 };

        const requiredFields = timData.items.length;
        
        // Support both object and array structures during transition
        let predmetyToCheck = [];
        if (Array.isArray(timReport.Predmety)) {
            // Legacy array structure
            predmetyToCheck = timReport.Predmety || [];
        } else if (timReport.Predmety && typeof timReport.Predmety === 'object') {
            // New object structure with ID_PREDMETY as key
            predmetyToCheck = Object.values(timReport.Predmety);
        }
        
        const filledFields = predmetyToCheck.filter(status => {
            if (!status.Zachovalost) return false;
            if (status.Zachovalost === 3 || status.Zachovalost === 4) return true; // Nevyhovující/chybí don't require additional data

            // For states 1-2, additional data is needed
            const hasYear = status.Rok_Vyroby !== null && status.Rok_Vyroby !== undefined;
            const hasOrientation = !status.ID_PREDMETY.includes('směrovka') || status.Smerovani;

            return hasYear && hasOrientation;
        }).length;

        return {
            completed: filledFields === requiredFields,
            total: requiredFields,
            filled: filledFields
        };
    };

    const toggleTimExpansion = (timId) => {
        const newExpanded = new Set(expandedTims);
        if (newExpanded.has(timId)) {
            newExpanded.delete(timId);
        } else {
            newExpanded.add(timId);
        }
        setExpandedTims(newExpanded);
    };


    const parseDate = (dateString) => {
        if (!dateString) return new Date();
        return new Date(dateString);
    };

    // Check if form is valid for Part B completion
    const isPartBComplete = () => {
        const allTimsCompleted = timGroups.every(timGroup => {
            const completion = getTimCompletionStatus(timGroup.EvCi_TIM);
            return completion.completed;
        });
        
        // Pouze všechny TIMy musí být dokončené, komentář k úseku je volitelný
        return allTimsCompleted;
    };

    // Update Cast_B_Dokoncena status
    React.useEffect(() => {
        const isComplete = isPartBComplete();
        if (formData.Cast_B_Dokoncena !== isComplete) {
            setFormData(prev => ({ ...prev, Cast_B_Dokoncena: isComplete }));
        }
    }, [formData.Stavy_Tim]); // Koment_Usek už není podmínkou, takže ho nemusíme sledovat

    return (
        <div className="space-y-6">
            {/* TIM states */}
            <div className="card">
                <div className="card__content">
                    <h4 className="text-lg font-semibold mb-4">Stavy TIM</h4>

                    {timGroups.length === 0 ? (
                        <div className="alert alert--info">
                            Pro tento příkaz nejsou k dispozici žádné TIM k hodnocení.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {timGroups.map((timGroup) => {
                                const isExpanded = expandedTims.has(timGroup.EvCi_TIM);
                                const completion = getTimCompletionStatus(timGroup.EvCi_TIM);
                                const timReport = formData.Stavy_Tim[timGroup.EvCi_TIM];

                                return (
                                    <div key={timGroup.EvCi_TIM} className="card border">
                                        <div className="card__content">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <IconMapPin size={20} />
                                                    <div>
                                                        <div className="font-medium">{replaceTextWithIcons(timGroup.Naz_TIM)}</div>
                                                        <div className="text-sm text-gray-600">TIM {timGroup.EvCi_TIM}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-24 bg-gray-200 rounded-full h-2">
                                                        <div 
                                                            className={`h-2 rounded-full ${completion.completed ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${(completion.filled / completion.total) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-sm">
                                                        {completion.filled}/{completion.total}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn btn--small btn--secondary"
                                                        onClick={() => toggleTimExpansion(timGroup.EvCi_TIM)}
                                                    >
                                                        {isExpanded ? (
                                                            <>
                                                                Skrýt <IconChevronUp size={14} className="ml-1" />
                                                            </>
                                                        ) : (
                                                            <>
                                                                Rozbalit <IconChevronDown size={14} className="ml-1" />
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="space-y-6">

                                                    {/* Tables and arrows */}
                                                    <div>
                                                        <label className="form__label mb-3 block font-medium">
                                                            Stav tabulek a směrovek
                                                        </label>

                                                        {/* Desktop header */}
                                                        <div className="hidden md:flex gap-4 pb-2 border-b border-gray-300 mb-4">
                                                            <div className="flex-[2]">
                                                                <span className="text-sm font-semibold text-gray-600">Předmět</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="text-sm font-semibold text-gray-600">Stav</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="text-sm font-semibold text-gray-600">Rok výroby</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="text-sm font-semibold text-gray-600">Orientace</span>
                                                            </div>
                                                        </div>

                                                        {/* Items */}
                                                        <div className="space-y-3">
                                                            {timGroup.items.map((item, index) => {
                                                                const itemStatus = getItemStatus(timGroup.EvCi_TIM, item);
                                                                const isArrow = item.Druh_Predmetu_Naz?.toLowerCase().includes('směrovka');
                                                                const needsAdditionalData = itemStatus?.Zachovalost !== 4 && item?.Druh_Predmetu !== 'P' && item?.Druh_Predmetu !== 'I';

                                                                return (
                                                                    <div key={getItemIdentifier(item)} className="border-b border-gray-200 dark:border-gray-600 pb-3">
                                                                        <div className="flex flex-col md:flex-row gap-4 md:items-center">
                                                                            {/* Item */}
                                                                            <div className="flex-[2]">
                                                                                <div className="md:hidden text-xs font-semibold text-gray-600 mb-1">
                                                                                    Předmět
                                                                                </div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-sm font-bold">
                                                                                            {item.EvCi_TIM}{item.Predmet_Index}
                                                                                        </span>
                                                                                        <span className="text-sm font-medium">
                                                                                            {replaceTextWithIcons(item.Radek1)}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex gap-1 mt-1">
                                                                                        {item.Druh_Predmetu_Naz && (
                                                                                            <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                                                                                {item.Druh_Predmetu_Naz}
                                                                                            </span>
                                                                                        )}
                                                                                        {item.Druh_Presunu && (
                                                                                            <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                                                                                                {item.Druh_Presunu}
                                                                                            </span>
                                                                                        )}
                                                                                        {item.Barva && (
                                                                                            <span className={`badge badge--kct-${item.Barva_Kod.toLowerCase()}`}>
                                                                                                {item.Barva}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Status */}
                                                                            <div className="flex-1">
                                                                                <div className="md:hidden text-xs font-semibold text-gray-600 mb-1">
                                                                                    Stav
                                                                                </div>
                                                                                <label htmlFor={`item-status-${getItemIdentifier(item)}`} className="form__label sr-only">
                                                                                    Stav položky
                                                                                </label>
                                                                                <select
                                                                                    id={`item-status-${getItemIdentifier(item)}`}
                                                                                    name={`item-status-${getItemIdentifier(item)}`}
                                                                                    className="form__select"
                                                                                    value={itemStatus?.Zachovalost?.toString() || ""}
                                                                                    onChange={(e) => e.target.value && updateItemStatus(
                                                                                        timGroup.EvCi_TIM,
                                                                                        item,
                                                                                        { Zachovalost: parseInt(e.target.value) }
                                                                                    )}
                                                                                    disabled={disabled}
                                                                                    required={true}
                                                                                >
                                                                                    <option value="">Vyberte stav</option>
                                                                                    {statusOptions.map(opt => (
                                                                                        <option key={opt.value} value={opt.value}>
                                                                                            {opt.label}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>

                                                                            {/* Year of production */}
                                                                            <div className="flex-1">
                                                                                <div className="md:hidden text-xs font-semibold text-gray-600 mb-1">
                                                                                    Rok výroby
                                                                                </div>
                                                                                {needsAdditionalData ? (
                                                                                    <>
                                                                                        <label htmlFor={`item-year-${getItemIdentifier(item)}`} className="form__label sr-only">
                                                                                            Rok výroby
                                                                                        </label>
                                                                                        <input
                                                                                            id={`item-year-${getItemIdentifier(item)}`}
                                                                                            name={`item-year-${getItemIdentifier(item)}`}
                                                                                            type="number"
                                                                                            className="form__input"
                                                                                            placeholder="Rok"
                                                                                            min="1990"
                                                                                            max={new Date().getFullYear()}
                                                                                            value={itemStatus?.Rok_Vyroby || ""}
                                                                                            onChange={(e) => {
                                                                                                const year = e.target.value ? e.target.value : null;
                                                                                                updateItemStatus(
                                                                                                    timGroup.EvCi_TIM,
                                                                                                    item,
                                                                                                    { Rok_Vyroby: year }
                                                                                                );
                                                                                            }}
                                                                                            disabled={disabled}
                                                                                            required={true}
                                                                                        />
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="text-sm text-gray-500">-</span>
                                                                                )}
                                                                            </div>

                                                                            {/* Orientation */}
                                                                            <div className="flex-1">
                                                                                <div className="md:hidden text-xs font-semibold text-gray-600 mb-1">
                                                                                    Orientace směrovky
                                                                                </div>
                                                                                {needsAdditionalData && isArrow ? (
                                                                                    <>
                                                                                        <label htmlFor={`item-orientation-${getItemIdentifier(item)}`} className="form__label sr-only">
                                                                                            Orientace směrovky
                                                                                        </label>
                                                                                        <select
                                                                                            id={`item-orientation-${getItemIdentifier(item)}`}
                                                                                            name={`item-orientation-${getItemIdentifier(item)}`}
                                                                                            className="form__select"
                                                                                            value={itemStatus?.Smerovani || ""}
                                                                                            onChange={(e) => updateItemStatus(
                                                                                                timGroup.EvCi_TIM,
                                                                                                item,
                                                                                                { Smerovani: e.target.value }
                                                                                            )}
                                                                                            disabled={disabled}
                                                                                            required={true}
                                                                                        >
                                                                                            <option value="">L/P</option>
                                                                                            {arrowOrientationOptions.map(opt => (
                                                                                                <option key={opt.value} value={opt.value}>
                                                                                                    {opt.label}
                                                                                                </option>
                                                                                            ))}
                                                                                        </select>
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="text-sm text-gray-500">-</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                    </div>

                                                    {/* Center rule */}
                                                    <div className="border-b border-gray-200 dark:border-gray-600 pb-3">
                                                        <label className="form__label mb-1 block font-medium">
                                                            Umístění TIMu splňuje středové pravidlo
                                                        </label>
                                                        <p className="text-xs text-gray-600 mb-2">
                                                            Všechny směrovky jsou viditelné ze středu křižovatky
                                                        </p>
                                                        <div className="flex gap-4">
                                                            <label htmlFor={`centerRule-yes-${timGroup.EvCi_TIM}`} className="flex items-center">
                                                                <input
                                                                    id={`centerRule-yes-${timGroup.EvCi_TIM}`}
                                                                    type="radio"
                                                                    name={`centerRule-${timGroup.EvCi_TIM}`}
                                                                    value="true"
                                                                    checked={timReport?.Souhlasi_STP === true}
                                                                    onChange={() => updateTimReport(timGroup.EvCi_TIM, {
                                                                        ...(timReport || {}),
                                                                        EvCi_TIM: timGroup.EvCi_TIM,
                                                                        Souhlasi_STP: true
                                                                    })}
                                                                    className="form__radio mr-2"
                                                                    disabled={disabled}
                                                                />
                                                                ANO
                                                            </label>
                                                            <label htmlFor={`centerRule-no-${timGroup.EvCi_TIM}`} className="flex items-center">
                                                                <input
                                                                    id={`centerRule-no-${timGroup.EvCi_TIM}`}
                                                                    type="radio"
                                                                    name={`centerRule-${timGroup.EvCi_TIM}`}
                                                                    value="false"
                                                                    checked={timReport?.Souhlasi_STP === false}
                                                                    onChange={() => updateTimReport(timGroup.EvCi_TIM, {
                                                                        ...(timReport || {}),
                                                                        EvCi_TIM: timGroup.EvCi_TIM,
                                                                        Souhlasi_STP: false
                                                                    })}
                                                                    className="form__radio mr-2"
                                                                    disabled={disabled}
                                                                />
                                                                NE
                                                            </label>
                                                        </div>

                                                        {timReport?.Souhlasi_STP === false && (
                                                            <>
                                                                <label htmlFor={`centerRule-comment-${timGroup.EvCi_TIM}`} className="form__label sr-only">
                                                                    Komentář k nesplnění středového pravidla
                                                                </label>
                                                                <textarea
                                                                    id={`centerRule-comment-${timGroup.EvCi_TIM}`}
                                                                    name={`centerRule-comment-${timGroup.EvCi_TIM}`}
                                                                    className="form__textarea mt-3"
                                                                    placeholder="Komentář k nesplnění středového pravidla..."
                                                                    value={timReport?.Koment_STP || ""}
                                                                    onChange={(e) => updateTimReport(timGroup.EvCi_TIM, {
                                                                        ...(timReport || {}),
                                                                        EvCi_TIM: timGroup.EvCi_TIM,
                                                                        Koment_STP: e.target.value
                                                                    })}
                                                                    rows={2}
                                                                    disabled={disabled}
                                                                />
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Structural comment */}
                                                    <div className="border-b border-gray-200 dark:border-gray-600 pb-3">
                                                        <label htmlFor={`structural-comment-${timGroup.EvCi_TIM}`} className="form__label mb-1 block font-medium">
                                                            Komentář k nosnému prvku
                                                        </label>
                                                        <p className="text-xs text-gray-600 mb-2">
                                                            Stav upevnění směrovek a tabulek, např. zarostlá nebo prasklá
                                                            dřevěná lišta, silně zkorodovaný nebo uvolněný ocelový upevňovací pás,
                                                            deformovaný trubkový držák směrovky, viditelná rez apod.
                                                        </p>
                                                        <textarea
                                                            id={`structural-comment-${timGroup.EvCi_TIM}`}
                                                            name={`structural-comment-${timGroup.EvCi_TIM}`}
                                                            className="form__textarea"
                                                            placeholder="Popište stav nosného prvku..."
                                                            value={timReport?.Koment_NP || ""}
                                                            onChange={(e) => updateTimReport(timGroup.EvCi_TIM, {
                                                                EvCi_TIM: timGroup.EvCi_TIM,
                                                                Koment_NP: e.target.value,
                                                                Prilohy_NP: timReport?.Prilohy_NP || [],
                                                                Predmety: timReport?.Predmety || [],
                                                                Prilohy_TIM: timReport?.Prilohy_TIM || []
                                                            })}
                                                            rows={3}
                                                            disabled={disabled}
                                                        />
                                                        <div className="mt-3">
                                                            <label className="form__label mb-2 block">Fotografické přílohy k nosnému prvku</label>
                                                            <AdvancedFileUpload
                                                                id={`structural-${timGroup.EvCi_TIM}`}
                                                                files={getAttachmentsAsArray(timReport?.Prilohy_NP || {})}
                                                                onFilesChange={(files) => updateTimReport(timGroup.EvCi_TIM, {
                                                                    ...(timReport || {}),
                                                                    EvCi_TIM: timGroup.EvCi_TIM,
                                                                    Prilohy_NP: setAttachmentsFromArray(files)
                                                                })}
                                                                maxFiles={5}
                                                                accept="image/jpeg,image/png,image/heic"
                                                                maxSize={10}
                                                                storagePath={storagePath}
                                                                disabled={disabled}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* General TIM comment */}
                                                    <div>
                                                        <label className="form__label mb-1 block font-medium">
                                                            Obecný komentář k TIMu
                                                        </label>
                                                        <textarea
                                                            className="form__textarea"
                                                            placeholder="Dodatečné poznámky k tomuto TIMu..."
                                                            value={timReport?.Koment_TIM || ""}
                                                            onChange={(e) => updateTimReport(timGroup.EvCi_TIM, {
                                                                ...(timReport || {}),
                                                                EvCi_TIM: timGroup.EvCi_TIM,
                                                                Koment_TIM: e.target.value
                                                            })}
                                                            rows={2}
                                                            disabled={disabled}
                                                        />
                                                    </div>

                                                    {/* TIM photos */}
                                                    <div>
                                                        <label className="form__label mb-2 block font-medium">
                                                            Fotografie TIMu
                                                        </label>
                                                        <AdvancedFileUpload
                                                            id={`photos-${timGroup.EvCi_TIM}`}
                                                            files={getAttachmentsAsArray(timReport?.Prilohy_TIM || {})}
                                                            onFilesChange={(files) => updateTimReport(timGroup.EvCi_TIM, {
                                                                ...(timReport || {}),
                                                                EvCi_TIM: timGroup.EvCi_TIM,
                                                                Prilohy_TIM: setAttachmentsFromArray(files)
                                                            })}
                                                            maxFiles={10}
                                                            accept="image/jpeg,image/png,image/heic"
                                                            maxSize={15}
                                                            storagePath={storagePath}
                                                            disabled={disabled}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Renewed route sections */}
            <RenewedSectionsForm
                useky={useky}
                Obnovene_Useky={formData.Obnovene_Useky || {}}
                onObnoveneUsekyChange={(obnoveneUseky) => setFormData(prev => ({ 
                    ...prev, 
                    Obnovene_Useky: obnoveneUseky 
                }))}
                disabled={disabled}
            />

            {/* Route section comment */}
            <div className="card">
                <div className="card__content">
                    <h4 className="text-lg font-semibold mb-4">Komentář ke značkařskému úseku</h4>

                    <div className="text-sm text-gray-600 mb-4">
                        <strong>Nápověda k vyplnění:</strong><br />
                        • Místa, která by podle nynějšího stavu v terénu mohla být vyznačkována účelněji<br />
                        • Místa, která nemohla být spolehlivě vyznačkována s návrhem na opatření<br />
                        • Místa zhoršené schůdnosti nebo průchodnosti s návrhem na opatření
                    </div>

                    <label htmlFor="route-comment" className="form__label sr-only">
                        Komentář ke značkařskému úseku
                    </label>
                    <textarea
                        id="route-comment"
                        name="route-comment"
                        className="form__textarea mb-4"
                        placeholder="Popište stav značkařského úseku a případné návrhy na zlepšení..."
                        value={formData.Koment_Usek || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, Koment_Usek: e.target.value }))}
                        rows={4}
                        disabled={disabled}
                    />

                    <div className="mb-4">
                        <label className="form__label mb-2 block font-medium">
                            Fotografické přílohy k úseku
                        </label>
                        <AdvancedFileUpload
                            id="route-attachments"
                            files={getAttachmentsAsArray(formData.Prilohy_Usek || {})}
                            onFilesChange={(files) => setFormData(prev => ({ ...prev, Prilohy_Usek: setAttachmentsFromArray(files) }))}
                            maxFiles={10}
                            accept="image/jpeg,image/png,image/heic"
                            maxSize={15}
                            storagePath={storagePath}
                            disabled={disabled}
                        />
                    </div>

                    <div>
                        <label className="form__label mb-1 block font-medium">
                            Průběh značené trasy v terénu
                        </label>
                        <p className="text-sm text-gray-600 mb-2">
                            Souhlasí průběh trasy s jejím zákresem v posledním vydání turistické mapy KČT a s průběhem trasy
                            na mapy.cz?
                        </p>
                        <div className="flex gap-4">
                            <label htmlFor="Souhlasi_Mapa-yes" className="flex items-center">
                                <input
                                    id="Souhlasi_Mapa-yes"
                                    type="radio"
                                    name="Souhlasi_Mapa"
                                    value="ano"
                                    checked={formData.Souhlasi_Mapa === "ano"}
                                    onChange={(e) => setFormData(prev => ({ ...prev, Souhlasi_Mapa: e.target.value }))}
                                    className="form__radio mr-2"
                                    disabled={disabled}
                                />
                                ANO
                            </label>
                            <label htmlFor="Souhlasi_Mapa-no" className="flex items-center">
                                <input
                                    id="Souhlasi_Mapa-no"
                                    type="radio"
                                    name="Souhlasi_Mapa"
                                    value="ne"
                                    checked={formData.Souhlasi_Mapa === "ne"}
                                    onChange={(e) => setFormData(prev => ({ ...prev, Souhlasi_Mapa: e.target.value }))}
                                    className="form__radio mr-2"
                                    disabled={disabled}
                                />
                                NE
                            </label>
                        </div>
                        
                        {formData.Souhlasi_Mapa === "ne" && (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label htmlFor="Souhlasi_Mapa-comment" className="form__label mb-1 block">
                                        Komentář k nesouladu
                                    </label>
                                    <textarea
                                        id="Souhlasi_Mapa-comment"
                                        name="Souhlasi_Mapa-comment"
                                        className="form__textarea"
                                        placeholder="Popište nesoulad trasy s mapou..."
                                        value={formData.Koment_Mapa || ""}
                                        onChange={(e) => setFormData(prev => ({ ...prev, Koment_Mapa: e.target.value }))}
                                        rows={3}
                                        disabled={disabled}
                                    />
                                </div>
                                
                                <div>
                                    <label className="form__label mb-2 block">
                                        Přílohy k nesouladu
                                    </label>
                                    <AdvancedFileUpload
                                        id="Souhlasi_Mapa-attachments"
                                        files={getAttachmentsAsArray(formData.Prilohy_Mapa || {})}
                                        onFilesChange={(files) => setFormData(prev => ({ ...prev, Prilohy_Mapa: setAttachmentsFromArray(files) }))}
                                        maxFiles={5}
                                        accept="image/jpeg,image/png,image/heic"
                                        maxSize={15}
                                        storagePath={storagePath ? `${storagePath}/mapa-nesoulad` : null}
                                        disabled={disabled}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};