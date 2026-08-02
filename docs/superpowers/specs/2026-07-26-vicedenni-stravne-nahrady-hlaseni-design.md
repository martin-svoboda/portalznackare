# Vícedenní stravné a náhrady v hlášení příkazu — návrh

> **Oblast:** výpočet kompenzací v hlášení příkazu (React frontend)
> **Datum:** 2026-07-26
> **Stav:** návrh schválen, **bez otevřených bodů**. Agregace potvrzena KČT (M. Markoš): *„Vždy se to počítá na každý den samostatně."* — po dnech, pro stravné i náhrady. Prázdné mezidny pobytu = 24 h (potvrzeno Martinem). Viz [§5](#5-agregace-okno--koruna--vždy-po-dnech-potvrzeno-kčt).

> **Zdroj potvrzení:** interní vlákno Martin Svoboda ↔ Michal Markoš (KČT), citováno v §5.

## 1. Problém

Výpočet stravného a časové náhrady za práci ([compensationCalculator.js](../../../assets/js/apps/hlaseni-prikazu/utils/compensationCalculator.js)) dnes předpokládá **jeden účetní den**. Funkce `calculateWorkDays()` sice seskupuje úseky podle `Datum` a vrací pole dní, ale `calculateCompensation()` (ř. ~334–338) **sečte hodiny přes všechny dny do jednoho čísla** a teprve na ten součet hledá pásmo. Důsledky:

- Vícedenní příkaz s návratem domů (9 h den 1 + 8 h den 2) se spočte jako 17 h → jedno pásmo, místo `sazba(9 h) + sazba(8 h)`.
- Žádné ošetření přechodu přes půlnoc → souvislý pobyt (více dní bez návratu domů) nelze správně spočítat.

Cíl: umět oba scénáře, co nejjednodušeji a spolehlivě, bez nového datového modelu.

### Dva scénáře (z reálně nasimulovaných příkazů)

- **Scénář I — více dní s návratem** (příkaz 56285): práce se nedodělá jeden den, značkař jede domů a vrátí se jiný den. Dny jsou nezávislé. Očekávaný výsledek: dvě unikátní data, tiér na každý den zvlášť, sazby sečíst.
- **Scénář II — souvislý pobyt** (příkaz 54410): značkař se nevrací domů, přespí. Není typické pro ZPO, ale výhledově to má umět zpracovat.

### Kontext k typům příkazů

Různé typy příkazů budou výhledově mít různé náhrady: ZPO má náhrady časové (dle hodin), ZPI podle počtu TIMů, typ ZP nemá náhrady vůbec. **Stravné se ale počítá vždy.** Tento návrh řeší časový engine (stravné + časová náhrada). Ostatní typy náhrad se napojí jako samostatná „politika náhrad" nad stejným denním enginem — mimo rozsah této specifikace.

## 2. Klíčový vhled — jeden model místo dvou scénářů

Oba scénáře jsou tentýž model: **stravné se počítá po kalendářních dnech; každý den (nebo souvislý úsek) dostane své časové okno a z něj pásmo.** Rozdíl mezi scénáři je jen v tom, čím je den ohraničený — a tím rozhodčím signálem je **nocleh**.

### Nocleh je JEDINÝ přepínač souvislosti

- **Noc má nocleh** (i nulový, `0 Kč`) → **souvislý pobyt**: den odjezdu → 24:00, plné mezidny 24 h, den návratu 00:00 → příjezd.
- **Noc nemá nocleh** → **samostatné dny**, ať už den skončil kdekoli. Každý den se tiéruje podle svého okna (nejdřívější odjezd → nejpozdější příjezd). Nezaplacená noc mezi nimi se nepočítá.

