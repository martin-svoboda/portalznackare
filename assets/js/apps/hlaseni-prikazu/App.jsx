import React, { useEffect, useState, useCallback } from 'react';
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

const App = () => {
    // Get prikaz ID from data attribute
    const container = document.querySelector('[data-app="hlaseni-prikazu"]');
    const prikazId = container?.dataset?.prikazId;

    // Get current user from data attribute (set by Twig template)
    const currentUser = container?.dataset?.user ? JSON.parse(container.dataset.user) : null;

    // Order data loading
    const { head, predmety, useky, loading } = useOrderData(prikazId);
    
    // Form state management
    const { formData, setFormData, loadFormData } = useFormState();
    
    // Step navigation
    const { activeStep, changeStep } = useStepNavigation();
    
    // Additional state
    const [reportLoaded, setReportLoaded] = useState(false);
    const [teamMembers, setTeamMembers] = useState([]);
    const [isLeader, setIsLeader] = useState(false);
    const [canEditOthers, setCanEditOthers] = useState(false);
    
    // Price list loading (depends on formData.executionDate)
    const { priceList, loading: priceListLoading, error: priceListError } = usePriceList(
        formData.executionDate,
        reportLoaded
    );

    // Completion status management
    const {
        canCompletePartA,
        canCompletePartB
    } = useCompletionStatus(formData, head, predmety, setFormData);

    // Form saving
    const { saving, saveDraft, submitReport } = useFormSaving(
        formData, 
        head, 
        prikazId, 
        priceList, 
        isLeader, 
        teamMembers, 
        currentUser
    );

    // Load existing report data
    const loadReportData = useCallback(async () => {
        if (!prikazId) {
            setReportLoaded(true);
            return;
        }

        try {
            const result = await api.prikazy.report(prikazId);
            if (result && (result.dataA || result.dataB || result.team_members)) {
                const loadedData = {};

                // Load Part A (Symfony uses camelCase: dataA)
                if (result.dataA) {
                    Object.assign(loadedData, result.dataA);
                    // Convert dates
                    if (loadedData.executionDate) {
                        const execDate = new Date(loadedData.executionDate);
                        loadedData.executionDate = isNaN(execDate.getTime()) ? new Date() : execDate;
                    }
                    if (loadedData.travelGroups) {
                        loadedData.travelGroups = loadedData.travelGroups.map(group => ({
                            ...group,
                            participants: group.participants || [], // Zajistit, že participants jsou načtené
                            driver: group.driver || null,
                            spz: group.spz || "",
                            segments: group.segments?.map(segment => ({
                                ...segment,
                                date: segment.date ? new Date(segment.date) : new Date()
                            })) || []
                        }));
                    }
                    if (loadedData.accommodations) {
                        loadedData.accommodations = loadedData.accommodations.map(acc => ({
                            ...acc,
                            date: new Date(acc.date)
                        }));
                    }
                    if (loadedData.additionalExpenses) {
                        loadedData.additionalExpenses = loadedData.additionalExpenses.map(exp => ({
                            ...exp,
                            date: new Date(exp.date)
                        }));
                    }
                }

                // Load Part B (Symfony uses camelCase: dataB)
                if (result.dataB) {
                    Object.assign(loadedData, result.dataB);
                }

                // Load team members if available
                if (result.team_members && Array.isArray(result.team_members)) {
                    setTeamMembers(result.team_members);
                    
                    // Check if current user is leader from team members
                    const currentUserInTeam = result.team_members.find(
                        member => member.int_adr === currentUser?.int_adr
                    );
                    if (currentUserInTeam) {
                        setIsLeader(currentUserInTeam.je_vedouci || false);
                        setCanEditOthers(currentUserInTeam.je_vedouci || false);
                    }
                } else if (head && currentUser) {
                    // Fallback: pokud report nemá team_members, použij data z head
                    const members = extractTeamMembers(head);
                    setTeamMembers(members);
                    
                    const userIsLeader = isUserLeader(currentUser, head);
                    setIsLeader(userIsLeader);
                    setCanEditOthers(userIsLeader);
                }

                // Set status
                if (result.state) {
                    loadedData.status = result.state === 'send' ? 'submitted' : 'draft';
                }

                loadFormData(loadedData);
                log.info('Načteno existující hlášení');
            }
        } catch (error) {
            // Report doesn't exist yet, that's OK
            log.info('Hlášení ještě neexistuje');
        } finally {
            setReportLoaded(true);
        }
    }, [prikazId, loadFormData]);

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
        if (head && currentUser && !reportLoaded) {
            const members = extractTeamMembers(head);
            setTeamMembers(members);

            const userIsLeader = isUserLeader(currentUser, head);
            setIsLeader(userIsLeader);
            setCanEditOthers(userIsLeader);
        }
    }, [head, currentUser, reportLoaded]);

    // Set higher rate based on order header
    useEffect(() => {
        if (head?.ZvysenaSazba) {
            const shouldUseHigherRate = head.ZvysenaSazba === "1";
            if (shouldUseHigherRate !== formData.higherKmRate) {
                setFormData(prev => ({...prev, higherKmRate: shouldUseHigherRate}));
            }
        }
    }, [head?.ZvysenaSazba, formData.higherKmRate, setFormData]);

    // Loading state
    if (loading) {
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
                partACompleted={formData.partACompleted}
                partBCompleted={formData.partBCompleted}
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
                onSubmit={submitReport}
                saving={saving}
            />
        </div>
    );
};

export default App;