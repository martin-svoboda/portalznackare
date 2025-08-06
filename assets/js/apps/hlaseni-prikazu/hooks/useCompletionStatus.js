/**
 * Custom hook pro správu stavu dokončení formuláře
 * Spravuje validaci a auto-update completion status
 */

import { useMemo, useEffect, useCallback } from 'react';
import { validateAllTimItemsCompleted } from '../components/PartBForm';
import { extractTeamMembers } from '../utils/compensationCalculator';

export const useCompletionStatus = (formData, head, predmety, setFormData) => {
    // Validace minimálního počtu jízd za den pro každého člena
    const validateMinimumTripsPerDay = useCallback((formData, head) => {
        if (!formData.Skupiny_Cest || !head) return true;
        
        // Získat všechny členy týmu
        const teamMembers = extractTeamMembers(head);
        if (teamMembers.length === 0) return true;
        
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
                
                let segmentDate = segment.Datum || formData.Datum_Provedeni || new Date();
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
                    return false; // Člen nemá minimálně 2 jízdy za den
                }
            }
        }
        
        return true;
    }, []);

    // Automatic completion status for Part A
    const canCompletePartA = useMemo(() => {
        // Extraktovat všechny segmenty ze všech travel groups
        const allSegments = formData.Skupiny_Cest?.flatMap(group => group.Cesty || []) || [];
        
        const needsDriver = allSegments.some(segment =>
            segment && segment.Druh_Dopravy && (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z")
        );

        // Pro Skupiny_Cest kontrolujeme Ridic a SPZ v každé skupině
        const hasDriverForCar = needsDriver && formData.Skupiny_Cest?.some(group => 
            group.Cesty?.some(s => s.Druh_Dopravy === "AUV" || s.Druh_Dopravy === "AUV-Z") &&
            (!group.Ridic || !group.SPZ)
        );

        // Kontrola jízdenek - pro každý V segment musí mít každý cestující částku
        const hasTicketsForPublicTransport = formData.Skupiny_Cest?.some(group => {
            return group.Cesty?.some(segment => {
                if (segment.Druh_Dopravy !== "V") return false;
                
                // Pokud nejsou cestující, není co kontrolovat
                if (!group.Cestujci || group.Cestujci.length === 0) return false;
                
                // Kontrola že má každý cestující vyplněnou částku
                if (typeof segment.Naklady !== 'object' || !segment.Naklady) {
                    return true; // Chybí objekt s náklady
                }
                
                // Kontrola že každý cestující má částku > 0
                const missingTicket = group.Cestujci.some(intAdr => 
                    !(segment.Naklady[intAdr] > 0)
                );
                
                // Také kontrolovat přílohy
                const missingAttachments = !segment.Prilohy || segment.Prilohy.length === 0;
                
                return missingTicket || missingAttachments;
            });
        }) || false;

        const hasDocumentsForExpenses = [
            ...(formData.Noclezne || []),
            ...(formData.Vedlejsi_Vydaje || [])
        ].some(expense => expense.Prilohy && expense.Prilohy.length === 0);

        // Validace minimálního počtu jízd za den
        const hasMinimumTripsPerDay = validateMinimumTripsPerDay(formData, head);

        return !hasDriverForCar && !hasTicketsForPublicTransport && !hasDocumentsForExpenses && hasMinimumTripsPerDay;
    }, [formData, head, validateMinimumTripsPerDay]);

    // Automatic completion status for Part B
    const canCompletePartB = useMemo(() => {
        if (head?.Druh_ZP === "O") {
            // For renovation orders, require ALL TIM items to have status filled
            return validateAllTimItemsCompleted(predmety, formData.Stavy_Tim);
        } else {
            // For other types, require filled comment
            return formData.Koment_Usek.trim().length > 0;
        }
    }, [formData.Stavy_Tim, formData.Koment_Usek, head?.Druh_ZP, predmety]);

    // Auto-update completion status for Part A
    useEffect(() => {
        if (canCompletePartA !== formData.Cast_A_Dokoncena) {
            setFormData(prev => ({...prev, Cast_A_Dokoncena: canCompletePartA}));
        }
    }, [canCompletePartA, formData.Cast_A_Dokoncena, setFormData]);

    // Auto-update completion status for Part B
    useEffect(() => {
        if (canCompletePartB !== formData.Cast_B_Dokoncena) {
            setFormData(prev => ({...prev, Cast_B_Dokoncena: canCompletePartB}));
        }
    }, [canCompletePartB, formData.Cast_B_Dokoncena, setFormData]);

    // Check if form can be submitted
    const canSubmit = useMemo(() => {
        return formData.Cast_A_Dokoncena && formData.Cast_B_Dokoncena;
    }, [formData.Cast_A_Dokoncena, formData.Cast_B_Dokoncena]);

    // Get completion validation messages
    const getValidationMessages = useCallback(() => {
        const messages = [];

        if (!canCompletePartA) {
            // Detailní kontrola pro část A
            const allSegments = formData.Skupiny_Cest?.flatMap(group => group.Cesty || []) || [];
            
            const needsDriver = allSegments.some(segment =>
                segment && segment.Druh_Dopravy && (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z")
            );
            
            const hasDriverForCar = needsDriver && formData.Skupiny_Cest?.some(group => 
                group.Cesty?.some(s => s.Druh_Dopravy === "AUV" || s.Druh_Dopravy === "AUV-Z") &&
                (!group.Ridic || !group.SPZ)
            );
            
            const hasTicketsForPublicTransport = allSegments.some(segment =>
                segment && segment.Druh_Dopravy === "V" && (!segment.Prilohy || segment.Prilohy.length === 0)
            );
            
            const hasDocumentsForExpenses = [
                ...(formData.Noclezne || []),
                ...(formData.Vedlejsi_Vydaje || [])
            ].some(expense => expense.Prilohy && expense.Prilohy.length === 0);
            
            const hasMinimumTripsPerDay = validateMinimumTripsPerDay(formData, head);
            
            if (hasDriverForCar) {
                messages.push("Chybí řidič nebo SPZ u cesty autem");
            }
            if (hasTicketsForPublicTransport) {
                messages.push("Chybí ceny jízdenek pro všechny cestující nebo přílohy u veřejné dopravy");
            }
            if (hasDocumentsForExpenses) {
                messages.push("Chybí přílohy k výdajům nebo ubytování");
            }
            if (!hasMinimumTripsPerDay) {
                messages.push("Každý člen musí mít minimálně 2 jízdy za den (počáteční a konečnou)");
            }
        }

        if (!canCompletePartB) {
            if (head?.Druh_ZP === "O") {
                messages.push("Všechny TIM položky musí mít vyplněný stav");
            } else {
                messages.push("Hlášení o činnosti musí být vyplněno");
            }
        }

        return messages;
    }, [canCompletePartA, canCompletePartB, head?.Druh_ZP, formData, validateMinimumTripsPerDay]);

    return {
        canCompletePartA,
        canCompletePartB,
        canSubmit,
        getValidationMessages,
        partACompleted: formData.Cast_A_Dokoncena,
        partBCompleted: formData.Cast_B_Dokoncena
    };
};