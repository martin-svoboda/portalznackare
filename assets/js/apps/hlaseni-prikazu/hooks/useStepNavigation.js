/**
 * Custom hook pro správu navigace mezi kroky
 * Spravuje aktivní krok a URL parametry
 */

import { useState, useCallback } from 'react';

export const useStepNavigation = () => {
    // Get step from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const stepParam = urlParams.get('step');
    const initialStep = stepParam ? parseInt(stepParam, 10) : 0;
    const validStep = isNaN(initialStep) || initialStep < 0 || initialStep > 2 ? 0 : initialStep;

    const [activeStep, setActiveStep] = useState(validStep);

    // Handle step change with URL update
    const changeStep = useCallback((step) => {
        setActiveStep(step);
        const url = new URL(window.location);
        if (step === 0) {
            url.searchParams.delete('step');
        } else {
            url.searchParams.set('step', step.toString());
        }
        window.history.replaceState(null, '', url);
    }, []);

    // Navigation helpers
    const goToNextStep = useCallback(() => {
        if (activeStep < 2) {
            changeStep(activeStep + 1);
        }
    }, [activeStep, changeStep]);

    const goToPreviousStep = useCallback(() => {
        if (activeStep > 0) {
            changeStep(activeStep - 1);
        }
    }, [activeStep, changeStep]);

    const goToStep = useCallback((step) => {
        if (step >= 0 && step <= 2) {
            changeStep(step);
        }
    }, [changeStep]);

    return {
        activeStep,
        changeStep,
        goToNextStep,
        goToPreviousStep,
        goToStep,
        isFirstStep: activeStep === 0,
        isLastStep: activeStep === 2,
        canGoNext: activeStep < 2,
        canGoPrevious: activeStep > 0
    };
};