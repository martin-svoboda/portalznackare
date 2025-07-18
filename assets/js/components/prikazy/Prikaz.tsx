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
	Box,
	Divider,
	Paper,
	Flex,
	Table,
	Button,
	Alert
} from "@mantine/core";
import {IconAlertTriangleFilled, IconPrinter} from "@tabler/icons-react";
import {useParams} from "react-router-dom";
import {apiCall} from "@services/api";
import {notifications} from "@mantine/notifications";
import {Helmet} from "react-helmet-async";
import {useAuth} from "@components/auth/AuthContext";
import {
	MantineReactTable,
	useMantineReactTable,
	type MRT_ColumnDef,
} from 'mantine-react-table';
import {MRT_Localization_CS} from "mantine-react-table/locales/cs";
import {BreadcrumbsNav} from "@components/shared/BreadcrumbsNav";
import NahledTim from "@components/shared/NahledTim";
import {barvaDleKodu} from "@utils/colors";
import {Znacka} from "@components/shared/Znacka";
import MapaTrasy from "@components/shared/MapaTrasy";
import {PrikazStavBadge} from "./PrikazStavBadge";
import {PrikazTypeIcon} from "./PrikazTypeIcon";
import RequireLogin from "@components/auth/RequireLogin";
import {formatKm, formatUsekType, formatTimStatus} from "@utils/formatting";
import {PrikazHead} from "./components/PrikazHead";
import {ProvedeniPrikazu} from "./components/ProvedeniPrikazu";
import {replaceTextWithIcons} from "@components/shared/textIconReplacer";
import {usePdfGenerator} from "@hooks/usePdfGenerator";

function groupByEvCiTIM(rows: any[]) {
	const groups: Record<string, any> = {};
	rows.forEach(row => {
		if (!row.EvCi_TIM) return;
		if (!groups[row.EvCi_TIM]) {
			groups[row.EvCi_TIM] = {
				EvCi_TIM: row.EvCi_TIM,
				Naz_TIM: row.Naz_TIM,
				Stav_TIM: row.Stav_TIM,
				Stav_TIM_Nazev: row.Stav_TIM_Nazev,
				NP: row.NP,
				GPS_Sirka: row.GPS_Sirka,
				GPS_Delka: row.GPS_Delka,
				items: []
			}
		}
		groups[row.EvCi_TIM].items.push(row);
	});
	return Object.values(groups);
}

// Breadcrumbs
const breadcrumb = [
	{title: "Nástěnka", href: "/nastenka"},
	{title: "Příkazy", href: "/prikazy"},
];

const isNezpracovany = (stav: string) => stav === 'Přidělený' || stav === 'Vystavený';

// Funkce pro validaci jednoho předmětu
function validateSingleItem(item: any) {
	const errors: string[] = [];

	// Chybí Predmet_Index
	if (!item.Predmet_Index) {
		errors.push("Neznámý index předmětu");
	}

	// Neznámý Druh_Predmetu
	if (!item.Druh_Predmetu) {
		errors.push("Neznámý druh předmětu");
	}

	// Pro směrovky (S nebo D)
	if (item.Druh_Predmetu === 'S' || item.Druh_Predmetu === 'D') {
		if (!item.Druh_Presunu) {
			errors.push("Směrovka pro neznámý druh přesunu");
		}

		if (!item.Smerovani) {
			errors.push("Směrovka bez identifikace směrování");
		}
	}

	// Pro hlavní směrovky
	if (item.Druh_Predmetu === 'S') {
		if (!item.Barva) {
			errors.push("Směrovka bez identifikace barvy");
		}

		if (!item.Druh_Odbocky_Kod && !item.Druh_Znaceni_Kod) {
			errors.push("Směrovka bez identifikace odbočky nebo druhu značení");
		}
	}

	return errors;
}

// Funkce pro validaci dat předmětů
function validatePredmety(predmety: any[]) {
	const errors: string[] = [];

	predmety.forEach((item: any, index: number) => {
		const itemId = item.EvCi_TIM + (item.Predmet_Index || '?');
		const itemErrors = validateSingleItem(item);

		itemErrors.forEach(error => {
			errors.push(`${itemId}: ${error}`);
		});
	});

	return errors;
}

