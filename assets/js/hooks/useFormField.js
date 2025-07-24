/**
 * Hook pro správu jednotlivého form field
 * Poskytuje state management, validaci a error handling
 */

import { useState, useCallback, useEffect } from 'react';

export const useFormField = (initialValue = '', options = {}) => {
    const {
        required = false,
        validate = null,
        transform = null,
        maxLength = null,
        minLength = null,
        pattern = null,
        min = null,
        max = null
    } = options;

    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState(null);
    const [touched, setTouched] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Basic validation
    const validateField = useCallback((fieldValue) => {
        // Required validation
        if (required && !fieldValue) {
            return 'Toto pole je povinné';
        }

        // String validations
        if (typeof fieldValue === 'string') {
            if (minLength && fieldValue.length < minLength) {
                return `Minimální délka je ${minLength} znaků`;
            }
            if (maxLength && fieldValue.length > maxLength) {
                return `Maximální délka je ${maxLength} znaků`;
            }
            if (pattern && !pattern.test(fieldValue)) {
                return 'Neplatný formát';
            }
        }

        // Number validations
        if (typeof fieldValue === 'number') {
            if (min !== null && fieldValue < min) {
                return `Minimální hodnota je ${min}`;
            }
            if (max !== null && fieldValue > max) {
                return `Maximální hodnota je ${max}`;
            }
        }

        // Custom validation
        if (validate) {
            const customError = validate(fieldValue);
            if (customError) return customError;
        }

        return null;
    }, [required, minLength, maxLength, pattern, min, max, validate]);

    // Handle value change
    const handleChange = useCallback((newValue) => {
        // Apply transformation if provided
        const transformedValue = transform ? transform(newValue) : newValue;
        
        setValue(transformedValue);
        setIsDirty(true);
        
        // Validate on change if touched
        if (touched) {
            const validationError = validateField(transformedValue);
            setError(validationError);
        }
    }, [transform, touched, validateField]);

    // Handle blur (field lost focus)
    const handleBlur = useCallback(() => {
        setTouched(true);
        const validationError = validateField(value);
        setError(validationError);
    }, [value, validateField]);

    // Force validation
    const validate = useCallback(() => {
        setTouched(true);
        const validationError = validateField(value);
        setError(validationError);
        return !validationError;
    }, [value, validateField]);

    // Reset field
    const reset = useCallback(() => {
        setValue(initialValue);
        setError(null);
        setTouched(false);
        setIsDirty(false);
    }, [initialValue]);

    // Set value externally
    const setFieldValue = useCallback((newValue) => {
        setValue(newValue);
        setIsDirty(true);
    }, []);

    // Set error externally
    const setFieldError = useCallback((errorMessage) => {
        setError(errorMessage);
        setTouched(true);
    }, []);

    // Check if field is valid
    const isValid = !error && (!required || value);

    // Auto-validate on value change if touched
    useEffect(() => {
        if (touched && isDirty) {
            const validationError = validateField(value);
            setError(validationError);
        }
    }, [value, touched, isDirty, validateField]);

    return {
        // State
        value,
        error,
        touched,
        isDirty,
        isValid,

        // Handlers
        onChange: handleChange,
        onBlur: handleBlur,

        // Actions
        setValue: setFieldValue,
        setError: setFieldError,
        validate,
        reset,

        // Input props helper
        inputProps: {
            value,
            onChange: (e) => handleChange(e.target.value),
            onBlur: handleBlur,
            'aria-invalid': !!error,
            'aria-describedby': error ? `${Math.random()}-error` : undefined
        }
    };
};