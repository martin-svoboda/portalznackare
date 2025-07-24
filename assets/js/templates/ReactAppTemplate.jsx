/**
 * Template for new React applications
 * Follow this structure for all new micro-frontend apps
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createDebugLogger } from '../utils/debug';
import { useDebounce } from '../hooks/useDebounce';
import { useApi } from '../hooks/useApi';

// Initialize debug logger - ALWAYS use component name
const logger = createDebugLogger('TemplateApp');

/**
 * Get app configuration from DOM
 */
const getAppConfig = () => {
    const container = document.querySelector('[data-app="template-app"]');
    return {
        // Extract data from data attributes
        entityId: container?.dataset?.entityId || null,
        currentUser: container?.dataset?.user ? JSON.parse(container.dataset.user) : null,
        config: container?.dataset?.config ? JSON.parse(container.dataset.config) : {}
    };
};

/**
 * Main App Component
 * Keep this component ONLY for:
 * - State management
 * - Effect hooks  
 * - Event handlers that call utils functions
 * - Render logic
 */
const TemplateAppComponent = () => {
    logger.lifecycle('App - Component mounted');
    
    // Get app configuration
    const { entityId, currentUser, config } = useMemo(() => getAppConfig(), []);
    
    // State
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // API hook
    const { api, loading: apiLoading, error: apiError } = useApi();
    
    // Debounced state for expensive operations
    const debouncedData = useDebounce(data, 500);
    
    // Memoized form data updates
    const updateData = useCallback((updates) => {
        setData(prev => ({ ...prev, ...updates }));
        logger.state('data updated', data, { ...data, ...updates });
    }, [data]);
    
    // Load initial data
    useEffect(() => {
        const loadInitialData = async () => {
            if (!entityId) {
                setLoading(false);
                return;
            }
            
            logger.lifecycle('Loading initial data', { entityId });
            
            try {
                // Use appropriate API method
                const result = await api.request(`/api/entity/${entityId}`);
                setData(result);
                logger.data('Initial data loaded', result);
            } catch (err) {
                logger.error('Failed to load initial data', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        
        loadInitialData();
    }, [entityId, api]);
    
    // Handle save operation
    const handleSave = useCallback(async () => {
        logger.lifecycle('Save started');
        
        try {
            const result = await api.request('/api/entity/save', {
                method: 'POST',
                data: data
            });
            
            logger.lifecycle('Save completed', result);
            // Show success notification
            
        } catch (err) {
            logger.error('Save failed', err);
            // Show error notification
        }
    }, [api, data]);
    
    // Memoized computations
    const computedValue = useMemo(() => {
        if (!debouncedData) return null;
        
        // Perform expensive computation here
        const result = someExpensiveComputation(debouncedData);
        logger.data('Computed value', result);
        
        return result;
    }, [debouncedData]);
    
    // Debug render info
    logger.render({ data, loading, error });
    
    // Loading state
    if (loading) {
        return (
            <div className="card">
                <div className="card__content">
                    <div className="text-center">
                        Načítání...
                    </div>
                </div>
            </div>
        );
    }
    
    // Error state
    if (error) {
        return (
            <div className="card">
                <div className="card__content">
                    <div className="alert alert--danger">
                        {error}
                    </div>
                </div>
            </div>
        );
    }
    
    // Main render
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="card__header">
                    <h2 className="card__title">Template App</h2>
                </div>
                <div className="card__content">
                    {/* Content here */}
                    <p>Entity ID: {entityId}</p>
                    <p>User: {currentUser?.name}</p>
                    <p>Computed: {computedValue}</p>
                </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-4">
                <button 
                    className="btn btn--secondary"
                    onClick={() => window.history.back()}
                >
                    Zpět
                </button>
                
                <button 
                    className="btn btn--primary"
                    onClick={handleSave}
                    disabled={apiLoading}
                >
                    {apiLoading ? 'Ukládání...' : 'Uložit'}
                </button>
            </div>
        </div>
    );
};

// Expensive computation function (should be in utils/)
const someExpensiveComputation = (data) => {
    // This should be moved to utils/ in real application
    return data ? Object.keys(data).length : 0;
};

// Memoized component to prevent unnecessary re-renders
export const TemplateApp = React.memo(TemplateAppComponent, (prevProps, nextProps) => {
    // Custom comparison if needed
    return true; // Only re-render when props actually change
});

export default TemplateApp;