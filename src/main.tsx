import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App'

// Clear stale persisted state from previous versions
try {
  const stored = localStorage.getItem('agentos:app-store');
  if (stored) {
    const parsed = JSON.parse(stored);
    const validAppIds = ['browser', 'terminal', 'inbox', 'mission-control', 'agents', 'finder', 'settings'];
    const state = parsed?.state;
    if (state?.instances?.some((i: { appId: string }) => !validAppIds.includes(i.appId))) {
      localStorage.removeItem('agentos:app-store');
    }
  }
} catch { /* ignore */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
