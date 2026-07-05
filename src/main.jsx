import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ToastProvider } from './components/Toast.jsx'
import '@fontsource-variable/inter'
import '@fontsource-variable/geist-mono'
import './styles/global.css'
import './styles/App.css'
import './styles/components.css'
import './styles/calendar.css'
import './styles/import-view.css'
import './styles/active-workout.css'
import './styles/history.css'
import './styles/library.css'
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

// Dev-only demo data seeder: run __seedDemo() / __clearDemo() in the console.
if (import.meta.env.DEV) {
  import('./dev/seedData.js').then(({ seedDemoData, clearDemoData }) => {
    window.__seedDemo = seedDemoData
    window.__clearDemo = clearDemoData
  })
}

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('ServiceWorker registration failed: ', err)
    })
  })
}
