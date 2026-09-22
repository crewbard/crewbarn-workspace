import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * App-wide error boundary. Without this, any render-time exception unmounts
 * the whole React tree and the page goes blank (we hit exactly that on the
 * asset edit modal). Now a render crash shows a recover screen instead.
 *
 * componentDidCatch is where crash reporting (Sentry) hooks in once a DSN is
 * configured.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // TODO: report to Sentry once VITE_SENTRY_DSN is configured.
    // Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: '#f1f5f9',
          }}
        >
          <div style={{ maxWidth: 440, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 20, lineHeight: 1.5 }}>
              This screen hit an unexpected error. Reloading usually fixes it. If it keeps
              happening, let us know what you were doing.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: '#f59e0b',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 22px',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
