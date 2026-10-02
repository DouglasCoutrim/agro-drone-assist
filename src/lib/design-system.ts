// Design System Premium - LivreOS
// Cores, sombras, spacing, tipografia e tokens centralizados

// Cores Premium
export const COLORS = {
  // Brand Primary - Verde profissional
  primary: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a", // COR PRINCIPAL
    700: "#15803d",
    800: "#166534",
    900: "#145231",
  },

  // Neutral - Backgrounds e Textos
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },

  // Status Colors
  status: {
    success: "#10b981", // Verde
    warning: "#f59e0b", // Amarelo/Laranja
    error: "#ef4444",   // Vermelho
    info: "#3b82f6",    // Azul
  },

  // Backgrounds
  background: "#ffffff",
  surface: "#f9fafb",
  border: "#e5e7eb",
} as const;

// Shadows Premium
export const SHADOWS = {
  xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  sm: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
} as const;

// Spacing 8px grid
export const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",
} as const;

// Tipografia
export const TYPOGRAPHY = {
  display: {
    className: "font-display text-3xl font-bold leading-tight tracking-tight",
    size: 28,
  },
  heading1: {
    className: "font-body text-xl font-semibold leading-normal",
    size: 20,
  },
  heading2: {
    className: "font-body text-base font-semibold leading-normal",
    size: 16,
  },
  bodyLarge: {
    className: "font-body text-sm font-medium leading-relaxed",
    size: 14,
  },
  body: {
    className: "font-body text-sm font-normal leading-relaxed",
    size: 13,
  },
  small: {
    className: "font-body text-xs font-normal leading-normal",
    size: 12,
  },
  tiny: {
    className: "font-body text-xs font-semibold leading-tight",
    size: 11,
  },
} as const;

// Breakpoints Mobile-First
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

// Transitions
export const TRANSITIONS = {
  fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  base: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

// Border Radius
export const RADIUS = {
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  full: "9999px",
} as const;

// Z-Index Scale
export const Z_INDEX = {
  dropdown: 100,
  sticky: 200,
  modal: 300,
  popover: 400,
  tooltip: 500,
} as const;

// Helper para classes de cor dinâmicas
export const getColorClass = (color: keyof typeof COLORS.status, variant: "bg" | "text" | "border" | "ring") => {
  const base = COLORS.status[color];
  const variants = {
    bg: `${color}-50`,
    text: `${color}-700`,
    border: `${color}-200`,
    ring: `${color}-200`,
  };
  return variants[variant];
};