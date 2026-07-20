import React from 'react';

interface State {
  error: Error | null;
}

export class ViewerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Viewer crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: '#1a0d0d',
            color: '#ffb4b4',
            fontFamily: 'system-ui, sans-serif',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <div style={{ fontWeight: 600 }}>Erreur d'affichage du viewer</div>
          <pre
            style={{
              maxWidth: '90%',
              whiteSpace: 'pre-wrap',
              fontSize: '0.8rem',
              color: '#ffd0d0',
              background: 'rgba(0,0,0,0.3)',
              padding: '10px',
              borderRadius: '8px',
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ViewerErrorBoundary;
