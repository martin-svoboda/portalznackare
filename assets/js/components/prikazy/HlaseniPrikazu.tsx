import React, {useEffect, useState, useMemo} from "react";
import {
	Container,
	Title,
	Card,
	Group,
	Text,
	Loader,
	Stack,
	Badge,
	Button,
	Divider,
	Alert,
	Box,
	Grid,
	Stepper,
	Textarea
} from "@mantine/core";
import {
	IconReportMoney,
	IconRoute,
	IconInfoCircle,
	IconCheck,
	IconAlertTriangle,
	IconCircleX,
	IconSend,
	IconAlertSmall,
	IconCashBanknote, IconSignRight
} from "@tabler/icons-react";
import {useParams, useLocation, useNavigate, useSearchParams} from "react-router-dom";
import {apiRequest} from "@services/api";
import {notifications} from "@mantine/notifications";
import {Helmet} from "react-helmet-async";
import {useAuth} from "@components/auth/AuthContext";
import {BreadcrumbsNav} from "@components/shared/BreadcrumbsNav";
import RequireLogin from "@components/auth/RequireLogin";
import {PrikazHead} from "./components/PrikazHead";
import {HlaseniFormData, PriceList} from "./types/HlaseniTypes";
import {PartAForm} from "./components/PartAForm";
import {PartBForm} from "./components/PartBForm";
import {CompensationSummary} from "./components/CompensationSummary";
import {FileUpload} from "./components/FileUpload";
import {parsePriceListFromAPI, calculateCompensation} from "./utils/compensationCalculator";

const getBreadcrumbs = (id: string | undefined, head: any) => [
	{title: "Nástěnka", href: "/nastenka"},
	{title: "Příkazy", href: "/prikazy"},
	{title: `Příkaz ${head?.Cislo_ZP || id}`, href: `/prikaz/${id}`},
];

