import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const fonts = document.createElement("link");
fonts.rel = "stylesheet";
fonts.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
document.head.appendChild(fonts);

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

// No app-shell Service Worker registration: prevents background updates from closing open forms.

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
