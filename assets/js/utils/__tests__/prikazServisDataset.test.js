import { describe, it, expect } from 'vitest';
import { jeServisniTimDataset, jeCinnostiDataset } from '../prikaz';

// Reálný tvar řádku z datasetu ZP_ServTIM (příkaz S/BN/S/26056)
const servisniRadek = {
    EvCi_TIM: 'BN002',
    Naz_TIM: 'ŠTERNOV',
    Stav_TIM: 'R',
    Stav_Udrz: '',
    Stav_Udrz_Naz: '',
    TIM_Text: 'Text',
    Popis: 'Popis',
};

// Reálný tvar řádku úseku z ZP_Detail příkazu typu O
const usek = {
    Kod_ZU: '1234',
    Nazev_ZU: 'Šternov – Načeradec',
    Delka_ZU: '3.5',
    Barva_Kod: 'CE',
    Druh_Presunu: 'PZT',
};

// Reálný tvar řádku z datasetu činností ZP-J (příkaz S/BN/J/26064)
const cinnost = {
    ID_Cinnost: '7',
    Cis_Cinnosti: '7',
    Popis_Cinnosti: 'Revize značených tras vč. vypracování revizní zprávy – vedoucí',
    Stav_Provedeni: ' ',
};

describe('jeCinnostiDataset', () => {
    it('rozpozná dataset činností ZP-J', () => {
        expect(jeCinnostiDataset([cinnost])).toBe(true);
    });

    it('úseky ani servisní TIMy za činnosti nepovažuje', () => {
        expect(jeCinnostiDataset([usek])).toBe(false);
        expect(jeCinnostiDataset([servisniRadek])).toBe(false);
    });

    it('prázdný nebo chybějící dataset není dataset činností', () => {
        expect(jeCinnostiDataset([])).toBe(false);
        expect(jeCinnostiDataset(undefined)).toBe(false);
        expect(jeCinnostiDataset(null)).toBe(false);
    });
});

describe('jeServisniTimDataset', () => {
    it('rozpozná dataset servisních TIMů', () => {
        expect(jeServisniTimDataset([servisniRadek])).toBe(true);
    });

    it('úseky tras ani činnosti nepovažuje za servisní dataset', () => {
        expect(jeServisniTimDataset([usek])).toBe(false);
        expect(jeServisniTimDataset([cinnost])).toBe(false);
    });

    it('prázdný nebo chybějící dataset není servisní', () => {
        expect(jeServisniTimDataset([])).toBe(false);
        expect(jeServisniTimDataset(undefined)).toBe(false);
        expect(jeServisniTimDataset(null)).toBe(false);
    });
});
