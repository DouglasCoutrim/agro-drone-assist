import type { Config } from "tailwindcss";

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
          50: "hsl(var(--primary) / 0.05)",
          100: "hsl(var(--primary) / 0.1)",
          200: "hsl(var(--primary) / 0.2)",
          300: "hsl(var(--primary) / 0.3)",
          400: "hsl(var(--primary) / 0.4)",
          500: "hsl(var(--primary))",
          600: "hsl(var(--primary))",
          700: "hsl(var(--primary))",
          800: "hsl(var(--primary))",
          900: "hsl(var(--primary))",
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
        error: "hsl(var(--destructive))",
        info: "hsl(var(--blue))",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-lg)",
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "200ms",
        slow: "300ms",
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