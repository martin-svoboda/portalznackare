/**
 * Custom hook pro polling stavu hlášení
 * Pravidelně kontroluje stav zpracování v databázi
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../utils/api';
import { log } from '../../../utils/debug';
import { showNotification } from '../../../utils/notifications';

export const useStatusPolling = (prikazId, formData, setFormData, isActive = false) => {
    const [isPolling, setIsPolling] = useState(false);
    const [pollCount, setPollCount] = useState(0);
    const pollCountRef = useRef(0);
    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);
    
    // Maximální počet pokusů a interval
    const MAX_POLL_ATTEMPTS = 60; // 5 minut při 5s intervalu
    const POLL_INTERVAL = 5000; // 5 sekund
    const POLL_TIMEOUT = 300000; // 5 minut celkový timeout

    const checkStatus = useCallback(async () => {
        if (!prikazId || !isActive) return;

        // Inkrementuj pollCount na začátku pomocí ref
        pollCountRef.current += 1;
        const currentAttempt = pollCountRef.current;
        setPollCount(currentAttempt);

        try {
            log.info(`Kontrola stavu hlášení ${prikazId} (pokus ${currentAttempt}/${MAX_POLL_ATTEMPTS})`);
            
            const result = await api.prikazy.report(prikazId);
            
            if (result && result.state) {
                const currentState = result.state;
                const previousState = formData.status;
                
                // Aktualizuj stav pouze pokud se změnil
                if (currentState !== previousState) {
                    log.info(`Stav hlášení se změnil: ${previousState} → ${currentState}`);
                    
                    setFormData(prev => ({
                        ...prev,
                        status: currentState,
                        date_send: result.date_send || prev.date_send,
                        error_message: result.error_message,
                        error_code: result.error_code
                    }));

                    // Zobraž notifikaci podle nového stavu
                    switch (currentState) {
                        case 'submitted':
                            showNotification('success', 'Hlášení bylo úspěšně přijato systémem INSYZ');
                            break;
                        case 'approved':
                            showNotification('success', 'Hlášení bylo schváleno v INSYZ');
                            break;
                        case 'rejected':
                            showNotification('warning', 'Hlášení bylo zamítnuto v INSYZ. Můžete ho opravit a odeslat znovu.');
                            break;
                        case 'send':
                            // Zůstává v polling režimu
                            break;
                        default:
                            log.info(`Neznámý stav: ${currentState}`);
                    }
                }
                
                // Zastavit polling pokud je stav finální
                if (['submitted', 'approved', 'rejected'].includes(currentState)) {
                    log.info(`Finální stav dosažen (${currentState}) - zastavuji polling`);
                    // Explicitně vyčistit interval zde
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current);
                        timeoutRef.current = null;
                    }
                    setIsPolling(false);
                    setPollCount(0);
                    pollCountRef.current = 0;
                    return;
                }
            }
            
        } catch (error) {
            log.error('Chyba při kontrole stavu hlášení', error);
            
            // Po několika chybách zastavit polling
            if (currentAttempt > 5) {
                log.error('Příliš mnoho chyb při polling, zastavuji');
                // Explicitně vyčistit interval
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
                setIsPolling(false);
                setPollCount(0);
                pollCountRef.current = 0;
                showNotification('warning', 'Nelze ověřit stav zpracování. Obnovte stránku pro kontrolu.');
            }
        }
    }, [prikazId, isActive, formData.status, setFormData, MAX_POLL_ATTEMPTS]);

    // Spustit polling
    const startPolling = useCallback(() => {
        if (isPolling || !isActive) return;
        
        log.info(`Zahajuji polling stavu hlášení ${prikazId} - kontrola stavu v INSYZ`);
        setIsPolling(true);
        setPollCount(0);
        pollCountRef.current = 0;
        
        // První kontrola okamžitě
        checkStatus();
        
        // Nastavit interval pro opakovanou kontrolu
        intervalRef.current = setInterval(checkStatus, POLL_INTERVAL);
        
        // Nastavit celkový timeout
        timeoutRef.current = setTimeout(() => {
            log.info('Polling timeout - zastavuji po 5 minutách');
            setIsPolling(false);
            showNotification('info', 'Zpracování trvá déle než obvykle. Obnovte stránku pro kontrolu stavu.');
        }, POLL_TIMEOUT);
        
    }, [checkStatus, isPolling, isActive, prikazId, POLL_INTERVAL, POLL_TIMEOUT]);

    // Zastavit polling
    const stopPolling = useCallback(() => {
        log.info('Zastavuji polling stavu hlášení');
        setIsPolling(false);
        setPollCount(0);
        pollCountRef.current = 0;
        
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // Automaticky spustit polling pokud je status 'send'
    useEffect(() => {
        if (formData.status === 'send' && isActive && !isPolling) {
            startPolling();
        } else if (formData.status !== 'send' && isPolling) {
            stopPolling();
        }
    }, [formData.status, isActive, isPolling, startPolling, stopPolling]);

    // Zastavit polling při unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Zastavit polling pokud dosáhne max pokusů
    useEffect(() => {
        if (pollCount >= MAX_POLL_ATTEMPTS && isPolling) {
            log.info(`Dosažen maximální počet pokusů pro polling (${pollCount}/${MAX_POLL_ATTEMPTS})`);
            // Explicitně vyčistit interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            setIsPolling(false);
            setPollCount(0);
            pollCountRef.current = 0;
            showNotification('info', 'Zpracování trvá neočekávaně dlouho. Obnovte stránku pro kontrolu stavu.');
        }
    }, [pollCount, MAX_POLL_ATTEMPTS, isPolling]);

    return {
        isPolling,
        pollCount,
        startPolling,
        stopPolling,
        maxAttempts: MAX_POLL_ATTEMPTS,
        interval: POLL_INTERVAL / 1000 // v sekundách pro zobrazení
    };
};