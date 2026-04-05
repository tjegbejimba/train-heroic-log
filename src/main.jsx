import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ToastProvider } from './components/Toast.jsx'
import './styles/global.css'
import './styles/App.css'
import './styles/components.css'
import './styles/calendar.css'
import './styles/import-view.css'
import './styles/active-workout.css'
import './styles/history-library.css'
import './styles/planner.css'
import './styles/settings.css'
import './styles/training.css'
import './styles/stats-view.css'
import './styles/templates.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
)

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('ServiceWorker registration failed: ', err)
    })
  })
}