// Funkce pro řazení značek podle priority
function sortZnacky(items: any[]) {
	// Pořadí priorit
	const druhPresunuOrder = ['CZT', 'LZT', 'PZT', 'VZT'];
	const druhZnaceniKodOrder = ['PA', 'CT', 'MI', 'NS', 'SN'];
	const barvaKodOrder = ['CE', 'MO', 'ZE', 'ZL', 'BI'];

	// Funkce pro získání indexu v pořadí (nižší = vyšší priorita)
	const getDruhPresunuIndex = (item: any) => {
		const index = druhPresunuOrder.indexOf(item.Druh_Presunu);
		return index === -1 ? 999 : index;
	};

	const getDruhZnaceniKodIndex = (item: any) => {
		const kod = item.Druh_Znaceni_Kod;
		const index = druhZnaceniKodOrder.indexOf(kod);
		return index === -1 ? 999 : index;
	};

	const getBarvaKodIndex = (item: any) => {
		const index = barvaKodOrder.indexOf(item.Barva_Kod);
		return index === -1 ? 999 : index;
	};

	return items.sort((a: any, b: any) => {
		// 1. Řazení podle Druh_Presunu
		const presunDiff = getDruhPresunuIndex(a) - getDruhPresunuIndex(b);
		if (presunDiff !== 0) return presunDiff;

		// 2. Řazení podle Druh_Znaceni_Kod
		const znaceniDiff = getDruhZnaceniKodIndex(a) - getDruhZnaceniKodIndex(b);
		if (znaceniDiff !== 0) return znaceniDiff;

		// 3. Řazení podle Barva_Kod
		return getBarvaKodIndex(a) - getBarvaKodIndex(b);
	});
}

const PrikazUseky = ({useky}: { useky: any[] }) => {
	const rows = useky.map((usek) => (
		<Table.Tr key={usek.Kod_ZU}>
			<Table.Td><Znacka color={usek.Barva_Kod} move={usek.Druh_Presunu}
						  shape={usek.Druh_Odbocky_Kod || usek.Druh_Znaceni_Kod} size={30}/></Table.Td>
			<Table.Td>{replaceTextWithIcons(usek.Nazev_ZU, 14)}</Table.Td>
			<Table.Td>
				<Group gap="xs" justify="space-around" wrap="wrap">
					{formatKm(usek.Delka_ZU)} Km
					<Badge autoContrast color={barvaDleKodu(usek.Barva_Kod)}>{usek.Barva_Naz}</Badge>
					{usek.Druh_Odbocky || usek.Druh_Znaceni}
				</Group>
			</Table.Td>
		</Table.Tr>
	));

	return (
		<>
			<Table>
				<Table.Tbody>{rows}</Table.Tbody>
			</Table>
		</>
	);
}

