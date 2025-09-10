import React from 'react';
import { IconPlus, IconMapPin } from '@tabler/icons-react';
import { TravelSegmentItem } from './TravelSegmentItem';
import { 
    getAttachmentsAsArray, 
    setAttachmentsFromArray 
} from '../utils/attachmentUtils';

const createEmptyTravelSegment = () => ({
    id: crypto.randomUUID(),
    Datum: new Date(),
    Cas_Odjezdu: "",
    Cas_Prijezdu: "",
    Misto_Odjezdu: "",
    Misto_Prijezdu: "",
    Druh_Dopravy: "AUV",
    Kilometry: 0,
    Naklady: 0,
    Prilohy: {}
});

export const TravelSegmentsForm = ({
    segments,
    onSegmentsChange,
    storagePath,
    prikazId,
    reportId,
    disabled = false,
    isDraft = false
}) => {
    const handleAddSegment = () => {
        const newSegment = createEmptyTravelSegment();
        onSegmentsChange([...segments, newSegment]);
    };

    const handleUpdateSegment = (segmentId, updates) => {
        const updatedSegments = segments.map(segment =>
            segment.id === segmentId ? { ...segment, ...updates } : segment
        );
        onSegmentsChange(updatedSegments);
    };

    const handleRemoveSegment = (segmentId) => {
        const updatedSegments = segments.filter(segment => segment.id !== segmentId);
        onSegmentsChange(updatedSegments);
    };

    const handleDuplicateSegment = (originalSegment) => {
        const duplicatedSegment = {
            ...originalSegment,
            id: crypto.randomUUID(),
            Prilohy: {} // Don't duplicate attachments
        };
        onSegmentsChange([...segments, duplicatedSegment]);
    };

    const handleMoveSegment = (fromIndex, toIndex) => {
        if (toIndex < 0 || toIndex >= segments.length) return;
        
        const newSegments = [...segments];
        const [movedSegment] = newSegments.splice(fromIndex, 1);
        newSegments.splice(toIndex, 0, movedSegment);
        onSegmentsChange(newSegments);
    };

    const handleMoveUp = (index) => {
        handleMoveSegment(index, index - 1);
    };

    const handleMoveDown = (index) => {
        handleMoveSegment(index, index + 1);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <IconMapPin size={20} />
                    <h3 className="text-lg font-semibold">Dopravní segmenty</h3>
                </div>
                <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleAddSegment}
                    disabled={disabled}
                >
                    <IconPlus size={16} />
                    Přidat segment
                </button>
            </div>

            <div className="space-y-4">
                {segments.map((segment, index) => (
                    <TravelSegmentItem
                        key={segment.id}
                        segment={segment}
                        index={index}
                        totalSegments={segments.length}
                        onUpdate={handleUpdateSegment}
                        onRemove={handleRemoveSegment}
                        onDuplicate={handleDuplicateSegment}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        canRemove={segments.length > 1}
                        storagePath={storagePath}
                        prikazId={prikazId}
                        reportId={reportId}
                        disabled={disabled}
                        isDraft={isDraft}
                    />
                ))}
            </div>

            {segments.length === 0 && (
                <div className="alert alert--info">
                    <p>Přidejte alespoň jeden dopravní segment.</p>
                    <button
                        type="button"
                        className="btn btn--primary mt-2"
                        onClick={handleAddSegment}
                        disabled={disabled}
                    >
                        <IconPlus size={16} />
                        Přidat první segment
                    </button>
                </div>
            )}
        </div>
    );
};