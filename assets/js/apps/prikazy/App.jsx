import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    MaterialReactTable,
    useMaterialReactTable,
} from 'material-react-table';
import { MRT_Localization_CS } from 'material-react-table/locales/cs';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { PrikazStavBadge } from '../../components/prikazy/PrikazStavBadge';
import { PrikazTypeIcon } from '../../components/prikazy/PrikazTypeIcon';
import { IconCrown } from '@tabler/icons-react';
import { replaceTextWithIcons } from '../../utils/htmlUtils';
import { api } from '../../utils/api';
import { log } from '../../utils/debug';

// Pomocné funkce
const getCurrentYear = () => new Date().getFullYear();
const getAvailableYears = () => Array.from({length: 5}, (_, i) => `${getCurrentYear() - i}`);
const isNezpracovany = (stav) => stav === 'Přidělený' || stav === 'Vystavený';

const PrikazyApp = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState('');
    const [showOnlyToProcess, setShowOnlyToProcess] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(
        document.documentElement.classList.contains('dark')
    );

    // Načtení dat
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = year ? { year } : undefined;
            const result = await api.prikazy.list(params);
            setData(result || []);
            log.info(`Načteno ${result?.length || 0} příkazů`);
        } catch (error) {
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [year]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Dark mode observer
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });
        return () => observer.disconnect();
    }, []);

    // Filtrování a řazení dat
    const sortedData = useMemo(() => {
        let result = [...data].sort((a, b) => {
            const aActive = isNezpracovany(a.Stav_ZP_Naz);
            const bActive = isNezpracovany(b.Stav_ZP_Naz);
            return aActive === bActive ? 0 : aActive ? -1 : 1;
        });
        
        if (showOnlyToProcess) {
            result = result.filter(row => isNezpracovany(row.Stav_ZP_Naz));
        }
        
        return result;
    }, [data, showOnlyToProcess]);

    // Definice sloupců
    const columns = useMemo(() => [
        { accessorKey: 'Cislo_ZP', header: 'Číslo ZP', size: 100 },
        {
            accessorKey: 'Druh_ZP_Naz',
            header: 'Druh ZP',
            size: 120,
            filterVariant: 'select',
            Cell: ({ row }) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PrikazTypeIcon type={row.original.Druh_ZP} size={28} />
                    <span>{row.original.Druh_ZP_Naz}</span>
                </div>
            ),
        },
        {
            accessorKey: 'Popis_ZP',
            header: 'Popis',
            size: 300,
            Cell: ({ row }) => replaceTextWithIcons(row.original.Popis_ZP, 14),
        },
        {
            accessorKey: 'Stav_ZP_Naz',
            header: 'Stav',
            size: 150,
            filterVariant: 'select',
            Cell: ({ row }) => <PrikazStavBadge stav={row.original.Stav_ZP_Naz} />,
        },
        { accessorKey: 'Znackar', header: 'Značkař', size: 100, filterVariant: 'autocomplete' },
        {
            accessorKey: 'Je_Vedouci',
            header: 'Ved.',
            size: 40,
            Cell: ({ cell }) =>
                cell.getValue() === '1' || cell.getValue() === 1 ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: '#FFC107',
                        color: '#333'
                    }}>
                        <IconCrown size={14} />
                    </div>
                ) : null,
            enableColumnFilter: false,
            meta: { align: 'center' }
        },
        { accessorKey: 'Vyuctovani', header: 'Vyúč.', size: 50, filterVariant: 'select' },
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: sortedData,
        enableFacetedValues: true,
        enableColumnFilters: true,
        enablePagination: data.length > 20,
        enableSorting: false,
        enableDensityToggle: false,
        enableFullScreenToggle: false,
        layoutMode: 'semantic',
        state: { isLoading: loading },
        localization: MRT_Localization_CS,
        initialState: {
            columnVisibility: { Znackar: false, Trida_OTZ: false }
        },
        muiTablePaperProps: {
            elevation: 0,
            sx: {
                backgroundColor: 'transparent',
                backgroundImage: 'none',
                border: 'none'
            }
        },
        muiTableBodyRowProps: ({ row }) => ({
            sx: {
                cursor: 'pointer',
                backgroundColor: isNezpracovany(row.original.Stav_ZP_Naz) 
                    ? 'rgba(37, 99, 235, 0.07)' 
                    : 'transparent',
                opacity: isNezpracovany(row.original.Stav_ZP_Naz) ? 1 : 0.7,
                fontWeight: isNezpracovany(row.original.Stav_ZP_Naz) ? 600 : 'normal'
            },
            onClick: () => {
                const prikazId = row.original.ID_Znackarske_Prikazy;
                log.info(`Navigace na detail příkazu ${prikazId}`);
                window.location.href = `/prikaz/${prikazId}`;
            },
        }),
        renderTopToolbarCustomActions: () => (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select
                    size="sm"
                    style={{
                        width: '110px',
                        padding: '4px 8px',
                        fontSize: '14px',
                        borderRadius: '4px',
                        border: '1px solid #ced4da'
                    }}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    aria-label="Výběr roku"
                >
                    <option value="">Aktuální rok</option>
                    {getAvailableYears().map(yearOption => (
                        <option key={yearOption} value={yearOption}>
                            {yearOption}
                        </option>
                    ))}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                    <input
                        type="checkbox"
                        checked={showOnlyToProcess}
                        onChange={(e) => setShowOnlyToProcess(e.target.checked)}
                    />
                    Jen ke zpracování
                </label>
            </div>
        ),
    });

    const theme = useMemo(() => createTheme({
        palette: { mode: isDarkMode ? 'dark' : 'light' },
    }), [isDarkMode]);

    return (
        <ThemeProvider theme={theme}>
            <MaterialReactTable table={table} />
        </ThemeProvider>
    );
};

export default PrikazyApp;