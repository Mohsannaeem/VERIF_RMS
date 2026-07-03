import React from 'react';

/**
 * Catches render-time JavaScript errors anywhere in the child tree
 * and shows a friendly fallback instead of a blank screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '60vh', gap: '16px',
          color: 'var(--text-secondary)',
        }}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>Something went wrong</h2>
          <p style={{ fontSize: '0.85rem', maxWidth: '420px', textAlign: 'center', lineHeight: 1.6 }}>
            {this.state.error.message}
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
