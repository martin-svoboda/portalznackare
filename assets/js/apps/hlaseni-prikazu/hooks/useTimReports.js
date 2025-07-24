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

export const useTimReports = (timReports, setFormData) => {
    // Update TIM report
    const updateTimReport = useCallback((timId, updates) => {
        const newTimReports = {
            ...timReports,
            [timId]: {
                ...timReports[timId],
                ...updates
            }
        };
        setFormData(prev => ({ ...prev, timReports: newTimReports }));
    }, [timReports, setFormData]);

    // Update item status within a TIM report
    const updateItemStatus = useCallback((timId, item, status) => {
        const timReport = timReports[timId] || {
            timId,
            structuralComment: "",
            structuralAttachments: [],
            itemStatuses: [],
            photos: []
        };

        const primaryId = getItemIdentifier(item);
        const legacyId = getLegacyItemIdentifier(item);

        const existingStatusIndex = timReport.itemStatuses.findIndex(s => 
            s.itemId === primaryId || s.itemId === legacyId || s.legacyItemId === legacyId
        );
        const newItemStatuses = [...timReport.itemStatuses];

        if (existingStatusIndex >= 0) {
            // Update existing status
            newItemStatuses[existingStatusIndex] = {
                ...newItemStatuses[existingStatusIndex],
                ...status,
                itemId: primaryId, // Update to new identifier
                legacyItemId: legacyId,
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
            newItemStatuses.push({
                itemId: primaryId,
                legacyItemId: legacyId,
                ...status,
                metadata: {
                    ID_PREDMETY: item.ID_PREDMETY,
                    EvCi_TIM: item.EvCi_TIM,
                    Predmet_Index: item.Predmet_Index,
                    Popis_Predmetu: item.Popis_Predmetu
                }
            });
        }

        updateTimReport(timId, { itemStatuses: newItemStatuses });
    }, [timReports, updateTimReport]);

    // Remove item status
    const removeItemStatus = useCallback((timId, itemId) => {
        const timReport = timReports[timId];
        if (!timReport) return;

        const newItemStatuses = timReport.itemStatuses.filter(status =>
            status.itemId !== itemId && status.legacyItemId !== itemId
        );

        updateTimReport(timId, { itemStatuses: newItemStatuses });
    }, [timReports, updateTimReport]);

    // Remove entire TIM report
    const removeTimReport = useCallback((timId) => {
        const newTimReports = { ...timReports };
        delete newTimReports[timId];
        setFormData(prev => ({ ...prev, timReports: newTimReports }));
    }, [timReports, setFormData]);

    // Get TIM report by ID
    const getTimReport = useCallback((timId) => {
        return timReports[timId] || {
            timId,
            structuralComment: "",
            structuralAttachments: [],
            itemStatuses: [],
            photos: []
        };
    }, [timReports]);

    // Get item status within a TIM report
    const getItemStatus = useCallback((timId, item) => {
        const timReport = getTimReport(timId);
        const primaryId = getItemIdentifier(item);
        const legacyId = getLegacyItemIdentifier(item);
        
        return timReport.itemStatuses.find(status => 
            status.itemId === primaryId || 
            status.itemId === legacyId || 
            status.legacyItemId === legacyId
        ) || {};
    }, [getTimReport]);

    // Check if all items in a TIM are completed
    const isTimCompleted = useCallback((timId, items) => {
        const timReport = getTimReport(timId);
        
        return items.every(item => {
            const primaryId = getItemIdentifier(item);
            const legacyId = getLegacyItemIdentifier(item);
            
            return timReport.itemStatuses.some(status => 
                (status.itemId === primaryId || status.itemId === legacyId || status.legacyItemId === legacyId) &&
                status.status
            );
        });
    }, [getTimReport]);

    // Get completion statistics for a TIM
    const getTimStats = useCallback((timId, items) => {
        const timReport = getTimReport(timId);
        
        const completedItems = items.filter(item => {
            const primaryId = getItemIdentifier(item);
            const legacyId = getLegacyItemIdentifier(item);
            
            return timReport.itemStatuses.some(status => 
                (status.itemId === primaryId || status.itemId === legacyId || status.legacyItemId === legacyId) &&
                status.status
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