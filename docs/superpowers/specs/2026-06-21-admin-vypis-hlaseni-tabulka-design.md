# Návrh: Obohacený admin výpis podaných hlášení (Material React Table)

**Datum:** 2026-06-21
**Stav:** Návrh schválen, čeká na revizi specu

## 1. Účel a kontext

Administrace má výpis hlášení ([`admin-reports-list/App.jsx`](../../../assets/js/apps/admin-reports-list/App.jsx)),
což už dnes je React app s ručně skládanou `@tanstack/react-table` bez filtrů a hledání.
Cílem je přepsat ji na **Material React Table (MRT)** kvůli podrobnějšímu filtrování,
hledání, přepínání viditelnosti sloupců a **rozkliku řádku** se základním přehledem
náhrad.

MRT je projektový standard pro bohaté tabulky (už v `prikazy` a `prikaz-detail`) a
odpovídá pravidlu CLAUDE.md „Material React Table ONLY for tables". MRT staví na
TanStacku a filtrování/hledání/viditelnost sloupců/rozklik/stránkování má hotové.

## 2. Knihovna a vzor

Použít MRT podle existujícího vzoru v [`prikazy/App.jsx`](../../../assets/js/apps/prikazy/App.jsx):
- `MaterialReactTable` + `useMaterialReactTable`
- `MRT_Localization_CS` (česká lokalizace)
- MUI `ThemeProvider` + `createTheme` pro light/dark mód (synchronizace s
  `document.documentElement.classList`)
- `renderDetailPanel` pro rozklik řádku

Klientské filtrování/řazení/stránkování (admin počty hlášení jsou v řádu desítek až
nižších stovek; server-side není potřeba).

## 3. Sloupce

| Sloupec | Zdroj | Výchozí viditelnost | Filtr |
|---|---|---|---|
| Číslo ZP | `cisloZp` | ✅ | text |
| Typ | odvozeno z `cisloZp` (3. segment) | ✅ | select/text |
| Značkaři | `znackari[].Znackar/name` | ✅ | text |
| Stav | `state` → `StateBadge` | ✅ | select |
| Odesláno | `dateSend` | ✅ | datum/řazení |
| Vytvořeno | `dateCreated` | 🚫 skryto | datum/řazení |
| Aktualizováno | `dateUpdated` | 🚫 skryto | datum/řazení |
| Akce | — | ✅ | — |

- **Typ:** z `cisloZp` ve tvaru `kraj/obvod/typ/číslo` (např. `P/PS/O/26032`) se vezme
  3. segment (`O`) a zobrazí se přes `PrikazTypeIcon` + `getPrikazDescription`
  ([prikaz.js](../../../assets/js/utils/prikaz.js)). Helper `parseCisloZpTyp(cisloZp)`.
- **Akce:** odkaz na Detail (`/admin/hlaseni/{id}`) a otevření INSYZ náhledu
  (URL už generuje `apiReportDetail` jako `nahledUrl`, případně přidat do `apiReports`).
- Globální hledání (MRT) + per-sloupec filtry + přepínání viditelnosti sloupců zapnuté.

## 4. Rozklik řádku (async, jen z uložených dat)

`renderDetailPanel` pro rozkliknutý řádek **asynchronně** načte detail hlášení a
vyrenderuje **obsah karty „Hlášení příkazu"** z detailu příkazu — tj. souhrn, který dnes
zobrazuje komponenta [`ProvedeniPrikazu`](../../../assets/js/components/prikazy/ProvedeniPrikazu.jsx).
Vše z **uložených dat** (`calculation`, `znackari`, `dataA`) — žádný přepočet, žádné
sazby, žádná `CompensationSummary`.

Obsah (per značkař, z uložené `calculation[INT_ADR]`):
- **Celkem** (`Celkem_Kc`) Kč
- **Čas práce** (`Cas_Prace_Celkem`) h
- **Náhrada práce** (`Nahrada_Prace`) Kč
- **Jízdné** (`Jizdne_Celkem`) Kč + badge „Zvýšené" (`Zvysena_Sazba`)
- **Stravné** (`Stravne`) Kč
- **Noclezné** (`Noclezne_Celkem`) Kč
- **Vedlejší výdaje** (`Vedlejsi_Vydaje_Celkem`) Kč

Hlavička souhrnu: stav (`StateBadge`), dokončení Části A/B, datum provedení
(`dataA.Datum_Provedeni`), jméno značkaře (+ koruna u vedoucího). Admin vidí všechny
značkaře (jako `isLeader`).

