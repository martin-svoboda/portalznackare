import { calculateExecutionDate } from './compensationCalculator';
import { STAV_PROVEDENI } from '../../../utils/stavProvedeni';

/**
 * Hodnoty stavu položky v části B u ZP-I (INSYZ-280 bod 7).
 *
 * Používá se existující číselník `StavProvedeniEnum` dohodnutý s INSYZ (stejný, jakým
 * se posílá obnova úseků u ZP-O), aby Honza dostal napříč typy příkazů stejné kódy.
 * Do náhrad se počítá jen „Provedena" – za „Neprovedena" a „Odložena" se nedostává nic.
 */
export const ZPI_STAVY = [
    { value: STAV_PROVEDENI.PROVEDENA, label: 'Provedena' },
    { value: STAV_PROVEDENI.NEPROVEDENA, label: 'Neprovedena' },
    { value: STAV_PROVEDENI.ODLOZENA, label: 'Odložena' }
];

/**
 * Popisky činností pro UI.
 */
export const CINNOST_POPIS = {
    servis: 'Servisní zásah',
    odinstalace: 'Odinstalace',
    instalace: 'Instalace'
};

/**
 * Identifikátor položky pro UI (klíč v Reactu, název radio skupiny).
 *
 * Servisní zásah **není předmět** – nemá `ID_PREDMETY` a neukládá se mezi `Predmety`,
 * ale do vlastního uzlu `Servis` daného TIMu (INSYZ-280 bod 7: „TIM / ID předmětu
 * nebo servis"). Proto tady vrací jen značku „servis", ne klíč do `Predmety`.
 *
 * @param {Object} item - položka ze seskupTimyZpi
 * @returns {string}
 */
export function identifikatorPolozky(item) {
    if (item?.Cinnost === 'servis') {
        return 'servis';
    }

    return String(item?.ID_PREDMETY ?? `${item?.EvCi_TIM}_${item?.Predmet_Index}`);
}

/**
 * Cesta pro ukládání příloh hlášení – stejné schéma jako u ZP-O.
 *
 * @param {string|number} prikazId
 * @param {Object} head - hlavička příkazu (KKZ, ZO)
 * @param {Object} formData
 * @returns {string|null}
 */
export function cestaProPrilohy(prikazId, head, formData) {
    if (!prikazId) {
        return null;
    }

    const rok = calculateExecutionDate(formData).getFullYear();
    const platnyRok = (rok >= 2020 && rok <= 2030) ? rok : new Date().getFullYear();
    const kkz = head?.KKZ?.toString().trim() || 'unknown';
    const obvod = head?.ZO?.toString().trim() || 'unknown';

    return `reports/${platnyRok}/${kkz}/${obvod}/${prikazId.toString().trim()}`;
}

/**
 * Vrátí stav položky z hlášení.
 *
 * @param {Object} stavyTim - formData.Stavy_Tim
 * @param {string} evCiTim
 * @param {Object} item
 * @returns {Object|undefined}
 */
export function stavPolozky(stavyTim, evCiTim, item) {
    const zaznamTimu = stavyTim?.[evCiTim];

    if (!zaznamTimu) {
        return undefined;
    }

    // Servis je samostatný uzel TIMu, ne položka v Predmety
    if (item?.Cinnost === 'servis') {
        return zaznamTimu.Servis;
    }

    const predmety = zaznamTimu.Predmety;

    if (!predmety || typeof predmety !== 'object') {
        return undefined;
    }

    return predmety[identifikatorPolozky(item)];
}

/**
 * Kolik položek TIMu už má vyplněný stav.
 *
 * @param {Object} stavyTim - formData.Stavy_Tim
 * @param {Object} tim - TIM ze seskupTimyZpi
 * @returns {{vyplneno: number, celkem: number, hotovo: boolean}}
 */
export function stavTimu(stavyTim, tim) {
    const celkem = tim?.items?.length || 0;
    const vyplneno = (tim?.items || []).filter(item => {
        const kod = stavPolozky(stavyTim, tim.EvCi_TIM, item)?.Provedeni;

        return kod !== undefined && kod !== null && kod !== STAV_PROVEDENI.NEVYPLNENO;
    }).length;

    return { vyplneno, celkem, hotovo: celkem > 0 && vyplneno === celkem };
}

/**
 * Zapíše stav jedné položky do `Stavy_Tim` a vrátí nový objekt (bez mutace).
 * Struktura odpovídá ZP-O, jen místo `Zachovalost` nese `Provedeni`, aby s tím
 * beze změny fungovaly přílohy i migrace v `attachmentUtils`.
 *
 * @param {Object} stavyTim - dosavadní formData.Stavy_Tim
 * @param {Object} tim - TIM ze seskupTimyZpi
 * @param {Object} item - položka TIMu
 * @param {number} provedeni - kód ze ZPI_STAVY (StavProvedeniEnum)
 * @returns {Object} nový Stavy_Tim
 */
export function zapisStavPolozky(stavyTim, tim, item, provedeni) {
    const evCiTim = tim.EvCi_TIM;
    const zaznamTimu = stavyTim?.[evCiTim] || {
        EvCi_TIM: evCiTim,
        Predmety: {},
        Prilohy_TIM: {}
    };

    // Servisní zásah není předmět – dostane vlastní uzel Servis, aby se do INSYZ
    // neposílalo nečíselné ID_PREDMETY
    if (item.Cinnost === 'servis') {
        // Starší rozpracovaná hlášení mohla mít servis omylem mezi předměty pod klíčem
        // „servis" – při zápisu ho odsud odklidíme, ať se nedostane do XML.
        const { servis: _legacy, ...predmety } = zaznamTimu.Predmety || {};

        return {
            ...stavyTim,
            [evCiTim]: {
                ...zaznamTimu,
                Predmety: predmety,
                // Bez metadat: EvCi_TIM je klíč TIMu a texty servisu má INSYZ ve svých
                // datech, v XML by jen přidávaly šum
                Servis: {
                    ...(zaznamTimu.Servis || {}),
                    metadata: undefined,
                    Provedeni: provedeni
                }
            }
        };
    }

    const id = identifikatorPolozky(item);

    return {
        ...stavyTim,
        [evCiTim]: {
            ...zaznamTimu,
            Predmety: {
                ...(zaznamTimu.Predmety || {}),
                [id]: {
                    ...(zaznamTimu.Predmety?.[id] || {}),
                    ID_PREDMETY: id,
                    Cinnost: item.Cinnost,
                    Provedeni: provedeni,
                    metadata: {
                        EvCi_TIM: evCiTim,
                        ID_PREDMETY: item.ID_PREDMETY ?? null,
                        Predmet_Index: item.Predmet_Index ?? null,
                        Druh_Predmetu: item.Druh_Predmetu ?? null,
                        Druh_Predmetu_Naz: item.Druh_Predmetu_Naz ?? null,
                        Co_Provest: item.Co_Provest ?? null,
                        Radek1: item.Radek1 ?? null,
                        lastUpdated: new Date().toISOString()
                    }
                }
            }
        }
    };
}

/**
 * Nastaví stejný stav všem položkám TIMu naráz (INSYZ-280 bod 5.5 – „označit celý TIM
 * ve smyslu všechny podúkoly tohoto TIM jsou splněny").
 *
 * @param {Object} stavyTim
 * @param {Object} tim
 * @param {number} provedeni
 * @returns {Object} nový Stavy_Tim
 */
export function zapisStavCelehoTimu(stavyTim, tim, provedeni) {
    return (tim.items || []).reduce(
        (acc, item) => zapisStavPolozky(acc, tim, item, provedeni),
        stavyTim || {}
    );
}
