import { jeProvedena } from './stavProvedeni';

/**
 * Vrátí ID úseku z INSYZ pro klíčování Obnovene_Useky (a tedy atribut <Usek id="…"> v XML).
 * U odbočky je to ID_TRASY_Odbocky, u běžného úseku ID_Trasy_ZU.
 * EvCi_Tra (evidenční číslo trasy) je až poslední fallback pro mock/dev data,
 * která tato ID nemají – do INSYZ se má posílat ID úseku, ne číslo trasy.
 * @param {Object} usek - objekt úseku z INSYZ
 * @returns {string} ID úseku (string)
 */
export function getUsekId(usek) {
    return String(usek?.ID_TRASY_Odbocky ?? usek?.ID_Trasy_ZU ?? usek?.EvCi_Tra ?? '');
}

/**
 * Úsek je použitelný jen s reálným ID. Chybná data z INSYZ (např. „Nedostupná odbočka"
 * – všechna ID null, EvCi_Tra „N/A") ignorujeme, aby se nenabízela k obnově ani neskončila
 * v XML jako id="N/A".
 * @param {Object} usek
 * @returns {boolean}
 */
export function isValidUsek(usek) {
    const id = getUsekId(usek);
    return id !== '' && id !== 'N/A';
}

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

/**
 * Rozparsuje číslo příkazu (tvar "kraj/obvod/typ/číslo", např. "P/PS/O/26032")
 * na jednotlivé segmenty. Při nestandardním/prázdném čísle vrací nully.
 *
 * @param {string} cisloZp
 * @returns {{kraj: string|null, obvod: string|null, typ: string|null, cislo: string|null}}
 */
export function parseCisloZp(cisloZp) {
    const empty = {kraj: null, obvod: null, typ: null, cislo: null};
    if (!cisloZp || typeof cisloZp !== 'string') {
        return empty;
    }
    const parts = cisloZp.split('/');
    if (parts.length < 4) {
        return empty;
    }
    const clean = (s) => (s || '').trim() || null;
    return {
        kraj: clean(parts[0]),
        obvod: clean(parts[1]),
        typ: clean(parts[2]),
        cislo: clean(parts[3]),
    };
}

/**
 * Z čísla příkazu vrátí kód typu (3. segment, např. "O") nebo null.
 *
 * @param {string} cisloZp
 * @returns {string|null} kód typu (O/J/S/N…) nebo null
 */
export function parseCisloZpTyp(cisloZp) {
    return parseCisloZp(cisloZp).typ;
}

/**
 * Sestaví pole tras pro mapu z dat ZP_Useky, predmetů (groupedData) a úseků (useky).
 *
 * @param {Array} zpUseky - Data z /api/insyz/zp-useky/{id}
 * @param {Array} groupedData - Seskupené předměty podle EvCi_TIM (obsahují GPS)
 * @param {Array} useky - Úseky z ZP_Detail (obsahují Barva_Kod, Druh_Presunu, Nazev_ZU)
 * @returns {Array} Pole route objektů: {EvCi_Tra, points[], Barva_Kod, Druh_Presunu, Nazev_ZU}
 */
