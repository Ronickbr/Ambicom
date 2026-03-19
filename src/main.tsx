import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './globals.css'
import { Toaster } from 'sonner'
import { AuthProvider } from './components/providers/AuthProvider.tsx'
import { ThemeProvider } from './components/providers/ThemeProvider.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initGlobalErrorHandling } from '@/lib/errors'

initGlobalErrorHandling();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="ademicom-theme">
        <AuthProvider>
          <App />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
