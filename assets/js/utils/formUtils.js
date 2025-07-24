/**
 * Global form utilities
 * Can be used by any React application
 */

import { log } from './debug';

/**
 * Format date for HTML input (YYYY-MM-DD)
 */
export const formatDateForInput = (date) => {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    return d.toISOString().split('T')[0];
};

/**
 * Parse date from HTML input
 */
export const parseDateFromInput = (dateString) => {
    if (!dateString) return new Date();
    
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date;
};

/**
 * Format time for HTML input (HH:MM)
 */
export const formatTimeForInput = (date) => {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    return d.toTimeString().slice(0, 5);
};

/**
 * Parse time from HTML input
 */
export const parseTimeFromInput = (timeString, baseDate = new Date()) => {
    if (!timeString) return baseDate;
    
    const [hours, minutes] = timeString.split(':').map(n => parseInt(n, 10));
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    
    return date;
};

/**
 * Generate unique ID for form elements
 */
export const generateId = (prefix = 'field') => {
    return `${prefix}_${crypto.randomUUID()}`;
};

/**
 * Debounced form field update
 */
export const createDebouncedUpdater = (updateFunction, delay = 300) => {
    let timeoutId = null;
    
    return (fieldName, value) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(() => {
            updateFunction(fieldName, value);
            log.data('Debounced field update', { fieldName, value });
        }, delay);
    };
};

/**
 * Generic form validation
 */
export const validateRequired = (value, fieldName = 'Field') => {
    if (value === null || value === undefined || value === '') {
        return `${fieldName} is required`;
    }
    return null;
};

export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return 'Invalid email format';
    }
    return null;
};

export const validateNumber = (value, min = null, max = null) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
        return 'Must be a valid number';
    }
    if (min !== null && num < min) {
        return `Must be at least ${min}`;
    }
    if (max !== null && num > max) {
        return `Must be at most ${max}`;
    }
    return null;
};

/**
 * Validate form object
 */
export const validateForm = (formData, validationRules) => {
    const errors = {};
    let isValid = true;
    
    for (const [fieldName, rules] of Object.entries(validationRules)) {
        const value = formData[fieldName];
        
        for (const rule of rules) {
            const error = rule(value, fieldName);
            if (error) {
                errors[fieldName] = error;
                isValid = false;
                break;
            }
        }
    }
    
    log.data('Form validation', { formData, errors, isValid });
    
    return { isValid, errors };
};

/**
 * File validation utilities
 */
export const validateFileSize = (file, maxSizeMB) => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return `File size must be less than ${maxSizeMB}MB`;
    }
    return null;
};

export const validateFileType = (file, allowedTypes) => {
    if (!allowedTypes.includes(file.type)) {
        return `File type ${file.type} is not allowed`;
    }
    return null;
};

/**
 * Currency formatting
 */
export const formatCurrency = (amount, currency = 'CZK') => {
    return new Intl.NumberFormat('cs-CZ', {
        style: 'currency',
        currency: currency
    }).format(amount || 0);
};

/**
 * Number formatting
 */
export const formatNumber = (number, decimals = 0) => {
    return new Intl.NumberFormat('cs-CZ', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(number || 0);
};

/**
 * Deep clone object (for form data)
 */
export const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(deepClone);
    
    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
};

/**
 * Compare objects for changes
 */
export const hasFormChanged = (original, current) => {
    return JSON.stringify(original) !== JSON.stringify(current);
};

/**
 * Storage path generator for file uploads
 */
export const generateStoragePath = (category, year = null, ...pathSegments) => {
    const currentYear = year || new Date().getFullYear();
    const sanitizedSegments = pathSegments
        .filter(segment => segment !== null && segment !== undefined)
        .map(segment => segment.toString().trim())
        .filter(segment => segment.length > 0);
    
    const path = [category, currentYear, ...sanitizedSegments].join('/');
    
    log.data('Generated storage path', { category, year: currentYear, pathSegments, path });
    return path;
};

/**
 * Form field helpers
 */
export const createFieldUpdater = (setFormData) => {
    return (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }));
        log.data('Field updated', { fieldName, value });
    };
};

export const createNestedFieldUpdater = (setFormData, parentField) => {
    return (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [parentField]: {
                ...prev[parentField],
                [fieldName]: value
            }
        }));
        log.data('Nested field updated', { parentField, fieldName, value });
    };
};

/**
 * Array field helpers
 */
export const createArrayFieldHelper = (setFormData, arrayFieldName) => {
    const add = (newItem) => {
        setFormData(prev => ({
            ...prev,
            [arrayFieldName]: [...prev[arrayFieldName], newItem]
        }));
        log.data('Array item added', { arrayFieldName, newItem });
    };

    const remove = (index) => {
        setFormData(prev => ({
            ...prev,
            [arrayFieldName]: prev[arrayFieldName].filter((_, i) => i !== index)
        }));
        log.data('Array item removed', { arrayFieldName, index });
    };

    const update = (index, updates) => {
        setFormData(prev => ({
            ...prev,
            [arrayFieldName]: prev[arrayFieldName].map((item, i) => 
                i === index ? { ...item, ...updates } : item
            )
        }));
        log.data('Array item updated', { arrayFieldName, index, updates });
    };

    const move = (fromIndex, toIndex) => {
        setFormData(prev => {
            const newArray = [...prev[arrayFieldName]];
            const [movedItem] = newArray.splice(fromIndex, 1);
            newArray.splice(toIndex, 0, movedItem);
            
            return {
                ...prev,
                [arrayFieldName]: newArray
            };
        });
        log.data('Array item moved', { arrayFieldName, fromIndex, toIndex });
    };

    return { add, remove, update, move };
};