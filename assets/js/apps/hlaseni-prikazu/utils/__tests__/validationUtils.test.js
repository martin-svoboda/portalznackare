import { describe, it, expect } from 'vitest';
import { validatePartA } from '../validationUtils.js';

const cesta = (Datum, Cas_Odjezdu, Cas_Prijezdu, Misto_Odjezdu, Misto_Prijezdu) => ({
    Datum, Cas_Odjezdu, Cas_Prijezdu, Misto_Odjezdu, Misto_Prijezdu, Druh_Dopravy: 'P', Prilohy: {},
});
const formular = (cesty, Noclezne) => ({
    Skupiny_Cest: [{ id: '001', Cestujci: [], Cesty: cesty }],
    Noclezne,
});
const prazdnyNocleh = { id: '003', Datum: '2026-06-19', Misto: '', Zarizeni: '', Castka: 0, Prilohy: [] };

const jednodenni = [
    cesta('2026-09-28', '07:30', '08:10', 'České Budějovice', 'Hradiště'),
    cesta('2026-09-28', '15:15', '15:45', 'Hradiště', 'České Budějovice'),
];
const vicedenni = [
    cesta('2026-09-27', '07:30', '09:00', 'České Budějovice', 'Hradiště'),
    cesta('2026-09-28', '15:15', '16:45', 'Hradiště', 'České Budějovice'),
];

describe('validatePartA – nocleh u jednodenního hlášení', () => {
    it('jednodenní hlášení s noclehem → jediná blokující chyba místo chyb jednotlivých polí', () => {
        const v = validatePartA(formular(jednodenni, [prazdnyNocleh, { ...prazdnyNocleh, id: '004' }]), null);
        expect(v.canComplete).toBe(false);
        expect(v.errors.map(e => e.type)).toEqual(['nocleh_jednodenni']);
        expect(v.warnings.some(w => w.type === 'missing_accommodation_attachment')).toBe(false);
    });

    it('jednodenní hlášení bez noclehu → bez chyby', () => {
        const v = validatePartA(formular(jednodenni, []), null);
        expect(v.errors).toEqual([]);
    });

    it('vícedenní hlášení s nevyplněným noclehem → chyby polí, ne nocleh_jednodenni', () => {
        const v = validatePartA(formular(vicedenni, [{ ...prazdnyNocleh, Datum: '2026-09-27' }]), null);
        const typy = v.errors.map(e => e.type);
        expect(typy).not.toContain('nocleh_jednodenni');
        expect(typy).toContain('missing_accommodation_facility');
    });
});
