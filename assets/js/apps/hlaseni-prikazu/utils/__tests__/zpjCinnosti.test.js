import { describe, it, expect } from 'vitest';
import {
    sestavCinnostiZpj,
    zapisStavCinnosti,
    pocetCinnostiBezStavu,
    jeProvedenaNejakaCinnost,
    kmCinnosti
} from '../zpjCinnosti';

// Řádky jako z ZP_Detail u S/BN/J/26064
const insyz = [
    { ID_Cinnost: '7', Popis_Cinnosti: 'Revize značených tras', Vykon: '12.00', ID_ZP_JCCin: '586' },
    { ID_Cinnost: '14', Popis_Cinnosti: 'Mimořádná obnova TZT (km)', Vykon: '3.00', ID_ZP_JCCin: '620' },
];

describe('sestavCinnostiZpj', () => {
    it('nové hlášení: všechny činnosti z INSYZ jako Neprovedena (výchozí Ne)', () => {
        expect(sestavCinnostiZpj(insyz)).toEqual({
            586: { ID_Cinnost: '7', Provedeni: 2 },
            620: { ID_Cinnost: '14', Provedeni: 2 },
        });
    });

    it('převezme uložené stavy, zmizelé činnosti vypustí', () => {
        const ulozene = { 586: { ID_Cinnost: '7', Provedeni: 3 }, 999: { ID_Cinnost: '2', Provedeni: 2 } };
        expect(sestavCinnostiZpj(insyz, ulozene)).toEqual({
            586: { ID_Cinnost: '7', Provedeni: 3 },
            620: { ID_Cinnost: '14', Provedeni: 2 },
        });
    });
});

describe('stavy činností', () => {
    const cinnosti = sestavCinnostiZpj(insyz);

    it('zápis stavu jedné činnosti', () => {
        const zmenene = zapisStavCinnosti(cinnosti, '586', 3);
        expect(zmenene[586]).toEqual({ ID_Cinnost: '7', Provedeni: 3 });
        expect(zmenene[620].Provedeni).toBe(2);
    });

    it('počet bez stavu (starý koncept s 0) a podmínka náhrad', () => {
        expect(pocetCinnostiBezStavu(cinnosti)).toBe(0);
        expect(pocetCinnostiBezStavu({ 1: { Provedeni: 0 }, 2: { Provedeni: 3 } })).toBe(1);
        expect(jeProvedenaNejakaCinnost(cinnosti)).toBe(false);
        expect(jeProvedenaNejakaCinnost(zapisStavCinnosti(cinnosti, '620', 3))).toBe(true);
    });

    it('km jen u činností s výkonem', () => {
        expect(kmCinnosti({ Vykon: '12.00' })).toBe(12);
        expect(kmCinnosti({ Vykon: '.50' })).toBe(0.5);
        expect(kmCinnosti({ Vykon: '.00' })).toBeNull();
        expect(kmCinnosti({})).toBeNull();
    });
});