const Prikaz = () => {
	const {id} = useParams();
	const {getIntAdr} = useAuth();
	const intAdr = getIntAdr();
	const {generatePDF, isGenerating} = usePdfGenerator();

	const [head, setHead] = useState<any>(null);
	const [predmety, setPredmety] = useState<any[]>([]);
	const [useky, setUseky] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Počkej až bude intAdr dostupný
		if (!intAdr) return;

		setLoading(true);
		apiCall("/insys/prikaz", "GET", {id})
			.then(result => {
				console.log(result);
				setHead(result.head || {});
				setPredmety(result.predmety || []);
				setUseky(result.useky || []);
			})
			.catch(err => {
				setHead(null);
				setPredmety([]);
				setUseky([]);
			})
			.finally(() => setLoading(false));
	}, [intAdr, id]);

	const tableData = useMemo(
		() => Array.isArray(predmety) ? [...predmety].sort((a, b) => Number(a.Poradi ?? 0) - Number(b.Poradi ?? 0)) : [],
		[predmety]
	);

	const groupedData = useMemo(
		() => groupByEvCiTIM(tableData),
		[tableData]
	);

	// Detekce speciálního stavu - jedna položka bez EvCi_TIM se Stav a Popis
	const specialAlert = useMemo(() => {
		if (predmety.length === 1 && !predmety[0].EvCi_TIM && predmety[0].Stav && predmety[0].Popis) {
			return {
				title: predmety[0].Stav,
				message: predmety[0].Popis
			};
		}
		return null;
	}, [predmety]);

	const soubeh = useMemo(() => {
		if (head?.Druh_ZP !== "O" || !Array.isArray(predmety)) return [];
		const set = new Set();
		const uniqueItems = predmety
			.filter(item => item.Barva && item.Druh_Presunu)
			.map(item => ({
				Barva: item.Barva,
				Barva_Kod: item.Barva_Kod,
				Druh_Presunu: item.Druh_Presunu,
				Druh_Znaceni: item.Druh_Znaceni,
				Druh_Znaceni_Kod: item.Druh_Znaceni_Kod,
				Druh_Odbocky: item.Druh_Odbocky,
				Druh_Odbocky_Kod: item.Druh_Odbocky_Kod
			}))
			.filter((item) => {
				const key = `${item.Barva}|${item.Barva_Kod}|${item.Druh_Presunu}|${item.Druh_Znaceni_Kod || ''}|${item.Druh_Odbocky_Kod || ''}`;
				if (set.has(key)) return false;
				set.add(key);
				return true;
			});

		// Seřazení podle priorit
		return sortZnacky(uniqueItems);
	}, [predmety]);

	const delka = useMemo(() => {
		if (undefined == useky || head?.Druh_ZP !== "O" || !Array.isArray(useky) || useky.length === 0) return null;
		return useky.reduce((sum, usek) => sum + Number(usek.Delka_ZU || 0), 0);
	}, [useky, head?.Druh_ZP]);

	const mapPoints = useMemo(
			() =>
				groupedData
					.filter(d => !!d.GPS_Sirka && !!d.GPS_Delka)
					.map(d => ({
						lat: Number(d.GPS_Sirka),   // GPS_Sirka = latitude
						lon: Number(d.GPS_Delka),   // GPS_Delka = longitude
						content: (
							<p>
								<strong>{d.Naz_TIM}</strong>
								<br/>
								{d.EvCi_TIM}
							</p>
						),
					})),
			[groupedData]
		)
	;

	const mapData = useMemo(() => {
		const firstUsek = useky?.[0];
		const druhPresunu = firstUsek?.Druh_Presunu;

		return {
			title: head?.Druh_ZP == "O" ? "Mapa trasy" : "Mapa TIM",
			points: mapPoints,
			route: "O" === head?.Druh_ZP,
			druhPresunu: druhPresunu || "PZT"
		};
	}, [mapPoints, head?.Druh_ZP, useky]);

	const columns = useMemo<MRT_ColumnDef<any>[]>(
		() => [
			{
				accessorKey: 'EvCi_TIM',
				header: 'Ev. číslo',
				size: 80,
			},
			{
				accessorKey: 'Naz_TIM',
				header: 'Místo',
				size: 100,
				Cell: ({row}) => {
					return replaceTextWithIcons(row.original.Naz_TIM, 14)
				}
			},
			{accessorKey: "NP", header: "Montáž", size: 100},
			{
				accessorKey: "Stav_TIM_Nazev",
				header: "Stav",
				size: 40,
			},
		],
		[]
	);

	const handlePrintPDF = async () => {
		// TODO: Implementovat až bude PrintablePrikaz připraven
		notifications.show({
			title: 'Info',
			message: 'PDF generování bude implementováno později',
			color: 'blue'
		});
	};

	const table = useMantineReactTable({
		columns,
		data: groupedData,
		enableFacetedValues: true,
		enableColumnFilters: false,
		enableColumnActions: false,
		enableColumnOrdering: false,
		enableColumnResizing: false,
		enablePagination: false,
		enableSorting: false,
		enableRowActions: false,
		enableTopToolbar: false,
		enableBottomToolbar: false,
		state: {isLoading: loading},
		localization: MRT_Localization_CS,
		initialState: {
			density: 'xs',
			expanded: {},
			columnVisibility: {
				NP: window.innerWidth > 768,
				Stav_TIM_Nazev: window.innerWidth > 768,
			}
		},
		mantineTableProps: {
			withTableBorder: false,
			highlightOnHover: false,
		},
		mantinePaperProps: {
			style: {'--mrt-base-background-color': "light-dark(white, var(--mantine-color-dark-7))"},
			shadow: 'none',
			withBorder: false
		},
		mantineTableBodyCellProps: {style: {whiteSpace: 'normal'}},
		renderDetailPanel: ({row}) => (
			<>
				<Text size="sm" c="dimmed" hiddenFrom="sm">Montáž: {row.original.NP}</Text>
				<Text size="sm" c="dimmed" hiddenFrom="sm">Stav: {row.original.Stav_TIM_Nazev}</Text>
				<Stack gap="sm">
					{row.original.items?.map((item: any, i: number) => {
						const itemErrors = validateSingleItem(item);
						const alertIcon = <IconAlertTriangleFilled/>;

						return (
							<>
								<Divider/>
								<Flex w="100%" key={i} gap="md" align="center" wrap="wrap">
									<NahledTim item={item}/>
									<Flex
										gap="md"
										wrap="wrap"
									>
										<Box>
											<Text fw={700}>{item.Druh_Predmetu_Naz}</Text>
											{item.Smerovani && (
												<Text size="sm" c="dimmed">
													{item.Smerovani === 'P' ? 'Pravá' : item.Smerovani === 'L' ? 'Levá' : item.Smerovani}
												</Text>
											)}
											{item.Druh_Odbocky && (
												<Text size="sm" c="dimmed">
													{item.Druh_Odbocky}
												</Text>
											)}
										</Box>
										<Box>
											{item.Barva && (
												<Badge autoContrast
													   color={barvaDleKodu(item.Barva_Kod)}>{item.Barva}</Badge>
											)}
										</Box>
										<Box>
											<Text size="sm" c="dimmed">{item.Druh_Presunu} {item.Druh_Znaceni}</Text>
											<Text size="sm">ID: {item.EvCi_TIM + item.Predmet_Index}</Text>
										</Box>
										{itemErrors.length > 0 && (
											<Alert variant="light" color="red" mb="sm" icon={alertIcon}>
												<ul style={{margin: 0, paddingLeft: '20px'}}>
													{itemErrors.map((error, index) => (
														<li key={index}>{error}</li>
													))}
												</ul>
											</Alert>
										)}
									</Flex>
								</Flex>
							</>
						)
					})}
				</Stack>
			</>
		),
	});

	return (
		<RequireLogin>
			<Container size="lg" px={0} my="md">
				<Helmet>
					<title>{`Příkaz ${head?.Cislo_ZP || id || ''} | Portál značkaře`}</title>
				</Helmet>
				<BreadcrumbsNav items={breadcrumb}/>
				<Title mb="xl" order={2}>
					Značkařský příkaz {head?.Cislo_ZP || id}
				</Title>
				<Card shadow="sm" mb="xl">
					{loading ? (
						<Loader/>
					) : (
						<PrikazHead head={head} delka={delka}/>
					)}
				</Card>
				{(useky.length > 0 || soubeh.length > 1) &&
					<Card shadow="sm" padding="sm" mb="xl">
						<Title order={3} mb="sm">Úseky tras k obnově</Title>
						<PrikazUseky useky={useky}/>
						{soubeh && soubeh.length > 1 && (
							<>
								<Divider my="xs"/>

								<Group gap="sm" wrap="wrap">
									<Text fw={700} fz="md">
										Možný souběh/křížení tras:
									</Text>
									<Group gap="xs" wrap="wrap">
										{soubeh.map((row: any, index: number) => (
											<Znacka key={index} color={row.Barva_Kod} move={row.Druh_Presunu}
													shape={row.Druh_Odbocky_Kod || row.Druh_Znaceni_Kod} size={30}/>
										))}
									</Group>
								</Group>
							</>
						)}
					</Card>
				}

				{/* Sekce Provedení příkazu */}
				<Card shadow="sm" padding="sm" mb="xl">
					{loading ? (
						<Loader/>
					) : head && head.Stav_ZP_Naz && (
						<ProvedeniPrikazu
							prikazId={id!}
							head={head}
							useky={useky}
							predmety={predmety}
							delka={delka}
						/>
					)}
					{head && head.Stav_ZP_Naz && isNezpracovany(head.Stav_ZP_Naz) && (
						<>
							<Divider my="xs"/>
							<Group>
								<Button
									variant="outline"
									leftSection={<IconPrinter size={16}/>}
									onClick={handlePrintPDF}
									loading={isGenerating}
								>
									Kontrolní formulář PDF
								</Button>
							</Group>
						</>
					)}
				</Card>

				<Card shadow="sm" padding="sm" mb="xl">
					<Title order={3} mb="sm">Informační místa na trase</Title>
					{specialAlert ? (
						<Alert variant="light" color="red" mb="md" title={specialAlert.title}
							   icon={<IconAlertTriangleFilled/>}>
							{specialAlert.message}
						</Alert>
					) : (
						<MantineReactTable table={table}/>
					)}
				</Card>
				{mapPoints.length > 0 && (
					<Card shadow="sm" mb="xl">
						{loading ? (
							<Loader/>
						) : (
							<MapaTrasy data={mapData}/>
						)}
					</Card>
				)}
			</Container>
		</RequireLogin>
	);
};

export default Prikaz;