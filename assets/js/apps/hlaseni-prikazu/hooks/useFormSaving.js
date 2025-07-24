/**
 * Custom hook pro správu ukládání formuláře
 * Spravuje save/submit operace a loading state
 */

import { useState, useCallback } from 'react';
import { api } from '../../../utils/api';
import { log } from '../../../utils/debug';
import { showNotification } from '../../../utils/notifications';
import {
    calculateCompensation,
    calculateCompensationForAllMembers
} from '../utils/compensationCalculator';

export const useFormSaving = (formData, head, prikazId, priceList, isLeader, teamMembers, currentUser) => {
    const [saving, setSaving] = useState(false);

    // Handle save operation
    const handleSave = useCallback(async (final = false) => {
        setSaving(true);

        try {
            const data = {
                id_zp: prikazId,
                cislo_zp: head?.Cislo_ZP || '',
                je_vedouci: isLeader,
                data_a: {
                    executionDate: formData.executionDate,
                    travelSegments: formData.travelSegments.filter(segment => segment && segment.id),
                    primaryDriver: formData.primaryDriver,
                    vehicleRegistration: formData.vehicleRegistration,
                    higherKmRate: formData.higherKmRate,
                    accommodations: formData.accommodations,
                    additionalExpenses: formData.additionalExpenses,
                    partACompleted: formData.partACompleted,
                    paymentRedirects: formData.paymentRedirects
                },
                data_b: {
                    timReports: formData.timReports,
                    routeComment: formData.routeComment,
                    routeAttachments: formData.routeAttachments,
                    partBCompleted: formData.partBCompleted
                },
                calculation: (() => {
                    if (!priceList) return {};
                    
                    if (isLeader && teamMembers.length > 0) {
                        return calculateCompensationForAllMembers(
                            formData,
                            priceList,
                            teamMembers,
                            formData.primaryDriver,
                            formData.higherKmRate
                        );
                    } else {
                        const isCurrentUserDriver = currentUser && formData.primaryDriver === currentUser.INT_ADR;
                        return calculateCompensation(
                            formData,
                            priceList,
                            isCurrentUserDriver,
                            formData.higherKmRate,
                            currentUser?.INT_ADR
                        ) || {};
                    }
                })(),
                state: final ? 'send' : 'draft'
            };

            log.info(`Ukládání hlášení pro příkaz ${prikazId}`, { final, dataSize: JSON.stringify(data).length });

            await api.prikazy.saveReport(data);

            log.info(final ? 'Hlášení odesláno' : 'Hlášení uloženo');

            if (final) {
                showNotification('success', 'Hlášení bylo úspěšně odesláno');
                // Redirect to prikaz detail
                window.location.href = `/prikaz/${prikazId}`;
            } else {
                showNotification('success', 'Hlášení bylo uloženo');
            }

            return true;
        } catch (error) {
            log.error('Chyba při ukládání hlášení', error);
            // Error notification is handled by api.js
            return false;
        } finally {
            setSaving(false);
        }
    }, [
        formData, 
        head, 
        prikazId, 
        priceList, 
        isLeader, 
        teamMembers, 
        currentUser
    ]);

    // Save as draft
    const saveDraft = useCallback(() => {
        return handleSave(false);
    }, [handleSave]);

    // Submit final report
    const submitReport = useCallback(() => {
        return handleSave(true);
    }, [handleSave]);

    return {
        saving,
        handleSave,
        saveDraft,
        submitReport
    };
};