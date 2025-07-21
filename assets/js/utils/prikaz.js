/**
 * Získá popis příkazu podle druhu ZP
 * @param {string} druhZP - Druh značkařského příkazu (O, J, S, N)
 * @returns {string} Popis příkazu
 */
export function getPrikazDescription(druhZP) {
    const descriptions = {
        'O': 'k obnově turistické značené trasy',
        'J': 'k jiné turistické činnosti',
        'S': 'k instalaci turistických předmětů',
        'N': 'k osazení a demontáži nosných prvků'
    };
    
    return descriptions[druhZP] || '';
}