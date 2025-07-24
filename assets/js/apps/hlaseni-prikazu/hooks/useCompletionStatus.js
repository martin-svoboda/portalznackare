/**
 * Custom hook pro správu stavu dokončení formuláře
 * Spravuje validaci a auto-update completion status
 */

import { useMemo, useEffect, useCallback } from 'react';
import { validateAllTimItemsCompleted } from '../components/PartBForm';

export const useCompletionStatus = (formData, head, predmety, setFormData) => {
    // Automatic completion status for Part A
    const canCompletePartA = useMemo(() => {
        const needsDriver = formData.travelSegments.some(segment =>
            segment && segment.transportType && (segment.transportType === "AUV" || segment.transportType === "AUV-Z")
        );

        const hasDriverForCar = needsDriver && (!formData.primaryDriver || !formData.vehicleRegistration);

        const hasTicketsForPublicTransport = formData.travelSegments.some(segment =>
            segment && segment.transportType === "veřejná doprava" && (!segment.attachments || segment.attachments.length === 0)
        );

        const hasDocumentsForExpenses = [
            ...formData.accommodations,
            ...formData.additionalExpenses
        ].some(expense => expense.attachments && expense.attachments.length === 0);

        return !hasDriverForCar && !hasTicketsForPublicTransport && !hasDocumentsForExpenses;
    }, [formData]);

    // Automatic completion status for Part B
    const canCompletePartB = useMemo(() => {
        if (head?.Druh_ZP === "O") {
            // For renovation orders, require ALL TIM items to have status filled
            return validateAllTimItemsCompleted(predmety, formData.timReports);
        } else {
            // For other types, require filled comment
            return formData.routeComment.trim().length > 0;
        }
    }, [formData.timReports, formData.routeComment, head?.Druh_ZP, predmety]);

    // Auto-update completion status for Part A
    useEffect(() => {
        if (canCompletePartA !== formData.partACompleted) {
            setFormData(prev => ({...prev, partACompleted: canCompletePartA}));
        }
    }, [canCompletePartA, formData.partACompleted, setFormData]);

    // Auto-update completion status for Part B
    useEffect(() => {
        if (canCompletePartB !== formData.partBCompleted) {
            setFormData(prev => ({...prev, partBCompleted: canCompletePartB}));
        }
    }, [canCompletePartB, formData.partBCompleted, setFormData]);

    // Check if form can be submitted
    const canSubmit = useMemo(() => {
        return formData.partACompleted && formData.partBCompleted;
    }, [formData.partACompleted, formData.partBCompleted]);

    // Get completion validation messages
    const getValidationMessages = useCallback(() => {
        const messages = [];

        if (!canCompletePartA) {
            messages.push("Část A není kompletně vyplněna");
        }

        if (!canCompletePartB) {
            if (head?.Druh_ZP === "O") {
                messages.push("Všechny TIM položky musí mít vyplněný stav");
            } else {
                messages.push("Hlášení o činnosti musí být vyplněno");
            }
        }

        return messages;
    }, [canCompletePartA, canCompletePartB, head?.Druh_ZP]);

    return {
        canCompletePartA,
        canCompletePartB,
        canSubmit,
        getValidationMessages,
        partACompleted: formData.partACompleted,
        partBCompleted: formData.partBCompleted
    };
};