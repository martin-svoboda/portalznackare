import React, { useState, useMemo } from 'react';
import {
    IconChevronDown,
    IconChevronUp,
    IconMapPin,
    IconAlertTriangle
} from '@tabler/icons-react';

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

// Helper function for generating safe identifiers
const getItemIdentifier = (item) => {
    if (!item.ID_PREDMETY) {
        console.warn('Item missing ID_PREDMETY:', item);
        return `fallback_${item.EvCi_TIM}_${item.Predmet_Index}_${Date.now()}`;
    }
    return item.ID_PREDMETY.toString();
};

const getLegacyItemIdentifier = (item) => {
    return `${item.EvCi_TIM}_${item.Predmet_Index}`;
};

export const TimOverviewList = ({
    predmety,
    Stavy_Tim,
    onTimSelect,
    selectedTimId
}) => {
    const [expandedTims, setExpandedTims] = useState(new Set());

    const timGroups = useMemo(() => groupItemsByTIM(predmety || []), [predmety]);

    const toggleTimExpanded = (timId) => {
        const newExpanded = new Set(expandedTims);
        if (newExpanded.has(timId)) {
            newExpanded.delete(timId);
        } else {
            newExpanded.add(timId);
        }
        setExpandedTims(newExpanded);
    };

    // Get completion status for a TIM
    const getTimCompletionStatus = (timGroup) => {
        const timReport = Stavy_Tim[timGroup.EvCi_TIM];
        if (!timReport || !timReport.Predmety) return { completed: 0, total: timGroup.items.length };

        const completedItems = timGroup.items.filter(item => {
            const primaryId = getItemIdentifier(item);
            const legacyId = getLegacyItemIdentifier(item);
            
            return timReport.Predmety.some(status => 
                status.ID_PREDMETY === primaryId &&
                status.Zachovalost
            );
        });

        return {
            completed: completedItems.length,
            total: timGroup.items.length
        };
    };

    if (!timGroups.length) {
        return (
            <div className="alert alert--info">
                <p>Žádné TIM položky nebyly nalezeny pro tento příkaz.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <IconMapPin size={20} />
                <h3 className="text-lg font-semibold">Turistická informační místa ({timGroups.length})</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {timGroups.map((timGroup) => {
                    const { completed, total } = getTimCompletionStatus(timGroup);
                    const isCompleted = completed === total;
                    const isExpanded = expandedTims.has(timGroup.EvCi_TIM);
                    const isSelected = selectedTimId === timGroup.EvCi_TIM;

                    return (
                        <div
                            key={timGroup.EvCi_TIM}
                            className={`card ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                        >
                            <div className="card__header">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            className="btn btn--sm btn--secondary"
                                            onClick={() => toggleTimExpanded(timGroup.EvCi_TIM)}
                                        >
                                            {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                        </button>
                                        
                                        <div>
                                            <h4 className="card__title">
                                                TIM {timGroup.EvCi_TIM}
                                                {timGroup.Naz_TIM && (
                                                    <span className="text-sm font-normal text-gray-600 ml-2">
                                                        - {timGroup.Naz_TIM}
                                                    </span>
                                                )}
                                            </h4>
                                            {(timGroup.GPS_Sirka && timGroup.GPS_Delka) && (
                                                <div className="text-sm text-gray-600">
                                                    GPS: {timGroup.GPS_Sirka}, {timGroup.GPS_Delka}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Completion status */}
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                                                isCompleted 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : completed > 0 
                                                        ? 'bg-yellow-100 text-yellow-800' 
                                                        : 'bg-red-100 text-red-800'
                                            }`}>
                                                {completed === 0 && <IconAlertTriangle size={12} className="mr-1" />}
                                                {completed}/{total}
                                            </span>
                                        </div>

                                        {/* Select button */}
                                        <button
                                            type="button"
                                            className={`btn btn--sm ${isSelected ? 'btn--primary' : 'btn--secondary'}`}
                                            onClick={() => onTimSelect(timGroup.EvCi_TIM)}
                                        >
                                            {isSelected ? 'Upravuji' : 'Upravit'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded items list */}
                            {isExpanded && (
                                <div className="card__content">
                                    <div className="space-y-2">
                                        <h5 className="font-medium text-sm text-gray-700">
                                            Položky ({timGroup.items.length}):
                                        </h5>
                                        {timGroup.items.map((item, index) => {
                                            const primaryId = getItemIdentifier(item);
                                            const legacyId = getLegacyItemIdentifier(item);
                                            const timReport = Stavy_Tim[timGroup.EvCi_TIM];
                                            
                                            const itemStatus = timReport?.Predmety?.find(status => 
                                                status.ID_PREDMETY === primaryId
                                            );

                                            const hasStatus = itemStatus && itemStatus.Zachovalost;

                                            return (
                                                <div
                                                    key={primaryId}
                                                    className={`flex items-center justify-between p-2 rounded border ${
                                                        hasStatus ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                                                    }`}
                                                >
                                                    <div className="text-sm">
                                                        <span className="font-medium">{index + 1}.</span>
                                                        <span className="ml-2">{item.Popis_Predmetu || 'Bez popisu'}</span>
                                                    </div>
                                                    <div className={`text-xs px-2 py-1 rounded ${
                                                        hasStatus 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {hasStatus ? `Stav: ${itemStatus.Zachovalost}` : 'Bez stavu'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};