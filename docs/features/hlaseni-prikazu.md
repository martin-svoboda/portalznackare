# Hlášení příkazů - Workflow hlášení práce

> **Funkcionální oblast** - Kompletní systém pro hlášení, vyúčtování a kalkulaci kompenzací za práci značkařů

> **Programátorská poznámka:** Aplikace používá české Snake_Case parametry podle [konvence názvů](../development/development.md#konvence-názvů-parametrů).

## 🎯 Přehled funkcionality

Hlášení příkazů umožňuje značkařům vykazovat provedenou práci a automaticky vypočítávat náhrady podle sazeb KČT. Systém podporuje draft mode a asynchronní odeslání do INSYZ systému.

### Workflow hlášení
```
INSYZ Příkaz → React Formulář → Kalkulace → PostgreSQL → INSYZ Submission
     ↓              ↓             ↓           ↓            ↓
   Detail       Část A + B    Sazby KČT   Draft/Send   Async Worker
```

## 🔧 Backend komponenty

### 1. **ReportController** - API pro hlášení
```php
// src/Controller/Api/PortalController.php
#[Route('/api/portal/report')]
class PortalController extends AbstractController {
    
    #[Route('', methods: ['GET'])]
    public function getReport(Request $request): JsonResponse {
        // Načte existující hlášení pro příkaz
        $report = $this->reportRepository->findOneBy([
            'idZp' => $request->query->get('id_zp'),
            'intAdr' => $this->getUser()->getIntAdr()
        ]);
        
        return new JsonResponse(['report' => $report]);
    }
    
    #[Route('', methods: ['POST'])]
    public function saveReport(Request $request): JsonResponse {
        // Uloží hlášení jako draft nebo odešle ke zpracování
        if ($reportDto->state === 'send') {
            $this->messageBus->dispatch($message);
            // Zpracování probíhá v systemd workeru (portal-messenger-<env>)
            // Detail viz docs/development/background-jobs.md
        }
    }
}
```

### 2. **Report Entity** - Databázový model
Report ukládá strukturovaná data jako JSON:
- **Identifikace:** ID příkazu, číslo příkazu, uživatel
- **Data:** Část A (vyúčtování), Část B (činnost), kompenzace
- **Workflow:** draft → send → submitted → approved/rejected

## ⚛️ React Frontend

### Aplikační struktura
React aplikace `hlaseni-prikazu` používá **3-krokový formulář**:

```jsx
// assets/js/apps/hlaseni-prikazu/App.jsx
const App = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        Skupiny_Cest: [],
        Noclezne: [],
        Vedlejsi_Vydaje: []
    });
    
    // Načtení dat při startu
    useEffect(() => {
        loadReportData();  // Existující hlášení z DB
        loadPriceList();   // Aktuální sazby KČT
        loadTeamMembers(); // Tým z INSYZ
    }, [prikazId]);
};
```

### Část A - Vyúčtování formulář
**Záložkové rozhraní:**
- **Doprava** - Cestovní segmenty s real-time kalkulací  
- **Ubytování** - Noclehárny s příložkami
- **Výdaje** - Vedlejší náklady
- **Řidič** - SPZ vozidel a hlavní řidič pro zvýšenou sazbu

#### Cestovní segmenty
Podporované dopravní prostředky:
- **AUV** - Auto vlastní (vyžaduje km + SPZ)
- **V** - Vlak (vyžaduje náklady + doklady)
- **P** - Pěšky
- **K** - Kolo

**Live preview kalkulace** se aktualizuje při každé změně podle sazeb KČT.

#### Hlavní řidič a zvýšená sazba
**Klíčová změna (2025-08-06):** Globální výběr místo per skupina

```jsx
// Zobrazuje unikátní řidiče napříč skupinami
const uniqueDrivers = useMemo(() => {
    const driverMap = new Map();
    travelGroups.forEach(group => {
        if (group.Ridic && !driverMap.has(group.Ridic)) {
            const totalKm = calculateTotalKmForDriver(group.Ridic);
            driverMap.set(group.Ridic, { ...driver, totalKm });
        }
    });
    return Array.from(driverMap.values());
}, [travelGroups]);
```

### Část B - Hlášení činnosti
**Dynamické zobrazení podle typu příkazu:**
- **Obnovy (O)** - TIM hodnocení s předměty a fotografiemi
- **Ostatní typy** - Textové hlášení činnosti s přílohami

#### TIM hodnocení (pro Obnovy)
**Struktura:**
1. **TIM karty** - Seskupení podle turistických míst
2. **Středové pravidlo** - Ano/Ne radio button
3. **Předměty** - Hodnocení stavu (1-4) + rok výroby
4. **Fotografie** - Upload pro TIM a předměty

### Automatická kalkulace kompenzací
```javascript
// utils/compensationCalculator.js
export function calculateCompensation(formData, priceList, userIntAdr) {
    const result = {
        transport: 0,    // Doprava (jen řidiči)
        meals: 0,        // Stravné podle hodin
        reward: 0,       // Odměna podle hodin
        accommodation: 0,// Ubytování (kdo platil)
        expenses: 0,     // Výdaje (kdo platil)
        total: 0
    };
    
    // Hlavní řidič = zvýšená sazba na VŠECHNY AUV jízdy
    const isUserMainDriver = formData.Hlavni_Ridic === userIntAdr;
    const rate = isUserMainDriver ? priceList.jizdneZvysene : priceList.jizdne;
    
    // Kalkulace podle sazeb KČT
    return result;
}
```

### Vícedenní stravné a náhrady (od 2026-07)
Stravné i časové náhrady se počítají **za každý kalendářní den samostatně** a sčítají (potvrzeno KČT). Rozlišení scénářů řídí **nocleh**:
- **bez noclehu** = samostatné dny s návratem (scénář I) – každý den se tiéruje podle svého okna;
- **s noclehem** (i 0 Kč) = souvislý pobyt (scénář II) – přechod přes půlnoc: den odjezdu → 24:00, plné mezidny 24 h, den návratu 00:00 → příjezd. Uzavřený okruh (návrat kam vyjel) se počítá skutečným oknem.

Jádro je čistý modul [`utils/vicedenniVypocet.js`](../../assets/js/apps/hlaseni-prikazu/utils/vicedenniVypocet.js) (`budujUcetniDny`), pokrytý jednotkovými testy (Vitest, `assets/js/**/*.test.js`, spouští `ddev npm run test`). `calculateWorkDays` doplňuje `Misto_Od/Misto_Do/Uzavreny`; `calculateCompensation` vrací navíc `Ucetni_Dny` (rozpad po dnech pro souhrn). Nocležné se v části A zobrazí jen u 2+ denních hlášení, doprovázené soft varováními (`detekujVicedenniProblemy`). Detaily: [spec](../superpowers/specs/2026-07-26-vicedenni-stravne-nahrady-hlaseni-design.md).

## 🔄 Workflow procesu

### 1. **Inicializace hlášení**
```javascript
// Automatické načítání při startu
1. GET /api/insyz/prikaz/{id} - Detail příkazu z INSYZ
2. GET /api/portal/report?id_zp={id} - Existující hlášení (draft)
3. GET /api/insyz/sazby?date=... - Aktuální sazby KČT
4. Inicializace formuláře (prázdný nebo draft)
```

#### Zdroj složení značkařů + varování při změně
Tým značkařů (`teamMembers`) řídí členy skupin cest, plátce nocležného/výdajů i výpočet náhrad:
- **Nové hlášení** → tým z živé hlavičky příkazu (`extractTeamMembers`, sloty `INT_ADR_1..3`).
- **Existující hlášení** → tým z uloženého snapshotu `reportData.znackari` (zazálohuje se při každém uložení v `useFormSaving`).

Když se po vzniku hlášení změní složení značkařů v příkazu (přidání/odebrání), snapshot je zastaralý. `App.jsx` proto detekuje nesoulad (`teamMismatch`) a pod hlavičkou zobrazí komponentu **`TeamMismatchWarning`** s výpisem *Přidáni / Odebráni* a tlačítkem **„Načíst aktuální složení z příkazu"**:
- Tým se sjednotí s aktuální hlavičkou a draft se uloží (`handleSyncTeam`).
- **Odebraní** značkaři se vyčistí z `Cestujci`, `Ridic`, `Hlavni_Ridic`, `Zaplatil` (nocležné/výdaje) a `Presmerovani_Vyplat`.
- **Přidaní** se pouze zpřístupní k výběru — do skupin cest je vedoucí zařadí ručně.
- Banner se zobrazí jen pro editovatelné hlášení (`canEdit`).

### 2. **Vyplnění formuláře**
**Uživatel postupně vyplní:**
1. Cestovní segmenty (odkud, kam, čas, doprava)
2. Ubytování (místo, zařízení, částka, kdo platil)
3. Vedlejší výdaje (popis, částka, kdo platil)  
4. Řidič a vozidlo (pokud auto segment)
5. TIM hodnocení nebo textové hlášení činnosti

**Realtime kalkulace** při každé změně podle sazeb.

### 3. **Uložení a odeslání**
```javascript
// Draft workflow
onClick(saveDraft): {
    state: 'draft',     // Uloží pouze do PostgreSQL
    is_editable: true   // Lze pokračovat později
}

// Submit workflow
onClick(submitForApproval): {
    state: 'send',            // Trigger async processing
    polling: true             // Sleduje změnu state → submitted/rejected
}
```

## 📤 INSYZ Submission - Asynchronní zpracování

Trvalý systemd worker (`portal-messenger-prod` / `-dev`) konzumuje frontu zpráv z `messenger_messages` a posílá hlášení do INSYZ přes stored procedure `trasy.ZP_Zapis_XML`. Kompletní popis architektury, retry policy a troubleshootingu: [docs/development/background-jobs.md](../development/background-jobs.md).

```
1. Frontend: "Odeslat ke schválení"
2. Backend: state='send' → messageBus->dispatch()
3. Worker (systemd): XML generation → MSSQL submit
4. Status: state='submitted' nebo 'rejected'
5. Frontend: polling state → notifikace uživateli
```

### Náhled XML v administraci
Na detailu hlášení (`/admin/hlaseni/{id}`, app [`admin-report-detail`](../../assets/js/apps/admin-report-detail/App.jsx)) je tab **„XML pro INSYZ"** – zobrazí XML vygenerované z aktuálních dat hlášení (stejná struktura jako při odeslání), s možností kopírovat a otevřít raw. Endpoint: `GET /admin/api/reports/{id}/xml` (vrací `application/xml`), generuje [`XmlGenerationService`](../../src/Service/XmlGenerationService.php). Slouží k ladění/kontrole obsahu před i po odeslání.

### Smart retry logika
```php
// SendToInsyzHandler rozlišuje chyby
private function shouldRetry(\Exception $e): bool {
    $message = strtolower($e->getMessage());
    
    // Retry: timeout, connection, network  
    if (strpos($message, 'timeout') !== false) return true;
    
    // No retry: authentication, invalid data
    if (strpos($message, 'authentication') !== false) return false;
    
    return true; // Default: retry s backoff
}
```

### Timeout protection (3-vrstvé)
- **Frontend:** 45s timeout s AbortController
- **Backend:** 30s database statement timeout  
- **Worker:** 60s process timeout

## 📊 Data struktury

### Report JSON structure
```json
{
    "id_zp": 12345,
    "cislo_zp": "ZP001/2025",
    "znackari": [{"INT_ADR": 1234, "Znackar": "Jan Novák"}],
    "data_a": {
        "Datum_Provedeni": "2025-08-06",
        "Skupiny_Cest": [{
            "Ridic": 1234,
            "SPZ": "1A2 3456",
            "Cesty": [{
                "Druh_Dopravy": "AUV",
                "Kilometry": 50,
                "Misto_Odjezdu": "Praha",
                "Misto_Prijezdu": "Karlštejn"
            }]
        }],
        "Hlavni_Ridic": 1234,
        "Zvysena_Sazba": true
    },
    "data_b": {
        "Stavy_Tim": {"TIM123": {"Stav": 2, "Rok_vyroby": 2023}},
        "Koment_Usek": "Značení obnoveno"
    },
    "calculation": {"1234": {"transport": 245, "total": 1080}},
    "state": "send"
}
```

### Datové kontrakty pro INSYZ XML (důležité)
XML se generuje v `XmlGenerationService` z `data_a` + `data_b` + `calculation`. Tvar vstupních dat musí být konzistentní, jinak vzniknou chyby v XML:

- **`Stavy_Tim[EvCi_TIM].Predmety`** = **objekt klíčovaný `ID_PREDMETY`** (NE pole). Předvyplnění z INSYZ ([App.jsx](../../assets/js/apps/hlaseni-prikazu/App.jsx)) i editace ([PartBForm.jsx](../../assets/js/apps/hlaseni-prikazu/components/PartBForm.jsx)) musí používat stejný tvar – jinak se v XML objeví každý `<Predmet>` dvakrát (klíče `0,1,2` z pole + reálná ID).
- **`Obnovene_Useky`** = objekt klíčovaný **ID úseku z INSYZ** – `ID_TRASY_Odbocky` (odbočka), jinak `ID_Trasy_ZU`. NE `EvCi_Tra` (to je evidenční číslo trasy). Helper `getUsekId()` v [RenewedSectionsForm.jsx](../../assets/js/apps/hlaseni-prikazu/components/RenewedSectionsForm.jsx).
- **`calculation[INT_ADR].Noclezne[]`** musí obsahovat i pole **`Datum`** (z `data_a.Noclezne[].Datum`) – doplňuje [compensationCalculator.js](../../assets/js/apps/hlaseni-prikazu/utils/compensationCalculator.js). Bez něj se datum noclehu do XML nedostane.
- **`Presmerovani_Vyplat`** (`{ z_INT_ADR: na_INT_ADR }`) z `data_a` jde do XML i do přehledu ZP – zobrazuje [ReportProvedeniSummary.jsx](../../assets/js/components/prikazy/ReportProvedeniSummary.jsx).
- **`calculation[INT_ADR].Ucetni_Dny`** je prezentační rozpad po dnech (Datum/Od/Do/Cas + částky Stravne/Nahrada) pro souhrn v UI – do INSYZ XML **nepatří** a [`XmlGenerationService`](../../src/Service/XmlGenerationService.php) ho z Vyúčtování odfiltruje (`unset`).
- **`calculation[INT_ADR].Cas_Prace`** se do INSYZ posílá jako **účetní okna po dnech s přechodem přes půlnoc** (INSYZ neumí půlnoc dopočítat): den výjezdu `07:00–23:59`, mezidny pobytu `00:00–23:59`, den návratu `00:00–15:00` (interní `24:00` → `23:59`). Štíhlý tvar `{Datum, Od, Do, Cas}` zůstává kvůli stabilitě XML; UI souhrn zobrazuje `24:00` z `Ucetni_Dny`.

> Pozn.: opravy ve frontendu platí pro **nová/znovuuložená hlášení**. Pro hromadnou opravu už uložených dat slouží konzolový příkaz níže.

### Hromadná oprava uložených dat (CLI)
Příkaz [`app:reports:fix-xml-data`](../../src/Command/FixReportXmlDataCommand.php) převede uložená data hlášení do konzistentního tvaru pro INSYZ XML (datum noclehu, de-duplikace předmětů, překlíčování `Obnovene_Useky` z `EvCi_Tra` na ID úseku). Logika je v [`ReportXmlDataFixer`](../../src/Service/ReportXmlDataFixer.php), je idempotentní.

```bash
# DRY-RUN (výchozí, nic nezapíše) – vypíše, co by se změnilo
ddev exec php bin/console app:reports:fix-xml-data

# Zápis všech hlášení (se zálohou původních dat do history)
ddev exec php bin/console app:reports:fix-xml-data --force

# Jen konkrétní hlášení / jen daný stav
ddev exec php bin/console app:reports:fix-xml-data 16 --force
ddev exec php bin/console app:reports:fix-xml-data --state=draft --force
```

Bezpečnost: dry-run je default; před zápisem se původní `data_a`/`data_b`/`calculation` uloží do `history` (akce `admin_data_fix`) pro případný rollback; příkaz **nikdy znovu neodesílá do INSYZ** (stav se nemění). Překlíčování úseků potřebuje úseky příkazu z INSYZ – nejednoznačné odbočky (sdílené `EvCi_Tra`) i nenalezené úseky vynechá a vypíše jako varování.

### Report states
- **draft** - Rozpracováno (editovatelné)
- **send** - Odesláno ke zpracování (async)
- **submitted** - Přijato INSYZ systémem
- **approved** - Schváleno v INSYZ
- **rejected** - Zamítnuto (opět editovatelné)

## 🔍 Validace a kontroly

### Frontend validace
```javascript
const canCompletePartA = useMemo(() => {
    const hasSegments = formData.Skupiny_Cest.length > 0;
    const segmentsValid = formData.Skupiny_Cest.every(group =>
        group.Cesty.every(seg => 
            seg.Druh_Dopravy && seg.Misto_Odjezdu && seg.Misto_Prijezdu
        )
    );
    return hasSegments && segmentsValid;
}, [formData]);
```

### Backend validace
Symfony validátory kontrolují:
- **Identifikace:** Platné ID příkazu a uživatele
- **Stavy:** Pouze povolené přechody (draft→send→submitted)
- **Kompletnost:** Před odesláním všechny povinné údaje

## 🧪 Testing workflow

### Test přihlášení  
- Username: `test` / Password: `test`

### Testovací scénáře
1. **Draft ukládání** - Vyplnit část A, uložit, obnovit stránku
2. **Kalkulace** - Auto segment s km → zkontrolovat výpočet  
3. **TIM hodnocení** - Obnova → vyplnit všechny předměty
4. **Hlavní řidič** - Test výběru z unikátních řidičů
5. **Async odeslání** - Submit → sledovat polling

```bash
# API testování
curl "https://portalznackare.ddev.site/api/portal/report?id_zp=123"
curl -X POST "/api/portal/report" -d '{"state": "draft", ...}'
```

## 🛠️ Troubleshooting

### Časté problémy

#### 1. **Kalkulace se neaktualizuje**
```javascript
// Zkontroluj načtení sazeb
useEffect(() => {
    if (priceList) {
        const calculation = calculateCompensation(formData, priceList);
        setCalculation(calculation);
    }
}, [formData, priceList]); // Dependencies!
```

#### 2. **Hlavní řidič se neukládá**
- Ověř výběr v části "Řidič" 
- Zkontroluj že je aktivní "Zvýšená sazba"
- Debug: `console.log(formData.Hlavni_Ridic)`

#### 3. **Worker neběží po submit**
```bash
# On-demand worker se spustí automaticky při submit
# Nebo manuálně:
php bin/console messenger:consume async --limit=1
```

#### 4. **Timeout při odesílání**
Frontend zobrazí: "Odesílání trvá déle než obvykle"
- Zkontroluj síť a server load
- Počkej 1-2 minuty a zkontroluj stav hlášení

#### 5. **TIM položky chybí**
- Pouze pro příkazy typu "O" (Obnova)
- Zkontroluj že příkaz obsahuje úseky s předměty
- Verify: GET `/api/insyz/prikaz/{id}` → `predmety[]`


## 🪧 Hlášení ZP-I (instalace předmětů)

> Příkazy druhu `S`. Zadání: [INSYZ-280](https://insyz.atlassian.net/browse/INSYZ-280)
> (podúkol INSYZ-278). Datový popis servisního datasetu je v
> [prikazy-management.md](prikazy-management.md) a [../api/insyz-stored-procedures.md](../api/insyz-stored-procedures.md).

## Čím se ZP-I liší od ZP-O

| | ZP-O (obnova) | ZP-I (instalace) |
|---|---|---|
| Třetí dataset `ZP_Detail` | úseky tras | servisní TIMy (`ZP_ServTIM`) |
| Část B | stav předmětů (`Zachovalost` 1–4) | stav provedení (`Provedeni`) |
| Náhrada | podle odpracovaných hodin | podle počtu provedených TIMů |
| Rozdělení náhrady | každému za jeho čas | 2/3 řidiči, 1/3 mezi ostatní |
| Úseky | ano | nemá |
| Zpětná vazba k předmětům | ano (48 polí) | ne (27 polí) — ZP-I k tomu neslouží |

### Datová pravidla (ověřená na 47 příkazech / 753 předmětech)

- **Činnost drží `Co_Provest`, nikdy `Stav_TIM`.** Hodnoty: `Instalovat` → instalace,
  `Zrušit bez náhrady` → odinstalace. Servis se pozná podle přítomnosti TIMu v `ZP_ServTIM`.
  Prázdný `Co_Provest` je jen v příkazech z roku 2024, kdy pole neexistovalo.
- **`Stav_TIM` se ignoruje**, včetně kódu `N` (návrh). ZP není „zmrazený" a odráží aktuální
  stav TIMu, proto se v jednom příkazu potkávají různé verze téhož TIMu.
- **Souřadnice TIMu** se berou z první nalezené verze v pořadí `P` → `R` → `U` → `V`
  (`vyberGpsTimu`). Bez toho by pin na mapě závisel na pořadí řádků — u BN195
  v `S/BN/S/25080` jsou dvě polohy 316 m od sebe.
- **Servisní TIMy jsou samostatné TIMy bez předmětů.** V datech nemají s předměty žádný
  průnik; seznam TIMů příkazu je proto **sjednocení** obou zdrojů (`seskupTimyZpi`)
  a odpovídá výčtu v `head.Popis_ZP`.
- **Pro odměny je TIM unikátní podle `EvCi_TIM`**, verze se nepočítají jako další TIMy.
- **„Zrušit s náhradou" neexistuje** — u výměny se zobrazí jen jeden předmět; technik ví,
  že předchůdce má sundat.

### Detail příkazu

Značkař musí vidět, co má dělat, **už v detailu příkazu** — hlášení vyplňuje až po práci
nebo doma. Proto:

- tabulka TIMů má u ZP-I sloupec **Úkol** se štítky Instalovat / Odinstalovat
  (souhrn činností na daném TIMu, řídí ho `Co_Provest`)
- v rozbaleném řádku má štítek každý předmět zvlášť a předměty k odinstalaci jsou
  přeškrtnuté (třída `.predmet--odinstalace`, která přeškrtne i vnořený náhled TIM tabulky)
- **servisní TIMy jsou v téže tabulce** jako TIMy s předměty (štítek *Servis*, texty
  z INSYZ v rozbaleném řádku) — detail tak ukazuje jeden seznam všech TIMů příkazu,
  stejně jako část B hlášení, a sedí na výčet v `head.Popis_ZP`
- pod mapou je **výpis TIMů bez souřadnic**. `ZP_ServTIM` GPS nevrací, takže servisní TIMy
  nemají pin; bez upozornění by značkař mohl místo v terénu přehlédnout. Kdyby Honza do
  datasetu souřadnice doplnil (v SQL už se joinuje `trasy.TIM`), upozornění samo zmizí

### Část B

Komponenty [`ZpiTimOverview`](../../assets/js/apps/hlaseni-prikazu/components/ZpiTimOverview.jsx)
a [`ZpiTimDetailForm`](../../assets/js/apps/hlaseni-prikazu/components/ZpiTimDetailForm.jsx),
logika v [`utils/zpiStavy.js`](../../assets/js/apps/hlaseni-prikazu/utils/zpiStavy.js).

- TIMy s položkami v pořadí **servis → odinstalace → instalace**
- U instalace náhled tabulky/směrovky (`Tim_HTML`, recyklace ze ZP-O), u odinstalace
  **přeškrtnutý**, u servisu krátký text (`TIM_Text`) i rozšířený popis (`Popis`, 1000 znaků)
- Stav každé položky: **Provedena / Neprovedena / Odložena**, ukládané jako kódy číselníku
  [`StavProvedeniEnum`](../../src/Enum/StavProvedeniEnum.php) (3 / 2 / 4) — stejného, jakým
  se u ZP-O posílá obnova úseků
- Tlačítko **„Celý TIM proveden"** nastaví všechny položky TIMu naráz
- Ke každému TIMu komentář (`Koment_TIM`) a fotografie (`Prilohy_TIM`)

Data se ukládají do `formData.Stavy_Tim[EvCi_TIM].Predmety[ID_PREDMETY]`. **Servisní zásah
není předmět** — nemá vlastní `ID_PREDMETY` a ukládá se do samostatného uzlu
`Stavy_Tim[EvCi_TIM].Servis`, aby se do INSYZ neposílalo nečíselné ID v poli, kde se čeká číslo.

### Náhrady

Logika v [`utils/zpiVypocet.js`](../../assets/js/apps/hlaseni-prikazu/utils/zpiVypocet.js).

Do výpočtu jdou **jen TIMy s aspoň jednou položkou „Provedena"** — za „Neprovedena"
a „Odložena" se nedostává nic. Servisní TIM se počítá stejně jako TIM s předměty.

Pásma se čtou ze sazebníku `trasy.ZP_Sazby`, dataset **„Náhrady instalační"**
(`apiData["3"]`) — nejsou nikde zadrátovaná:

| Počet TIMů | Min. doba práce | Náhrada (2026) |
|---|---|---|
| 1–4 | — | 600 Kč |
| 5+ | 480 min (8 h) | 900 Kč |

Vybere se **nejvyšší sazba, jejíž podmínky jsou splněné**. Pět TIMů odpracovaných za
7 hodin proto spadne do nižšího pásma (600 Kč), ne na nulu. Žádný provedený TIM = 0 Kč.

**Rozdělení:** 2/3 značkaři označenému jako řidič (`Hlavni_Ridic`), zbylá 1/3 rovnoměrně
mezi ostatní; zaokrouhlovací rozdíl připadne řidiči, aby součet seděl na celkovou částku.
Když řidič určený není, dělí se rovným dílem a validace na to upozorní.

**Část A tedy potřebuje data z části B** — dokud nejsou TIMy vyplněné, je náhrada nulová.
Stravné a jízdné se počítají beze změny přes denní engine
([stravné a náhrady po dnech](#část-a---vyúčtování-formulář)).

### Validace

`validateZpiItems` v [`utils/validationUtils.js`](../../assets/js/apps/hlaseni-prikazu/utils/validationUtils.js):

- **Chyba** (blokuje odeslání): některá položka nemá stav provedení — hláška jmenuje TIMy
- **Upozornění**: žádný TIM není proveden (náhrada bude nulová); není určen řidič
- `validateRenewedSections` se pro ZP-I nespouští — ZP-I úseky nemá

### XML do INSYZ

Struktura je stejná jako u ZP-O, liší se jen data (dohodnuto s Michalem Markošem).
Část B vypadá takto:

```xml
<Stavy_Tim>
  <TIM id="BN195">
    <EvCi_TIM>BN195</EvCi_TIM>
    <Predmety>
      <Predmet id="701524">
        <ID_PREDMETY>701524</ID_PREDMETY>
        <Cinnost>odinstalace</Cinnost>
        <Provedeni>3</Provedeni>
      </Predmet>
    </Predmety>
  </TIM>
  <TIM id="BN010">
    <EvCi_TIM>BN010</EvCi_TIM>
    <Servis>
      <Provedeni>3</Provedeni>
    </Servis>
  </TIM>
</Stavy_Tim>
```

- `Pocet_TIMu` a `Nahrada_Skupiny` jsou podklad pro rozpad náhrady v UI a do XML se
  nevkládají (filtrují se stejně jako `Ucetni_Dny`) — INSYZ dostane výslednou
  `Nahrada_Prace` a stavy, ze kterých si počet odvodí sám
- `Cinnost` je navíc oproti ZP-O; dělá XML čitelné bez znalosti `Co_Provest`
- `metadata` (interní stopa aplikace) se do XML nevkládají na žádné úrovni
- `Obnovene_Useky` zůstává jako prázdný element (ZP-I úseky nemá)
- **Řidič** je v `Vyuctovani` poznat podle `Zvysena_Sazba` a `SPZ` u konkrétního značkaře

### Mimo rozsah

- **Vícedenní ZP-I** — v ticketu vedeno jako „nice to have"; vyžadovalo by označovat,
  kdy byl zásah na kterém TIMu proveden
- **Kontrolní formulář PDF po TIMech** — samostatný úkol
  [INSYZ-282](https://insyz.atlassian.net/browse/INSYZ-282); servisní texty v PDF už jsou
- **Kvalifikační brána** (`maNarokNaNahrady`) se u ZP-I neuplatňuje — zadání ji nezmiňuje
  a náhrada se počítá za skupinu; k potvrzení s Michalem

### Testy

```bash
ddev exec npx vitest run          # node_modules má linuxové binárky, na hostu vitest nejede
```

- `assets/js/utils/__tests__/zpiPravidla.test.js` — GPS, činnosti, sjednocení TIMů
- `assets/js/apps/hlaseni-prikazu/utils/__tests__/zpiStavy.test.js` — zápis stavů (nad reálným `S/BN/S/26069`)
- `assets/js/apps/hlaseni-prikazu/utils/__tests__/zpiVypocet.test.js` — pásma a rozpočítání náhrad

---

**Propojené funkcionality:** [File Management](file-management.md) | [INSYZ Integration](insyz-integration.md)  
**API Reference:** [../api/portal-api.md](../api/portal-api.md)  
**Technical details:** [../development/background-jobs.md](../development/background-jobs.md)  
**Aktualizováno:** 2026-09-08 (hlášení ZP-I — TIMy, servis, náhrady dle počtu TIMů)