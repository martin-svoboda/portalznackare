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

// Helper functions for date/time formatting
const formatDateOnly = (date) => {
    if (!date) return null;
    if (typeof date === 'string') {
        // If already in correct format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
        date = new Date(date);
    }
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;
    
    // Format as yyyy-mm-dd without timezone conversion
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatTimeOnly = (time) => {
    if (!time) return null;
    // If already in HH:mm format, return as is
    if (/^\d{2}:\d{2}$/.test(time)) return time;
    // Remove seconds if present
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time.substring(0, 5);
    return time;
};

// Clean serialization functions - save only relevant data from current form state
const serializeTravelSegment = (segment) => {
    const cleanSegment = {
        id: segment.id,
        Datum: formatDateOnly(segment.Datum),
        Cas_Odjezdu: formatTimeOnly(segment.Cas_Odjezdu),
        Cas_Prijezdu: formatTimeOnly(segment.Cas_Prijezdu),
        Misto_Odjezdu: segment.Misto_Odjezdu,
        Misto_Prijezdu: segment.Misto_Prijezdu,
        Druh_Dopravy: segment.Druh_Dopravy
    };

    // Add transport-specific fields based on current transport type
    if (segment.Druh_Dopravy === "AUV" || segment.Druh_Dopravy === "AUV-Z") {
        // Uložit pouze pokud má hodnotu
        if (segment.Kilometry !== undefined && segment.Kilometry > 0) {
            cleanSegment.Kilometry = segment.Kilometry;
        }
    } else if (segment.Druh_Dopravy === "V") {
        // Uložit pouze pokud je objekt s hodnotami
        if (typeof segment.Naklady === 'object' && segment.Naklady !== null) {
            // Vyfiltrovat prázdné hodnoty
            const filteredNaklady = {};
            Object.entries(segment.Naklady).forEach(([intAdr, value]) => {
                if (value > 0) {
                    filteredNaklady[intAdr] = value;
                }
            });
            if (Object.keys(filteredNaklady).length > 0) {
                cleanSegment.Naklady = filteredNaklady;
            }
        }
        cleanSegment.Prilohy = segment.Prilohy || [];
    }
    // For "P" (walking) and "K" (bike) - no additional fields needed

    return cleanSegment;
};

const serializeTravelGroup = (group) => {
    return {
        id: group.id,
        Cestujci: group.Cestujci || [],
        Ridic: group.Ridic || null,
        spz: group.spz || "",
        Ma_Zvysenou_Sazbu: group.Ma_Zvysenou_Sazbu || false,
        Cesty: (group.Cesty || []).map(serializeTravelSegment)
    };
};

const serializeAccommodation = (accommodation) => {
    return {
        id: accommodation.id,
        Misto: accommodation.Misto || "",
        Zarizeni: accommodation.Zarizeni || "",
        Datum: formatDateOnly(accommodation.Datum),
        Castka: accommodation.Castka || 0,
        Zaplatil: accommodation.Zaplatil || "",
        Prilohy: accommodation.Prilohy || []
    };
};

const serializeExpense = (expense) => {
    return {
        id: expense.id,
        Polozka: expense.Polozka || "",
        Castka: expense.Castka || 0,
        Zaplatil: expense.Zaplatil || "",
        Datum: formatDateOnly(expense.Datum),
        Prilohy: expense.Prilohy || []
    };
};

const serializeTeamMember = (member) => {
    return {
        index: member.index,
        Znackar: member.name || member.Znackar || "",
        INT_ADR: member.INT_ADR,
        Je_Vedouci: member.isLeader || member.Je_Vedouci || false
    };
};

export const useFormSaving = (formData, head, prikazId, priceList, isLeader, teamMembers, currentUser) => {
    const [saving, setSaving] = useState(false);

    // Handle save operation
    const handleSave = useCallback(async (final = false) => {
        setSaving(true);

        try {
            // Fallback pro teamMembers - pokud jsou prázdné, vytvoř je z head dat
            const rawTeamMembers = teamMembers.length > 0 
                ? teamMembers 
                : head ? extractTeamMembers(head) : [];

            const data = {
                id_zp: prikazId,
                cislo_zp: head?.Cislo_ZP || '',
                znackari: rawTeamMembers.map(serializeTeamMember),
                data_a: {
                    Datum_Provedeni: formatDateOnly(formData.Datum_Provedeni),
                    Skupiny_Cest: (formData.Skupiny_Cest || [])
                        .filter(group => group && group.id)
                        .map(serializeTravelGroup),
                    Zvysena_Sazba: formData.Zvysena_Sazba || false,
                    Noclezne: (formData.Noclezne || [])
                        .filter(accommodation => accommodation && accommodation.id)
                        .map(serializeAccommodation),
                    Vedlejsi_Vydaje: (formData.Vedlejsi_Vydaje || [])
                        .filter(expense => expense && expense.id)
                        .map(serializeExpense),
                    Cast_A_Dokoncena: formData.Cast_A_Dokoncena || false,
                    Presmerovani_Vyplat: formData.Presmerovani_Vyplat || {}
                },
                data_b: {
                    Stavy_Tim: formData.Stavy_Tim,
                    Koment_Usek: formData.Koment_Usek,
                    Prilohy_Usek: formData.Prilohy_Usek,
                    Souhlasi_Mapa: formData.Souhlasi_Mapa,
                    Koment_Mapa: formData.Koment_Mapa,
                    Prilohy_Mapa: formData.Prilohy_Mapa,
                    Cast_B_Dokoncena: formData.Cast_B_Dokoncena
                },
                calculation: (() => {
                    if (!priceList) return {};
                    
                    if (isLeader && teamMembers.length > 0) {
                        // Vedoucí - výpočet pro všechny členy týmu
                        return calculateCompensationForAllMembers(
                            formData,
                            priceList,
                            teamMembers
                        );
                    } else if (currentUser) {
                        // Člen - výpočet jen pro sebe
                        const compensation = calculateCompensation(
                            formData,
                            priceList,
                            currentUser.INT_ADR
                        );
                        
                        // Vrátit ve formátu {INT_ADR: compensation} pro konzistenci
                        return compensation ? { [currentUser.INT_ADR]: compensation } : {};
                    }
                    
                    return {};
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