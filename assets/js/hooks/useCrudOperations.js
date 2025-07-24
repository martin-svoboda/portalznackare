/**
 * Generic CRUD hook pro správu seznamů položek
 * Poskytuje standardní CRUD operace pro jakýkoliv seznam
 */

import { useState, useCallback } from 'react';

export const useCrudOperations = (initialItems = [], createEmptyItem) => {
    const [items, setItems] = useState(initialItems);

    // Add new item
    const addItem = useCallback(() => {
        const newItem = createEmptyItem ? createEmptyItem() : { id: crypto.randomUUID() };
        setItems(prev => [...prev, newItem]);
        return newItem;
    }, [createEmptyItem]);

    // Update existing item
    const updateItem = useCallback((itemId, updates) => {
        setItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
        ));
    }, []);

    // Remove item
    const removeItem = useCallback((itemId) => {
        setItems(prev => prev.filter(item => item.id !== itemId));
    }, []);

    // Replace all items
    const setAllItems = useCallback((newItems) => {
        setItems(newItems);
    }, []);

    // Find item by ID
    const findItem = useCallback((itemId) => {
        return items.find(item => item.id === itemId);
    }, [items]);

    // Duplicate item
    const duplicateItem = useCallback((itemId, modifyDuplicate = null) => {
        const originalItem = findItem(itemId);
        if (!originalItem) return null;

        const duplicatedItem = {
            ...originalItem,
            id: crypto.randomUUID()
        };

        // Allow custom modifications to the duplicate
        if (modifyDuplicate) {
            Object.assign(duplicatedItem, modifyDuplicate(duplicatedItem));
        }

        setItems(prev => [...prev, duplicatedItem]);
        return duplicatedItem;
    }, [findItem]);

    // Move item up in the list
    const moveItemUp = useCallback((index) => {
        if (index <= 0 || index >= items.length) return;
        
        setItems(prev => {
            const newItems = [...prev];
            [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
            return newItems;
        });
    }, [items.length]);

    // Move item down in the list
    const moveItemDown = useCallback((index) => {
        if (index < 0 || index >= items.length - 1) return;
        
        setItems(prev => {
            const newItems = [...prev];
            [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
            return newItems;
        });
    }, [items.length]);

    // Move item to specific index
    const moveItem = useCallback((fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= items.length) return;
        if (toIndex < 0 || toIndex >= items.length) return;
        
        setItems(prev => {
            const newItems = [...prev];
            const [movedItem] = newItems.splice(fromIndex, 1);
            newItems.splice(toIndex, 0, movedItem);
            return newItems;
        });
    }, [items.length]);

    // Bulk update multiple items
    const updateMultipleItems = useCallback((updates) => {
        setItems(prev => prev.map(item => {
            const update = updates[item.id];
            return update ? { ...item, ...update } : item;
        }));
    }, []);

    // Remove multiple items
    const removeMultipleItems = useCallback((itemIds) => {
        const idsSet = new Set(itemIds);
        setItems(prev => prev.filter(item => !idsSet.has(item.id)));
    }, []);

    // Clear all items
    const clearItems = useCallback(() => {
        setItems([]);
    }, []);

    // Check if empty
    const isEmpty = items.length === 0;

    // Get item count
    const count = items.length;

    return {
        // State
        items,
        isEmpty,
        count,

        // Basic CRUD
        addItem,
        updateItem,
        removeItem,
        setAllItems,
        findItem,

        // Advanced operations
        duplicateItem,
        moveItem,
        moveItemUp,
        moveItemDown,
        updateMultipleItems,
        removeMultipleItems,
        clearItems
    };
};