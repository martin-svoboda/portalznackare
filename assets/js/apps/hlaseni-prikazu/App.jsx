import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader } from '../../components/shared/Loader';
import { PrikazHead } from '../../components/prikazy/PrikazHead';
import { StepNavigation } from './components/StepNavigation';
import { StepContent } from './components/StepContent';
import {
    extractTeamMembers,
    isUserLeader
} from './utils/compensationCalculator';
import { api } from '../../utils/api';
import { log } from '../../utils/debug';
import { useOrderData } from './hooks/useOrderData';
import { usePriceList } from './hooks/usePriceList';
import { useFormState } from './hooks/useFormState';
import { useStepNavigation } from './hooks/useStepNavigation';
import { useCompletionStatus } from './hooks/useCompletionStatus';
import { useFormSaving } from './hooks/useFormSaving';
import { useStatusPolling } from './hooks/useStatusPolling';
import { migrateAttachmentsToObjectStructure } from './utils/attachmentUtils';

const App = () => {
    // Get prikaz ID from data attribute
    const container = document.querySelector('[data-app="hlaseni-prikazu"]');
    const prikazId = container?.dataset?.prikazId;

    // Get current user from data attribute (set by Twig template)
    const currentUser = container?.dataset?.user ? JSON.parse(container.dataset.user) : null;

    // Order data loading
    const { head, predmety, useky, loading } = useOrderData(prikazId);
    
    // Memoizované členy týmu z hlavičky
    const membersFromHead = useMemo(() => {
        if (!head) return [];
        return extractTeamMembers(head);
    }, [head?.Znackar1, head?.Znackar2, head?.Znackar3, head?.INT_ADR_1, head?.INT_ADR_2, head?.INT_ADR_3]);
    
    // Form state management
    const { formData, setFormData, loadFormData } = useFormState();
    
    // Step navigation
    const { activeStep, changeStep } = useStepNavigation();
    
    // Additional state
    const [reportLoaded, setReportLoaded] = useState(false);
    const [teamMembers, setTeamMembers] = useState([]);
    const [isLeader, setIsLeader] = useState(false);
    const [canEditOthers, setCanEditOthers] = useState(false);
    
    // Price list loading (depends on formData.datumProvedeni)
    const { priceList, loading: priceListLoading, error: priceListError } = usePriceList(
        formData.Datum_Provedeni,
        reportLoaded
    );

    // Completion status management
    const {
        canCompletePartA,
        canCompletePartB
    } = useCompletionStatus(formData, head, predmety, setFormData);

    // Form saving
    const { saving, saveDraft, submitReport, submitForApproval } = useFormSaving(
        formData, 
        head, 
        prikazId, 
        priceList, 
        isLeader, 
        teamMembers, 
        currentUser,
        reportLoaded
    );

    // Status polling pro sledování zpracování
    const { 
        isPolling, 
        pollCount, 
        startPolling, 
        stopPolling, 
        maxAttempts, 
        interval 
    } = useStatusPolling(
        prikazId, 
        formData, 
        setFormData, 
        reportLoaded && formData.status === 'send'
    );

    // Load existing report data
    const loadReportData = useCallback(async () => {
        if (!prikazId) {
            setReportLoaded(true);
            return;
        }

        try {
            const result = await api.prikazy.report(prikazId);
            if (result && (result.dataA || result.dataB || result.znackari)) {
                const loadedData = {};

                // Load Part A (using czech keys)
                if (result.data_a) {
                    Object.assign(loadedData, result.data_a);
                    // Convert dates
                    if (loadedData.Datum_Provedeni) {
                        const execDate = new Date(loadedData.Datum_Provedeni);
                        loadedData.Datum_Provedeni = isNaN(execDate.getTime()) ? new Date() : execDate;
                    }
                    if (loadedData.Skupiny_Cest && Array.isArray(loadedData.Skupiny_Cest)) {
                        loadedData.Skupiny_Cest = loadedData.Skupiny_Cest.map((group, index) => ({
                            ...group,
                            Cestujci: group.Cestujci || group.participants || [], // Migrace: participants → Cestujci
                            Ridic: group.Ridic || group.driver || null, // Migrace: driver → Ridic
                            spz: group.spz || "",
                            // Migrace: přidat Ma_Zvysenou_Sazbu pokud chybí
                            // První řidič dostane true pokud je příkaz se zvýšenou sazbou
                            Ma_Zvysenou_Sazbu: group.Ma_Zvysenou_Sazbu ?? (index === 0 && (group.Ridic || group.driver) && loadedData.Zvysena_Sazba),
                            Cesty: (group.Cesty || group.segments)?.map(segment => ({
                                ...segment,
                                Datum: segment.Datum || segment.datum || segment.date ? new Date(segment.Datum || segment.datum || segment.date) : new Date()
                            })) || []
                        }));
                    }
                    if (loadedData.Noclezne && Array.isArray(loadedData.Noclezne)) {
                        loadedData.Noclezne = loadedData.Noclezne.map(acc => ({
                            ...acc,
                            Datum: acc.Datum || acc.date ? new Date(acc.Datum || acc.date) : new Date(),
                            Prilohy: acc.Prilohy || acc.attachments || {}
                        }));
                    }
                    if (loadedData.Vedlejsi_Vydaje && Array.isArray(loadedData.Vedlejsi_Vydaje)) {
                        loadedData.Vedlejsi_Vydaje = loadedData.Vedlejsi_Vydaje.map(exp => ({
                            ...exp,
                            Datum: exp.Datum || exp.date ? new Date(exp.Datum || exp.date) : new Date(),
                            Polozka: exp.Polozka || exp.description || "",
                            Prilohy: exp.Prilohy || exp.attachments || {}
                        }));
                    }
                }

                // Load Part B (using czech keys with data migration)
                if (result.data_b) {
                    Object.assign(loadedData, result.data_b);
                    
                    // Migrate old data structure to new Czech names
                    if (loadedData.Stavy_Tim) {
                        const migratedStavyTim = {};
                        
                        for (const [timId, timReport] of Object.entries(loadedData.Stavy_Tim)) {
                            const migratedReport = {
                                EvCi_TIM: timReport.EvCi_TIM || timReport.timId || timId,
                                Koment_NP: timReport.Koment_NP || timReport.structuralComment || "",
                                Prilohy_NP: timReport.Prilohy_NP || timReport.structuralAttachments || {},
                                Predmety: {},
                                Prilohy_TIM: timReport.Prilohy_TIM || timReport.photos || {},
                                Koment_TIM: timReport.Koment_TIM || timReport.generalComment || "",
                                Souhlasi_STP: timReport.Souhlasi_STP ?? timReport.centerRuleCompliant ?? null,
                                Koment_STP: timReport.Koment_STP || timReport.centerRuleComment || ""
                            };
                            
                            // Migrate item statuses to new object structure
                            const itemStatuses = timReport.Predmety || timReport.itemStatuses || [];
                            const migratedPredmety = {};
                            
                            // Convert array to object with ID_PREDMETY as key
                            if (Array.isArray(itemStatuses)) {
                                itemStatuses.forEach(status => {
                                    const predmetId = status.ID_PREDMETY || status.itemId || "";
                                    if (predmetId) {
                                        migratedPredmety[predmetId] = {
                                            ID_PREDMETY: predmetId,
                                            Zachovalost: status.Zachovalost || status.status || null,
                                            Rok_Vyroby: status.Rok_Vyroby || status.yearOfProduction || null,
                                            Smerovani: status.Smerovani || status.arrowOrientation || "",
                                            Koment: status.Koment || status.comment || "",
                                            Prilohy: status.Prilohy || status.photos || {},
                                            metadata: status.metadata || {}
                                        };
                                    }
                                });
                            } else if (typeof itemStatuses === 'object' && itemStatuses !== null) {
                                // Already in object format, just ensure proper structure
                                Object.entries(itemStatuses).forEach(([key, status]) => {
                                    migratedPredmety[key] = {
                                        ID_PREDMETY: key,
                                        Zachovalost: status.Zachovalost || status.status || null,
                                        Rok_Vyroby: status.Rok_Vyroby || status.yearOfProduction || null,
                                        Smerovani: status.Smerovani || status.arrowOrientation || "",
                                        Koment: status.Koment || status.comment || "",
                                        Prilohy: status.Prilohy || status.photos || {},
                                        metadata: status.metadata || {}
                                    };
                                });
                            }
                            
                            migratedReport.Predmety = migratedPredmety;
                            
                            migratedStavyTim[timId] = migratedReport;
                        }
                        
                        loadedData.Stavy_Tim = migratedStavyTim;
                    }
                    
                    // Migrate route agreement
                    if (loadedData.routeAgreement !== undefined && loadedData.Souhlasi_Mapa === undefined) {
                        loadedData.Souhlasi_Mapa = loadedData.routeAgreement;
                        delete loadedData.routeAgreement;
                    }
                    
                    // Migrate old route comment and attachments names
                    if (loadedData.Trasa_Poznamka !== undefined && loadedData.Koment_Usek === undefined) {
                        loadedData.Koment_Usek = loadedData.Trasa_Poznamka;
                        delete loadedData.Trasa_Poznamka;
                    }
                    if (loadedData.Trasa_Prilohy !== undefined && loadedData.Prilohy_Usek === undefined) {
                        loadedData.Prilohy_Usek = loadedData.Trasa_Prilohy;
                        delete loadedData.Trasa_Prilohy;
                    }
                    
                    // Ensure Obnovene_Useky exists
                    if (loadedData.Obnovene_Useky === undefined) {
                        loadedData.Obnovene_Useky = {};
                    }
                    
                    // Ensure attachment fields are objects
                    if (loadedData.Prilohy_Usek === undefined) {
                        loadedData.Prilohy_Usek = {};
                    }
                    if (loadedData.Prilohy_Mapa === undefined) {
                        loadedData.Prilohy_Mapa = {};
                    }
                }

                // Migrate calculation data if available
                if (result.calculation) {
                    // Old calculation format migration to new Czech Snake_Case format
                    // Check if calculation is in old format (has properties like Naklady_Doprava, stravne, etc.)
                    const needsCalculationMigration = typeof result.calculation === 'object' && 
                        Object.values(result.calculation).some(comp => 
                            comp && (comp.Naklady_Doprava !== undefined || comp.stravne !== undefined || comp.nahradaPrace !== undefined)
                        );
                    
                    if (needsCalculationMigration) {
                        const migratedCalculation = {};
                        
                        for (const [intAdr, oldComp] of Object.entries(result.calculation)) {
                            if (!oldComp || typeof oldComp !== 'object') continue;
                            
                            migratedCalculation[intAdr] = {
                                INT_ADR: parseInt(intAdr),
                                Jizdne: oldComp.Jizdne || oldComp.Naklady_Doprava || 0,
                                Zvysena_Sazba: oldComp.Zvysena_Sazba || false,
                                Stravne: oldComp.Stravne || oldComp.stravne || 0,
                                Nahrada_Prace: oldComp.Nahrada_Prace || oldComp.nahradaPrace || 0,
                                Naklady_Ubytovani: oldComp.Naklady_Ubytovani || 0,
                                Vedlejsi_Vydaje: oldComp.Vedlejsi_Vydaje || 0,
                                Hodin_Celkem: oldComp.Hodin_Celkem || oldComp.odpracovaneHodiny || 0,
                                Dny_Prace: oldComp.Dny_Prace || [], // Prázdné pole pro stará data
                                celkem: oldComp.celkem || 0, // Backwards compatibility
                                appliedTariff: oldComp.appliedTariff || oldComp.pouzityTarif || null
                            };
                        }
                        
                        loadedData.calculation = migratedCalculation;
                    } else {
                        // Calculation is already in new format or doesn't need migration
                        loadedData.calculation = result.calculation;
                    }
                }

                // Load team members if available
                if (result.znackari && Array.isArray(result.znackari)) {
                    setTeamMembers(result.znackari);
                    
                    // Check if current user is leader from team members
                    const currentUserInTeam = result.znackari.find(
                        member => member.INT_ADR === currentUser?.INT_ADR
                    );
                    
                    if (currentUserInTeam) {
                        const isLeaderFromReport = currentUserInTeam.je_vedouci || 
                                                 currentUserInTeam.Je_Vedouci || 
                                                 currentUserInTeam.isLeader || 
                                                 false;
                        setIsLeader(isLeaderFromReport);
                        setCanEditOthers(isLeaderFromReport);
                        
                        log.info('Tým načten z uloženého hlášení', { 
                            clenove: result.znackari.map(m => ({
                                jmeno: m.name || m.Znackar,
                                INT_ADR: m.INT_ADR,
                                jeVedouci: m.je_vedouci || m.Je_Vedouci || m.isLeader || false
                            })),
                            aktualni: {
                                jmeno: currentUserInTeam.Znackar,
                                INT_ADR: currentUserInTeam.INT_ADR,
                                jeVedouci: isLeaderFromReport
                            }
                        });
                    }
                } else if (membersFromHead.length > 0 && currentUser) {
                    // Fallback: pokud report nemá znackari, použij data z head
                    setTeamMembers(membersFromHead);
                    
                    const userIsLeader = isUserLeader(currentUser, head);
                    setIsLeader(userIsLeader);
                    setCanEditOthers(userIsLeader);
                }

                // Set status - keep original state from database
                if (result.state) {
                    loadedData.status = result.state;
                }

                // Migrate all attachment structures from arrays to objects
                const migratedData = migrateAttachmentsToObjectStructure(loadedData);
                
                loadFormData(migratedData);
                log.info('Načteno existující hlášení');
            }
        } catch (error) {
            // Report doesn't exist yet, that's OK
            log.info('Hlášení ještě neexistuje');
        } finally {
            setReportLoaded(true);
        }
    }, [prikazId, loadFormData, currentUser?.INT_ADR, membersFromHead, head, setTeamMembers, setIsLeader, setCanEditOthers]);

    // Update order number in page header
    useEffect(() => {
        const prikazIdElement = document.querySelector('.page__header .prikaz-id');
        if (prikazIdElement) {
            prikazIdElement.textContent = head?.Cislo_ZP || prikazId || '';
        }
    }, [head, prikazId]);

    // Load report data when order data is loaded
    useEffect(() => {
        if (!loading) {
            loadReportData();
        }
    }, [loading, loadReportData]);

    // Initialize team members and permissions when head data loads
    // POUZE pokud report ještě nebyl načten (aby se nepřepsaly data z reportu)
    useEffect(() => {
        // Přidat kontrolu, že effect běží pouze jednou při prvním načtení dat
        if (membersFromHead.length > 0 && currentUser && !reportLoaded && teamMembers.length === 0) {
            const userIsLeader = isUserLeader(currentUser, head);
            
            log.info('Tým načten z hlavičky příkazu', { 
                clenove: membersFromHead.map(m => ({
                    jmeno: m.name || m.Znackar,
                    INT_ADR: m.INT_ADR,
                    jeVedouci: m.isLeader || m.Je_Vedouci || false
                })),
                aktualni: currentUser ? {
                    jmeno: currentUser.name,
                    INT_ADR: currentUser.INT_ADR,
                    jeVedouci: userIsLeader
                } : null
            });
            
            setTeamMembers(membersFromHead);
            setIsLeader(userIsLeader);
            setCanEditOthers(userIsLeader);
        }
    }, [membersFromHead, currentUser?.INT_ADR, reportLoaded, teamMembers.length]); // Stabilní dependencies

    // Set higher rate based on order header
    useEffect(() => {
        if (head?.ZvysenaSazba) {
            const shouldUseHigherRate = head.ZvysenaSazba === "1";
            if (shouldUseHigherRate !== formData.Zvysena_Sazba) {
                setFormData(prev => ({...prev, Zvysena_Sazba: shouldUseHigherRate}));
            }
        }
    }, [head?.ZvysenaSazba, formData.Zvysena_Sazba, setFormData]);

    // Loading state
    if (loading || !reportLoaded) {
        return (
            <div className="card">
                <Loader/>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="card__content">
                    <PrikazHead head={head}/>
                </div>
            </div>

            {/* Step Navigation */}
            <StepNavigation
                activeStep={activeStep}
                onStepChange={changeStep}
                partACompleted={formData.Cast_A_Dokoncena}
                partBCompleted={formData.Cast_B_Dokoncena}
                head={head}
                saving={saving}
                status={formData.status}
            />

            {/* Step Content */}
            <StepContent
                activeStep={activeStep}
                formData={formData}
                setFormData={setFormData}
                head={head}
                useky={useky}
                predmety={predmety}
                priceList={priceList}
                priceListLoading={priceListLoading}
                priceListError={priceListError}
                currentUser={currentUser}
                teamMembers={teamMembers}
                isLeader={isLeader}
                canEditOthers={canEditOthers}
                prikazId={prikazId}
                canCompletePartA={canCompletePartA}
                canCompletePartB={canCompletePartB}
                onStepChange={changeStep}
                onSave={saveDraft}
                onSubmit={() => submitForApproval(setFormData)}
                saving={saving}
                polling={{
                    isPolling,
                    pollCount,
                    maxAttempts,
                    interval,
                    startPolling,
                    stopPolling
                }}
            />
        </div>
    );
};

export default App;