import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ignore ResizeObserver loop limit exceeded error
if (typeof window !== "undefined") {
  const resizeObserverError = "ResizeObserver loop completed with undelivered notifications.";
  const originalError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (message === resizeObserverError || message === `Script error. ${resizeObserverError}`) {
      return true;
    }
    return originalError ? originalError(message, source, lineno, colno, error) : false;
  };

  window.addEventListener("error", (e) => {
    if (e.message === resizeObserverError || e.message === `Script error. ${resizeObserverError}`) {
      e.stopImmediatePropagation();
    }
  });
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
