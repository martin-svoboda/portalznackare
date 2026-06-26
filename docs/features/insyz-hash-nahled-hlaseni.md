# Externí read-only náhled hlášení přes INSYZ hash

## Účel

Správci systému INSYZ mají k dispozici přímou, bezpečnou URL pro zobrazení **kompletního
vyplněného hlášení** příkazu — read-only, bez možnosti úprav, včetně náhledů všech příloh.
Slouží k ověření hlášení proti zdrojovému systému. URL se nikam nerozesílá; INSYZ si ji
umí deterministicky zreplikovat.

Náhled používá **tutéž React aplikaci** `hlaseni-prikazu` jako editor značkaře (jediný
zdroj pravdy) — jen v read-only režimu s daty předvyplněnými ze serveru.

## URL a hash

```
/prikaz/{id}/hlaseni?insyz-hash=<HASH>
```

- `{id}` je **id** příkazu = `Report::idZp` (např. `53833`).
- Vstupem do hashe je **číslo** příkazu = `Report::cisloZp` (např. `P/PS/O/26032`), které
  v URL **není** — funguje jako součást tajemství.
- Hash:

```
insyz-hash = strtoupper(sha1(INSYZ_REPORT_HASH_SECRET . cisloZp))
```

To je stejný deterministický mechanismus jako hashování hesel
(`InsyzService::createPasswordHash` = `strtoupper(sha1(...))`, odpovídá MSSQL
`UPPER(HASHBYTES('SHA1', ...))`). INSYZ i Portál spočítají hash identicky díky sdílenému
tajnému klíči.

Implementace: [`App\Service\InsyzReportHashService`](../../src/Service/InsyzReportHashService.php)
(`generate()`, `verify()` přes `hash_equals`). Portál v provozu používá pouze `verify()`
(URL generuje INSYZ).

## Chování přístupu

Rozhoduje [`AppController::prikazHlaseni`](../../src/Controller/AppController.php):

| Stav | Chování |
|---|---|
| Přihlášený uživatel | Plný editor dle práv (beze změny) |
| Anonym + platný `insyz-hash` | Read-only náhled s daty ze serveru |
| Anonym bez/s neplatným hashem | Výzva k přihlášení |
| Neexistující hlášení (idZp) | 404 |
| Neplatný hash | 403 |

V [`config/packages/security.yaml`](../../config/packages/security.yaml) je cesta
`^/prikaz/\d+/hlaseni$` nastavena na `PUBLIC_ACCESS` (PŘED `^/prikaz/`), skutečnou
autorizaci řeší controller.

## Bootstrap dat

React aplikace běžně načítá data čtyřmi chráněnými `/api/*` voláními (pro anonyma 401).
V režimu náhledu je controller po ověření hashe sestaví na serveru voláním **týchž
services** a vloží do stránky jako `<script type="application/json" id="insyz-bootstrap">`
(bezpečně zakódováno s `JSON_HEX_TAG` proti `</script>` breakoutu).

| Klientské volání | Service na serveru | Klíč v bootstrapu |
|---|---|---|
| `GET /api/insyz/prikaz/{id}` | `InsyzService::getPrikaz()` + `DataEnricherService::enrichPrikazDetail()` | `orderData` |
| `GET /api/portal/report` | serializace Report (`report:read`) | `reportData` |
| `GET /api/insyz/sazby` | `InsyzService::getSazby()` | `sazby` |
| `GET /api/insyz/user` ×N | `InsyzService::getUser()` | `usersDetails` |

INT_ADR pro INSYZ volání se bere z `Report::getIntAdr()` (vlastník hlášení),
`getPrikaz()` se volá se `skipOwnerCheck = true`.

V [`App.jsx`](../../assets/js/apps/hlaseni-prikazu/App.jsx) (`loadAllData`) aplikace při
přítomnosti bootstrapu použije jeho data místo `fetch`; veškeré zpracování zůstává v JS.
Náhledový režim signalizuje atribut `data-insyz-view="true"` na mount elementu →
`canEdit = false` (autosave i save UI jsou gated `canEdit`, takže žádné zápisy) a
`isLeader = true` (zobrazí kompenzace všech členů týmu).

