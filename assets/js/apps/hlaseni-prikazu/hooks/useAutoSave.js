/**
 * Hook pro automatické ukládání formuláře
 * Sleduje změny dat a po určité době klidu automaticky uloží
 */

import { useEffect, useRef } from 'react';
import { useDebounce } from './useDebounce';
import { log } from '../../../utils/debug';

export function useAutoSave(data, saveFn, options = {}) {
    const {
        enabled = true,
        delay = 2000, // 2 sekundy po poslední změně
        skipInitial = true // Přeskočit první save při načtení
    } = options;

    // Debounce data - počkat až uživatel přestane psát/měnit
    const debouncedData = useDebounce(data, delay);
    
    // Reference na poslední uložená data
    const lastSavedData = useRef(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Přeskočit pokud není povoleno nebo nemáme data
        if (!enabled || !debouncedData) {
            return;
        }

        // Přeskočit první render pokud je nastaveno
        if (skipInitial && isFirstRender.current) {
            isFirstRender.current = false;
            lastSavedData.current = JSON.stringify(debouncedData);
            return;
        }

        // Serializovat data pro porovnání
        const serializedData = JSON.stringify(debouncedData);
        
        // Porovnat s posledními uloženými daty
        if (serializedData !== lastSavedData.current) {
            log.info('useAutoSave: Detekována změna, ukládám...', {
                dataSize: serializedData.length,
                delay
            });

            // Zavolat save funkci
            saveFn().then((success) => {
                if (success) {
                    // Aktualizovat reference pouze při úspěchu
                    lastSavedData.current = serializedData;
                    log.info('useAutoSave: Automatické uložení úspěšné');
                } else {
                    log.error('useAutoSave: Automatické uložení selhalo');
                }
            }).catch((error) => {
                log.error('useAutoSave: Chyba při automatickém ukládání', error);
            });
        }
    }, [debouncedData, enabled, saveFn, skipInitial, delay]);

    // Cleanup při unmount
    useEffect(() => {
        return () => {
            isFirstRender.current = true;
            lastSavedData.current = null;
        };
    }, []);
}