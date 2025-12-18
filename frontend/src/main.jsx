import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Lazy load App component to reduce initial bundle size
const App = lazy(() => import('./App.jsx'))

const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  }}>
    Loading...
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<LoadingFallback />}>
      <App />
    </Suspense>
  </StrictMode>,
)
