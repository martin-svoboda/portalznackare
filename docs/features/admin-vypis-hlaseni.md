# Admin výpis podaných hlášení

## Účel

Administrace zobrazuje výpis podaných hlášení v tabulce postavené na **Material React
Table (MRT)** s filtrováním, fulltextovým hledáním, přepínáním viditelnosti sloupců,
řazením a **rozklikem řádku**, který asynchronně ukáže souhrn náhrad (obsah karty
„Hlášení příkazu") z uložené kalkulace.

## Komponenty

- [`admin-reports-list/App.jsx`](../../assets/js/apps/admin-reports-list/App.jsx) —
  MRT tabulka (dle vzoru `prikazy` appky: `MRT_Localization_CS`, MUI `ThemeProvider`
  pro light/dark mód synchronizovaný s `document.documentElement`).
- [`admin-reports-list/components/ReportCompensationPanel.jsx`](../../assets/js/apps/admin-reports-list/components/ReportCompensationPanel.jsx)
  — lazy panel pro rozklik; při rozkliknutí načte detail hlášení a vyrenderuje souhrn.
- [`components/prikazy/ReportProvedeniSummary.jsx`](../../assets/js/components/prikazy/ReportProvedeniSummary.jsx)
  — sdílená prezentační komponenta souhrnu (stav, dokončení A/B, datum, per-značkař
  rozpad z uložené kalkulace). Použita v rozkliku **i** v
  [`ProvedeniPrikazu`](../../assets/js/components/prikazy/ProvedeniPrikazu.jsx) na detailu
  příkazu — jeden zdroj pravdy.

## Data

- **Seznam:** `GET /admin/api/reports` ([AdminController::apiReports](../../src/Controller/AdminController.php))
  — vrací `id, idZp, cisloZp, znackari, state, dateCreated, dateUpdated, dateSend`.
- **Rozklik:** `GET /admin/api/reports/{id}` ([apiReportDetail](../../src/Controller/AdminController.php))
  — vrací uloženou `calculation`, `dataA`, `dataB`, `znackari`, `state`.
  **Jen z uložených dat — žádný přepočet ani načítání ceníku.**
- **Kraj / Obvod / Typ** se parsují na frontendu z `cisloZp` (tvar
  `kraj/obvod/typ/číslo`) přes `parseCisloZp` ([prikaz.js](../../assets/js/utils/prikaz.js));
  u typu se zobrazuje zkratka + `PrikazTypeIcon`, popis (`getPrikazDescription`) je
  v tooltipu.

## Sloupce

| Sloupec | Výchozí | Pozn. |
|---|---|---|
| Číslo ZP | ✅ | text filtr |
| INSYZ ID | ✅ | `idZp` (id ZP z INSYZ) |
| Kraj | ✅ | zkratka (1. segment `cisloZp`), select filtr |
| Obvod | ✅ | zkratka (2. segment `cisloZp`), select filtr |
| Typ | ✅ | ikona + zkratka (3. segment), select filtr; popis v tooltipu |
| Značkaři | ✅ | text filtr |
| Stav | ✅ | `StateBadge`, select filtr |
| Odesláno | ✅ | datum |
| Vytvořeno | 🚫 skryto | lze zapnout (column actions) |
| Aktualizováno | 🚫 skryto | lze zapnout |
| Akce | ✅ | Admin detail / Příkaz / Hlášení |

Globální hledání, per-sloupec filtry, řazení a přepínání viditelnosti sloupců zajišťuje
MRT. Stránkování se zapne při více než 20 záznamech.

## Rozklik (souhrn hlášení)

Po rozkliknutí řádku se zobrazí obsah odpovídající kartě „Hlášení příkazu":
- stav (`StateBadge`), dokončení Části A/B, datum provedení,
- per značkař z uložené `calculation[INT_ADR]`: **Celkem**, **Čas práce**,
  **Náhrada práce**, **Jízdné** (+ badge „Zvýšené"), **Stravné**, **Noclezné**,
  **Vedlejší výdaje**.

Admin vidí rozpad všech značkařů (`showAll`). Načítá se lazy až při rozkliknutí.

## Související

- Návrh (spec): [docs/superpowers/specs/2026-06-21-admin-vypis-hlaseni-tabulka-design.md](../superpowers/specs/2026-06-21-admin-vypis-hlaseni-tabulka-design.md)
- Implementační plán: [docs/superpowers/plans/2026-06-21-admin-vypis-hlaseni-tabulka.md](../superpowers/plans/2026-06-21-admin-vypis-hlaseni-tabulka.md)
