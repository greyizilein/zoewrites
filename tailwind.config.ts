import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        teal: {
          DEFAULT: "hsl(var(--teal))",
          foreground: "hsl(var(--teal-foreground))",
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
        // Brand palette
        charcoal: {
          DEFAULT: "hsl(24, 14%, 10%)",
          50: "hsl(24, 14%, 97%)",
          100: "hsl(24, 14%, 90%)",
          200: "hsl(24, 14%, 75%)",
          300: "hsl(24, 14%, 55%)",
          400: "hsl(24, 14%, 35%)",
          500: "hsl(24, 14%, 20%)",
          600: "hsl(24, 14%, 15%)",
          700: "hsl(24, 14%, 12%)",
          800: "hsl(24, 14%, 10%)",
          900: "hsl(24, 14%, 8%)",
          950: "hsl(24, 14%, 5%)",
        },
        terracotta: {
          DEFAULT: "hsl(18, 50%, 53%)",
          50: "hsl(18, 50%, 96%)",
          100: "hsl(18, 50%, 90%)",
          200: "hsl(18, 50%, 78%)",
          300: "hsl(18, 50%, 66%)",
          400: "hsl(18, 50%, 58%)",
          500: "hsl(18, 50%, 53%)",
          600: "hsl(18, 50%, 45%)",
          700: "hsl(18, 50%, 36%)",
          800: "hsl(18, 50%, 28%)",
          900: "hsl(18, 50%, 20%)",
        },
        sage: {
          DEFAULT: "hsl(153, 16%, 42%)",
          50: "hsl(153, 16%, 96%)",
          100: "hsl(153, 16%, 88%)",
          200: "hsl(153, 16%, 72%)",
          300: "hsl(153, 16%, 58%)",
          400: "hsl(153, 16%, 50%)",
          500: "hsl(153, 16%, 42%)",
          600: "hsl(153, 16%, 34%)",
        },
        clay: {
          DEFAULT: "hsl(24, 20%, 46%)",
        },
        cream: {
          DEFAULT: "hsl(40, 33%, 98%)",
          dark: "hsl(37, 30%, 95%)",
        },
        sand: {
          DEFAULT: "hsl(37, 45%, 93%)",
        },
        "muted-blue": {
          DEFAULT: "hsl(212, 38%, 43%)",
        },
        "dusty-purple": {
          DEFAULT: "hsl(263, 28%, 51%)",
        },
        "dusty-rose": {
          DEFAULT: "hsl(351, 40%, 56%)",
        },
        "warm-gold": {
          DEFAULT: "hsl(37, 56%, 50%)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("tailwindcss-animate")],
} satisfies Config;
