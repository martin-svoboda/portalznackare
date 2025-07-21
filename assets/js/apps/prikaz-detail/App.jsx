import React, {useEffect, useState, useMemo} from 'react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {
    MaterialReactTable,
    useMaterialReactTable,
} from 'material-react-table';
import {MRT_Localization_CS} from 'material-react-table/locales/cs';
import {
    IconAlertTriangleFilled,
    IconPrinter,
    IconArrowLeft, IconMapShare, IconPlus
} from '@tabler/icons-react';
import {PrikazHead} from '../../components/prikazy/PrikazHead';
import {PrikazUseky} from '../../components/prikazy/PrikazUseky';
import {MapaTrasy} from '../../components/shared/MapaTrasy';
import {Loader} from '../../components/shared/Loader';
import {getPrikazDescription} from '../../utils/prikaz';

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

// Color mapping
const barvaDleKodu = (kod) => {
    switch (kod) {
        case 'CE':
            return 'red';
        case 'MO':
            return 'blue';
        case 'ZE':
            return 'green';
        case 'ZL':
            return 'yellow';
        default:
            return 'gray';
    }
};

// Format functions
const formatKm = (km) => km ? parseFloat(km).toFixed(1) : '0';
const replaceTextWithIcons = (text, size = 14) => text || '';

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

    const fetchPrikazData = async () => {
        if (!prikazId) {
            setError('ID příkazu nebylo nalezeno');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/insys/prikaz/${prikazId}`, {
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
            setHead(result.head || {});
            setPredmety(result.predmety || []);
            setUseky(result.useky || []);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching prikaz data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrikazData();
    }, [prikazId]);

    // Aktualizace prvků v Twig šabloně
    useEffect(() => {
        // Aktualizuj číslo příkazu
        const prikazIdElement = document.querySelector('.page__header .prikaz-id');
        if (prikazIdElement) {
            prikazIdElement.textContent = head?.Cislo_ZP || prikazId || '';
        }

        // Aktualizuj popis příkazu
        const prikazDescElement = document.querySelector('.page__header .prikaz-description');
        if (prikazDescElement && head?.Druh_ZP) {
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
    }, [predmety, head?.Druh_ZP]);

    const delka = useMemo(() => {
        if (useky === undefined || head?.Druh_ZP !== "O" || !Array.isArray(useky) || useky.length === 0) return null;
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
        muiTableProps: {
            sx: {
                border: 'none'
            }
        },
        muiTablePaperProps: {
            sx: {
                boxShadow: 'none',
                border: 'none'
            },
        },
        renderDetailPanel: ({row}) => (
            <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 md:hidden">
                    <div>Montáž: {row.original.NP}</div>
                    <div>Stav: {row.original.Stav_TIM_Nazev}</div>
                </div>
                <div className="space-y-4 mt-4">
                    {row.original.items?.map((item, i) => {
                        const itemErrors = validateSingleItem(item);

                        return (
                            <div key={i} className="border-t pt-4 first:border-t-0 first:pt-0">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div
                                        className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs">
                                        TIM
                                    </div>
                                    <div>
                                        <div className="font-bold">{item.Druh_Predmetu_Naz}</div>
                                        {item.Smerovani && (
                                            <div className="text-sm text-gray-600">
                                                {item.Smerovani === 'P' ? 'Pravá' : item.Smerovani === 'L' ? 'Levá' : item.Smerovani}
                                            </div>
                                        )}
                                        {item.Druh_Odbocky && (
                                            <div className="text-sm text-gray-600">{item.Druh_Odbocky}</div>
                                        )}
                                    </div>
                                    <div>
                                        {item.Barva && (
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-medium bg-${barvaDleKodu(item.Barva_Kod)}-100 text-${barvaDleKodu(item.Barva_Kod)}-800`}>
                                                {item.Barva}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <div
                                            className="text-sm text-gray-600">{item.Druh_Presunu} {item.Druh_Znaceni}</div>
                                        <div className="text-sm">ID: {item.EvCi_TIM + item.Predmet_Index}</div>
                                    </div>
                                    {itemErrors.length > 0 && (
                                        <div
                                            className="w-full bg-red-50 border border-red-200 rounded p-3 text-red-700">
                                            <div className="flex items-center mb-2">
                                                <IconAlertTriangleFilled size={16} className="mr-2"/>
                                                <span className="font-medium">Chyby validace:</span>
                                            </div>
                                            <ul className="list-disc list-inside space-y-1">
                                                {itemErrors.map((error, index) => (
                                                    <li key={index} className="text-sm">{error}</li>
                                                ))}
                                            </ul>
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
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    <div className="font-medium">Chyba při načítání dat</div>
                    <div className="text-sm">{error}</div>
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
                            <PrikazHead head={head} delka={delka}/>
                        )}
                    </div>
                </div>

                {/* Úseky tras */}
                {(useky.length > 0 || soubeh.length > 1) && (
                    <div className="card">
                        <div className="card__header card__header--no-border">
                            <h3 className="card__title">Úseky tras k obnově</h3>
                        </div>
                        <div className="card__content">
                            <PrikazUseky useky={useky} soubeh={soubeh}/>
                        </div>
                    </div>
                )}

                {/* Provedení příkazu */}
                <div className="card">
                    <div className="card__header card__header--no-border">
                        <div className="flex justify-between items-center">
                            <h3 className="card__title">Provedení příkazu</h3>
                            {head && head.Stav_ZP_Naz && isNezpracovany(head.Stav_ZP_Naz) && (
                                <a href={`/prikaz/${prikazId}/hlaseni`} className="btn btn--primary">
                                    <IconPlus size={16}/> Vytvořit hlášení
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="card__content">
                        {head && head.Stav_ZP_Naz && isNezpracovany(head.Stav_ZP_Naz) && (
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-blue-700">
                                    <div className="font-medium">Příkaz čeká na zpracování</div>
                                    <div className="text-sm">Pro dokončení příkazu použijte hlášení práce.</div>
                                </div>
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

                {/* Informační místa na trase */}
                <div className="card">
                    <div className="card__header card__header--no-border">
                        <h3 className="card__title">Informační místa na trase</h3>
                    </div>
                    <div className="card__content">
                        {specialAlert ? (
                            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
                                <div className="flex items-center mb-2">
                                    <IconAlertTriangleFilled size={16} className="mr-2"/>
                                    <span className="font-medium">{specialAlert.title}</span>
                                </div>
                                <div>{specialAlert.message}</div>
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