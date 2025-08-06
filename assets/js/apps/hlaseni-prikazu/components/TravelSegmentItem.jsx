import React from 'react';
import {
    IconTrash,
    IconCopy,
    IconCar,
    IconBus,
    IconWalk,
    IconBike,
    IconArrowUp,
    IconArrowDown,
    IconMapPin
} from '@tabler/icons-react';
import { AdvancedFileUpload } from './AdvancedFileUpload';
import { 
    getAttachmentsAsArray, 
    setAttachmentsFromArray 
} from '../utils/attachmentUtils';

const transportTypeOptions = [
    { value: "AUV", label: "AUV (Auto vlastní)", icon: IconCar },
    { value: "AUV-Z", label: "AUV-Z (Auto zaměstnavatele)", icon: IconCar },
    { value: "V", label: "Veřejná doprava", icon: IconBus },
    { value: "P", label: "Pěšky", icon: IconWalk },
    { value: "K", label: "Kolo", icon: IconBike },
];

export const TravelSegmentItem = ({
    segment,
    index,
    totalSegments,
    onUpdate,
    onRemove,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    canRemove,
    storagePath,
    disabled = false
}) => {
    const handleUpdate = (field, value) => {
        onUpdate(segment.id, { [field]: value });
    };

    const handleTimeChange = (field, value) => {
        // Basic time validation
        if (value && !/^\d{2}:\d{2}$/.test(value)) return;
        handleUpdate(field, value);
    };

    const handleNumberChange = (field, value) => {
        const numValue = parseFloat(value) || 0;
        if (numValue < 0) return;
        handleUpdate(field, numValue);
    };

    const selectedTransportType = transportTypeOptions.find(opt => opt.value === segment.Druh_Dopravy);
    const IconComponent = selectedTransportType?.icon || IconCar;

    return (
        <div>
            {index > 0 && <hr className="my-4" />}
            <div className="ml-4 pl-6 border-l-2 border-blue-400 relative">
                <div className="absolute top-0 right-0 flex gap-1 z-10">
                        {/* Move buttons */}
                        {/* Move up - only if not first */}
                        {index > 0 && (
                            <button
                                type="button"
                                className="btn btn--icon btn--gray--light"
                                onClick={() => onMoveUp(index)}
                                disabled={disabled}
                                title="Přesunout nahoru"
                            >
                                <IconArrowUp size={14} />
                            </button>
                        )}

                        {/* Move down - only if not last */}
                        {index < totalSegments - 1 && (
                            <button
                                type="button"
                                className="btn btn--icon btn--gray--light"
                                onClick={() => onMoveDown(index)}
                                disabled={disabled}
                                title="Přesunout dolů"
                            >
                                <IconArrowDown size={14} />
                            </button>
                        )}

                        {/* Duplicate segment */}
                        <button
                            type="button"
                            className="btn btn--icon btn--primary--light"
                            onClick={() => onDuplicate(segment)}
                            disabled={disabled}
                            title="Duplikovat cestu"
                        >
                            <IconCopy size={14} />
                        </button>
                        
                        {/* Remove segment - only if more than 1 */}
                        {canRemove && (
                            <button
                                type="button"
                                className="btn btn--icon btn--danger--light"
                                onClick={() => onRemove(segment.id)}
                                disabled={disabled}
                                title="Smazat cestu"
                            >
                                <IconTrash size={16} />
                            </button>
                        )}
                    </div>

                    {/* Segment header */}
                    <div className="mb-4">
                        <div className="flex items-start gap-3 mb-4 flex-wrap">
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center absolute -left-5 -top-1">
                                <IconComponent size={18} />
                            </div>
                            <div className="w-24 pl-2">
                                <span className="font-medium">Cesta {index + 1}</span>
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label htmlFor={`segment-date-${segment.id}`} className="form__label sr-only">Datum segmentu</label>
                                    <input
                                        id={`segment-date-${segment.id}`}
                                        name={`segment-date-${segment.id}`}
                                        type="date"
                                        className="form__input"
                                        value={segment.Datum ? segment.Datum.toISOString().split('T')[0] : ''}
                                        onChange={(e) => handleUpdate('Datum', new Date(e.target.value)))
                                        disabled={disabled}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Start location */}
                        <div className="flex items-start gap-3 mb-4 flex-wrap">
                            <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center absolute -left-3 text-xs">
                                <IconMapPin size={16} />
                            </div>
                            <div className="w-24">
                                <span>Odjezd z</span>
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label htmlFor={`start-place-${segment.id}`} className="form__label sr-only">Místo odjezdu</label>
                                    <input
                                        id={`start-place-${segment.id}`}
                                        name={`start-place-${segment.id}`}
                                        type="text"
                                        className="form__input"
                                        placeholder="Místo"
                                        value={segment.Misto_Odjezdu || ""}
                                        onChange={(e) => handleUpdate('Misto_Odjezdu', e.target.value))
                                        disabled={disabled}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>V</span>
                                    <label htmlFor={`start-time-${segment.id}`} className="form__label sr-only">Čas odjezdu</label>
                                    <input
                                        id={`start-time-${segment.id}`}
                                        name={`start-time-${segment.id}`}
                                        type="time"
                                        className="form__input flex-1"
                                        value={segment.Cas_Odjezdu || ""}
                                        onChange={(e) => handleTimeChange('Cas_Odjezdu', e.target.value))
                                        disabled={disabled}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* End location */}
                    <div className="flex items-start gap-3 mb-4 flex-wrap">
                        <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center absolute -left-3 text-xs">
                            <IconMapPin size={16} />
                        </div>
                        <div className="w-24">
                            <span>Příjezd do</span>
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label htmlFor={`end-place-${segment.id}`} className="form__label sr-only">Místo příjezdu</label>
                                <input
                                    id={`end-place-${segment.id}`}
                                    name={`end-place-${segment.id}`}
                                    type="text"
                                    className="form__input"
                                    placeholder="Místo"
                                    value={segment.Misto_Prijezdu || ""}
                                onChange={(e) => handleUpdate('Misto_Prijezdu', e.target.value)}
                                disabled={disabled}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span>V</span>
                            <label htmlFor={`end-time-${segment.id}`} className="form__label sr-only">Čas příjezdu</label>
                            <input
                                id={`end-time-${segment.id}`}
                                name={`end-time-${segment.id}`}
                                type="time"
                                className="form__input flex-1"
                                value={segment.Cas_Prijezdu || "")
                                onChange={(e) => handleTimeChange('Cas_Prijezdu', e.target.value)}
                                disabled={disabled}
                            />
                        </div>
                    </div>
                </div>

                {/* Transport type */}
                <div className="mt-4">
                    <label className="form__label">Typ dopravy</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {transportTypeOptions.map((option) => {
                            const OptionIcon = option.icon;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`btn ${segment.Druh_Dopravy === option.value ? 'btn--primary' : 'btn--secondary'}`}
                                    onClick={() => handleUpdate('Druh_Dopravy', option.value))
                                    disabled={disabled}
                                >
                                    <OptionIcon size={16} />
                                    <span className="ml-1 hidden sm:inline">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Transport-specific fields */}
                {(segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") && (
                    <div className="mt-4">
                        <label className="form__label">Počet kilometrů</label>
                        <input
                            type="number"
                            className="form__input"
                            value={segment.Kilometry || ''}
                            onChange={(e) => handleNumberChange('Kilometry', e.target.value))
                            placeholder="0"
                            min="0"
                            step="0.1"
                            disabled={disabled}
                        />
                    </div>
                )}

                {segment.Druh_Dopravy === "V" && (
                    <div className="mt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                                <label className="form__label">Cena jízdenek (Kč)</label>
                                <input
                                    type="number"
                                    className="form__input"
                                    value={segment.Naklady || ''}
                                    onChange={(e) => handleNumberChange('Naklady', e.target.value))
                                    placeholder="0"
                                    min="0"
                                    step="0.01"
                                    disabled={disabled}
                                />
                            </div>
                            <div>
                                <label className="form__label">Přílohy jízdenek</label>
                                <AdvancedFileUpload
                                    id={`segment-${segment.id}-attachments`}
                                    files={getAttachmentsAsArray(segment.Prilohy || {})}
                                    onFilesChange={(files) => handleUpdate('Prilohy', setAttachmentsFromArray(files))}
                                    maxFiles={10}
                                    accept="image/jpeg,image/png,image/heic,application/pdf"
                                    disabled={disabled}
                                    maxSize={15}
                                    storagePath={storagePath ? `${storagePath}/segment-${index + 1}` : null}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};