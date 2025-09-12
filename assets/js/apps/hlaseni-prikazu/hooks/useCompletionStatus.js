/**
 * Custom hook pro správu stavu dokončení formuláře
 * Spravuje validaci a auto-update completion status
 */

import { useMemo, useEffect, useCallback } from 'react';
import { validatePartA, validatePartB, extractValidationMessages } from '../utils/validationUtils';

export const useCompletionStatus = (formData, head, predmety, setFormData) => {
    // Validační výsledek pro část A pomocí centralizované validace
    const partAValidation = useMemo(() => {
        return validatePartA(formData, head);
    }, [formData, head]);

    // Automatic completion status for Part A
    const canCompletePartA = useMemo(() => {
        return partAValidation.canComplete;
    }, [partAValidation]);

    // Validační výsledek pro část B pomocí centralizované validace
    const partBValidation = useMemo(() => {
        return validatePartB(formData, head, predmety);
    }, [formData, head, predmety]);

    // Automatic completion status for Part B
    const canCompletePartB = useMemo(() => {
        return partBValidation.canComplete;
    }, [partBValidation]);

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

        // Zprávy pro část A z centralizované validace
        if (!canCompletePartA) {
            const partAMessages = extractValidationMessages(partAValidation);
            messages.push(...partAMessages);
        }

        // Zprávy pro část B z centralizované validace
        if (!canCompletePartB) {
            const partBMessages = extractValidationMessages(partBValidation);
            messages.push(...partBMessages);
        }

        return messages;
    }, [canCompletePartA, canCompletePartB, head?.Druh_ZP, partAValidation]);

    return {
        canCompletePartA,
        canCompletePartB,
        canSubmit,
        getValidationMessages,
        partAValidation,
        partBValidation,
        partACompleted: formData.Cast_A_Dokoncena,
        partBCompleted: formData.Cast_B_Dokoncena
    };
};