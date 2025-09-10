/**
 * Globální counter pro generování unikátních 3-místných ID napříč všemi typy polí
 * Používá se pro vytváření stabilních identifikátorů pro fieldName tracking
 */

import { useState, useCallback, useRef } from 'react';

export const useFieldIdCounter = () => {
    const [globalCounter, setGlobalCounter] = useState(1);
    const globalCounterRef = useRef(1);

    /**
     * Inicializace counteru na základě všech existujících dat v hlášení
     */
    const initializeFromAllData = useCallback((formData) => {
        const allItems = [];
        
        // Skupiny cest a jejich segmenty
        if (formData.Skupiny_Cest) {
            formData.Skupiny_Cest.forEach(group => {
                if (group.id) allItems.push({ id: group.id });
                if (group.Cesty) {
                    group.Cesty.forEach(segment => {
                        if (segment.id) allItems.push({ id: segment.id });
                    });
                }
            });
        }
        
        // Nocležné
        if (formData.Noclezne) {
            formData.Noclezne.forEach(accommodation => {
                if (accommodation.id) allItems.push({ id: accommodation.id });
            });
        }
        
        // Vedlejší výdaje
        if (formData.Vedlejsi_Vydaje) {
            formData.Vedlejsi_Vydaje.forEach(expense => {
                if (expense.id) allItems.push({ id: expense.id });
            });
        }
        
        // TIM stavy (pokud mají vlastní ID)
        if (formData.Stavy_Tim) {
            Object.values(formData.Stavy_Tim).forEach(timState => {
                if (timState.id) allItems.push({ id: timState.id });
                
                // Předměty v TIM stavech
                if (timState.Predmety) {
                    Object.values(timState.Predmety).forEach(predmet => {
                        if (predmet.id) allItems.push({ id: predmet.id });
                    });
                }
            });
        }
        
        // Najít nejvyšší ID a nastavit counter
        const maxId = allItems.length > 0 
            ? Math.max(...allItems.map(item => {
                const numId = parseInt(item.id);
                return isNaN(numId) ? 0 : numId;
            }))
            : 0;
            
        const nextCounter = maxId + 1;
        setGlobalCounter(nextCounter);
        globalCounterRef.current = nextCounter;
        
        console.log(`FieldIdCounter inicializován: ${allItems.length} existujících prvků, další ID bude ${nextCounter.toString().padStart(3, '0')}`);
    }, []);

    /**
     * Vygeneruje další unikátní 3-místné ID
     */
    const getNextId = useCallback(() => {
        // Použij ref pro aktuální hodnotu counteru
        const currentCounter = globalCounterRef.current;
        const id = currentCounter.toString().padStart(3, '0');
        globalCounterRef.current = currentCounter + 1;
        setGlobalCounter(globalCounterRef.current);
        
        console.log(`Vygenerováno nové ID: ${id}`);
        return id;
    }, []);

    /**
     * Reset counteru (použití při načítání nového hlášení)
     */
    const resetCounter = useCallback(() => {
        setGlobalCounter(1);
        globalCounterRef.current = 1;
        console.log('FieldIdCounter resetován');
    }, []);

    /**
     * Získat aktuální hodnotu counteru (pro debug)
     */
    const getCurrentCounter = useCallback(() => {
        return globalCounter;
    }, [globalCounter]);

    return {
        initializeFromAllData,
        getNextId,
        resetCounter,
        getCurrentCounter
    };
};