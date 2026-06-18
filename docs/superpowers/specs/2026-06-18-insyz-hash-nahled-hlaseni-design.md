# Návrh: Externí read-only náhled hlášení přes INSYZ hash

**Datum:** 2026-06-18
**Stav:** Návrh ke schválení

## 1. Účel a kontext

Správci systému INSYZ potřebují přímou, bezpečnou URL pro zobrazení **kompletního
vyplněného hlášení** příkazu — read-only, bez možnosti úprav, včetně náhledů všech
příloh. URL nebude nikam rozesílána; INSYZ si ji musí umět **deterministicky
zreplikovat** ze základní URL hlášení + unikátního hashe.

Stejnou URL hlášení (`/prikaz/{id}/hlaseni`) dnes používá přihlášený značkař v editoru.
Tento návrh ji rozšiřuje o **anonymní read-only přístup ověřený hashem**, přičemž
využívá tutéž React aplikaci (`hlaseni-prikazu`) — žádný paralelní read-only render
(SSOT / DRY).

Součástí je i **detekce nesouladu** mezi hodnotami zapsanými v hlášení a aktuálními
daty z INSYZ (rok výroby a směrování TIM předmětů), zobrazená nenápadně jako
informativní upozornění.

## 2. Bezpečnostní model (hash)

INSYZ hashuje hesla deterministicky:
`WEBPwdHash = UPPER(CONVERT(VARCHAR(40), HASHBYTES('SHA1', 'Heslo.Text'), 2))`.
V Portálu to odpovídá `InsyzService::createPasswordHash()` =
`strtoupper(sha1($password))`. Stejný **deterministický** mechanismus použijeme pro
podpis URL.

**Klíčový rozdíl id vs. číslo příkazu:**
- V URL je **id** příkazu (`53833`) = pole `Report::idZp`.
- Vstupem do hashe je **číslo** příkazu (`P/PS/O/26032`) = pole `Report::cisloZp`,
  které v URL **není** — funguje jako součást tajemství.

**Vstup do hashe = sdílený tajný klíč + číslo příkazu:**

```
insyz-hash = strtoupper(sha1(SECRET ~ cisloZp))
```

Sdílený tajný klíč (`SECRET`) zná Portál i INSYZ. Důvod: číslo příkazu lze odvodit
z PDF/detailu, takže samotné číslo by neposkytlo skutečnou ochranu; tajný klíč přidává
reálnou bariéru proti zfalšování URL.

**Nová služba `InsyzReportHashService`:**
- `generate(string $cisloZp): string` → `strtoupper(sha1($secret . $cisloZp))`
- `verify(string $cisloZp, string $hash): bool` → porovnání přes `hash_equals()`
  (konstantní čas)
- `SECRET` z `.env` jako `INSYZ_REPORT_HASH_SECRET` (binding přes services.yaml)

V provozu Portál používá pouze `verify()` (URL generuje INSYZ). `generate()` slouží
k testům a ladění.

## 3. Routing a přístup

URL zůstává beze změny: `/prikaz/{id}/hlaseni?insyz-hash=…`.

**Access control** ([config/packages/security.yaml](../../../config/packages/security.yaml)):
přidat **před** pravidlo `^/prikaz/` výjimku:

```yaml
- { path: '^/prikaz/\d+/hlaseni$', roles: PUBLIC_ACCESS }
```

(Pořadí je důležité — platí první shoda.) Skutečnou autorizaci řeší controller.

**Controller** [`AppController::prikazHlaseni`](../../../src/Controller/AppController.php):
1. **Přihlášený uživatel** → dnešní chování (plná appka, editace dle práv). Beze změny.
2. **Anonym + platný `insyz-hash`**:
   - najít `Report` podle `idZp` = id z URL; pokud neexistuje → 404,
   - ověřit `InsyzReportHashService::verify($report->getCisloZp(), $hash)`;
     neshoda → 403,
   - sestavit bootstrap data (kap. 4) a vyrenderovat stránku v režimu náhledu.
