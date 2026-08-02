# Vícedenní stravné a náhrady — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Verzování:** Projektové pravidlo zakazuje, aby AI spouštěla `git commit`/`push`. Tam, kde by byl commit, je **checkpoint** — commit provede uživatel sám. Žádný krok v tomto plánu nespouští git.

**Goal:** Počítat stravné i časové náhrady v hlášení příkazu za každý kalendářní den samostatně (scénář I – návrat domů) a umět souvislý vícedenní pobyt s přechodem přes půlnoc (scénář II), rozlišené výhradně přítomností noclehu.

**Architecture:** Nová čistá funkce `budujUcetniDny()` v samostatném modulu `vicedenniVypocet.js` rozdělí pracovní dny na bloky (souvislé pobyty vs. samostatné dny) podle noclehů a spočítá účetní hodiny na den (uzavřený den = skutečné okno; jinak přechod přes půlnoc dle noclehu; prázdný den pobytu = 24 h). `calculateWorkDays()` se obohatí o místo a příznak `Uzavreny`; `calculateCompensation()` nahradí chybný součet hodin per-den agregací sazeb. UI dostane podmíněné nocležné a soft varování.

**Tech Stack:** React 18 (Webpack/Encore), čisté JS util moduly (ESM), **Vitest + jsdom** (nově zaváděno) pro jednotkové testy.

**Zdrojová specifikace:** [docs/superpowers/specs/2026-07-26-vicedenni-stravne-nahrady-hlaseni-design.md](../specs/2026-07-26-vicedenni-stravne-nahrady-hlaseni-design.md)

---

## Přehled souborů

| Soubor | Odpovědnost |
|---|---|
| `vitest.config.js` (nový, root) | Konfigurace test runneru (jsdom) |
| `assets/js/apps/hlaseni-prikazu/utils/vicedenniVypocet.js` (nový) | Čisté funkce: datové/časové helpery, `budujUcetniDny`, `denniPrehled`, `detekujVicedenniProblemy`, `pocetCestovnichDnu` |
| `.../utils/__tests__/vicedenniVypocet.test.js` (nový) | Testy čistého modulu |
| `.../utils/__tests__/compensationCalculator.test.js` (nový) | Integrační testy per-den agregace |
| `.../utils/compensationCalculator.js` (úprava) | Obohatit `calculateWorkDays`; zapojit per-den agregaci |
| `.../components/PartAForm.jsx` (úprava) | Podmíněné zobrazení nocležného + varování |
| `.../utils/validationUtils.js` (úprava) | Re-export detekce vícedenních problémů |
| `.../components/CompensationSummary.jsx` (úprava) | Rozpad stravného po dnech |
| `docs/features/hlaseni-prikazu.md` (úprava) | Dokumentace nové logiky |

---

## Task 0: Zavedení Vitest

**Files:**
- Create: `vitest.config.js`
- Modify: `package.json` (devDependencies + scripts)
- Test: `assets/js/apps/hlaseni-prikazu/utils/__tests__/smoke.test.js`

- [ ] **Step 1: Nainstalovat vitest + jsdom**

Run:
```bash
ddev npm install -D vitest jsdom
```
Expected: přibudou do `devDependencies`, `node_modules/.bin/vitest` existuje.

- [ ] **Step 2: Vytvořit `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['assets/js/**/*.test.js'],
    },
});
```

- [ ] **Step 3: Přidat skripty do `package.json`**

Do sekce `"scripts"` přidat:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Smoke test**

Create `assets/js/apps/hlaseni-prikazu/utils/__tests__/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('vitest smoke', () => {
    it('běží', () => {
        expect(1 + 1).toBe(2);
    });
});
```

- [ ] **Step 5: Spustit a ověřit**

Run:
```bash
ddev npm run test
```
Expected: PASS, 1 test. (Pokud selže na `document`, ověř `environment: 'jsdom'`.)

- [ ] **Step 6: Checkpoint** — necommituji, ponech na uživatele.

---

## Task 1: Datové a časové helpery v `vicedenniVypocet.js`

**Files:**
- Create: `assets/js/apps/hlaseni-prikazu/utils/vicedenniVypocet.js`
- Test: `assets/js/apps/hlaseni-prikazu/utils/__tests__/vicedenniVypocet.test.js`

- [ ] **Step 1: Napsat padající testy helperů**

Create `.../utils/__tests__/vicedenniVypocet.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
    hodinyZCasu, naIsoDatum, isoPlusDny, isoRozsah,
    mnozinaNoclehu, jeNoclehVRozsahu,
} from '../vicedenniVypocet.js';

describe('helpery', () => {
    it('hodinyZCasu převede HH:mm na hodiny', () => {
        expect(hodinyZCasu('15:30')).toBe(15.5);
        expect(hodinyZCasu('00:00')).toBe(0);
        expect(hodinyZCasu('')).toBe(0);
        expect(hodinyZCasu(null)).toBe(0);
    });
    it('naIsoDatum normalizuje string i Date bez UTC posunu', () => {
        expect(naIsoDatum('2026-04-05')).toBe('2026-04-05');
        expect(naIsoDatum('2026-04-05T22:00:00')).toBe('2026-04-05');
        expect(naIsoDatum(new Date(2026, 3, 5))).toBe('2026-04-05');
        expect(naIsoDatum(null)).toBe('');
    });
    it('isoPlusDny počítá přes hranici měsíce', () => {
        expect(isoPlusDny('2026-04-05', 1)).toBe('2026-04-06');
        expect(isoPlusDny('2026-04-30', 1)).toBe('2026-05-01');
        expect(isoPlusDny('2026-04-05', -1)).toBe('2026-04-04');
    });
    it('isoRozsah vrací dny včetně obou konců', () => {
        expect(isoRozsah('2026-04-05', '2026-04-08'))
            .toEqual(['2026-04-05', '2026-04-06', '2026-04-07', '2026-04-08']);
        expect(isoRozsah('2026-04-05', '2026-04-05')).toEqual(['2026-04-05']);
    });
    it('mnozinaNoclehu + jeNoclehVRozsahu', () => {
        const set = mnozinaNoclehu([{ Datum: '2026-04-05' }, { Datum: '2026-04-06', Castka: 0 }]);
        expect(set.has('2026-04-05')).toBe(true);
        expect(set.has('2026-04-06')).toBe(true); // nulový nocleh se počítá
        expect(jeNoclehVRozsahu(set, '2026-04-05', '2026-04-07')).toBe(true);
        expect(jeNoclehVRozsahu(set, '2026-04-08', '2026-04-10')).toBe(false);
    });
});
```

