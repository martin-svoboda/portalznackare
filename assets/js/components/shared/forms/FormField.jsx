import React from 'react';

/**
 * Generic form field wrapper
 * Poskytuje konzistentní layout pro různé typy polí
 */
export const FormField = ({
    label,
    required = false,
    error = null,
    help = null,
    children,
    className = ''
}) => {
    return (
        <div className={className}>
            {label && (
                <label className="form__label">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            {help && !error && (
                <p className="text-sm text-gray-600 mb-1">{help}</p>
            )}
            
            {children}
            
            {error && (
                <p className="form__error">{error}</p>
            )}
        </div>
    );
};