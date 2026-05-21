import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ignore ResizeObserver loop limit exceeded and loop completed notifications errors
if (typeof window !== "undefined") {
  const IGNORED_ERRORS = [
    "ResizeObserver loop completed with undelivered notifications.",
    "ResizeObserver loop limit exceeded",
  ];

  const originalError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const msg = typeof message === "string" ? message : "";
    if (IGNORED_ERRORS.some((err) => msg.includes(err))) {
      return true;
    }
    return originalError ? originalError(message, source, lineno, colno, error) : false;
  };

  window.addEventListener("error", (e) => {
    if (IGNORED_ERRORS.some((err) => e.message?.includes(err))) {
      e.stopImmediatePropagation();
    }
  });
}

// PWA Registration is handled by vite-plugin-pwa via registerSW in components

createRoot(document.getElementById("root")!).render(<App />);
