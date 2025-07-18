import {
	Container,
	Title,
	Text,
	Table,
	Card,
	Group,
	ActionIcon,
	Box,
	Select,
	Menu,
	Loader, ThemeIcon, Switch,
} from '@mantine/core';
import {
	IconEdit,
	IconCashBanknote, IconCheckbox,
} from '@tabler/icons-react';
import {
	MantineReactTable,
	useMantineReactTable,
	type MRT_ColumnDef,
} from 'mantine-react-table';
import {MRT_Localization_CS} from 'mantine-react-table/locales/cs';
import {useEffect, useMemo, useState} from 'react';
import {useAuth} from '@components/auth/AuthContext';
import {apiCall} from '@services/api';
import {notifications} from '@mantine/notifications';
import RequireLogin from '@components/auth/RequireLogin';
import {Helmet} from "react-helmet-async";
import {useNavigate, useSearchParams} from "react-router-dom";
import {
	IconBrush,
	IconTool,
	IconHammer,
	IconSignLeft,
	IconCrown
} from "@tabler/icons-react";
import {BreadcrumbsNav} from "@components/shared/BreadcrumbsNav";
import {PrikazStavBadge} from "./PrikazStavBadge";
import {PrikazTypeIcon} from "./PrikazTypeIcon";
import {replaceTextWithIcons} from "@components/shared/textIconReplacer";

const getAvailableYears = () => {
	const currentYear = new Date().getFullYear();
	return Array.from({length: 5}, (_, i) => `${currentYear - i}`);
};

// Drobežková navigace
const breadcrumb = [
	{title: "Nástěnka", href: "/nastenka"},
];

