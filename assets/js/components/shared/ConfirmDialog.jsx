import React from 'react';
import { IconAlertTriangle, IconX } from '@tabler/icons-react';

/**
 * Reusable confirmation dialog component
 * Zobrazuje modální dialog pro potvrzení akcí
 */
export const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Potvrzení',
    message = 'Opravdu chcete pokračovat?',
    confirmText = 'Potvrdit',
    cancelText = 'Zrušit',
    confirmButtonClass = 'btn--danger',
    icon: Icon = IconAlertTriangle
}) => {
    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
            onClick={handleBackdropClick}
        >
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <Icon size={24} className="text-yellow-600" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {title}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    >
                        <IconX size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={onClose}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className={`btn ${confirmButtonClass}`}
                        onClick={handleConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};