3. **Anonym bez/ s neplatným hashem** → dnešní hláška „Přihlášení vyžadováno".

## 4. Bootstrap dat

React aplikace dnes načítá data čtyřmi typy volání, která pro anonyma vracejí 401
(všechna `/api/*` vyžadují `ROLE_USER`):

| Klientské volání | Endpoint | Service na serveru |
|---|---|---|
| `api.prikazy.detail(id)` | `GET /api/insyz/prikaz/{id}` | `InsyzService::getPrikaz()` + `DataEnricherService::enrichPrikazDetail()` |
| `api.prikazy.report(id)` | `GET /api/portal/report?id_zp=` | `ReportRepository` + serializace `report:read` |
| `api.insyz.sazby(date)` | `GET /api/insyz/sazby` | `InsyzService` (sazby) |
| `api.insyz.user(int_adr)` ×N | `GET /api/insyz/user` | `InsyzService::getUser()` |

Naproti tomu přílohy a thumbnaily (`/uploads/...`) **nejsou pod access_control** →
fungují i anonymně (chráněné soubory mají token přímo v URL). Náhledy příloh tedy
fungují bez přihlášení.

**Mechanismus:** controller po ověření hashe zavolá **tytéž services** jako endpointy
výše a jejich **raw výstup** vloží do Twig stránky jako JSON (datový atribut / `<script
type="application/json">`). INT_ADR pro volání INSYZ se bere z `Report::getIntAdr()`
(vlastník hlášení); `getPrikaz()` se volá se `skipOwnerCheck = true`.

Aplikace v `loadAllData` místo `fetch` použije tato předvyplněná data. **Veškeré
zpracování zůstává v JS beze změny** (předvyplnění `Stavy_Tim`, parsování sazeb,
extrakce týmu…) — duplikuje se jen zdroj dat (raw payload), ne logika.

Bezpečnostní přínos: anonymní uživatel nemá přístup k žádnému `/api/*`; vše je
získáno serverem až po ověření hashe.

## 5. Změny v React aplikaci (minimální)

[`assets/js/apps/hlaseni-prikazu/App.jsx`](../../../assets/js/apps/hlaseni-prikazu/App.jsx):

- **Bootstrap:** na začátku `loadAllData` zjistit, zda jsou na stránce předvyplněná
  data; pokud ano, použít je místo API volání. Jinak vše beze změny.
- **Režim náhledu:** nový datový atribut `data-insyz-view="true"` na mount elementu →
  - `isLeader = true` (náhled zobrazí kompenzace **všech** členů týmu, stejně jako
    admin detail),
  - `canEdit = false` (read-only). Autosave je už dnes gated `enabled: appData.canEdit
    && …`, save UI rovněž → žádné zápisy.

Šablona [templates/pages/prikaz-hlaseni.html.twig](../../../templates/pages/prikaz-hlaseni.html.twig)
v režimu náhledu vykreslí tentýž mount point s `data-insyz-view` a bootstrap JSON;
nevyžaduje přihlášeného uživatele.

## 6. Detekce nesouladu TIM (always-on)

Funguje **vždy** — v editoru značkaře i v INSYZ náhledu — protože jde o tutéž
aplikaci. Vzor je analogický existující detekci nesouladu týmu
([`teamMismatch` useMemo](../../../assets/js/apps/hlaseni-prikazu/App.jsx) +
[`TeamMismatchWarning`](../../../assets/js/apps/hlaseni-prikazu/components/TeamMismatchWarning.jsx)).

**Porovnávaná pole** (jediná, která pocházejí z INSYZ a značkař je zároveň edituje):
- `Rok_Vyroby` — zapsaný letopočet vs. `predmety[].Rok_Vyroby`
- `Smerovani` — orientace šipky (L/P) vs. `predmety[].Smerovani`

