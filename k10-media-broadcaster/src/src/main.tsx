import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Import original dashboard CSS files (global, not modules) to guarantee
// pixel-perfect visual parity with dashboard.html
import './styles/original/base.css'
import './styles/original/dashboard.css'
import './styles/original/leaderboard.css'
import './styles/original/datastream.css'
import './styles/original/effects.css'
import './styles/original/settings.css'
import './styles/original/connections.css'
import './styles/original/rally.css'

// React-specific overrides and keyframe animations
import './styles/globals.css'

// Error boundary for catching render errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[K10] React Error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', top: 20, left: 20, right: 20,
          background: 'rgba(200,0,0,0.9)', color: '#fff',
          padding: 20, borderRadius: 8, fontFamily: 'monospace',
          fontSize: 13, zIndex: 99999, whiteSpace: 'pre-wrap'
        }}>
          <strong>K10 Media Broadcaster — Render Error</strong>
          {'\n\n'}
          {this.state.error.message}
          {'\n\n'}
          {this.state.error.stack}
        </div>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
