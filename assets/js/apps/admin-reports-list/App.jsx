import React, {useEffect, useMemo, useState} from 'react';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_CS} from 'material-react-table/locales/cs';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {IconEye, IconClipboardList, IconFileText, IconRefresh} from '@tabler/icons-react';
import {StateBadge} from '../../utils/stateBadge';
import {parseCisloZp, getPrikazDescription} from '../../utils/prikaz';
import {PrikazTypeIcon} from '../../components/prikazy/PrikazTypeIcon';
import {ReportCompensationPanel} from './components/ReportCompensationPanel';

const formatDate = (value) => value ? new Date(value).toLocaleString('cs-CZ') : '-';

const App = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(
        document.documentElement.classList.contains('dark')
    );

    const loadReports = async () => {
        setLoading(true);
        try {
            const response = await fetch('/admin/api/reports');
            const data = await response.json();
            setReports(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Chyba při načítání hlášení:', error);
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
        return () => observer.disconnect();
    }, []);

    const columns = useMemo(() => [
        {
            accessorKey: 'cisloZp',
            header: 'Číslo ZP',
            size: 140,
        },
        {
            accessorKey: 'idZp',
            header: 'INSYZ ID',
            size: 110,
        },
        {
            id: 'kraj',
            header: 'Kraj',
            accessorFn: (row) => parseCisloZp(row.cisloZp).kraj || '',
            size: 90,
            filterVariant: 'select',
            Cell: ({cell}) => cell.getValue() || '-',
        },
        {
            id: 'obvod',
            header: 'Obvod',
            accessorFn: (row) => parseCisloZp(row.cisloZp).obvod || '',
            size: 90,
            filterVariant: 'select',
            Cell: ({cell}) => cell.getValue() || '-',
        },
        {
            id: 'typ',
            header: 'Typ',
            accessorFn: (row) => parseCisloZp(row.cisloZp).typ || '',
            size: 90,
            filterVariant: 'select',
            Cell: ({row}) => {
                const typ = parseCisloZp(row.original.cisloZp).typ;
                if (!typ) return '-';
                return (
                    <div className="flex items-center gap-2" title={getPrikazDescription(typ)}>
                        <PrikazTypeIcon type={typ} size={24}/>
                        <span>{typ}</span>
                    </div>
                );
            },
        },
        {
            id: 'znackari',
            header: 'Značkaři',
            accessorFn: (row) => (row.znackari || []).map(z => z.Znackar || z.name).join(', '),
            size: 220,
        },
        {
            accessorKey: 'state',
            header: 'Stav',
            size: 120,
            filterVariant: 'select',
            Cell: ({cell}) => <StateBadge state={cell.getValue()}/>,
        },
        {
            accessorKey: 'dateSend',
            header: 'Odesláno',
            size: 150,
            Cell: ({cell}) => formatDate(cell.getValue()),
        },
        {
            accessorKey: 'dateCreated',
            header: 'Vytvořeno',
            size: 150,
            Cell: ({cell}) => formatDate(cell.getValue()),
        },
        {
            accessorKey: 'dateUpdated',
            header: 'Aktualizováno',
            size: 150,
            Cell: ({cell}) => formatDate(cell.getValue()),
        },
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: reports,
        // Krátký placeholder filtru (výchozí „Filtrovat podle sloupce …" roztahoval sloupce)
        localization: {...MRT_Localization_CS, filterByColumn: 'Filtr'},
        // Sloupce respektují size a filtr se do nich vejde (nesemantický grid layout)
        layoutMode: 'grid',
        enableFacetedValues: true,
        enableColumnFilters: true,
        enableGlobalFilter: true,
        enableHiding: true,
        enableColumnActions: true,
        enableDensityToggle: false,
        enableFullScreenToggle: false,
        enablePagination: reports.length > 20,
        state: {isLoading: loading},
        initialState: {
            showColumnFilters: false,
            columnVisibility: {
                dateCreated: false,
                dateUpdated: false,
            },
        },
        muiTablePaperProps: {
            elevation: 0,
            sx: {backgroundColor: 'transparent', backgroundImage: 'none', border: 'none'},
        },
        muiTopToolbarProps: {sx: {backgroundColor: 'transparent'}},
        muiBottomToolbarProps: {sx: {backgroundColor: 'transparent'}},
        muiTableHeadRowProps: {sx: {backgroundColor: 'transparent'}},
        renderRowActions: ({row}) => (
            <div className="flex gap-2">
                <a href={`/admin/hlaseni/${row.original.id}`} className="btn btn--sm btn--secondary" title="Admin detail">
                    <IconEye size={16}/>
                </a>
                <a href={`/prikaz/${row.original.idZp}`} className="btn btn--sm btn--secondary" title="Zobrazit příkaz">
                    <IconClipboardList size={16}/>
                </a>
                <a href={`/prikaz/${row.original.idZp}/hlaseni`} className="btn btn--sm btn--primary" title="Zobrazit hlášení">
                    <IconFileText size={16}/>
                </a>
            </div>
        ),
        enableRowActions: true,
        positionActionsColumn: 'last',
        renderTopToolbarCustomActions: () => (
            <button onClick={loadReports} className="btn btn--secondary btn--sm" disabled={loading}>
                <IconRefresh size={16}/>
                Obnovit
            </button>
        ),
        renderDetailPanel: ({row}) => (
            <ReportCompensationPanel reportId={row.original.id}/>
        ),
    });

    const theme = useMemo(() => createTheme({
        palette: {mode: isDarkMode ? 'dark' : 'light'},
    }), [isDarkMode]);

    return (
        <div className="card">
            <div className="card__content">
                <ThemeProvider theme={theme}>
                    <MaterialReactTable table={table}/>
                </ThemeProvider>
            </div>
        </div>
    );
};

export default App;
