import { describe, it, expect } from 'vitest';
import {
    hodinyZCasu, formatHodinyMinuty, naIsoDatum, isoPlusDny, isoRozsah,
    mnozinaNoclehu, jeNoclehVRozsahu,
} from '../vicedenniVypocet.js';

describe('helpery', () => {
    it('hodinyZCasu převede HH:mm na hodiny', () => {
        expect(hodinyZCasu('15:30')).toBe(15.5);
        expect(hodinyZCasu('00:00')).toBe(0);
        expect(hodinyZCasu('')).toBe(0);
        expect(hodinyZCasu(null)).toBe(0);
    });
    it('formatHodinyMinuty dá čitelný formát', () => {
        expect(formatHodinyMinuty(13.08)).toBe('13 h 5 min');
        expect(formatHodinyMinuty(8.17)).toBe('8 h 10 min');
        expect(formatHodinyMinuty(12.92)).toBe('12 h 55 min');
        expect(formatHodinyMinuty(24)).toBe('24 h');
        expect(formatHodinyMinuty(0)).toBe('0 h');
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
        expect(set.has('2026-04-06')).toBe(true);
        expect(jeNoclehVRozsahu(set, '2026-04-05', '2026-04-07')).toBe(true);
        expect(jeNoclehVRozsahu(set, '2026-04-08', '2026-04-10')).toBe(false);
    });
});

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
            ['2026-04-05', 9],
            ['2026-04-06', 12],
        ]);
    });
    it('nocleh datovaný na den návratu (reálný případ) bridguje přes půlnoc', () => {
        // out 10.2. 07:50–08:25, návrat 11.2. 12:24–12:55, nocleh datovaný 11.2.
        const out = budujUcetniDny([
            den('2026-02-10', '07:50', '08:25', 0.58, false),
            den('2026-02-11', '12:24', '12:55', 0.52, false),
        ], [{ Datum: '2026-02-11' }]);
        expect(out.map(d => d.Datum)).toEqual(['2026-02-10', '2026-02-11']);
        expect(out[0].Cas).toBeCloseTo(16.17, 1); // 07:50 → 24:00
        expect(out[1].Cas).toBeCloseTo(12.92, 1); // 00:00 → 12:55
        // účetní okno přes půlnoc pro souhrn „Práce"
        expect([out[0].Od, out[0].Do]).toEqual(['07:50', '24:00']);
        expect([out[1].Od, out[1].Do]).toEqual(['00:00', '12:55']);
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
            den('2026-04-05', '08:00', '18:00', 10, false),
            den('2026-04-06', '08:00', '16:00', 8, false),
        ], []);
        expect(cas(out)).toEqual([10, 8]);
    });
    it('uzavřený okruh v den uvnitř pobytu (mezi noclehy) → vždy 24 h', () => {
        const out = budujUcetniDny([
            den('2026-04-05', '15:00', '18:00', 3, false),
            den('2026-04-06', '08:00', '14:00', 6, true),  // okruh z ubytování a zpět
            den('2026-04-07', '08:00', '12:00', 4, false),
        ], [{ Datum: '2026-04-05' }, { Datum: '2026-04-06' }]);
        expect(out.map(d => d.Cas)).toEqual([9, 24, 12]);
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