- Data: **jediný request** `GET /admin/api/reports/{id}` (`apiReportDetail` – vrací
  `calculation`, `dataA`, `znackari`, `state`). **Žádné sazby, žádné `tariffRates`.**
- Během načítání `Loader`; chyba → hláška. Lazy load až při rozkliknutí.

## 5. DRY: prezentační komponenta `ReportProvedeniSummary`

Tělo dnešní [`ProvedeniPrikazu`](../../../assets/js/components/prikazy/ProvedeniPrikazu.jsx)
(souhrn stavu + per-značkař rozpad z `calculation`) se vytáhne do čistě prezentační
komponenty bez vlastního fetchování:

```
ReportProvedeniSummary({ state, znackari, calculation, datumProvedeni,
                         castADokoncena, castBDokoncena, showAll = false })
  → hlavička: StateBadge + dokončení A/B + datum
  → pro každého značkaře z `znackari`: pokud showAll (admin) nebo je to daný uživatel,
    vykreslí rozpad z `calculation[INT_ADR]` (Celkem, čas práce, náhrada, jízdné,
    stravné, noclezné, vedlejší)
```

Použití:
- **Rozklik v seznamu** (`admin-reports-list`) — `ReportCompensationPanel({ reportId })`,
  který fetchne `apiReportDetail` a předá data do `ReportProvedeniSummary` se `showAll`.
- **`ProvedeniPrikazu`** (na detailu příkazu) — refactor: ponechá si fetch
  `api.prikazy.report` a předá data do `ReportProvedeniSummary` (DRY, jeden vzhled).

Tím se vzhled souhrnu drží na jednom místě a admin rozklik = přesně to, co je v kartě
„Hlášení příkazu".

## 6. Backend

Beze změny endpointů:
- Seznam: `apiReports` (stávající). Typ se parsuje na FE z `cisloZp`.
- Rozklik: pouze `apiReportDetail` (stávající) — vrací uloženou `calculation`. Žádné sazby.

Volitelně: do `apiReports` přidat `nahledUrl` (jako už má `apiReportDetail`), aby šel
odkaz na INSYZ náhled rovnou ze seznamu bez dalšího requestu. (Drobnost, lze i bez ní.)

## 7. Dotčené soubory

**Nové:**
- `assets/js/components/prikazy/ReportProvedeniSummary.jsx` — prezentační souhrn
  (vytažen z `ProvedeniPrikazu`)
- `assets/js/apps/admin-reports-list/components/ReportCompensationPanel.jsx` — async
  panel pro rozklik (fetch `apiReportDetail` → `ReportProvedeniSummary`)
- helper `parseCisloZpTyp` (do `assets/js/utils/prikaz.js`)
- `docs/features/admin-vypis-hlaseni.md` (funkční dokumentace)

**Upravené:**
- `assets/js/apps/admin-reports-list/App.jsx` — přepis na MRT + rozklik
- `assets/js/components/prikazy/ProvedeniPrikazu.jsx` — refactor: souhrn delegovat na
  `ReportProvedeniSummary` (zachovat stávající chování)
- volitelně `src/Controller/AdminController.php` — `nahledUrl` v `apiReports`

## 8. Mimo rozsah / předpoklady

- Bez server-side filtrování/stránkování (klientské stačí).
- Bez změny ukládání hlášení ani výpočtu náhrad — jen zobrazení.
- Mobilní zobrazení: MRT `renderDetailPanel` (jako v `prikazy`); detailní ladění
  responsivity mimo rozsah.

## 9. Rizika

- **Výkon rozkliku:** 1 lazy request na rozklik (`apiReportDetail`); částky z uložené
  `calculation`, žádný přepočet ani ceník. Volitelně cache už načtených detailů ve stavu.
- **Parsování typu:** spoléhá na konzistentní formát `cisloZp` (`kraj/obvod/typ/číslo`).
  Helper musí ošetřit nestandardní/prázdné číslo (fallback bez ikony).
- **Tvar dat:** admin endpoint `apiReportDetail` vrací `znackari`, `calculation`,
  `dataA`, `state` (admin endpoint, známý tvar). `ReportProvedeniSummary` musí číst
  data jednotně přes explicitní props (panel je normalizuje z apiReportDetail, resp.
  `ProvedeniPrikazu` z `api.prikazy.report`), aby nezáleželo na camelCase/snake_case
  rozdílech mezi endpointy.
- **Refactor `ProvedeniPrikazu`:** vytažení souhrnu nesmí změnit dnešní chování karty
  na detailu příkazu (regrese).
