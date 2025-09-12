import React from 'react';

/**
 * Centralizovaná komponenta pro zobrazování validačních zpráv
 * Eliminuje duplicity a zajišťuje konzistentní zobrazení
 */
export const ValidationMessages = ({ 
    validationResult, 
    showErrors = true, 
    showWarnings = true,
    canComplete = true,
    partName = null,
    className = ""
}) => {
    if (!validationResult) return null;

    const { errors = [], warnings = [] } = validationResult;
    
    // Dynamické texty podle kontextu
    const errorTitle = partName 
        ? `Problémy v části ${partName}:` 
        : "Vyplňte všechny povinné údaje:";
    
    const warningTitle = partName 
        ? `Upozornění pro část ${partName}:` 
        : "Upozornění:";
    
    return (
        <div className={className}>
            {/* Chyby - blokují dokončení */}
            {showErrors && !canComplete && errors.length > 0 && (
                <div className="alert alert--danger mb-4">
                    <div className="mb-2"><strong>{errorTitle}</strong></div>
                    <ul className="list-disc list-inside space-y-1">
                        {errors.map((error, index) => (
                            <li key={index} className="text-sm">{error.message}</li>
                        ))}
                    </ul>
                </div>
            )}
            
            {/* Varování - neblokují dokončení */}
            {showWarnings && warnings.length > 0 && (
                <div className="alert alert--warning mb-4">
                    <div className="mb-2"><strong>{warningTitle}</strong></div>
                    <ul className="list-disc list-inside space-y-1">
                        {warnings.map((warning, index) => (
                            <li key={index} className="text-sm">{warning.message}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};