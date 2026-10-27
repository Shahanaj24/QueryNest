import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { GlobalStyle } from './theme'

// AuthProvider sits inside the router so pages can redirect after sign-in,
// and outside App so every route can read the current user.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <GlobalStyle />
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
