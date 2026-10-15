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
