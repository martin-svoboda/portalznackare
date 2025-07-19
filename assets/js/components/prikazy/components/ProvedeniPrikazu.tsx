import React, {useEffect, useState} from "react";
import {
	Card,
	Title,
	Text,
	Button,
	Badge,
	Group,
	Stack,
	Grid,
	Box,
	Loader,
	Alert, Divider
} from "@mantine/core";
import {
	IconCheck,
	IconEdit,
	IconEye,
	IconPlus,
	IconReportMoney,
	IconCalendar,
	IconAlertTriangle,
	IconUser
} from "@tabler/icons-react";
import {useNavigate} from "react-router-dom";
import {apiCall} from "@services/api";
import {useAuth} from "@components/auth/AuthContext";
import {notifications} from "@mantine/notifications";

interface ProvedeniPrikazuProps {
	prikazId: string;
	head: any;
	useky: any[];
	predmety: any[];
	delka?: number | null;
}

interface ReportData {
	id: number;
	id_zp: number;
	cislo_zp: string;
	int_adr: number;
	je_vedouci: boolean;
	data_a?: any;
	data_b?: any;
	calculation?: any;
	state: string;
	date_send?: string;
	date_created: string;
	date_updated: string;
}

export const ProvedeniPrikazu: React.FC<ProvedeniPrikazuProps> = ({
																	  prikazId,
																	  head,
																	  useky,
																	  predmety,
																	  delka
																  }) => {
	const navigate = useNavigate();
	const {getIntAdr, user} = useAuth();
	const intAdr = getIntAdr();

	const [reportData, setReportData] = useState<ReportData | null>(null);
	const [allReports, setAllReports] = useState<ReportData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Načítání dat reportu pro aktuálního uživatele a všechny členy skupiny
	useEffect(() => {
		if (!intAdr || !prikazId || !head) {
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);

		// Načtení reportu pro aktuálního uživatele
		const loadUserReport = apiCall("/portal/report", "GET", {id_zp: prikazId})
			.then(result => {
				// Zkontroluj jestli je result null, prázdný, nebo obsahuje smysluplná data
				if (result && typeof result === 'object' && Object.keys(result).length > 0 && result.id_zp) {
					setReportData(result);
				} else {
					setReportData(null);
				}
			})
			.catch(err => {
				console.log('User report does not exist yet:', err);
				setReportData(null);
			});

		// Načtení reportů pro všechny členy skupiny
		const loadAllReports = Promise.all(
			[1, 2, 3]
				.map(i => head[`INT_ADR_${i}`])
				.filter(adr => adr && adr > 0 && adr != intAdr)
				.map(adr =>
					apiCall("/portal/report", "GET", {int_adr: adr, id_zp: prikazId})
						.then(result => {
							// Zkontroluj jestli je result validní hlášení
							if (result && typeof result === 'object' && Object.keys(result).length > 0 && result.id_zp) {
								return result;
							}
							return null;
						})
						.catch(() => null)
				)
		).then(results => {
			const validReports = results.filter(report => report !== null);
			setAllReports(validReports);
		});

		Promise.all([loadUserReport, loadAllReports])
			.finally(() => {
				setLoading(false);
			});
	}, [intAdr, prikazId, head]);

	const handleHlaseni = (action: 'create' | 'edit' | 'view') => {
		// Předáme data přes state při navigaci
		navigate(`/prikaz/${prikazId}/hlaseni`, {
			state: {
				head,
				predmety,
				useky,
				delka
			}
		});
	};

	const getStatusBadge = (state: string) => {
		switch (state) {
			case 'send':
				return <Badge color="green" leftSection={<IconCheck size={14}/>}>Odesláno</Badge>;
			case 'draft':
				return <Badge color="orange" leftSection={<IconEdit size={14}/>}>Rozepsáno</Badge>;
			default:
				return <Badge color="gray">Neznámý stav</Badge>;
		}
	};

	const getActionButton = () => {
		if (!reportData) {
			return (
				<Button
					color="blue"
					leftSection={<IconPlus size={16}/>}
					onClick={() => handleHlaseni('create')}
				>
					Podat hlášení
				</Button>
			);
		}

		if (reportData.state === 'send') {
			return (
				<Button
					variant="outline"
					leftSection={<IconEye size={16}/>}
					onClick={() => handleHlaseni('view')}
				>
					Zobrazit hlášení
				</Button>
			);
		}

		return (
			<Button
				color="blue"
				leftSection={<IconEdit size={16}/>}
				onClick={() => handleHlaseni('edit')}
			>
				Upravit hlášení
			</Button>
		);
	};

	const formatDate = (dateString: string) => {
		if (!dateString) return 'Neuvedeno';
		try {
			return new Date(dateString).toLocaleDateString('cs-CZ', {
				year: 'numeric',
				month: 'numeric',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return 'Neplatné datum';
		}
	};

	const getCompletionSummary = () => {
		if (!reportData?.data_a && !reportData?.data_b) return null;

		const partACompleted = reportData.data_a?.partACompleted || false;
		const partBCompleted = reportData.data_b?.partBCompleted || false;

		return (
			<Stack gap="xs">
				<Badge color={partACompleted ? "green" : "red"} size="sm">
					Část A: {partACompleted ? "Dokončeno" : "Nedokončeno"}
				</Badge>
				<Badge color={partBCompleted ? "green" : "red"} size="sm">
					Část B: {partBCompleted ? "Dokončeno" : "Nedokončeno"}
				</Badge>
			</Stack>
		);
	};

	if (loading) {
		return (
			<>
				<Group justify="space-between" mb="md">
					<Title order={3}>Provedení příkazu</Title>
				</Group>
				<Loader size="sm"/>
			</>
		);
	}

	return (
		<>
			<Group justify="space-between" mb="md">
				<Title order={3}>Provedení příkazu</Title>
				{getActionButton()}
			</Group>

			{error && (
				<Alert color="red" mb="md" icon={<IconAlertTriangle size={16}/>}>
					{error}
				</Alert>
			)}

			{reportData ? (
				<>
					<Title order={4} mb="md">Vaše hlášení</Title>
					<Grid mb="lg">
						<Grid.Col span={{base: 12, md: 6, lg: 3}}>
							<Stack gap="sm">
								{getStatusBadge(reportData.state)}
								{getCompletionSummary()}
							</Stack>
						</Grid.Col>

						<Grid.Col span={{base: 12, md: 6, lg: 3}}>
							<Stack gap="sm">
								<Text size="sm" c="dimmed">Provedení:</Text>
								{reportData.data_a?.executionDate && (
									<Text size="sm">
										{new Date(reportData.data_a.executionDate).toLocaleDateString('cs-CZ')}
									</Text>
								)}

								<Group gap="sm">
									<Text size="sm" c="dimmed">Vedoucí:</Text>
									<Badge color={reportData.je_vedouci ? "blue" : "gray"}>
										{reportData.je_vedouci ? "Ano" : "Ne"}
									</Badge>
								</Group>
							</Stack>
						</Grid.Col>

						<Grid.Col span={{base: 12, md: 6, lg: 3}}>
							<Stack gap="sm">
								{reportData.data_a?.travelSegments && (
									<>
										<Text size="sm" c="dimmed">Segmenty dopravy:</Text>
										{reportData.data_a.travelSegments.length > 0 && reportData.data_a.travelSegments.map((segment: any, i: number) => (
											<Text size="sm" key={i}>
												{segment.startPlace} – {segment.endPlace}
											</Text>
										))}

									</>
								)}
							</Stack>
						</Grid.Col>

						<Grid.Col span={{base: 12, md: 6, lg: 3}}>
							<Stack gap="sm">
								{reportData.data_a?.accommodations && (
									<Group>
										<Text size="sm" c="dimmed">Nocí ubytování:</Text>
										<Text size="sm">{reportData.data_a.accommodations.length}</Text>
									</Group>
								)}

								{reportData.data_a?.additionalExpenses && (
									<Group>
										<Text size="sm" c="dimmed">Dodatečné výdaje:</Text>
										<Text size="sm">{reportData.data_a.additionalExpenses.length} položek</Text>
									</Group>
								)}
							</Stack>
						</Grid.Col>
					</Grid>
				</>
			) : (
				<Text c="dimmed">
					Vaše hlášení ještě nebylo vytvořeno
				</Text>
			)}

			{/* Přehled hlášení ostatních členů skupiny */}
			{allReports.length > 0 && (
				<>
					<Divider/>
					<Title order={4} mb="md">Hlášení ostatních členů skupiny</Title>
					<Stack gap="sm">
						{allReports
							.map(report => (
								<>
									<Box key={report.id}>
										<Group justify="space-between">
											<Group gap="sm">
												<IconUser size={16}/>
												<Text size="sm" fw={500}>INT_ADR: {report.int_adr}</Text>
												{report.je_vedouci && (
													<Badge size="xs" color="blue">Vedoucí</Badge>
												)}
											</Group>
											{getStatusBadge(report.state)}
										</Group>

										<Group gap="sm" mt="xs">
											{report.data_a?.executionDate && (
												<Text size="xs" c="dimmed">
													Datum: {new Date(report.data_a.executionDate).toLocaleDateString('cs-CZ')}
												</Text>
											)}
											{report.date_send && (
												<Text size="xs" c="dimmed">
													Odesláno: {formatDate(report.date_send)}
												</Text>
											)}
										</Group>
									</Box>
									<Divider/>
								</>
							))}
					</Stack>
				</>
			)}
		</>
	);
};