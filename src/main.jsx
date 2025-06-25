/**
 * Renders the root React component into the DOM, wrapping the <App /> component
 * in a <StrictMode> for additional checks and warnings.
 * @param {HTMLElement} document.getElementById('root') - The root element in the DOM to render the React app into.
 * @returns None
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './consoleWarning';
import App from './App.jsx'
import { AlertProvider } from './components/AlertProvider.jsx';
import { ToastProvider } from './contexts/ToastContext';
import Toast from './components/Toast';

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration);
        
        // Optional: Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New service worker available');
                // You could show a notification to user about update
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
} else {
  console.warn('Service Workers are not supported in this browser');
}

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
