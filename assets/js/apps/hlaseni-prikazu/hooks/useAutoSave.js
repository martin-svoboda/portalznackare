/**
 * Hook pro automatické ukládání formuláře
 * Sleduje změny dat a po určité době klidu automaticky uloží
 */

import { useEffect, useRef } from 'react';
import { useDebounce } from './useDebounce';
import { log } from '../../../utils/debug';

// Za jak dlouho po načtení se formulář považuje za ustálený (výchozí stav pro porovnání)
const BASELINE_SETTLE_MS = 1000;

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
    const latestData = useRef(data);
    latestData.current = data;
    const baselineReady = useRef(!skipInitial);

    // Výchozí stav (skipInitial) se vezme chvíli po načtení, až doběhnou automatické
    // úpravy formuláře (dokončení částí, předvyplnění). Dřív se bral až z první debounced
    // hodnoty – změna uživatele během prvních `delay` ms v ní zmizela a neuložila se.
    useEffect(() => {
        if (!enabled || baselineReady.current) {
            return;
        }
        const handler = setTimeout(() => {
            lastSavedData.current = JSON.stringify(latestData.current);
            baselineReady.current = true;
        }, BASELINE_SETTLE_MS);

        return () => clearTimeout(handler);
    }, [enabled]);

    useEffect(() => {
        // Přeskočit pokud není povoleno, nemáme data nebo ještě není výchozí stav
        if (!enabled || !debouncedData || !baselineReady.current) {
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
    }, [debouncedData, enabled, saveFn, delay]);

    // Cleanup při unmount
    useEffect(() => {
        return () => {
            baselineReady.current = !skipInitial;
            lastSavedData.current = null;
        };
    }, []);
}