import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { najdiInstalacniTarif, vypocetNahradyZpi, rozpocitejNahraduZpi } from '../zpiVypocet';
import { parseTariffRatesFromAPI } from '../compensationCalculator';
import { STAV_PROVEDENI } from '../../../../utils/stavProvedeni';

// Skutečný sazebník z INSYZ (dataset „Náhrady instalační“)
const sazby = JSON.parse(
    fs.readFileSync(path.resolve('var/mock-data/api/insyz/sazby/sazby-2026-08-25.json'), 'utf8')
);
const tarify = parseTariffRatesFromAPI(sazby).nahradyInstalacniTariffs;

const stavyProTimy = (pocet) => Object.fromEntries(
    Array.from({ length: pocet }, (_, i) => [
        `BN${100 + i}`,
        { Predmety: { 1: { Provedeni: STAV_PROVEDENI.PROVEDENA } } }
    ])
);

describe('sazebník náhrad instalačních', () => {
    it('ze ZP_Sazby se načte jako dataset "3"', () => {
        expect(tarify).toHaveLength(2);
        expect(tarify.map(t => t.Nahrada)).toEqual(['600.00', '900.00']);
    });
});

describe('najdiInstalacniTarif', () => {
    it('1–4 TIMy = nižší pásmo bez ohledu na odpracovaný čas', () => {
        expect(najdiInstalacniTarif(1, 60, tarify).Nahrada).toBe('600.00');
        expect(najdiInstalacniTarif(4, 600, tarify).Nahrada).toBe('600.00');
    });

    it('5+ TIMů a aspoň 8 hodin = vyšší pásmo', () => {
        expect(najdiInstalacniTarif(5, 480, tarify).Nahrada).toBe('900.00');
        expect(najdiInstalacniTarif(12, 700, tarify).Nahrada).toBe('900.00');
    });

    it('5+ TIMů pod 8 hodin spadne do nižšího pásma, ne na nulu', () => {
        expect(najdiInstalacniTarif(5, 450, tarify).Nahrada).toBe('600.00');
    });

    it('žádný provedený TIM = žádná náhrada', () => {
        expect(najdiInstalacniTarif(0, 600, tarify)).toBeNull();
    });
});

describe('vypocetNahradyZpi', () => {
    it('spočítá počet TIMů i částku za skupinu', () => {
        const vysledek = vypocetNahradyZpi({ Stavy_Tim: stavyProTimy(5) }, 8, tarify);

        expect(vysledek.Pocet_TIMu).toBe(5);
        expect(vysledek.Nahrada_Celkem).toBe(900);
    });

    it('nedokončená část B znamená nulovou náhradu', () => {
        expect(vypocetNahradyZpi({ Stavy_Tim: {} }, 10, tarify).Nahrada_Celkem).toBe(0);
    });

    it('TIM označený jako Odložena se nezapočítá', () => {
        const stavy = { BN100: { Predmety: { 1: { Provedeni: STAV_PROVEDENI.ODLOZENA } } } };

        expect(vypocetNahradyZpi({ Stavy_Tim: stavy }, 8, tarify).Nahrada_Celkem).toBe(0);
    });
});

describe('rozpocitejNahraduZpi', () => {
    const clenove = [{ INT_ADR: 100 }, { INT_ADR: 200 }, { INT_ADR: 300 }];

    it('řidič dostane 2/3, zbytek se dělí rovnoměrně', () => {
        const podily = rozpocitejNahraduZpi(900, clenove, 100);

        expect(podily).toEqual({ 100: 600, 200: 150, 300: 150 });
    });

    it('součet podílů sedí na celkovou částku i při dělení, které nevychází', () => {
        const podily = rozpocitejNahraduZpi(600, clenove, 100);
        const soucet = Object.values(podily).reduce((a, b) => a + b, 0);

        expect(soucet).toBeCloseTo(600, 2);
        expect(podily[100]).toBeCloseTo(400, 2);
    });

    it('dvoučlenná skupina: řidič 2/3, druhý 1/3', () => {
        const podily = rozpocitejNahraduZpi(900, [{ INT_ADR: 1 }, { INT_ADR: 2 }], 1);

        expect(podily).toEqual({ 1: 600, 2: 300 });
    });

    it('jednočlenná skupina dostane vše', () => {
        expect(rozpocitejNahraduZpi(600, [{ INT_ADR: 1 }], 1)).toEqual({ 1: 600 });
    });

    it('bez určeného řidiče se dělí rovným dílem', () => {
        const podily = rozpocitejNahraduZpi(900, clenove, null);

        expect(podily).toEqual({ 100: 300, 200: 300, 300: 300 });
    });

    it('nulová náhrada nikoho nezvýhodní', () => {
        expect(rozpocitejNahraduZpi(0, clenove, 100)).toEqual({});
    });
});
