import React, { useMemo } from 'react';
import {
    IconPlus,
    IconTrash
} from '@tabler/icons-react';
import { PaymentRedirectsForm } from './PaymentRedirectsForm';
import { AdvancedFileUpload } from './AdvancedFileUpload';
import { TravelGroupsForm } from './TravelGroupsForm';
import ErrorBoundary from '../../../components/shared/ErrorBoundary';
import { 
    getAttachmentsAsArray, 
    setAttachmentsFromArray 
} from '../utils/attachmentUtils';
import { calculateExecutionDate } from '../utils/compensationCalculator';
import { generateUsageType, generateEntityId } from '../utils/fileUsageUtils';


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
    disabled = false 
}) => {
    // Team members - use prop if provided, otherwise calculate from head data (original logic)
    const computedTeamMembers = useMemo(() => {
        if (teamMembers && teamMembers.length > 0) {
            return teamMembers;
        }
        if (!head) {
            return [];
        }
        const computed = [1, 2, 3]
            .map(i => ({
                index: i,
                name: head[`Znackar${i}`],
                INT_ADR: head[`INT_ADR_${i}`],
                isLeader: head[`Je_Vedouci${i}`] === "1"
            }))
            .filter(member => member.name?.trim());
            
        return computed;
    }, [teamMembers, head]);

    // Get unique drivers across all travel groups
    const uniqueDrivers = useMemo(() => {
        if (!formData.Skupiny_Cest || formData.Skupiny_Cest.length === 0) {
            return computedTeamMembers;
        }
        
        const driverIds = new Set();
        formData.Skupiny_Cest.forEach(group => {
            if (group.Ridic) {
                driverIds.add(group.Ridic);
            }
        });
        
        return computedTeamMembers.filter(member => driverIds.has(member.INT_ADR));
    }, [formData.Skupiny_Cest, computedTeamMembers]);

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
            Misto: "",
            Zarizeni: "",
            Datum: calculateExecutionDate(formData),
            Castka: 0,
            Zaplatil: computedTeamMembers[0]?.INT_ADR || "",
            Prilohy: {}
        };

        setFormData(prev => ({
            ...prev,
            Noclezne: [...(prev.Noclezne || []), newAccommodation]
        }));
    };

    const updateAccommodation = (accommodationId, updates) => {
        setFormData(prev => ({
            ...prev,
            Noclezne: (prev.Noclezne || []).map(acc =>
                acc.id === accommodationId ? { ...acc, ...updates } : acc
            )
        }));
    };

    const removeAccommodation = (accommodationId) => {
        setFormData(prev => ({
            ...prev,
            Noclezne: (prev.Noclezne || []).filter(acc => acc.id !== accommodationId)
        }));
    };

    // Expense functions (from original)
    const addExpense = () => {
        const newExpense = {
            id: crypto.randomUUID(),
            Polozka: "",
            Castka: 0,
            Zaplatil: computedTeamMembers[0]?.INT_ADR || "",
            Prilohy: {}
        };

        setFormData(prev => ({
            ...prev,
            Vedlejsi_Vydaje: [...(prev.Vedlejsi_Vydaje || []), newExpense]
        }));
    };

    const updateExpense = (expenseId, updates) => {
        setFormData(prev => ({
            ...prev,
            Vedlejsi_Vydaje: (prev.Vedlejsi_Vydaje || []).map(exp =>
                exp.id === expenseId ? { ...exp, ...updates } : exp
            )
        }));
    };

    const removeExpense = (expenseId) => {
        setFormData(prev => ({
            ...prev,
            Vedlejsi_Vydaje: (prev.Vedlejsi_Vydaje || []).filter(exp => exp.id !== expenseId)
        }));
    };




    // Handler functions for payment redirects
    const handlePresmerovanivyplatChange = (Presmerovani_Vyplat) => {
        setFormData(prev => ({ ...prev, Presmerovani_Vyplat }));
    };


    return (
        <div className="space-y-6">
            {/* Travel Groups */}
            <ErrorBoundary sectionName="Segmenty cest">
                <TravelGroupsForm
                formData={formData}
                setFormData={setFormData}
                priceList={priceList}
                head={head}
                teamMembers={computedTeamMembers}
                prikazId={prikazId}
                fileUploadService={fileUploadService}
                currentUser={currentUser}
                disabled={disabled}
            />
            </ErrorBoundary>

            {/* Accommodation */}
            <ErrorBoundary sectionName="Nocležné">
                <div className="card">
                <div className="card__content">
                    <h4 className="text-lg font-semibold mb-4">Nocležné</h4>

                    <div className="space-y-4">
                        {(formData.Noclezne || []).filter(acc => acc && acc.id).map((accommodation, index) => (
                            <div key={accommodation.id}>
                                {index > 0 && <hr className="my-4" />}
                                <div className="relative">
                                    <div className="absolute top-0 right-0 z-10">
                                        <button
                                            type="button"
                                            className="btn btn--icon btn--small btn--danger"
                                            onClick={() => removeAccommodation(accommodation.id)}
                                            title="Smazat nocležné"
                                            disabled={disabled}
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
                                                    value={accommodation.Misto || ""}
                                                    onChange={(e) => updateAccommodation(accommodation.id, { Misto: e.target.value })}
                                                    disabled={disabled}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor={`accommodation-facility-${accommodation.id}`} className="form__label">Zařízení</label>
                                                <input
                                                    id={`accommodation-facility-${accommodation.id}`}
                                                    name={`accommodation-facility-${accommodation.id}`}
                                                    type="text"
                                                    className="form__input"
                                                    value={accommodation.Zarizeni || ""}
                                                    onChange={(e) => updateAccommodation(accommodation.id, { Zarizeni: e.target.value })}
                                                    disabled={disabled}
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
                                                    value={accommodation.Castka || 0}
                                                    onChange={(e) => updateAccommodation(accommodation.id, { Castka: Number(e.target.value) || 0 })}
                                                    min="0"
                                                    step="0.01"
                                                    disabled={disabled}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor={`accommodation-paidby-${accommodation.id}`} className="form__label">Uhradil</label>
                                                <select
                                                    id={`accommodation-paidby-${accommodation.id}`}
                                                    name={`accommodation-paidby-${accommodation.id}`}
                                                    className="form__select"
                                                    value={accommodation.Zaplatil || ""}
                                                    onChange={(e) => updateAccommodation(accommodation.id, { Zaplatil: e.target.value })}
                                                    disabled={disabled}
                                                >
                                                    {computedTeamMembers.map(member => (
                                                        <option key={member.INT_ADR} value={member.INT_ADR}>
                                                            {member.name || member.Znackar}
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
                                                    value={formatDate(accommodation.Datum)}
                                                    onChange={(e) => updateAccommodation(accommodation.id, { Datum: parseDate(e.target.value) })}
                                                    disabled={disabled}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className="form__label mb-2 block">Doklady</label>
                                            <AdvancedFileUpload
                                                id={`accommodation-${accommodation.id}`}
                                                files={getAttachmentsAsArray(accommodation.Prilohy || {})}
                                                onFilesChange={(files) => updateAccommodation(accommodation.id, { Prilohy: setAttachmentsFromArray(files) })}
                                                maxFiles={5}
                                                accept="image/jpeg,image/png,image/heic,application/pdf"
                                                maxSize={10}
                                                storagePath={storagePath}
                                                // File usage tracking
                                                usageType={generateUsageType('accommodation', prikazId)}
                                                entityId={generateEntityId(prikazId, accommodation.id)}
                                                usageData={{
                                                    section: 'accommodation',
                                                    accommodationId: accommodation.id,
                                                    reportId: prikazId
                                                }}
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
                                disabled={disabled}
                            >
                                <IconPlus size={16} className="mr-2" />
                                Přidat nocležné
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </ErrorBoundary>

            {/* Additional expenses */}
            <ErrorBoundary sectionName="Vedlejší výdaje">
                <div className="card">
                <div className="card__content">
                    <h4 className="text-lg font-semibold mb-4">Vedlejší výdaje</h4>

                    <div className="space-y-4">
                        {(formData.Vedlejsi_Vydaje || []).filter(exp => exp && exp.id).map((expense, index) => (
                            <div key={expense.id}>
                                {index > 0 && <hr className="my-4" />}
                                <div className="relative">
                                    <div className="absolute top-0 right-0 z-10">
                                        <button
                                            type="button"
                                            className="btn btn--icon btn--small btn--danger"
                                            onClick={() => removeExpense(expense.id)}
                                            title="Smazat výdaj"
                                            disabled={disabled}
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
                                                value={expense.Polozka || ""}
                                                onChange={(e) => updateExpense(expense.id, { Polozka: e.target.value })}
                                                disabled={disabled}
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
                                                    value={expense.Castka || 0}
                                                    onChange={(e) => updateExpense(expense.id, { Castka: Number(e.target.value) || 0 })}
                                                    min="0"
                                                    step="0.01"
                                                    disabled={disabled}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor={`expense-paidby-${expense.id}`} className="form__label">Uhradil</label>
                                                <select
                                                    id={`expense-paidby-${expense.id}`}
                                                    name={`expense-paidby-${expense.id}`}
                                                    className="form__select"
                                                    value={expense.Zaplatil || ""}
                                                    onChange={(e) => updateExpense(expense.id, { Zaplatil: e.target.value })}
                                                    disabled={disabled}
                                                >
                                                    {computedTeamMembers.map(member => (
                                                        <option key={member.INT_ADR} value={member.INT_ADR}>
                                                            {member.name || member.Znackar}
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
                                                    value={formatDate(expense.Datum)}
                                                    onChange={(e) => updateExpense(expense.id, { Datum: parseDate(e.target.value) })}
                                                    disabled={disabled}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className="form__label mb-2 block">Doklady</label>
                                            <AdvancedFileUpload
                                                id={`expense-${expense.id}`}
                                                files={getAttachmentsAsArray(expense.Prilohy || {})}
                                                onFilesChange={(files) => updateExpense(expense.id, { Prilohy: setAttachmentsFromArray(files) })}
                                                maxFiles={5}
                                                accept="image/jpeg,image/png,image/heic,application/pdf"
                                                maxSize={10}
                                                storagePath={storagePath}
                                                // File usage tracking
                                                usageType={generateUsageType('expense', prikazId)}
                                                entityId={generateEntityId(prikazId, expense.id)}
                                                usageData={{
                                                    section: 'expense',
                                                    expenseId: expense.id,
                                                    reportId: prikazId
                                                }}
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
                                disabled={disabled}
                            >
                                <IconPlus size={16} className="mr-2" />
                                Přidat výdaj
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </ErrorBoundary>

            {/* Payment Redirects */}
            <ErrorBoundary sectionName="Přesměrování výplat">
                <PaymentRedirectsForm
                Presmerovani_Vyplat={formData.Presmerovani_Vyplat || {}}
                onPresmerovanivyplatChange={handlePresmerovanivyplatChange}
                teamMembers={computedTeamMembers}
                currentUser={currentUser}
                isLeader={isLeader}
                disabled={disabled}
            />
            </ErrorBoundary>
        </div>
    );
};