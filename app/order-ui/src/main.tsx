import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import 'nprogress/nprogress.css'
import '../node_modules/swiper/swiper-bundle.min.css';
import 'react-tooltip/dist/react-tooltip.css'
import './index.css'
import App from './app/App.tsx'
import { ErrorBoundary } from './components/app/error-boundary'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found. Make sure there is a <div id="root"></div> in your HTML.')
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <Toaster />
      <App />
    </ErrorBoundary>
  </StrictMode>
)
