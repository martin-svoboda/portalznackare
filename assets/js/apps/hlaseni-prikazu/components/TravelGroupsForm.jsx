import React, { useMemo } from 'react';
import {
    IconPlus,
    IconTrash,
    IconCopy,
    IconCar,
    IconBus,
    IconWalk,
    IconBike,
    IconMapPin,
    IconArrowUp,
    IconArrowDown,
    IconUsers,
    IconUserCheck
} from '@tabler/icons-react';
import { AdvancedFileUpload } from './AdvancedFileUpload';

const transportTypeOptions = [
    { value: "AUV", label: "AUV (Auto vlastní)", icon: IconCar },
    //{ value: "AUV-Z", label: "AUV-Z (Auto zaměstnavatele)", icon: IconCar }, // vypnuto - nepoužívá se
    { value: "V", label: "Veřejná doprava", icon: IconBus },
    { value: "P", label: "Pěšky", icon: IconWalk },
    { value: "K", label: "Kolo", icon: IconBike },
];

const getTransportIcon = (transportType) => {
    const option = transportTypeOptions.find(opt => opt.value === transportType);
    return option?.icon || IconCar;
};

const createEmptyTravelSegment = () => ({
    id: crypto.randomUUID(),
    date: new Date(),
    startTime: "",
    endTime: "",
    startPlace: "",
    endPlace: "",
    transportType: "AUV",
    kilometers: 0,
    ticketCosts: 0,
    attachments: []
});