Náhledy příloh fungují i anonymně — `/uploads/...` není pod `access_control` (chráněné
soubory mají token přímo v URL).

## Detekce nesouladu TIM

Funguje **vždy** — v editoru i v náhledu (tatáž aplikace). Porovnává hodnoty zapsané
v hlášení proti aktuálním datům z INSYZ a nenápadně označí rozdíly.

- **Porovnávaná pole:** `Rok_Vyroby` a `Smerovani` — jediná pole, která pocházejí
  z INSYZ a značkař je zároveň edituje. (`Zachovalost`, `Koment`, fotky jsou ryze
  pozorování značkaře, v INSYZ nejsou → neporovnávají se. Složení týmu řeší samostatně
  `TeamMismatchWarning`.)
- **Sémantika:** nesoulad je **informativní**, nikoli chyba — hodnota od značkaře může
  být legitimně správná (tabulka byla v terénu vyměněna). Proto se **nenabízí přepis**.
- **Zobrazení:** drobný oranžový text inline v řádku položky:
  `V INSYZ je evidováno <hodnota>` (u `Smerovani` lidsky čitelně „Levá"/„Pravá").
  Bez ikon a rámečků, jen u polí, kde rozdíl skutečně je.

Implementace:
- [`utils/timMismatch.js`](../../assets/js/apps/hlaseni-prikazu/utils/timMismatch.js) —
  `computeTimMismatch(formData, predmety)` vrací mapu
  `{ [ID_PREDMETY]: { Rok_Vyroby?, Smerovani? } }`. Zvládá oba tvary `Stavy_Tim[].Predmety`
  (pole i objekt klíčovaný `ID_PREDMETY`).
- [`App.jsx`](../../assets/js/apps/hlaseni-prikazu/App.jsx) — `timMismatch` useMemo,
  předáno přes `StepContent` do `PartBForm` i `PartBSummary`.
- [`components/TimMismatchNote.jsx`](../../assets/js/apps/hlaseni-prikazu/components/TimMismatchNote.jsx)
  — inline oranžová poznámka (s dark-mode variantou).

## Konfigurace

`.env` (a placeholder v `.env.local.example`):

```dotenv
INSYZ_REPORT_HASH_SECRET=<náhodný řetězec, identický v INSYZ>
```

Binding v [`config/services.yaml`](../../config/services.yaml) přes
`bind: $insyzReportHashSecret: '%env(INSYZ_REPORT_HASH_SECRET)%'`.

## Zobrazení URL v administraci

V administraci detailu hlášení ([`admin-report-detail/App.jsx`](../../assets/js/apps/admin-report-detail/App.jsx),
záložka „Základní info") se správci `ROLE_ADMIN` zobrazuje hotová náhledová URL
s hashem + tlačítka „Kopírovat" a „Otevřít". URL generuje
[`AdminController::apiReportDetail`](../../src/Controller/AdminController.php) přes
`InsyzReportHashService::generate()` a `generateUrl(..., ABSOLUTE_URL)` (pole `nahledUrl`).
Je to jen pro pohodlí administrátora — endpoint je za `ROLE_ADMIN`.

## Předpoklady

- Hlášení (Report) musí existovat — bez něj není `cisloZp` k ověření ani co zobrazit.
- INSYZ si URL generuje sám stejným algoritmem; Portál ji ověřuje a (pro adminy)
  zobrazuje v administraci.

## Související

- Návrhový dokument (spec): [docs/superpowers/specs/2026-06-18-insyz-hash-nahled-hlaseni-design.md](../superpowers/specs/2026-06-18-insyz-hash-nahled-hlaseni-design.md)
- Implementační plán: [docs/superpowers/plans/2026-06-18-insyz-hash-nahled-hlaseni.md](../superpowers/plans/2026-06-18-insyz-hash-nahled-hlaseni.md)
