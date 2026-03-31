import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="view"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-md)',
            padding: 'var(--space-xl)',
            textAlign: 'center',
          }}
        >
          <h2>Something went wrong</h2>
          <p className="text-secondary text-sm">
            {this.state.error?.message || 'An unexpected error occurred.'}
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
