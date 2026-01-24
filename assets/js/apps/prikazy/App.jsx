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

// Výpočet očekávaného progressu (lineárně od 1.4. do 30.9.)
const calculateExpectedProgress = (displayYear) => {
    const now = new Date();
    const year = parseInt(displayYear) || now.getFullYear();

    const startDate = new Date(year, 3, 1); // 1.4.
    const endDate = new Date(year, 8, 30);  // 30.9.

    // Pokud jsme před 1.4., progress je 0%
    if (now < startDate) return 0;
    // Pokud jsme po 30.9., progress je 100%
    if (now > endDate) return 100;

    const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const elapsedDays = (now - startDate) / (1000 * 60 * 60 * 24);

    return Math.round((elapsedDays / totalDays) * 100);
};

// Progress Bar komponenta
const PrikazyProgressBar = ({ data, displayYear }) => {
    const year = parseInt(displayYear) || getCurrentYear();
    const total = data.length;

    if (total === 0) return null;

    // Počty dle stavů
    const provedeny = data.filter(p => p.Stav_ZP_Naz === 'Provedený').length;
    const zauctovany = data.filter(p => p.Stav_ZP_Naz === 'Zaúčtovaný').length;
    const predanyKKZ = data.filter(p => p.Stav_ZP_Naz === 'Předaný KKZ').length;

    // Hotové = Provedený + Předaný KKZ + Zaúčtovaný
    const hotoveCelkem = provedeny + predanyKKZ + zauctovany;

    // Procenta
    const provedenyPct = (provedeny / total) * 100;
    const predanyKKZPct = (predanyKKZ / total) * 100;
    const zauctovanyPct = (zauctovany / total) * 100;
    const hotovePct = (hotoveCelkem / total) * 100;

    // Očekávaný progress
    const expectedPct = calculateExpectedProgress(displayYear);

    // Pozice milníků (30.6. = 50%, 30.9. = 100% období od 1.4.)
    const milestone1Pct = 50;  // 30.6.
    const milestone2Pct = 100; // 30.9.

    return (
        <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Postup prací {year}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {hotoveCelkem} / {total} příkazů ({hotovePct.toFixed(0)}%)
                </span>
            </div>

            {/* Progress bar container */}
            <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                {/* Očekávaný progress - červená (pod ostatními) */}
                <div
                    className="absolute h-full bg-red-400 dark:bg-red-600 opacity-50"
                    style={{ width: `${expectedPct}%` }}
                    title={`Očekáváno: ${expectedPct}%`}
                />

                {/* Skutečný progress - vrstvený */}
                <div className="absolute h-full w-full flex">
                    {/* Zaúčtovaný - lime */}
                    <div
                        className="h-full bg-lime-500 dark:bg-lime-600"
                        style={{ width: `${zauctovanyPct}%` }}
                        title={`Zaúčtovaný: ${zauctovany} (${zauctovanyPct.toFixed(1)}%)`}
                    />
                    {/* Předaný KKZ - green */}
                    <div
                        className="h-full bg-green-500 dark:bg-green-600"
                        style={{ width: `${predanyKKZPct}%` }}
                        title={`Předaný KKZ: ${predanyKKZ} (${predanyKKZPct.toFixed(1)}%)`}
                    />
                    {/* Provedený - teal */}
                    <div
                        className="h-full bg-teal-500 dark:bg-teal-600"
                        style={{ width: `${provedenyPct}%` }}
                        title={`Provedený: ${provedeny} (${provedenyPct.toFixed(1)}%)`}
                    />
                </div>

                {/* Milníky */}
                <div
                    className="absolute h-full w-0.5 bg-gray-600 dark:bg-gray-300"
                    style={{ left: `${milestone1Pct}%` }}
                    title="30.6."
                />
                <div
                    className="absolute h-full w-0.5 bg-gray-800 dark:bg-white"
                    style={{ left: `${milestone2Pct}%` }}
                    title="30.9."
                />
            </div>

            {/* Popisky milníků */}
            <div className="relative h-5 mt-1">
                <span
                    className="absolute text-xs text-gray-500 dark:text-gray-400 transform -translate-x-1/2"
                    style={{ left: `${milestone1Pct}%` }}
                >
                    30.6.
                </span>
                <span
                    className="absolute text-xs text-gray-500 dark:text-gray-400 transform -translate-x-1/2"
                    style={{ left: `${milestone2Pct}%` }}
                >
                    30.9.
                </span>
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-400 dark:bg-red-600 rounded opacity-50"></div>
                    <span className="text-gray-600 dark:text-gray-400">Očekáváno ({expectedPct}%)</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-teal-500 dark:bg-teal-600 rounded"></div>
                    <span className="text-gray-600 dark:text-gray-400">Provedený ({provedeny})</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 dark:bg-green-600 rounded"></div>
                    <span className="text-gray-600 dark:text-gray-400">Předaný KKZ ({predanyKKZ})</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-lime-500 dark:bg-lime-600 rounded"></div>
                    <span className="text-gray-600 dark:text-gray-400">Zaúčtovaný ({zauctovany})</span>
                </div>
            </div>
        </div>
    );
};

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

    // Rok pro zobrazení (vybraný nebo aktuální)
    const displayYear = year || String(getCurrentYear());

    return (
        <ThemeProvider theme={theme}>
            <PrikazyProgressBar data={data} displayYear={displayYear} />
            <MaterialReactTable table={table}/>
        </ThemeProvider>
    );
};

export default PrikazyApp;