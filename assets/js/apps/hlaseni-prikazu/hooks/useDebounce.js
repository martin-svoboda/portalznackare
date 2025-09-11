/**
 * Hook pro debouncing hodnot
 * Vrací hodnotu až po určité době klidu (žádné změny)
 */

import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 500) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        // Nastavit timeout pro aktualizaci debounced hodnoty
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Cleanup - zrušit timeout pokud se hodnota změní před vypršením
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}