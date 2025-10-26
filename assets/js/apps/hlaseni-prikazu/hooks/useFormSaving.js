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
    extractTeamMembers,
    calculateExecutionDate
} from '../utils/compensationCalculator';
import { convertAttachmentsToIds } from '../utils/attachmentUtils';

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
        cleanSegment.Prilohy = convertAttachmentsToIds(segment.Prilohy || {});
    }
    // For "P" (walking) and "K" (bike) - no additional fields needed

    return cleanSegment;
};

const serializeTravelGroup = (group) => {
    return {
        id: group.id,
        Cestujci: group.Cestujci || [],
        Ridic: group.Ridic || null,
        SPZ: group.SPZ || "",
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
        Prilohy: convertAttachmentsToIds(accommodation.Prilohy || {})
    };
};

const serializeExpense = (expense) => {
    return {
        id: expense.id,
        Polozka: expense.Polozka || "",
        Castka: expense.Castka || 0,
        Zaplatil: expense.Zaplatil || "",
        Datum: formatDateOnly(expense.Datum),
        Prilohy: convertAttachmentsToIds(expense.Prilohy || {})
    };
};

const serializeTeamMember = (member) => {
    const serialized = {
        index: member.index,
        Znackar: member.name || member.Znackar || "",
        INT_ADR: member.INT_ADR,
        Je_Vedouci: member.isLeader || member.Je_Vedouci || member.je_vedouci || false
    };
    return serialized;
};

