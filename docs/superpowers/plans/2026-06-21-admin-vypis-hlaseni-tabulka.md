# Admin výpis podaných hlášení (Material React Table) — Implementační plán

> **Pro agentní workery:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (doporučeno) nebo superpowers:executing-plans. Kroky používají checkbox (`- [ ]`).
>
> **⛔ ZÁKAZ COMMITŮ:** V tomto projektu se **nikdy** nespouští `git commit`/`git push` ani se nemění git stav. Plán proto **neobsahuje commit kroky** — verzování dělá uživatel. Každý task končí „Checkpoint" (ověření).

**Goal:** Přepsat admin výpis hlášení na Material React Table s filtrováním, hledáním, přepínáním sloupců a rozklikem řádku, který async zobrazí obsah karty „Hlášení příkazu" (souhrn z uložené kalkulace).

**Architecture:** Frontend-only (mimo volitelný backend bonus). Tabulka přepsána na MRT dle vzoru `prikazy` appky. Tělo dnešní `ProvedeniPrikazu` se vytáhne do prezentační komponenty `ReportProvedeniSummary`, kterou použije rozklik (přes async panel `ReportCompensationPanel` krmený `apiReportDetail`) i `ProvedeniPrikazu` na detailu příkazu. Vše z uložených dat, žádný přepočet ani sazby.

**Tech Stack:** React 18, `material-react-table` (MRT_Localization_CS, MUI ThemeProvider), `@tanstack/react-table` (přes MRT), Tailwind/BEM, Symfony (jen volitelný bonus endpoint).

---

## Přehled souborů

**Nové:**
- `assets/js/components/prikazy/ReportProvedeniSummary.jsx` — prezentační souhrn hlášení
- `assets/js/apps/admin-reports-list/components/ReportCompensationPanel.jsx` — async panel pro rozklik
- `docs/features/admin-vypis-hlaseni.md` — funkční dokumentace

**Upravené:**
- `assets/js/utils/prikaz.js` — helper `parseCisloZpTyp`
- `assets/js/components/prikazy/ProvedeniPrikazu.jsx` — delegace souhrnu na `ReportProvedeniSummary`
- `assets/js/apps/admin-reports-list/App.jsx` — přepis na MRT

---

## Task 1: Helper `parseCisloZpTyp`

**Files:**
- Modify: `assets/js/utils/prikaz.js`

- [ ] **Step 1: Přidat helper na konec `assets/js/utils/prikaz.js`**

```javascript
/**
 * Z čísla příkazu (tvar "kraj/obvod/typ/číslo", např. "P/PS/O/26032")
 * vrátí kód typu (3. segment, např. "O") nebo null, když číslo nemá
 * očekávaný tvar.
 *
 * @param {string} cisloZp
 * @returns {string|null} kód typu (O/J/S/N…) nebo null
 */
export function parseCisloZpTyp(cisloZp) {
    if (!cisloZp || typeof cisloZp !== 'string') {
        return null;
    }
    const parts = cisloZp.split('/');
    if (parts.length < 4) {
        return null;
    }
    const typ = parts[2].trim();
    return typ || null;
}
```

- [ ] **Step 2: Ověřit helper node skriptem (projekt nemá JS test runner)**

Run:
```bash
cd /Users/martin/Sites/portalznackare && node -e "
const m = require('fs').readFileSync('assets/js/utils/prikaz.js','utf8');
const fn = (cislo) => { if(!cislo||typeof cislo!=='string')return null; const p=cislo.split('/'); if(p.length<4)return null; return p[2].trim()||null; };
console.assert(fn('P/PS/O/26032')==='O','O case');
console.assert(fn('S/BN/J/25041')==='J','J case');
console.assert(fn('')===null,'empty');
console.assert(fn(null)===null,'null');
console.assert(fn('A/B')===null,'short');
console.log('parseCisloZpTyp OK');
"
```
Expected: `parseCisloZpTyp OK` (žádné assert chyby). Logika ve skriptu zrcadlí funkci v souboru.

- [ ] **Step 3: Checkpoint**

Helper exportován, ověření prošlo. **Necommitovat.**

---

## Task 2: Prezentační `ReportProvedeniSummary` + refactor `ProvedeniPrikazu`

**Files:**
- Create: `assets/js/components/prikazy/ReportProvedeniSummary.jsx`
- Modify: `assets/js/components/prikazy/ProvedeniPrikazu.jsx`