const ProtectedContent = () => {
	const {getIntAdr} = useAuth();
	const intAdr = getIntAdr();
	const [data, setData] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const isNezpracovany = (stav: string) => stav === 'Přidělený' || stav === 'Vystavený';

	// Inicializace filtrů z URL (vždy, ne jen při návratu)
	const [year, setYear] = useState<string>(() => {
		return searchParams.get('year') || '';
	});

	const [showOnlyToProcess, setShowOnlyToProcess] = useState(() => {
		return searchParams.get('process') === 'true';
	});

	// Aktualizace URL parametrů při změně filtrů
	const updateUrlParams = (newYear: string, newShowOnlyToProcess: boolean) => {
		const params = new URLSearchParams();
		if (newYear) params.set('year', newYear);
		if (newShowOnlyToProcess) params.set('process', 'true');
		setSearchParams(params, { replace: true });
	};

	// Handlery pro změny filtrů
	const handleYearChange = (val: string | null) => {
		const newYear = val || '';
		setYear(newYear);
		updateUrlParams(newYear, showOnlyToProcess);
		// Načti data s novým rokem
		if (intAdr) {
			fetchData(newYear || undefined);
		}
	};

	const handleShowOnlyToProcessChange = (checked: boolean) => {
		setShowOnlyToProcess(checked);
		updateUrlParams(year, checked);
		// Při změně filtru "jen ke zpracování" nemusíme volat API znovu
		// protože filtrování se dělá na straně klienta
	};

	// Handler pro navigaci na detail
	const handleDetailClick = (prikazId: string) => {
		navigate(`/prikaz/${prikazId}`);
	};

	const fetchData = async (selectedYear?: string) => {
		setLoading(true);
		setError(null);
		try {
			const params: Record<string, any> = {int_adr: intAdr};
			if (selectedYear) params.year = selectedYear;
			const result = await apiCall('/insys/prikazy', 'GET', params);
			setData(result);
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	// Načtení dat při mount nebo změně intAdr
	useEffect(() => {
		if (!intAdr) return;
		// Načti data s aktuálním rokem z URL (pokud existuje)
		fetchData(year || undefined);
	}, [intAdr]); // Pouze při změně intAdr, ne při změně year

	const druhZPIkona: Record<string, any> = {
		O: IconBrush,      // Obnova – štětec
		N: IconTool,       // Nová – nářadí
		S: IconSignLeft,   // Směrovky/rozcestníky – směrovka
	};

	const sortedData = useMemo(() => {
		let sorted = [...data].sort((a, b) => {
			const aActive = isNezpracovany(a.Stav_ZP_Naz);
			const bActive = isNezpracovany(b.Stav_ZP_Naz);
			return aActive === bActive ? 0 : aActive ? -1 : 1;
		});
		if (showOnlyToProcess) {
			sorted = sorted.filter((row) => isNezpracovany(row.Stav_ZP_Naz));
		}
		return sorted;
	}, [data, showOnlyToProcess]);

	const columns = useMemo<MRT_ColumnDef<any>[]>(
		() => [
			{accessorKey: 'Cislo_ZP', header: 'Číslo ZP', size: 100},
			{
				accessorKey: 'Druh_ZP_Naz',
				header: 'Druh ZP',
				size: 120,
				filterVariant: 'select',
				Cell: ({row}) => {
					const kod = row.original.Druh_ZP;
					const IconComponent = druhZPIkona[kod] || IconHammer; // Default: kladivo
					return (
						<Group gap="xs" align="center" wrap="nowrap">
							<PrikazTypeIcon
								type={row.original.Druh_ZP}
								size={28}
							/>
							<span>{row.original.Druh_ZP_Naz}</span>
						</Group>
					);
				},
			},
			{
				accessorKey: 'Popis_ZP',
				header: 'Popis',
				size: 300,
				Cell: ({row}) => {
					return replaceTextWithIcons(row.original.Popis_ZP, 14)
				}
			},
			{
				accessorKey: 'Stav_ZP_Naz',
				header: 'Stav',
				size: 150,
				filterVariant: 'select',
				Cell: ({row}) => {
					return (
						<PrikazStavBadge stav={row.original.Stav_ZP_Naz}/>
					);
				},
			},
			{accessorKey: 'Znackar', header: 'Značkař', size: 100, filterVariant: 'autocomplete'},
			{
				accessorKey: 'Je_Vedouci',
				header: 'Ved.',
				size: 40,
				Cell: ({cell}) =>
					cell.getValue() === '1' || cell.getValue() === 1
						? <ThemeIcon variant="light" color="yellow"><IconCrown 
																			  aria-label="Vedoucí"/></ThemeIcon>
						: null,
				enableColumnFilter: false,
				meta: {align: 'center'}
			},
			{accessorKey: 'Vyuctovani', header: 'Vyúč.', size: 50, filterVariant: 'select'},
		],
		[]
	);

	const table = useMantineReactTable({
		columns,
		data: sortedData,
		enableFacetedValues: true,
		enableColumnFilters: true,
		enablePagination: data.length > 20,
		enableSorting: false,
		//enableRowActions: true,
		enableDensityToggle: false,
		enableFullScreenToggle: false,
		enableColumnResizing: false,
		layoutMode: 'semantic',
		state: {isLoading: loading},
		localization: MRT_Localization_CS,
		initialState: {columnVisibility: {Znackar: false, Trida_OTZ: false}},
		mantineTableProps: {
			withTableBorder: false,
			highlightOnHover: true,
		},
		mantinePaperProps: {
			style: {'--mrt-base-background-color': "light-dark(white, var(--mantine-color-dark-7))"},
			shadow: 'none',
			withBorder: false
		},
		mantineTopToolbarProps: {
			style: {
				position: 'relative',
			},
		},
		mantineTableBodyRowProps: ({row}) => {
			const isActive = isNezpracovany(row.original.Stav_ZP_Naz);
			return {
				style: {
					cursor: 'pointer',
					...(isActive
						? {
							background: 'var(--mantine-color-blue-light)',
							fontWeight: 600,
						}
						: {
							opacity: 0.7,
						}),
				},
				onClick: () => handleDetailClick(row.original.ID_Znackarske_Prikazy),
			};
		},
		renderTopToolbarCustomActions: () => (
			<Group align="center" gap="xs">
				<Select
					size="xs"
					w={110}
					placeholder="Aktuální rok"
					data={getAvailableYears()}
					value={year}
					onChange={handleYearChange}
					aria-label="Výběr roku"
				/>
				<Switch
					size="xs"
					checked={showOnlyToProcess}
					onChange={(e) => handleShowOnlyToProcessChange(e.currentTarget.checked)}
					label="Jen ke zpracování"
				/>
			</Group>
		),
	});

	return (
		<Container size="lg" px={0} my="md">
			<BreadcrumbsNav items={breadcrumb}/>
			<Title mb="md" order={2}>Vaše příkazy</Title>
			<Card shadow="sm" padding="sm">
				<MantineReactTable table={table}/>
			</Card>
		</Container>
	);
};

const Prikazy = () => (
	<>
		<Helmet>
			<title>Příkazy | Portál značkaře</title>
		</Helmet>

		<RequireLogin>
			<ProtectedContent/>
		</RequireLogin>
	</>
);

export default Prikazy;