- [ ] **Step 2: Spustit — ověřit FAIL**

Run:
```bash
ddev npm run test -- vicedenniVypocet
```
Expected: FAIL („Failed to resolve import" / funkce neexistují).

- [ ] **Step 3: Implementovat helpery**

Create `.../utils/vicedenniVypocet.js`:
```js
/**
 * Čisté funkce pro vícedenní výpočet stravného/náhrad.
 * Žádný import s vedlejšími efekty (žádný debug/DOM) — plně testovatelné.
 */

/** Převod "HH:mm" na hodiny jako číslo (např. "15:30" → 15.5). */
export function hodinyZCasu(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return 0;
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h)) return 0;
    return h + (isNaN(m) ? 0 : m) / 60;
}

/** Normalizace data na ISO "YYYY-MM-DD" bez UTC posunu (lokální kalendářní den). */
export function naIsoDatum(datum) {
    if (!datum) return '';
    if (typeof datum === 'string' && /^\d{4}-\d{2}-\d{2}/.test(datum)) {
        return datum.slice(0, 10);
    }
    const d = datum instanceof Date ? datum : new Date(datum);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const den = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${den}`;
}

/** Přičte n dní k ISO datu, vrací ISO. */
export function isoPlusDny(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return naIsoDatum(dt);
}

/** Pole ISO dat od..do včetně (guard proti nekonečné smyčce). */
export function isoRozsah(odIso, doIso) {
    const out = [];
    let cur = odIso;
    let guard = 0;
    while (cur <= doIso && guard < 400) {
        out.push(cur);
        cur = isoPlusDny(cur, 1);
        guard++;
    }
    return out;
}

/** Množina ISO dat, kdy je zadaný nocleh (i nulový — rozhoduje jen existence + Datum). */
export function mnozinaNoclehu(noclezne) {
    const set = new Set();
    (noclezne || []).forEach(n => {
        const iso = naIsoDatum(n?.Datum);
        if (iso) set.add(iso);
    });
    return set;
}

/** Je aspoň jeden nocleh v rozsahu [odIso..doIso]? */
export function jeNoclehVRozsahu(noclehSet, odIso, doIso) {
    if (!odIso || !doIso || doIso < odIso) return false;
    for (const iso of isoRozsah(odIso, doIso)) {
        if (noclehSet.has(iso)) return true;
    }
    return false;
}
```

- [ ] **Step 4: Spustit — ověřit PASS**

Run:
```bash
ddev npm run test -- vicedenniVypocet
```
Expected: PASS (5 testů v bloku „helpery").

- [ ] **Step 5: Checkpoint** — necommituji, ponech na uživatele.

---

## Task 2: `budujUcetniDny` — jádro per-den logiky

**Files:**
- Modify: `assets/js/apps/hlaseni-prikazu/utils/vicedenniVypocet.js`
- Test: `assets/js/apps/hlaseni-prikazu/utils/__tests__/vicedenniVypocet.test.js`

- [ ] **Step 1: Napsat padající testy 9 scénářů**

Přidat na konec testovacího souboru:
```js
import { budujUcetniDny } from '../vicedenniVypocet.js';

const den = (Datum, Od, Do, Cas, Uzavreny) => ({ Datum, Od, Do, Cas, Uzavreny });
const cas = (dny) => dny.map(d => d.Cas);