const HlaseniPrikazu = () => {
	const {id} = useParams();
	const {getIntAdr, user, isUserLoading} = useAuth();
	const intAdr = getIntAdr();
	const location = useLocation();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();

	// Převezmi data z location state, pokud existují
	const locationData = location.state as { head?: any, predmety?: any[], useky?: any[], delka?: number } | null;

	const [head, setHead] = useState<any>(locationData?.head || null);
	const [predmety, setPredmety] = useState<any[]>(locationData?.predmety || []);
	const [useky, setUseky] = useState<any[]>(locationData?.useky || []);
	const [loading, setLoading] = useState(!locationData);
	const [saving, setSaving] = useState(false);
	const [reportLoaded, setReportLoaded] = useState(false);

	// Inicializace kroku z URL parametru
	const [activeStep, setActiveStep] = useState(() => {
		const stepParam = searchParams.get('step');
		const stepNumber = stepParam ? parseInt(stepParam, 10) : 0;
		return isNaN(stepNumber) || stepNumber < 0 || stepNumber > 2 ? 0 : stepNumber;
	});

	const [formData, setFormData] = useState<HlaseniFormData>({
		executionDate: new Date(),
		travelSegments: [{
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
		}],
		primaryDriver: "",
		vehicleRegistration: "",
		higherKmRate: false,
		accommodations: [],
		additionalExpenses: [],
		partACompleted: false,
		partBCompleted: false,
		timReports: {},
		routeComment: "",
		paymentRedirects: {}
	});

	const [priceList, setPriceList] = useState<PriceList | null>(null);

	// Načítání dat příkazu pouze pokud nejsou předána přes location
	useEffect(() => {
		if (locationData) {
			// Data už máme z location, nemusíme načítat
			setLoading(false);
			return;
		}

		setLoading(true);
		apiRequest("/insys/prikaz", "GET", {id})
			.then(result => {
				setHead(result.head || {});
				setPredmety(result.predmety || []);
				setUseky(result.useky || []);
			})
			.catch(err => {
				notifications.show({
					title: "Chyba",
					message: "Nepodařilo se načíst data příkazu",
					color: "red"
				});
				// Pokud se nepodaří načíst data, přesměruj zpět na příkaz
				navigate(`/prikaz/${id}`);
			})
			.finally(() => setLoading(false));
	}, [intAdr, id, locationData, navigate]);

	// Načítání existujícího hlášení z nového API endpointu
	useEffect(() => {
		if (!intAdr || !id) {
			setReportLoaded(true);
			return;
		}

		apiRequest("/portal/report", "GET", {id_zp: id})
			.then(result => {
				if (result && result.data_a) {
					// Převod dat z API do formData struktury
					const loadedData: Partial<HlaseniFormData> = {};

					// Načtení části A
					if (result.data_a) {
						Object.assign(loadedData, result.data_a);
						// Převod dat na Date objekty
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

					// Načtení části B
					if (result.data_b) {
						Object.assign(loadedData, result.data_b);
					}

					// Načtení výpočtu (pokud existuje)
					// calculation není součástí HlaseniFormData, tak ho můžeme přeskočit

					// Nastavení statusu
					if (result.state) {
						loadedData.status = result.state === 'send' ? 'submitted' : 'draft';
					}

					setFormData(prev => ({...prev, ...loadedData}));
				}
			})
			.catch(() => {
				// Report ještě neexistuje, to je v pořádku
			})
			.finally(() => {
				setReportLoaded(true);
			});
	}, [intAdr, id]);

	// Načítání ceníku při změně data provedení - až po načtení reportu a pokud je uživatel přihlášen
	useEffect(() => {
		if (!formData.executionDate || !reportLoaded || !intAdr || !user) return;

		const dateStr = formData.executionDate.toISOString().split('T')[0];
		apiRequest("/insys/ceniky", "GET", {date: dateStr})
			.then(result => {
				// Parsování API dat do standardizované struktury
				const parsedPriceList = parsePriceListFromAPI(result);
				setPriceList(parsedPriceList);
			})
			.catch(() => {
				notifications.show({
					title: "Upozornění",
					message: "Nepodařilo se načíst ceník pro dané datum",
					color: "yellow"
				});
			});
	}, [formData.executionDate, reportLoaded, intAdr, user]);


	// Validace kroku podle typu příkazu - odstraněno, nyní všechny příkazy mají část B

	const totalLength = useMemo(() => {
		if (head?.Druh_ZP !== "O" || !Array.isArray(useky) || useky.length === 0) return null;
		return useky.reduce((sum, usek) => sum + Number(usek.Delka_ZU || 0), 0);
	}, [useky, head?.Druh_ZP]);

	const isLeader = useMemo(() => {
		if (!user || !head) return false;
		return [1, 2, 3].some(i =>
			head[`INT_ADR_${i}`] === user.INT_ADR && head[`Je_Vedouci${i}`] === "1"
		);
	}, [user, head]);

	const canEditOthers = isLeader;

	const saveForm = async (showNotification = true, state = 'draft') => {
		setSaving(true);
		try {
			// Příprava dat pro API
			const dataA = {
				executionDate: formData.executionDate,
				travelSegments: formData.travelSegments.filter(segment => segment && segment.id),
				primaryDriver: formData.primaryDriver,
				vehicleRegistration: formData.vehicleRegistration,
				higherKmRate: formData.higherKmRate,
				accommodations: formData.accommodations,
				additionalExpenses: formData.additionalExpenses,
				partACompleted: formData.partACompleted,
				paymentRedirects: formData.paymentRedirects
			};

			const dataB = {
				timReports: formData.timReports,
				routeComment: formData.routeComment,
				routeAttachments: formData.routeAttachments,
				partBCompleted: formData.partBCompleted
			};

			// Výpočet náhrad pouze při finálním odeslání
			let calculation: any = null;
			if (state === 'send' && priceList) {
				// Výpočet kompenzací pomocí nového kalkulátoru
				// Jízdné se počítá pouze pokud je aktuální uživatel nastaven jako primární řidič
				const isDriver = Boolean(user && formData.primaryDriver === user.INT_ADR);
				const compensationResult = calculateCompensation(
					formData,
					priceList,
					isDriver,
					formData.higherKmRate,
					user?.INT_ADR
				);

				calculation = {
					...compensationResult,
					paymentRedirects: formData.paymentRedirects
				};
			}

			await apiRequest("/portal/report", "POST", {
				id_zp: parseInt(id || '0'),
				cislo_zp: head?.Cislo_ZP || '',
				je_vedouci: isLeader,
				data_a: dataA,
				data_b: dataB,
				calculation: calculation,
				state: state
			});

			if (showNotification) {
				notifications.show({
					title: "Uloženo",
					message: state === 'send' ? "Hlášení bylo úspěšně odesláno" : "Hlášení bylo úspěšně uloženo",
					color: "green"
				});
			}
		} catch (err) {
			notifications.show({
				title: "Chyba",
				message: state === 'send' ? "Nepodařilo se odeslat hlášení" : "Nepodařilo se uložit hlášení",
				color: "red"
			});
			throw err;
		} finally {
			setSaving(false);
		}
	};

	const updateFormData = (updates: Partial<HlaseniFormData>) => {
		setFormData(prev => ({...prev, ...updates}));
	};

	// Funkce pro změnu kroku s aktualizací URL
	const changeStep = (step: number) => {
		setActiveStep(step);
		const newSearchParams = new URLSearchParams(searchParams);
		if (step === 0) {
			newSearchParams.delete('step');
		} else {
			newSearchParams.set('step', step.toString());
		}
		setSearchParams(newSearchParams, {replace: true});
	};

	const canCompletePartA = useMemo(() => {
		// Kontrola povinných údajů pro dokončení části A
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
		].some(expense => expense.attachments.length === 0);

		return !hasDriverForCar && !hasTicketsForPublicTransport && !hasDocumentsForExpenses;
	}, [formData]);

	// Automatické označování částí jako dokončené
	useEffect(() => {
		const partACompleted = canCompletePartA;
		if (partACompleted !== formData.partACompleted) {
			updateFormData({partACompleted});
		}
	}, [canCompletePartA, formData.partACompleted]);

	// Automatické označování části B jako dokončené
	useEffect(() => {
		if (head?.Druh_ZP === "O") {
			// Pro obnovu vyžadujeme TIM reporty
			const partBCompleted = Object.keys(formData.timReports).length > 0;
			if (partBCompleted !== formData.partBCompleted) {
				updateFormData({partBCompleted});
			}
		} else {
			// Pro ostatní druhy vyžadujeme vyplněný komentář
			const partBCompleted = formData.routeComment.trim().length > 0;
			if (partBCompleted !== formData.partBCompleted) {
				updateFormData({partBCompleted});
			}
		}
	}, [formData.timReports, formData.routeComment, formData.partBCompleted, head?.Druh_ZP]);

	// Nastavení vyšší sazby podle hlavičky příkazu
	useEffect(() => {
		if (head?.ZvysenaSazba) {
			const shouldUseHigherRate = head.ZvysenaSazba === "1";
			if (shouldUseHigherRate !== formData.higherKmRate) {
				updateFormData({ higherKmRate: shouldUseHigherRate });
			}
		}
	}, [head?.ZvysenaSazba, formData.higherKmRate]);

	if (loading || isUserLoading || !user) {
		return (
			<RequireLogin>
				<Container size="lg" px={0} my="md">
					<Loader/>
				</Container>
			</RequireLogin>
		);
	}

	return (
		<RequireLogin>
			<Container size="lg" px={0} my="md">
				<Helmet>
					<title>{`Hlášení příkazu ${head?.Cislo_ZP || id || ''} | ${(window as any).kct_portal?.bloginfo?.name || 'Portal'}`}</title>
				</Helmet>
				<BreadcrumbsNav items={getBreadcrumbs(id, head)}/>
				<Title mb="xl" order={2}>
					Hlášení o provedení příkazu {head?.Cislo_ZP || id}
				</Title>

				{head && (
					<Card shadow="sm" mb="xl">
						<PrikazHead head={head} delka={totalLength}/>
					</Card>
				)}

				{/* Stepper navigace */}
				<Stepper
					active={activeStep}
					onStepClick={changeStep}
					size="md"
					mb="xl"
				>
					<Stepper.Step
						label="Část A - Vyúčtování"
						description={!formData.partACompleted && activeStep > 0 ? (
							<Badge color="orange" size="xs">Nedokončeno</Badge>
						) : "Doprava a výdaje"}
						icon={<IconCashBanknote size={18}/>}
						completedIcon={!formData.partACompleted ? <IconAlertSmall size={18}/> : undefined}
					/>
					<Stepper.Step
						label={head?.Druh_ZP === "O" ? "Část B - Stavy TIM" : "Část B - Hlášení o činnosti"}
						description={!formData.partBCompleted && activeStep > 1 ? (
							<Badge color="orange" size="xs">Nedokončeno</Badge>
						) : head?.Druh_ZP === "O" ? "Stav informačních míst" : "Hlášení značkařské činnosti"}
						icon={<IconSignRight size={18}/>}
						completedIcon={!formData.partBCompleted ? <IconAlertSmall size={18}/> : undefined}
					/>
					<Stepper.Step
						label="Odeslání"
						description="Kontrola a odeslání"
						icon={<IconSend size={18}/>}
					/>
				</Stepper>

				{/* Hlavní obsah */}
				{activeStep === 0 && (
					<>
						<Grid gutter="lg">
							{/* Část A - hlavní formulář */}
							<Grid.Col span={{base: 12, lg: 8}}>
								<PartAForm
									formData={formData}
									updateFormData={updateFormData}
									priceList={priceList}
									head={head}
									canEdit={formData.status !== 'submitted'}
									canEditOthers={canEditOthers}
									currentUser={user}
								/>

								{!canCompletePartA && (
									<Alert
										icon={<IconAlertTriangle size={16}/>}
										color="orange"
										variant="light"
										mt="md"
									>
										Vyplňte všechny povinné údaje
									</Alert>
								)}
							</Grid.Col>

							{/* Výpočet náhrad - sticky sidebar */}
							<Grid.Col span={{base: 12, lg: 4}}>
								<Box
									style={{
										position: 'sticky',
										top: 80
									}}
								>
									<Card shadow="sm" p="md">
										<Group mb="md" gap="xs">
											<IconReportMoney size={20}/>
											<Title order={4}>Výpočet náhrad</Title>
										</Group>

										<CompensationSummary
											formData={formData}
											priceList={priceList}
											head={head}
											totalLength={totalLength}
											compact={true}
											currentUser={user}
											isLeader={isLeader}
										/>
									</Card>
								</Box>
							</Grid.Col>
						</Grid>
						<Divider my="lg"/>
						<Group justify="end" gap="sm">
							<Button
								variant="outline"
								onClick={() => saveForm()}
								loading={saving}
							>
								Uložit změny
							</Button>

							<Button
								onClick={() => changeStep(1)}
							>
								Pokračovat na část B
							</Button>
						</Group>
					</>
				)}

				{/* Část B - pro všechny druhy příkazů */}
				{activeStep === 1 && (
					<>
						{head?.Druh_ZP === "O" ? (
							<PartBForm
								formData={formData}
								updateFormData={updateFormData}
								head={head}
								useky={useky}
								predmety={predmety}
								canEdit={canEditOthers}
								onSave={() => saveForm(false)}
							/>
						) : (
							<Card shadow="sm" padding="lg">
								<Title order={4} mb="md">Hlášení o značkařské činnosti</Title>

								<Stack gap="md">
									<Box>
										<Text fw={500} mb="xs">Hlášení o provedené činnosti</Text>
										<Text size="sm" c="dimmed" mb="sm">
											Popište provedenou značkařskou činnost, stav značení, případné problémy a
											návrhy na zlepšení.
										</Text>
										<Textarea
											placeholder="Popište provedenou značkařskou činnost..."
											value={formData.routeComment}
											onChange={(e) => updateFormData({routeComment: e.target.value})}
											minRows={6}
											disabled={formData.partBCompleted}
										/>
									</Box>

									<Box>
										<Text fw={500} mb="xs">Fotografické přílohy</Text>
										<Text size="sm" c="dimmed" mb="sm">
											Přiložte fotografie dokumentující provedenou činnost, stav značení,
											problémová místa apod.
										</Text>
										<FileUpload
											id="hlaseni-route-attachments"
											files={formData.routeAttachments || []}
											onFilesChange={(files) => updateFormData({routeAttachments: files})}
											maxFiles={20}
											accept="image/jpeg,image/png,image/heic,application/pdf"
											disabled={formData.partBCompleted}
										/>
									</Box>
								</Stack>
							</Card>
						)}

						<Divider my="lg"/>

						<Group justify="space-between">
							<Button
								variant="outline"
								onClick={() => changeStep(0)}
							>
								Zpět na část A
							</Button>

							<Group gap="sm">
								<Button
									variant="outline"
									onClick={() => saveForm()}
									loading={saving}
								>
									Uložit změny
								</Button>

								<Button
									onClick={() => changeStep(2)}
								>
									Pokračovat k odeslání
								</Button>
							</Group>
						</Group>
					</>
				)
				}

				{/* Krok 3 - Kontrola a odeslání */}
				{activeStep === 2 && (
					<Stack gap="lg">
						{/* Souhrn části A */}
						<Card shadow="sm" p="lg">
							<Group mb="md" gap="xs">
								<IconRoute size={20}/>
								<Title order={4}>Souhrn části A - Vyúčtování</Title>
							</Group>
							<Grid>
								<Grid.Col span={{base: 12, md: 6}}>
									<Stack gap="xs">
										<Group justify="space-between">
											<Text size="sm" c="dimmed">Datum provedení:</Text>
											<Text size="sm">{formData.executionDate.toLocaleDateString('cs-CZ')}</Text>
										</Group>
										<Group justify="space-between">
											<Text size="sm" c="dimmed">Počet segmentů dopravy:</Text>
											<Text size="sm">{formData.travelSegments.length}</Text>
										</Group>
										{formData.primaryDriver && (
											<Group justify="space-between">
												<Text size="sm" c="dimmed">Řidič:</Text>
												<Text size="sm">{formData.primaryDriver}</Text>
											</Group>
										)}
										{formData.vehicleRegistration && (
											<Group justify="space-between">
												<Text size="sm" c="dimmed">SPZ vozidla:</Text>
												<Text size="sm">{formData.vehicleRegistration}</Text>
											</Group>
										)}
									</Stack>
								</Grid.Col>
								<Grid.Col span={{base: 12, md: 6}}>
									<Stack gap="xs">
										<Group justify="space-between">
											<Text size="sm" c="dimmed">Ubytování:</Text>
											<Text size="sm">{formData.accommodations.length} nocí</Text>
										</Group>
										<Group justify="space-between">
											<Text size="sm" c="dimmed">Dodatečné výdaje:</Text>
											<Text size="sm">{formData.additionalExpenses.length} položek</Text>
										</Group>
										<Group justify="space-between">
											<Text size="sm" c="dimmed">Stav části A:</Text>
											<Badge color={formData.partACompleted ? "green" : "red"} size="sm">
												{formData.partACompleted ? "Dokončeno" : "Nedokončeno"}
											</Badge>
										</Group>
									</Stack>
								</Grid.Col>
							</Grid>
						</Card>

						{/* Souhrn části B */}
						<Card shadow="sm" p="lg">
							<Group mb="md" gap="xs">
								<IconInfoCircle size={20}/>
								<Title order={4}>
									Souhrn části B - {head?.Druh_ZP === "O" ? "Stavy TIM" : "Hlášení o činnosti"}
								</Title>
							</Group>
							<Grid>
								<Grid.Col span={{base: 12, md: 6}}>
									<Stack gap="xs">
										{head?.Druh_ZP === "O" ? (
											<Group justify="space-between">
												<Text size="sm" c="dimmed">Počet TIM:</Text>
												<Text size="sm">{Object.keys(formData.timReports).length}</Text>
											</Group>
										) : (
											<Group justify="space-between">
												<Text size="sm" c="dimmed">Hlášení vyplněno:</Text>
												<Text
													size="sm">{formData.routeComment.trim().length > 0 ? "Ano" : "Ne"}</Text>
											</Group>
										)}
										<Group justify="space-between">
											<Text size="sm" c="dimmed">Stav části B:</Text>
											<Badge color={formData.partBCompleted ? "green" : "red"} size="sm">
												{formData.partBCompleted ? "Dokončeno" : "Nedokončeno"}
											</Badge>
										</Group>
									</Stack>
								</Grid.Col>
								<Grid.Col span={{base: 12, md: 6}}>
									{formData.routeComment && (
										<Box>
											<Text size="sm" c="dimmed" mb="xs">
												{head?.Druh_ZP === "O" ? "Poznámka k trase:" : "Hlášení o činnosti:"}
											</Text>
											<Text size="sm">{formData.routeComment}</Text>
										</Box>
									)}
									{formData.routeAttachments && formData.routeAttachments.length > 0 && (
										<Box mt="xs">
											<Text size="sm" c="dimmed" mb="xs">Počet příloh:</Text>
											<Text size="sm">{formData.routeAttachments.length}</Text>
										</Box>
									)}
								</Grid.Col>
							</Grid>
						</Card>

						{/* Výpočet náhrad - kompletní souhrn */}
						<Card shadow="sm" p="lg">
							<Group mb="md" gap="xs">
								<IconReportMoney size={20}/>
								<Title order={4}>Celkový výpočet náhrad</Title>
							</Group>

							<CompensationSummary
								formData={formData}
								priceList={priceList}
								head={head}
								totalLength={totalLength}
								compact={false}
								currentUser={user}
								isLeader={isLeader}
							/>
						</Card>

						{/* Tlačítka pro odeslání */}
						<Card shadow="sm" p="lg" bg="gray.0"
							  style={{borderLeft: '4px solid var(--mantine-color-blue-6)'}}>
							<Stack>
								<Group gap="xs">
									<IconSend size={20}/>
									<Title order={4}>Potvrzení odeslání</Title>
								</Group>

								<Alert color="blue" variant="light">
									Zkontrolujte prosím všechny údaje před odesláním. Po odeslání již nebude možné
									hlášení upravovat.
								</Alert>

								<Group justify="space-between">
									<Button
										variant="outline"
										onClick={() => changeStep(1)}
									>
										Zpět na úpravy
									</Button>

									<Button
										size="lg"
										color="blue"
										leftSection={<IconSend size={20}/>}
										disabled={!formData.partACompleted || !formData.partBCompleted}
										loading={saving}
										onClick={async () => {
											// Odeslání ke schválení s state='send'
											try {
												await saveForm(true, 'send');
												navigate(`/prikaz/${id}`);
											} catch (err) {
												// Chyba už byla zobrazena v saveForm
											}
										}}
									>
										Odeslat ke schválení
									</Button>
								</Group>
							</Stack>
						</Card>
					</Stack>
				)
				}
			</Container>
		</RequireLogin>
	)
		;
};

export default HlaseniPrikazu;