`Zachovalost`, `Koment` a fotopřílohy jsou ryze pozorování značkaře (v INSYZ nejsou) →
neporovnávají se. Složení týmu řeší samostatně `TeamMismatchWarning`.

**Párování:** předmět ve `Stavy_Tim` ↔ INSYZ `predmety` přes `ID_PREDMETY`
(per TIM `EvCi_TIM` + index).

**Sémantika:** nesoulad je **pouze informace**, nikoli chyba. Hodnota od značkaře může
být legitimně správná (tabulka byla v terénu vyměněna). Proto se **nenabízí přepsání**
hlášení hodnotou z INSYZ (na rozdíl od týmu, kde je INSYZ autoritativní).

Nová pomocná logika: `timMismatch` useMemo v App.jsx vracející seznam položek s
odchylkou (`{ ID_PREDMETY, pole, hodnotaHlaseni, hodnotaInsyz }`), předaný do
zobrazovacích komponent.

## 7. Zobrazení nesouladu (UI)

Minimalistické, nenápadné, nepůsobící jako chyba — pouze upozornění, aby si toho někdo
následně všiml a data ověřil/opravil v INSYZ.

- **Umístění:** přímo v řádku dotčené položky (TIM předmětu).
- **Forma:** drobný **oranžový text**, např. `V INSYZ je evidováno 2015`
  (pro `Smerovani` s lidsky čitelným popisem: `V INSYZ je evidováno Levá`).
- Bez ikon výstrahy, bez rámečků, bez tlačítek. Zobrazí se jen u polí, kde odchylka
  skutečně je.
- Konzistentně v editoru i v náhledu.

## 8. Předpoklady a mimo rozsah

- **Předpoklad:** hlášení (`Report`) musí existovat — bez něj není `cisloZp` k ověření
  ani co zobrazit. Náhled neexistujícího hlášení vrací 404.
- **Mimo rozsah:** Portál URL nikam negeneruje ani nezobrazuje (generuje ji INSYZ);
  Portál pouze ověřuje. Dnešní přihlášený tok zůstává beze změny.

## 9. Dotčené soubory

**Nové:**
- `src/Service/InsyzReportHashService.php`
- `docs/features/insyz-hash-nahled-hlaseni.md` (funkční dokumentace — vznikne při
  implementaci, dle pravidla „Definition of Done")
- nová React komponenta / značka pro zobrazení nesouladu TIM v řádku položky

**Upravené:**
- `config/packages/security.yaml` — výjimka access_control
- `config/services.yaml` — binding `INSYZ_REPORT_HASH_SECRET`
- `.env` / `.env.example` — `INSYZ_REPORT_HASH_SECRET`
- `src/Controller/AppController.php` — větvení `prikazHlaseni` + sestavení bootstrapu
- `templates/pages/prikaz-hlaseni.html.twig` — režim náhledu + bootstrap JSON +
  `data-insyz-view`
- `assets/js/apps/hlaseni-prikazu/App.jsx` — bootstrap v `loadAllData`, `data-insyz-view`,
  `timMismatch` useMemo
- zobrazovací komponenty TIM položek (`PartBSummary.jsx`, příp. `TimDetailForm.jsx` /
  `PartBForm.jsx`) — inline text nesouladu

## 10. Rizika a otevřené otázky

- **Velikost bootstrapu:** raw payloady (detail příkazu + report + sazby + detaily N
  uživatelů) se vkládají do HTML. U velkých příkazů větší stránka — akceptovatelné pro
  read-only náhled.
- **Konzistence enrichmentu:** bootstrap musí replikovat **přesně** strukturu odpovědí
  endpointů (zejm. `enrichPrikazDetail`), jinak se klient zachová jinak. Mitigace:
  volat tytéž services se stejnými parametry.
- **Párování předmětů** při nesouladu se opírá o `ID_PREDMETY`; je potřeba ověřit, že
  je stabilní mezi uloženým hlášením a aktuálními INSYZ daty.
