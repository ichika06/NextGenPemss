/**
 * Renders the root React component into the DOM, wrapping the <App /> component
 * in a <StrictMode> for additional checks and warnings.
 * @param {HTMLElement} document.getElementById('root') - The root element in the DOM to render the React app into.
 * @returns None
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AlertProvider } from './components/AlertProvider.jsx';
import { ToastProvider } from './contexts/ToastContext';
import Toast from './components/Toast';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AlertProvider>
      <ToastProvider>
        <App />
        <Toast />
      </ToastProvider>
    </AlertProvider>
  </StrictMode>,
)
