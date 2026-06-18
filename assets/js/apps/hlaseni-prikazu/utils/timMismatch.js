/**
 * Porovná hodnoty zapsané v hlášení (Stavy_Tim) proti aktuálním datům
 * z INSYZ (predmety). Porovnávají se jen pole, která pocházejí z INSYZ
 * a značkař je zároveň edituje: Rok_Vyroby a Smerovani.
 *
 * Nesoulad je informativní (hodnota od značkaře může být legitimně jiná –
 * tabulka byla v terénu vyměněna). Nenabízí se přepis.
 *
 * @param {Object} formData - hlášení (obsahuje Stavy_Tim)
 * @param {Array} predmety - INSYZ předměty
 * @returns {Object} mapa { [ID_PREDMETY]: { Rok_Vyroby?: insyzHodnota, Smerovani?: insyzHodnota } }
 */
export function computeTimMismatch(formData, predmety) {
    const result = {};
    if (!formData?.Stavy_Tim || !Array.isArray(predmety)) {
        return result;
    }

    // Index INSYZ předmětů podle ID_PREDMETY
    const insyzById = {};
    predmety.forEach(item => {
        if (item?.ID_PREDMETY != null) {
            insyzById[String(item.ID_PREDMETY)] = item;
        }
    });

    Object.values(formData.Stavy_Tim).forEach(timGroup => {
        // Predmety může být pole (čerstvě předvyplněné z INSYZ) NEBO objekt
        // klíčovaný ID_PREDMETY (po editaci značkařem) – podporujeme oba tvary,
        // stejně jako validateAllTimItemsCompleted v PartBForm.
        const statuses = Array.isArray(timGroup?.Predmety)
            ? timGroup.Predmety
            : Object.values(timGroup?.Predmety || {});
        statuses.forEach(status => {
            const id = String(status?.ID_PREDMETY ?? '');
            const insyz = insyzById[id];
            if (!id || !insyz) return;

            const diff = {};

            // Rok_Vyroby – porovnat jako řetězce (sjednotit prázdné/null)
            const repRok = status.Rok_Vyroby != null ? String(status.Rok_Vyroby).trim() : '';
            const insRok = insyz.Rok_Vyroby != null ? String(insyz.Rok_Vyroby).trim() : '';
            if (repRok !== '' && insRok !== '' && repRok !== insRok) {
                diff.Rok_Vyroby = insRok;
            }

            // Smerovani – porovnat kódy (L/P)
            const repSmer = (status.Smerovani ?? '').toString().trim();
            const insSmer = (insyz.Smerovani ?? '').toString().trim();
            if (repSmer !== '' && insSmer !== '' && repSmer !== insSmer) {
                diff.Smerovani = insSmer;
            }

            if (Object.keys(diff).length > 0) {
                result[id] = diff;
            }
        });
    });

    return result;
}

/** Lidsky čitelný popis směrování pro zobrazení. */
export function smerovaniLabel(kod) {
    if (kod === 'L') return 'Levá';
    if (kod === 'P') return 'Pravá';
    if (kod === 'N') return 'Nelze určit';
    return kod || '';
}
