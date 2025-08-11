/**
 * Custom hook pro správu navigace mezi kroky
 * Spravuje aktivní krok a URL parametry
 */

import { useState, useCallback } from 'react';

export const useStepNavigation = () => {
    // Map step names to numbers
    const stepMap = {
        'vyuctovani': 0,
        'hlaseni': 1, 
        'odeslani': 2
    };
    
    const reverseStepMap = {
        0: 'vyuctovani',
        1: 'hlaseni',
        2: 'odeslani'
    };

    // Get step from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const stepParam = urlParams.get('krok');
    let initialStep = 0;
    
    if (stepParam && stepMap.hasOwnProperty(stepParam)) {
        initialStep = stepMap[stepParam];
    } else if (stepParam && !isNaN(parseInt(stepParam))) {
        // Backward compatibility for old numeric format
        const numericStep = parseInt(stepParam, 10);
        initialStep = numericStep >= 0 && numericStep <= 2 ? numericStep : 0;
    }

    const [activeStep, setActiveStep] = useState(initialStep);

    // Handle step change with URL update
    const changeStep = useCallback((step) => {
        setActiveStep(step);
        const url = new URL(window.location);
        if (step === 0) {
            url.searchParams.delete('krok');
        } else {
            url.searchParams.set('krok', reverseStepMap[step]);
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