export function buildMapRoutes(zpUseky, groupedData, useky) {
    // 1. GPS lookup z groupedData: EvCi_TIM → {lat, lon, name}
    const gpsLookup = {};
    if (Array.isArray(groupedData)) {
        groupedData.forEach(item => {
            if (item.EvCi_TIM && item.GPS_Sirka && item.GPS_Delka) {
                gpsLookup[item.EvCi_TIM] = {
                    lat: Number(item.GPS_Sirka),
                    lon: Number(item.GPS_Delka),
                    name: item.Naz_TIM || item.EvCi_TIM
                };
            }
        });
    }

    // 2. Metadata lookup z useky: compositeKey → {Barva_Kod, Druh_Presunu, Nazev_ZU}
    // Rozlišuje hlavní úsek (ID_TRASY_Odbocky === null) a odbočky
    const usekyLookup = {};
    if (Array.isArray(useky)) {
        const odbockyCounters = {};
        useky.forEach(u => {
            if (!u.EvCi_Tra) return;
            const isOdbocka = u.ID_TRASY_Odbocky !== null && u.ID_TRASY_Odbocky !== undefined;
            let key;
            if (isOdbocka) {
                if (!odbockyCounters[u.EvCi_Tra]) odbockyCounters[u.EvCi_Tra] = 0;
                odbockyCounters[u.EvCi_Tra]++;
                key = `${u.EvCi_Tra}-${odbockyCounters[u.EvCi_Tra]}`;
            } else {
                key = `${u.EvCi_Tra}-0`;
            }
            usekyLookup[key] = {
                Barva_Kod: u.Barva_Kod,
                Druh_Presunu: u.Druh_Presunu,
                Nazev_ZU: u.Nazev_ZU
            };
        });
    }

    // 3. Seskupit ZP_Useky podle EvCi_Tra + Poradi_odbocky_na_TIM (rozlišit hlavní úsek a odbočky)
    const grouped = {};
    zpUseky.forEach(item => {
        if (!item.EvCi_Tra) return;
        const key = `${item.EvCi_Tra}-${item.Poradi_odbocky_na_TIM || '0'}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });

    // 4. Pro každou trasu: seřadit, namapovat GPS, přidat metadata
    const routes = [];
    Object.entries(grouped).forEach(([compositeKey, items]) => {
        // Seřadit podle Poradi_TIM_v_trase
        items.sort((a, b) => Number(a.Poradi_TIM_v_trase) - Number(b.Poradi_TIM_v_trase));

        // Namapovat na GPS souřadnice
        const points = items
            .map(i => gpsLookup[i.EvCi_TIM])
            .filter(Boolean);

        if (points.length < 2) return;

        // Metadata z useky lookup
        const meta = usekyLookup[compositeKey] || {};

        routes.push({
            key: compositeKey,
            EvCi_Tra: items[0].EvCi_Tra,
            points,
            Barva_Kod: meta.Barva_Kod || '',
            Druh_Presunu: meta.Druh_Presunu || 'PZT',
            Nazev_ZU: meta.Nazev_ZU || ''
        });
    });

    return routes;
}

/**
 * Rozpozná, zda třetí dataset detailu příkazu nejsou úseky tras, ale servisní TIMy.
 *
 * INSYZ vrací u příkazů typu S (ZP-I) ve stejném slotu jako úseky dataset `ZP_ServTIM`
 * (procedura trasy.ZP_ServTIM) s úplně jinými sloupci – nemá Kod_ZU ani Barva_Kod,
 * zato nese EvCi_TIM a servisní texty. Bez tohoto rozlišení se servisní řádky dostanou
 * do tabulky úseků a vykreslování na chybějící barvě spadne.
 *
 * @param {Array} rows - obsah pole `useky` z ZP_Detail
 * @returns {boolean}
 */
export function jeServisniTimDataset(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return false;
    }

    const prvni = rows[0];

    return Boolean(prvni) && prvni.EvCi_TIM !== undefined && prvni.Kod_ZU === undefined;
}

// --- Pravidla ZP-I (příkaz typu S, „Instalace předmětů") --------------------------

/**
 * Pořadí verzí TIMu pro výběr souřadnic (INSYZ-278, Michal Markoš 6. 9. 2026):
 * „GPS souřadnice by se měly použít první nalezené při hledání v tomto pořadí: P/R/U/V."
 * Kód N (návrh) v seznamu není – ignoruje se.
 */
const PORADI_STAVU_TIM = ['P', 'R', 'U', 'V'];

/**
 * Vybere souřadnice TIMu z jeho předmětů.
 *
 * ZP není „zmrazený" a odráží aktuální stav TIMu, takže se v jednom příkazu potkávají
 * předměty z různých verzí téhož TIMu – a ty se můžou lišit i polohou (BN195 v S/BN/S/25080
 * má dvě polohy 316 m od sebe). Bez tohoto pravidla by pin na mapě závisel na pořadí řádků.
 *
 * @param {Array} predmetyTimu - předměty jednoho EvCi_TIM
 * @returns {Object} { GPS_Sirka, GPS_Delka, Stav_TIM, Naz_TIM } z vybrané verze; prázdné hodnoty, když souřadnice nemá žádný předmět
 */
export function vyberGpsTimu(predmetyTimu) {
    const prazdne = { GPS_Sirka: null, GPS_Delka: null, Stav_TIM: null, Naz_TIM: null };

    if (!Array.isArray(predmetyTimu) || predmetyTimu.length === 0) {
        return prazdne;
    }

    const maSouradnice = (p) => Boolean(p?.GPS_Sirka) && Boolean(p?.GPS_Delka);
    const kandidati = predmetyTimu.filter(maSouradnice);

    if (kandidati.length === 0) {
        return prazdne;
    }

    // První nalezená verze v pořadí P → R → U → V, jinak (typicky jen stav N) první se souřadnicemi
    const vybrany = PORADI_STAVU_TIM
        .map(stav => kandidati.find(p => p.Stav_TIM === stav))
        .find(Boolean) || kandidati[0];

    return {
        GPS_Sirka: vybrany.GPS_Sirka,
        GPS_Delka: vybrany.GPS_Delka,
        Stav_TIM: vybrany.Stav_TIM ?? null,
        Naz_TIM: vybrany.Naz_TIM ?? null
    };
}

/**
 * Určí činnost na předmětu ZP-I. Činnost drží `Co_Provest`, nikdy `Stav_TIM`
 * (Michal Markoš: „Stav TIM ignorovat.").
 *
 * @param {Object} predmet
 * @returns {'odinstalace'|'instalace'}
 */
export function cinnostPredmetu(predmet) {
    const coProvest = String(predmet?.Co_Provest ?? '');

    return coProvest.startsWith('Zrušit') ? 'odinstalace' : 'instalace';
}

/**
 * Pořadí činností v části B (INSYZ-280 bod 5.2):
 * „Pokud je činností více, prosím zobrazovat po TIMech v pořadí servis, odinstalace, instalace."
 */
const PORADI_CINNOSTI = ['servis', 'odinstalace', 'instalace'];

/**
 * Seskupí TIMy příkazu ZP-I pro zobrazení v hlášení.
 *
 * Sjednocuje **oba** zdroje: TIMy z předmětů a TIMy ze servisního datasetu. Servisní TIM je
 * samostatný TIM bez předmětů – v datech nemá se seznamem předmětů žádný průnik (v S/BN/S/26069
 * jsou předměty na BN195/198/199/404 a servis na BN010/BN335). Sjednocení odpovídá výčtu TIMů
 * v `head.Popis_ZP`.
 *
 * @param {Array} predmety - `predmety` z ZP_Detail
 * @param {Array} servisTimy - dataset ZP_ServTIM (viz jeServisniTimDataset)
 * @returns {Array} TIMy s položkami setříděnými servis → odinstalace → instalace
 */
export function seskupTimyZpi(predmety, servisTimy = []) {
    const timy = new Map();

    const zajisti = (evCiTim, naz) => {
        if (!timy.has(evCiTim)) {
            timy.set(evCiTim, {
                EvCi_TIM: evCiTim,
                Naz_TIM: naz ?? null,
                Stav_TIM: null,
                NP: null,
                GPS_Sirka: null,
                GPS_Delka: null,
                Servis: null,
                items: []
            });
        }
        return timy.get(evCiTim);
    };

    // 1. TIMy z předmětů
    (Array.isArray(predmety) ? predmety : []).forEach(predmet => {
        if (!predmet?.EvCi_TIM) return;

        const tim = zajisti(predmet.EvCi_TIM, predmet.Naz_TIM);
        tim.NP = tim.NP ?? predmet.NP ?? null;
        tim.items.push({ ...predmet, Cinnost: cinnostPredmetu(predmet) });
    });

    // 2. TIMy ze servisního datasetu (můžou být úplně jiné než ty s předměty)
    (Array.isArray(servisTimy) ? servisTimy : []).forEach(servis => {
        if (!servis?.EvCi_TIM) return;

        const tim = zajisti(servis.EvCi_TIM, servis.Naz_TIM);
        tim.Servis = servis;
        tim.items.push({
            ID_PREDMETY: 'servis',
            EvCi_TIM: servis.EvCi_TIM,
            Naz_TIM: servis.Naz_TIM,
            Cinnost: 'servis',
            TIM_Text: servis.TIM_Text ?? '',
            Popis: servis.Popis ?? '',
            Stav_Udrz: servis.Stav_Udrz ?? '',
            Stav_Udrz_Naz: servis.Stav_Udrz_Naz ?? ''
        });
    });

    return Array.from(timy.values()).map(tim => {
        const gps = vyberGpsTimu(tim.items.filter(i => i.Cinnost !== 'servis'));

        return {
            ...tim,
            Naz_TIM: tim.Naz_TIM ?? gps.Naz_TIM,
            Stav_TIM: gps.Stav_TIM,
            GPS_Sirka: gps.GPS_Sirka,
            GPS_Delka: gps.GPS_Delka,
            items: [...tim.items].sort(
                (a, b) => PORADI_CINNOSTI.indexOf(a.Cinnost) - PORADI_CINNOSTI.indexOf(b.Cinnost)
            )
        };
    });
}

/**
 * Počet TIMů, které se započítají do náhrad ZP-I (INSYZ-280 bod 7):
 * „Do výpočtu odměn přidáváme pouze TIMy, kde je minimálně jeden předmět nebo servis proveden."
 *
 * Za „Neprovedena" a „Odložena" se nedostává nic. TIM je unikátní podle EvCi_TIM –
 * verze TIMu se nezapočítávají jako další navštívené TIMy.
 *
 * @param {Object} stavyTim - formData.Stavy_Tim ({ [EvCi_TIM]: { Predmety: [{ Provedeni }] } })
 * @returns {number}
 */
export function pocetProvedenychTimu(stavyTim) {
    if (!stavyTim || typeof stavyTim !== 'object') {
        return 0;
    }

    return Object.values(stavyTim).filter(tim => {
        // Servisní zásah je samostatný uzel TIMu, ne položka v Predmety
        if (jeProvedena(tim?.Servis?.Provedeni)) {
            return true;
        }

        // Predmety je objekt klíčovaný ID_PREDMETY; pole je legacy struktura ze starších hlášení
        const predmety = tim?.Predmety;

        if (!predmety || typeof predmety !== 'object') {
            return false;
        }

        return Object.values(predmety).some(predmet => jeProvedena(predmet?.Provedeni));
    }).length;
}
