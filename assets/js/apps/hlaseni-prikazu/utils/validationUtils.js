/**
 * Centralizovaná validace pro formulář hlášení příkazů
 * Sjednocuje validační logiku napříč komponentami
 */

import { extractTeamMembers } from './compensationCalculator';

/**
 * Validace minimálního počtu jízd za den pro každého člena
 */
const validateMinimumTripsPerDay = (formData, head) => {
    if (!formData.Skupiny_Cest || !head) return { isValid: true, details: [] };
    
    const details = [];
    
    // Získat všechny členy týmu
    const teamMembers = extractTeamMembers(head);
    if (teamMembers.length === 0) return { isValid: true, details: [] };
    
    // Pro každého člena zkontrolovat minimální počet jízd za den
    for (const member of teamMembers) {
        // Najít skupiny kde je člen cestujícím
        const memberGroups = formData.Skupiny_Cest.filter(group => 
            group.Cestujci && group.Cestujci.includes(member.INT_ADR)
        );
        
        if (memberGroups.length === 0) continue; // Člen nejedde v žádné skupině
        
        // Extraktovat segmenty pro člena
        const memberSegments = memberGroups.flatMap(group => group.Cesty || []);
        
        // Seskupit podle dnů
        const segmentsByDate = memberSegments.reduce((acc, segment) => {
            if (!segment || !segment.Cas_Odjezdu || !segment.Cas_Prijezdu) return acc;
            
            let segmentDate = segment.Datum || new Date();
            if (!(segmentDate instanceof Date)) {
                segmentDate = new Date(segmentDate);
            }
            if (isNaN(segmentDate.getTime())) {
                segmentDate = new Date();
            }
            
            const dateKey = segmentDate.toDateString();
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(segment);
            return acc;
        }, {});
        
        // Zkontrolovat že každý den má alespoň 2 jízdy
        for (const [dateKey, segments] of Object.entries(segmentsByDate)) {
            if (segments.length < 2) {
                details.push({
                    type: 'minimum_trips',
                    member: member.name || member.Znackar,
                    date: dateKey,
                    count: segments.length
                });
            }
        }
    }
    
    return {
        isValid: details.length === 0,
        details
    };
};

/**
 * Validace řidiče a SPZ pro auto cesty
 */
