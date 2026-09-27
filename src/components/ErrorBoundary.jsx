import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(_error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center p-8">
                    <div className="w-full max-w-2xl overflow-hidden rounded-panel bg-surface-raised shadow-3">
                        <div className="toon-banner banner-scope border-b-[3px] border-ink px-6 py-5">
                            <p className="toon-title font-display text-[64px] uppercase leading-none text-banner-title">Fumble!</p>
                            <p className="mt-1 text-label text-fg-secondary">Something went wrong on that play. Your save is safe.</p>
                        </div>
                        <div className="space-y-3 px-6 py-5">
                            <p className="rounded-card border-2 border-negative-border bg-negative-bg px-3 py-2 font-mono text-label text-negative-fg">
                                {this.state.error && this.state.error.toString()}
                            </p>
                            <details className="text-label text-fg-muted">
                                <summary className="cursor-pointer font-bold">Technical details</summary>
                                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-card bg-surface-sunken p-3 text-micro">
                                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                            <button
                                onClick={() => window.location.reload()}
                                className="toon-press h-12 rounded-card bg-team px-6 font-display text-h2 uppercase text-team-on shadow-1"
                            >
                                Reload
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
