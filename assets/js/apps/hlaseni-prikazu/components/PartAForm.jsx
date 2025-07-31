import React, { useMemo } from 'react';
import {
    IconPlus,
    IconTrash
} from '@tabler/icons-react';
import { BasicInfoForm } from './BasicInfoForm';
import { PaymentRedirectsForm } from './PaymentRedirectsForm';
import { AdvancedFileUpload } from './AdvancedFileUpload';
import { TravelGroupsForm } from './TravelGroupsForm';


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
                teamMembers={computedTeamMembers}
                currentUser={currentUser}
                isLeader={isLeader}
                canEditOthers={canEditOthers}
                disabled={isFormDisabled}
            />

            {/* Travel Groups */}
            <TravelGroupsForm
                formData={formData}
                setFormData={setFormData}
                priceList={priceList}
                head={head}
                teamMembers={computedTeamMembers}
                prikazId={prikazId}
                fileUploadService={fileUploadService}
                currentUser={currentUser}
            />

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