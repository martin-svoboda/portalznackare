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

describe('per-den agregace náhrad (kvalifikovaný) + 24h pobyt', () => {
    // usersDetails[INT_ADR][2] = pole kvalifikací; 'ZZ' opravňuje k náhradám
    const usersDetails = { 100: [null, null, [{ Zkratka_Kval: 'ZZ' }]] };
    // Souvislý 3denní pobyt: cesta jen 1. a 3. den, jeden nocleh; 2. den prázdný → 24 h
    const triDny = {
        Skupiny_Cest: [{ Cestujci: [100], Cesty: [
            { Datum: '2026-04-05', Cas_Odjezdu: '15:00', Cas_Prijezdu: '18:00', Misto_Odjezdu: 'Praha', Misto_Prijezdu: 'Brno', Druh_Dopravy: 'P' },
            { Datum: '2026-04-07', Cas_Odjezdu: '08:00', Cas_Prijezdu: '13:00', Misto_Odjezdu: 'Brno', Misto_Prijezdu: 'Praha', Druh_Dopravy: 'P' },
        ] }],
        Noclezne: [{ Datum: '2026-04-05', Castka: 0 }], Vedlejsi_Vydaje: [],
    };

    it('kvalifikovaný: 9h/24h/13h → stravné i náhrady sečteny po dnech', () => {
        const c = calculateCompensation(triDny, tariffRates, 100, usersDetails);
        expect(c.Ucetni_Dny.map(d => d.Cas)).toEqual([9, 24, 13]);
        // stravné: 160 + 390 + 250 = 800
        expect(c.Stravne).toBe(800);
        // náhrady (kvalifikovaný): 300 + 300 + 300 = 900 (NE tiér součtu hodin)
        expect(c.Nahrada_Prace).toBe(900);
        // rozpad částek po dnech pro souhrn
        expect(c.Ucetni_Dny.map(d => d.Stravne)).toEqual([160, 390, 250]);
        expect(c.Ucetni_Dny.map(d => d.Nahrada)).toEqual([300, 300, 300]);
    });

    it('nekvalifikovaný: náhrady 0 (i po dnech), stravné beze změny', () => {
        const c = calculateCompensation(triDny, tariffRates, 100, null);
        expect(c.Nahrada_Prace).toBe(0);
        expect(c.Ucetni_Dny.map(d => d.Nahrada)).toEqual([0, 0, 0]);
        expect(c.Stravne).toBe(800);
    });

    it('Cas_Prace má štíhlý tvar (bez Misto_*/Uzavreny) kvůli INSYZ XML', () => {
        const c = calculateCompensation(triDny, tariffRates, 100, usersDetails);
        expect(Object.keys(c.Cas_Prace[0]).sort()).toEqual(['Cas', 'Datum', 'Do', 'Od']);
    });

    it('Cas_Prace do INSYZ = účetní okna s půlnocí jako 23:59 / 00:00', () => {
        const c = calculateCompensation(triDny, tariffRates, 100, usersDetails);
        expect(c.Cas_Prace.map(d => [d.Datum, d.Od, d.Do, d.Cas])).toEqual([
            ['2026-04-05', '15:00', '23:59', 9],   // den výjezdu → do 23:59
            ['2026-04-06', '00:00', '23:59', 24],  // celý den pobytu
            ['2026-04-07', '00:00', '13:00', 13],  // den návratu od 00:00
        ]);
    });
});
