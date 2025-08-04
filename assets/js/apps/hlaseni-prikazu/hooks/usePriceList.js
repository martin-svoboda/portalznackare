/**
 * Custom hook pro správu ceníku
 * Encapsuluje logiku načítání a cache ceníku
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '../../../utils/api';
import { log } from '../../../utils/debug';
import { parsePriceListFromAPI } from '../utils/compensationCalculator';

export const usePriceList = (Datum_Provedeni, reportLoaded) => {
    const [priceList, setPriceList] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Načtení ceníku
    const loadPriceList = useCallback(async () => {
        if (!Datum_Provedeni || !reportLoaded) return;

        const dateParam = Datum_Provedeni.toISOString().split('T')[0];
        setLoading(true);
        setError(null);

        try {
            const result = await api.insys.ceniky(dateParam);
            log.info('Načtena surová data ceníku', result);
            
            const parsedPriceList = parsePriceListFromAPI(result);
            log.info('Zpracován ceník', parsedPriceList);
            setPriceList(parsedPriceList);

            if (!parsedPriceList || Object.keys(parsedPriceList).length === 0) {
                log.error('Prázdný ceník');
                setError('Ceník se načetl, ale neobsahuje žádná data');
            } else {
                log.info(`Ceník úspěšně načten s ${parsedPriceList.tariffs?.length || 0} tarify`);
            }
        } catch (err) {
            const errorMessage = 'Chyba při načítání ceníku';
            log.error(errorMessage, err);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [Datum_Provedeni, reportLoaded]);

    useEffect(() => {
        loadPriceList();
    }, [loadPriceList]);

    return {
        priceList,
        loading,
        error,
        reload: loadPriceList
    };
};