describe('budujUcetniDny', () => {
    it('jednodenní uzavřený → skutečné okno', () => {
        const out = budujUcetniDny([den('2026-04-05', '08:00', '17:00', 9, true)], []);
        expect(cas(out)).toEqual([9]);
    });
    it('scénář I: dva uzavřené dny bez noclehu → dvě samostatná okna', () => {
        const out = budujUcetniDny([
            den('2026-04-05', '08:00', '17:00', 9, true),
            den('2026-04-15', '08:00', '16:00', 8, true),
        ], []);
        expect(cas(out)).toEqual([9, 8]);
    });
    it('scénář II: otevřený den + nocleh + návrat → přechod přes půlnoc', () => {
        const out = budujUcetniDny([
            den('2026-04-05', '15:00', '18:00', 3, false),
            den('2026-04-06', '08:00', '12:00', 4, false),
        ], [{ Datum: '2026-04-05' }]);
        expect(out.map(d => [d.Datum, d.Cas])).toEqual([
            ['2026-04-05', 9],   // 15:00 → 24:00
            ['2026-04-06', 12],  // 00:00 → 12:00
        ]);
    });
    it('jeden nocleh na víc nocí: cesta jen tam a zpět, mezidny 24 h', () => {
        const out = budujUcetniDny([
            den('2026-04-05', '15:00', '18:00', 3, false),
            den('2026-04-08', '08:00', '12:00', 4, false),
        ], [{ Datum: '2026-04-05' }]);
        expect(out.map(d => [d.Datum, d.Cas])).toEqual([
            ['2026-04-05', 9],
            ['2026-04-06', 24],
            ['2026-04-07', 24],
            ['2026-04-08', 12],
        ]);
    });
    it('Kladno-past bez noclehu → dva samostatné dny podle skutečných hodin', () => {
        const out = budujUcetniDny([
            den('2026-04-05', '08:00', '18:00', 10, false), // Praha→Kladno (otevřený)
            den('2026-04-06', '08:00', '16:00', 8, false),  // Kladno→Praha
        ], []);
        expect(cas(out)).toEqual([10, 8]);
    });
    it('override: uzavřený mezidenní den (okruh z ubytování) → skutečné okno místo 24 h', () => {
        const out = budujUcetniDny([
            den('2026-04-05', '15:00', '18:00', 3, false),
            den('2026-04-06', '08:00', '14:00', 6, true),   // Hotel→teren→Hotel
            den('2026-04-07', '08:00', '12:00', 4, false),
        ], [{ Datum: '2026-04-05' }, { Datum: '2026-04-06' }]);
        expect(out.map(d => d.Cas)).toEqual([9, 6, 12]);
    });
    it('smíšené: souvislý blok + samostatný výjezd bez noclehu', () => {
        const out = budujUcetniDny([
            den('2026-04-05', '15:00', '18:00', 3, false),
            den('2026-04-07', '08:00', '12:00', 4, false),
            den('2026-04-20', '08:00', '16:00', 8, true),
        ], [{ Datum: '2026-04-05' }]);
        expect(out.map(d => [d.Datum, d.Cas])).toEqual([
            ['2026-04-05', 9],
            ['2026-04-06', 24],
            ['2026-04-07', 12],
            ['2026-04-20', 8],
        ]);
    });
    it('prázdný vstup → prázdné pole', () => {
        expect(budujUcetniDny([], [])).toEqual([]);
    });
});
```

- [ ] **Step 2: Spustit — ověřit FAIL**

Run:
```bash
ddev npm run test -- vicedenniVypocet
```
Expected: FAIL („budujUcetniDny is not a function").

- [ ] **Step 3: Implementovat `budujUcetniDny`**

Přidat do `vicedenniVypocet.js`:
```js
/**
 * Z pracovních dnů (z calculateWorkDays, obohacených o Uzavreny/Od/Do) a noclehů
 * sestaví účetní dny s hodinami pro tiér stravného/náhrad — VŽDY po dnech.
 *
 * Pravidlo denního okna:
 *  - uzavřený den (okruh tam+zpět) → skutečné okno (den.Cas)   ← scénář I + override
 *  - jinak: start = půlnoc, je-li předchozí noc krytá noclehem, jinak odjezd;
 *           end   = půlnoc, je-li tato noc krytá noclehem, jinak příjezd
 *  - prázdný den uvnitř pobytu (bez úseků) → 24 h
 */
export function budujUcetniDny(workDays, noclezne) {
    if (!Array.isArray(workDays) || workDays.length === 0) return [];

    const dny = workDays
        .filter(d => d && d.Datum)
        .slice()
        .sort((a, b) => (a.Datum < b.Datum ? -1 : a.Datum > b.Datum ? 1 : 0));
    if (dny.length === 0) return [];

    const noclehSet = mnozinaNoclehu(noclezne);

    // Rozdělení na bloky: souvislý pobyt (nocleh v mezeře) vs. hranice (samostatné dny)
    const bloky = [];
    let blok = [dny[0]];
    for (let i = 1; i < dny.length; i++) {
        const prev = dny[i - 1];
        const cur = dny[i];
        const most = jeNoclehVRozsahu(noclehSet, prev.Datum, isoPlusDny(cur.Datum, -1));
        if (most) {
            blok.push(cur);
        } else {
            bloky.push(blok);
            blok = [cur];
        }
    }
    bloky.push(blok);

    // Expanze bloků na účetní dny (včetně prázdných mezidní)
    const vysledek = [];
    bloky.forEach(b => {
        const first = b[0].Datum;
        const last = b[b.length - 1].Datum;
        const mapaDnu = new Map(b.map(d => [d.Datum, d]));
        isoRozsah(first, last).forEach(iso => {
            const denObj = mapaDnu.get(iso);
            const prevKryta = iso !== first;   // uvnitř bloku už je značkař „venku" o půlnoci
            const tatoKryta = iso !== last;    // tuto noc ještě zůstává
            const hodiny = ucetniHodiny(denObj, prevKryta, tatoKryta);
            if (hodiny > 0) {
                vysledek.push({
                    Datum: iso,
                    Cas: Math.round(hodiny * 100) / 100,
                    Typ: typDne(denObj, prevKryta, tatoKryta),
                });
            }
        });
    });
    return vysledek;
}

function ucetniHodiny(denObj, prevKryta, tatoKryta) {
    if (!denObj) return 24;                     // prázdný den pobytu
    if (denObj.Uzavreny) return denObj.Cas;     // uzavřený okruh → skutečné okno
    const start = prevKryta ? 0 : hodinyZCasu(denObj.Od);
    const end = tatoKryta ? 24 : hodinyZCasu(denObj.Do);
    return Math.max(0, end - start);
}

