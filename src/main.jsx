import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { applyThemeToDocument, getInitialTheme } from "./context/theme-utils.js";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";

const initialTheme = getInitialTheme();
applyThemeToDocument(initialTheme);

async function purgeLegacyServiceWorkerArtifacts() {
  if (!import.meta.env.PROD) return;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("Service worker cleanup skipped:", error);
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ThemeProvider initialTheme={initialTheme}>
        <App />
      </ThemeProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);

void purgeLegacyServiceWorkerArtifacts();
