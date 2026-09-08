import { describe, it, expect } from 'vitest';
import { STAV_PROVEDENI } from '../stavProvedeni';
import {
    vyberGpsTimu,
    cinnostPredmetu,
    seskupTimyZpi,
    pocetProvedenychTimu
} from '../prikaz';

// BN195 z S/BN/S/25080 – dvě verze TIMu, dvě polohy 316 m od sebe
const bn195 = [
    { EvCi_TIM: 'BN195', Naz_TIM: 'TEPLÝŠOVICE', Stav_TIM: 'V', GPS_Sirka: '49.8021', GPS_Delka: '14.7519', Co_Provest: 'Instalovat' },
    { EvCi_TIM: 'BN195', Naz_TIM: 'TEPLÝŠOVICE', Stav_TIM: 'R', GPS_Sirka: '49.7995', GPS_Delka: '14.7551', Co_Provest: 'Instalovat' }
];

// BN265 z S/BN/S/25092 – obsahuje i kód N, který se v pořadí P/R/U/V nevyskytuje
const bn265 = [
    { EvCi_TIM: 'BN265', Stav_TIM: 'N', GPS_Sirka: '49.7001', GPS_Delka: '14.6001', Co_Provest: 'Instalovat' },
    { EvCi_TIM: 'BN265', Stav_TIM: 'U', GPS_Sirka: '49.7002', GPS_Delka: '14.6002', Co_Provest: 'Instalovat' },
    { EvCi_TIM: 'BN265', Stav_TIM: 'P', GPS_Sirka: '49.7003', GPS_Delka: '14.6003', Co_Provest: 'Instalovat' }
];

describe('vyberGpsTimu', () => {
    it('vybere verzi podle pořadí P → R → U → V, ne podle pořadí řádků', () => {
        // V je v poli první, ale R má přednost
        expect(vyberGpsTimu(bn195).GPS_Sirka).toBe('49.7995');
        expect(vyberGpsTimu(bn195).Stav_TIM).toBe('R');
    });

    it('kód N se ignoruje, pokud existuje jiná verze', () => {
        expect(vyberGpsTimu(bn265).Stav_TIM).toBe('P');
    });

    it('když je jen kód N, použije se i tak (jinak by TIM zmizel z mapy)', () => {
        expect(vyberGpsTimu([bn265[0]]).Stav_TIM).toBe('N');
    });

    it('předměty bez souřadnic vrátí prázdné hodnoty', () => {
        expect(vyberGpsTimu([{ Stav_TIM: 'R' }]).GPS_Sirka).toBeNull();
        expect(vyberGpsTimu([]).GPS_Sirka).toBeNull();
    });
});

describe('cinnostPredmetu', () => {
    it('činnost drží Co_Provest, ne Stav_TIM', () => {
        expect(cinnostPredmetu({ Co_Provest: 'Instalovat', Stav_TIM: 'V' })).toBe('instalace');
        expect(cinnostPredmetu({ Co_Provest: 'Zrušit bez náhrady', Stav_TIM: 'R' })).toBe('odinstalace');
    });
});

describe('seskupTimyZpi', () => {
    // Zjednodušený S/BN/S/26069: předměty na jiných TIMech než servis
    const predmety = [
        { EvCi_TIM: 'BN195', Naz_TIM: 'TEPLÝŠOVICE', Stav_TIM: 'R', GPS_Sirka: '49.7995', GPS_Delka: '14.7551', Co_Provest: 'Instalovat', ID_PREDMETY: '1' },
        { EvCi_TIM: 'BN195', Naz_TIM: 'TEPLÝŠOVICE', Stav_TIM: 'R', GPS_Sirka: '49.7995', GPS_Delka: '14.7551', Co_Provest: 'Zrušit bez náhrady', ID_PREDMETY: '2' }
    ];
    const servisTimy = [
        { EvCi_TIM: 'BN010', Naz_TIM: 'BLAŽIM', Stav_TIM: 'R', TIM_Text: 'Už jde plnit text', Popis: 'A taky popis' }
    ];

    it('sjednocuje TIMy z předmětů i ze servisního datasetu', () => {
        const timy = seskupTimyZpi(predmety, servisTimy);
        expect(timy.map(t => t.EvCi_TIM).sort()).toEqual(['BN010', 'BN195']);
    });

    it('servisní TIM bez předmětů má servisní položku a texty', () => {
        const servisniTim = seskupTimyZpi(predmety, servisTimy).find(t => t.EvCi_TIM === 'BN010');
        expect(servisniTim.items).toHaveLength(1);
        expect(servisniTim.items[0].Cinnost).toBe('servis');
        expect(servisniTim.items[0].Popis).toBe('A taky popis');
    });

    it('položky řadí servis → odinstalace → instalace', () => {
        const timy = seskupTimyZpi(
            [...predmety, { EvCi_TIM: 'BN195', Co_Provest: 'Instalovat', ID_PREDMETY: '3' }],
            [{ EvCi_TIM: 'BN195', TIM_Text: 'servis', Popis: '' }]
        );
        const cinnosti = timy.find(t => t.EvCi_TIM === 'BN195').items.map(i => i.Cinnost);
        expect(cinnosti).toEqual(['servis', 'odinstalace', 'instalace', 'instalace']);
    });

    it('funguje i bez servisního datasetu', () => {
        expect(seskupTimyZpi(predmety)).toHaveLength(1);
        expect(seskupTimyZpi(predmety, [])).toHaveLength(1);
    });
});

describe('pocetProvedenychTimu', () => {
    const stavy = {
        BN195: {
            Predmety: {
                1: { Provedeni: STAV_PROVEDENI.NEPROVEDENA },
                2: { Provedeni: STAV_PROVEDENI.PROVEDENA }
            }
        },
        BN198: { Predmety: { 3: { Provedeni: STAV_PROVEDENI.ODLOZENA } } },
        // servis je samostatný uzel TIMu, ne položka v Predmety
        BN010: { Predmety: {}, Servis: { Provedeni: STAV_PROVEDENI.PROVEDENA } },
        BN404: { Predmety: {} }
    };

    it('počítá jen TIMy s aspoň jednou položkou Provedena', () => {
        expect(pocetProvedenychTimu(stavy)).toBe(2);
    });

    it('za Odložena ani Neprovedena se nic nepočítá', () => {
        expect(pocetProvedenychTimu({ X: { Predmety: { 1: { Provedeni: STAV_PROVEDENI.ODLOZENA } } } })).toBe(0);
    });

    it('prázdný vstup je 0', () => {
        expect(pocetProvedenychTimu(null)).toBe(0);
        expect(pocetProvedenychTimu({})).toBe(0);
    });
});
