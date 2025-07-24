import React from 'react';

/**
 * Reusable form section component
 * Poskytuje konzistentní styling pro sekce formuláře
 */
export const FormSection = ({ 
    title, 
    icon: Icon, 
    action, 
    children, 
    className = '', 
    headerClassName = '',
    contentClassName = ''
}) => {
    return (
        <div className={`card ${className}`}>
            {title && (
                <div className={`card__header ${headerClassName}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {Icon && <Icon size={20} />}
                            <h3 className="card__title">{title}</h3>
                        </div>
                        {action && <div>{action}</div>}
                    </div>
                </div>
            )}
            <div className={`card__content ${contentClassName}`}>
                {children}
            </div>
        </div>
    );
};