function typDne(denObj, prevKryta, tatoKryta) {
    if (!denObj) return 'pobyt';
    if (denObj.Uzavreny) return 'uzavreny';
    if (prevKryta && tatoKryta) return 'pobyt';
    if (tatoKryta) return 'prvni';
    if (prevKryta) return 'posledni';
    return 'otevreny';
}
```

- [ ] **Step 4: Spustit — ověřit PASS**

Run:
```bash
ddev npm run test -- vicedenniVypocet
```
Expected: PASS (všech 8 testů v bloku „budujUcetniDny").

- [ ] **Step 5: Checkpoint** — necommituji, ponech na uživatele.

---

## Task 3: Obohatit `calculateWorkDays` o místo a `Uzavreny`

**Files:**
- Modify: `assets/js/apps/hlaseni-prikazu/utils/compensationCalculator.js:126-173`
- Test: `assets/js/apps/hlaseni-prikazu/utils/__tests__/compensationCalculator.test.js`

- [ ] **Step 1: Napsat padající test**

Create `.../utils/__tests__/compensationCalculator.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { calculateWorkDays } from '../compensationCalculator.js';

const formDataDen = {
    Skupiny_Cest: [{
        Cestujci: [100],
        Cesty: [
            { Datum: '2026-04-05', Cas_Odjezdu: '08:00', Cas_Prijezdu: '12:00', Misto_Odjezdu: 'Praha', Misto_Prijezdu: 'Beroun' },
            { Datum: '2026-04-05', Cas_Odjezdu: '13:00', Cas_Prijezdu: '17:00', Misto_Odjezdu: 'Beroun', Misto_Prijezdu: 'Praha' },
        ],
    }],
};

describe('calculateWorkDays obohacení', () => {
    it('doplní Misto_Od/Misto_Do a Uzavreny pro uzavřený den', () => {
        const [d] = calculateWorkDays(formDataDen, 100);
        expect(d.Misto_Od).toBe('Praha');
        expect(d.Misto_Do).toBe('Praha');
        expect(d.Uzavreny).toBe(true);
        expect(d.Cas).toBe(9);
    });
    it('otevřený den má Uzavreny false', () => {
        const fd = { Skupiny_Cest: [{ Cestujci: [100], Cesty: [
            { Datum: '2026-04-05', Cas_Odjezdu: '08:00', Cas_Prijezdu: '18:00', Misto_Odjezdu: 'Praha', Misto_Prijezdu: 'Kladno' },
        ] }] };
        const [d] = calculateWorkDays(fd, 100);
        expect(d.Uzavreny).toBe(false);
        expect(d.Misto_Do).toBe('Kladno');
    });
});
```

- [ ] **Step 2: Spustit — ověřit FAIL**

Run:
```bash
ddev npm run test -- compensationCalculator
```
Expected: FAIL (`Misto_Od` je undefined).

- [ ] **Step 3: Upravit `calculateWorkDays`**

V `compensationCalculator.js` uvnitř `.map(([dateStr, dayData]) => { ... })` (ř. 126–173) nahradit blok hledání časů a `return`:

Nahradit (ř. 131–147):
```js
        let earliestTime = null;
        let latestTime = null;
        
        segments.forEach(s => {
            if (s.Cas_Odjezdu) {
                const startTime = s.Cas_Odjezdu;
                if (!earliestTime || startTime < earliestTime) {
                    earliestTime = startTime;
                }
            }
            if (s.Cas_Prijezdu) {
                const endTime = s.Cas_Prijezdu;
                if (!latestTime || endTime > latestTime) {
                    latestTime = endTime;
                }
            }
        });
```
za:
```js
        let earliestTime = null;
        let latestTime = null;
        let segOdjezd = null;   // segment s nejdřívějším odjezdem
        let segPrijezd = null;  // segment s nejpozdějším příjezdem

        segments.forEach(s => {
            if (s.Cas_Odjezdu && (!earliestTime || s.Cas_Odjezdu < earliestTime)) {
                earliestTime = s.Cas_Odjezdu;
                segOdjezd = s;
            }
            if (s.Cas_Prijezdu && (!latestTime || s.Cas_Prijezdu > latestTime)) {
                latestTime = s.Cas_Prijezdu;
                segPrijezd = s;
            }
        });
```
A nahradit `return` (ř. 167–172):
```js
        return {
            Datum: dateFormatted,
            Od: earliestTime,
            Do: latestTime,
            Cas: Math.round(Math.max(0, hoursWorked) * 100) / 100
        };
```
za:
```js
        const mistoOd = (segOdjezd?.Misto_Odjezdu || '').trim();
        const mistoDo = (segPrijezd?.Misto_Prijezdu || '').trim();
        return {
            Datum: dateFormatted,
            Od: earliestTime,
            Do: latestTime,
            Cas: Math.round(Math.max(0, hoursWorked) * 100) / 100,
            Misto_Od: mistoOd,
            Misto_Do: mistoDo,
            Uzavreny: !!mistoOd && !!mistoDo && mistoOd.toLowerCase() === mistoDo.toLowerCase(),
        };
```

- [ ] **Step 4: Spustit — ověřit PASS**

Run:
```bash
ddev npm run test -- compensationCalculator
```
Expected: PASS.

- [ ] **Step 5: Checkpoint** — necommituji, ponech na uživatele.

---

## Task 4: Zapojit per-den agregaci do `calculateCompensation`

**Files:**
- Modify: `assets/js/apps/hlaseni-prikazu/utils/compensationCalculator.js:1-2, 332-346, 422-436`
- Test: `assets/js/apps/hlaseni-prikazu/utils/__tests__/compensationCalculator.test.js`

- [ ] **Step 1: Napsat padající test (scénář I — součet sazeb po dnech)**

Přidat do `compensationCalculator.test.js`:
```js
import { calculateCompensation } from '../compensationCalculator.js';

