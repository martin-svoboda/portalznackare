import React from 'react';
import { IconPlus, IconTrash, IconBed } from '@tabler/icons-react';
import { AdvancedFileUpload } from '../../../components/shared/forms/AdvancedFileUpload';
import { 
    getAttachmentsAsArray, 
    setAttachmentsFromArray 
} from '../utils/attachmentUtils';

const createEmptyAccommodation = () => ({
    id: crypto.randomUUID(),
    Datum: new Date(),
    Zarizeni: "",
    Misto: "",
    Castka: 0,
    Prilohy: {}
});

export const AccommodationForm = ({
    accommodations,
    onAccommodationsChange,
    storagePath,
    reportId,
    disabled = false
}) => {
    const handleAddAccommodation = () => {
        const newAccommodation = createEmptyAccommodation();
        onAccommodationsChange([...accommodations, newAccommodation]);
    };

    const handleUpdateAccommodation = (accommodationId, updates) => {
        const updatedAccommodations = accommodations.map(acc =>
            acc.id === accommodationId ? { ...acc, ...updates } : acc
        );
        onAccommodationsChange(updatedAccommodations);
    };

    const handleRemoveAccommodation = (accommodationId) => {
        const updatedAccommodations = accommodations.filter(acc => acc.id !== accommodationId);
        onAccommodationsChange(updatedAccommodations);
    };

    const handleNumberChange = (accommodationId, field, value) => {
        const numValue = parseFloat(value) || 0;
        if (numValue < 0) return;
        handleUpdateAccommodation(accommodationId, { [field]: numValue });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <IconBed size={20} />
                    <h3 className="text-lg font-semibold">Ubytování</h3>
                </div>
                <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleAddAccommodation}
                    disabled={disabled}
                >
                    <IconPlus size={16} />
                    Přidat ubytování
                </button>
            </div>

            <div className="space-y-4">
                {accommodations.map((accommodation, index) => (
                    <div key={accommodation.id} className="card">
                        <div className="card__header">
                            <div className="flex items-center justify-between">
                                <h4 className="card__title">Ubytování {index + 1}</h4>
                                <button
                                    type="button"
                                    className="btn btn--sm btn--danger"
                                    onClick={() => handleRemoveAccommodation(accommodation.id)}
                                    disabled={disabled}
                                    title="Odstranit ubytování"
                                >
                                    <IconTrash size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="card__content">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="form__label">Datum *</label>
                                        <input
                                            type="date"
                                            className="form__input"
                                            value={accommodation.Datum ? accommodation.Datum.toISOString().split('T')[0] : ''}
                                            onChange={(e) => handleUpdateAccommodation(accommodation.id, { Datum: new Date(e.target.value) })}
                                            disabled={disabled}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="form__label">Zařízení *</label>
                                        <input
                                            type="text"
                                            className="form__input"
                                            value={accommodation.Zarizeni || ''}
                                            onChange={(e) => handleUpdateAccommodation(accommodation.id, { Zarizeni: e.target.value })}
                                            placeholder="např. Hotel Moravka"
                                            disabled={disabled}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="form__label">Místo *</label>
                                        <input
                                            type="text"
                                            className="form__input"
                                            value={accommodation.Misto || ''}
                                            onChange={(e) => handleUpdateAccommodation(accommodation.id, { Misto: e.target.value })}
                                            placeholder="např. Brno"
                                            disabled={disabled}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="form__label">Částka (Kč) *</label>
                                        <input
                                            type="number"
                                            className="form__input"
                                            value={accommodation.Castka || ''}
                                            onChange={(e) => handleNumberChange(accommodation.id, 'Castka', e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            step="0.01"
                                            disabled={disabled}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="form__label">Doklady</label>
                                    <AdvancedFileUpload
                                        id={`accommodation-${accommodation.id}-attachments`}
                                        files={getAttachmentsAsArray(accommodation.Prilohy || {})}
                                        onFilesChange={(files) => handleUpdateAccommodation(accommodation.id, { Prilohy: setAttachmentsFromArray(files) })}
                                        maxFiles={5}
                                        accept="image/jpeg,image/png,image/heic,application/pdf"
                                        disabled={disabled}
                                        maxSize={15}
                                        storagePath={storagePath}
                                        usageType="reports"
                                        entityId={reportId}
                                        fieldName="Noclezne2/Prilohy"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {accommodations.length === 0 && (
                <div className="alert alert--info">
                    <p>Žádné ubytování nebylo přidáno.</p>
                </div>
            )}
        </div>
    );
};