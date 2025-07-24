/**
 * Custom hook pro správu stavu formuláře
 * Encapsuluje komplexní formData logiku
 */

import { useState, useCallback } from 'react';

// Helper for creating empty travel segment
const createEmptyTravelSegment = () => ({
    id: crypto.randomUUID(),
    date: new Date(),
    startTime: "",
    endTime: "",
    startPlace: "",
    endPlace: "",
    transportType: "AUV",
    kilometers: 0,
    ticketCosts: 0,
    attachments: []
});

// Initial form state
const createInitialFormData = () => ({
    executionDate: new Date(),
    travelSegments: [createEmptyTravelSegment()],
    primaryDriver: "",
    vehicleRegistration: "",
    higherKmRate: false,
    accommodations: [],
    additionalExpenses: [],
    partACompleted: false,
    partBCompleted: false,
    timReports: {},
    routeComment: "",
    routeAttachments: [],
    paymentRedirects: {},
    status: 'draft'
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