const tariffRates = {
    jizdne: 6, jizdneZvysene: 9,
    stravneTariffs: [
        { Trvani_Od: '00:00', Trvani_Do: '05:00', Stravne: '0' },
        { Trvani_Od: '05:01', Trvani_Do: '12:00', Stravne: '160' },
        { Trvani_Od: '12:01', Trvani_Do: '18:00', Stravne: '250' },
        { Trvani_Od: '18:01', Trvani_Do: '24:00', Stravne: '390' },
    ],
    nahradyTariffs: [
        { Trvani_Od: '00:00', Trvani_Do: '04:00', Nahrada: '0' },
        { Trvani_Od: '04:01', Trvani_Do: '08:00', Nahrada: '150' },
        { Trvani_Od: '08:01', Trvani_Do: '24:00', Nahrada: '300' },
    ],
};

const dvaDny = {
    Skupiny_Cest: [{
        Cestujci: [100], Ridic: null, Cesty: [
            { Datum: '2026-04-05', Cas_Odjezdu: '08:00', Cas_Prijezdu: '17:00', Misto_Odjezdu: 'Praha', Misto_Prijezdu: 'Praha', Druh_Dopravy: 'P' },
            { Datum: '2026-04-15', Cas_Odjezdu: '08:00', Cas_Prijezdu: '16:00', Misto_Odjezdu: 'Praha', Misto_Prijezdu: 'Praha', Druh_Dopravy: 'P' },
        ],
    }],
    Noclezne: [], Vedlejsi_Vydaje: [],
};

describe('per-den agregace stravného', () => {
    it('scénář I: 9 h + 8 h → 160 + 160 = 320 (NE tiér 17 h)', () => {
        const c = calculateCompensation(dvaDny, tariffRates, 100, null);
        expect(c.Stravne).toBe(320);
        expect(c.Ucetni_Dny.map(d => d.Cas)).toEqual([9, 8]);
    });
    it('souvislý pobyt: přechod přes půlnoc, součet po dnech', () => {
        const pobyt = {
            Skupiny_Cest: [{ Cestujci: [100], Cesty: [
                { Datum: '2026-04-05', Cas_Odjezdu: '15:00', Cas_Prijezdu: '18:00', Misto_Odjezdu: 'Praha', Misto_Prijezdu: 'Brno', Druh_Dopravy: 'P' },
                { Datum: '2026-04-06', Cas_Odjezdu: '08:00', Cas_Prijezdu: '13:00', Misto_Odjezdu: 'Brno', Misto_Prijezdu: 'Praha', Druh_Dopravy: 'P' },
            ] }],
            Noclezne: [{ Datum: '2026-04-05', Castka: 0 }], Vedlejsi_Vydaje: [],
        };
        const c = calculateCompensation(pobyt, tariffRates, 100, null);
        // den 1: 15:00→24:00 = 9 h → 160; den 2: 00:00→13:00 = 13 h → 250; součet 410
        expect(c.Ucetni_Dny.map(d => d.Cas)).toEqual([9, 13]);
        expect(c.Stravne).toBe(410);
    });
});
```

- [ ] **Step 2: Spustit — ověřit FAIL**

Run:
```bash
ddev npm run test -- compensationCalculator
```
Expected: FAIL (`Ucetni_Dny` undefined; `Stravne` = 250 ze starého součtu 17 h).

- [ ] **Step 3: Přidat import**

`compensationCalculator.js` ř. 2, za `import {log} ...` přidat:
```js
import { budujUcetniDny } from './vicedenniVypocet.js';
```

- [ ] **Step 4: Nahradit součtovou logiku (ř. 332–346)**

Nahradit:
```js
    // Spočítat pracovní dny a celkové hodiny pro uživatele
    const workDays = calculateWorkDays(formData, userIntAdr);
    const totalWorkHours = workDays.reduce((total, day) => total + day.Cas, 0);

    // Najít tarify pro stravné a náhrady odděleně
    const stravneTariff = findTariffByWorkTime(totalWorkHours, tariffRates.stravneTariffs);
    const nahradyTariff = findTariffByWorkTime(totalWorkHours, tariffRates.nahradyTariffs);

    // Spočítat dopravní náklady pro uživatele
    const transportCosts = calculateTransportCosts(formData, tariffRates, userIntAdr);

    // Stravné - nárok mají všichni členové týmu bez ohledu na kvalifikaci
    const mealAllowance = stravneTariff ? parseFloat(stravneTariff.Stravne || 0) : 0;
    // Náhrada za práci - POUZE pokud má kvalifikaci opravňující k náhradám
    const workAllowance = maNarok && nahradyTariff ? parseFloat(nahradyTariff.Nahrada || 0) : 0;
```
za:
```js
    // Pracovní dny (obohacené o Uzavreny/místo) a účetní dny (per-den, přechod přes půlnoc dle noclehu)
    const workDays = calculateWorkDays(formData, userIntAdr);
    const totalWorkHours = workDays.reduce((total, day) => total + day.Cas, 0);
    const ucetniDny = budujUcetniDny(workDays, formData.Noclezne || []);

    // Stravné a náhrady se počítají VŽDY po dnech a sčítají (potvrzeno KČT)
    const mealAllowance = ucetniDny.reduce((sum, den) => {
        const t = findTariffByWorkTime(den.Cas, tariffRates.stravneTariffs);
        return sum + (t ? parseFloat(t.Stravne || 0) : 0);
    }, 0);
    // Náhrada za práci — POUZE pokud má kvalifikaci opravňující k náhradám
    const workAllowance = !maNarok ? 0 : ucetniDny.reduce((sum, den) => {
        const t = findTariffByWorkTime(den.Cas, tariffRates.nahradyTariffs);
        return sum + (t ? parseFloat(t.Nahrada || 0) : 0);
    }, 0);

    // Spočítat dopravní náklady pro uživatele
    const transportCosts = calculateTransportCosts(formData, tariffRates, userIntAdr);
