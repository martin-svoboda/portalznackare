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
    IconArrowDown
} from '@tabler/icons-react';
import { BasicInfoForm } from './BasicInfoForm';
import { PaymentRedirectsForm } from './PaymentRedirectsForm';
import { AdvancedFileUpload } from './AdvancedFileUpload';

const transportTypeOptions = [
    { value: "AUV", label: "AUV (Auto vlastní)", icon: IconCar },
    { value: "AUV-Z", label: "AUV-Z (Auto zaměstnavatele)", icon: IconCar },
    { value: "veřejná doprava", label: "Veřejná doprava", icon: IconBus },
    { value: "pěšky", label: "Pěšky", icon: IconWalk },
    { value: "kolo", label: "Kolo", icon: IconBike },
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

export const PartAForm = ({ 
    formData, 
    setFormData, 
    priceList, 
    head, 
    prikazId, 
    fileUploadService,
    currentUser, 
    teamMembers = [],
    isLeader = false, 
    canEditOthers = false,
    canEdit = true,
    disabled = false 
}) => {
    // Team members - use prop if provided, otherwise calculate from head data (original logic)
    const computedTeamMembers = useMemo(() => {
        if (teamMembers.length > 0) return teamMembers;
        if (!head) return [];
        return [1, 2, 3]
            .map(i => ({
                index: i,
                name: head[`Znackar${i}`],
                int_adr: head[`INT_ADR_${i}`],
                isLeader: head[`Je_Vedouci${i}`] === "1"
            }))
            .filter(member => member.name?.trim());
    }, [teamMembers, head]);

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

    // Travel segment functions (from original)
    const addTravelSegment = () => {
        const lastSegment = formData.travelSegments[formData.travelSegments.length - 1];
        const newSegment = {
            ...createEmptyTravelSegment(),
            date: formData.executionDate,
            startTime: "08:00",
            startPlace: lastSegment?.endPlace || "",
        };
        
        setFormData(prev => ({
            ...prev,
            travelSegments: [...prev.travelSegments, newSegment]
        }));
    };

    const updateSegmentField = (segmentId, updates) => {
        setFormData(prev => ({
            ...prev,
            travelSegments: prev.travelSegments.map(segment =>
                segment.id === segmentId ? { ...segment, ...updates } : segment
            )
        }));
    };

    const removeSegment = (segmentId) => {
        setFormData(prev => ({
            ...prev,
            travelSegments: prev.travelSegments.filter(segment => segment.id !== segmentId)
        }));
    };

    const duplicateSegment = (segmentId) => {
        const segmentToDuplicate = formData.travelSegments.find(s => s.id === segmentId);
        if (!segmentToDuplicate) return;

        const newSegment = {
            ...segmentToDuplicate,
            id: crypto.randomUUID(),
            attachments: [] // Don't duplicate attachments
        };

        setFormData(prev => ({
            ...prev,
            travelSegments: [...prev.travelSegments, newSegment]
        }));
    };

    const moveSegmentUp = (segmentId) => {
        const segments = [...formData.travelSegments];
        const currentIndex = segments.findIndex(s => s.id === segmentId);

        if (currentIndex > 0) {
            [segments[currentIndex - 1], segments[currentIndex]] = [segments[currentIndex], segments[currentIndex - 1]];
            setFormData(prev => ({ ...prev, travelSegments: segments }));
        }
    };

    const moveSegmentDown = (segmentId) => {
        const segments = [...formData.travelSegments];
        const currentIndex = segments.findIndex(s => s.id === segmentId);

        if (currentIndex < segments.length - 1) {
            [segments[currentIndex], segments[currentIndex + 1]] = [segments[currentIndex + 1], segments[currentIndex]];
            setFormData(prev => ({ ...prev, travelSegments: segments }));
        }
    };

    // Accommodation functions (from original)
    const addAccommodation = () => {
        const newAccommodation = {
            id: crypto.randomUUID(),
            place: "",
            facility: "",
            date: formData.executionDate,
            amount: 0,
            paidByMember: computedTeamMembers[0]?.int_adr || "",
            attachments: []
        };

        setFormData(prev => ({
            ...prev,
            accommodations: [...prev.accommodations, newAccommodation]
        }));
    };

    const updateAccommodation = (accommodationId, updates) => {
        setFormData(prev => ({
            ...prev,
            accommodations: prev.accommodations.map(acc =>
                acc.id === accommodationId ? { ...acc, ...updates } : acc
            )
        }));
    };

    const removeAccommodation = (accommodationId) => {
        setFormData(prev => ({
            ...prev,
            accommodations: prev.accommodations.filter(acc => acc.id !== accommodationId)
        }));
    };

    // Expense functions (from original)
    const addExpense = () => {
        const newExpense = {
            id: crypto.randomUUID(),
            description: "",
            amount: 0,
            paidByMember: computedTeamMembers[0]?.int_adr || "",
            attachments: []
        };

        setFormData(prev => ({
            ...prev,
            additionalExpenses: [...prev.additionalExpenses, newExpense]
        }));
    };

    const updateExpense = (expenseId, updates) => {
        setFormData(prev => ({
            ...prev,
            additionalExpenses: prev.additionalExpenses.map(exp =>
                exp.id === expenseId ? { ...exp, ...updates } : exp
            )
        }));
    };

    const removeExpense = (expenseId) => {
        setFormData(prev => ({
            ...prev,
            additionalExpenses: prev.additionalExpenses.filter(exp => exp.id !== expenseId)
        }));
    };

    // Handler functions for basic info
    const handleExecutionDateChange = (date) => {
        setFormData(prev => ({ ...prev, executionDate: date }));
    };

    const handlePrimaryDriverChange = (driver) => {
        setFormData(prev => ({ ...prev, primaryDriver: driver }));
    };

    const handleVehicleRegistrationChange = (registration) => {
        setFormData(prev => ({ ...prev, vehicleRegistration: registration }));
    };

    // Handler functions for payment redirects
    const handlePaymentRedirectsChange = (paymentRedirects) => {
        setFormData(prev => ({ ...prev, paymentRedirects }));
    };

    const isFormDisabled = !canEdit || disabled || formData.status === 'submitted';

    return (
        <div className="space-y-6">
            {/* Basic Information */}
            <BasicInfoForm
                executionDate={formData.executionDate}
                primaryDriver={formData.primaryDriver}
                vehicleRegistration={formData.vehicleRegistration}
                higherKmRate={formData.higherKmRate}
                onExecutionDateChange={handleExecutionDateChange}
                onPrimaryDriverChange={handlePrimaryDriverChange}
                onVehicleRegistrationChange={handleVehicleRegistrationChange}
                teamMembers={computedTeamMembers}
                currentUser={currentUser}
                isLeader={isLeader}
                canEditOthers={canEditOthers}
                disabled={isFormDisabled}
            />

            {/* Segmenty cesty */}
            <div className="card">
                <div className="card__content">
                    <h4 className="text-lg font-semibold mb-4">Jízdné</h4>

                    <div className="space-y-6">
                        {formData.travelSegments.filter(seg => seg && seg.id).map((segment, index) => {
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
                                                    onClick={() => moveSegmentUp(segment.id)}
                                                    title="Přesunout nahoru"
                                                    disabled={isFormDisabled}
                                                >
                                                    <IconArrowUp size={14} />
                                                </button>
                                            )}

                                            {/* Move down - only if not last */}
                                            {index < formData.travelSegments.length - 1 && (
                                                <button
                                                    type="button"
                                                    className="btn btn--icon btn--gray--light"
                                                    onClick={() => moveSegmentDown(segment.id)}
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
                                                onClick={() => duplicateSegment(segment.id)}
                                                title="Duplikovat cestu"
                                                disabled={isFormDisabled}
                                            >
                                                <IconCopy size={14} />
                                            </button>
                                            
                                            {/* Remove segment - only if more than 1 */}
                                            {formData.travelSegments.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="btn btn--icon btn--danger--light"
                                                    onClick={() => removeSegment(segment.id)}
                                                    title="Smazat cestu"
                                                    disabled={isFormDisabled}
                                                >
                                                    <IconTrash size={16} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Segment header */}
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
                                                            onChange={(e) => updateSegmentField(segment.id, { date: parseDate(e.target.value) })}
                                                            disabled={isFormDisabled}
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
                                                            value={segment.startPlace || ""}
                                                            onChange={(e) => updateSegmentField(segment.id, { startPlace: e.target.value })}
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
                                                            onChange={(e) => updateSegmentField(segment.id, { startTime: e.target.value })}
                                                            disabled={isFormDisabled}
                                                        />
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
                                                            value={segment.endPlace || ""}
                                                            onChange={(e) => updateSegmentField(segment.id, { endPlace: e.target.value })}
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
                                                            onChange={(e) => updateSegmentField(segment.id, { endTime: e.target.value })}
                                                            disabled={isFormDisabled}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Transport type and distance/costs */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                                                <div>
                                                    <label htmlFor={`transport-type-${segment.id}`} className="form__label">Typ dopravy</label>
                                                    <select
                                                        id={`transport-type-${segment.id}`}
                                                        name={`transport-type-${segment.id}`}
                                                        className="form__select"
                                                        value={segment.transportType || "AUV"}
                                                        onChange={(e) => updateSegmentField(segment.id, { transportType: e.target.value })}
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
                                                    {(segment.transportType === "AUV" || segment.transportType === "AUV-Z") ? (
                                                        <>
                                                            <label htmlFor={`kilometers-${segment.id}`} className="form__label">Kilometry</label>
                                                            <input
                                                                id={`kilometers-${segment.id}`}
                                                                name={`kilometers-${segment.id}`}
                                                                type="number"
                                                                className="form__input"
                                                                value={segment.kilometers || 0}
                                                                onChange={(e) => updateSegmentField(segment.id, { kilometers: Number(e.target.value) || 0 })}
                                                                min="0"
                                                                step="0.1"
                                                                disabled={isFormDisabled}
                                                            />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <label htmlFor={`ticket-costs-${segment.id}`} className="form__label">Náklady na jízdenky (Kč)</label>
                                                            <input
                                                                id={`ticket-costs-${segment.id}`}
                                                                name={`ticket-costs-${segment.id}`}
                                                                type="number"
                                                                className="form__input"
                                                                value={segment.ticketCosts || 0}
                                                                onChange={(e) => updateSegmentField(segment.id, { ticketCosts: Number(e.target.value) || 0 })}
                                                                min="0"
                                                                step="0.01"
                                                                disabled={isFormDisabled}
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* File uploads for public transport */}
                                            {segment.transportType === "veřejná doprava" && (
                                                <div className="mt-4">
                                                    <label className="form__label mb-2 block">Jízdenky a doklady</label>
                                                    <AdvancedFileUpload
                                                        id={`segment-${segment.id}`}
                                                        files={segment.attachments ?? []}
                                                        onFilesChange={(files) => updateSegmentField(segment.id, { attachments: files })}
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

                        {/* Add segment button */}
                        <div className="text-center mt-6">
                            <button
                                type="button"
                                className="btn btn--secondary"
                                onClick={addTravelSegment}
                                disabled={isFormDisabled}
                            >
                                <IconPlus size={16} className="mr-2" />
                                Přidat segment
                            </button>
                        </div>

                        {/* Driver settings - only show if there are car segments */}
                        {formData.travelSegments.some(s => s.transportType === "AUV" || s.transportType === "AUV-Z") && (
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <h5 className="text-md font-semibold mb-4">Nastavení řidiče</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="primary-driver" className="form__label">
                                            Primární řidič *
                                        </label>
                                        <select
                                            id="primary-driver"
                                            name="primary-driver"
                                            className="form__select"
                                            value={formData.primaryDriver || ""}
                                            onChange={(e) => setFormData(prev => ({ ...prev, primaryDriver: e.target.value }))}
                                            required
                                            disabled={isFormDisabled}
                                        >
                                            <option value="">Vyberte řidiče</option>
                                            {computedTeamMembers.map(member => (
                                                <option key={member.int_adr} value={member.int_adr}>
                                                    {member.name}{member.isLeader ? " (vedoucí)" : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="vehicle-registration" className="form__label">
                                            Registrační značka *
                                        </label>
                                        <input
                                            id="vehicle-registration"
                                            name="vehicle-registration"
                                            type="text"
                                            className="form__input"
                                            placeholder="např. 1A2 3456"
                                            value={formData.vehicleRegistration || ""}
                                            onChange={(e) => setFormData(prev => ({ ...prev, vehicleRegistration: e.target.value }))}
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

            {/* Accommodation */}
            <div className="card">
                <div className="card__content">
                    <h4 className="text-lg font-semibold mb-4">Nocležné</h4>

                    <div className="space-y-4">
                        {formData.accommodations.filter(acc => acc && acc.id).map((accommodation, index) => (
                            <div key={accommodation.id}>
                                {index > 0 && <hr className="my-4" />}
                                <div className="relative">
                                    <div className="absolute top-0 right-0 z-10">
                                        <button
                                            type="button"
                                            className="btn btn--icon btn--small btn--danger"
                                            onClick={() => removeAccommodation(accommodation.id)}
                                            title="Smazat nocležné"
                                            disabled={isFormDisabled}
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    </div>

                                    <div className="mr-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label htmlFor={`accommodation-place-${accommodation.id}`} className="form__label">Místo</label>
                                                <input
                                                    id={`accommodation-place-${accommodation.id}`}
                                                    name={`accommodation-place-${accommodation.id}`}
                                                    type="text"
                                                    className="form__input"
                                                    value={accommodation.place || ""}
                                                    onChange={(e) => updateAccommodation(accommodation.id, { place: e.target.value })}
                                                    disabled={isFormDisabled}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor={`accommodation-facility-${accommodation.id}`} className="form__label">Zařízení</label>
                                                <input
                                                    id={`accommodation-facility-${accommodation.id}`}
                                                    name={`accommodation-facility-${accommodation.id}`}
                                                    type="text"
                                                    className="form__input"
                                                    value={accommodation.facility || ""}
                                                    onChange={(e) => updateAccommodation(accommodation.id, { facility: e.target.value })}
                                                    disabled={isFormDisabled}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <label htmlFor={`accommodation-amount-${accommodation.id}`} className="form__label">Částka (Kč)</label>
                                                <input
                                                    id={`accommodation-amount-${accommodation.id}`}
                                                    name={`accommodation-amount-${accommodation.id}`}
                                                    type="number"
                                                    className="form__input"
                                                    value={accommodation.amount || 0}
                                                    onChange={(e) => updateAccommodation(accommodation.id, { amount: Number(e.target.value) || 0 })}
                                                    min="0"
                                                    step="0.01"
                                                    disabled={isFormDisabled}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor={`accommodation-paidby-${accommodation.id}`} className="form__label">Uhradil</label>
                                                <select
                                                    id={`accommodation-paidby-${accommodation.id}`}
                                                    name={`accommodation-paidby-${accommodation.id}`}
                                                    className="form__select"
                                                    value={accommodation.paidByMember || ""}
                                                    onChange={(e) => updateAccommodation(accommodation.id, { paidByMember: e.target.value })}
                                                    disabled={isFormDisabled}
                                                >
                                                    {computedTeamMembers.map(member => (
                                                        <option key={member.int_adr} value={member.int_adr}>
                                                            {member.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor={`accommodation-date-${accommodation.id}`} className="form__label">Datum</label>
                                                <input
                                                    id={`accommodation-date-${accommodation.id}`}
                                                    name={`accommodation-date-${accommodation.id}`}
                                                    type="date"
                                                    className="form__input"
                                                    value={formatDate(accommodation.date)}
                                                    onChange={(e) => updateAccommodation(accommodation.id, { date: parseDate(e.target.value) })}
                                                    disabled={isFormDisabled}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className="form__label mb-2 block">Doklady</label>
                                            <AdvancedFileUpload
                                                id={`accommodation-${accommodation.id}`}
                                                files={accommodation.attachments ?? []}
                                                onFilesChange={(files) => updateAccommodation(accommodation.id, { attachments: files })}
                                                maxFiles={5}
                                                accept="image/jpeg,image/png,image/heic,application/pdf"
                                                maxSize={10}
                                                storagePath={storagePath}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Add accommodation button */}
                        <div className="text-center mt-6">
                            <button
                                type="button"
                                className="btn btn--secondary"
                                onClick={addAccommodation}
                                disabled={isFormDisabled}
                            >
                                <IconPlus size={16} className="mr-2" />
                                Přidat nocležné
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Additional expenses */}
            <div className="card">
                <div className="card__content">
                    <h4 className="text-lg font-semibold mb-4">Vedlejší výdaje</h4>

                    <div className="space-y-4">
                        {formData.additionalExpenses.filter(exp => exp && exp.id).map((expense, index) => (
                            <div key={expense.id}>
                                {index > 0 && <hr className="my-4" />}
                                <div className="relative">
                                    <div className="absolute top-0 right-0 z-10">
                                        <button
                                            type="button"
                                            className="btn btn--icon btn--small btn--danger"
                                            onClick={() => removeExpense(expense.id)}
                                            title="Smazat výdaj"
                                            disabled={isFormDisabled}
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    </div>

                                    <div className="mr-10">
                                        <div className="mb-4">
                                            <label htmlFor={`expense-description-${expense.id}`} className="form__label">Popis výdaje</label>
                                            <input
                                                id={`expense-description-${expense.id}`}
                                                name={`expense-description-${expense.id}`}
                                                type="text"
                                                className="form__input"
                                                value={expense.description || ""}
                                                onChange={(e) => updateExpense(expense.id, { description: e.target.value })}
                                                disabled={isFormDisabled}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <label htmlFor={`expense-amount-${expense.id}`} className="form__label">Částka (Kč)</label>
                                                <input
                                                    id={`expense-amount-${expense.id}`}
                                                    name={`expense-amount-${expense.id}`}
                                                    type="number"
                                                    className="form__input"
                                                    value={expense.amount || 0}
                                                    onChange={(e) => updateExpense(expense.id, { amount: Number(e.target.value) || 0 })}
                                                    min="0"
                                                    step="0.01"
                                                    disabled={isFormDisabled}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor={`expense-paidby-${expense.id}`} className="form__label">Uhradil</label>
                                                <select
                                                    id={`expense-paidby-${expense.id}`}
                                                    name={`expense-paidby-${expense.id}`}
                                                    className="form__select"
                                                    value={expense.paidByMember || ""}
                                                    onChange={(e) => updateExpense(expense.id, { paidByMember: e.target.value })}
                                                    disabled={isFormDisabled}
                                                >
                                                    {computedTeamMembers.map(member => (
                                                        <option key={member.int_adr} value={member.int_adr}>
                                                            {member.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor={`expense-date-${expense.id}`} className="form__label">Datum</label>
                                                <input
                                                    id={`expense-date-${expense.id}`}
                                                    name={`expense-date-${expense.id}`}
                                                    type="date"
                                                    className="form__input"
                                                    value={formatDate(expense.date)}
                                                    onChange={(e) => updateExpense(expense.id, { date: parseDate(e.target.value) })}
                                                    disabled={isFormDisabled}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className="form__label mb-2 block">Doklady</label>
                                            <AdvancedFileUpload
                                                id={`expense-${expense.id}`}
                                                files={expense.attachments ?? []}
                                                onFilesChange={(files) => updateExpense(expense.id, { attachments: files })}
                                                maxFiles={5}
                                                accept="image/jpeg,image/png,image/heic,application/pdf"
                                                maxSize={10}
                                                storagePath={storagePath}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Add expense button */}
                        <div className="text-center mt-6">
                            <button
                                type="button"
                                className="btn btn--secondary"
                                onClick={addExpense}
                                disabled={isFormDisabled}
                            >
                                <IconPlus size={16} className="mr-2" />
                                Přidat výdaj
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Redirects */}
            <PaymentRedirectsForm
                paymentRedirects={formData.paymentRedirects}
                onPaymentRedirectsChange={handlePaymentRedirectsChange}
                teamMembers={computedTeamMembers}
                currentUser={currentUser}
                isLeader={isLeader}
                disabled={isFormDisabled}
            />
        </div>
    );
};