const validateDriverAndLicensePlate = (formData) => {
    const details = [];
    
    // Extraktovat všechny segmenty ze všech travel groups
    const allSegments = formData.Skupiny_Cest?.flatMap(group => group.Cesty || []) || [];
    
    const needsDriver = allSegments.some(segment =>
        segment && segment.Druh_Dopravy && (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z")
    );

    if (needsDriver) {
        formData.Skupiny_Cest?.forEach((group, groupIndex) => {
            const hasCarTrips = group.Cesty?.some(s => s.Druh_Dopravy === "AUV" || s.Druh_Dopravy === "AUV-Z");
            
            if (hasCarTrips) {
                if (!group.Ridic) {
                    details.push({
                        type: 'missing_driver',
                        group: groupIndex + 1
                    });
                }
                if (!group.SPZ) {
                    details.push({
                        type: 'missing_license_plate',
                        group: groupIndex + 1
                    });
                }
            }
        });
    }
    
    return {
        isValid: details.length === 0,
        details
    };
};

/**
 * Validace jízdenek pro veřejnou dopravu
 */
const validatePublicTransportTickets = (formData) => {
    const details = [];
    
    formData.Skupiny_Cest?.forEach((group, groupIndex) => {
        group.Cesty?.forEach((segment, segmentIndex) => {
            if (segment.Druh_Dopravy !== "V") return;
            
            // Pokud nejsou cestující, není co kontrolovat
            if (!group.Cestujci || group.Cestujci.length === 0) return;
            
            // Kontrola že má každý cestující vyplněnou částku
            if (typeof segment.Naklady !== 'object' || !segment.Naklady) {
                details.push({
                    type: 'missing_costs_object',
                    group: groupIndex + 1,
                    segment: segmentIndex + 1
                });
                // Nekončit zde - pokračovat kontrolou příloh
            }
            
            // Kontrola nákladů a příloh podle stavu proplácení
            if (typeof segment.Naklady === 'object' && segment.Naklady) {
                // Rozdělit cestující podle zadaných částek
                const membersWithCosts = group.Cestujci.filter(intAdr => 
                    segment.Naklady[intAdr] > 0
                );
                const membersWithZeroCosts = group.Cestujci.filter(intAdr => 
                    segment.Naklady[intAdr] === 0
                );
                const membersWithoutCosts = group.Cestujci.filter(intAdr => 
                    !(intAdr in segment.Naklady) || segment.Naklady[intAdr] === undefined || segment.Naklady[intAdr] === null
                );
                
                // Varování pro chybějící částky
                if (membersWithoutCosts.length > 0) {
                    details.push({
                        type: 'missing_ticket_costs',
                        group: groupIndex + 1,
                        segment: segmentIndex + 1,
                        missingFor: membersWithoutCosts.length
                    });
                }
                
                // Varování pro nulové částky
                if (membersWithZeroCosts.length > 0) {
                    details.push({
                        type: 'zero_ticket_costs',
                        group: groupIndex + 1,
                        segment: segmentIndex + 1,
                        zeroFor: membersWithZeroCosts.length
                    });
                }
                
                // Přílohy kontrolovat jen pokud někdo má částku > 0 (chce proplácení)
                if (membersWithCosts.length > 0 && (!segment.Prilohy || segment.Prilohy.length === 0)) {
                    details.push({
                        type: 'missing_ticket_attachments',
                        group: groupIndex + 1,
                        segment: segmentIndex + 1
                    });
                }
            } else {
                // Chybí celý objekt nákladů - varování pro všechny cestující
                details.push({
                    type: 'missing_costs_object',
                    group: groupIndex + 1,
                    segment: segmentIndex + 1
                });
            }
        });
    });
    
    return {
        isValid: details.length === 0,
        details
    };
};

/**
 * Validace kompletnosti dat v segmentech cest
 */
const validateSegmentCompleteness = (formData) => {
    const details = [];
    
    formData.Skupiny_Cest?.forEach((group, groupIndex) => {
        group.Cesty?.forEach((segment, segmentIndex) => {
            if (!segment) return;
            
            const segmentId = `skupina ${groupIndex + 1}, cesta ${segmentIndex + 1}`;
            
            // Základní povinné údaje pro všechny segmenty
            if (!segment.Datum) {
                details.push({
                    type: 'missing_segment_date',
                    segment: segmentId
                });
            }
            
            if (!segment.Misto_Odjezdu?.trim()) {
                details.push({
                    type: 'missing_departure_place',
                    segment: segmentId
                });
            }
            
            if (!segment.Misto_Prijezdu?.trim()) {
                details.push({
                    type: 'missing_arrival_place',
                    segment: segmentId
                });
            }
            
            if (!segment.Cas_Odjezdu?.trim()) {
                details.push({
                    type: 'missing_departure_time',
                    segment: segmentId
                });
            }
            
            if (!segment.Cas_Prijezdu?.trim()) {
                details.push({
                    type: 'missing_arrival_time',
                    segment: segmentId
                });
            }
            
            // Specifické validace podle typu dopravy
            if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
                if (!segment.Kilometry || segment.Kilometry <= 0) {
                    details.push({
                        type: 'missing_kilometers',
                        segment: segmentId
                    });
                }
            }
        });
    });
    
    return {
        isValid: details.length === 0,
        details
    };
};

/**
 * Validace detailních údajů výdajů
 */
const validateExpenseDetails = (formData) => {
    const details = [];
    
    // Validace ubytování
    (formData.Noclezne || []).forEach((noc, index) => {
        const expenseId = `ubytování ${index + 1}`;
        
        if (!noc.Datum) {
            details.push({
                type: 'missing_accommodation_date',
                expense: expenseId
            });
        }
        
        if (!noc.Zarizeni?.trim()) {
            details.push({
                type: 'missing_accommodation_facility',
                expense: expenseId
            });
        }
        
        if (!noc.Misto?.trim()) {
            details.push({
                type: 'missing_accommodation_place',
                expense: expenseId
            });
        }
        
        if (!noc.Castka || noc.Castka <= 0) {
            details.push({
                type: 'missing_accommodation_amount',
                expense: expenseId
            });
        }
        
        if (!noc.Prilohy || noc.Prilohy.length === 0) {
            details.push({
                type: 'missing_accommodation_attachment',
                expense: expenseId
            });
        }
    });
    
    // Validace ostatních výdajů
    (formData.Vedlejsi_Vydaje || []).forEach((vydaj, index) => {
        const expenseId = `vedlejší výdaj ${index + 1}`;
        
        if (!vydaj.Datum) {
            details.push({
                type: 'missing_additional_expense_date',
                expense: expenseId
            });
        }
        
        if (!vydaj.Polozka?.trim()) {
            details.push({
                type: 'missing_additional_expense_description',
                expense: expenseId
            });
        }
        
        if (!vydaj.Castka || vydaj.Castka <= 0) {
            details.push({
                type: 'missing_additional_expense_amount',
                expense: expenseId
            });
        }
        
        if (!vydaj.Prilohy || vydaj.Prilohy.length === 0) {
            details.push({
                type: 'missing_additional_expense_attachment',
                expense: expenseId
            });
        }
    });
    
    return {
        isValid: details.length === 0,
        details
    };
};

