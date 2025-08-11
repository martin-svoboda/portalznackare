import React, {useMemo} from 'react';
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
    IconUserCheck,
    IconCurrencyDollar
} from '@tabler/icons-react';
import {AdvancedFileUpload} from './AdvancedFileUpload';
import { 
    getAttachmentsAsArray, 
    setAttachmentsFromArray 
} from '../utils/attachmentUtils';
import { calculateExecutionDate } from '../utils/compensationCalculator';
import { generateUsageType, generateEntityId } from '../utils/fileUsageUtils';
import { toISODateString } from '../../../utils/dateUtils';

const druhDopravyOptions = [
    {value: "AUV", label: "AUV (Auto vlastní)", icon: IconCar},
    //{ value: "AUV-Z", label: "AUV-Z (Auto zaměstnavatele)", icon: IconCar }, // vypnuto - nepoužívá se
    {value: "V", label: "Veřejná doprava", icon: IconBus},
    {value: "P", label: "Pěšky", icon: IconWalk},
    {value: "K", label: "Kolo", icon: IconBike},
];

const getTransportIcon = (Druh_Dopravy) => {
    const option = druhDopravyOptions.find(opt => opt.value === Druh_Dopravy);
    return option?.icon || IconCar;
};

const createEmptyTravelSegment = () => ({
    id: crypto.randomUUID(),
    Datum: new Date(),
    Cas_Odjezdu: "",
    Cas_Prijezdu: "",
    Misto_Odjezdu: "",
    Misto_Prijezdu: "",
    Druh_Dopravy: "AUV",
    Kilometry: undefined, // Undefined místo 0 pro prázdné pole
    Naklady: undefined,
    Prilohy: {}
});