**Geografie sama o sobě NEROZHODUJE.** Kritický protipříklad: `5. 4. Praha→Beroun→Kladno`, `6. 4. Kladno→Beroun→Praha`. Geograficky to vypadá souvisle (den končí i začíná v Kladně), ale značkař mohl přespat zadarmo doma / u rodičů / u přítele — pak to **nejsou** vícedenní náklady s noclehem, ale **dva samostatné dny**. Proto se nocleh nikdy nevynucuje; geografie slouží jen jako nenásilná nápověda (viz [§6](#6-ux-zobrazení-nocležného-a-soft-varování)).

## 3. Klasifikace dní

Pro každý den s cestou (den = kalendářní `Datum` úseků napříč `Skupiny_Cest[].Cesty[]`, filtrováno na dny, kde je uživatel v `Cestujci`):

- **Odjezd** = nejdřívější `Cas_Odjezdu` dne, **Prijezd** = nejpozdější `Cas_Prijezdu` dne
- **Misto_Odjezdu** = první odjezd dne, **Misto_Prijezdu** = poslední příjezd dne
- **Uzavreny** = `Misto_Prijezdu === Misto_Odjezdu` (den se vrátil, kde začal)

Uzavřenost je jen podklad pro soft-nápovědu, ne pro výpočet. O výpočtu rozhoduje nocleh.

## 4. Rozdělení na souvislé úseky (legs)

Funkce `rozdelNaUseky(dny, noclezne)` projde dny v pořadí a každou mezeru mezi sousedními cestovními dny **D → D_next** vyhodnotí:

- **existuje nocleh s `Datum` v rozsahu `[D … D_next − 1]`?** → dny se spojí do jednoho **souvislého úseku**; kalendářní mezidny bez cesty se dofabrikují jako plných 24 h
- **nocleh není?** → **hranice**: D uzavře svůj den, D_next začíná nový úsek

Vlastnosti pravidla:

- **„Navazující dny" = jeden souvislý pobyt, ne nutně cesta každý den** (Michal: *„především na sebe navazující dny"*). U 3+ denního pobytu je cesta typicky **jen tam (1. den) a zpět (poslední den)**, mezidny bez cesty, a **jeden** nocleh na víc nocí. Mezi cestovními dny D a D_next tedy může být **víc kalendářních dnů**; je-li v mezeře `[D … D_next−1]` aspoň jeden nocleh, celý rozsah je **jeden souvislý úsek** a **všechny mezidny se počítají 24 h (půlnoc→půlnoc)**, i když v nich žádná cesta není.
- **Žádný nocleh nikde** → samé úseky délky 1 (scénář I). Každý den samostatně.
- **„Jeden nocleh na víc nocí / víc osob"** funguje — stačí jeden nocleh v mezeře mezi cestou tam a zpět, pokryje i víc mezidní.
- **Smíšené hlášení** (souvislý blok 5.–7. 4. s noclehem + samostatný výjezd 20. 4. bez noclehu) se rozpadne správně: blok = jeden úsek, výjezd = samostatný den.
- **Jednodenní hlášení** → jeden uzavřený den → dnešní chování beze změny.

### Denní okna podle typu úseku

- **Úsek délky 1** (samostatný den): okno = `Odjezd → Prijezd`.
- **Úsek délky > 1** (souvislý pobyt):
  - první den: `Odjezd → 24:00`
  - plné mezidny: `24 h` (horní pásmo)
  - poslední den: `00:00 → Prijezd`

## 5. Agregace okno → koruna — VŽDY PO DNECH (potvrzeno KČT)

> ✅ **Vyřešeno.** Michal Markoš (KČT): *„Vždy se to počítá na každý den samostatně."* Platí pro **stravné i časové náhrady**. Varianta „sečíst hodiny přes dny" se zahazuje.

Nahradí dnešní chybný součet `totalWorkHours` + jeden lookup. Každý den (denní okno z §4) dostane vlastní pásmo; sazby všech dní se sečtou:

```
stravnePerDen(den)  = tiér(okno_dne, stravneTariffs).Stravne
Stravne_Celkem      = Σ stravnePerDen(den)     // přes všechny dny všech úseků
// stejně Nahrada_Prace přes nahradyTariffs (+ kvalifikační brána)
```

### Co se počítá do času dne

Michal: *„Když není druhá cesta, počítá se to až do půlnoci."* Z toho plynou tři typy dne:

- **Uzavřený den** (cesta tam i zpět, končí kde začal — doma i na ubytování): okno = skutečné `Odjezd → Prijezd`. Takto se počítá scénář I (*„n× jako dnes"*) i denní výlet z ubytování a zpět.
- **Otevřený den** (bez návratu, kryto noclehem): `Odjezd → 24:00`; navazující návratový den `00:00 → Prijezd`.
- **Prázdný den pobytu** (mezi navazujícími dny, bez úseků): `00:00 → 24:00` = **24 h včetně spánku** — potvrzeno (Martin: *„veškeré dny mezi tím od půlnoci do půlnoci (24 h)"*). Chce-li značkař u konkrétního dne počítat jen čas v terénu, přidá si cesty ubytování→terén→ubytování — tím den uzavře a počítá se skutečné okno místo 24 h (přirozený důsledek, žádná zvláštní logika ani tlačítka).

**Scénář I je určený jednoznačně** (samé uzavřené dny → tiér na den, sečíst), plně shodně s Michalovým doporučením *„u I. nic nehádat"*.

## 6. UX — zobrazení nocležného a soft varování

Tři úrovně, všechny **nenásilné** — nic neblokuje uložení ani odeslání.

### 6.A Podmíněné zobrazení sekce nocležného

- **Trigger:** úseky mají 2+ různá `Datum`.
- Jednodenní hlášení → sekce nocležného **skrytá** (dnes se plete).
- Jakmile se objeví druhý den, sekce se zpřístupní.

### 6.B Info-nápověda „nezapomněl jsi na nocleh?"

- **Podmínka:** 2+ dny **A** existuje otevřený den (`Prijezd_misto ≠ Odjezd_misto` téhož dne) **A** v rozsahu cest není žádný nocleh.
- **Text (jemná žlutá info lišta):** *„Den 5. 4. končí v Kladně a nevrací se zpět. Pokud šlo o vícedenní akci s přespáním, doplň nocleh (i nulový). Jinak se 5. a 6. 4. počítají jako samostatné dny."*
- Dva **uzavřené** dny za sebou → žádná nápověda (korektně dva denní výjezdy).

### 6.C Kontrola vyplněného noclehu vůči cestám

Když nocleh **je** vyplněn:

- **Datum noclehu musí padnout do rozsahu cest** (mezi první a poslední cestovní den). Mimo → varování *„Nocleh 20. 4. je mimo rozsah cest (5.–6. 4.)."*
- Nocleh vyplněn, ale **všechny cesty jsou v jednom dni** → varování *„Máš nocleh, ale všechny cesty jsou ve stejný den."*

### Tok pro uživatele

Vyplní cesty → jakmile jsou ve 2 dnech, zpřístupní se nocležné → pokud den nekončí návratem a nocleh chybí, appka *šeptne* → uživatel buď doplní nocleh (→ souvislý pobyt), nebo nechá být (→ samostatné dny).

## 7. Časová náhrada za práci stejným enginem

`Nahrada_Prace` (tarif `apiData["2"]`, kvalifikační brána `maNarokNaNahrady`) použije **tentýž** denní/úsekový engine — jen jiná tabulka pásem a kvalifikační podmínka. Výhledové typy příkazů (ZPI dle počtu TIMů, ZP bez náhrad) se napojí jako samostatná politika náhrad; **stravné jede vždy přes tento engine**.

## 8. Dotčené soubory

| Soubor | Změna |
|---|---|
| [compensationCalculator.js](../../../assets/js/apps/hlaseni-prikazu/utils/compensationCalculator.js) | obohatit `calculateWorkDays()`; nová `rozdelNaUseky()`; přepočet stravného + `Nahrada_Prace` po úsecích; izolovaná `aggregateSouvisly()` |
| [TravelGroupsForm.jsx](../../../assets/js/apps/hlaseni-prikazu/components/TravelGroupsForm.jsx) / PartAForm | podmíněné zobrazení sekce nocležného (2+ dny) |
| [validationUtils.js](../../../assets/js/apps/hlaseni-prikazu/utils/validationUtils.js) | soft varování z §6.B a §6.C |
| [CompensationSummary.jsx](../../../assets/js/apps/hlaseni-prikazu/components/CompensationSummary.jsx) | řádkový rozpad stravného po dnech |

Návratová struktura dál nese `Cas_Prace` jako **pole dní**, ale každý den nově obsahuje klasifikaci + okno + použité pásmo → souhrn i XML můžou ukázat rozpad („9 h" + „8 h"). XML dnes už `Cas_Prace` emituje po dnech ([XmlGenerationService.php](../../../src/Service/XmlGenerationService.php) ř. ~453) — dostane obohacené dny.

## 9. Předpoklady k ověření proti reálným datům (56285, 54410)

1. **Význam `Noclezne[].Datum`** — ⚠️ **ověřeno proti reálným datům:** uživatel datuje nocleh **buď na večer výjezdu, nebo na den pobytu/návratu**. Proto párování noclehu k mezeře v §4 používá **uzavřený rozsah `[prev.Datum … cur.Datum]` VČETNĚ dne návratu** (ne `cur.Datum − 1`), aby propojilo dny bez ohledu na konvenci. **Navíc:** validace „min. 2 jízdy za den" se u vícedenních hlášení (2+ dny) **neuplatňuje** — den výjezdu/návratu má legitimně 1 jízdu; úplnost řeší jen soft varování.
2. **Nulový nocleh jako platný signál** — `0 Kč` musí platit jako „nocleh existuje" (obdoba commitu *„Uznávat 0 jako relevantní hodnotu ceny dopravy"*), ne jako prázdno.

## 10. Testovací scénáře

1. **Jednodenní** (regrese): jeden uzavřený den → stejný výsledek jako dnes.
2. **Scénář I / 56285:** `5. 4. Praha→Beroun→Praha` (9 h), `15. 4. Praha→Kladno→Praha` (8 h), bez noclehu → 2 samostatné dny, `tiér(9 h) + tiér(8 h)`.
3. **Scénář II / 54410:** odjezd den 1, nocleh, návrat den 2 → úsek délky 2, okna `odjezd→24:00` a `00:00→příjezd`, tiér každý den zvlášť, sazby sečíst (§5).
4. **Kladno-past:** `5. 4. Praha→Beroun→Kladno`, `6. 4. Kladno→Beroun→Praha`, **bez noclehu** → 2 samostatné dny (žádný přechod přes půlnoc), zobrazí se info-nápověda.
5. **Kladno-past + nocleh:** totéž s noclehem (i 0 Kč) → souvislý pobyt, přechod přes půlnoc.
6. **Jeden nocleh na víc nocí (cesta jen tam a zpět s odstupem):** cesta **tam 5. 4.**, cesta **zpět 8. 4.**, mezidny 6.+7. **bez jediné cesty**, jediný nocleh v rozsahu → jeden souvislý úsek: 5. den `odjezd→24:00`, **6.+7. = 24 h každý**, 8. den `00:00→příjezd`. NE dva samostatné dny.
7. **Smíšené:** souvislý blok 5.–7. 4. (s noclehem) + samostatný výjezd 20. 4. (bez noclehu) → blok jako úsek, výjezd samostatně.
8. **Nocleh mimo rozsah:** varování §6.C.
9. **Override prázdného dne:** souvislý pobyt s prázdným dnem 6. 4. → default 24 h; po přidání cest ubytování→terén→ubytování 6. 4. se den uzavře a počítá se jen skutečné okno místo 24 h.

## 11. Mimo rozsah (YAGNI)

- Tlačítka „Doplnit zbytek dne" / „Přidat den bez cesty" (původní varianta A) — nepotřebná, protažení do půlnoci i plné mezidny se odvodí z noclehů.
- Nový datový model pro „den bez cesty" — mezidny se dopočtou z rozpětí dat.
- Politiky náhrad pro typy ZPI / ZP — samostatná specifikace.
- Tvrdé blokování odeslání při nekonzistenci — vše řešeno soft varováními.

---

**Související:** [docs/features/hlaseni-prikazu.md](../../features/hlaseni-prikazu.md)
**Aktualizováno:** 2026-07-26
