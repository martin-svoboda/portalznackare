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

describe('ZP-I: náhrada jen pro kvalifikované (INSYZ-280 bod 1)', () => {
    // Sazebník „Náhrady instalační“ – 1–4 TIMy 600 Kč, 5+ TIMů od 8 h 900 Kč
    const zpiTariffs = {
        ...tariffRates,
        nahradyInstalacniTariffs: [
            { Pocet_TIM_Od: '1', Pocet_TIM_Do: '4', Trvani_Od_min: '0', Nahrada: '600.00' },
            { Pocet_TIM_Od: '5', Pocet_TIM_Do: '99', Trvani_Od_min: '480', Nahrada: '900.00' },
        ],
    };

    // Tři provedené TIMy → nižší pásmo 600 Kč za skupinu
    const zpiFormData = {
        ...dvaDny,
        Hlavni_Ridic: 100,
        Stavy_Tim: {
            BN100: { Predmety: { 1: { Provedeni: 3 } } },
            BN101: { Predmety: { 1: { Provedeni: 3 } } },
            BN102: { Predmety: { 1: { Provedeni: 3 } } },
        },
    };

    const teamMembers = [{ INT_ADR: 100 }, { INT_ADR: 200 }, { INT_ADR: 300 }];
    const kvalifikace = kval => [null, null, kval.map(z => ({ Zkratka_Kval: z }))];
    const options = { head: { Druh_ZP: 'S' }, teamMembers };

    const vsichni = { 100: kvalifikace(['ZZ']), 200: kvalifikace(['VZ']), 300: kvalifikace(['IZ']) };
    // 300 je bez kvalifikace (jen třeba KT) → nárok nemá
    const bezJednoho = { 100: kvalifikace(['ZZ']), 200: kvalifikace(['VZ']), 300: kvalifikace(['KT']) };

    const podil = (usersDetails, intAdr) =>
        calculateCompensation(zpiFormData, zpiTariffs, intAdr, usersDetails, options).Nahrada_Prace;

    it('všichni kvalifikovaní: řidič 2/3, zbytek rovnoměrně', () => {
        expect(podil(vsichni, 100)).toBe(400);
        expect(podil(vsichni, 200)).toBe(100);
        expect(podil(vsichni, 300)).toBe(100);
    });

    it('nekvalifikovaný člen nedostane nic a jeho podíl připadne ostatním', () => {
        expect(podil(bezJednoho, 300)).toBe(0);
        // Částka za skupinu je daná (600 Kč) a dělí se jen mezi oprávněné: řidič 2/3, druhý 1/3
        expect(podil(bezJednoho, 100)).toBe(400);
        expect(podil(bezJednoho, 200)).toBe(200);
    });

    it('nekvalifikovaný řidič: částka se rozdělí rovným dílem mezi zbylé oprávněné', () => {
        const bezRidice = { 100: kvalifikace(['KT']), 200: kvalifikace(['VZ']), 300: kvalifikace(['IZ']) };
        expect(podil(bezRidice, 100)).toBe(0);
        expect(podil(bezRidice, 200)).toBe(300);
        expect(podil(bezRidice, 300)).toBe(300);
    });

    it('nikdo kvalifikovaný = nulové náhrady, částka nikam neuteče', () => {
        const nikdo = { 100: kvalifikace(['KT']), 200: kvalifikace([]), 300: kvalifikace(['KT']) };
        expect(podil(nikdo, 100)).toBe(0);
        expect(podil(nikdo, 200)).toBe(0);
        expect(podil(nikdo, 300)).toBe(0);
    });

    it('počet TIMů a částka za skupinu zůstávají v podkladech pro souhrn', () => {
        const c = calculateCompensation(zpiFormData, zpiTariffs, 100, bezJednoho, options);
        expect(c.Pocet_TIMu).toBe(3);
        expect(c.Nahrada_Skupiny).toBe(600);
    });
});

import { calculateTransportCosts, maZvysenouSazbu, urciHlavnihoRidice } from '../compensationCalculator.js';

describe('zvýšená sazba jen s příznakem příkazu (INSYZ-371)', () => {
    const jizda = {
        Skupiny_Cest: [{
            Cestujci: [100, 200], Ridic: 100,
            Cesty: [{ Druh_Dopravy: 'AUV', Kilometry: 10 }],
        }],
        Hlavni_Ridic: 100,
    };

    it('řidič zvolený u ZP-I bez zvýšené sazby jede za standardní sazbu', () => {
        expect(maZvysenouSazbu(jizda, 100)).toBe(false);
        expect(calculateTransportCosts(jizda, tariffRates, 100)).toBe(60);
    });

    it('se zvýšenou sazbou ji dostane jen hlavní řidič', () => {
        const zvysena = { ...jizda, Zvysena_Sazba: true };
        expect(maZvysenouSazbu(zvysena, 100)).toBe(true);
        expect(maZvysenouSazbu(zvysena, 200)).toBe(false);
        expect(calculateTransportCosts(zvysena, tariffRates, 100)).toBe(90);
    });
});

describe('urciHlavnihoRidice (INSYZ-371)', () => {
    const r = (...ids) => ids.map(INT_ADR => ({ INT_ADR }));

    it('ZP-I s jediným řidičem ho zvolí automaticky', () => {
        expect(urciHlavnihoRidice({ jeZpi: true, ridici: r(100), aktualni: null })).toBe(100);
    });

    it('ZP-I s více řidiči nechá výběr na uživateli', () => {
        expect(urciHlavnihoRidice({ jeZpi: true, ridici: r(100, 200), aktualni: null })).toBeUndefined();
    });

    it('platná volba zůstává', () => {
        expect(urciHlavnihoRidice({ jeZpi: true, ridici: r(100, 200), aktualni: 200 })).toBeUndefined();
    });

    it('volba řidiče, který už neřídí, se u ZP-I s více řidiči zruší', () => {
        expect(urciHlavnihoRidice({ jeZpi: true, ridici: r(100, 200), aktualni: 300 })).toBeNull();
    });

    it('zvýšená sazba si jako dosud vezme prvního řidiče', () => {
        expect(urciHlavnihoRidice({ zvysenaSazba: true, ridici: r(100, 200), aktualni: null })).toBe(100);
    });

    it('ZP-O bez zvýšené sazby řidiče neurčuje', () => {
        expect(urciHlavnihoRidice({ ridici: r(100), aktualni: null })).toBeUndefined();
    });

    it('bez řidičů (jen veřejná doprava) nic nemění', () => {
        expect(urciHlavnihoRidice({ jeZpi: true, ridici: [], aktualni: null })).toBeUndefined();
    });
});
