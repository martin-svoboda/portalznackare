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
    calculateCompensationForAllMembers,
    extractTeamMembers
} from '../utils/compensationCalculator';

export const useFormSaving = (formData, head, prikazId, priceList, isLeader, teamMembers, currentUser) => {
    const [saving, setSaving] = useState(false);

    // Handle save operation
    const handleSave = useCallback(async (final = false) => {
        setSaving(true);

        try {
            // Fallback pro teamMembers - pokud jsou prázdné, vytvoř je z head dat
            const finalTeamMembers = teamMembers.length > 0 
                ? teamMembers 
                : head ? extractTeamMembers(head).map(member => ({
                    int_adr: member.intAdr,
                    jmeno: member.name,
                    je_vedouci: member.isLeader,
                    data_a: {},
                    data_b: {}
                })) : [];

            const data = {
                id_zp: prikazId,
                cislo_zp: head?.Cislo_ZP || '',
                team_members: finalTeamMembers,
                data_a: {
                    executionDate: formData.executionDate,
                    travelGroups: formData.travelGroups?.filter(group => group && group.id) || [],
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