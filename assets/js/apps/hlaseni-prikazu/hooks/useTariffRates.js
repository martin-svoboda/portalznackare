/**
 * Custom hook pro správu sazeb
 * Encapsuluje logiku načítání a cache sazeb
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '../../../utils/api';
import { log } from '../../../utils/debug';
import { parseTariffRatesFromAPI, calculateExecutionDate } from '../utils/compensationCalculator';

export const useTariffRates = (formData, reportLoaded) => {
    const [tariffRates, setTariffRates] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Načtení sazeb
    const loadTariffRates = useCallback(async () => {
        if (!reportLoaded) return;

        const executionDate = calculateExecutionDate(formData);
        log.info('Datum provedení pro sazby:', executionDate, 'z formData:', formData);
        const dateParam = executionDate.toISOString().split('T')[0];
        setLoading(true);
        setError(null);

        try {
            const result = await api.insyz.sazby(dateParam);
            log.info('Načtena surová data sazeb', result);
            
            const parsedTariffRates = parseTariffRatesFromAPI(result);
            log.info('Zpracovány sazby', parsedTariffRates);
            setTariffRates(parsedTariffRates);

            if (!parsedTariffRates || Object.keys(parsedTariffRates).length === 0) {
                log.error('Prázdné sazby');
                setError('Sazby se načetly, ale neobsahují žádná data');
            } else {
                const stravneCount = parsedTariffRates.stravneTariffs?.length || 0;
                const nahradyCount = parsedTariffRates.nahradyTariffs?.length || 0;
                log.info(`Sazby úspěšně načteny: ${stravneCount} stravné + ${nahradyCount} náhrady, jízdné: ${parsedTariffRates.jizdne}/${parsedTariffRates.jizdneZvysene}`);
            }
        } catch (err) {
            const errorMessage = 'Chyba při načítání sazeb';
            log.error(errorMessage, err);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [formData, reportLoaded]);

    useEffect(() => {
        loadTariffRates();
    }, [loadTariffRates]);

    return {
        tariffRates,
        loading,
        error,
        reload: loadTariffRates
    };
};