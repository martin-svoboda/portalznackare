import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        
        // Log error for debugging
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            const { sectionName = 'Komponenta', fallback } = this.props;
            
            // Custom fallback UI
            if (fallback) {
                return typeof fallback === 'function' 
                    ? fallback(this.state.error, this.state.errorInfo)
                    : fallback;
            }
            
            // Default error UI
            return (
                <div className="alert alert--danger">
                    <div className="alert__header">
                        <strong>Chyba v sekci: {sectionName}</strong>
                    </div>
                    <div className="alert__content">
                        <p className="text-sm">
                            Nastala chyba při vykreslování. Zkuste obnovit stránku.
                        </p>
                        {this.state.error && (
                            <details className="mt-2">
                                <summary className="text-xs text-gray-600 cursor-pointer">
                                    Technické detaily
                                </summary>
                                <pre className="text-xs text-gray-500 mt-1 overflow-auto">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;