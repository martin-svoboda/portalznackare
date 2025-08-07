/**
 * Custom hook pro správu stavu formuláře
 * Encapsuluje komplexní formData logiku
 */

import { useState, useCallback } from 'react';

// Helper for creating empty travel segment
const createEmptyTravelSegment = () => ({
    id: crypto.randomUUID(),
    Datum: new Date(),
    Cas_Odjezdu: "",
    Cas_Prijezdu: "",
    Misto_Odjezdu: "",
    Misto_Prijezdu: "",
    Druh_Dopravy: "AUV",
    Kilometry: 0,
    Naklady: 0,
    Prilohy: {} // Changed from [] to {}
});

// Helper for creating empty travel group
const createEmptyTravelGroup = (Cestujci = []) => ({
    id: crypto.randomUUID(),
    Cestujci: Cestujci, // int_adr účastníků
    Ridic: null, // int_adr řidiče
    SPZ: "", // SPZ vozidla
    Cesty: [createEmptyTravelSegment()]
});

// Initial form state
const createInitialFormData = () => ({
    Skupiny_Cest: [createEmptyTravelGroup()],
    Zvysena_Sazba: false,
    Noclezne: [],
    Vedlejsi_Vydaje: [],
    Cast_A_Dokoncena: false,
    Cast_B_Dokoncena: false,
    Stavy_Tim: {},
    Koment_Usek: "",
    Prilohy_Usek: {}, // Changed from [] to {}
    Obnovene_Useky: {},
    Presmerovani_Vyplat: {},
    Status: 'draft'
});

export const useFormState = () => {
    const [formData, setFormData] = useState(createInitialFormData());

    // Helper function to update form data immutably
    const updateFormData = useCallback((updates) => {
        setFormData(prev => ({ ...prev, ...updates }));
    }, []);

    // Reset form to initial state
    const resetForm = useCallback(() => {
        setFormData(createInitialFormData());
    }, []);

    // Load form data from external source
    const loadFormData = useCallback((loadedData) => {
        setFormData(prev => ({ ...prev, ...loadedData }));
    }, []);

    return {
        formData,
        setFormData,
        updateFormData,
        resetForm,
        loadFormData
    };
};

// Export helper functions for use in components
export { createEmptyTravelSegment, createEmptyTravelGroup };