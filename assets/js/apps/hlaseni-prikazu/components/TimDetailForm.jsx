import React from 'react';
import {
    IconPhoto,
    IconX,
    IconMapPin,
    IconAlertTriangle
} from '@tabler/icons-react';
import { AdvancedFileUpload } from './AdvancedFileUpload';
import { renderHtmlContent, replaceTextWithIcons } from '../../../utils/htmlUtils';

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
    if (!item.ID_PREDMETY) {
        console.warn('Item missing ID_PREDMETY:', item);
        return `fallback_${item.EvCi_TIM}_${item.Predmet_Index}_${Date.now()}`;
    }
    return item.ID_PREDMETY.toString();
};

const getLegacyItemIdentifier = (item) => {
    return `${item.EvCi_TIM}_${item.Predmet_Index}`;
};

export const TimDetailForm = ({
    timGroup,
    timReport,
    onTimReportUpdate,
    onItemStatusUpdate,
    storagePath,
    disabled = false
}) => {
    if (!timGroup) {
        return (
            <div className="alert alert--info">
                <p>Vyberte TIM ze seznamu pro úpravu.</p>
            </div>
        );
    }

    const handleStructuralCommentChange = (comment) => {
        onTimReportUpdate(timGroup.EvCi_TIM, { structuralComment: comment });
    };

    const handleStructuralAttachmentsChange = (attachments) => {
        onTimReportUpdate(timGroup.EvCi_TIM, { structuralAttachments: attachments });
    };

    const handleItemStatusChange = (item, field, value) => {
        onItemStatusUpdate(timGroup.EvCi_TIM, item, { [field]: value });
    };

    const getItemStatus = (item) => {
        const primaryId = getItemIdentifier(item);
        const legacyId = getLegacyItemIdentifier(item);
        
        return timReport?.itemStatuses?.find(status => 
            status.itemId === primaryId || 
            status.itemId === legacyId || 
            status.legacyItemId === legacyId
        ) || {};
    };

    return (
        <div className="space-y-6">
            {/* TIM Header */}
            <div className="card">
                <div className="card__header">
                    <div className="flex items-center gap-2">
                        <IconMapPin size={20} />
                        <div>
                            <h3 className="card__title">
                                TIM {timGroup.EvCi_TIM}
                                {timGroup.Naz_TIM && (
                                    <span className="text-base font-normal text-gray-600 ml-2">
                                        - {timGroup.Naz_TIM}
                                    </span>
                                )}
                            </h3>
                            {(timGroup.GPS_Sirka && timGroup.GPS_Delka) && (
                                <div className="text-sm text-gray-600">
                                    GPS: {timGroup.GPS_Sirka}, {timGroup.GPS_Delka}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Structural Section */}
            <div className="card">
                <div className="card__header">
                    <h4 className="card__title">Konstrukční poznámky</h4>
                </div>
                <div className="card__content">
                    <div className="space-y-4">
                        <div>
                            <label className="form__label">
                                Poznámky ke konstrukci TIM
                            </label>
                            <textarea
                                className="form__textarea"
                                value={timReport?.structuralComment || ''}
                                onChange={(e) => handleStructuralCommentChange(e.target.value)}
                                placeholder="Popište stav konstrukce, případné poškození..."
                                rows={3}
                                disabled={disabled}
                            />
                        </div>

                        <div>
                            <label className="form__label">
                                Fotografie konstrukce
                            </label>
                            <AdvancedFileUpload
                                id={`tim-${timGroup.EvCi_TIM}-structural`}
                                files={timReport?.structuralAttachments || []}
                                onFilesChange={handleStructuralAttachmentsChange}
                                maxFiles={10}
                                accept="image/jpeg,image/png,image/heic"
                                disabled={disabled}
                                maxSize={15}
                                storagePath={storagePath ? `${storagePath}/tim-${timGroup.EvCi_TIM}/structural` : null}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Items Section */}
            <div className="card">
                <div className="card__header">
                    <h4 className="card__title">
                        Stav značek a směrovek ({timGroup.items.length})
                    </h4>
                </div>
                <div className="card__content">
                    <div className="space-y-4">
                        {timGroup.items.map((item, index) => {
                            const itemStatus = getItemStatus(item);
                            const primaryId = getItemIdentifier(item);

                            return (
                                <div key={primaryId} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h5 className="font-medium">
                                                {index + 1}. {item.Popis_Predmetu || 'Bez popisu'}
                                            </h5>
                                            {item.Poznamka && (
                                                <div className="text-sm text-gray-600 mt-1">
                                                    {renderHtmlContent(replaceTextWithIcons(item.Poznamka))}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {!itemStatus.status && (
                                            <div className="flex items-center gap-1 text-red-600 text-sm">
                                                <IconAlertTriangle size={16} />
                                                Vyžaduje stav
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Status Selection */}
                                        <div>
                                            <label className="form__label">Stav *</label>
                                            <div className="space-y-2">
                                                {statusOptions.map((option) => (
                                                    <label key={option.value} className="flex items-center gap-2">
                                                        <input
                                                            type="radio"
                                                            name={`status-${primaryId}`}
                                                            value={option.value}
                                                            checked={itemStatus.status === option.value}
                                                            onChange={(e) => handleItemStatusChange(item, 'status', e.target.value)}
                                                            disabled={disabled}
                                                        />
                                                        <span className={`text-${option.color}-600`}>
                                                            {option.label}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Arrow Orientation (for applicable items) */}
                                        {item.Popis_Predmetu?.toLowerCase().includes('směrovka') && (
                                            <div>
                                                <label className="form__label">Orientace šipky</label>
                                                <div className="space-y-2">
                                                    {arrowOrientationOptions.map((option) => (
                                                        <label key={option.value} className="flex items-center gap-2">
                                                            <input
                                                                type="radio"
                                                                name={`orientation-${primaryId}`}
                                                                value={option.value}
                                                                checked={itemStatus.arrowOrientation === option.value}
                                                                onChange={(e) => handleItemStatusChange(item, 'arrowOrientation', e.target.value)}
                                                                disabled={disabled}
                                                            />
                                                            {option.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Item Comment */}
                                    <div className="mt-4">
                                        <label className="form__label">Poznámka k položce</label>
                                        <textarea
                                            className="form__textarea"
                                            value={itemStatus.comment || ''}
                                            onChange={(e) => handleItemStatusChange(item, 'comment', e.target.value)}
                                            placeholder="Případné poznámky k této položce..."
                                            rows={2}
                                            disabled={disabled}
                                        />
                                    </div>

                                    {/* Item Photos */}
                                    <div className="mt-4">
                                        <label className="form__label">
                                            <IconPhoto size={16} className="inline mr-1" />
                                            Fotografie položky
                                        </label>
                                        <AdvancedFileUpload
                                            id={`item-${primaryId}-photos`}
                                            files={itemStatus.photos || []}
                                            onFilesChange={(photos) => handleItemStatusChange(item, 'photos', photos)}
                                            maxFiles={5}
                                            accept="image/jpeg,image/png,image/heic"
                                            disabled={disabled}
                                            maxSize={15}
                                            storagePath={storagePath ? `${storagePath}/tim-${timGroup.EvCi_TIM}/item-${index + 1}` : null}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};