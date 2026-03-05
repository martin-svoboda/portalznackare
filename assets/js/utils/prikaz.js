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