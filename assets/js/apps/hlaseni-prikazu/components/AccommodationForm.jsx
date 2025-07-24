import React from 'react';
import { IconPlus, IconTrash, IconBed } from '@tabler/icons-react';
import { AdvancedFileUpload } from './AdvancedFileUpload';

const createEmptyAccommodation = () => ({
    id: crypto.randomUUID(),
    date: new Date(),
    facility: "",
    place: "",
    amount: 0,
    attachments: []
});

export const AccommodationForm = ({
    accommodations,
    onAccommodationsChange,
    storagePath,
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
                                            value={accommodation.date ? accommodation.date.toISOString().split('T')[0] : ''}
                                            onChange={(e) => handleUpdateAccommodation(accommodation.id, { date: new Date(e.target.value) })}
                                            disabled={disabled}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="form__label">Zařízení *</label>
                                        <input
                                            type="text"
                                            className="form__input"
                                            value={accommodation.facility || ''}
                                            onChange={(e) => handleUpdateAccommodation(accommodation.id, { facility: e.target.value })}
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
                                            value={accommodation.place || ''}
                                            onChange={(e) => handleUpdateAccommodation(accommodation.id, { place: e.target.value })}
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
                                            value={accommodation.amount || ''}
                                            onChange={(e) => handleNumberChange(accommodation.id, 'amount', e.target.value)}
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
                                        files={accommodation.attachments || []}
                                        onFilesChange={(files) => handleUpdateAccommodation(accommodation.id, { attachments: files })}
                                        maxFiles={5}
                                        accept="image/jpeg,image/png,image/heic,application/pdf"
                                        disabled={disabled}
                                        maxSize={15}
                                        storagePath={storagePath ? `${storagePath}/accommodation-${index + 1}` : null}
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