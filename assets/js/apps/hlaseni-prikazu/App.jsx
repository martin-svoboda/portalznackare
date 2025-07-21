import React, {useEffect, useState, useMemo, useCallback} from 'react';
import {
    IconReportMoney,
    IconRoute,
    IconInfoCircle,
    IconCheck,
    IconAlertTriangle,
    IconCircleX,
    IconSend,
    IconAlertSmall,
    IconCashBanknote,
    IconSignRight, IconDeviceFloppy
} from '@tabler/icons-react';
import {Loader} from '../../components/shared/Loader';
import {PrikazHead} from '../../components/prikazy/PrikazHead';
import {PartAForm} from './components/PartAForm';
import {PartBForm, validateAllTimItemsCompleted} from './components/PartBForm';
import {CompensationSummary} from './components/CompensationSummary';
import {AdvancedFileUpload} from './components/AdvancedFileUpload';
import {
    parsePriceListFromAPI, 
    calculateCompensation, 
    calculateCompensationForAllMembers,
    extractTeamMembers,
    isUserLeader,
    canUserEditExpense
} from './utils/compensationCalculator';

// Types
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

const App = () => {
    // Get prikaz ID from data attribute
    const container = document.querySelector('[data-app="hlaseni-prikazu"]');
    const prikazId = container?.dataset?.prikazId;

    // Get current user from data attribute (set by Twig template)
    const currentUser = container?.dataset?.user ? JSON.parse(container.dataset.user) : null;

    // Get step from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const stepParam = urlParams.get('step');
    const initialStep = stepParam ? parseInt(stepParam, 10) : 0;
    const validStep = isNaN(initialStep) || initialStep < 0 || initialStep > 2 ? 0 : initialStep;

    // State
    const [head, setHead] = useState(null);
    const [predmety, setPredmety] = useState([]);
    const [useky, setUseky] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reportLoaded, setReportLoaded] = useState(false);
    const [activeStep, setActiveStep] = useState(validStep);
    const [priceList, setPriceList] = useState(null);
    const [priceListLoading, setPriceListLoading] = useState(false);
    const [priceListError, setPriceListError] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [isLeader, setIsLeader] = useState(false);
    const [canEditOthers, setCanEditOthers] = useState(false);

    const [formData, setFormData] = useState({
        executionDate: new Date(),
        travelSegments: [createEmptyTravelSegment()],
        primaryDriver: "",
        vehicleRegistration: "",
        higherKmRate: false,
        accommodations: [], // Bude obsahovat paidByMember pole
        additionalExpenses: [], // Bude obsahovat paidByMember pole
        partACompleted: false,
        partBCompleted: false,
        timReports: {},
        routeComment: "",
        routeAttachments: [],
        paymentRedirects: {}, // INT_ADR -> INT_ADR mapping pro přesměrování plateb
        status: 'draft'
    });

    // Fetch prikaz data
    const fetchPrikazData = async () => {
        if (!prikazId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/insys/prikaz/${prikazId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            setHead(result.head || {});
            setPredmety(result.predmety || []);
            setUseky(result.useky || []);
        } catch (err) {
            console.error('Error fetching prikaz data:', err);
            // Show error notification
        } finally {
            setLoading(false);
        }
    };

    // Fetch existing report data
    const fetchReportData = async () => {
        if (!prikazId) {
            setReportLoaded(true);
            return;
        }

        try {
            const response = await fetch(`/api/portal/report?id_zp=${prikazId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin'
            });

            if (response.ok) {
                const result = await response.json();
                if (result && (result.dataA || result.dataB)) {
                    const loadedData = {};

                    // Load Part A (Symfony uses camelCase: dataA)
                    if (result.dataA) {
                        Object.assign(loadedData, result.dataA);
                        // Convert dates
                        if (loadedData.executionDate) {
                            const execDate = new Date(loadedData.executionDate);
                            loadedData.executionDate = isNaN(execDate.getTime()) ? new Date() : execDate;
                        }
                        if (loadedData.travelSegments) {
                            loadedData.travelSegments = loadedData.travelSegments.map(segment => ({
                                ...segment,
                                date: segment.date ? new Date(segment.date) : new Date()
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

                    // Set status
                    if (result.state) {
                        loadedData.status = result.state === 'send' ? 'submitted' : 'draft';
                    }

                    setFormData(prev => ({...prev, ...loadedData}));
                }
            }
        } catch (err) {
            // Report doesn't exist yet, that's OK
        } finally {
            setReportLoaded(true);
        }
    };

    // Fetch price list
    const fetchPriceList = useCallback(async () => {
        if (!formData.executionDate || !reportLoaded) return;

        const dateParam = formData.executionDate.toISOString().split('T')[0];
        
        setPriceListLoading(true);
        setPriceListError(null);

        try {
            const response = await fetch(`/api/insys/ceniky?date=${dateParam}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin'
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Raw price list from API:', result);
                const parsedPriceList = parsePriceListFromAPI(result);
                console.log('Parsed price list:', parsedPriceList);
                setPriceList(parsedPriceList);
                
                // Show feedback to user
                if (!parsedPriceList || Object.keys(parsedPriceList).length === 0) {
                    console.warn('Empty price list received');
                    setPriceListError('Ceník se načetl, ale neobsahuje žádná data');
                } else {
                    console.log('Price list loaded successfully with tariffs:', parsedPriceList.tariffs?.length || 0);
                }
            } else {
                const errorMessage = `Nepodařilo se načíst ceník (${response.status})`;
                console.error('Failed to fetch price list:', response.status, response.statusText);
                setPriceListError(errorMessage);
            }
        } catch (err) {
            const errorMessage = 'Chyba při načítání ceníku: ' + err.message;
            console.error('Error fetching price list:', err);
            setPriceListError(errorMessage);
        } finally {
            setPriceListLoading(false);
        }
    }, [formData.executionDate, reportLoaded]);

    useEffect(() => {
        fetchPrikazData();
    }, [prikazId]);

    // Update order number in page header
    useEffect(() => {
        const prikazIdElement = document.querySelector('.page__header .prikaz-id');
        if (prikazIdElement) {
            prikazIdElement.textContent = head?.Cislo_ZP || prikazId || '';
        }
    }, [head, prikazId]);

    useEffect(() => {
        if (!loading) {
            fetchReportData();
        }
    }, [loading, prikazId]);

    useEffect(() => {
        fetchPriceList();
    }, [fetchPriceList]);

    // Initialize team members and permissions when head data loads
    useEffect(() => {
        if (head && currentUser) {
            const members = extractTeamMembers(head);
            setTeamMembers(members);
            
            const userIsLeader = isUserLeader(currentUser, head);
            setIsLeader(userIsLeader);
            setCanEditOthers(userIsLeader);
        }
    }, [head, currentUser]);

    // Calculate total length for "O" type orders
    const totalLength = useMemo(() => {
        if (head?.Druh_ZP !== "O" || !Array.isArray(useky) || useky.length === 0) return null;
        return useky.reduce((sum, usek) => sum + Number(usek.Delka_ZU || 0), 0);
    }, [useky, head?.Druh_ZP]);

    // Calculate compensation
    const compensation = useMemo(() => {
        if (!priceList) return null;
        
        if (isLeader && teamMembers.length > 0) {
            // Vedoucí vidí náhrady všech členů
            return calculateCompensationForAllMembers(
                formData, 
                priceList, 
                teamMembers, 
                formData.primaryDriver, 
                formData.higherKmRate
            );
        } else {
            // Člen vidí jen svou náhradu
            const isCurrentUserDriver = currentUser && formData.primaryDriver === currentUser.INT_ADR;
            return calculateCompensation(
                formData, 
                priceList, 
                isCurrentUserDriver, 
                formData.higherKmRate, 
                currentUser?.INT_ADR
            );
        }
    }, [formData, priceList, isLeader, teamMembers, currentUser]);

    // Automatic completion status for Part A
    const canCompletePartA = useMemo(() => {
        const needsDriver = formData.travelSegments.some(segment =>
            segment && segment.transportType && (segment.transportType === "AUV" || segment.transportType === "AUV-Z")
        );

        const hasDriverForCar = needsDriver && (!formData.primaryDriver || !formData.vehicleRegistration);

        const hasTicketsForPublicTransport = formData.travelSegments.some(segment =>
            segment && segment.transportType === "veřejná doprava" && (!segment.attachments || segment.attachments.length === 0)
        );

        const hasDocumentsForExpenses = [
            ...formData.accommodations,
            ...formData.additionalExpenses
        ].some(expense => expense.attachments && expense.attachments.length === 0);

        return !hasDriverForCar && !hasTicketsForPublicTransport && !hasDocumentsForExpenses;
    }, [formData]);

    // Automatic completion status for Part B
    const canCompletePartB = useMemo(() => {
        if (head?.Druh_ZP === "O") {
            // For renovation orders, require ALL TIM items to have status filled
            return validateAllTimItemsCompleted(predmety, formData.timReports);
        } else {
            // For other types, require filled comment
            return formData.routeComment.trim().length > 0;
        }
    }, [formData.timReports, formData.routeComment, head?.Druh_ZP, predmety]);

    // Auto-update completion status
    useEffect(() => {
        if (canCompletePartA !== formData.partACompleted) {
            setFormData(prev => ({...prev, partACompleted: canCompletePartA}));
        }
    }, [canCompletePartA, formData.partACompleted]);

    useEffect(() => {
        if (canCompletePartB !== formData.partBCompleted) {
            setFormData(prev => ({...prev, partBCompleted: canCompletePartB}));
        }
    }, [canCompletePartB, formData.partBCompleted]);

    // Set higher rate based on order header
    useEffect(() => {
        if (head?.ZvysenaSazba) {
            const shouldUseHigherRate = head.ZvysenaSazba === "1";
            if (shouldUseHigherRate !== formData.higherKmRate) {
                setFormData(prev => ({...prev, higherKmRate: shouldUseHigherRate}));
            }
        }
    }, [head?.ZvysenaSazba, formData.higherKmRate]);

    // Handle save
    const handleSave = async (final = false) => {
        setSaving(true);

        try {
            const data = {
                id_zp: prikazId,
                cislo_zp: head?.Cislo_ZP || '',
                je_vedouci: false, // Will be determined server-side
                data_a: {
                    executionDate: formData.executionDate,
                    travelSegments: formData.travelSegments.filter(segment => segment && segment.id),
                    primaryDriver: formData.primaryDriver,
                    vehicleRegistration: formData.vehicleRegistration,
                    higherKmRate: formData.higherKmRate,
                    accommodations: formData.accommodations,
                    additionalExpenses: formData.additionalExpenses,
                    partACompleted: formData.partACompleted,
                    paymentRedirects: formData.paymentRedirects
                },
                data_b: {
                    timReports: formData.timReports,
                    routeComment: formData.routeComment,
                    routeAttachments: formData.routeAttachments,
                    partBCompleted: formData.partBCompleted
                },
                calculation: compensation || {},
                state: final ? 'send' : 'draft'
            };

            console.log('Saving report data:', data);
            
            const response = await fetch('/api/portal/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Save failed:', response.status, response.statusText, errorText);
                throw new Error(`Failed to save report: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Save successful:', result);

            // Show success notification
            alert(final ? 'Hlášení bylo úspěšně odesláno' : 'Hlášení bylo uloženo');

            if (final) {
                // Redirect to prikaz detail
                window.location.href = `/prikaz/${prikazId}`;
            }
        } catch (err) {
            console.error('Error saving report:', err);
            alert(`Nepodařilo se uložit hlášení: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    // Handle step change with URL update
    const changeStep = (step) => {
        setActiveStep(step);
        const url = new URL(window.location);
        if (step === 0) {
            url.searchParams.delete('step');
        } else {
            url.searchParams.set('step', step.toString());
        }
        window.history.replaceState(null, '', url);
    };

    // Step configuration
    const steps = [
        {
            label: 'Část A - Vyúčtování',
            description: formData.partACompleted ? 'Doprava a výdaje' : 'Doprava a výdaje',
            icon: <IconCashBanknote size={18}/>,
            completed: formData.partACompleted
        },
        {
            label: head?.Druh_ZP === "O" ? 'Část B - Stavy TIM' : 'Část B - Hlášení o činnosti',
            description: head?.Druh_ZP === "O" ? 'Stav informačních míst' : 'Hlášení značkařské činnosti',
            icon: <IconSignRight size={18}/>,
            completed: formData.partBCompleted
        },
        {
            label: 'Odeslání',
            description: 'Kontrola a odeslání',
            icon: <IconSend size={18}/>,
            completed: false
        }
    ];

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
                    <PrikazHead head={head} delka={totalLength}/>
                </div>
            </div>

            {/* Stepper */}
            <div className="stepper">
                {steps.map((step, index) => (
                    <div
                        key={index}
                        className={`stepper__step ${index === activeStep ? 'stepper__step--active' : ''} ${step.completed ? 'stepper__step--completed' : ''}`}
                        onClick={() => changeStep(index)}
                    >
                        <div className="stepper__icon">
                            {step.completed ? <IconCheck size={18}/> : step.icon}
                        </div>
                        <div className="stepper__content">
                            <div className="stepper__label">{step.label}</div>
                            <div className="stepper__description">
                                {step.description}
                                {!step.completed && index < activeStep && (
                                    <span
                                        className="inline-block px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded ml-2">
                                                Nedokončeno
                                            </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Step 0 - Part A */}
            {activeStep === 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main form */}
                    <div className="lg:col-span-2">
                        <PartAForm
                            formData={formData}
                            setFormData={setFormData}
                            priceList={priceList}
                            head={head}
                            currentUser={currentUser}
                            teamMembers={teamMembers}
                            isLeader={isLeader}
                            canEditOthers={canEditOthers}
                            prikazId={prikazId}
                        />
                        {!canCompletePartA && (
                            <div className="alert alert--warning mt-4">
                                <IconAlertTriangle size={16} className="mr-2"/>
                                Vyplňte všechny povinné údaje
                            </div>
                        )}


                        {/* Navigation */}
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                className="btn btn--secondary"
                                onClick={() => handleSave(false)}
                                disabled={saving}
                            >
                                {saving ? <Loader size="small" center={false}/> : <IconDeviceFloppy />} Uložit změny
                            </button>
                            <button
                                className="btn btn--primary"
                                onClick={() => changeStep(1)}
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
                                    <CompensationSummary
                                        formData={formData}
                                        compensation={compensation}
                                        priceList={priceList}
                                        priceListLoading={priceListLoading}
                                        priceListError={priceListError}
                                        compact={true}
                                        isLeader={isLeader}
                                        teamMembers={teamMembers}
                                        currentUser={currentUser}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 1 - Part B */}
            {activeStep === 1 && (
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
                                    value={formData.routeComment || ""}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        routeComment: e.target.value
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
                                <AdvancedFileUpload
                                    id="hlaseni-route-attachments"
                                    files={formData.routeAttachments || []}
                                    onFilesChange={(files) => setFormData(prev => ({
                                        ...prev,
                                        routeAttachments: files
                                    }))}
                                    maxFiles={20}
                                    accept="image/jpeg,image/png,image/heic,application/pdf"
                                    disabled={formData.status === 'submitted'}
                                    maxSize={15}
                                    storagePath={head && prikazId ? `reports/${(formData.executionDate ? formData.executionDate.getFullYear() : new Date().getFullYear())}/${head.KKZ?.toString().trim() || 'unknown'}/${head.ZO?.toString().trim() || 'unknown'}/${prikazId?.toString().trim() || 'unknown'}` : null}
                                />
                            </div>
                        </div>
                    )}


                    {/* Navigation */}
                    <div className="flex justify-between mt-6">
                        <button
                            className="btn btn--secondary"
                            onClick={() => changeStep(0)}
                        >
                            Zpět na část A
                        </button>

                        <div className="flex gap-2">
                            <button
                                className="btn btn--secondary"
                                onClick={() => handleSave(false)}
                                disabled={saving}
                            >
                                {saving ? <Loader size="small" center={false}/> : <IconDeviceFloppy />} Uložit změny
                            </button>
                            <button
                                className="btn btn--primary"
                                onClick={() => changeStep(2)}
                            >
                                Pokračovat k odeslání
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2 - Summary and submission */}
            {activeStep === 2 && (
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
                                        <span
                                            className="text-sm">{formData.executionDate.toLocaleDateString('cs-CZ')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Počet segmentů dopravy:</span>
                                        <span className="text-sm">{formData.travelSegments.length}</span>
                                    </div>
                                    {formData.primaryDriver && (
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Řidič:</span>
                                            <span className="text-sm">{formData.primaryDriver}</span>
                                        </div>
                                    )}
                                    {formData.vehicleRegistration && (
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">SPZ vozidla:</span>
                                            <span className="text-sm">{formData.vehicleRegistration}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Ubytování:</span>
                                        <span className="text-sm">{formData.accommodations.length} nocí</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Dodatečné výdaje:</span>
                                        <span className="text-sm">{formData.additionalExpenses.length} položek</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Stav části A:</span>
                                        <span
                                            className={`inline-block px-2 py-1 text-xs rounded ${formData.partACompleted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {formData.partACompleted ? "Dokončeno" : "Nedokončeno"}
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
                                            <span className="text-sm">{Object.keys(formData.timReports).length}</span>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Hlášení vyplněno:</span>
                                            <span
                                                className="text-sm">{formData.routeComment?.trim().length > 0 ? "Ano" : "Ne"}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Stav části B:</span>
                                        <span
                                            className={`inline-block px-2 py-1 text-xs rounded ${formData.partBCompleted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {formData.partBCompleted ? "Dokončeno" : "Nedokončeno"}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    {formData.routeComment && (
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">
                                                {head?.Druh_ZP === "O" ? "Poznámka k trase:" : "Hlášení o činnosti:"}
                                            </p>
                                            <p className="text-sm">{formData.routeComment}</p>
                                        </div>
                                    )}
                                    {formData.routeAttachments && formData.routeAttachments.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-600 mb-1">Počet příloh:</p>
                                            <p className="text-sm">{formData.routeAttachments.length}</p>
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
                            <CompensationSummary
                                formData={formData}
                                compensation={compensation}
                                priceList={priceList}
                                priceListLoading={priceListLoading}
                                priceListError={priceListError}
                                compact={false}
                                isLeader={isLeader}
                                teamMembers={teamMembers}
                                currentUser={currentUser}
                            />
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
                                        onClick={() => changeStep(1)}
                                    >
                                        Zpět na úpravy
                                    </button>

                                    <button
                                        className="btn btn--primary btn--large"
                                        disabled={!formData.partACompleted || !formData.partBCompleted || saving}
                                        onClick={() => handleSave(true)}
                                    >
                                        <IconSend size={20} className="mr-2"/>
                                        {saving ? 'Odesílání...' : 'Odeslat ke schválení'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;