```

- [ ] **Step 5: Přidat `Ucetni_Dny` do výsledku (ř. 422–436)**

V objektu `result` za řádek `Cas_Prace: workDays,` přidat:
```js
        Ucetni_Dny: ucetniDny,
```

- [ ] **Step 6: Spustit — ověřit PASS (a žádná regrese)**

Run:
```bash
ddev npm run test
```
Expected: PASS všech testů (helpery, budujUcetniDny, obohacení, per-den agregace).

- [ ] **Step 7: Checkpoint** — necommituji, ponech na uživatele.

---

## Task 5: Detekce vícedenních problémů + počet dnů

**Files:**
- Modify: `assets/js/apps/hlaseni-prikazu/utils/vicedenniVypocet.js`
- Modify: `assets/js/apps/hlaseni-prikazu/utils/validationUtils.js`
- Test: `assets/js/apps/hlaseni-prikazu/utils/__tests__/vicedenniVypocet.test.js`

- [ ] **Step 1: Napsat padající testy**

Přidat do `vicedenniVypocet.test.js`:
```js
import { detekujVicedenniProblemy, pocetCestovnichDnu } from '../vicedenniVypocet.js';

const skup = (cesty) => [{ Cestujci: [100], Cesty: cesty }];
const seg = (Datum, Od, Do, mOd, mDo) => ({
    Datum, Cas_Odjezdu: Od, Cas_Prijezdu: Do, Misto_Odjezdu: mOd, Misto_Prijezdu: mDo,
});

describe('detekce vícedenních problémů', () => {
    it('jednodenní → žádné varování', () => {
        const w = detekujVicedenniProblemy(skup([seg('2026-04-05', '08:00', '17:00', 'Praha', 'Praha')]), []);
        expect(w).toEqual([]);
    });
    it('otevřený den bez noclehu ve víc dnech → info o možném pobytu', () => {
        const w = detekujVicedenniProblemy(skup([
            seg('2026-04-05', '08:00', '18:00', 'Praha', 'Kladno'),
            seg('2026-04-06', '08:00', '16:00', 'Kladno', 'Praha'),
        ]), []);
        expect(w.some(x => x.typ === 'mozny_pobyt')).toBe(true);
    });
    it('nocleh mimo rozsah cest → varování', () => {
        const w = detekujVicedenniProblemy(skup([
            seg('2026-04-05', '08:00', '18:00', 'Praha', 'Brno'),
            seg('2026-04-06', '08:00', '16:00', 'Brno', 'Praha'),
        ]), [{ Datum: '2026-04-20' }]);
        expect(w.some(x => x.typ === 'nocleh_mimo')).toBe(true);
    });
    it('nocleh u jednodenního → varování', () => {
        const w = detekujVicedenniProblemy(skup([seg('2026-04-05', '08:00', '17:00', 'Praha', 'Praha')]), [{ Datum: '2026-04-05' }]);
        expect(w.some(x => x.typ === 'nocleh_jednodenni')).toBe(true);
    });
    it('pocetCestovnichDnu počítá unikátní data', () => {
        expect(pocetCestovnichDnu(skup([
            seg('2026-04-05', '08:00', '18:00', 'Praha', 'Brno'),
            seg('2026-04-06', '08:00', '16:00', 'Brno', 'Praha'),
        ]))).toBe(2);
        expect(pocetCestovnichDnu(skup([seg('2026-04-05', '08:00', '17:00', 'Praha', 'Praha')]))).toBe(1);
    });
});
```

- [ ] **Step 2: Spustit — ověřit FAIL**

Run:
```bash
ddev npm run test -- vicedenniVypocet
```
Expected: FAIL (funkce neexistují).

- [ ] **Step 3: Implementovat do `vicedenniVypocet.js`**

```js
/** Denní přehled napříč VŠEMI skupinami (pro validaci) — {Datum, Misto_Od, Misto_Do, Uzavreny}. */
export function denniPrehled(skupinyCest) {
    const segs = (skupinyCest || []).flatMap(g => g?.Cesty || []);
    const mapa = new Map();
    segs.forEach(s => {
        if (!s || !s.Cas_Odjezdu || !s.Cas_Prijezdu) return;
        const iso = naIsoDatum(s.Datum);
        if (!iso) return;
        if (!mapa.has(iso)) mapa.set(iso, []);
        mapa.get(iso).push(s);
    });
    const norm = x => (x || '').trim().toLowerCase();
    return [...mapa.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([iso, list]) => {
            let earliest = null, latest = null, segOd = null, segDo = null;
            list.forEach(s => {
                if (!earliest || s.Cas_Odjezdu < earliest) { earliest = s.Cas_Odjezdu; segOd = s; }
                if (!latest || s.Cas_Prijezdu > latest) { latest = s.Cas_Prijezdu; segDo = s; }
            });
            const mOd = (segOd?.Misto_Odjezdu || '').trim();
            const mDo = (segDo?.Misto_Prijezdu || '').trim();
            return { Datum: iso, Misto_Od: mOd, Misto_Do: mDo, Uzavreny: !!mOd && !!mDo && norm(mOd) === norm(mDo) };
        });
}

