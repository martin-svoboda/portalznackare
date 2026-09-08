# Hlášení příkazů ZP-I (INSYZ-280) — implementační plán

> **Pro agentní workery:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (doporučeno) nebo superpowers:executing-plans. Kroky používají checkbox (`- [ ]`).
>
> **⛔ ZÁKAZ COMMITŮ:** V tomto projektu se **nikdy** nespouští `git commit`/`git push` ani se nemění git stav. Plán proto **neobsahuje commit kroky** — verzování dělá uživatel. Každý task končí „Checkpoint" (ověření).

**Zadání:** [INSYZ-280 — FE Prezentace ZPI vč. výpočtu](https://insyz.atlassian.net/browse/INSYZ-280), reporter Michal Markoš, priorita Highest.

Rodičovský [INSYZ-278 — Příkaz typu ZPI](https://insyz.atlassian.net/browse/INSYZ-278) („Příkaz typu ZPI vypadá, základně funguje, pár zlepšení to ale chce (viz podúkoly)") vlastní věcné zadání nemá — nese jen diskuzi nad auditem dat z 2. 9. 2026, jejíž závěry jsou promítnuté ve Východiscích níže. Má tři podúkoly:

| Podúkol | Stav vůči tomuto plánu |
|---|---|
| INSYZ-279 — data ze SP | Honzou označen jako splněný (15. 6.), ověřen auditem; zbývá akceptace |
| INSYZ-280 — FE prezentace vč. výpočtu | **Rozsah tohoto plánu** |
| INSYZ-282 — kontrolní formulář PDF pro ZP-I | Samostatný úkol, viz „Mimo rozsah" |

**Goal:** Plně funkční hlášení pro příkazy typu `S` (ZP-I): část B s TIMy, činnostmi, fotkami a komentáři; část A s náhradami počítanými z počtu provedených TIMů a rozpočítanými mezi členy; XML pro INSYZ ve struktuře ZP-O s daty ZP-I.

**Architecture:** Beze změny — Twig stránka + React micro-app `hlaseni-prikazu`. Pravidla ZP-I do `assets/js/utils/prikaz.js` a `utils/compensationCalculator.js`, komponenty části B se recyklují ze ZP-O (`TimOverviewList`, `TimDetailForm`, `AdvancedFileUpload`).

**Tech Stack:** React 18, Tailwind + BEM, Symfony 6.4, Twig (kontrolní formulář PDF).

---

## Východiska (rozhodnutá, nediskutovat znovu)

**Ze zadání INSYZ-280:**

1. **Náhrady se počítají z počtu navštívených TIMů**, kde je aspoň jedna položka (instalace,
   demontáž, servis) označená jako **Provedena**. Nižší pásmo **1–4 TIMy**, vyšší **5+ TIMů
   a zároveň min. 8 hodin práce**. Za „Neprovedena" a „Odložena" se nedostává nic
   (komentář Honzy: *„Byli jsme přísní. Za odložena a nevyhovující dostaneš kuřinec."*).
2. **Rozpočítání náhrady:** 2/3 značkaři označenému jako **řidič**, zbylá 1/3 rovnoměrně
   mezi ostatní členy. Pozor na změnu řidiče.
3. **Část A potřebuje data z části B** — bez počtu provedených TIMů nelze náhradu spočítat.
4. **Část B ukazuje TIMy a činnost** (Instalace / Odinstalace / Servisní zásah), v pořadí
   **servis → odinstalace → instalace**. U instalace TIM a tabulka/směrovka (recyklace ze ZP-O),
   u odinstalace totéž, ale **přeškrtnuté**. Zobrazovat poznámku na ZP, u servisu rozšířené pole.
5. **Víc aktivit pod jedním TIMem:** jde označit buď celý TIM (všechny podúkoly splněny),
   nebo jet po položkách.
6. **U každého TIMu fotky a komentáře** podobně jako v ZP-O.
7. **Do XML pro Honzu** jde `TIM` / `ID předmětu` nebo `servis` + hodnota
   **Provedena / Neprovedena / Odložena**.
8. **Vícedenní ZP-I** je v ticketu výslovně „nice to have" — mimo rozsah tohoto plánu.

**Z dat a od Michala/Honzy (ověřeno proti 47 příkazům typu S / 753 předmětům, data k 8. 9. 2026):**

9. **Činnost drží `Co_Provest`, ne `Stav_TIM`.** V datech `Instalovat` (455×) a `Zrušit bez
   náhrady` (5×); prázdný `Co_Provest` je jen u příkazů z roku 2024, kdy pole neexistovalo.
   Servis se pozná podle přítomnosti TIMu v datasetu `ZP_ServTIM`.
10. **`Stav_TIM` ignorovat**, včetně kódu `N`. ZP není „zmrazený" a odráží aktuální stav TIMu,
    proto se v jednom příkazu potkávají různé verze téhož TIMu. Neopravuje se.
11. **GPS z první nalezené verze v pořadí `P` → `R` → `U` → `V`.** Ověřeno na všech 23 TIMech
    v datech, kde se stavy míchají; u BN195 v `S/BN/S/25080` jsou dvě polohy 316 m od sebe.
12. **TIM je pro odměny unikátní podle `EvCi_TIM`**, verze se nepočítají jako další TIMy.
13. **„Zrušit s náhradou" neexistuje** — zobrazí se jeden předmět, technik ví, že předchůdce
    má sundat. Nepárovat starou a novou tabulku.
14. **Sazby jsou v SP, ne hardcoded** — `trasy.ZP_Sazby` vrací dataset „Náhrady instalační"
    s `Pocet_TIM_Od`, `Pocet_TIM_Do`, `Trvani_Od_min` a `Nahrada` (600 Kč pro 0–4 TIMy,
    900 Kč pro 5+ TIMů od 480 minut). Pásma se tedy **čtou z dat**, nezadrátovávají se.
    *(Toto je odpověď na Michalův dotaz č. 3 v ticketu.)*
15. **Identifikace předmětu:** pracujeme s `ID_PREDMETY`, jak přichází. Žádné čekání na
    „zafixovaný obsah".
16. **XML:** struktura je identická se ZP-O, jen data jsou jiná. Portál XML vygeneruje
    a pošle Honzovi, ten podle něj zapracuje příjem na straně INSYZ — ne naopak.

---

## Přehled souborů

**Nové:**
- `assets/js/apps/hlaseni-prikazu/components/ZpiTimOverview.jsx` — přehled TIMů a činností
- `assets/js/apps/hlaseni-prikazu/components/ZpiTimDetailForm.jsx` — detail TIMu (stavy, foto, komentář)
- `assets/js/apps/hlaseni-prikazu/utils/zpiStavy.js` — stavy položek, zápis do `Stavy_Tim`, cesta příloh
- `assets/js/apps/hlaseni-prikazu/utils/zpiVypocet.js` — náhrady ZP-I a rozpočítání mezi členy
- `assets/js/utils/__tests__/zpiPravidla.test.js`, `assets/js/apps/hlaseni-prikazu/utils/__tests__/zpiVypocet.test.js`

**Upravené:**
- `assets/js/utils/prikaz.js` — `vyberGpsTimu`, `seskupTimyZpi`, `cinnostPredmetu`, `poradiCinnosti`
- `assets/js/apps/prikaz-detail/App.jsx` — `groupByEvCiTIM` respektuje prioritu verzí
- `assets/js/apps/hlaseni-prikazu/components/StepContent.jsx` — větev pro `Druh_ZP === "S"`
- `assets/js/apps/hlaseni-prikazu/utils/compensationCalculator.js` — tarify „3", náhrada ZP-I
- `assets/js/apps/hlaseni-prikazu/utils/validationUtils.js` — validace části B pro ZP-I
- `assets/js/apps/hlaseni-prikazu/components/CompensationSummary.jsx` — rozpad náhrady ZP-I
- `src/Service/XmlGenerationService.php` — data ZP-I ve struktuře ZP-O
- `docs/features/prikazy-management.md`, `docs/features/hlaseni-prikazu.md`, `docs/overview.md`

**Hotové (Task 0, 8. 9. 2026):** rozlišení datasetu `ZP_ServTIM` — viz Task 0.

---

## Task 0: Servisní dataset ZP_ServTIM — HOTOVO

Dataset `ZP_ServTIM` přichází ve slotu úseků; bez rozlišení padal detail příkazu na
`usek.Barva_Kod.toLowerCase()` u `S/BN/S/26056`, `26069` a `26070`.

- [x] `jeServisniTimDataset()` v JS i PHP (podle `EvCi_TIM` bez `Kod_ZU`)
- [x] Servisní řádky do `servis_timy`, `useky` zůstávají prázdné
- [x] Karta „Servisní zásahy" v detailu + sekce v kontrolním formuláři PDF
- [x] **Checkpoint:** ověřeno proti všem 135 mock detailům — rozpozná právě 3 servisní
      příkazy, 61 sad skutečných úseků zůstává nedotčeno

---

## Task 1: Pravidla ZP-I v `utils/prikaz.js` — HOTOVO

**Files:** Modify `assets/js/utils/prikaz.js`; Create `assets/js/utils/__tests__/zpiPravidla.test.js`

- [x] **Step 1:** `vyberGpsTimu(predmetyTimu)` — GPS a `Naz_TIM` z první verze v pořadí
      `P`, `R`, `U`, `V`; když žádná není (jen `N`), první řádek se souřadnicemi.
- [x] **Step 2:** `cinnostPredmetu(predmet, servisTimy)` → `'servis' | 'odinstalace' | 'instalace'`.
      Servis podle přítomnosti `EvCi_TIM` v `servis_timy`, jinak podle `Co_Provest`
      (`Zrušit bez náhrady` → odinstalace, `Instalovat` → instalace).
- [x] **Step 3:** `seskupTimyZpi(predmety, servisTimy)` — seskupení podle `EvCi_TIM` napříč
      verzemi, GPS z Kroku 1, položky setříděné **servis → odinstalace → instalace**
      (INSYZ-280 bod 5.2), u servisu doplněný `TIM_Text` a `Popis`.
      **Pozor — seskupení musí být sjednocením obou zdrojů, ne lookupem.** V datech nemá
      servisní dataset s předměty **žádný průnik**: v `S/BN/S/26069` jsou předměty na
      BN195/198/199/404 a servis na BN010/BN335. Servisní TIM je samostatný TIM bez předmětů
      a v přehledu musí být vidět. Kontrola správnosti: sjednocení musí sedět na `Popis_ZP`
      v hlavičce příkazu, který vyjmenovává všechny TIMy (u 26069 šest, u 26056 pět).
- [x] **Step 4:** `pocetProvedenychTimu(stavyTim)` — počet TIMů, kde je aspoň jedna položka
      `Provedena` (INSYZ-280 bod 7: „Do výpočtu odměn přidáváme pouze TIMy, kde je minimálně
      jeden předmět nebo servis provedený"). Počítá se přes sjednocení z Kroku 3, tedy
      **servisní TIM se počítá stejně jako TIM s předměty**; unikátnost podle `EvCi_TIM`,
      verze nezapočítávat (Východisko 12).
- [x] **Step 5:** Testy nad reálnými řádky z `var/mock-data/api/insyz/prikaz/53363.json`
      (BN195, stavy R+V, dvě polohy), `53375.json` (BN265, stavy N+P+U) a `57173.json`
      (`S/BN/S/26069` — má instalaci i zrušení, v ticketu označen jako referenční případ).

**Checkpoint:** `npx vitest run assets/js/utils/__tests__/zpiPravidla.test.js`
⚠️ Vitest v tomto workspace momentálně nejede (chybí nativní modul `rollup` — `MODULE_NOT_FOUND`,
padají i stávající testy). Nejdřív `rm -rf node_modules package-lock.json && npm install`;
pokud nepomůže, ověřit skriptem přes `node` a poznamenat to.

---

## Task 2: Mapa TIMů v detailu příkazu podle priority verzí — HOTOVO

**Files:** Modify `assets/js/apps/prikaz-detail/App.jsx`

- [x] **Step 1:** `groupByEvCiTIM` (řádek ~27) přestane brát `GPS_Sirka`, `GPS_Delka`
      a `Stav_TIM` z prvního řádku a použije `vyberGpsTimu`.
- [x] **Step 2:** Ověřit, že se nezměnilo chování u ZP-O (tam se stavy v jednom TIMu nemíchají).

**Checkpoint:** `/prikaz/53363` (BN195) — jeden pin v poloze verze `R`, ne poloha `V`.
Light i dark mód.

---

## Task 3: Část B — přehled TIMů a činností — HOTOVO

**Files:** Create `ZpiTimOverview.jsx`, `ZpiTimDetailForm.jsx`;
Modify `assets/js/apps/hlaseni-prikazu/components/StepContent.jsx`

Dnes `StepContent.jsx:178` větví jen `Druh_ZP === "O"`, všechno ostatní spadne do volného
textového pole. Přidat třetí větev pro `"S"`.

- [x] **Step 1:** `ZpiTimOverview` — TIMy z `seskupTimyZpi`, u každého činnost a stav
      dokončení, položky v pořadí servis → odinstalace → instalace (bod 5.2).
- [x] **Step 2:** U **instalace** ukázat TIM a tabulku/směrovku recyklací zobrazení ze ZP-O
      (`TimDetailForm` / `renderHtmlContent` s `Tim_HTML`) — bod 5.3.
- [x] **Step 3:** U **odinstalace** totéž, ale přeškrtnuté (bod 5.4). Přeškrtnutí řídí
      činnost z `Co_Provest`, **nikdy `Stav_TIM`**.
- [x] **Step 4:** U **servisu** zobrazit poznámku na ZP a rozšířené pole `Popis`
      (1000 znaků) — bod 5.1.
- [x] **Step 5:** Stavy položek **Provedena / Neprovedena / Odložena** (bod 7) – ukládají se
      jako kódy existujícího číselníku `StavProvedeniEnum` (3/2/4), kterým se už posílá
      obnova úseků u ZP-O, ať Honza dostane napříč typy příkazů stejné hodnoty — struktura
      `formData.Stavy_Tim[EvCi_TIM].Predmety[]` jako u ZP-O, jen s polem `Provedeni`
      místo `Zachovalost`. Plus přepínač **„označit celý TIM"** (bod 5.5), který nastaví
      všechny položky TIMu naráz.
- [x] **Step 6:** **Fotky a komentář u každého TIMu** (bod 6) — recyklovat `AdvancedFileUpload`
      a strukturu příloh ze ZP-O, ať `attachmentUtils` funguje beze změny.

**Pozn. z implementace:** obohacená data ze serveru mají servisní dataset už oddělený
v `servis_timy` (`DataEnricherService`), takže frontend musí číst primárně ten a detekci
v `useky` nechat jen jako pojistku pro neobohacená data. Bez toho se karta servisních
zásahů nikdy nezobrazí.

**Checkpoint:** Hlášení k `S/BN/S/26069` (instalace i zrušení, servisní texty) — část B ukazuje
TIMy s činnostmi ve správném pořadí, přeškrtnutou odinstalaci a servisní popis; jde nahrát
fotku a napsat komentář. Light i dark mód.

---

## Task 4: Náhrady ZP-I a rozpočítání mezi členy — HOTOVO

**Files:** Create `assets/js/apps/hlaseni-prikazu/utils/zpiVypocet.js`;
Modify `utils/compensationCalculator.js`, `components/CompensationSummary.jsx`

- [x] **Step 1:** `parseTariffRatesFromAPI` (řádek ~41) doplnit o
      `nahradyInstalacniTariffs: apiData["3"] || []` — dataset „Náhrady instalační".
- [x] **Step 2:** `najdiInstalacniTarif(pocetTimu, minutyPrace, tariffs)` — vybere řádek,
      kde `Pocet_TIM_Od <= pocetTimu <= (Pocet_TIM_Do ?? ∞)` **a zároveň**
      `minutyPrace >= Trvani_Od_min`. Pásma 600/900 Kč a hranice 8 hodin se čtou z dat,
      nezadrátovávají (Východisko 14).
- [x] **Step 3:** `rozpocitejNahraduZpi(nahrada, clenove, intAdrRidice)` — 2/3 řidiči,
      1/3 rovnoměrně mezi ostatní; zaokrouhlení tak, aby součet dílů seděl na celkovou
      částku. Ošetřit jednočlennou skupinu (vše řidiči) a chybějícího řidiče.
- [x] **Step 4:** V `calculateCompensation` u `Druh_ZP === "S"` nahradit časovou náhradu
      (`Nahrada_Prace` z tarifů „2") instalační náhradou z Kroku 2. **Stravné a jízdné
      zůstávají beze změny** — jedou dál přes denní engine.
- [x] **Step 5:** Vstupem je `pocetProvedenychTimu(formData.Stavy_Tim)` z Tasku 1 Kroku 4 —
      část A tedy čte data z části B (bod 3 zadání). Když část B ještě není vyplněná,
      náhrada je 0 a v souhrnu se zobrazí vysvětlující hláška, ne prázdno.
- [x] **Step 6:** `CompensationSummary` — rozpad „počet provedených TIMů → pásmo → částka →
      podíl člena (řidič 2/3)".
- [x] **Step 7:** Testy: 4 TIMy → 600 Kč; 5 TIMů a 7,5 h → 600 Kč; 5 TIMů a 8 h → 900 Kč;
      TIM jen s „Odložena" se nepočítá; rozpočítání 900 Kč mezi 3 členy = 600 / 150 / 150.

**Checkpoint:** `npx vitest run assets/js/apps/hlaseni-prikazu/utils/__tests__/` — nové testy
projdou a **stávající testy ZP-O zůstanou zelené** (ZP-O se nesmí změnit).

---

## Task 5: Validace části B pro ZP-I — HOTOVO

**Files:** Modify `assets/js/apps/hlaseni-prikazu/utils/validationUtils.js`

- [x] **Step 1:** `validateZpiItems(formData, predmety, servisTimy, errors, warnings)` —
      každá položka musí mít `Provedeni`; chybějící = error se jménem TIMu.
- [x] **Step 2:** Zapojit jako větev `head.Druh_ZP === "S"` (řádek ~717).
      `validateRenewedSections` pro ZP-I neběží — ZP-I nemá úseky.
- [x] **Step 3:** Varování (neblokující), když nemá žádný TIM „Provedena" — náhrada bude 0.

**Checkpoint:** Nedokončené hlášení ZP-I nejde odeslat, hláška jmenuje konkrétní TIM.

---

## Task 6: XML pro INSYZ — HOTOVO

**Files:** Modify `src/Service/XmlGenerationService.php`

Struktura je identická se ZP-O, mění se jen data (Východisko 16). XML se vygeneruje na
portálu a pošle Honzovi jako podklad — příjem na straně INSYZ vzniká podle něj.

- [x] **Step 1:** Do XML za část B posílat pro každý TIM `EvCi_TIM` a pro každou položku
      `ID předmětu` nebo `servis` + hodnotu `Provedena` / `Neprovedena` / `Odložena` (bod 7).
- [x] **Step 2:** Přílohy a komentáře k TIMům stejnými elementy jako u ZP-O
      (`Prilohy_TIM`), ať Honza nemusí řešit druhý formát.
- [x] **Step 3:** `Obnovene_Useky` u ZP-I nevznikají — ověřit, že se element negeneruje.
- [x] **Step 4:** Řidič a jeho případná změna musí být v XML dohledatelná (Michalova poznámka
      v bodu 1 — „budeme se potřebovat s Honzou domluvit, jak mu pošleš změněného řidiče").
      Použít stejný nosič jako ZP-O; pokud tam žádný není, doplnit a v průvodním e-mailu
      Honzovi na to upozornit.

**Checkpoint:** Vygenerované XML pro testovací hlášení ZP-I projde `xmllint --noout`
a obsahuje všechny tři hodnoty stavu; uložit ukázku a poslat Honzovi.

---

## Task 7: Dokumentace — HOTOVO

**Files:** Modify `docs/features/hlaseni-prikazu.md`, `docs/features/prikazy-management.md`,
`docs/overview.md`

> `docs/CLAUDE.md` zakazuje zakládat nové .md soubory — dokumentace ZP-I proto vznikla jako
> sekce v `hlaseni-prikazu.md`, ne jako samostatný soubor, jak plán původně předpokládal.

- [x] **Step 1:** Sekce „Hlášení ZP-I" v `hlaseni-prikazu.md` — rozdíly proti ZP-O, výpočet
      náhrad a rozpočítání, hodnoty stavů, tvar XML, rozsah ověřených dat.
- [x] **Step 2:** Proklinky z `overview.md` a z dokumentace hlášení a správy příkazů.

**Checkpoint:** `grep -r "hlášení-zp-i" docs/` najde proklinky z `overview.md`
i z `prikazy-management.md`.

---

## Mimo rozsah (výslovně)

- **INSYZ-282 — Kontrolní formulář PDF pro ZP-I** („Prezentovat po TIMech, ukázat tabulky
  k vyvěšení, ke svěšení nebo text k servisu tohoto TIMu.") Řeší se **samostatným úkolem**.
  Task 0 už do `templates/pdf/control_form.html.twig` přidal sekci „Servisní zásahy", takže
  servisní texty v PDF jsou — chybí prezentace po TIMech a tabulky k vyvěšení/svěšení.
  Pravidla z Tasku 1 (`seskupTimyZpi`, pořadí činností) jsou pro ten úkol přímo použitelná.

- **Vícedenní ZP-I** — v ticketu „hodně nice to have"; denní engine stravného funguje dál,
  ale označování, kdy byl zásah na kterém TIMu proveden, se neimplementuje.
- **Politika náhrad pro typ ZP** (bez náhrad) — jiný typ příkazu.
- **Zpracování „Nevyhovující" a „Odložena" na straně INSYZ** — Michal se na to podívá později;
  na portálu se za ně nepočítá nic, což je rozhodnuté.

---

## Self-review (pokrytí zadání INSYZ-280)

| Bod ticketu | Kde je vyřešený |
|---|---|
| 1 — cestovné vyšší sazba + řidič | Už funguje; předání řidiče do XML řeší Task 6 Step 4 |
| 2 — náhrady dle počtu TIMů, pásma 1–4 / 5+ a 8 h | Task 4 Steps 1–2, 7 |
| 2.1 — částky 600 / 900 Kč | Task 4 Step 2 (z SP, ne hardcode) |
| 2.2 — rozpočítání 2/3 řidič, 1/3 ostatní | Task 4 Step 3 |
| 2.3 — vícedenní | Mimo rozsah (dle ticketu) |
| 3 — synchronizace sazeb | Východisko 14 — ze SP `ZP_Sazby`, dataset „Náhrady instalační" |
| 4 — akceptace dat z INSYZ-279 | Hotovo auditem 25. 8., zbývá odklikat v Jira |
| 5 — prezentace TIMů a činností | Task 3 Steps 1–5 |
| 5.1 — poznámka na ZP, rozšířené pole u servisu | Task 3 Step 4 |
| 5.2 — pořadí servis → odinstalace → instalace | Task 1 Step 3, Task 3 Step 1 |
| 5.3 — instalace, recyklace zobrazení ze ZP-O | Task 3 Step 2 |
| 5.4 — odinstalace přeškrtnutá | Task 3 Step 3 |
| 5.5 — celý TIM vs. po položkách | Task 3 Step 5 |
| 6 — fotky a komentáře u TIMu | Task 3 Step 6 |
| 7 — XML: TIM / ID předmětu / servis + stav | Task 6 Steps 1–2 |
| 7 — do odměn jen TIMy s aspoň jedním „Provedena" | Task 1 Step 4, Task 4 Step 5 |

---

**Související:**
- [docs/features/prikazy-management.md](../../features/prikazy-management.md)
- [docs/features/hlaseni-prikazu.md](../../features/hlaseni-prikazu.md)
- [docs/api/insyz-stored-procedures.md](../../api/insyz-stored-procedures.md)
- [specs/2026-07-26-vicedenni-stravne-nahrady-hlaseni-design.md](../specs/2026-07-26-vicedenni-stravne-nahrady-hlaseni-design.md)
