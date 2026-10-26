import { describe, it, expect } from 'vitest';
import { syncLeaderFromHead, ridicZHlavicky } from '../teamUtils.js';

const snapshot = [
    { INT_ADR: 100, Znackar: 'Švitorka Pavel', isLeader: true, Je_Vedouci: true },
    { INT_ADR: 200, Znackar: 'Markoš Michal', isLeader: false, Je_Vedouci: false },
];

describe('syncLeaderFromHead', () => {
    it('přebere vedoucího z hlavičky INSYZ místo zastaralého snapshotu', () => {
        const head = { INT_ADR_1: '100', Je_Vedouci1: '0', INT_ADR_2: '200', Je_Vedouci2: '1' };
        const result = syncLeaderFromHead(snapshot, head);
        expect(result.map(m => [m.INT_ADR, m.isLeader, m.Je_Vedouci])).toEqual([
            [100, false, false],
            [200, true, true],
        ]);
    });

    it('hlavička bez vedoucího nebo chybějící hlavička snapshot nemění', () => {
        expect(syncLeaderFromHead(snapshot, { INT_ADR_1: '100', Je_Vedouci1: '0' })).toBe(snapshot);
        expect(syncLeaderFromHead(snapshot, null)).toBe(snapshot);
    });
});

describe('ridicZHlavicky (INSYZ-371)', () => {
    const tym = [{ INT_ADR: 2331 }, { INT_ADR: 2333 }, { INT_ADR: 4133 }];

    it('předvybere řidiče a SPZ z hlavičky INSYZ', () => {
        const head = { Ridic: '1', Ridic_INT_ADR: '2331', RZ_Auta: ' 6AK6331 ' };
        expect(ridicZHlavicky(head, tym)).toEqual({ Ridic: 2331, SPZ: '6AK6331' });
    });

    it('řidič bez SPZ – SPZ zůstane prázdná', () => {
        expect(ridicZHlavicky({ Ridic_INT_ADR: '2333', RZ_Auta: '' }, tym)).toEqual({ Ridic: 2333, SPZ: '' });
    });

    it('bez řidiče, s řidičem mimo tým nebo bez pole nic nepředvyplní', () => {
        const nic = { Ridic: null, SPZ: '' };
        expect(ridicZHlavicky({ Ridic: '0', Ridic_INT_ADR: '0', RZ_Auta: '' }, tym)).toEqual(nic);
        expect(ridicZHlavicky({ Ridic_INT_ADR: '9999', RZ_Auta: 'X' }, tym)).toEqual(nic);
        expect(ridicZHlavicky({}, tym)).toEqual(nic);
        expect(ridicZHlavicky(null, tym)).toEqual(nic);
    });
});
