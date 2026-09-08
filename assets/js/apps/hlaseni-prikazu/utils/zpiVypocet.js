import { pocetProvedenychTimu } from '../../../utils/prikaz';

/**
 * Náhrady u příkazů ZP-I (INSYZ-280 bod 2).
 *
 * Na rozdíl od ZP-O se náhrada nepočítá z odpracovaných hodin, ale z **počtu navštívených
 * TIMů**, na kterých je aspoň jedna položka označená jako „Provedena". Pásma i částky
 * chodí ze sazebníku `trasy.ZP_Sazby` (dataset „Náhrady instalační“), takže se tady
 * nezadrátovávají – v roce 2026 to je 600 Kč pro 1–4 TIMy a 900 Kč pro 5+ TIMů
 * při odpracovaných aspoň 480 minutách.
 */

/**
 * Zaokrouhlení na haléře.
 */
const naHalere = (castka) => Math.round(castka * 100) / 100;

/**
 * Najde instalační tarif podle počtu provedených TIMů a odpracovaného času.
 *
 * Vybírá nejvyšší sazbu, jejíž podmínky jsou splněné – dolní hranice počtu TIMů
 * i minimální doba práce. Horní hranice `Pocet_TIM_Do` slouží jen k popisu pásma;
 * kdyby se podle ní filtrovalo, značkař s 5 TIMy a 7 hodinami by nedostal nic,
 * místo aby spadl do nižšího pásma.
 *
 * @param {number} pocetTimu - počet TIMů s aspoň jednou provedenou položkou
 * @param {number} minutyPrace - odpracovaný čas v minutách
 * @param {Array} tarify - dataset „Náhrady instalační“ ze ZP_Sazby
 * @returns {Object|null} vybraný řádek sazebníku
 */
export function najdiInstalacniTarif(pocetTimu, minutyPrace, tarify) {
    if (!Array.isArray(tarify) || pocetTimu <= 0) {
        return null;
    }

    const vyhovujici = tarify.filter(tarif => {
        const odTimu = Number(tarif.Pocet_TIM_Od ?? 0);
        const odMinut = Number(tarif.Trvani_Od_min ?? 0);

        return pocetTimu >= odTimu && minutyPrace >= odMinut;
    });

    if (vyhovujici.length === 0) {
        return null;
    }

    return vyhovujici.reduce(
        (nejlepsi, tarif) => (parseFloat(tarif.Nahrada || 0) > parseFloat(nejlepsi.Nahrada || 0) ? tarif : nejlepsi)
    );
}

/**
 * Spočítá náhradu za celou skupinu.
 *
 * @param {Object} formData - hlášení (potřebuje Stavy_Tim)
 * @param {number} hodinyPrace - odpracovaný čas skupiny v hodinách
 * @param {Array} tarify - dataset „Náhrady instalační“
 * @returns {{Pocet_TIMu: number, Nahrada_Celkem: number, Pasmo: Object|null}}
 */
export function vypocetNahradyZpi(formData, hodinyPrace, tarify) {
    const pocetTimu = pocetProvedenychTimu(formData?.Stavy_Tim);
    const tarif = najdiInstalacniTarif(pocetTimu, (hodinyPrace || 0) * 60, tarify);

    return {
        Pocet_TIMu: pocetTimu,
        Nahrada_Celkem: tarif ? naHalere(parseFloat(tarif.Nahrada || 0)) : 0,
        Pasmo: tarif
    };
}

/**
 * Rozpočítá náhradu mezi členy skupiny (INSYZ-280 bod 2.2):
 * 2/3 řidiči, zbylá 1/3 rovnoměrně mezi ostatní členy.
 *
 * Rozdíl vzniklý zaokrouhlením dostane řidič, aby součet podílů seděl na celkovou částku.
 * Když řidič není mezi členy určený, dělí se rovným dílem mezi všechny – peníze se
 * nemají kam ztratit a na chybějícího řidiče upozorní validace.
 *
 * @param {number} nahradaCelkem
 * @param {Array} clenove - [{ INT_ADR }]
 * @param {number|string} intAdrRidice - formData.Hlavni_Ridic
 * @returns {Object} { [INT_ADR]: částka }
 */
export function rozpocitejNahraduZpi(nahradaCelkem, clenove, intAdrRidice) {
    const podily = {};

    if (!Array.isArray(clenove) || clenove.length === 0 || !nahradaCelkem) {
        return podily;
    }

    const ridic = clenove.find(clen => String(clen.INT_ADR) === String(intAdrRidice));
    const ostatni = clenove.filter(clen => clen !== ridic);

    // Bez určeného řidiče (nebo jednočlenná skupina) se dělí rovným dílem
    if (!ridic || ostatni.length === 0) {
        const podil = naHalere(nahradaCelkem / clenove.length);
        clenove.forEach(clen => { podily[clen.INT_ADR] = podil; });

        // Zaokrouhlovací rozdíl připadne prvnímu členovi
        const rozdil = naHalere(nahradaCelkem - podil * clenove.length);
        if (rozdil !== 0) {
            podily[clenove[0].INT_ADR] = naHalere(podily[clenove[0].INT_ADR] + rozdil);
        }

        return podily;
    }

    const podilOstatnich = naHalere((nahradaCelkem / 3) / ostatni.length);
    ostatni.forEach(clen => { podily[clen.INT_ADR] = podilOstatnich; });

    // Řidiči zbytek do celkové částky – tedy 2/3 plus zaokrouhlovací rozdíl
    podily[ridic.INT_ADR] = naHalere(nahradaCelkem - podilOstatnich * ostatni.length);

    return podily;
}
