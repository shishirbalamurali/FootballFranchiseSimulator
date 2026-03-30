import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-black text-green-500 font-mono min-h-screen">
                    <h1 className="text-3xl font-bold mb-4">CRASH DETECTED</h1>
                    <h2 className="text-xl text-red-500 mb-2">{this.state.error && this.state.error.toString()}</h2>
                    <details className="whitespace-pre-wrap text-sm text-gray-400">
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-8 border border-green-500 px-4 py-2 hover:bg-green-900"
                    >
                        RELOAD
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
