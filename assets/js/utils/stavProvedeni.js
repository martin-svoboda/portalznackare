/**
 * Číselník stavu provedení pro INSYZ (mirror PHP App\Enum\StavProvedeniEnum).
 * Používá se pro obnovu úseků (Usek_Obnoven) a do budoucna i pro další druhy příkazů.
 *
 *   0 - nevyhodnoceno   1 - nevyplněno   2 - Neprovedena (Ne)   3 - Provedena (Ano)   4 - Odložena
 * Portál nyní posílá 3/2, případně 0 jako fallback.
 */
export const STAV_PROVEDENI = {
    NEVYHODNOCENO: 0,
    NEVYPLNENO: 1,
    NEPROVEDENA: 2, // UI: „Ne"
    PROVEDENA: 3,   // UI: „Ano"
    ODLOZENA: 4,
};

/**
 * Normalizuje uloženou hodnotu Usek_Obnoven na kód číselníku.
 * Zvládne i starý boolean formát (true→3, false→2).
 * @param {*} value
 * @returns {number}
 */
export function normalizeStavProvedeni(value) {
    if (value === true) return STAV_PROVEDENI.PROVEDENA;
    if (value === false) return STAV_PROVEDENI.NEPROVEDENA;
    const n = Number(value);
    return Object.values(STAV_PROVEDENI).includes(n) ? n : STAV_PROVEDENI.NEVYHODNOCENO;
}

/** Je úsek/položka provedená (Ano)? */
export function jeProvedena(value) {
    return normalizeStavProvedeni(value) === STAV_PROVEDENI.PROVEDENA;
}