export const TravelGroupsForm = ({ 
    formData, 
    setFormData, 
    priceList, 
    head, 
    teamMembers,
    prikazId, 
    fileUploadService,
    currentUser
}) => {
    // Generate storage path for this report
    const storagePath = useMemo(() => {
        if (!prikazId) return null;
        
        const year = formData.executionDate ? formData.executionDate.getFullYear() : new Date().getFullYear();
        const kkz = head?.KKZ?.toString().trim() || 'unknown';
        const obvod = head?.ZO?.toString().trim() || 'unknown';
        const sanitizedPrikazId = prikazId?.toString().trim() || 'unknown';
        
        const validYear = (year >= 2020 && year <= 2030) ? year : new Date().getFullYear();
        
        return `reports/${validYear}/${kkz}/${obvod}/${sanitizedPrikazId}`;
    }, [prikazId, formData.executionDate, head]);

    // Helper functions for date formatting (from original)
    const formatDate = (date) => {
        if (!date) return '';
        return date.toISOString().split('T')[0];
    };

    const parseDate = (dateString) => {
        if (!dateString) return new Date();
        return new Date(dateString);
    };

    // Travel group functions
    const addTravelGroup = () => {
        const defaultDriver = teamMembers.length === 1 ? (teamMembers[0].int_adr || teamMembers[0].intAdr) : null;
        
        const newGroup = {
            id: crypto.randomUUID(),
            participants: teamMembers.map(m => m.int_adr || m.intAdr), // defaultně všichni - podpora obou variant
            driver: defaultDriver,
            spz: "",
            segments: [createEmptyTravelSegment()]
        };
        
        setFormData(prev => ({
            ...prev,
            travelGroups: [...(prev.travelGroups || []), newGroup]
        }));
    };

    const removeTravelGroup = (groupId) => {
        setFormData(prev => ({
            ...prev,
            travelGroups: prev.travelGroups?.filter(group => group.id !== groupId) || []
        }));
    };

    const updateGroupField = (groupId, updates) => {
        setFormData(prev => ({
            ...prev,
            travelGroups: prev.travelGroups?.map(group =>
                group.id === groupId ? { ...group, ...updates } : group
            ) || []
        }));
    };

    // Travel segment functions (same as original) - scoped to group
    const addTravelSegment = (groupId) => {
        const group = formData.travelGroups?.find(g => g.id === groupId);
        if (!group) return;
        
        const lastSegment = group.segments[group.segments.length - 1];
        const newSegment = {
            ...createEmptyTravelSegment(),
            date: formData.executionDate,
            startTime: "08:00",
            startPlace: lastSegment?.endPlace || "",
        };
        
        updateGroupField(groupId, {
            segments: [...group.segments, newSegment]
        });
    };

    const updateSegmentField = (groupId, segmentId, updates) => {
        const group = formData.travelGroups?.find(g => g.id === groupId);
        if (!group) return;

        const updatedSegments = group.segments.map(segment =>
            segment.id === segmentId ? { ...segment, ...updates } : segment
        );

        updateGroupField(groupId, { segments: updatedSegments });
    };

    const removeSegment = (groupId, segmentId) => {
        const group = formData.travelGroups?.find(g => g.id === groupId);
        if (!group) return;

        updateGroupField(groupId, {
            segments: group.segments.filter(segment => segment.id !== segmentId)
        });
    };

    const duplicateSegment = (groupId, segmentId) => {
        const group = formData.travelGroups?.find(g => g.id === groupId);
        if (!group) return;

        const segmentToDuplicate = group.segments.find(s => s.id === segmentId);
        if (!segmentToDuplicate) return;

        const newSegment = {
            ...segmentToDuplicate,
            id: crypto.randomUUID(),
            attachments: [] // Don't duplicate attachments
        };

        updateGroupField(groupId, {
            segments: [...group.segments, newSegment]
        });
    };

    const moveSegmentUp = (groupId, segmentId) => {
        const group = formData.travelGroups?.find(g => g.id === groupId);
        if (!group) return;

        const segments = [...group.segments];
        const currentIndex = segments.findIndex(s => s.id === segmentId);

        if (currentIndex > 0) {
            [segments[currentIndex - 1], segments[currentIndex]] = [segments[currentIndex], segments[currentIndex - 1]];
            updateGroupField(groupId, { segments });
        }
    };

    const moveSegmentDown = (groupId, segmentId) => {
        const group = formData.travelGroups?.find(g => g.id === groupId);
        if (!group) return;

        const segments = [...group.segments];
        const currentIndex = segments.findIndex(s => s.id === segmentId);

        if (currentIndex < segments.length - 1) {
            [segments[currentIndex], segments[currentIndex + 1]] = [segments[currentIndex + 1], segments[currentIndex]];
            updateGroupField(groupId, { segments });
        }
    };

    // Get team member name by int_adr
    const getTeamMemberName = (intAdr) => {
        const member = teamMembers.find(m => (m.int_adr || m.intAdr) === intAdr);
        return member?.name || `Člen ${intAdr}`;
    };

    // Fix groups with null or empty participants on mount
    React.useEffect(() => {
        const needsFix = formData.travelGroups?.some(group => 
            !group.participants || 
            group.participants.length === 0 || 
            group.participants.some(p => p === null)
        );
        
        if (needsFix && teamMembers.length > 0) {
            setFormData(prev => ({
                ...prev,
                travelGroups: prev.travelGroups.map(group => ({
                    ...group,
                    participants: teamMembers.map(m => m.int_adr || m.intAdr)
                }))
            }));
        }
    }, []); // Run only once on mount
    
    const travelGroups = formData.travelGroups || [];
    
    const isFormDisabled = formData.status === 'submitted';

    return (
        <div className="space-y-6">
            {travelGroups.map((group, groupIndex) => (
                <div key={group.id} className="card">
                    <div className="card__content">
                        {/* NOVÉ: Group header s participant selector - jen pokud je více skupin */}
                        {travelGroups.length > 1 && (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-lg font-semibold">
                                        <IconUsers size={20} className="inline mr-2" />
                                        Skupina cest {groupIndex + 1}
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => removeTravelGroup(group.id)}
                                        className="btn btn--icon btn--danger--light btn--sm"
                                        title="Odstranit skupinu"
                                    >
                                        <IconTrash size={16} />
                                    </button>
                                </div>

                                {/* NOVÉ: Participant selector */}
                                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <label className="form__label mb-3">
                                        <IconUsers size={16} className="mr-1" />
                                        Účastníci této skupiny cest
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        {teamMembers.map(member => {
                                            const memberIntAdr = member.int_adr || member.intAdr;
                                            return (
                                                <label key={memberIntAdr} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        className="form__checkbox"
                                                        checked={group.participants?.includes(memberIntAdr) || false}
                                                        onChange={(e) => {
                                                            const newParticipants = e.target.checked
                                                                ? [...(group.participants || []), memberIntAdr]
                                                                : (group.participants || []).filter(p => p !== memberIntAdr);
                                                            updateGroupField(group.id, { participants: newParticipants });
                                                        }}
                                                        disabled={isFormDisabled}
                                                    />
                                                    <span className="text-sm">{member.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* PŮVODNÍ: Zůstává stejná header struktura jako v původním */}
                        {travelGroups.length === 1 && (
                            <h4 className="text-lg font-semibold mb-4">Jízdné</h4>
                        )}

                        <div className="space-y-6">
                            {/* PŮVODNÍ: Přesně stejné UI pro segmenty jako v původním */}
                            {group.segments?.filter(seg => seg && seg.id).map((segment, index) => {
                                if (!segment) return null;
                                const TransportIcon = getTransportIcon(segment.transportType || "AUV");

                                return (
                                    <div key={segment.id}>
                                        {index > 0 && <hr className="my-4" />}
                                        <div className="ml-4 pl-6 border-l-2 border-blue-400 relative">
                                            <div className="absolute top-0 right-0 flex gap-1 z-10">
                                                {/* Move up - only if not first */}
                                                {index > 0 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn--icon btn--gray--light"
                                                        onClick={() => moveSegmentUp(group.id, segment.id)}
                                                        title="Přesunout nahoru"
                                                        disabled={isFormDisabled}
                                                    >
                                                        <IconArrowUp size={14} />
                                                    </button>
                                                )}

                                                {/* Move down - only if not last */}
                                                {index < group.segments.length - 1 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn--icon btn--gray--light"
                                                        onClick={() => moveSegmentDown(group.id, segment.id)}
                                                        title="Přesunout dolů"
                                                        disabled={isFormDisabled}
                                                    >
                                                        <IconArrowDown size={14} />
                                                    </button>
                                                )}

                                                {/* Duplicate segment */}
                                                <button
                                                    type="button"
                                                    className="btn btn--icon btn--primary--light"
                                                    onClick={() => duplicateSegment(group.id, segment.id)}
                                                    title="Duplikovat cestu"
                                                    disabled={isFormDisabled}
                                                >
                                                    <IconCopy size={14} />
                                                </button>
                                                
                                                {/* Remove segment - only if more than 1 */}
                                                {group.segments.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn--icon btn--danger--light"
                                                        onClick={() => removeSegment(group.id, segment.id)}
                                                        title="Smazat cestu"
                                                        disabled={isFormDisabled}
                                                    >
                                                        <IconTrash size={16} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* PŮVODNÍ: Segment header - přesně stejný */}
                                            <div className="mb-4">
                                                <div className="flex items-start gap-3 mb-4 flex-wrap">
                                                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center absolute -left-5 -top-1">
                                                        <TransportIcon size={18} />
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
                                                                value={formatDate(segment.date || formData.executionDate)}
                                                                onChange={(e) => updateSegmentField(group.id, segment.id, { date: parseDate(e.target.value) })}
                                                                disabled={isFormDisabled}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* PŮVODNÍ: Start location - přesně stejný */}
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
                                                                value={segment.startPlace || ""}
                                                                onChange={(e) => updateSegmentField(group.id, segment.id, { startPlace: e.target.value })}
                                                                disabled={isFormDisabled}
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
                                                                value={segment.startTime || ""}
                                                                onChange={(e) => updateSegmentField(group.id, segment.id, { startTime: e.target.value })}
                                                                disabled={isFormDisabled}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* PŮVODNÍ: End location - přesně stejný */}
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
                                                                value={segment.endPlace || ""}
                                                                onChange={(e) => updateSegmentField(group.id, segment.id, { endPlace: e.target.value })}
                                                                disabled={isFormDisabled}
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
                                                                value={segment.endTime || ""}
                                                                onChange={(e) => updateSegmentField(group.id, segment.id, { endTime: e.target.value })}
                                                                disabled={isFormDisabled}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* PŮVODNÍ: Transport type and distance/costs - přesně stejný */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                                                    <div>
                                                        <label htmlFor={`transport-type-${segment.id}`} className="form__label">Typ dopravy</label>
                                                        <select
                                                            id={`transport-type-${segment.id}`}
                                                            name={`transport-type-${segment.id}`}
                                                            className="form__select"
                                                            value={segment.transportType || "AUV"}
                                                            onChange={(e) => updateSegmentField(group.id, segment.id, { transportType: e.target.value })}
                                                            disabled={isFormDisabled}
                                                        >
                                                            {transportTypeOptions.map(opt => (
                                                                <option key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        {segment.transportType === "AUV" && (
                                                            <>
                                                                <label htmlFor={`kilometers-${segment.id}`} className="form__label">Kilometry</label>
                                                                <input
                                                                    id={`kilometers-${segment.id}`}
                                                                    name={`kilometers-${segment.id}`}
                                                                    type="number"
                                                                    className="form__input"
                                                                    value={segment.kilometers || 0}
                                                                    onChange={(e) => updateSegmentField(group.id, segment.id, { kilometers: Number(e.target.value) || 0 })}
                                                                    min="0"
                                                                    step="0.1"
                                                                    disabled={isFormDisabled}
                                                                />
                                                            </>
                                                        )}
                                                        {segment.transportType === "V" && (
                                                            <>
                                                                <label htmlFor={`ticket-costs-${segment.id}`} className="form__label">Náklady na jízdenky (Kč)</label>
                                                                <input
                                                                    id={`ticket-costs-${segment.id}`}
                                                                    name={`ticket-costs-${segment.id}`}
                                                                    type="number"
                                                                    className="form__input"
                                                                    value={segment.ticketCosts || 0}
                                                                    onChange={(e) => updateSegmentField(group.id, segment.id, { ticketCosts: Number(e.target.value) || 0 })}
                                                                    min="0"
                                                                    step="0.01"
                                                                    disabled={isFormDisabled}
                                                                />
                                                            </>
                                                        )}
                                                        {/* Pro P (Pěšky) a K (Kolo) se nic nezobrazuje */}
                                                    </div>
                                                </div>

                                                {/* PŮVODNÍ: File uploads for public transport - přesně stejný */}
                                                {segment.transportType === "V" && (
                                                    <div className="mt-4">
                                                        <label className="form__label mb-2 block">Jízdenky a doklady</label>
                                                        <AdvancedFileUpload
                                                            id={`segment-${segment.id}`}
                                                            files={segment.attachments ?? []}
                                                            onFilesChange={(files) => updateSegmentField(group.id, segment.id, { attachments: files })}
                                                            maxFiles={10}
                                                            accept="image/jpeg,image/png,image/heic,application/pdf"
                                                            maxSize={10}
                                                            storagePath={storagePath}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* PŮVODNÍ: Add segment button - přesně stejný */}
                            <div className="text-center mt-6">
                                <button
                                    type="button"
                                    className="btn btn--secondary"
                                    onClick={() => addTravelSegment(group.id)}
                                    disabled={isFormDisabled}
                                >
                                    <IconPlus size={16} className="mr-2" />
                                    Přidat segment
                                </button>
                            </div>

                            {/* NOVÉ: Driver settings per group - jen pokud má auto segmenty */}
                            {group.segments?.some(s => s.transportType === "AUV") && (
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <h5 className="text-md font-semibold mb-4">Nastavení řidiče</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor={`driver-${group.id}`} className="form__label">
                                                Primární řidič *
                                            </label>
                                            <select
                                                id={`driver-${group.id}`}
                                                name={`driver-${group.id}`}
                                                className="form__select"
                                                value={group.driver || ""}
                                                onChange={(e) => updateGroupField(group.id, { driver: e.target.value })}
                                                required
                                                disabled={isFormDisabled}
                                            >
                                                <option value="">Vyberte řidiče</option>
                                                {(group.participants || []).map(intAdr => {
                                                    const member = teamMembers.find(m => (m.int_adr || m.intAdr) === intAdr);
                                                    return member ? (
                                                        <option key={intAdr} value={intAdr}>
                                                            {member.name}{member.isLeader ? " (vedoucí)" : ""}
                                                        </option>
                                                    ) : null;
                                                })}
                                            </select>
                                        </div>

                                        <div>
                                            <label htmlFor={`spz-${group.id}`} className="form__label">
                                                SPZ vozidla *
                                            </label>
                                            <input
                                                id={`spz-${group.id}`}
                                                name={`spz-${group.id}`}
                                                type="text"
                                                className="form__input"
                                                placeholder="např. 1AB 2345"
                                                value={group.spz || ""}
                                                maxLength={10}
                                                onChange={(e) => updateGroupField(group.id, { spz: e.target.value })}
                                                required
                                                disabled={isFormDisabled}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {/* NOVÉ: Tlačítko pro přidání skupiny - vždy dole */}
            <div className="text-center">
                <button
                    type="button"
                    onClick={addTravelGroup}
                    className={`btn ${travelGroups.length === 0 ? 'btn--primary' : 'btn--secondary'}`}
                >
                    <IconPlus size={16} className="mr-2" />
                    {travelGroups.length === 0 ? 'Přidat skupinu cest' : 'Přidat další skupinu cest'}
                </button>
            </div>
        </div>
    );
};