/** Počet unikátních cestovních dnů (napříč skupinami). */
export function pocetCestovnichDnu(skupinyCest) {
    return denniPrehled(skupinyCest).length;
}

/**
 * Soft varování pro vícedenní hlášení. Vrací pole { typ, text }.
 * Nikdy neblokuje — pouze informuje.
 */
export function detekujVicedenniProblemy(skupinyCest, noclezne) {
    const dny = denniPrehled(skupinyCest);
    const noclehSet = mnozinaNoclehu(noclezne);
    const warnings = [];
    if (dny.length === 0) return warnings;

    if (dny.length < 2) {
        if (noclehSet.size > 0) {
            warnings.push({ typ: 'nocleh_jednodenni', text: 'Máš vyplněný nocleh, ale všechny cesty jsou ve stejný den.' });
        }
        return warnings;
    }

    const prvni = dny[0].Datum;
    const posledni = dny[dny.length - 1].Datum;

    noclehSet.forEach(iso => {
        if (iso < prvni || iso > posledni) {
            warnings.push({ typ: 'nocleh_mimo', text: `Nocleh ${iso} je mimo rozsah cest (${prvni} – ${posledni}).` });
        }
    });

    if (noclehSet.size === 0) {
        const otevreny = dny.find(d => !d.Uzavreny);
        if (otevreny) {
            warnings.push({
                typ: 'mozny_pobyt',
                text: `Cesty jsou ve více dnech a den ${otevreny.Datum} nekončí návratem do výchozího místa. Pokud šlo o vícedenní akci s přespáním, doplň nocleh (i nulový) – jinak se dny počítají jako samostatné.`,
            });
        }
    }

    return warnings;
}
```

- [ ] **Step 4: Re-export ve `validationUtils.js`**

Na konec `validationUtils.js` přidat:
```js
export { detekujVicedenniProblemy, pocetCestovnichDnu } from './vicedenniVypocet.js';
```

- [ ] **Step 5: Spustit — ověřit PASS**

Run:
```bash
ddev npm run test -- vicedenniVypocet
```
Expected: PASS.

- [ ] **Step 6: Checkpoint** — necommituji, ponech na uživatele.

---

## Task 6: Podmíněné zobrazení nocležného (UI, manuální ověření)

**Files:**
- Modify: `assets/js/apps/hlaseni-prikazu/components/PartAForm.jsx:184-324`

- [ ] **Step 1: Přidat import a výpočet příznaku**

V `PartAForm.jsx` k ostatním importům přidat:
```js
import { pocetCestovnichDnu } from '../utils/vicedenniVypocet.js';
```
Uvnitř komponenty (před `return (`), přidat:
```js
const vicedenni = pocetCestovnichDnu(formData.Skupiny_Cest) >= 2;
```

- [ ] **Step 2: Zabalit sekci nocležného do podmínky**

Blok `{/* Accommodation */}` `<ErrorBoundary sectionName="Nocležné">…</ErrorBoundary>` (ř. 184–324) obalit:
```jsx
{/* Accommodation — jen u vícedenních (2+ cestovních dnů) */}
{vicedenni && (
    <ErrorBoundary sectionName="Nocležné">
        {/* … stávající obsah beze změny … */}
    </ErrorBoundary>
)}
```

- [ ] **Step 3: Sestavit a ověřit v aplikaci**

Run:
```bash
ddev npm run dev
```
Ověř v prohlížeči (https://portalznackare.ddev.site, login `test`/`test`, hlášení příkazu):
- Jeden den cest → sekce **Nocležné se nezobrazí**.
- Přidat úsek s jiným datem → sekce **Nocležné se objeví**.
- Ověř light i dark mód.

- [ ] **Step 4: Checkpoint** — necommituji, ponech na uživatele.

---

## Task 7: Zobrazení soft varování v části A (UI, manuální ověření)

**Files:**
- Modify: `assets/js/apps/hlaseni-prikazu/components/PartAForm.jsx`

- [ ] **Step 1: Přidat výpočet varování**

Rozšířit import:
```js
import { pocetCestovnichDnu, detekujVicedenniProblemy } from '../utils/vicedenniVypocet.js';
```
Uvnitř komponenty:
```js
const vicedenniVarovani = detekujVicedenniProblemy(formData.Skupiny_Cest, formData.Noclezne);
```

- [ ] **Step 2: Vykreslit varování nad sekcí nocležného**

Hned za `<TravelGroupsForm … />`'s `</ErrorBoundary>` (ř. 182) přidat:
```jsx
{vicedenniVarovani.length > 0 && (
    <div className="space-y-2">
        {vicedenniVarovani.map((v, i) => (
            <div key={i} className="alert alert--warning" role="status">
                {v.text}
            </div>
        ))}
    </div>
)}
```
> Pozn.: použij existující BEM třídu pro upozornění. Pokud `.alert--warning` v projektu neexistuje, ověř grep `grep -rn "alert--" assets/css` a použij existující variantu (např. `.alert.alert--warning` / `.notice--warning`); nová CSS třída jen pokud žádná není — pak ji přidej do `assets/css/components/` s dark-mode variantou dle CLAUDE.md.

- [ ] **Step 3: Ověřit v aplikaci**

Run:
```bash
ddev npm run dev
```
Scénáře k ověření:
- `5. 4. Praha→…→Kladno`, `6. 4. Kladno→…→Praha`, bez noclehu → zobrazí se info „…nekončí návratem…".
- Doplnit nocleh → info zmizí.
- Nocleh s datem mimo rozsah cest → varování „mimo rozsah".
- Světlý i tmavý režim.

- [ ] **Step 4: Checkpoint** — necommituji, ponech na uživatele.

---

## Task 8: Rozpad stravného po dnech v souhrnu (UI, manuální ověření)

**Files:**
- Modify: `assets/js/apps/hlaseni-prikazu/components/CompensationSummary.jsx:231-258`

- [ ] **Step 1: Prozkoumat stávající vykreslení stravného**

Přečti `CompensationSummary.jsx` ř. 228–260. Stávající logika reverzně dohledává jedno pásmo podle `memberCompensation.Stravne` (ř. 236–243) — s per-den součtem už **nesedí** a je třeba ji nahradit rozpadem z `Ucetni_Dny`.

- [ ] **Step 2: Nahradit reverzní dohledání rozpadem po dnech**

Blok, který dnes reverzně hledá tarif podle `Stravne` (ř. 236–243), nahradit výpisem z `memberCompensation.Ucetni_Dny` (fallback na `Cas_Prace`, když `Ucetni_Dny` chybí u starších hlášení):
```jsx
{!compact && (memberCompensation?.Ucetni_Dny?.length > 0) && (
    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {memberCompensation.Ucetni_Dny.map((den, i) => (
            <div key={i} className="flex justify-between">
                <span>{formatDateCZ(den.Datum)} — {den.Cas} h{den.Typ === 'pobyt' ? ' (celý den pobytu)' : ''}</span>
            </div>
        ))}
    </div>
)}
```
> Import `formatDateCZ` z `../../../utils/dateUtils.js`, pokud ještě není importován.

- [ ] **Step 3: Ověřit v aplikaci**

Run:
```bash
ddev npm run dev
```
Ověř:
- Scénář I (dva dny 9 h + 8 h) → souhrn ukáže **dva řádky** a stravné = součet obou pásem.
- Souvislý pobyt → řádky s 24 h u mezidní, správný součet.
- Světlý i tmavý režim.

- [ ] **Step 4: Checkpoint** — necommituji, ponech na uživatele.

---

## Task 9: Ověření XML a aktualizace dokumentace

**Files:**
- Modify: `docs/features/hlaseni-prikazu.md`
- Ověřit (bez úpravy, pokud sedí): `src/Service/XmlGenerationService.php`

- [ ] **Step 1: Ověřit, že XML používá `Cas_Prace` beze změny tvaru**

Run:
```bash
grep -n "Cas_Prace\|Stravne\|Ucetni_Dny" src/Service/XmlGenerationService.php
```
Očekávané zjištění: XML čte `Cas_Prace` (pole dní) a `Stravne` (celková částka). Tvar `Cas_Prace` (Datum/Od/Do/Cas) zůstává zachován (jen přibyly Misto_Od/Misto_Do/Uzavreny navíc — neškodí). `Stravne` je nově per-den součet. **Pokud** XML někde reverzně přepočítává stravné z hodin (ne z pole `Stravne`), zapiš to jako zjištění a uprav, aby bral hotové `Stravne`. Jinak beze změny.

- [ ] **Step 2: Regresní ověření uloženého hlášení**

V aplikaci otevři existující (starší) draft bez `Ucetni_Dny`, zkontroluj, že souhrn i XML náhled (`/admin/hlaseni/{id}` → tab „XML pro INSYZ") fungují (fallback na `Cas_Prace`).

- [ ] **Step 3: Aktualizovat dokumentaci**

V `docs/features/hlaseni-prikazu.md` v sekci „Automatická kalkulace kompenzací" doplnit odstavec:
```markdown
### Vícedenní stravné a náhrady (od 2026-07)
Stravné i časové náhrady se počítají **za každý kalendářní den samostatně** a sčítají (potvrzeno KČT). Rozlišení scénářů řídí **nocleh**: bez noclehu = samostatné dny s návratem; s noclehem (i 0 Kč) = souvislý pobyt s přechodem přes půlnoc (mezidny 24 h). Jádro: `utils/vicedenniVypocet.js` (`budujUcetniDny`). Detaily: [spec](../superpowers/specs/2026-07-26-vicedenni-stravne-nahrady-hlaseni-design.md).
```
A aktualizovat `**Aktualizováno:**` datum.

- [ ] **Step 4: Finální běh testů**

Run:
```bash
ddev npm run test
```
Expected: PASS všech testů.

- [ ] **Step 5: Checkpoint** — necommituji, ponech na uživatele.

---

## Self-review (pokrytí specifikace)

- **§2–3 (nocleh = přepínač, klasifikace):** Task 3 (Uzavreny/místo) + Task 2 (budujUcetniDny).
- **§4 (rozdělení na úseky, jeden nocleh na víc nocí, navazující dny):** Task 2 (bloky + `jeNoclehVRozsahu`), testy „jeden nocleh na víc nocí" a „smíšené".
- **§5 (per-den agregace, okna, prázdný den 24 h, override):** Task 4 (agregace) + Task 2 (`ucetniHodiny`, testy override a pobyt).
- **§6 (podmíněné nocležné, soft varování, nocleh mimo rozsah):** Task 6, 7 + Task 5 (`detekujVicedenniProblemy`).
- **§7 (náhrady stejným enginem):** Task 4 (`nahradyTariffs` per-den).
- **§8 (dotčené soubory), §9 (předpoklady), §10 (testy):** Task 3/4/5 testy pokrývají scénáře 1–9 ze specifikace; Task 9 ověřuje XML a nulový nocleh je pokryt v `mnozinaNoclehu` testu.
- **§11 (mimo rozsah):** žádná tlačítka, žádný nový datový model — dodrženo.
