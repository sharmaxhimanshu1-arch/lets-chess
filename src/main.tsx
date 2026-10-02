import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Hash routing keeps deep links working on static hosting like GitHub Pages. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
