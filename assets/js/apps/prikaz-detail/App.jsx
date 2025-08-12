import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
    MaterialReactTable,
    useMaterialReactTable,
} from 'material-react-table';
import { MRT_Localization_CS } from 'material-react-table/locales/cs';
import {
    IconPrinter,
    IconArrowLeft,
    IconMapShare,
    IconPlus
} from '@tabler/icons-react';
import { PrikazHead } from '../../components/prikazy/PrikazHead';
import { PrikazUseky } from '../../components/prikazy/PrikazUseky';
import { ProvedeniPrikazu } from '../../components/prikazy/ProvedeniPrikazu';
import { MapaTrasy } from '../../components/shared/MapaTrasy';
import { Loader } from '../../components/shared/Loader';
import { getPrikazDescription } from '../../utils/prikaz';
import { renderHtmlContent, replaceTextWithIcons } from '../../utils/htmlUtils';
import { api } from '../../utils/api';
import { log } from '../../utils/debug';

// Utility functions from original app
function groupByEvCiTIM(rows) {
    const groups = {};
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

const isNezpracovany = (stav) => stav === 'Přidělený' || stav === 'Vystavený';

// Funkce pro řazení značek podle priority
function sortZnacky(items) {
    // Pořadí priorit
    const druhPresunuOrder = ['CZT', 'LZT', 'PZT', 'VZT'];
    const druhZnaceniKodOrder = ['PA', 'CT', 'MI', 'NS', 'SN'];
    const barvaKodOrder = ['CE', 'MO', 'ZE', 'ZL', 'BI'];

    // Funkce pro získání indexu v pořadí (nižší = vyšší priorita)
    const getDruhPresunuIndex = (item) => {
        const index = druhPresunuOrder.indexOf(item.Druh_Presunu);
        return index === -1 ? 999 : index;
    };

    const getDruhZnaceniKodIndex = (item) => {
        const kod = item.Druh_Znaceni_Kod;
        const index = druhZnaceniKodOrder.indexOf(kod);
        return index === -1 ? 999 : index;
    };

    const getBarvaKodIndex = (item) => {
        const index = barvaKodOrder.indexOf(item.Barva_Kod);
        return index === -1 ? 999 : index;
    };

    return items.sort((a, b) => {
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

// Color mapping removed - using BEM badge classes directly

// Format functions
const formatKm = (km) => km ? parseFloat(km).toFixed(1) : '0';

// HTML utility functions now imported from shared utils

// Validation functions from original
function validateSingleItem(item) {
    const errors = [];

    if (!item.Predmet_Index) {
        errors.push("Neznámý index předmětu");
    }

    if (!item.Druh_Predmetu) {
        errors.push("Neznámý druh předmětu");
    }

    if (item.Druh_Predmetu === 'S' || item.Druh_Predmetu === 'D') {
        if (!item.Druh_Presunu) {
            errors.push("Směrovka pro neznámý druh přesunu");
        }

        if (!item.Smerovani) {
            errors.push("Směrovka bez identifikace směrování");
        }
    }

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

const App = () => {
    // Get prikaz ID from data attribute
    const container = document.querySelector('[data-app="prikaz-detail"]');
    const prikazId = container?.dataset?.prikazId;
    const currentUser = {
        intAdr: parseInt(container?.dataset?.userIntAdr || '0'),
        name: container?.dataset?.userName || ''
    };

    const [head, setHead] = useState(null);
    const [predmety, setPredmety] = useState([]);
    const [useky, setUseky] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    const loadPrikazData = useCallback(async () => {
        if (!prikazId) {
            setError('ID příkazu nebylo nalezeno');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const result = await api.prikazy.detail(prikazId);
            setHead(result.head || {});
            setPredmety(result.predmety || []);
            setUseky(result.useky || []);
            log.info(`Načten detail příkazu ${prikazId}`, result);
        } catch (error) {
            setError(error.message);
            log.error('Chyba při načítání detailu příkazu', error);
        } finally {
            setLoading(false);
        }
    }, [prikazId]);

    // Kontrola vedoucího týmu podle hlavičky
    const isLeader = useMemo(() => {
        if (!currentUser.intAdr || !head) return false;
        return [1, 2, 3].some(i =>
            head[`INT_ADR_${i}`] == currentUser.intAdr && head[`Je_Vedouci${i}`] === "1"
        );
    }, [currentUser.intAdr, head]);

    // Extrakce členů týmu z hlavičky
    // const teamMembers = useMemo(() => {
    //     if (!head) return [];
    //     const members = [];
    //     for (let i = 1; i <= 3; i++) {
    //         const intAdr = head[`INT_ADR_${i}`];
    //         if (intAdr) {
    //             members.push({
    //                 intAdr,
    //                 isLeader: head[`Je_Vedouci${i}`] === "1",
    //                 name: head[`Jmeno_${i}`] || `Člen ${i}`
    //             });
    //         }
    //     }
    //     return members;
    // }, [head]);

    useEffect(() => {
        loadPrikazData();
    }, [loadPrikazData]);

    // Aktualizace prvků v Twig šabloně
    useEffect(() => {
        if (!head) return;
        
        const prikazIdElement = document.querySelector('.page__header .prikaz-id');
        if (prikazIdElement) {
            prikazIdElement.textContent = head.Cislo_ZP || prikazId || '';
        }

        const prikazDescElement = document.querySelector('.page__header .prikaz-description');
        if (prikazDescElement && head.Druh_ZP) {
            prikazDescElement.textContent = getPrikazDescription(head.Druh_ZP);
        }
    }, [head, prikazId]);

    const tableData = useMemo(
        () => Array.isArray(predmety) ? [...predmety].sort((a, b) => Number(a.Poradi ?? 0) - Number(b.Poradi ?? 0)) : [],
        [predmety]
    );

    const groupedData = useMemo(
        () => groupByEvCiTIM(tableData),
        [tableData]
    );

    // Special alert detection
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
                Druh_Odbocky_Kod: item.Druh_Odbocky_Kod,
                Znacka_HTML: item.Znacka_HTML
            }))
            .filter((item) => {
                const key = `${item.Barva}|${item.Barva_Kod}|${item.Druh_Presunu}|${item.Druh_Znaceni_Kod || ''}|${item.Druh_Odbocky_Kod || ''}`;
                if (set.has(key)) return false;
                set.add(key);
                return true;
            });

        // Seřazení podle priorit
        return sortZnacky(uniqueItems);
    }, [predmety, head?.Druh_ZP]);

    const mapPoints = useMemo(
        () =>
            groupedData
                .filter(d => !!d.GPS_Sirka && !!d.GPS_Delka)
                .map(d => ({
                    lat: Number(d.GPS_Sirka),   // GPS_Sirka = latitude
                    lon: Number(d.GPS_Delka),   // GPS_Delka = longitude
                    content: (
                        <p>
                            <strong>{replaceTextWithIcons(d.Naz_TIM)}</strong>
                            <br/>
                            {d.EvCi_TIM}
                        </p>
                    ),
                })),
        [groupedData]
    );

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

    const columns = useMemo(
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
                Cell: ({row}) => replaceTextWithIcons(row.original.Naz_TIM, 14)
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

    // ReportsColumns functionality moved to ProvedeniPrikazu component

    const table = useMaterialReactTable({
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
        layoutMode: 'semantic',
        state: {isLoading: loading},
        localization: MRT_Localization_CS,
        initialState: {
            density: 'compact',
            expanded: {},
            columnVisibility: {
                NP: window.innerWidth > 768,
                Stav_TIM_Nazev: window.innerWidth > 768,
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
        muiTableBodyRowProps: {sx: {backgroundColor: 'transparent'}},
        renderDetailPanel: ({row}) => (
            <div>
                <div className="text-sm opacity-75 md:hidden">
                    <div>Montáž: {row.original.NP}</div>
                    <div>Stav: {row.original.Stav_TIM_Nazev}</div>
                </div>
                <div className="space-y-4 mt-4">
                    {row.original.items?.map((item, i) => {
                        const itemErrors = validateSingleItem(item);

                        return (
                            <div key={i} className="border-t pt-4 first:border-t-0 first:pt-0">
                                <div className="flex flex-wrap items-center gap-4">
                                    {item.Tim_HTML ? renderHtmlContent(item.Tim_HTML) : 'TIM'}
                                    <div>
                                        <div className="font-bold">{item.Druh_Predmetu_Naz}</div>
                                        {item.Smerovani && (
                                            <div className="text-sm opacity-75">
                                                {item.Smerovani === 'P' ? 'Pravá' : item.Smerovani === 'L' ? 'Levá' : item.Smerovani}
                                            </div>
                                        )}
                                        {item.Druh_Odbocky && (
                                            <div className="text-sm opacity-75">{item.Druh_Odbocky}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.Barva && (
                                            <>
                                                {item.Znacka_HTML && renderHtmlContent(item.Znacka_HTML)}
                                                <span className={`badge badge--kct-${item.Barva_Kod.toLowerCase()}`}>
                                                {item.Barva}
                                            </span>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <div
                                            className="text-sm opacity-75">{item.Druh_Presunu} {item.Druh_Znaceni}</div>
                                        <div className="text-sm">Ev. č.: {item.EvCi_TIM + item.Predmet_Index}</div>
                                    </div>
                                    {itemErrors.length > 0 && (
                                        <div className="alert alert--danger">
                                            <div className="alert__content">
                                                <div className="alert__body">
                                                    <div className="alert__title">Chyby validace:</div>
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {itemErrors.map((error, index) => (
                                                            <li key={index} className="text-sm">{error}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ),
    });

    // ReportsTable functionality moved to ProvedeniPrikazu component

    if (loading) {
        return (
            <ThemeProvider theme={theme}>
                <div className="card">
                    <Loader/>
                </div>
            </ThemeProvider>
        );
    }

    if (error) {
        return (
            <ThemeProvider theme={theme}>
                <div className="alert alert--danger">
                    <div className="alert__content">
                        <div className="alert__body">
                            <div className="alert__title">Chyba při načítání dat</div>
                            <div className="alert__message">{error}</div>
                        </div>
                    </div>
                </div>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider theme={theme}>
            <div className="flex flex-col gap-4">
                {/* Main Content - Příkaz Head */}
                <div className="card">
                    <div className="card__content">
                        {loading ? (
                            <Loader/>
                        ) : (
                            <PrikazHead head={head}/>
                        )}
                    </div>
                </div>

                {/* Úseky tras */}
                {(useky.length > 0 || soubeh.length > 1) && (
                    <div className="card">
                        <div className="card__header ">
                            <h3 className="card__title">Úseky tras k obnově</h3>
                        </div>
                        <div className="card__content">
                            <PrikazUseky useky={useky} soubeh={soubeh}/>
                        </div>
                    </div>
                )}

                {/* Hlášení příkazu */}
                <div className="card">
                    <div className="card__content">
                        <ProvedeniPrikazu 
                            prikazId={prikazId}
                            head={head}
                            currentUser={currentUser}
                            isLeader={isLeader}
                        />
                        
                        {head && head.Stav_ZP_Naz && isNezpracovany(head.Stav_ZP_Naz) && (
                            <div className="mt-4 pt-4 border-t">
                                <div className="flex gap-2">
                                    <button className="btn btn--secondary">
                                        <IconPrinter size={16} className="mr-2"/>
                                        Kontrolní formulář PDF
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabulka hlášení práce - odstranit, nahrazeno komponentou ProvedeniPrikazu */}

                {/* Informační místa na trase */}
                <div className="card">
                    <div className="card__header ">
                        <h3 className="card__title">Informační místa na trase</h3>
                    </div>
                    <div className="card__content">
                        {specialAlert ? (
                            <div className="alert alert--danger">
                                <div className="alert__content">
                                    <div className="alert__body">
                                        <div className="alert__title">{specialAlert.title}</div>
                                        <div className="alert__message">{specialAlert.message}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <MaterialReactTable table={table}/>
                        )}
                    </div>
                </div>

                {/* Mapa */}
                {mapPoints.length > 0 && (
                    <div className="card">
                        <div className="card__content">
                            {loading ? (
                                <Loader/>
                            ) : (
                                <MapaTrasy data={mapData}/>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </ThemeProvider>
    );
};

export default App;