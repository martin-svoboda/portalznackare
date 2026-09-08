import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { seskupTimyZpi, pocetProvedenychTimu } from '../../../../utils/prikaz';
import { STAV_PROVEDENI } from '../../../../utils/stavProvedeni';
import {
    identifikatorPolozky,
    stavPolozky,
    stavTimu,
    zapisStavPolozky,
    zapisStavCelehoTimu,
    cestaProPrilohy
} from '../zpiStavy';

// S/BN/S/26069 – příkaz, který Michal v INSYZ-280 označil jako referenční:
// má instalaci, zrušení i dva servisní TIMy
const detail = JSON.parse(
    fs.readFileSync(path.resolve('var/mock-data/api/insyz/prikaz/57173.json'), 'utf8')
);
const head = Array.isArray(detail.head) ? detail.head[0] : detail.head;
const timy = seskupTimyZpi(detail.predmety, detail.useky);
const tim = (evCi) => timy.find(t => t.EvCi_TIM === evCi);

describe('seskupení TIMů referenčního příkazu S/BN/S/26069', () => {
    it('sjednocení TIMů odpovídá výčtu v head.Popis_ZP', () => {
        const zPopisu = head.Popis_ZP.split(',').map(s => s.trim()).sort();
        expect(timy.map(t => t.EvCi_TIM).sort()).toEqual(zPopisu);
    });

    it('servisní TIM je samostatný TIM se servisní položkou', () => {
        const servisni = tim('BN010');
        expect(servisni.items).toHaveLength(1);
        expect(servisni.items[0].Cinnost).toBe('servis');
    });
});

describe('zápis stavů do Stavy_Tim', () => {
    it('označení celého TIMu vyplní všechny jeho položky', () => {
        const stavy = zapisStavCelehoTimu({}, tim('BN195'), STAV_PROVEDENI.PROVEDENA);
        expect(stavTimu(stavy, tim('BN195')).hotovo).toBe(true);
    });

    it('servis se ukládá do vlastního uzlu Servis, ne mezi předměty', () => {
        const servisni = tim('BN010');
        const stavy = zapisStavPolozky({}, servisni, servisni.items[0], STAV_PROVEDENI.PROVEDENA);

        expect(identifikatorPolozky(servisni.items[0])).toBe('servis');
        expect(stavy.BN010.Servis.Provedeni).toBe(STAV_PROVEDENI.PROVEDENA);
        // Do Predmety nesmí propadnout nečíselné ID – servis není předmět
        expect(stavy.BN010.Predmety).toEqual({});
        expect(stavy.BN010.Predmety.servis).toBeUndefined();
    });

    it('stav servisu se čte zpět přes stavPolozky', () => {
        const servisni = tim('BN010');
        const stavy = zapisStavPolozky({}, servisni, servisni.items[0], STAV_PROVEDENI.ODLOZENA);

        expect(stavPolozky(stavy, 'BN010', servisni.items[0]).Provedeni).toBe(STAV_PROVEDENI.ODLOZENA);
    });

    it('předmět se ukládá pod svým ID_PREDMETY', () => {
        const cilovyTim = tim('BN195');
        const item = cilovyTim.items[0];
        const stavy = zapisStavPolozky({}, cilovyTim, item, STAV_PROVEDENI.NEPROVEDENA);

        expect(stavPolozky(stavy, 'BN195', item).Provedeni).toBe(STAV_PROVEDENI.NEPROVEDENA);
        expect(stavy.BN195.Predmety[String(item.ID_PREDMETY)]).toBeDefined();
    });

    it('zápis nemutuje předchozí stav', () => {
        const puvodni = zapisStavCelehoTimu({}, tim('BN195'), STAV_PROVEDENI.PROVEDENA);
        const otisk = JSON.stringify(puvodni);

        zapisStavPolozky(puvodni, tim('BN195'), tim('BN195').items[0], STAV_PROVEDENI.ODLOZENA);

        expect(JSON.stringify(puvodni)).toBe(otisk);
    });

    it('komentář a přílohy TIMu přežijí zápis stavu položky', () => {
        const cilovyTim = tim('BN195');
        const sKomentarem = {
            BN195: { EvCi_TIM: 'BN195', Predmety: {}, Prilohy_TIM: {}, Koment_TIM: 'poznámka' }
        };
        const stavy = zapisStavPolozky(sKomentarem, cilovyTim, cilovyTim.items[0], STAV_PROVEDENI.PROVEDENA);

        expect(stavy.BN195.Koment_TIM).toBe('poznámka');
    });
});

describe('počítání TIMů do náhrad', () => {
    it('TIM s aspoň jednou položkou Provedena se počítá', () => {
        const stavy = zapisStavCelehoTimu({}, tim('BN195'), STAV_PROVEDENI.PROVEDENA);
        expect(pocetProvedenychTimu(stavy)).toBe(1);
    });

    it('servisní TIM se počítá stejně jako TIM s předměty', () => {
        const servisni = tim('BN010');
        let stavy = zapisStavCelehoTimu({}, tim('BN195'), STAV_PROVEDENI.PROVEDENA);
        stavy = zapisStavPolozky(stavy, servisni, servisni.items[0], STAV_PROVEDENI.PROVEDENA);

        expect(pocetProvedenychTimu(stavy)).toBe(2);
    });

    it('za Odložena ani Neprovedena se nepočítá nic', () => {
        const odlozeno = zapisStavCelehoTimu({}, tim('BN195'), STAV_PROVEDENI.ODLOZENA);
        const neprovedeno = zapisStavCelehoTimu({}, tim('BN198'), STAV_PROVEDENI.NEPROVEDENA);

        expect(pocetProvedenychTimu(odlozeno)).toBe(0);
        expect(pocetProvedenychTimu(neprovedeno)).toBe(0);
        // stav je přesto vyplněný – validace části B projde
        expect(stavTimu(odlozeno, tim('BN195')).hotovo).toBe(true);
    });
});

describe('cestaProPrilohy', () => {
    it('má stejný tvar jako u ZP-O: reports/rok/kkz/obvod/id', () => {
        const cesta = cestaProPrilohy('57173', head, { Datum_Provedeni: '2026-06-15' });
        expect(cesta).toBe('reports/2026/S/BN/57173');
    });

    it('bez ID příkazu vrací null', () => {
        expect(cestaProPrilohy(null, head, {})).toBeNull();
    });
});
