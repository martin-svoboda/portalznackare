import React, {useEffect, useState, useMemo} from 'react';
import {Loader} from '../../components/shared/Loader';
import {PrikazHead} from '../../components/prikazy/PrikazHead';
import {StepNavigation} from './components/StepNavigation';
import {StepContent} from './components/StepContent';
import {useFormSaving} from './hooks/useFormSaving';
import {useStatusPolling} from './hooks/useStatusPolling';
import {useStepNavigation} from './hooks/useStepNavigation';
import {api} from '../../utils/api';
import {log} from '../../utils/debug';
import {parseTariffRatesFromAPI, calculateExecutionDate} from './utils/compensationCalculator';

const App = () => {
    // Get prikaz ID and user from HTML data attributes
    const container = document.querySelector('[data-app="hlaseni-prikazu"]');
    const prikazId = container?.dataset?.prikazId;
    const currentUser = container?.dataset?.user ? JSON.parse(container.dataset.user) : null;

    // Single state object for all data
    const [appData, setAppData] = useState({
        loading: true,
        head: null,
        predmety: [],
        useky: [],
        formData: {
            Skupiny_Cest: [{
                id: crypto.randomUUID(),
                Cestujci: [],
                Ridic: null,
                SPZ: "",
                Cesty: [{
                    id: crypto.randomUUID(),
                    Datum: new Date(),
                    Cas_Odjezdu: "",
                    Cas_Prijezdu: "",
                    Misto_Odjezdu: "",
                    Misto_Prijezdu: "",
                    Druh_Dopravy: "AUV",
                    Kilometry: undefined,
                    Naklady: undefined,
                    Prilohy: {}
                }]
            }],
            Noclezne: [],
            Vedlejsi_Vydaje: [],
            Stavy_Tim: {},
            Cast_A_Dokoncena: false,
            Cast_B_Dokoncena: false,
            status: "draft"
        },
        teamMembers: [],
        canEdit: false,
        tariffRates: null,
        reportExists: false,
        currentUser: null,
        polling: null
    });

    // Step navigation with URL sync
    const {activeStep, changeStep} = useStepNavigation();

    // Utility functions
    const extractTeamMembers = (head) => {
        if (!head) return [];
        return [1, 2, 3]
            .map(i => ({
                index: i,
                name: head[`Znackar${i}`],
                INT_ADR: parseInt(head[`INT_ADR_${i}`]), // Fix: ensure number type
                isLeader: head[`Je_Vedouci${i}`] === "1"
            }))
            .filter(member => member.name?.trim());
    };

    const checkUserPermissions = (user, teamMembers, status) => {
        if (!user || !teamMembers?.length) return false;
        if (!['draft', 'rejected'].includes(status)) return false;
        
        const userInTeam = teamMembers.find(member => member.INT_ADR == user.INT_ADR);
        // return !!userInTeam; // User is in team
        return userInTeam?.isLeader || false; // jen leader může editovat
    };

    const checkUserIsLeader = (user, teamMembers) => {
        if (!user || !teamMembers?.length) return false;
        const userInTeam = teamMembers.find(member => member.INT_ADR == user.INT_ADR);
        return userInTeam?.isLeader || false;
    };

    // Load all data in single effect
    useEffect(() => {
        const loadAllData = async () => {
            if (!prikazId) {
                setAppData(prev => ({...prev, loading: false}));
                return;
            }

            try {
                // Load order data (head, predmety, useky)
                const orderData = await api.prikazy.detail(prikazId);
                
                // Try to load existing report
                let reportData = null;
                try {
                    reportData = await api.prikazy.report(prikazId);
                    // Kontrola, zda jsme dostali skutečná data hlášení nebo jen null/prázdnou odpověď
                    if (!reportData || !reportData.id || (reportData.id_zp && Object.keys(reportData).length === 1)) {
                        reportData = null;
                        log.info('Hlášení ještě neexistuje, bude vytvořeno nové');
                    } else {
                        log.info('Načteno existující hlášení', reportData);
                    }
                } catch (error) {
                    log.info('Hlášení ještě neexistuje, bude vytvořeno nové');
                }

                // Determine team members - prioritize report data over head data
                let teamMembers = [];
                if (reportData?.znackari?.length) {
                    // Use team members from saved report
                    teamMembers = reportData.znackari.map(member => ({
                        ...member,
                        INT_ADR: parseInt(member.INT_ADR), // Ensure number type
                        isLeader: member.Je_Vedouci === "1" || member.Je_Vedouci === true
                    }));
                } else {
                    // Extract from order head
                    teamMembers = extractTeamMembers(orderData.head);
                }

                // Check permissions
                const canEdit = checkUserPermissions(
                    currentUser, 
                    teamMembers, 
                    reportData?.state || 'draft'
                );
                const isLeader = checkUserIsLeader(currentUser, teamMembers);

                // Příprava form dat - začneme s defaultními hodnotami z appData
                let formData = { ...appData.formData };
                
                // Load saved form data if exists
                if (reportData?.data_a) {
                    Object.assign(formData, reportData.data_a);
                    // Konvertovat INT_ADR ze stringů na čísla (databáze je ukládá jako stringy v JSON)
                    if (formData.Skupiny_Cest) {
                        formData.Skupiny_Cest = formData.Skupiny_Cest.map(group => ({
                            ...group,
                            Cestujci: group.Cestujci?.map(id => typeof id === 'string' ? parseInt(id, 10) : id) || [],
                            Ridic: typeof group.Ridic === 'string' ? parseInt(group.Ridic, 10) : group.Ridic
                        }));
                    }
                    if (formData.Hlavni_Ridic && typeof formData.Hlavni_Ridic === 'string') {
                        formData.Hlavni_Ridic = parseInt(formData.Hlavni_Ridic, 10);
                    }
                    if (formData.Noclezne) {
                        formData.Noclezne = formData.Noclezne.map(item => ({
                            ...item,
                            Zaplatil: typeof item.Zaplatil === 'string' ? parseInt(item.Zaplatil, 10) : item.Zaplatil
                        }));
                    }
                    if (formData.Vedlejsi_Vydaje) {
                        formData.Vedlejsi_Vydaje = formData.Vedlejsi_Vydaje.map(item => ({
                            ...item,
                            Zaplatil: typeof item.Zaplatil === 'string' ? parseInt(item.Zaplatil, 10) : item.Zaplatil
                        }));
                    }
                }
                if (reportData?.data_b) {
                    Object.assign(formData, reportData.data_b);
                }
                
                // Status z API má přednost
                formData.status = reportData?.state || "draft";
                
                // Pro nové hlášení nastavit správné hodnoty pro první skupinu cest
                if (!reportData) {
                    const executionDate = orderData.head?.Provedeni ? new Date(orderData.head.Provedeni) : new Date();
                    const defaultDriver = teamMembers.length === 1 ? teamMembers[0]?.INT_ADR : null;
                    
                    formData.Skupiny_Cest[0].Cestujci = teamMembers.map(m => m.INT_ADR);
                    formData.Skupiny_Cest[0].Ridic = defaultDriver;
                    formData.Skupiny_Cest[0].Cesty[0].Datum = executionDate;
                }

                // Auto-sync zvýšená sazba z hlavičky příkazu (uživatel ji nevybírá)
                if (orderData.head?.ZvysenaSazba === "1") {
                    formData.Zvysena_Sazba = true;
                }

                // Load tariff rates using shared parser
                let tariffRates = null;
                try {
                    // Získat datum provedení z formData
                    const executionDate = calculateExecutionDate(formData);
                    const dateParam = executionDate ? executionDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                    log.info('Načítám sazby pro datum:', dateParam);
                    
                    const priceResponse = await api.insyz.sazby(dateParam);
                    tariffRates = parseTariffRatesFromAPI(priceResponse);
                    log.info('Sazby úspěšně načteny', tariffRates);
                } catch (error) {
                    log.error('Chyba při načítání ceníku', error);
                }

                // Update state with all data
                setAppData(prev => ({
                    ...prev,
                    loading: false,
                    head: orderData.head,
                    predmety: orderData.predmety || [],
                    useky: orderData.useky || [],
                    formData,
                    teamMembers,
                    canEdit,
                    isLeader,
                    tariffRates,
                    reportExists: !!reportData,
                    currentUser,
                    polling
                }));

                log.info('Aplikace inicializována', {
                    canEdit,
                    isLeader,
                    teamMembersCount: teamMembers.length,
                    reportExists: !!reportData
                });

            } catch (error) {
                log.error('Chyba při načítání dat aplikace', error);
                setAppData(prev => ({...prev, loading: false}));
            }
        };

        loadAllData();
    }, [prikazId, currentUser?.INT_ADR]);

    // Status polling pro sledování zpracování
    const polling = useStatusPolling(
        prikazId,
        appData.formData,
        (updater) => setAppData(prev => ({
            ...prev,
            formData: typeof updater === 'function' ? updater(prev.formData) : updater
        })),
        !appData.loading && appData.formData.status === 'send'
    );


    // Update page header s číslem příkazu
    useEffect(() => {
        const prikazIdElement = document.querySelector('.page__header .prikaz-id');
        if (prikazIdElement && appData.head) {
            prikazIdElement.textContent = appData.head.Cislo_ZP || prikazId || '';
        }
    }, [appData.head, prikazId]);

    // Form saving hook
    const {saving, saveDraft, submitForApproval} = useFormSaving(
        appData.formData,
        appData.head,
        prikazId,
        appData.tariffRates,
        appData.isLeader,
        appData.teamMembers,
        currentUser,
        true // reportLoaded
    );

    // Update form data handler
    const setFormData = (updaterOrValue) => {
        setAppData(prev => ({
            ...prev,
            formData: typeof updaterOrValue === 'function' 
                ? updaterOrValue(prev.formData) 
                : updaterOrValue
        }));
    };


    if (appData.loading) {
        return (
            <div className="card">
                <Loader/>
            </div>
        );
    }

    // App rendering
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="card__content">
                    <PrikazHead head={appData.head}/>
                </div>
            </div>

            {/* Step Navigation */}
            <StepNavigation
                activeStep={activeStep}
                onStepChange={changeStep}
                partACompleted={appData.formData.Cast_A_Dokoncena}
                partBCompleted={appData.formData.Cast_B_Dokoncena}
                head={appData.head}
                saving={saving}
                status={appData.formData.status}
            />

            {/* Step Content */}
            <StepContent
                data={appData}
                setFormData={setFormData}
                activeStep={activeStep}
                onStepChange={changeStep}
                onSave={saveDraft}
                onSubmit={() => submitForApproval(setFormData)}
                saving={saving}
                prikazId={prikazId}
            />
        </div>
    );
};

export default App;