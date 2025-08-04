import React from 'react';
import {
    IconDeviceFloppy,
    IconSend,
    IconReportMoney,
    IconRoute,
    IconInfoCircle
} from '@tabler/icons-react';
import { Loader } from '../../../components/shared/Loader';
import ErrorBoundary from '../../../components/shared/ErrorBoundary';
import { PartAForm } from './PartAForm';
import { PartBForm } from './PartBForm';
import { CompensationSummary } from './CompensationSummary';
import { AdvancedFileUpload } from './AdvancedFileUpload';
import { SimpleFileUpload } from './SimpleFileUpload';

export const StepContent = ({
    activeStep,
    formData,
    setFormData,
    head,
    useky,
    predmety,
    priceList,
    priceListLoading,
    priceListError,
    currentUser,
    teamMembers,
    isLeader,
    canEditOthers,
    prikazId,
    canCompletePartA,
    canCompletePartB,
    onStepChange,
    onSave,
    onSubmit,
    saving,
    fileUploadService
}) => {
    // Step 0 - Part A
    if (activeStep === 0) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main form */}
                <div className="lg:col-span-2">
                    <PartAForm
                        formData={formData}
                        setFormData={setFormData}
                        priceList={priceList}
                        head={head}
                        fileUploadService={fileUploadService}
                        currentUser={currentUser}
                        teamMembers={teamMembers}
                        isLeader={isLeader}
                        canEditOthers={canEditOthers}
                        prikazId={prikazId}
                    />
                    
                    {!canCompletePartA && (
                        <div className="alert alert--warning mt-4">
                            Vyplňte všechny povinné údaje
                        </div>
                    )}

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
                                        priceList={priceList}
                                        priceListLoading={priceListLoading}
                                        priceListError={priceListError}
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
                                disabled={formData.status === 'submitted'}
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
                            <SimpleFileUpload
                                id="hlaseni-route-attachments"
                                files={formData.Prilohy_Usek || []}
                                onFilesChange={(files) => setFormData(prev => ({
                                    ...prev,
                                    Prilohy_Usek: files
                                }))}
                                maxFiles={20}
                                accept="image/jpeg,image/png,image/heic,application/pdf"
                                disabled={formData.status === 'submitted'}
                                maxSize={15}
                            />
                        </div>
                    </div>
                )}

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
                        </div>
                    </div>
                    <div className="card__content">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Datum provedení:</span>
                                    <span className="text-sm">{formData.Datum_Provedeni.toLocaleDateString('cs-CZ')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Počet segmentů dopravy:</span>
                                    <span className="text-sm">{(formData.Skupiny_Cest?.reduce((total, group) => total + (group.Cesty?.length || 0), 0) || 0)}</span>
                                </div>
                                {formData.Hlavni_Ridic && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Řidič:</span>
                                        <span className="text-sm">{formData.Hlavni_Ridic}</span>
                                    </div>
                                )}
                                {formData.SPZ && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">SPZ vozidla:</span>
                                        <span className="text-sm">{formData.SPZ}</span>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Ubytování:</span>
                                    <span className="text-sm">{formData.Noclezne.length} nocí</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Dodatečné výdaje:</span>
                                    <span className="text-sm">{formData.Vedlejsi_Vydaje.length} položek</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Stav části A:</span>
                                    <span className={`inline-block px-2 py-1 text-xs rounded ${formData.Cast_A_Dokoncena ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {formData.Cast_A_Dokoncena ? "Dokončeno" : "Nedokončeno"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Part B */}
                <div className="card">
                    <div className="card__header">
                        <div className="flex items-center gap-2">
                            <IconInfoCircle size={20}/>
                            <h4 className="card__title">
                                Souhrn části B - {head?.Druh_ZP === "O" ? "Stavy TIM" : "Hlášení o činnosti"}
                            </h4>
                        </div>
                    </div>
                    <div className="card__content">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                {head?.Druh_ZP === "O" ? (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Počet TIM:</span>
                                        <span className="text-sm">{Object.keys(formData.Stavy_Tim).length}</span>
                                    </div>
                                ) : (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Hlášení vyplněno:</span>
                                        <span className="text-sm">{formData.Koment_Usek?.trim().length > 0 ? "Ano" : "Ne"}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Stav části B:</span>
                                    <span className={`inline-block px-2 py-1 text-xs rounded ${formData.Cast_B_Dokoncena ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {formData.Cast_B_Dokoncena ? "Dokončeno" : "Nedokončeno"}
                                    </span>
                                </div>
                            </div>
                            <div>
                                {formData.Koment_Usek && (
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">
                                            {head?.Druh_ZP === "O" ? "Poznámka k trase:" : "Hlášení o činnosti:"}
                                        </p>
                                        <p className="text-sm">{formData.Koment_Usek}</p>
                                    </div>
                                )}
                                {formData.Prilohy_Usek && formData.Prilohy_Usek.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-600 mb-1">Počet příloh:</p>
                                        <p className="text-sm">{formData.Prilohy_Usek.length}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Complete compensation summary */}
                <div className="card">
                    <div className="card__header">
                        <div className="flex items-center gap-2">
                            <IconReportMoney size={20}/>
                            <h4 className="card__title">Celkový výpočet náhrad</h4>
                        </div>
                    </div>
                    <div className="card__content">
                        <ErrorBoundary sectionName="Celkový výpočet náhrad">
                            <CompensationSummary
                                formData={formData}
                                priceList={priceList}
                                priceListLoading={priceListLoading}
                                priceListError={priceListError}
                                compact={false}
                                isLeader={isLeader}
                                teamMembers={teamMembers}
                                currentUser={currentUser}
                                head={head}
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

                            <div className="alert alert--info">
                                Zkontrolujte prosím všechny údaje před odesláním. Po odeslání již nebude možné
                                hlášení upravovat.
                            </div>

                            <div className="flex justify-between">
                                <button
                                    className="btn btn--secondary"
                                    onClick={() => onStepChange(1)}
                                >
                                    Zpět na úpravy
                                </button>

                                <button
                                    className="btn btn--primary btn--large"
                                    disabled={!canCompletePartA || !canCompletePartB || saving}
                                    onClick={onSubmit}
                                >
                                    <IconSend size={20} className="mr-2"/>
                                    {saving ? 'Odesílání...' : 'Odeslat ke schválení'}
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