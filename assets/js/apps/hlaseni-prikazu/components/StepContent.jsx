import React from 'react';
import {
    IconDeviceFloppy,
    IconSend,
    IconReportMoney,
    IconRoute
} from '@tabler/icons-react';
import { Loader } from '../../../components/shared/Loader';
import ErrorBoundary from '../../../components/shared/ErrorBoundary';
import { PartAForm } from './PartAForm';
import { PartBForm } from './PartBForm';
import { CompensationSummary } from './CompensationSummary';
import { PartBSummary } from './PartBSummary';
import { AdvancedFileUpload } from '../../../components/shared/forms/AdvancedFileUpload';
import { getAttachmentsAsArray, setAttachmentsFromArray } from '../utils/attachmentUtils';
import { calculateExecutionDate } from '../utils/compensationCalculator';
import { useCompletionStatus } from '../hooks/useCompletionStatus';
import { ValidationMessages } from './ValidationMessages';

// Import debug funkcí
const isDebugMode = () => {
    const element = document.querySelector('[data-debug]');
    return element?.dataset?.debug === 'true' || false;
};

export const StepContent = ({
    data,
    setFormData,
    activeStep,
    onStepChange,
    onSave,
    onSubmit,
    saving,
    prikazId,
    reportId,
    getNextId
}) => {
    // Rozbalení dat z jednoho objektu
    const formData = data.formData;
    
    // Early return if formData is not ready
    if (!formData) {
        return (
            <div className="card">
                <div className="card__content">
                    <div className="loader">Loading...</div>
                </div>
            </div>
        );
    }
    const head = data.head;
    const useky = data.useky;
    const predmety = data.predmety;
    const tariffRates = data.tariffRates;
    const teamMembers = data.teamMembers;
    const isLeader = data.isLeader;
    const disabled = !data.canEdit;
    const canEditOthers = data.isLeader;
    const currentUser = data.currentUser;
    const tariffRatesLoading = false;
    const tariffRatesError = null;
    const fileUploadService = null;
    const polling = data.polling || null;
    
    // Použití centralizované validace
    const { 
        canCompletePartA, 
        canCompletePartB,
        partAValidation,
        partBValidation,
        getValidationMessages
    } = useCompletionStatus(formData, head, predmety, setFormData);
    // Generate storage path for route attachments
    const storagePath = React.useMemo(() => {
        if (!prikazId) return null;
        
        const year = calculateExecutionDate(formData).getFullYear();
        const kkz = head?.KKZ?.toString().trim() || 'unknown';
        const obvod = head?.ZO?.toString().trim() || 'unknown';
        const sanitizedPrikazId = prikazId?.toString().trim() || 'unknown';
        
        const validYear = (year >= 2020 && year <= 2030) ? year : new Date().getFullYear();
        
        return `reports/${validYear}/${kkz}/${obvod}/${sanitizedPrikazId}`;
    }, [prikazId, formData, head]);
    // Step 0 - Part A
    if (activeStep === 0) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main form */}
                <div className="lg:col-span-2">
                    <PartAForm
                        formData={formData}
                        setFormData={setFormData}
                        tariffRates={tariffRates}
                        head={head}
                        fileUploadService={fileUploadService}
                        currentUser={currentUser}
                        teamMembers={teamMembers}
                        isLeader={isLeader}
                        canEditOthers={canEditOthers}
                        prikazId={prikazId}
                        getNextId={getNextId}
                        reportId={reportId}
                        disabled={disabled}
                    />
                    
                    <ValidationMessages 
                        validationResult={partAValidation}
                        canComplete={canCompletePartA}
                        className="mt-4"
                    />

                    {/* Navigation */}
                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            className="btn btn--secondary"
                            onClick={onSave}
                            disabled={saving}
                        >
                            {saving ? <Loader size="small" center={false}/> : <IconDeviceFloppy/>} Uložit změny
                        </button>
                        <button
                            className="btn btn--primary"
                            onClick={() => onStepChange(1)}
                        >
                            Pokračovat na část B
                        </button>
                    </div>
                </div>

                {/* Sidebar with compensation summary */}
                <div className="lg:col-span-1">
                    <div className="sticky top-4">
                        <div className="card">
                            <div className="card__header">
                                <div className="flex items-center gap-2">
                                    <IconReportMoney size={20}/>
                                    <h4 className="card__title">Výpočet náhrad</h4>
                                </div>
                            </div>
                            <div className="card__content">
                                <ErrorBoundary sectionName="Výpočet náhrad">
                                    <CompensationSummary
                                        formData={formData}
                                        tariffRates={tariffRates}
                                        tariffRatesLoading={tariffRatesLoading}
                                        tariffRatesError={tariffRatesError}
                                        compact={true}
                                        isLeader={isLeader}
                                        teamMembers={teamMembers}
                                        currentUser={currentUser}
                                        head={head}
                                    />
                                </ErrorBoundary>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Step 1 - Part B
    if (activeStep === 1) {
        return (
            <div>
                {head?.Druh_ZP === "O" ? (
                    <PartBForm
                        formData={formData}
                        setFormData={setFormData}
                        head={head}
                        useky={useky}
                        predmety={predmety}
                        prikazId={prikazId}
                        reportId={reportId}
                        disabled={disabled}
                    />
                ) : (
                    <div className="space-y-6">
                        <h4 className="text-lg font-semibold">Hlášení o značkařské činnosti</h4>

                        <div>
                            <label className="form__label font-medium mb-2 block">
                                Hlášení o provedené činnosti
                            </label>
                            <p className="text-sm text-gray-600 mb-2">
                                Popište provedenou značkařskou činnost, stav značení, případné problémy a
                                návrhy na zlepšení.
                            </p>
                            <textarea
                                className="form__textarea"
                                placeholder="Popište provedenou značkařskou činnost..."
                                value={formData.Koment_Usek || ""}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    Koment_Usek: e.target.value
                                }))}
                                rows={6}
                                disabled={disabled}
                            />
                        </div>

                        <div>
                            <label className="form__label font-medium mb-2 block">
                                Fotografické přílohy
                            </label>
                            <p className="text-sm text-gray-600 mb-2">
                                Přiložte fotografie dokumentující provedenou činnost, stav značení,
                                problémová místa apod.
                            </p>
                            <AdvancedFileUpload
                                id="hlaseni-route-attachments"
                                files={getAttachmentsAsArray(formData.Prilohy_Usek || {})}
                                onFilesChange={(files) => setFormData(prev => ({
                                    ...prev,
                                    Prilohy_Usek: setAttachmentsFromArray(files)
                                }))}
                                maxFiles={20}
                                accept="image/jpeg,image/png,image/heic,application/pdf"
                                disabled={disabled}
                                maxSize={15}
                                storagePath={storagePath}
                                // File usage tracking
                                usageType="reports"
                                entityId={reportId}
                            />
                        </div>
                    </div>
                )}

                {/* Validační zprávy pro část B */}
                <ValidationMessages 
                    validationResult={partBValidation}
                    canComplete={canCompletePartB}
                    className="mt-6"
                />

                {/* Navigation */}
                <div className="flex justify-between mt-6">
                    <button
                        className="btn btn--secondary"
                        onClick={() => onStepChange(0)}
                    >
                        Zpět na část A
                    </button>

                    <div className="flex gap-2">
                        <button
                            className="btn btn--secondary"
                            onClick={onSave}
                            disabled={saving}
                        >
                            {saving ? <Loader size="small" center={false}/> : <IconDeviceFloppy/>} Uložit změny
                        </button>
                        <button
                            className="btn btn--primary"
                            onClick={() => onStepChange(2)}
                        >
                            Pokračovat k odeslání
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Step 2 - Summary and submission
    if (activeStep === 2) {
        return (
            <div className="space-y-6">
                {/* Summary Part A */}
                <div className="card">
                    <div className="card__header">
                        <div className="flex items-center gap-2">
                            <IconRoute size={20}/>
                            <h4 className="card__title">Souhrn části A - Vyúčtování</h4>
                            <span className={`badge ${formData.Cast_A_Dokoncena ? 'badge--success' : 'badge--danger'}`}>
                                {formData.Cast_A_Dokoncena ? "Dokončeno" : "Nedokončeno"}
                            </span>
                        </div>
                    </div>
                    <div className="card__content">

                        <p>
                            Datum provedení: <span className="font-bold">{calculateExecutionDate(formData).toLocaleDateString('cs-CZ')}</span>
                        </p>
                        
                        {/* Validační zprávy pro část A */}
                        <ValidationMessages 
                            validationResult={partAValidation}
                            canComplete={canCompletePartA}
                            partName="A"
                        />
                        
                        <CompensationSummary
                            formData={formData}
                            tariffRates={tariffRates}
                            tariffRatesLoading={tariffRatesLoading}
                            tariffRatesError={tariffRatesError}
                            compact={false}
                            isLeader={isLeader}
                            teamMembers={teamMembers}
                            currentUser={currentUser}
                            head={head}
                        />
                    </div>
                </div>

                {/* Summary Part B */}
                <div className="card">
                    <div className="card__header">
                        <div className="flex items-center gap-2">
                            <h4 className="card__title">Souhrn části B</h4>
                            <span className={`badge ${formData.Cast_B_Dokoncena ? 'badge--success' : 'badge--danger'}`}>
                                {formData.Cast_B_Dokoncena ? "Dokončeno" : "Nedokončeno"}
                            </span>
                        </div>
                    </div>
                    <div className="card__content">
                        {/* Validační zprávy pro část B */}
                        <ValidationMessages 
                            validationResult={partBValidation}
                            canComplete={canCompletePartB}
                            partName="B"
                        />
                        
                        <ErrorBoundary sectionName="Souhrn části B">
                            <PartBSummary 
                                formData={formData} 
                                head={head}
                                predmety={predmety}
                                showValidation={true}
                                compact={false}
                            />
                        </ErrorBoundary>
                    </div>
                </div>

                {/* Submission */}
                <div className="card border-l-4 border-blue-500 bg-gray-50">
                    <div className="card__content">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <IconSend size={20}/>
                                <h4 className="text-lg font-semibold">Potvrzení odeslání</h4>
                            </div>

                            {/* Status dependent alerts */}
                            {formData.status === 'draft' && (
                                <div className="alert alert--info">
                                    Zkontrolujte prosím všechny údaje před odesláním. Po odeslání již nebude možné
                                    hlášení upravovat.
                                </div>
                            )}
                            
                            {formData.status === 'send' && (
                                <div className="alert alert--warning">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Loader size="small" center={false} color="orange-600" />
                                            <strong>Odesílání do INSYZ probíhá...</strong>
                                        </div>
                                        {polling?.isPolling && (
                                            <div className="text-xs text-orange-700 dark:text-orange-300">
                                                Kontrola {polling.pollCount}/{polling.maxAttempts}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        <p className="text-sm">
                                            Hlášení bylo uloženo a odesílá se do systému INSYZ. 
                                            Proces může trvat několik minut. Formulář je dočasně uzamčen.
                                        </p>
                                        {formData.date_send && (
                                            <p className="text-xs text-orange-700 dark:text-orange-300">
                                                Odesláno: {new Date(formData.date_send).toLocaleString('cs-CZ')}
                                            </p>
                                        )}
                                    </div>
                                    {polling?.isPolling && (
                                        <div className="mt-3">
                                            <div className="flex items-center justify-between text-xs text-orange-600 dark:text-orange-400">
                                                <span>Automatická kontrola každých {polling.interval}s</span>
                                                <button 
                                                    className="btn btn--sm btn--secondary"
                                                    onClick={polling.stopPolling}
                                                >
                                                    Zastavit kontrolu
                                                </button>
                                            </div>
                                            <div className="w-full bg-orange-200 dark:bg-orange-800 rounded-full h-1.5 mt-2">
                                                <div 
                                                    className="bg-orange-600 h-1.5 rounded-full transition-all duration-300" 
                                                    style={{ width: `${(polling.pollCount / polling.maxAttempts) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {formData.status === 'submitted' && (
                                <div className="alert alert--success">
                                    <strong>Hlášení bylo úspěšně přijato</strong>
                                    <p className="mt-2 text-sm">
                                        Hlášení bylo úspěšně přijato systémem INSYZ a nyní čeká na schválení.
                                    </p>
                                </div>
                            )}
                            
                            {formData.status === 'approved' && (
                                <div className="alert alert--success">
                                    <strong>Hlášení bylo schváleno</strong>
                                    <p className="mt-2 text-sm">
                                        Hlášení bylo úspěšně schváleno v systému INSYZ.
                                    </p>
                                </div>
                            )}
                            
                            {formData.status === 'rejected' && (
                                <div className="alert alert--danger">
                                    <strong>Hlášení bylo zamítnuto</strong>
                                    <p className="mt-2 text-sm">
                                        Došlo k chybě při odesílání do INSYZ nebo bylo hlášení zamítnuto. Můžete hlášení opravit a odeslat znovu.
                                    </p>
                                    {formData.error_message && (
                                        <div className="mt-3">
                                            <p className="text-sm font-medium text-red-800 mb-1">Detaily chyby:</p>
                                            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                                                <p className="text-sm font-mono text-red-700 dark:text-red-300">
                                                    {formData.error_message}
                                                </p>
                                                {formData.error_code && (
                                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                                        Kód chyby: {formData.error_code}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-3">
                                        <p className="text-sm text-red-700 dark:text-red-300">
                                            <strong>Co můžete udělat:</strong>
                                        </p>
                                        <ul className="text-sm text-red-600 dark:text-red-400 mt-1 ml-4 list-disc">
                                            <li>Zkontrolujte všechny vyplněné údaje</li>
                                            <li>Ověřte připojení k internetu</li>
                                            <li>Zkuste odeslat znovu za chvíli</li>
                                            <li>V případě opakovaných problémů kontaktujte administrátora</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between">
                                <button
                                    className="btn btn--secondary"
                                    onClick={() => onStepChange(1)}
                                    disabled={disabled}
                                >
                                    {formData.status === 'rejected' ? 'Upravit a odeslat znovu' : 'Zpět na úpravy'}
                                </button>

                                <button
                                    className="btn btn--primary btn--large"
                                    disabled={saving || disabled}
                                    onClick={onSubmit}
                                >
                                    <IconSend size={20} className="mr-2"/>
                                    {saving ? 'Odesílání...' : 
                                     formData.status === 'send' ? 'Odesílá se do INSYZ...' :
                                     formData.status === 'submitted' ? 'Odesláno' :
                                     'Odeslat ke schválení'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};