import { Component, type ErrorInfo, type ReactNode } from 'react';
import logger from '../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * App-root error boundary. Without this, any uncaught render error in the
 * React tree leaves the user staring at a white screen with no recovery
 * path. With it, we show a small "something went wrong + reload" panel
 * and log the underlying error for diagnosis.
 *
 * This is a class component on purpose — React's error boundary API
 * (componentDidCatch / getDerivedStateFromError) only exists on classes.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Something went wrong' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('ErrorBoundary caught render error', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  private handleReload = () => {
    // Hard reload — wipes any corrupt state and re-fetches the bundle.
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#fafaf7',
          color: '#1a1a1a',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: '0.95rem', color: '#6b6b6b', maxWidth: 480, marginBottom: '1.5rem' }}>
          The page hit an unexpected error. Reload to try again — your uploaded files
          will need to be re-selected.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            padding: '0.7rem 1.5rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: '#1a1a1a',
            color: '#fafaf7',
            border: 'none',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          Reload page
        </button>
        {this.state.message && (
          <details style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#999' }}>
            <summary style={{ cursor: 'pointer' }}>Technical details</summary>
            <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{this.state.message}</pre>
          </details>
        )}
      </div>
    );
  }
}
