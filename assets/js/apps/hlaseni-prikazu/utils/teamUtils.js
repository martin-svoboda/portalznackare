/**
 * Přebere příznak vedoucího z aktuální hlavičky příkazu (INSYZ) do týmu
 * z uloženého snapshotu hlášení (`znackari`).
 *
 * Snapshot vzniká při prvním uložení a sám se neobnovuje – změna vedoucího
 * v INSYZ by se jinak do hlášení nepropsala (popisek „(vedoucí)", isLeader
 * v UI), zatímco server ověřuje vedoucího vždy podle živé hlavičky.
 * Složení týmu se nemění (to řeší TeamMismatchWarning), jen příznak vedoucího.
 *
 * @param {Array} teamMembers - členové týmu ze snapshotu (s INT_ADR)
 * @param {Object} head - hlavička příkazu z INSYZ (INT_ADR_{i}, Je_Vedouci{i})
 * @returns {Array} členové týmu s aktualizovaným isLeader/Je_Vedouci
 */
export function syncLeaderFromHead(teamMembers, head) {
    if (!head || !Array.isArray(teamMembers)) return teamMembers;

    const leaderAdrs = new Set(
        [1, 2, 3]
            .filter(i => head[`Je_Vedouci${i}`] === "1")
            .map(i => parseInt(head[`INT_ADR_${i}`], 10))
    );
    // Hlavička bez vedoucího (neúplná data) – snapshot ponechat beze změny
    if (leaderAdrs.size === 0) return teamMembers;

    return teamMembers.map(member => {
        const isLeader = leaderAdrs.has(parseInt(member.INT_ADR, 10));
        return { ...member, isLeader, Je_Vedouci: isLeader };
    });
}

/**
 * Řidič příkazu z hlavičky INSYZ (`Ridic_INT_ADR`, `RZ_Auta`) pro předvyplnění nového
 * hlášení (INSYZ-371). Jen předvýběr – řídit nakonec může někdo jiný, uživatel ho změní.
 * Bez řidiče (`Ridic` = 0) nebo s řidičem mimo tým nic nepředvyplní – u ZP-I pak
 * bere 2/3 náhrady vedoucí, dokud uživatel hlavního řidiče nevybere.
 *
 * @param {Object} head - hlavička příkazu z INSYZ
 * @param {Array} teamMembers - členové týmu (s INT_ADR)
 * @returns {{Ridic: number|null, SPZ: string}}
 */
export function ridicZHlavicky(head, teamMembers) {
    const intAdr = parseInt(head?.Ridic_INT_ADR, 10);
    const jeVTymu = intAdr > 0 && (teamMembers || []).some(m => parseInt(m.INT_ADR, 10) === intAdr);
    if (!jeVTymu) return { Ridic: null, SPZ: '' };

    return { Ridic: intAdr, SPZ: (head.RZ_Auta || '').trim() };
}
