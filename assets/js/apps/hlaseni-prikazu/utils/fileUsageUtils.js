/**
 * Utility funkce pro práci s file usage tracking
 * Zajišťuje, že se sleduje kde se konkrétní soubory používají
 */

import {api} from '../../../utils/api';

/**
 * Registruje usage souboru v konkrétním místě
 * @param {number} fileId ID souboru
 * @param {string} type Typ usage (např. 'report', 'tim', 'segment')
 * @param {number} entityId ID entity (např. report ID, TIM ID, segment ID)
 * @param {Object} additionalData Dodatečná metadata (např. section, field)
 * @returns {Promise<boolean>} true pokud bylo úspěšně zaregistrováno
 */
export const registerFileUsage = async (fileId, type, entityId, additionalData = null) => {
    try {
        const response = await fetch('/api/portal/files/usage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileId: parseInt(fileId),
                type,
                id: parseInt(entityId),
                data: additionalData
            })
        });

        if (!response.ok) {
            console.error('Failed to register file usage:', await response.text());
            return false;
        }

        const result = await response.json();
        console.log(`File usage registered: file ${fileId} used in ${type}:${entityId}`, result);
        return true;
    } catch (error) {
        console.error('Error registering file usage:', error);
        return false;
    }
};

/**
 * Odregistruje usage souboru z konkrétního místa
 * @param {number} fileId ID souboru
 * @param {string} type Typ usage
 * @param {number} entityId ID entity
 * @returns {Promise<boolean>} true pokud bylo úspěšně odregistrováno
 */
export const unregisterFileUsage = async (fileId, type, entityId) => {
    try {
        const response = await fetch('/api/portal/files/usage', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileId: parseInt(fileId),
                type,
                id: parseInt(entityId)
            })
        });

        if (!response.ok) {
            console.error('Failed to unregister file usage:', await response.text());
            return false;
        }

        const result = await response.json();
        console.log(`File usage unregistered: file ${fileId} removed from ${type}:${entityId}`, result);
        return true;
    } catch (error) {
        console.error('Error unregistering file usage:', error);
        return false;
    }
};

/**
 * Registruje usage pro více souborů najednou
 * @param {Array} files Pole objektů s id souborů
 * @param {string} type Typ usage
 * @param {number} entityId ID entity
 * @param {Object} additionalData Dodatečná metadata
 * @returns {Promise<Array>} Pole výsledků registrace
 */
export const registerMultipleFileUsage = async (files, type, entityId, additionalData = null) => {
    if (!files || files.length === 0) {
        return [];
    }

    const promises = files.map(file => 
        registerFileUsage(file.id, type, entityId, {
            ...additionalData,
            fileName: file.fileName,
            registeredAt: new Date().toISOString()
        })
    );

    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - successful;
    
    if (failed > 0) {
        console.warn(`File usage registration: ${successful} successful, ${failed} failed`);
    }
    
    return results;
};

/**
 * Odregistruje usage pro více souborů najednou
 * @param {Array} files Pole objektů s id souborů
 * @param {string} type Typ usage
 * @param {number} entityId ID entity
 * @returns {Promise<Array>} Pole výsledků odregistrace
 */
export const unregisterMultipleFileUsage = async (files, type, entityId) => {
    if (!files || files.length === 0) {
        return [];
    }

    const promises = files.map(file => unregisterFileUsage(file.id, type, entityId));
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - successful;
    
    if (failed > 0) {
        console.warn(`File usage unregistration: ${successful} successful, ${failed} failed`);
    }
    
    return results;
};

/**
 * Synchronizuje file usage - odregistruje staré soubory a registruje nové
 * @param {Array} oldFiles Staré soubory
 * @param {Array} newFiles Nové soubory
 * @param {string} type Typ usage
 * @param {number} entityId ID entity
 * @param {Object} additionalData Dodatečná metadata
 * @returns {Promise<Object>} Statistiky synchronizace
 */
export const synchronizeFileUsage = async (oldFiles, newFiles, type, entityId, additionalData = null) => {
    const oldIds = new Set((oldFiles || []).map(f => f.id).filter(Boolean));
    const newIds = new Set((newFiles || []).map(f => f.id).filter(Boolean));
    
    // Soubory k odregistraci (jsou ve starých, ale nejsou v nových)
    const filesToUnregister = (oldFiles || []).filter(f => f.id && !newIds.has(f.id));
    
    // Soubory k registraci (jsou v nových, ale nejsou ve starých)
    const filesToRegister = (newFiles || []).filter(f => f.id && !oldIds.has(f.id));
    
    console.log(`File usage sync: ${filesToUnregister.length} to unregister, ${filesToRegister.length} to register`);
    
    // Provést operace
    const unregisterResults = await unregisterMultipleFileUsage(filesToUnregister, type, entityId);
    const registerResults = await registerMultipleFileUsage(filesToRegister, type, entityId, additionalData);
    
    return {
        unregistered: filesToUnregister.length,
        registered: filesToRegister.length,
        unregisterResults,
        registerResults
    };
};

/**
 * Helper pro generování usage type na základě hlášení příkazu
 * @param {string} section Sekce hlášení ('segment', 'accommodation', 'expense', 'tim', 'route')
 * @param {number} reportId ID hlášení
 * @returns {string} Usage type string
 */
export const generateUsageType = (section, reportId) => {
    return `report_${section}`;
};

/**
 * Helper pro generování entity ID na základě kontextu
 * @param {number} reportId ID hlášení
 * @param {string|number} itemId ID konkrétní položky (segment, accommodation, expense, tim)
 * @returns {number} Entity ID
 */
export const generateEntityId = (reportId, itemId = null) => {
    if (itemId) {
        // Pro sub-entity použijeme kombinaci report ID a item ID
        return parseInt(reportId) * 1000000 + parseInt(itemId.toString().slice(-6));
    }
    return parseInt(reportId);
};