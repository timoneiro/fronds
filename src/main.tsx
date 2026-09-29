import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { requestPersistentStorage } from './db/db'
import './index.css'

registerSW({ immediate: true })
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
