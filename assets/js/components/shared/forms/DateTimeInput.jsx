import React from 'react';

/**
 * Reusable date/time input component
 * Poskytuje konzistentní handling pro datum a čas
 */
export const DateTimeInput = ({
    type = 'date', // 'date', 'time', 'datetime'
    value,
    onChange,
    label,
    required = false,
    disabled = false,
    placeholder,
    min,
    max,
    className = '',
    error = null
}) => {
    // Convert Date object to string for input value
    const getInputValue = () => {
        if (!value) return '';
        
        if (type === 'date' && value instanceof Date) {
            return value.toISOString().split('T')[0];
        }
        
        if (type === 'time') {
            if (value instanceof Date) {
                return value.toTimeString().slice(0, 5);
            }
            return value || '';
        }
        
        if (type === 'datetime' && value instanceof Date) {
            return value.toISOString().slice(0, 16);
        }
        
        return value || '';
    };

    // Handle change and convert to appropriate format
    const handleChange = (e) => {
        const newValue = e.target.value;
        
        if (!newValue) {
            onChange(null);
            return;
        }
        
        if (type === 'date') {
            const date = new Date(newValue);
            if (!isNaN(date.getTime())) {
                onChange(date);
            }
        } else if (type === 'time') {
            onChange(newValue);
        } else if (type === 'datetime') {
            const date = new Date(newValue);
            if (!isNaN(date.getTime())) {
                onChange(date);
            }
        }
    };

    const inputType = type === 'datetime' ? 'datetime-local' : type;

    return (
        <div className={className}>
            {label && (
                <label className="form__label">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <input
                type={inputType}
                className={`form__input ${error ? 'form__input--error' : ''}`}
                value={getInputValue()}
                onChange={handleChange}
                disabled={disabled}
                required={required}
                placeholder={placeholder}
                min={min}
                max={max}
            />
            {error && (
                <p className="form__error">{error}</p>
            )}
        </div>
    );
};