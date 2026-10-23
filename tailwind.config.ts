import type { Config } from "tailwindcss";
import { COLORS, SHADOWS, SPACING, TRANSITIONS, RADIUS } from "./src/lib/design-system";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        display: ["Plus Jakarta Sans", "sans-serif"],
        body: ["Plus Jakarta Sans", "DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Plus Jakarta Sans", "DM Sans", "sans-serif"],
      },
      colors: {
        // Existing CSS variable colors (keep for backward compatibility)
        border: "hsl(var(--border))",
        "border-subtle": "hsl(var(--border-subtle))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: COLORS.primary[50],
          100: COLORS.primary[100],
          200: COLORS.primary[200],
          300: COLORS.primary[300],
          400: COLORS.primary[400],
          500: COLORS.primary[500],
          600: COLORS.primary[600],
          700: COLORS.primary[700],
          800: COLORS.primary[800],
          900: COLORS.primary[900],
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Semantic status (existing)
        vc: {
          green: "hsl(var(--green))",
          "green-hover": "hsl(var(--green-hover))",
          "green-light": "hsl(var(--green-light))",
          "green-text": "hsl(var(--green-text))",
          amber: "hsl(var(--amber))",
          "amber-light": "hsl(var(--amber-light))",
          "amber-text": "hsl(var(--amber-text))",
          red: "hsl(var(--red))",
          "red-light": "hsl(var(--red-light))",
          "red-text": "hsl(var(--red-text))",
          blue: "hsl(var(--blue))",
          "blue-light": "hsl(var(--blue-light))",
          "blue-text": "hsl(var(--blue-text))",
          slate: "hsl(var(--slate))",
          "slate-light": "hsl(var(--slate-light))",
          "slate-text": "hsl(var(--slate-text))",
        },
        // NEW: Design System Colors - Neutral grays
        gray: {
          50: COLORS.gray[50],
          100: COLORS.gray[100],
          200: COLORS.gray[200],
          300: COLORS.gray[300],
          400: COLORS.gray[400],
          500: COLORS.gray[500],
          600: COLORS.gray[600],
          700: COLORS.gray[700],
          800: COLORS.gray[800],
          900: COLORS.gray[900],
        },
        // Status colors (using direct hex values from design system)
        success: COLORS.status.success,
        warning: COLORS.status.warning,
        error: COLORS.status.error,
        info: COLORS.status.info,
      },
      boxShadow: {
        xs: SHADOWS.xs,
        sm: SHADOWS.sm,
        md: SHADOWS.md,
        lg: SHADOWS.lg,
        xl: SHADOWS.xl,
      },
      spacing: SPACING,
      borderRadius: {
        sm: RADIUS.sm,
        md: RADIUS.md,
        lg: RADIUS.lg,
        xl: RADIUS.xl,
        "2xl": RADIUS["2xl"],
        full: RADIUS.full,
      },
      transitionDuration: {
        fast: TRANSITIONS.fast,
        base: TRANSITIONS.base,
        slow: TRANSITIONS.slow,
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;