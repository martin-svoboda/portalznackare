import { describe, it, expect } from 'vitest';
import { syncLeaderFromHead } from '../teamUtils.js';

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
