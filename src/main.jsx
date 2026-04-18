import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { applyThemeToDocument, getInitialTheme } from "./context/theme-utils.js";

const initialTheme = getInitialTheme();
applyThemeToDocument(initialTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider initialTheme={initialTheme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
