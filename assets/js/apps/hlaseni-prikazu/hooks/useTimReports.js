/**
 * Custom hook pro správu TIM reportů
 * Spravuje CRUD operace pro TIM data a item statuses
 */

import { useCallback } from 'react';

// Helper function for generating safe identifiers
const getItemIdentifier = (item) => {
    if (!item.ID_PREDMETY) {
        console.warn('Item missing ID_PREDMETY:', item);
        return `fallback_${item.EvCi_TIM}_${item.Predmet_Index}_${Date.now()}`;
    }
    return item.ID_PREDMETY.toString();
};

const getLegacyItemIdentifier = (item) => {
    return `${item.EvCi_TIM}_${item.Predmet_Index}`;
};

export const useTimReports = (Stavy_Tim, setFormData) => {
    // Update TIM report
    const updateTimReport = useCallback((timId, updates) => {
        const newTimReports = {
            ...Stavy_Tim,
            [timId]: {
                ...Stavy_Tim[timId],
                ...updates
            }
        };
        setFormData(prev => ({ ...prev, Stavy_Tim: newTimReports }));
    }, [Stavy_Tim, setFormData]);

    // Update item status within a TIM report
    const updateItemStatus = useCallback((timId, item, status) => {
        const timReport = Stavy_Tim[timId] || {
            EvCi_TIM: timId,
            Koment_NP: "",
            Prilohy_NP: [],
            Predmety: [],
            Prilohy_TIM: []
        };

        const primaryId = getItemIdentifier(item);
        const legacyId = getLegacyItemIdentifier(item);

        const existingStatusIndex = timReport.Predmety.findIndex(s => 
            s.ID_PREDMETY === primaryId
        );
        const newPredmety = [...timReport.Predmety];

        if (existingStatusIndex >= 0) {
            // Update existing status
            newPredmety[existingStatusIndex] = {
                ...newPredmety[existingStatusIndex],
                ...status,
                ID_PREDMETY: primaryId,
                // Complete metadata for full traceability
                metadata: {
                    ID_PREDMETY: item.ID_PREDMETY,
                    EvCi_TIM: item.EvCi_TIM,
                    Predmet_Index: item.Predmet_Index,
                    Popis_Predmetu: item.Popis_Predmetu
                }
            };
        } else {
            // Create new status
            newPredmety.push({
                ID_PREDMETY: primaryId,
                ...status,
                metadata: {
                    ID_PREDMETY: item.ID_PREDMETY,
                    EvCi_TIM: item.EvCi_TIM,
                    Predmet_Index: item.Predmet_Index,
                    Popis_Predmetu: item.Popis_Predmetu
                }
            });
        }

        updateTimReport(timId, { Predmety: newPredmety });
    }, [Stavy_Tim, updateTimReport]);

    // Remove item status
    const removeItemStatus = useCallback((timId, itemId) => {
        const timReport = Stavy_Tim[timId];
        if (!timReport) return;

        const newPredmety = timReport.Predmety.filter(status =>
            status.ID_PREDMETY !== itemId
        );

        updateTimReport(timId, { Predmety: newPredmety });
    }, [Stavy_Tim, updateTimReport]);

    // Remove entire TIM report
    const removeTimReport = useCallback((timId) => {
        const newTimReports = { ...Stavy_Tim };
        delete newTimReports[timId];
        setFormData(prev => ({ ...prev, Stavy_Tim: newTimReports }));
    }, [Stavy_Tim, setFormData]);

    // Get TIM report by ID
    const getTimReport = useCallback((timId) => {
        return Stavy_Tim[timId] || {
            EvCi_TIM: timId,
            Koment_NP: "",
            Prilohy_NP: [],
            Predmety: [],
            Prilohy_TIM: []
        };
    }, [Stavy_Tim]);

    // Get item status within a TIM report
    const getItemStatus = useCallback((timId, item) => {
        const timReport = getTimReport(timId);
        const primaryId = getItemIdentifier(item);
        const legacyId = getLegacyItemIdentifier(item);
        
        return timReport.Predmety.find(status => 
            status.ID_PREDMETY === primaryId
        ) || {};
    }, [getTimReport]);

    // Check if all items in a TIM are completed
    const isTimCompleted = useCallback((timId, items) => {
        const timReport = getTimReport(timId);
        
        return items.every(item => {
            const primaryId = getItemIdentifier(item);
            const legacyId = getLegacyItemIdentifier(item);
            
            return timReport.Predmety.some(status => 
                status.ID_PREDMETY === primaryId &&
                status.Zachovalost
            );
        });
    }, [getTimReport]);

    // Get completion statistics for a TIM
    const getTimStats = useCallback((timId, items) => {
        const timReport = getTimReport(timId);
        
        const completedItems = items.filter(item => {
            const primaryId = getItemIdentifier(item);
            const legacyId = getLegacyItemIdentifier(item);
            
            return timReport.Predmety.some(status => 
                status.ID_PREDMETY === primaryId &&
                status.Zachovalost
            );
        });

        return {
            completed: completedItems.length,
            total: items.length,
            percentage: items.length > 0 ? Math.round((completedItems.length / items.length) * 100) : 0
        };
    }, [getTimReport]);

    return {
        // CRUD operations
        updateTimReport,
        updateItemStatus,
        removeItemStatus,
        removeTimReport,
        
        // Getters
        getTimReport,
        getItemStatus,
        
        // Status checkers
        isTimCompleted,
        getTimStats
    };
};