import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Tema guardado (dark por defecto)
const tema = localStorage.getItem('tema')
const esOscuro = tema !== 'light'
document.documentElement.classList.toggle('dark', esOscuro)
document
  .querySelector('meta[name="theme-color"]')
  ?.setAttribute('content', esOscuro ? '#0a0a0c' : '#f4f4f5')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
