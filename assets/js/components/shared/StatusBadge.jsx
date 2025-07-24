import React from 'react';

/**
 * Reusable status badge component
 * Zobrazuje různé stavy s konzistentním stylingem
 */
export const StatusBadge = ({ 
    status, 
    type = 'default',
    size = 'md',
    className = '' 
}) => {
    // Type variants
    const typeVariants = {
        success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        primary: 'bg-blue-600 text-white dark:bg-blue-700',
        secondary: 'bg-gray-600 text-white dark:bg-gray-700'
    };

    // Size variants
    const sizeVariants = {
        xs: 'px-1.5 py-0.5 text-xs',
        sm: 'px-2 py-1 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base'
    };

    const variant = typeVariants[type] || typeVariants.default;
    const sizeClass = sizeVariants[size] || sizeVariants.md;

    return (
        <span 
            className={`
                inline-flex items-center font-medium rounded-full
                ${variant}
                ${sizeClass}
                ${className}
            `}
        >
            {status}
        </span>
    );
};