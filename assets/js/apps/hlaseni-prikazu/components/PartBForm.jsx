import React, { useState, useMemo } from 'react';
import {
    IconInfoCircle,
    IconChevronDown,
    IconChevronUp,
    IconPhoto,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconMapPin
} from '@tabler/icons-react';
import { AdvancedFileUpload } from './AdvancedFileUpload';

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

// Helper function for generating consistent identifiers
const getItemIdentifier = (item) => {
    // Prefer ID_PREDMETY from DB, fallback to combination of EvCi_TIM + Predmet_Index
    return item.ID_PREDMETY?.toString() || `${item.EvCi_TIM}_${item.Predmet_Index}`;
};

const getLegacyItemIdentifier = (item) => {
    return `${item.EvCi_TIM}_${item.Predmet_Index}`;
};

// Export function to validate if all TIM items have status filled
export const validateAllTimItemsCompleted = (predmety, timReports) => {
    if (!predmety || predmety.length === 0) return true;
    
    // Get all items that need status
    const allItems = predmety.filter(item => item.EvCi_TIM && item.Predmet_Index);
    
    // Check if each item has a status
    return allItems.every(item => {
        const primaryId = getItemIdentifier(item);
        const legacyId = getLegacyItemIdentifier(item);
        
        // Look for this item in any TIM report
        return Object.values(timReports).some(timReport => 
            timReport.itemStatuses?.some(status => 
                status.itemId === primaryId || 
                status.itemId === legacyId || 
                status.legacyItemId === legacyId
            )
        );
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

export const PartBForm = ({ formData, setFormData, head, useky, predmety, prikazId }) => {
    // Generate storage path for this report
    const generateStoragePath = () => {
        if (!prikazId) return null;
        
        // Validate and sanitize path components
        const year = formData.executionDate ? formData.executionDate.getFullYear() : new Date().getFullYear();
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
            ...formData.timReports,
            [timId]: {
                ...formData.timReports[timId],
                ...updates
            }
        };
        setFormData(prev => ({ ...prev, timReports: newTimReports }));
    };

    const updateItemStatus = (timId, item, status) => {
        const timReport = formData.timReports[timId] || {
            timId,
            structuralComment: "",
            structuralAttachments: [],
            itemStatuses: [],
            photos: []
        };

        const primaryId = getItemIdentifier(item);
        const legacyId = getLegacyItemIdentifier(item);

        const existingStatusIndex = timReport.itemStatuses.findIndex(s => 
            s.itemId === primaryId || s.itemId === legacyId || s.legacyItemId === legacyId
        );
        const newItemStatuses = [...timReport.itemStatuses];

        if (existingStatusIndex >= 0) {
            newItemStatuses[existingStatusIndex] = {
                ...newItemStatuses[existingStatusIndex],
                ...status,
                itemId: primaryId, // Update to new identifier
                legacyItemId: legacyId,
                evCiTim: item.EvCi_TIM,
                predmetIndex: item.Predmet_Index
            };
        } else {
            newItemStatuses.push({
                itemId: primaryId,
                legacyItemId: legacyId,
                evCiTim: item.EvCi_TIM,
                predmetIndex: item.Predmet_Index,
                status: 1,
                ...status
            });
        }

        updateTimReport(timId, {
            ...timReport,
            itemStatuses: newItemStatuses
        });
    };

    const getItemStatus = (timId, item) => {
        const timReport = formData.timReports[timId];
        if (!timReport) return undefined;

        const primaryId = getItemIdentifier(item);
        const legacyId = getLegacyItemIdentifier(item);

        return timReport.itemStatuses.find(s => 
            s.itemId === primaryId || s.itemId === legacyId || s.legacyItemId === legacyId
        );
    };

    const getTimCompletionStatus = (timId) => {
        const timData = timGroups.find(g => g.EvCi_TIM === timId);
        const timReport = formData.timReports[timId];

        if (!timData || !timReport) return { completed: false, total: 0, filled: 0 };

        const requiredFields = timData.items.length;
        const filledFields = timReport.itemStatuses.filter(status => {
            if (!status.status) return false;
            if (status.status === 3 || status.status === 4) return true; // Nevyhovující/chybí don't require additional data

            // For states 1-2, additional data is needed
            const hasYear = status.yearOfProduction && status.yearOfProduction instanceof Date;
            const hasOrientation = !status.itemId.includes('směrovka') || status.arrowOrientation;

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

    const formatDate = (date) => {
        if (!date) return '';
        return date.toISOString().split('T')[0];
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
        
        return allTimsCompleted && formData.routeComment?.trim();
    };

    // Update partBCompleted status
    React.useEffect(() => {
        const isComplete = isPartBComplete();
        if (formData.partBCompleted !== isComplete) {
            setFormData(prev => ({ ...prev, partBCompleted: isComplete }));
        }
    }, [formData.timReports, formData.routeComment]);

    return (
        <div className="space-y-6">
            {/* TIM states */}
            <div className="card">
                <div className="card__content">
                    <h4 className="text-lg font-semibold mb-4">Stavy TIM</h4>

                    {timGroups.length === 0 ? (
                        <div className="alert alert--info">
                            <IconInfoCircle size={16} className="mr-2" />
                            Pro tento příkaz nejsou k dispozici žádné TIM k hodnocení.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {timGroups.map((timGroup) => {
                                const isExpanded = expandedTims.has(timGroup.EvCi_TIM);
                                const completion = getTimCompletionStatus(timGroup.EvCi_TIM);
                                const timReport = formData.timReports[timGroup.EvCi_TIM];

                                return (
                                    <div key={timGroup.EvCi_TIM} className="card border">
                                        <div className="card__content">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <IconMapPin size={20} />
                                                    <div>
                                                        <div className="font-medium">{timGroup.Naz_TIM}</div>
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
                                                    {/* Structural comment */}
                                                    <div>
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
                                                            value={timReport?.structuralComment || ""}
                                                            onChange={(e) => updateTimReport(timGroup.EvCi_TIM, {
                                                                timId: timGroup.EvCi_TIM,
                                                                structuralComment: e.target.value,
                                                                structuralAttachments: timReport?.structuralAttachments || [],
                                                                itemStatuses: timReport?.itemStatuses || [],
                                                                photos: timReport?.photos || []
                                                            })}
                                                            rows={3}
                                                        />
                                                        <div className="mt-3">
                                                            <label className="form__label mb-2 block">Fotografické přílohy k nosnému prvku</label>
                                                            <AdvancedFileUpload
                                                                id={`structural-${timGroup.EvCi_TIM}`}
                                                                files={timReport?.structuralAttachments || []}
                                                                onFilesChange={(files) => updateTimReport(timGroup.EvCi_TIM, {
                                                                    ...timReport,
                                                                    timId: timGroup.EvCi_TIM,
                                                                    structuralAttachments: files
                                                                })}
                                                                maxFiles={5}
                                                                accept="image/jpeg,image/png,image/heic"
                                                                maxSize={10}
                                                                storagePath={storagePath}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Center rule */}
                                                    <div>
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
                                                                    checked={timReport?.centerRuleCompliant === true}
                                                                    onChange={() => updateTimReport(timGroup.EvCi_TIM, {
                                                                        ...timReport,
                                                                        timId: timGroup.EvCi_TIM,
                                                                        centerRuleCompliant: true
                                                                    })}
                                                                    className="form__radio mr-2"
                                                                />
                                                                ANO
                                                            </label>
                                                            <label htmlFor={`centerRule-no-${timGroup.EvCi_TIM}`} className="flex items-center">
                                                                <input
                                                                    id={`centerRule-no-${timGroup.EvCi_TIM}`}
                                                                    type="radio"
                                                                    name={`centerRule-${timGroup.EvCi_TIM}`}
                                                                    value="false"
                                                                    checked={timReport?.centerRuleCompliant === false}
                                                                    onChange={() => updateTimReport(timGroup.EvCi_TIM, {
                                                                        ...timReport,
                                                                        timId: timGroup.EvCi_TIM,
                                                                        centerRuleCompliant: false
                                                                    })}
                                                                    className="form__radio mr-2"
                                                                />
                                                                NE
                                                            </label>
                                                        </div>

                                                        {timReport?.centerRuleCompliant === false && (
                                                            <>
                                                                <label htmlFor={`centerRule-comment-${timGroup.EvCi_TIM}`} className="form__label sr-only">
                                                                    Komentář k nesplnění středového pravidla
                                                                </label>
                                                                <textarea
                                                                    id={`centerRule-comment-${timGroup.EvCi_TIM}`}
                                                                    name={`centerRule-comment-${timGroup.EvCi_TIM}`}
                                                                    className="form__textarea mt-3"
                                                                    placeholder="Komentář k nesplnění středového pravidla..."
                                                                    value={timReport?.centerRuleComment || ""}
                                                                    onChange={(e) => updateTimReport(timGroup.EvCi_TIM, {
                                                                        ...timReport,
                                                                        centerRuleComment: e.target.value
                                                                    })}
                                                                    rows={2}
                                                                />
                                                            </>
                                                        )}
                                                    </div>

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
                                                                const needsAdditionalData = itemStatus?.status === 1 || itemStatus?.status === 2;

                                                                return (
                                                                    <div key={getItemIdentifier(item)} className="border-b border-gray-200 pb-3">
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
                                                                                        {item.ID_PREDMETY && (
                                                                                            <span className="text-xs text-gray-500">
                                                                                                (ID: {item.ID_PREDMETY})
                                                                                            </span>
                                                                                        )}
                                                                                        <span className="text-sm font-medium">
                                                                                            {item.Radek1}
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
                                                                                            <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
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
                                                                                    value={itemStatus?.status?.toString() || ""}
                                                                                    onChange={(e) => e.target.value && updateItemStatus(
                                                                                        timGroup.EvCi_TIM,
                                                                                        item,
                                                                                        { status: parseInt(e.target.value) }
                                                                                    )}
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
                                                                                            value={itemStatus?.yearOfProduction ? new Date(itemStatus.yearOfProduction).getFullYear() : ""}
                                                                                            onChange={(e) => {
                                                                                                const year = parseInt(e.target.value);
                                                                                                updateItemStatus(
                                                                                                    timGroup.EvCi_TIM,
                                                                                                    item,
                                                                                                    { yearOfProduction: year ? new Date(year, 0, 1) : undefined }
                                                                                                );
                                                                                            }}
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
                                                                                            value={itemStatus?.arrowOrientation || ""}
                                                                                            onChange={(e) => updateItemStatus(
                                                                                                timGroup.EvCi_TIM,
                                                                                                item,
                                                                                                { arrowOrientation: e.target.value }
                                                                                            )}
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

                                                        {completion.completed && (
                                                            <div className="alert alert--success mt-4">
                                                                <IconCheck size={16} className="mr-2" />
                                                                Hlášení o obnově TZT pro tento TIM je kompletní.
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* General TIM comment */}
                                                    <div>
                                                        <label className="form__label mb-1 block font-medium">
                                                            Obecný komentář k TIMu
                                                        </label>
                                                        <textarea
                                                            className="form__textarea"
                                                            placeholder="Dodatečné poznámky k tomuto TIMu..."
                                                            value={timReport?.generalComment || ""}
                                                            onChange={(e) => updateTimReport(timGroup.EvCi_TIM, {
                                                                ...timReport,
                                                                timId: timGroup.EvCi_TIM,
                                                                generalComment: e.target.value
                                                            })}
                                                            rows={2}
                                                        />
                                                    </div>

                                                    {/* TIM photos */}
                                                    <div>
                                                        <label className="form__label mb-2 block font-medium">
                                                            Fotografie TIMu
                                                        </label>
                                                        <AdvancedFileUpload
                                                            id={`photos-${timGroup.EvCi_TIM}`}
                                                            files={timReport?.photos || []}
                                                            onFilesChange={(files) => updateTimReport(timGroup.EvCi_TIM, {
                                                                ...timReport,
                                                                timId: timGroup.EvCi_TIM,
                                                                photos: files
                                                            })}
                                                            maxFiles={10}
                                                            accept="image/jpeg,image/png,image/heic"
                                                            maxSize={15}
                                                            storagePath={storagePath}
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
                        value={formData.routeComment || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, routeComment: e.target.value }))}
                        rows={4}
                    />

                    <div className="mb-4">
                        <label className="form__label mb-2 block font-medium">
                            Fotografické přílohy k úseku
                        </label>
                        <AdvancedFileUpload
                            id="route-attachments"
                            files={formData.routeAttachments || []}
                            onFilesChange={(files) => setFormData(prev => ({ ...prev, routeAttachments: files }))}
                            maxFiles={10}
                            accept="image/jpeg,image/png,image/heic"
                            maxSize={15}
                            storagePath={storagePath}
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
                            <label htmlFor="routeAgreement-yes" className="flex items-center">
                                <input
                                    id="routeAgreement-yes"
                                    type="radio"
                                    name="routeAgreement"
                                    value="ano"
                                    checked={formData.routeAgreement === "ano"}
                                    onChange={(e) => setFormData(prev => ({ ...prev, routeAgreement: e.target.value }))}
                                    className="form__radio mr-2"
                                />
                                ANO
                            </label>
                            <label htmlFor="routeAgreement-no" className="flex items-center">
                                <input
                                    id="routeAgreement-no"
                                    type="radio"
                                    name="routeAgreement"
                                    value="ne"
                                    checked={formData.routeAgreement === "ne"}
                                    onChange={(e) => setFormData(prev => ({ ...prev, routeAgreement: e.target.value }))}
                                    className="form__radio mr-2"
                                />
                                NE
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};