/**
 * Hlavní validační funkce pro část A formuláře
 * @param {Object} formData - Data formuláře
 * @param {Object} head - Hlavička příkazu
 * @returns {Object} Výsledek validace s detaily
 */
export const validatePartA = (formData, head) => {
    if (!formData || !formData.Skupiny_Cest) {
        return {
            isValid: false,
            canComplete: false,
            errors: [{
                type: 'no_data',
                message: 'Chybí data formuláře'
            }],
            warnings: []
        };
    }
    
    // Základní kontrola existence cest
    const hasTrips = formData.Skupiny_Cest?.length > 0 && 
                     formData.Skupiny_Cest.some(g => g.Cesty?.length > 0);
    
    if (!hasTrips) {
        return {
            isValid: false,
            canComplete: false,
            errors: [{
                type: 'no_trips',
                message: 'Nejsou vyplněny žádné cesty'
            }],
            warnings: []
        };
    }
    
    const errors = [];
    const warnings = [];
    
    // Validace řidiče a SPZ
    const driverValidation = validateDriverAndLicensePlate(formData);
    if (!driverValidation.isValid) {
        driverValidation.details.forEach(detail => {
            if (detail.type === 'missing_driver') {
                errors.push({
                    type: 'missing_driver',
                    message: `Chybí řidič u skupiny ${detail.group} s cestou autem`
                });
            }
            if (detail.type === 'missing_license_plate') {
                errors.push({
                    type: 'missing_license_plate', 
                    message: `Chybí SPZ u skupiny ${detail.group} s cestou autem`
                });
            }
        });
    }
    
    // Validace jízdenek pro veřejnou dopravu
    const ticketValidation = validatePublicTransportTickets(formData);
    if (!ticketValidation.isValid) {
        ticketValidation.details.forEach(detail => {
            if (detail.type === 'missing_costs_object') {
                warnings.push({
                    type: 'missing_ticket_costs',
                    message: `Chybí data s náklady pro veřejnou dopravu ve skupině ${detail.group}, cesta ${detail.segment} - jízdné nebude proplaceno`
                });
            }
            if (detail.type === 'missing_ticket_costs') {
                warnings.push({
                    type: 'missing_ticket_costs', 
                    message: `Chybí ceny jízdenek pro ${detail.missingFor} cestující ve skupině ${detail.group}, cesta ${detail.segment} - jízdné nebude proplaceno`
                });
            }
            if (detail.type === 'zero_ticket_costs') {
                warnings.push({
                    type: 'zero_ticket_costs',
                    message: `Jízdné není uvedeno ve skupině ${detail.group}, cesta ${detail.segment} - jízdné nebude proplaceno`
                });
            }
            if (detail.type === 'missing_ticket_attachments') {
                warnings.push({
                    type: 'missing_ticket_attachments',
                    message: `Chybí přílohy k jízdenkám ve skupině ${detail.group}, cesta ${detail.segment} - nepřiložené doklady budete muset dodat dodatečně ke schválení výdaje`
                });
            }
        });
    }
    
    // Validace kompletnosti dat v segmentech
    const segmentValidation = validateSegmentCompleteness(formData);
    if (!segmentValidation.isValid) {
        segmentValidation.details.forEach(detail => {
            let message = '';
            switch (detail.type) {
                case 'missing_segment_date':
                    message = `Chybí datum u ${detail.segment}`;
                    break;
                case 'missing_departure_place':
                    message = `Chybí místo odjezdu u ${detail.segment}`;
                    break;
                case 'missing_arrival_place':
                    message = `Chybí místo příjezdu u ${detail.segment}`;
                    break;
                case 'missing_departure_time':
                    message = `Chybí čas odjezdu u ${detail.segment}`;
                    break;
                case 'missing_arrival_time':
                    message = `Chybí čas příjezdu u ${detail.segment}`;
                    break;
                case 'missing_kilometers':
                    message = `Chybí kilometry u auto cesty ${detail.segment}`;
                    break;
            }
            errors.push({
                type: detail.type,
                message
            });
        });
    }
    
    // Validace detailních údajů výdajů
    const expenseValidation = validateExpenseDetails(formData);
    if (!expenseValidation.isValid) {
        expenseValidation.details.forEach(detail => {
            let message = '';
            let isWarning = false;
            
            switch (detail.type) {
                case 'missing_accommodation_date':
                    message = `Chybí datum u ${detail.expense}`;
                    break;
                case 'missing_accommodation_facility':
                    message = `Chybí zařízení u ${detail.expense}`;
                    break;
                case 'missing_accommodation_place':
                    message = `Chybí místo u ${detail.expense}`;
                    break;
                case 'missing_accommodation_amount':
                    message = `Chybí částka u ${detail.expense}`;
                    break;
                case 'missing_accommodation_attachment':
                    message = `Chybí příloha u ${detail.expense} - nepřiložené doklady budete muset dodat dodatečně ke schválení výdaje`;
                    isWarning = true;
                    break;
                case 'missing_additional_expense_date':
                    message = `Chybí datum u ${detail.expense}`;
                    break;
                case 'missing_additional_expense_description':
                    message = `Chybí popis u ${detail.expense}`;
                    break;
                case 'missing_additional_expense_amount':
                    message = `Chybí částka u ${detail.expense}`;
                    break;
                case 'missing_additional_expense_attachment':
                    message = `Chybí příloha u ${detail.expense} - nepřiložené doklady budete muset dodat dodatečně ke schválení výdaje`;
                    isWarning = true;
                    break;
            }
            
            if (isWarning) {
                warnings.push({
                    type: detail.type,
                    message
                });
            } else {
                errors.push({
                    type: detail.type,
                    message
                });
            }
        });
    }
    
    // Validace minimálního počtu jízd za den
    const tripsValidation = validateMinimumTripsPerDay(formData, head);
    if (!tripsValidation.isValid) {
        tripsValidation.details.forEach(detail => {
            errors.push({
                type: 'minimum_trips',
                message: `Člen ${detail.member} má pouze ${detail.count} cest za den (vyžadovány minimálně 2)`
            });
        });
    }
    
    const isValid = errors.length === 0;
    const canComplete = errors.length === 0; // Varování neblokují dokončení
    
    return {
        isValid,
        canComplete,
        errors,
        warnings
    };
};