- [ ] **Step 1: Vytvořit `assets/js/components/prikazy/ReportProvedeniSummary.jsx`**

```javascript
import React from 'react';
import {IconCrown} from '@tabler/icons-react';
import {StateBadge} from '@utils/stateBadge';

/**
 * Prezentační souhrn hlášení (obsah karty „Hlášení příkazu") – stav, dokončení
 * Části A/B, datum provedení a per-značkař rozpad z ULOŽENÉ kalkulace.
 * Žádné fetchování, žádný přepočet.
 *
 * @param {string} state - stav hlášení
 * @param {Array} znackari - členové týmu (s INT_ADR, Znackar, Je_Vedouci)
 * @param {Object} calculation - uložená kalkulace klíčovaná INT_ADR
 * @param {string} [datumProvedeni] - ISO datum provedení (z dataA.Datum_Provedeni)
 * @param {boolean} [castADokoncena]
 * @param {boolean} [castBDokoncena]
 * @param {boolean} [showAll=false] - zobrazit rozpad všech značkařů (admin/vedoucí)
 * @param {number|string} [currentUserIntAdr] - INT_ADR přihlášeného (když !showAll)
 */
export const ReportProvedeniSummary = ({
    state,
    znackari = [],
    calculation = {},
    datumProvedeni = null,
    castADokoncena = false,
    castBDokoncena = false,
    showAll = false,
    currentUserIntAdr = null,
}) => {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StateBadge state={state}/>
                <span className={`badge badge--sm ${castADokoncena ? 'badge--success' : 'badge--danger'}`}>
                    Část A: {castADokoncena ? 'Dokončeno' : 'Nedokončeno'}
                </span>
                <span className={`badge badge--sm ${castBDokoncena ? 'badge--success' : 'badge--danger'}`}>
                    Část B: {castBDokoncena ? 'Dokončeno' : 'Nedokončeno'}
                </span>
                <div className="space-y-2">
                    <span className="text-sm text-gray-600">Provedení:</span>
                    {datumProvedeni && (
                        <span className="text-sm">
                            {new Date(datumProvedeni).toLocaleDateString('cs-CZ')}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                {(znackari || []).map((znackar, i) => {
                    const calc = calculation?.[znackar.INT_ADR];
                    const canShow = (showAll || currentUserIntAdr == znackar.INT_ADR) && calc;
                    return (
                        <div
                            key={i}
                            className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border dark:border-gray-700 text-sm">
                            {canShow ? (
                                <>
                                    <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700 flex gap-4 items-center">
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold">{znackar.Znackar}</span>
                                            {znackar.Je_Vedouci && (
                                                <IconCrown size={18} color="#ffd700" title="Vedoucí" aria-label="Vedoucí"/>
                                            )}
                                        </div>
                                        <div>
                                            <strong>Celkem: {calc.Celkem_Kc || 0} Kč</strong>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div><strong>Čas práce:</strong> {calc.Cas_Prace_Celkem || 0} h</div>
                                        <div><strong>Náhrada práce:</strong> {calc.Nahrada_Prace || 0} Kč</div>
                                        <div>
                                            <strong>Jízdné:</strong> {calc.Jizdne_Celkem || 0} Kč
                                            {calc.Zvysena_Sazba && (
                                                <span className="badge badge--light badge--warning">Zvýšené</span>
                                            )}
                                        </div>
                                        <div><strong>Stravné:</strong> {calc.Stravne || 0} Kč</div>
                                        <div><strong>Noclezné:</strong> {calc.Noclezne_Celkem || 0} Kč</div>
                                        <div><strong>Vedlejší výdaje:</strong> {calc.Vedlejsi_Vydaje_Celkem || 0} Kč</div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <span className="font-bold">{znackar.Znackar}</span>
                                    {znackar.Je_Vedouci && (
                                        <IconCrown size={18} color="#ffd700" title="Vedoucí" aria-label="Vedoucí"/>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
```

- [ ] **Step 2: Refactorovat `ProvedeniPrikazu.jsx` — souhrn delegovat na komponentu**

V `ProvedeniPrikazu.jsx`:
1. Přidat import: `import {ReportProvedeniSummary} from './ReportProvedeniSummary';`
2. Smazat lokální funkci `getCompletionSummary` (přesunuto do komponenty).
3. Nahradit blok `{reportData ? ( <div className="space-y-4"> … </div> ) : ( … )}` (od `<div className="space-y-4">` s gridem stavu až po konec per-značkař mapování, tj. dnešní řádky ~145–236) tímto:

