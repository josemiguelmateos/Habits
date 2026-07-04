import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Tema guardado (dark por defecto)
const tema = localStorage.getItem('tema')
document.documentElement.classList.toggle('dark', tema !== 'light')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
