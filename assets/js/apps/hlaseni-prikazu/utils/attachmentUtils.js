/**
 * Utility funkce pro práci s přílohami v objektové struktuře
 * Převádí z array [] na object { id: {...} } strukturu
 */

// Pomocná funkce pro vytvoření ID pro přílohy
const generateAttachmentId = () => {
    return crypto.randomUUID();
};

// Konverze array na object strukturu
export const convertAttachmentsArrayToObject = (attachmentsArray) => {
    if (!Array.isArray(attachmentsArray)) {
        // Pokud už je objekty, vrátíme beze změny
        if (typeof attachmentsArray === 'object' && attachmentsArray !== null) {
            return attachmentsArray;
        }
        return {};
    }
    
    const attachmentsObject = {};
    attachmentsArray.forEach(attachment => {
        // Pokud attachment nemá ID, přidáme mu ho
        const attachmentId = attachment.id || generateAttachmentId();
        attachmentsObject[attachmentId] = {
            ...attachment,
            id: attachmentId
        };
    });
    
    return attachmentsObject;
};

// Konverze object na array strukturu (pro backwards compatibility)
export const convertAttachmentsObjectToArray = (attachmentsObject) => {
    if (Array.isArray(attachmentsObject)) {
        return attachmentsObject;
    }
    
    if (!attachmentsObject || typeof attachmentsObject !== 'object') {
        return [];
    }
    
    return Object.values(attachmentsObject);
};

// Konverze object na pole ID (nová efektivní metoda)
export const convertAttachmentsToIds = (attachmentsObject) => {
    if (Array.isArray(attachmentsObject)) {
        // Pokud je už pole, zkontroluj jestli obsahuje objekty nebo ID
        if (attachmentsObject.length === 0) {
            return [];
        }
        
        // Pokud první prvek je číslo, je to už pole ID
        if (typeof attachmentsObject[0] === 'number') {
            return attachmentsObject.filter(id => id != null);
        }
        
        // Pokud první prvek je objekt, extrahuj ID
        return attachmentsObject.map(att => att?.id).filter(id => id != null);
    }
    
    if (!attachmentsObject || typeof attachmentsObject !== 'object') {
        return [];
    }
    
    // Z objektu extrahuj pouze ID
    return Object.values(attachmentsObject)
        .map(att => att?.id)
        .filter(id => id != null);
};

// Přidání nové přílohy do objektu
export const addAttachmentToObject = (attachmentsObject, newAttachment) => {
    const attachmentId = newAttachment.id || generateAttachmentId();
    return {
        ...attachmentsObject,
        [attachmentId]: {
            ...newAttachment,
            id: attachmentId
        }
    };
};

// Odstranění přílohy z objektu
export const removeAttachmentFromObject = (attachmentsObject, attachmentId) => {
    const { [attachmentId]: removed, ...rest } = attachmentsObject;
    return rest;
};

// Aktualizace přílohy v objektu
export const updateAttachmentInObject = (attachmentsObject, attachmentId, updates) => {
    if (!attachmentsObject[attachmentId]) {
        return attachmentsObject;
    }
    
    return {
        ...attachmentsObject,
        [attachmentId]: {
            ...attachmentsObject[attachmentId],
            ...updates
        }
    };
};

// Získání všech příloh jako array (pro kompatibilitu s AdvancedFileUpload)
export const getAttachmentsAsArray = (attachmentsObject) => {
    return convertAttachmentsObjectToArray(attachmentsObject);
};

// Nastavení příloh z array (callback z AdvancedFileUpload)
export const setAttachmentsFromArray = (attachmentsArray) => {
    return convertAttachmentsArrayToObject(attachmentsArray);
};

// Helper pro migraci existujících dat
export const migrateAttachmentsToObjectStructure = (data) => {
    const migratedData = { ...data };
    
    // Seznam všech attachment fields v datech
    const attachmentFields = [
        'Prilohy',
        'Prilohy_NP', 
        'Prilohy_TIM',
        'Prilohy_Usek',
        'Prilohy_Mapa'
    ];
    
    attachmentFields.forEach(field => {
        if (migratedData[field]) {
            migratedData[field] = convertAttachmentsArrayToObject(migratedData[field]);
        }
    });
    
    // Speciální zpracování pro vnořené struktury
    if (migratedData.Skupiny_Cest && Array.isArray(migratedData.Skupiny_Cest)) {
        migratedData.Skupiny_Cest = migratedData.Skupiny_Cest.map(group => ({
            ...group,
            Cesty: (group.Cesty || []).map(segment => ({
                ...segment,
                Prilohy: convertAttachmentsArrayToObject(segment.Prilohy || [])
            }))
        }));
    }
    
    if (migratedData.Noclezne && Array.isArray(migratedData.Noclezne)) {
        migratedData.Noclezne = migratedData.Noclezne.map(acc => ({
            ...acc,
            Prilohy: convertAttachmentsArrayToObject(acc.Prilohy || [])
        }));
    }
    
    if (migratedData.Vedlejsi_Vydaje && Array.isArray(migratedData.Vedlejsi_Vydaje)) {
        migratedData.Vedlejsi_Vydaje = migratedData.Vedlejsi_Vydaje.map(exp => ({
            ...exp,
            Prilohy: convertAttachmentsArrayToObject(exp.Prilohy || [])
        }));
    }
    
    if (migratedData.Stavy_Tim) {
        const migratedStavyTim = {};
        Object.entries(migratedData.Stavy_Tim).forEach(([timId, timReport]) => {
            migratedStavyTim[timId] = {
                ...timReport,
                Prilohy_NP: convertAttachmentsArrayToObject(timReport.Prilohy_NP || []),
                Prilohy_TIM: convertAttachmentsArrayToObject(timReport.Prilohy_TIM || [])
            };
            
            // Migrace příloh v Predmety objektech
            if (timReport.Predmety && typeof timReport.Predmety === 'object') {
                Object.keys(timReport.Predmety).forEach(predmetId => {
                    if (timReport.Predmety[predmetId].Prilohy) {
                        migratedStavyTim[timId].Predmety[predmetId].Prilohy = 
                            convertAttachmentsArrayToObject(timReport.Predmety[predmetId].Prilohy);
                    }
                });
            }
        });
        migratedData.Stavy_Tim = migratedStavyTim;
    }
    
    return migratedData;
};