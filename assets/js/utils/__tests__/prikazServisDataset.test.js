import { describe, it, expect } from 'vitest';
import { jeServisniTimDataset } from '../prikaz';

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

describe('jeServisniTimDataset', () => {
    it('rozpozná dataset servisních TIMů', () => {
        expect(jeServisniTimDataset([servisniRadek])).toBe(true);
    });

    it('úseky tras nepovažuje za servisní dataset', () => {
        expect(jeServisniTimDataset([usek])).toBe(false);
    });

    it('prázdný nebo chybějící dataset není servisní', () => {
        expect(jeServisniTimDataset([])).toBe(false);
        expect(jeServisniTimDataset(undefined)).toBe(false);
        expect(jeServisniTimDataset(null)).toBe(false);
    });
});