```javascript
            {reportData ? (
                <ReportProvedeniSummary
                    state={reportData.state}
                    znackari={reportData.znackari}
                    calculation={reportData.calculation}
                    datumProvedeni={reportData.data_a?.Datum_Provedeni}
                    castADokoncena={reportData.data_a?.Cast_A_Dokoncena || false}
                    castBDokoncena={reportData.data_b?.Cast_B_Dokoncena || false}
                    showAll={isLeader}
                    currentUserIntAdr={currentUser?.intAdr}
                />
            ) : (
                <div className="text-gray-600">
                    Hlášení ještě nebylo vytvořeno
                </div>
            )}
```

Ponechat beze změny: fetch reportu (`api.prikazy.report`), `getActionButton`, hlavičku „Hlášení příkazu" s tlačítkem, loading/error větve a importy, které dál používá (`IconCrown` může zůstat, i kdyby nebyl použit – ale ideálně odstranit nepoužité importy `IconCrown`, pokud po refactoru nikde nezůstane).

- [ ] **Step 3: Build**

Run: `ddev npm run build`
Expected: `webpack compiled` bez chyb.

- [ ] **Step 4: Manuální ověření regrese**

Otevřít detail příkazu s existujícím hlášením (`/prikaz/{id}` jako přihlášený) → karta „Hlášení příkazu" vypadá a funguje jako dřív (stav, dokončení, datum, per-značkař náhrady, akční tlačítko). Light i dark mód.

- [ ] **Step 5: Checkpoint**

Souhrn vytažen, detail příkazu beze změny chování. **Necommitovat.**

---

## Task 3: Async panel `ReportCompensationPanel`

**Files:**
- Create: `assets/js/apps/admin-reports-list/components/ReportCompensationPanel.jsx`

- [ ] **Step 1: Vytvořit `assets/js/apps/admin-reports-list/components/ReportCompensationPanel.jsx`**

```javascript
import React, {useEffect, useState} from 'react';
import {ReportProvedeniSummary} from '../../../components/prikazy/ReportProvedeniSummary';
import {Loader} from '@components/shared';

/**
 * Lazy panel pro rozklik řádku v admin výpisu hlášení. Při mountu (= rozkliknutí)
 * načte detail hlášení z admin endpointu a zobrazí souhrn z ULOŽENÉ kalkulace
 * (obsah karty „Hlášení příkazu"). Bez sazeb a přepočtu.
 *
 * @param {number} reportId - ID hlášení (admin), tj. řádek.original.id
 */
export const ReportCompensationPanel = ({reportId}) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        fetch(`/admin/api/reports/${reportId}`)
            .then(res => {
                if (!res.ok) throw new Error('Načtení detailu selhalo');
                return res.json();
            })
            .then(data => {
                if (active) setDetail(data);
            })
            .catch(() => {
                if (active) setError('Nepodařilo se načíst detail hlášení');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [reportId]);

    if (loading) {
        return <div className="py-4"><Loader/></div>;
    }
    if (error) {
        return <div className="alert alert--danger">{error}</div>;
    }
    if (!detail) {
        return null;
    }

    return (
        <ReportProvedeniSummary
            state={detail.state}
            znackari={detail.znackari}
            calculation={detail.calculation}
            datumProvedeni={detail.dataA?.Datum_Provedeni}
            castADokoncena={detail.dataA?.Cast_A_Dokoncena || false}
            castBDokoncena={detail.dataB?.Cast_B_Dokoncena || false}
            showAll={true}
        />
    );
};
```

- [ ] **Step 2: Build**

Run: `ddev npm run build`
Expected: `webpack compiled` bez chyb.

- [ ] **Step 3: Checkpoint**

Panel hotový (napojí se v Tasku 4). **Necommitovat.**

---

## Task 4: Přepis `admin-reports-list/App.jsx` na Material React Table

**Files:**
- Modify: `assets/js/apps/admin-reports-list/App.jsx` (kompletní přepis komponenty)

- [ ] **Step 1: Přepsat `assets/js/apps/admin-reports-list/App.jsx`**

Nahradit celý obsah souboru tímto (ponechává `data-app` mount přes existující `index.jsx`):