export const TravelGroupsForm = ({
                                     formData,
                                     setFormData,
                                     tariffRates,
                                     head,
                                     teamMembers,
                                     prikazId,
                                     fileUploadService,
                                     currentUser,
                                     disabled = false
                                 }) => {
    
    // Generate storage path for this report
    const storagePath = useMemo(() => {
        if (!prikazId) return null;

        const year = calculateExecutionDate(formData).getFullYear();
        const kkz = head?.KKZ?.toString().trim() || 'unknown';
        const obvod = head?.ZO?.toString().trim() || 'unknown';
        const sanitizedPrikazId = prikazId?.toString().trim() || 'unknown';

        const validYear = (year >= 2020 && year <= 2030) ? year : new Date().getFullYear();

        return `reports/${validYear}/${kkz}/${obvod}/${sanitizedPrikazId}`;
    }, [prikazId, formData, head]);


    const parseDate = (dateString) => {
        if (!dateString) return new Date();
        return new Date(dateString);
    };

    // Travel group functions
    const addTravelGroup = () => {
        const defaultDriver = (teamMembers || []).length === 1 ? teamMembers[0]?.INT_ADR : null;

        const newGroup = {
            id: crypto.randomUUID(),
            Cestujci: (teamMembers || []).map(m => m.INT_ADR), // defaultně všichni
            Ridic: defaultDriver,
            SPZ: "",
            Cesty: [createEmptyTravelSegment()]
        };

        setFormData(prev => ({
            ...prev,
            Skupiny_Cest: [...(prev.Skupiny_Cest || []), newGroup]
        }));
    };

    const removeTravelGroup = (groupId) => {
        setFormData(prev => ({
            ...prev,
            Skupiny_Cest: prev.Skupiny_Cest?.filter(group => group.id !== groupId) || []
        }));
    };

    const updateGroupField = (groupId, updates) => {
        setFormData(prev => ({
            ...prev,
            Skupiny_Cest: prev.Skupiny_Cest?.map(group =>
                group.id === groupId ? {...group, ...updates} : group
            ) || []
        }));
    };

    // Travel segment functions (same as original) - scoped to group
    const addTravelSegment = (groupId) => {
        const group = formData.Skupiny_Cest?.find(g => g.id === groupId);
        if (!group) return;

        const lastSegment = group.Cesty[group.Cesty.length - 1];
        const newSegment = {
            ...createEmptyTravelSegment(),
            Datum: calculateExecutionDate(formData),
            Misto_Odjezdu: lastSegment?.Misto_Prijezdu || "",
        };

        updateGroupField(groupId, {
            Cesty: [...group.Cesty, newSegment]
        });
    };

    const updateSegmentField = (groupId, segmentId, updates) => {
        const group = formData.Skupiny_Cest?.find(g => g.id === groupId);
        if (!group) return;

        const updatedSegments = group.Cesty.map(segment =>
            segment.id === segmentId ? {...segment, ...updates} : segment
        );

        updateGroupField(groupId, {Cesty: updatedSegments});
    };

    const removeSegment = (groupId, segmentId) => {
        const group = formData.Skupiny_Cest?.find(g => g.id === groupId);
        if (!group) return;

        updateGroupField(groupId, {
            Cesty: group.Cesty.filter(segment => segment.id !== segmentId)
        });
    };

    const duplicateSegment = (groupId, segmentId) => {
        const group = formData.Skupiny_Cest?.find(g => g.id === groupId);
        if (!group) return;

        const segmentToDuplicate = group.Cesty.find(s => s.id === segmentId);
        if (!segmentToDuplicate) return;

        const newSegment = {
            ...segmentToDuplicate,
            id: crypto.randomUUID(),
            // Prohodit místa pro zpáteční cestu
            Misto_Odjezdu: segmentToDuplicate.Misto_Prijezdu,
            Misto_Prijezdu: segmentToDuplicate.Misto_Odjezdu,
            // Vymazat časy
            Cas_Odjezdu: "",
            Cas_Prijezdu: "",
            Prilohy: {} // Don't duplicate Prilohy
        };

        updateGroupField(groupId, {
            Cesty: [...group.Cesty, newSegment]
        });
    };

    const moveSegmentUp = (groupId, segmentId) => {
        const group = formData.Skupiny_Cest?.find(g => g.id === groupId);
        if (!group) return;

        const segments = [...group.Cesty];
        const currentIndex = segments.findIndex(s => s.id === segmentId);

        if (currentIndex > 0) {
            [segments[currentIndex - 1], segments[currentIndex]] = [segments[currentIndex], segments[currentIndex - 1]];
            updateGroupField(groupId, {Cesty: segments});
        }
    };

    const moveSegmentDown = (groupId, segmentId) => {
        const group = formData.Skupiny_Cest?.find(g => g.id === groupId);
        if (!group) return;

        const segments = [...group.Cesty];
        const currentIndex = segments.findIndex(s => s.id === segmentId);

        if (currentIndex < segments.length - 1) {
            [segments[currentIndex], segments[currentIndex + 1]] = [segments[currentIndex + 1], segments[currentIndex]];
            updateGroupField(groupId, {Cesty: segments});
        }
    };

    // Get team member name by INT_ADR
    const getTeamMemberName = (intAdr) => {
        const member = (teamMembers || []).find(m => m.INT_ADR === intAdr);
        return member?.name || member?.Znackar || `Člen ${intAdr}`;
    };

    // Handle higher rate change for radio buttons - nastavit hlavního řidiče
    const handleHigherRateChange = React.useCallback((selectedDriverIntAdr) => {
        setFormData(prev => ({
            ...prev,
            Hlavni_Ridic: selectedDriverIntAdr
        }));
    }, [setFormData]);

    // Calculate total kilometers for a group
    const calculateGroupKilometers = (group) => {
        return group.Cesty?.reduce((total, segment) => {
            if (segment?.Druh_Dopravy === "AUV") {
                return total + (segment.Kilometry || 0);
            }
            return total;
        }, 0) || 0;
    };

    // Fix groups with null or empty participants on mount
    React.useEffect(() => {
        const needsFix = formData.Skupiny_Cest?.some(group =>
            !group.Cestujci ||
            group.Cestujci.length === 0 ||
            group.Cestujci.some(p => p === null)
        );

        if (needsFix && (teamMembers || []).length > 0) {
            setFormData(prev => ({
                ...prev,
                Skupiny_Cest: (prev.Skupiny_Cest || []).map(group => ({
                    ...group,
                    Cestujci: (teamMembers || []).map(m => m.INT_ADR)
                }))
            }));
        }
    }, []); // Run only once on mount

    // Auto-set first driver to have higher rate when Zvysena_Sazba is true or when drivers change
    React.useEffect(() => {
        if (formData.Zvysena_Sazba && uniqueDrivers.length > 0) {
            const hasValidMainDriver = formData.Hlavni_Ridic && uniqueDrivers.some(d => d.INT_ADR === formData.Hlavni_Ridic);

            // If no valid main driver is set, set the first one
            if (!hasValidMainDriver) {
                handleHigherRateChange(uniqueDrivers[0].INT_ADR);
            }
        }
    }, [formData.Zvysena_Sazba, uniqueDrivers, handleHigherRateChange]); // Remove formData.Hlavni_Ridic dependency to avoid loop

    const travelGroups = formData.Skupiny_Cest || [];

    // Získat unikátní řidiče napříč skupinami
    const uniqueDrivers = useMemo(() => {
        const driverMap = new Map();
        
        travelGroups.forEach(group => {
            if (group.Ridic) {
                const driver = (teamMembers || []).find(m => m.INT_ADR === group.Ridic);
                if (driver && !driverMap.has(group.Ridic)) {
                    // Spočítat celkové kilometry pro tohoto řidiče napříč všemi skupinami
                    const totalKmForDriver = travelGroups
                        .filter(g => g.Ridic === group.Ridic)
                        .reduce((total, g) => total + calculateGroupKilometers(g), 0);
                    
                    driverMap.set(group.Ridic, {
                        ...driver,
                        totalKm: totalKmForDriver,
                        groups: travelGroups.filter(g => g.Ridic === group.Ridic).length
                    });
                }
            }
        });
        
        return Array.from(driverMap.values());
    }, [travelGroups, teamMembers]);


    return (
        <div className="space-y-6">
            {travelGroups.map((group, groupIndex) => (
                <div key={group.id} className="card">
                    <div className="card__content">
                        {/* Group header s participant selector */}
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-lg font-semibold">
                                <IconUsers size={20} className="inline mr-2"/>
                                {travelGroups.length > 1 ? `Skupina cest ${groupIndex + 1}` : 'Segmenty cest'}
                            </h4>
                            {travelGroups.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeTravelGroup(group.id)}
                                    className="btn btn--icon btn--danger--light btn--sm"
                                    title="Odstranit skupinu"
                                >
                                    <IconTrash size={16}/>
                                </button>
                            )}
                        </div>

                        {/* Participant selector - zobrazit jen pokud je více skupin */}
                        {travelGroups.length > 1 && (
                            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <label className="form__label mb-3">
                                    Účastníci této skupiny cest
                                </label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        {(teamMembers || []).map(member => {
                                            const memberIntAdr = member.INT_ADR;
                                            return (
                                                <label key={memberIntAdr} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        className="form__checkbox"
                                                        checked={group.Cestujci?.includes(memberIntAdr) || false}
                                                        onChange={(e) => {
                                                            const newCestujci = e.target.checked
                                                                ? [...(group.Cestujci || []), memberIntAdr]
                                                                : (group.Cestujci || []).filter(p => p !== memberIntAdr);
                                                            updateGroupField(group.id, {Cestujci: newCestujci});
                                                        }}
                                                        disabled={disabled}
                                                    />
                                                    <span className="text-sm">{member.name || member.Znackar || 'Neznámý člen'}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                            </div>
                        )}

                        {/* PŮVODNÍ: Zůstává stejná header struktura jako v původním */}
                        {travelGroups.length === 1 && (
                            <h4 className="text-lg font-semibold mb-4">Jízdné</h4>
                        )}

                        <div className="space-y-6">
                            {/* PŮVODNÍ: Přesně stejné UI pro segmenty jako v původním */}
                            {group.Cesty?.filter(seg => seg && seg.id).map((segment, index) => {
                                if (!segment) return null;
                                const TransportIcon = getTransportIcon(segment.Druh_Dopravy || "AUV");

                                return (
                                    <div key={segment.id}>
                                        {index > 0 && <hr className="my-4"/>}
                                        <div className="ml-4 pl-6 border-l-2 border-blue-400 relative">
                                            <div className="absolute top-0 right-0 flex gap-1 z-10">
                                                {/* Move up - only if not first */}
                                                {index > 0 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn--icon btn--gray--light"
                                                        onClick={() => moveSegmentUp(group.id, segment.id)}
                                                        title="Přesunout nahoru"
                                                        disabled={disabled}
                                                    >
                                                        <IconArrowUp size={14}/>
                                                    </button>
                                                )}

                                                {/* Move down - only if not last */}
                                                {index < group.Cesty.length - 1 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn--icon btn--gray--light"
                                                        onClick={() => moveSegmentDown(group.id, segment.id)}
                                                        title="Přesunout dolů"
                                                        disabled={disabled}
                                                    >
                                                        <IconArrowDown size={14}/>
                                                    </button>
                                                )}

                                                {/* Duplicate segment */}
                                                <button
                                                    type="button"
                                                    className="btn btn--icon btn--primary--light"
                                                    onClick={() => duplicateSegment(group.id, segment.id)}
                                                    title="Duplikovat cestu"
                                                    disabled={disabled}
                                                >
                                                    <IconCopy size={14}/>
                                                </button>

                                                {/* Remove segment - only if more than 1 */}
                                                {group.Cesty.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn--icon btn--danger--light"
                                                        onClick={() => removeSegment(group.id, segment.id)}
                                                        title="Smazat cestu"
                                                        disabled={disabled}
                                                    >
                                                        <IconTrash size={16}/>
                                                    </button>
                                                )}
                                            </div>

                                            {/* PŮVODNÍ: Segment header - přesně stejný */}
                                            <div className="mb-4">
                                                <div className="flex items-start gap-3 mb-4 flex-wrap">
                                                    <div
                                                        className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center absolute -left-5 -top-1">
                                                        <TransportIcon size={18}/>
                                                    </div>
                                                    <div className="w-24 pl-2">
                                                        <span className="font-medium">Cesta {index + 1}</span>
                                                    </div>
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="md:col-span-2">
                                                            <label htmlFor={`segment-date-${segment.id}`}
                                                                   className="form__label sr-only">Datum
                                                                segmentu</label>
                                                            <input
                                                                id={`segment-date-${segment.id}`}
                                                                name={`segment-date-${segment.id}`}
                                                                type="date"
                                                                className="form__input"
                                                                value={toISODateString(segment.Datum || calculateExecutionDate(formData))}
                                                                onChange={(e) => updateSegmentField(group.id, segment.id, {Datum: parseDate(e.target.value)})}
                                                                disabled={disabled}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* PŮVODNÍ: Start location - přesně stejný */}
                                                <div className="flex items-start gap-3 mb-4 flex-wrap">
                                                    <div
                                                        className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center absolute -left-3 text-xs">
                                                        <IconMapPin size={16}/>
                                                    </div>
                                                    <div className="w-24">
                                                        <span>Odjezd z</span>
                                                    </div>
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="md:col-span-2">
                                                            <label htmlFor={`start-place-${segment.id}`}
                                                                   className="form__label sr-only">Místo odjezdu</label>
                                                            <input
                                                                id={`start-place-${segment.id}`}
                                                                name={`start-place-${segment.id}`}
                                                                type="text"
                                                                className="form__input"
                                                                placeholder="Místo"
                                                                value={segment.Misto_Odjezdu || ""}
                                                                onChange={(e) => updateSegmentField(group.id, segment.id, {Misto_Odjezdu: e.target.value})}
                                                                disabled={disabled}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span>V</span>
                                                            <label htmlFor={`start-time-${segment.id}`}
                                                                   className="form__label sr-only">Čas odjezdu</label>
                                                            <input
                                                                id={`start-time-${segment.id}`}
                                                                name={`start-time-${segment.id}`}
                                                                type="time"
                                                                className="form__input flex-1"
                                                                value={segment.Cas_Odjezdu || ""}
                                                                onChange={(e) => updateSegmentField(group.id, segment.id, {Cas_Odjezdu: e.target.value})}
                                                                disabled={disabled}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* PŮVODNÍ: End location - přesně stejný */}
                                                <div className="flex items-start gap-3 mb-4 flex-wrap">
                                                    <div
                                                        className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center absolute -left-3 text-xs">
                                                        <IconMapPin size={16}/>
                                                    </div>
                                                    <div className="w-24">
                                                        <span>Příjezd do</span>
                                                    </div>
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="md:col-span-2">
                                                            <label htmlFor={`end-place-${segment.id}`}
                                                                   className="form__label sr-only">Místo
                                                                příjezdu</label>
                                                            <input
                                                                id={`end-place-${segment.id}`}
                                                                name={`end-place-${segment.id}`}
                                                                type="text"
                                                                className="form__input"
                                                                placeholder="Místo"
                                                                value={segment.Misto_Prijezdu || ""}
                                                                onChange={(e) => updateSegmentField(group.id, segment.id, {Misto_Prijezdu: e.target.value})}
                                                                disabled={disabled}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span>V</span>
                                                            <label htmlFor={`end-time-${segment.id}`}
                                                                   className="form__label sr-only">Čas příjezdu</label>
                                                            <input
                                                                id={`end-time-${segment.id}`}
                                                                name={`end-time-${segment.id}`}
                                                                type="time"
                                                                className="form__input flex-1"
                                                                value={segment.Cas_Prijezdu || ""}
                                                                onChange={(e) => updateSegmentField(group.id, segment.id, {Cas_Prijezdu: e.target.value})}
                                                                disabled={disabled}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* PŮVODNÍ: Transport type and distance/costs - přesně stejný */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                                                    <div>
                                                        <label htmlFor={`transport-type-${segment.id}`}
                                                               className="form__label">Typ dopravy</label>
                                                        <select
                                                            id={`transport-type-${segment.id}`}
                                                            name={`transport-type-${segment.id}`}
                                                            className="form__select"
                                                            value={segment.Druh_Dopravy || "AUV"}
                                                            onChange={(e) => updateSegmentField(group.id, segment.id, {Druh_Dopravy: e.target.value})}
                                                            disabled={disabled}
                                                        >
                                                            {druhDopravyOptions.map(opt => (
                                                                <option key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        {segment.Druh_Dopravy === "AUV" && (
                                                            <>
                                                                <label htmlFor={`kilometry-${segment.id}`}
                                                                       className="form__label">Kilometry</label>
                                                                <input
                                                                    id={`kilometry-${segment.id}`}
                                                                    name={`kilometry-${segment.id}`}
                                                                    type="number"
                                                                    className="form__input"
                                                                    value={segment.Kilometry || ''}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value === '' ? undefined : parseFloat(e.target.value) || 0;
                                                                        updateSegmentField(group.id, segment.id, {Kilometry: value});
                                                                    }}
                                                                    placeholder="0"
                                                                    min="0"
                                                                    step="0.1"
                                                                    disabled={disabled}
                                                                />
                                                            </>
                                                        )}
                                                        {segment.Druh_Dopravy === "V" && (
                                                            <div className="space-y-2">
                                                                <label className="form__label">Náklady na jízdenky
                                                                    (Kč)</label>
                                                                {/* Zobrazit input pro každého cestujícího */}
                                                                {group.Cestujci && group.Cestujci.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        {group.Cestujci.map(intAdr => {
                                                                            const member = teamMembers?.find(m => m.INT_ADR === intAdr);
                                                                            const currentValue = typeof segment.Naklady === 'object' ? (segment.Naklady[intAdr] || '') : '';

                                                                            return (
                                                                                <div key={intAdr}
                                                                                     className="flex gap-1">
                                                                                    <span
                                                                                        className="text-xs min-w-min w-20">
                                                                                        {member?.name || member?.Znackar || `Člen ${intAdr}`}:
                                                                                    </span>
                                                                                        <input
                                                                                            type="number"
                                                                                            className="form__input flex-1"
                                                                                            value={currentValue}
                                                                                            onChange={(e) => {
                                                                                                const value = parseFloat(e.target.value) || 0;
                                                                                                const newNaklady = typeof segment.Naklady === 'object'
                                                                                                    ? {...segment.Naklady}
                                                                                                    : {};

                                                                                                if (value > 0) {
                                                                                                    newNaklady[intAdr] = value;
                                                                                                } else {
                                                                                                    delete newNaklady[intAdr];
                                                                                                }

                                                                                                updateSegmentField(group.id, segment.id, {
                                                                                                    Naklady: Object.keys(newNaklady).length > 0 ? newNaklady : undefined
                                                                                                });
                                                                                            }}
                                                                                            placeholder="0"
                                                                                            min="0"
                                                                                            step="0.01"
                                                                                            disabled={disabled}
                                                                                        />
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-gray-500 italic">
                                                                        Nejprve vyberte cestující pro tuto skupinu
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* Pro P (Pěšky) a K (Kolo) se nic nezobrazuje */}
                                                    </div>
                                                </div>

                                                {/* PŮVODNÍ: File uploads for public transport - přesně stejný */}
                                                {segment.Druh_Dopravy === "V" && (
                                                    <div className="mt-4">
                                                        <label className="form__label mb-2 block">Jízdenky a
                                                            doklady</label>
                                                        <AdvancedFileUpload
                                                            id={`segment-${segment.id}`}
                                                            files={getAttachmentsAsArray(segment.Prilohy || {})}
                                                            onFilesChange={(files) => updateSegmentField(group.id, segment.id, {Prilohy: setAttachmentsFromArray(files)})}
                                                            maxFiles={10}
                                                            accept="image/jpeg,image/png,image/heic,application/pdf"
                                                            maxSize={10}
                                                            storagePath={storagePath}
                                                            // File usage tracking
                                                            usageType={generateUsageType('segment', prikazId)}
                                                            entityId={generateEntityId(prikazId, segment.id)}
                                                            usageData={{
                                                                section: 'travel_segment',
                                                                groupId: group.id,
                                                                segmentId: segment.id,
                                                                reportId: prikazId
                                                            }}
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
                                    disabled={disabled}
                                >
                                    <IconPlus size={16} className="mr-2"/>
                                    Přidat segment
                                </button>
                            </div>

                            {/* NOVÉ: Driver settings per group - jen pokud má auto segmenty */}
                            {group.Cesty?.some(s => s.Druh_Dopravy === "AUV") && (
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <h5 className="text-md font-semibold mb-4">Nastavení řidiče</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor={`driver-${group.id}`}
                                                   className="form__label flex items-center">
                                                Primární řidič *
                                            </label>
                                            <select
                                                id={`driver-${group.id}`}
                                                name={`driver-${group.id}`}
                                                className="form__select"
                                                value={group.Ridic || ""}
                                                onChange={(e) => updateGroupField(group.id, {Ridic: e.target.value})}
                                                required
                                                disabled={disabled}
                                            >
                                                <option value="">Vyberte řidiče</option>
                                                {(group.Cestujci || []).map(intAdr => {
                                                    const member = teamMembers.find(m => m.INT_ADR === intAdr);
                                                    return member ? (
                                                        <option key={intAdr} value={intAdr}>
                                                            {member.name || member.Znackar}{(member.isLeader || member.Je_Vedouci) ? " (vedoucí)" : ""}
                                                        </option>
                                                    ) : null;
                                                })}
                                            </select>
                                        </div>

                                        <div>
                                            <label htmlFor={`SPZ-${group.id}`} className="form__label">
                                                SPZ vozidla *
                                            </label>
                                            <input
                                                id={`SPZ-${group.id}`}
                                                name={`SPZ-${group.id}`}
                                                type="text"
                                                className="form__input"
                                                placeholder="např. 1AB 2345"
                                                value={group.SPZ || ""}
                                                maxLength={10}
                                                onChange={(e) => updateGroupField(group.id, {SPZ: e.target.value})}
                                                required
                                                disabled={disabled}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {/* Radio button group pro zvýšenou sazbu - zobrazit pouze když je příkaz se zvýšenou sazbou */}
            {formData.Zvysena_Sazba && uniqueDrivers.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h5 className="font-medium text-sm mb-3">
                        Přiřazení zvýšené sazby cestovného ({tariffRates?.jizdneZvysene || 8} Kč/km)
                    </h5>

                    <div className="space-y-2">
                        {/* Radio pro každého unikátního řidiče */}
                        {uniqueDrivers.map((driver) => {
                            return (
                                <label key={driver.INT_ADR} className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        name="zvysena_sazba_driver"
                                        className="form__radio"
                                        checked={formData.Hlavni_Ridic === driver.INT_ADR}
                                        onChange={() => handleHigherRateChange(driver.INT_ADR)}
                                        disabled={disabled}
                                    />
                                    <span className="text-sm">
                                        {driver.name || driver.Znackar}
                                        {driver.groups > 1 && ` - ve ${driver.groups} skupinách`}
                                        {driver.totalKm > 0 && (
                                            <span className="text-xs text-gray-500 ml-2">
                                                (celkem {driver.totalKm} km)
                                            </span>
                                        )}
                                    </span>
                                </label>
                            );
                        })}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                        Standardní sazba: {tariffRates?.jizdne || 6} Kč/km • Hlavní řidič dostane zvýšenou sazbu na všechny své AUV jízdy
                    </p>
                </div>
            )}

            {/* NOVÉ: Tlačítko pro přidání skupiny - vždy dole */}
            <div className="text-center">
                <button
                    type="button"
                    onClick={addTravelGroup}
                    className={`btn ${travelGroups.length === 0 ? 'btn--primary' : 'btn--secondary'}`}
                >
                    <IconPlus size={16} className="mr-2"/>
                    {travelGroups.length === 0 ? 'Přidat skupinu cest' : 'Přidat další skupinu cest'}
                </button>
            </div>
        </div>
    );
};