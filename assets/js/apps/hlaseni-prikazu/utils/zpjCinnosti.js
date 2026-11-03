import { STAV_PROVEDENI } from '../../../utils/stavProvedeni';

/**
 * Část B hlášení u ZP-J (INSYZ-219): činnosti příkazu z `ZP_Detail` a stav provedení
 * každé z nich – přepínač Ne/Ano jako u obnovy úseků ZP-O (číselník StavProvedeniEnum).
 *
 * Do `formData.Cinnosti` (→ data_b → XML `<Cinnosti>`) se ukládá objekt klíčovaný
 * `ID_ZP_JCCin` (ID řádku činnosti v příkazu): `{ ID_Cinnost, Provedeni }`.
 * Ukazuje se vše, co z INSYZ přijde, včetně starých činností „– pomocník".
 */

/**
 * Sestaví `Cinnosti` podle aktuálního seznamu z INSYZ a převezme už uložené stavy.
 * Činnosti, které v INSYZ zmizely, vypadnou; nové jsou „Neprovedena" (výchozí stav
 * přepínače jako u úseků ZP-O).
 *
 * @param {Array} cinnostiInsyz - řádky z ZP_Detail (ID_ZP_JCCin, ID_Cinnost, …)
 * @param {Object} ulozene - formData.Cinnosti
 * @returns {Object}
 */
export function sestavCinnostiZpj(cinnostiInsyz, ulozene = {}) {
    const vysledek = {};

    (cinnostiInsyz || []).forEach(cinnost => {
        const id = String(cinnost.ID_ZP_JCCin ?? '');
        if (!id) return;

        vysledek[id] = {
            ID_Cinnost: String(cinnost.ID_Cinnost ?? ''),
            Provedeni: ulozene?.[id]?.Provedeni ?? STAV_PROVEDENI.NEPROVEDENA
        };
    });

    return vysledek;
}

/**
 * Zapíše stav provedení jedné činnosti.
 */
export function zapisStavCinnosti(cinnosti, id, provedeni) {
    const klic = String(id);

    return {
        ...(cinnosti || {}),
        [klic]: { ...(cinnosti?.[klic] || {}), Provedeni: provedeni }
    };
}

/** Počet činností bez vyplněného stavu (blokuje dokončení části B; u starých konceptů). */
export function pocetCinnostiBezStavu(cinnosti) {
    const vyplnene = [STAV_PROVEDENI.PROVEDENA, STAV_PROVEDENI.NEPROVEDENA, STAV_PROVEDENI.ODLOZENA];

    return Object.values(cinnosti || {})
        .filter(zaznam => !vyplnene.includes(Number(zaznam?.Provedeni)))
        .length;
}

/**
 * Je provedená aspoň jedna činnost? Podmínka pro náhrady u ZP-J
 * (Michal Markoš, INSYZ-396: „aspoň jedním provedením jsou podmíněny náhrady").
 */
export function jeProvedenaNejakaCinnost(cinnosti) {
    return Object.values(cinnosti || {})
        .some(zaznam => Number(zaznam?.Provedeni) === STAV_PROVEDENI.PROVEDENA);
}

/**
 * Km činnosti z INSYZ (`Vykon`) pro zobrazení – jen informativně, na portálu se nemění.
 * U činností bez km posílá INSYZ „.00", ty vrací null.
 */
export function kmCinnosti(cinnost) {
    const km = parseFloat(cinnost?.Vykon);
    return km > 0 ? km : null;
}