/**
 * Vytvoří uživatelsky přívětivé chybové zprávy
 */
export const extractValidationMessages = (validationResult) => {
    const messages = [];
    
    if (validationResult.errors) {
        validationResult.errors.forEach(error => {
            messages.push(error.message);
        });
    }
    
    if (validationResult.warnings) {
        validationResult.warnings.forEach(warning => {
            messages.push(warning.message);
        });
    }
    
    return messages;
};

/**
 * Validace části B formuláře
 * @param {Object} formData - Data formuláře
 * @param {Object} head - Hlavička příkazu
 * @param {Array} predmety - TIM předměty
 * @returns {Object} Výsledek validace
 */
export const validatePartB = (formData, head, predmety) => {
    const errors = [];
    const warnings = [];
    
    if (!head) {
        return {
            isValid: false,
            canComplete: false,
            errors: [{
                type: 'no_head_data',
                message: 'Chybí data hlavičky příkazu'
            }],
            warnings: []
        };
    }
    
    if (head.Druh_ZP === "O") {
        // Obnova - validace TIM položek
        validateTimItems(formData, predmety, errors, warnings);
    } else {
        // Ostatní typy - validace hlášení o činnosti
        validateActivityReport(formData, errors, warnings);
    }
    
    const isValid = errors.length === 0;
    const canComplete = errors.length === 0; // Varování neblokují dokončení
    
    return {
        isValid,
        canComplete,
        errors,
        warnings
    };
};

