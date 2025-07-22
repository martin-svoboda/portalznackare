import React, {useEffect, useMemo, useState} from 'react';
import {
    MaterialReactTable,
    useMaterialReactTable,
} from 'material-react-table';
import {MRT_Localization_CS} from 'material-react-table/locales/cs';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {PrikazStavBadge} from '../../components/prikazy/PrikazStavBadge';
import {PrikazTypeIcon} from '../../components/prikazy/PrikazTypeIcon';
import {IconCrown} from '@tabler/icons-react';
import {renderHtmlContent, replaceTextWithIcons} from '../../utils/htmlUtils';

const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({length: 5}, (_, i) => `${currentYear - i}`);
};

// HTML utility functions now imported from shared utils


const App = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [year, setYear] = useState('');
    const [showOnlyToProcess, setShowOnlyToProcess] = useState(false);

    // Detect dark mode
    const [isDarkMode, setIsDarkMode] = useState(
        document.documentElement.classList.contains('dark')
    );

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

    // Create theme based on dark mode
    const theme = createTheme({
        palette: {
            mode: isDarkMode ? 'dark' : 'light',
        },
    });

    const isNezpracovany = (stav) => stav === 'Přidělený' || stav === 'Vystavený';

    const fetchData = async (selectedYear) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (selectedYear) params.append('year', selectedYear);

            const response = await fetch(`/api/insys/prikazy?${params.toString()}`, {
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
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(year || undefined);
    }, []);

    const handleYearChange = (val) => {
        const newYear = val || '';
        setYear(newYear);
        fetchData(newYear || undefined);
    };

    const handleDetailClick = (prikazId) => {
        window.location.href = `/prikaz/${prikazId}`;
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

    const columns = useMemo(
        () => [
            {accessorKey: 'Cislo_ZP', header: 'Číslo ZP', size: 100},
            {
                accessorKey: 'Druh_ZP_Naz',
                header: 'Druh ZP',
                size: 120,
                filterVariant: 'select',
                Cell: ({row}) => (
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <div><PrikazTypeIcon type={row.original.Druh_ZP} size={28}/></div>
                        <span>{row.original.Druh_ZP_Naz}</span>
                    </div>
                ),
            },
            {
                accessorKey: 'Popis_ZP',
                header: 'Popis',
                size: 300,
                Cell: ({row}) => replaceTextWithIcons(row.original.Popis_ZP, 14),
            },
            {
                accessorKey: 'Stav_ZP_Naz',
                header: 'Stav',
                size: 150,
                filterVariant: 'select',
                Cell: ({row}) => <PrikazStavBadge stav={row.original.Stav_ZP_Naz}/>,
            },
            {
                accessorKey: 'Znackar',
                header: 'Značkař',
                size: 100,
                filterVariant: 'autocomplete'
            },
            {
                accessorKey: 'Je_Vedouci',
                header: 'Ved.',
                size: 40,
                Cell: ({cell}) =>
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
                            <IconCrown size={14}/>
                        </div>
                    ) : null,
                enableColumnFilter: false,
                meta: {align: 'center'}
            },
            {
                accessorKey: 'Vyuctovani',
                header: 'Vyúč.',
                size: 50,
                filterVariant: 'select'
            },
        ],
        []
    );

    const table = useMaterialReactTable({
        columns,
        data: sortedData,
        enableFacetedValues: true,
        enableColumnFilters: true,
        enablePagination: data.length > 20,
        enableSorting: false,
        enableDensityToggle: false,
        enableFullScreenToggle: false,
        enableColumnResizing: false,
        layoutMode: 'semantic',
        state: {isLoading: loading},
        localization: MRT_Localization_CS,
        initialState: {
            columnVisibility: {
                Znackar: false,
                Trida_OTZ: false
            }
        },
        muiTablePaperProps: {
            elevation: 0,
            sx: {
                backgroundColor: 'transparent',
                backgroundImage: 'none',
                border: 'none'
            }
        },
        muiTopToolbarProps: {sx: {backgroundColor: 'transparent'}},
        muiBottomToolbarProps: {sx: {backgroundColor: 'transparent'}},
        muiTableHeadRowProps: {sx: {backgroundColor: 'transparent'}},
        muiTableBodyRowProps: ({row}) => {
            const isActive = isNezpracovany(row.original.Stav_ZP_Naz);
            return {
                sx: {
                    cursor: 'pointer',
                    ...(isActive
                        ? {
                            backgroundColor: 'rgba(37, 99, 235, 0.07)',
                            fontWeight: 600,
                        }
                        : {
                            backgroundColor: 'transparent',
                            opacity: 0.7,
                        }),
                },
                onClick: () => handleDetailClick(row.original.ID_Znackarske_Prikazy),
            };
        },
        renderTopToolbarCustomActions: () => (
            <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                <select
                    size="sm"
                    style={{
                        width: '110px',
                        padding: '4px 8px',
                        fontSize: '14px',
                        borderRadius: '4px',
                        border: '1px solid #ced4da'
                    }}
                    placeholder="Aktuální rok"
                    value={year}
                    onChange={(e) => handleYearChange(e.target.value)}
                    aria-label="Výběr roku"
                >
                    <option value="">Aktuální rok</option>
                    {getAvailableYears().map((yearOption) => (
                        <option key={yearOption} value={yearOption}>
                            {yearOption}
                        </option>
                    ))}
                </select>
                <label style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'}}>
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

    if (error) {
        return (
            <div style={{padding: '32px', backgroundColor: '#ffebee', borderRadius: '4px'}}>
                <div style={{color: '#c62828'}}>Chyba při načítání dat: {error}</div>
            </div>
        );
    }

    return (
        <ThemeProvider theme={theme}>
            <MaterialReactTable table={table}/>
        </ThemeProvider>
    );
};

export default App;