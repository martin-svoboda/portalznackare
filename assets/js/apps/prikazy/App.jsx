import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {
    MaterialReactTable,
    useMaterialReactTable,
} from 'material-react-table';
import {MRT_Localization_CS} from 'material-react-table/locales/cs';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {PrikazStavBadge} from '../../components/prikazy/PrikazStavBadge';
import {PrikazTypeIcon} from '../../components/prikazy/PrikazTypeIcon';
import {IconCrown} from '@tabler/icons-react';
import {replaceTextWithIcons} from '../../utils/htmlUtils';
import {api} from '../../utils/api';
import {log} from '../../utils/debug';

const getCurrentYear = () => new Date().getFullYear();
const getAvailableYears = () => Array.from({length: 5}, (_, i) => `${getCurrentYear() - i}`);
const isNezpracovany = (stav) => stav === 'Přidělený' || stav === 'Vystavený';

const PrikazyApp = () => {
    // Detekce dashboard módu z data atributu
    const container = document.querySelector('[data-app="prikazy"]');
    const isDashboardMode = container?.dataset?.dashboardMode === 'true';

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState('');
    const [showOnlyToProcess, setShowOnlyToProcess] = useState(isDashboardMode);
    const [isDarkMode, setIsDarkMode] = useState(
        document.documentElement.classList.contains('dark')
    );

    // Načtení dat
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = year ? {year} : undefined;
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

        if (isDashboardMode) {
            result = result.slice(0, 5);
        }

        return result;
    }, [data, showOnlyToProcess, isDashboardMode]);

    const Member = ({name, isLeader}) => {
        if (!name?.trim()) return null;

        return (
            <div className="flex items-center gap-1">
            <span className={isLeader ? 'font-bold' : 'font-normal'}>
                {name}
            </span>
                {isLeader && (
                    <IconCrown
                        size={18}
                        color="#ffd700"
                        title="Vedoucí"
                        aria-label="Vedoucí"
                    />
                )}
            </div>
        );
    };

    // Definice sloupců
    const columns = useMemo(() => [
                {accessorKey: 'Cislo_ZP', header: 'Číslo', size: 100},
                {
                    accessorKey: 'Druh_ZP_Naz',
                    header: 'Druh',
                    filterVariant: 'select',
                    size: window.innerWidth > 1280 ? 120 : 60,
                    Cell: ({row}) => (
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <PrikazTypeIcon type={row.original.Druh_ZP} size={28}/>
                            <span className="hidden xl:block">{row.original.Druh_ZP_Naz}</span>
                        </div>
                    ),
                },
                {
                    accessorKey: 'Popis_ZP',
                    header: 'Popis',
                    // size: 300,
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
                    header: 'Značkaři',
                    size: 100,
                    Cell: ({row}) => {
                        return [1, 2, 3].map(i => (
                            <Member
                                key={i}
                                name={row.original[`Znackar${i}`]}
                                isLeader={row.original[`Je_Vedouci${i}`] === "1"}
                            />
                        ));
                    }
                },
                {
                    accessorKey: 'Je_Vedouci',
                    header:
                        'Ved.',
                    size:
                        40,
                    Cell:
                        ({cell}) =>
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
                    enableColumnFilter:
                        false,
                    meta:
                        {
                            align: 'center'
                        }
                }
                ,
                {
                    accessorKey: 'Vyuctovani', header:
                        'Vyúč.', size:
                        50, filterVariant:
                        'select'
                }
                ,
            ],
            []
        )
    ;

    const table = useMaterialReactTable({
        columns,
        data: sortedData,
        enableFacetedValues: true,
        enableColumnFilters: !isDashboardMode,
        enableColumnActions: false,
        enableColumnOrdering: false,
        enableColumnResizing: false,
        enableHiding: false,
        enablePagination: !isDashboardMode && data.length > 20,
        enableSorting: false,
        enableRowActions: false,
        enableTopToolbar: !isDashboardMode,
        enableBottomToolbar: !isDashboardMode,
        enableDensityToggle: false,
        enableFullScreenToggle: false,
        layoutMode: 'semantic',
        state: {isLoading: loading},
        localization: MRT_Localization_CS,
        initialState: {
            columnVisibility: {
                Trida_OTZ: false,
                Druh_ZP_Naz: window.innerWidth > 768,
                Popis_ZP: window.innerWidth > 460,
                Stav_ZP_Naz: window.innerWidth > 768,
                Znackar: window.innerWidth > 768,
                Je_Vedouci: false,
                Vyuctovani: window.innerWidth > 1280,
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
        muiTableBodyRowProps: ({row}) => ({
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
        renderTopToolbarCustomActions: isDashboardMode ? undefined : () => (
            <div className="flex gap-3 items-center flex-wrap">
                <select
                    size="sm"
                    className="form__select"
                    style={{
                        width: '115px',
                        padding: '4px 8px',
                        fontSize: '14px',
                        minHeight: '36px',
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
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={showOnlyToProcess}
                        onChange={(e) => setShowOnlyToProcess(e.target.checked)}
                    />
                    Jen ke zpracování
                </label>
            </div>
        ),
        renderDetailPanel: window.innerWidth > 1280 ? false : ({row}) => (
            <div className="space-y-4">
                <div className="flex flex-wrap gap-3 xl:hidden">
                    <div className="flex items-center gap-2">
                        <PrikazTypeIcon type={row.original.Druh_ZP} size={28}/>
                        <span>{row.original.Druh_ZP_Naz}</span>
                    </div>
                    <PrikazStavBadge stav={row.original.Stav_ZP_Naz}/>
                    <div>
                        {[1, 2, 3].map(i => (
                            <Member
                                key={i}
                                name={row.original[`Znackar${i}`]}
                                isLeader={row.original[`Je_Vedouci${i}`] === "1"}
                            />
                        ))}
                    </div>
                    <div>
                        Vyúčtování: {row.original.Vyuctovani ? row.original.Vyuctovani : 'Není'}
                    </div>
                </div>
                <div>
                    {row.original.Popis_ZP && (
                        <p className="text-sm"> {replaceTextWithIcons(row.original.Popis_ZP, 14)} </p>
                    )}
                    {row.original.Poznamka_ZP && (
                        <p className="text-sm">{row.original.Poznamka_ZP}</p>
                    )}
                </div>
            </div>
        ),
    });

    const theme = useMemo(() => createTheme({
        palette: {mode: isDarkMode ? 'dark' : 'light'},
    }), [isDarkMode]);

    return (
        <ThemeProvider theme={theme}>
            <MaterialReactTable table={table}/>
        </ThemeProvider>
    );
};

export default PrikazyApp;