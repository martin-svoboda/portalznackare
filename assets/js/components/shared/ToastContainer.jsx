import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast } from './Toast.jsx';

/**
 * Toast Container - globální kontejner pro toast notifikace
 * Používá React Portal pro rendering mimo component tree
 */
export const ToastContainer = ({ 
    position = 'top-right',
    maxToasts = 5 
}) => {
    const [toasts, setToasts] = useState([]);
    const [portalContainer, setPortalContainer] = useState(null);

    // Vytvořit portal container
    useEffect(() => {
        const container = document.createElement('div');
        container.className = `toast-container toast-container--${position}`;
        container.setAttribute('role', 'region');
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-label', 'Notifikace');
        
        document.body.appendChild(container);
        setPortalContainer(container);

        return () => {
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
        };
    }, [position]);

    // Poslouchat globální toast události
    useEffect(() => {
        const handleAddToast = (event) => {
            const { detail: toastData } = event;
            addToast(toastData);
        };

        const handleRemoveToast = (event) => {
            const { detail: { id } } = event;
            removeToast(id);
        };

        const handleClearToasts = () => {
            setToasts([]);
        };

        window.addEventListener('add-toast', handleAddToast);
        window.addEventListener('remove-toast', handleRemoveToast);
        window.addEventListener('clear-toasts', handleClearToasts);

        return () => {
            window.removeEventListener('add-toast', handleAddToast);
            window.removeEventListener('remove-toast', handleRemoveToast);
            window.removeEventListener('clear-toasts', handleClearToasts);
        };
    }, []);

    const addToast = (toastData) => {
        const newToast = {
            id: toastData.id || Date.now() + Math.random(),
            type: toastData.type || 'info',
            title: toastData.title,
            message: toastData.message,
            duration: toastData.duration !== undefined ? toastData.duration : 5000,
            showProgress: toastData.showProgress !== false,
            ...toastData
        };

        setToasts(prev => {
            const updated = [newToast, ...prev];
            // Omezit počet toastů
            return updated.slice(0, maxToasts);
        });
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    const handleToastDismiss = (id) => {
        removeToast(id);
    };

    if (!portalContainer || toasts.length === 0) {
        return null;
    }

    return createPortal(
        <div className="toast-stack">
            {toasts.map(toast => (
                <Toast
                    key={toast.id}
                    {...toast}
                    onDismiss={handleToastDismiss}
                />
            ))}
        </div>,
        portalContainer
    );
};

// Export také kontejner wrapper pro snadné použití
export const ToastProvider = ({ children, ...containerProps }) => {
    return (
        <>
            {children}
            <ToastContainer {...containerProps} />
        </>
    );
};