import React, { useEffect, useState, useRef } from 'react';
import { 
    IconCheck, 
    IconAlertTriangle, 
    IconInfoCircle, 
    IconX as IconClose,
    IconExclamationMark 
} from '@tabler/icons-react';

/**
 * Jednotlivý Toast item
 * Zobrazuje notifikaci s auto-dismiss funkcionalitou
 */
export const Toast = ({ 
    id,
    type = 'info', 
    title, 
    message, 
    duration = 5000,
    onDismiss,
    showProgress = true 
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const timeoutRef = useRef(null);
    const intervalRef = useRef(null);
    const startTimeRef = useRef(null);
    const pausedTimeRef = useRef(null);

    // Icon mapping podle typu
    const icons = {
        success: IconCheck,
        error: IconExclamationMark,
        warning: IconAlertTriangle,
        info: IconInfoCircle
    };

    const IconComponent = icons[type] || icons.info;

    // Spustit animaci vstupu a auto-dismiss timer
    useEffect(() => {
        // Malé zpoždění pro smooth animaci
        const showTimer = setTimeout(() => {
            setIsVisible(true);
        }, 50);

        if (duration > 0) {
            startAutoHide();
        }

        return () => {
            clearTimeout(showTimer);
            clearAutoHide();
        };
    }, [duration]);

    // Auto-hide funkce
    const startAutoHide = () => {
        startTimeRef.current = Date.now();
        
        timeoutRef.current = setTimeout(() => {
            handleDismiss();
        }, duration);

        // Progress bar animace
        if (showProgress) {
            intervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTimeRef.current;
                const remaining = Math.max(0, ((duration - elapsed) / duration) * 100);
                setProgress(remaining);
            }, 50);
        }
    };

    const clearAutoHide = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const pauseAutoHide = () => {
        if (timeoutRef.current && !pausedTimeRef.current) {
            clearAutoHide();
            pausedTimeRef.current = Date.now();
        }
    };

    const resumeAutoHide = () => {
        if (pausedTimeRef.current) {
            const pausedDuration = Date.now() - pausedTimeRef.current;
            const remainingTime = duration - (pausedTimeRef.current - startTimeRef.current);
            
            pausedTimeRef.current = null;
            
            if (remainingTime > 0) {
                startTimeRef.current = Date.now() - pausedDuration;
                
                timeoutRef.current = setTimeout(() => {
                    handleDismiss();
                }, remainingTime);

                if (showProgress) {
                    intervalRef.current = setInterval(() => {
                        const elapsed = Date.now() - startTimeRef.current;
                        const remaining = Math.max(0, ((duration - elapsed) / duration) * 100);
                        setProgress(remaining);
                    }, 50);
                }
            } else {
                handleDismiss();
            }
        }
    };

    const handleDismiss = () => {
        clearAutoHide();
        setIsExiting(true);
        
        // Po animaci výstupu zavolat callback
        setTimeout(() => {
            onDismiss?.(id);
        }, 200);
    };

    const handleClick = () => {
        handleDismiss();
    };

    return (
        <div 
            className={`toast toast--${type} ${isVisible ? 'toast--entering' : ''} ${isExiting ? 'toast--exiting' : ''}`}
            onMouseEnter={pauseAutoHide}
            onMouseLeave={resumeAutoHide}
        >
            <div className="toast__content">
                <div className={`toast__icon toast__icon--${type}`}>
                    <IconComponent size={24} />
                </div>
                
                <div className="toast__body">
                    {title && (
                        <div className="toast__title">
                            {title}
                        </div>
                    )}
                    <div className="toast__message">
                        {message}
                    </div>
                </div>
                
                <button 
                    className="toast__close"
                    onClick={handleClick}
                    aria-label="Zavřít notifikaci"
                >
                    <IconClose size={18} />
                </button>
            </div>
            
            {showProgress && duration > 0 && (
                <div 
                    className={`toast__progress toast__progress--${type}`}
                    style={{ width: `${progress}%` }}
                />
            )}
        </div>
    );
};