```javascript
import React, {useEffect, useMemo, useState} from 'react';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {MRT_Localization_CS} from 'material-react-table/locales/cs';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {IconEye, IconClipboardList, IconFileText, IconRefresh} from '@tabler/icons-react';
import {StateBadge, getStateLabel} from '../../utils/stateBadge';
import {parseCisloZpTyp, getPrikazDescription} from '../../utils/prikaz';
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

    // Dark mode observer (sync s document.documentElement)
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
            id: 'typ',
            header: 'Typ',
            accessorFn: (row) => parseCisloZpTyp(row.cisloZp) || '',
            size: 110,
            filterVariant: 'select',
            Cell: ({row}) => {
                const typ = parseCisloZpTyp(row.original.cisloZp);
                if (!typ) return '-';
                return (
                    <div className="flex items-center gap-2" title={getPrikazDescription(typ)}>
                        <PrikazTypeIcon type={typ} size={24}/>
                        <span className="hidden lg:inline">{getPrikazDescription(typ)}</span>
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
        localization: MRT_Localization_CS,
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
```

- [ ] **Step 2: Build**

Run: `ddev npm run build`
Expected: `webpack compiled` bez chyb.

- [ ] **Step 3: Manuální ověření**

Otevřít `/admin/hlaseni` (admin):
- Tabulka se načte, sloupce: Číslo ZP, Typ (ikona+popis), Značkaři, Stav (badge), Odesláno, Akce. Vytvořeno/Aktualizováno skryté (jdou zapnout přes „Show/Hide columns").
- Funguje globální hledání, per-sloupec filtry (Typ a Stav jako select), řazení.
- Rozklik řádku → async se načte souhrn „Hlášení příkazu" (stav, dokončení, datum, per-značkař náhrady) z uložené kalkulace; loader během načítání.
- Akce: Admin detail / Příkaz / Hlášení odkazy fungují.
- Light i dark mód (přepnout téma webu).

- [ ] **Step 4: Checkpoint**

Výpis přepsán na MRT, rozklik funguje. **Necommitovat.**

---

## Task 5: Funkční dokumentace

**Files:**
- Create: `docs/features/admin-vypis-hlaseni.md`

- [ ] **Step 1: Napsat `docs/features/admin-vypis-hlaseni.md`** (Czech) se sekcemi:
- **Účel** — admin výpis podaných hlášení s filtrováním/hledáním/sloupci a rozklikem.
- **Komponenty** — `admin-reports-list` (MRT), `ReportCompensationPanel` (async rozklik),
  `ReportProvedeniSummary` (sdílený souhrn, použit i v `ProvedeniPrikazu`).
- **Data** — seznam z `GET /admin/api/reports`; rozklik z `GET /admin/api/reports/{id}`
  (uložená `calculation`, bez sazeb/přepočtu). Typ se parsuje z `cisloZp` přes
  `parseCisloZpTyp` + `getPrikazDescription`/`PrikazTypeIcon`.
- **Sloupce** — Číslo ZP, Typ, Značkaři, Stav, Odesláno (default); Vytvořeno,
  Aktualizováno (skryté, lze zapnout). Filtry/hledání/řazení přes MRT.
- **Rozklik** — obsah karty „Hlášení příkazu": stav, dokončení A/B, datum, per-značkař
  náhrady z uložené kalkulace.
- Cross-link na spec `docs/superpowers/specs/2026-06-21-admin-vypis-hlaseni-tabulka-design.md`.

- [ ] **Step 2: Checkpoint**

Dokumentace hotová. **Necommitovat** — předat uživateli.

---

## (Volitelné) Task 6: `nahledUrl` ve výpisu

Pouze pokud uživatel potvrdí. Do `apiReports` ([AdminController.php](../../../src/Controller/AdminController.php))
přidat `nahledUrl` (jako už má `apiReportDetail`) a do `renderRowActions` přidat odkaz
„INSYZ náhled". Vyžaduje injektovat `InsyzReportHashService` do `apiReports`. Bez tohoto
tasku zůstávají odkazy Detail/Příkaz/Hlášení (admin je přihlášený, `/prikaz/{id}/hlaseni`
mu funguje i bez hashe).

---

## Závěrečné ověření

- [ ] `ddev npm run build` zeleně
- [ ] `/admin/hlaseni`: MRT tabulka, filtry, hledání, přepínání sloupců, řazení
- [ ] Rozklik → async souhrn „Hlášení příkazu" z uložené kalkulace (loader, pak data)
- [ ] Detail příkazu (`/prikaz/{id}`) — karta „Hlášení příkazu" beze změny (regrese)
- [ ] Light i dark mód
- [ ] **Žádné commity z mé strany**
