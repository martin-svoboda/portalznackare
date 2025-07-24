import React from 'react';
import { 
    IconCheck, 
    IconX, 
    IconAlertTriangle, 
    IconInfoCircle 
} from '@tabler/icons-react';

/**
 * Reusable validation message component
 * Zobrazuje různé typy zpráv s konzistentním stylingem
 */
export const ValidationMessage = ({ 
    type = 'info', 
    message, 
    messages = [], 
    icon: CustomIcon = null,
    className = '' 
}) => {
    // Type configuration
    const typeConfig = {
        success: {
            icon: IconCheck,
            baseClass: 'bg-green-50 border-green-200 text-green-800',
            iconClass: 'text-green-600'
        },
        error: {
            icon: IconX,
            baseClass: 'bg-red-50 border-red-200 text-red-800',
            iconClass: 'text-red-600'
        },
        warning: {
            icon: IconAlertTriangle,
            baseClass: 'bg-yellow-50 border-yellow-200 text-yellow-800',
            iconClass: 'text-yellow-600'
        },
        info: {
            icon: IconInfoCircle,
            baseClass: 'bg-blue-50 border-blue-200 text-blue-800',
            iconClass: 'text-blue-600'
        }
    };

    const config = typeConfig[type] || typeConfig.info;
    const Icon = CustomIcon || config.icon;
    
    // Combine single message with messages array
    const allMessages = [
        ...(message ? [message] : []),
        ...messages
    ].filter(Boolean);

    if (allMessages.length === 0) return null;

    return (
        <div className={`alert alert--${type} ${className}`}>
            <div className="flex items-start gap-2">
                <Icon size={20} className={`mt-0.5 flex-shrink-0 ${config.iconClass}`} />
                <div className="flex-1">
                    {allMessages.length === 1 ? (
                        <p className="text-sm">{allMessages[0]}</p>
                    ) : (
                        <ul className="list-disc list-inside space-y-1">
                            {allMessages.map((msg, index) => (
                                <li key={index} className="text-sm">{msg}</li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};