export const useFormSaving = (formData, head, prikazId, reportLoaded = false, usersDetails, tariffRates, isLeader, teamMembers, currentUser) => {
    const [saving, setSaving] = useState(false);

    // Handle save operation
    const handleSave = useCallback(async (final = false, silent = false) => {
        // Ochrana proti přepsání dat před jejich načtením
        if (!reportLoaded) {
            log.error('Pokus o uložení před načtením existujících dat - blokováno');
            return false;
        }

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
                    Datum_Provedeni: formatDateOnly(calculateExecutionDate(formData)),
                    Skupiny_Cest: (formData.Skupiny_Cest || [])
                        .filter(group => group && group.id)
                        .map(serializeTravelGroup),
                    Zvysena_Sazba: formData.Zvysena_Sazba || false,
                    Hlavni_Ridic: formData.Hlavni_Ridic || null,
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
                    Stavy_Tim: (() => {
                        const serializedStavyTim = {};
                        Object.entries(formData.Stavy_Tim || {}).forEach(([timId, timReport]) => {
                            serializedStavyTim[timId] = {
                                ...timReport,
                                Prilohy_NP: convertAttachmentsToIds(timReport.Prilohy_NP || {}),
                                Prilohy_TIM: convertAttachmentsToIds(timReport.Prilohy_TIM || {}),
                                // Serialize Predmety attachments if they exist
                                Predmety: (() => {
                                    if (!timReport.Predmety || typeof timReport.Predmety !== 'object') {
                                        return timReport.Predmety || {};
                                    }
                                    
                                    const serializedPredmety = {};
                                    Object.entries(timReport.Predmety).forEach(([predmetId, predmet]) => {
                                        serializedPredmety[predmetId] = {
                                            ...predmet,
                                        };
                                    });
                                    return serializedPredmety;
                                })()
                            };
                        });
                        return serializedStavyTim;
                    })(),
                    Koment_Usek: formData.Koment_Usek,
                    Prilohy_Usek: convertAttachmentsToIds(formData.Prilohy_Usek || {}),
                    Obnovene_Useky: formData.Obnovene_Useky || {},
                    Souhlasi_Mapa: formData.Souhlasi_Mapa,
                    Souhlasi_Mapy_com: formData.Souhlasi_Mapy_com,
                    Koment_Mapa: formData.Koment_Mapa,
                    Prilohy_Mapa: convertAttachmentsToIds(formData.Prilohy_Mapa || {}),
                    Cast_B_Dokoncena: formData.Cast_B_Dokoncena
                },
                calculation: (() => {
                    // Ukládat výpočty může jen vedoucí pro všechny členy
                    if (isLeader && teamMembers.length > 0 && tariffRates) {
                        const result = calculateCompensationForAllMembers(
                            formData,
                            tariffRates,
                            teamMembers,
                            usersDetails
                        );
                        return result;
                    }
                    return {};
                })(),
                state: final ? 'send' : 'draft'
            };

            log.info(`Ukládání hlášení pro příkaz ${prikazId}`, { final, dataSize: JSON.stringify(data).length });

            // Pro automatické ukládání potlačit notifikace
            await api.prikazy.saveReport(data, silent ? {
                showSuccess: false,
                showError: true // Chyby vždy zobrazit
            } : undefined);

            log.info(final ? 'Hlášení odesláno' : 'Hlášení uloženo');

            if (final) {
                showNotification('success', 'Hlášení bylo úspěšně odesláno', {
                    title: 'Odesláno',
                    duration: 3000
                });
                // Redirect to prikaz detail
                setTimeout(() => {
                    window.location.href = `/prikaz/${prikazId}`;
                }, 1000);
            }

            return true;
        } catch (error) {
            log.error('Chyba při ukládání hlášení', error);
            
            // Detailní zpracování chyb pro uživatele
            let errorMessage = 'Chyba při ukládání hlášení';
            let errorType = 'error';
            let errorTitle = 'Ukládání selhalo';
            let errorDuration = 0; // Error toasty se nezavírají automaticky
            
            if (error.status) {
                switch (error.status) {
                    case 400:
                        errorMessage = 'Neplatná data v hlášení. Zkontrolujte všechny povinné údaje.';
                        errorType = 'warning';
                        errorTitle = 'Neplatná data';
                        errorDuration = 8000;
                        break;
                    case 409:
                        errorMessage = 'Hlášení už bylo odesláno a je v procesu zpracování.';
                        errorType = 'info';
                        errorTitle = 'Již odesláno';
                        errorDuration = 6000;
                        break;
                    case 503:
                        errorMessage = 'Služba je dočasně nedostupná. Zkuste to za chvíli.';
                        errorType = 'warning';
                        errorTitle = 'Služba nedostupná';
                        errorDuration = 10000;
                        break;
                    case 500:
                        errorMessage = 'Vnitřní chyba serveru. Kontaktujte administrátora.';
                        errorTitle = 'Chyba serveru';
                        break;
                    default:
                        errorMessage = `Chyba při komunikaci se serverem (${error.status})`;
                        errorTitle = 'Chyba komunikace';
                }
            } else if (error.message) {
                errorMessage = error.message;
                errorTitle = error.title || errorTitle;
            }
            
            showNotification(errorType, errorMessage, {
                title: errorTitle,
                duration: errorDuration
            });
            return false;
        } finally {
            setSaving(false);
        }
    }, [
        formData,
        head,
        prikazId,
        usersDetails,
        tariffRates,
        isLeader,
        teamMembers,
        currentUser,
        reportLoaded
    ]);

    // Save as draft - s podporou pro automatické ukládání
    const saveDraft = useCallback(async (isAutoSave = false) => {
        // Pro automatické ukládání použít silent mode (bez notifikací)
        const success = await handleSave(false, isAutoSave);
        return success;
    }, [handleSave]);

    // Submit final report (old method - still used for final submission after validation)
    const submitReport = useCallback(() => {
        return handleSave(true);
    }, [handleSave]);

    // Submit for approval - saves with 'send' status and triggers background processing
    const submitForApproval = useCallback(async (setFormData) => {
        // Ochrana proti přepsání dat před jejich načtením
        if (!reportLoaded) {
            log.error('Pokus o uložení před načtením existujících dat - blokováno');
            return false;
        }

        setSaving(true);

        // Timeout protection - 45 sekund
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            log.error('API call timeout po 45 sekundách');
        }, 45000);

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
                    Datum_Provedeni: formatDateOnly(calculateExecutionDate(formData)),
                    Skupiny_Cest: (formData.Skupiny_Cest || [])
                        .filter(group => group && group.id)
                        .map(serializeTravelGroup),
                    Zvysena_Sazba: formData.Zvysena_Sazba || false,
                    Hlavni_Ridic: formData.Hlavni_Ridic || null,
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
                    Stavy_Tim: (() => {
                        const serializedStavyTim = {};
                        Object.entries(formData.Stavy_Tim || {}).forEach(([timId, timReport]) => {
                            serializedStavyTim[timId] = {
                                ...timReport,
                                Prilohy_NP: convertAttachmentsToIds(timReport.Prilohy_NP || {}),
                                Prilohy_TIM: convertAttachmentsToIds(timReport.Prilohy_TIM || {}),
                                // Serialize Predmety attachments if they exist
                                Predmety: (() => {
                                    if (!timReport.Predmety || typeof timReport.Predmety !== 'object') {
                                        return timReport.Predmety || {};
                                    }
                                    
                                    const serializedPredmety = {};
                                    Object.entries(timReport.Predmety).forEach(([predmetId, predmet]) => {
                                        serializedPredmety[predmetId] = {
                                            ...predmet
                                        };
                                    });
                                    return serializedPredmety;
                                })()
                            };
                        });
                        return serializedStavyTim;
                    })(),
                    Koment_Usek: formData.Koment_Usek,
                    Prilohy_Usek: convertAttachmentsToIds(formData.Prilohy_Usek || {}),
                    Obnovene_Useky: formData.Obnovene_Useky || {},
                    Souhlasi_Mapa: formData.Souhlasi_Mapa,
                    Souhlasi_Mapy_com: formData.Souhlasi_Mapy_com,
                    Koment_Mapa: formData.Koment_Mapa,
                    Prilohy_Mapa: convertAttachmentsToIds(formData.Prilohy_Mapa || {}),
                    Cast_B_Dokoncena: formData.Cast_B_Dokoncena
                },
                calculation: (() => {
                    // Ukládat výpočty může jen vedoucí pro všechny členy
                    if (isLeader && teamMembers.length > 0 && tariffRates) {
                        const result = calculateCompensationForAllMembers(
                            formData,
                            tariffRates,
                            teamMembers,
                            usersDetails
                        );
                        return result;
                    }
                    return {};
                })(),
                state: 'send' // Nastavit send hned - při chybě se změní zpět na draft
            };

            log.info(`Odesílání hlášení ke schválení pro příkaz ${prikazId}`, { 
                dataSize: JSON.stringify(data).length,
                state: data.state,
                endpoint: 'POST /portal/report'
            });

            const response = await api.prikazy.saveReport(data, { 
                signal: controller.signal,
                timeout: 45000 
            });
            
            // Zrušit timeout pokud call proběhl úspěšně
            clearTimeout(timeoutId);
            
            log.info('Response from saveReport:', response);

            log.info('Hlášení odesláno do INSYZ - čeká na zpracování');
            showNotification('success', 'Hlášení bylo odesláno do INSYZ a nyní se zpracovává');

            // Okamžitě aktualizuj stav v UI
            if (setFormData && response.success) {
                setFormData(prev => ({
                    ...prev,
                    status: 'send',
                    date_send: new Date().toISOString(),
                    // Vymaž případné staré chyby
                    error_message: undefined,
                    error_code: undefined,
                    error_details: undefined
                }));
            }

            return true;
        } catch (error) {
            // Vždy zrušit timeout
            clearTimeout(timeoutId);
            
            log.error('Chyba při odesílání ke schválení', error);
            
            // Detailní zpracování chyb pro uživatele
            let errorMessage = 'Chyba při odesílání ke schválení';
            let errorType = 'error';
            
            // Timeout specifické zpracování
            if (error.name === 'AbortError') {
                errorMessage = 'Odesílání trvá déle než obvykle. Zkontrolujte stav hlášení za chvíli nebo zkuste odeslat znovu.';
                errorType = 'warning';
            } else if (error.status) {
                switch (error.status) {
                    case 400:
                        errorMessage = 'Neplatná data v hlášení. Zkontrolujte všechny povinné údaje před odesláním.';
                        errorType = 'warning';
                        break;
                    case 408:
                        errorMessage = 'Požadavek vypršel. Server zpracovává hlášení na pozadí - zkontrolujte stav za chvíli.';
                        errorType = 'warning';
                        break;
                    case 409:
                        errorMessage = 'Hlášení už bylo odesláno a je v procesu zpracování.';
                        errorType = 'info';
                        break;
                    case 422:
                        errorMessage = 'Hlášení obsahuje neplatné údaje. Zkontrolujte všechny vyplněné hodnoty.';
                        errorType = 'warning';
                        break;
                    case 429:
                        errorMessage = 'Příliš mnoho požadavků. Počkejte chvíli a zkuste to znovu.';
                        errorType = 'warning';
                        break;
                    case 500:
                        errorMessage = 'Vnitřní chyba serveru. Hlášení může být zpracováváno na pozadí - zkontrolujte stav za chvíli.';
                        errorType = 'warning';
                        break;
                    case 502:
                    case 503:
                    case 504:
                        errorMessage = 'Server je dočasně nedostupný. Zkuste to za 1-2 minuty.';
                        errorType = 'warning';
                        break;
                    default:
                        errorMessage = `Komunikační chyba (${error.status}). Zkuste to za chvíli nebo kontaktujte podporu.`;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            showNotification(errorType, errorMessage);
            
            // Uložit chybové informace do formData a vrátit stav na draft
            if (setFormData) {
                setFormData(prev => ({
                    ...prev,
                    status: 'draft', // Vrátit na draft aby šlo odeslat znovu
                    error_message: errorMessage,
                    error_code: error.errorCode || 'UNKNOWN_ERROR',
                    error_details: error.details
                }));
            }
            
            return false;
        } finally {
            setSaving(false);
        }
    }, [
        formData,
        head,
        prikazId,
        usersDetails,
        tariffRates,
        isLeader,
        teamMembers,
        currentUser,
        reportLoaded
    ]);

    return {
        saving,
        handleSave,
        saveDraft,
        submitReport,
        submitForApproval
    };
};