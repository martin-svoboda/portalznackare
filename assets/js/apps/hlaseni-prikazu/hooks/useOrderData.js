/**
 * Custom hook pro načítání dat příkazu
 * Encapsuluje logiku načítání head, predmety, useky
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '../../../utils/api';
import { log } from '../../../utils/debug';
import { showNotification } from '../../../utils/notifications';

export const useOrderData = (prikazId) => {
    const [head, setHead] = useState(null);
    const [predmety, setPredmety] = useState([]);
    const [useky, setUseky] = useState([]);
    const [loading, setLoading] = useState(true);

    // Načtení dat příkazu
    const loadOrderData = useCallback(async () => {
        if (!prikazId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const result = await api.prikazy.detail(prikazId);
            setHead(result.head || {});
            setPredmety(result.predmety || []);
            setUseky(result.useky || []);
            log.info(`Načten příkaz ${prikazId}`);
        } catch (error) {
            log.error('Chyba při načítání příkazu', error);
            showNotification('error', 'Nepodařilo se načíst data příkazu');
        } finally {
            setLoading(false);
        }
    }, [prikazId]);

    useEffect(() => {
        loadOrderData();
    }, [loadOrderData]);

    return {
        head,
        predmety,
        useky,
        loading,
        reload: loadOrderData
    };
};