/**
 * Validace TIM položek pro obnovy
 */
const validateTimItems = (formData, predmety, errors, warnings) => {
    if (!predmety || predmety.length === 0) {
        warnings.push({
            type: 'no_tim_items',
            message: 'Nejsou k dispozici žádné TIM položky pro validaci'
        });
        return;
    }
    
    const stavyTim = formData.Stavy_Tim || {};
    let missingItems = 0;
    let incompleteItems = [];
    let totalItems = 0;
    
    // Nejprve seskupíme předměty podle TIM
    const timGroups = {};
    predmety.forEach(item => {
        if (!item.EvCi_TIM) return;
        if (!timGroups[item.EvCi_TIM]) {
            timGroups[item.EvCi_TIM] = [];
        }
        timGroups[item.EvCi_TIM].push(item);
    });
    
    // Validujeme každý TIM
    Object.entries(timGroups).forEach(([timId, items]) => {
        const timReport = stavyTim[timId];
        const predmetyInTim = timReport?.Predmety || {};
        
        items.forEach(item => {
            const itemId = item.ID_PREDMETY?.toString();
            if (!itemId) return;
            
            totalItems++;
            const itemStatus = predmetyInTim[itemId];
            
            // Required: Zachovalost (stav) - VŽDY povinné
            if (!itemStatus?.Zachovalost) {
                missingItems++;
                incompleteItems.push({
                    itemId,
                    timId,
                    predmet: item.Druh_Predmetu_Naz || 'Neznámý předmět',
                    missing: 'stav'
                });
                return; // Pokud chybí stav, nekontrolujeme další pole
            }
            
            // Conditional required fields based on item type and status
            const needsAdditionalData = itemStatus.Zachovalost && [1, 2].includes(parseInt(itemStatus.Zachovalost));
            const isArrow = item.Druh_Predmetu && 'S' === item.Druh_Predmetu.toUpperCase();
            const isSponzor = item.Druh_Predmetu && 'P' === item.Druh_Predmetu.toUpperCase();

            // Required: Rok_Vyroby (for items that need additional data)
            if (needsAdditionalData && !itemStatus.Rok_Vyroby && !isSponzor) {
                missingItems++;
                incompleteItems.push({
                    itemId,
                    timId,
                    predmet: item.Druh_Predmetu_Naz || 'Neznámý předmět',
                    missing: 'rok výroby'
                });
            }
            
            // Required: Smerovani (for arrows that need additional data)
            if (needsAdditionalData && isArrow && !itemStatus.Smerovani) {
                missingItems++;
                incompleteItems.push({
                    itemId,
                    timId,
                    predmet: item.Druh_Predmetu_Naz || 'Neznámý předmět',
                    missing: 'orientace směrovky'
                });
            }
        });
    });
    
    if (totalItems === 0) {
        warnings.push({
            type: 'no_tim_items_found',
            message: 'Nebyly nalezeny žádné TIM položky k validaci'
        });
        return;
    }
    
    if (missingItems > 0) {
        errors.push({
            type: 'incomplete_tim_items',
            message: `Neúplné údaje u ${missingItems} z ${totalItems} TIM položek`,
            details: incompleteItems
        });
    }
};

/**
 * Validace hlášení o činnosti pro ostatní typy příkazů
 */
const validateActivityReport = (formData, errors, warnings) => {
    // Required: Koment_Usek
    if (!formData.Koment_Usek || formData.Koment_Usek.trim().length === 0) {
        errors.push({
            type: 'missing_activity_report',
            message: 'Chybí hlášení o provedené činnosti'
        });
    } else if (formData.Koment_Usek.trim().length < 10) {
        warnings.push({
            type: 'short_activity_report',
            message: 'Hlášení o činnosti je velmi krátké - doporučujeme podrobnější popis'
        });
    }
    
    // Optional: Prilohy_Usek (attachments are not required but recommended)
    const attachments = formData.Prilohy_Usek || {};
    const attachmentCount = Object.keys(attachments).length;
    
    if (attachmentCount === 0) {
        warnings.push({
            type: 'missing_activity_attachments',
            message: 'Doporučuje se přiložit fotografie dokumentující provedenou činnost'
        });
    }
};