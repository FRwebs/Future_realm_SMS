import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "rgb(var(--color-primary-50-rgb) / <alpha-value>)",
          100: "rgb(var(--color-primary-100-rgb) / <alpha-value>)",
          200: "rgb(var(--color-primary-200-rgb) / <alpha-value>)",
          300: "rgb(var(--color-primary-300-rgb) / <alpha-value>)",
          400: "rgb(var(--color-primary-400-rgb) / <alpha-value>)",
          500: "rgb(var(--color-primary-500-rgb) / <alpha-value>)",
          600: "rgb(var(--color-primary-600-rgb) / <alpha-value>)",
          700: "rgb(var(--color-primary-700-rgb) / <alpha-value>)",
          800: "rgb(var(--color-primary-800-rgb) / <alpha-value>)",
          900: "rgb(var(--color-primary-900-rgb) / <alpha-value>)",
        },
        brand: {
          50: "rgb(var(--color-primary-50-rgb) / <alpha-value>)",
          100: "rgb(var(--color-primary-100-rgb) / <alpha-value>)",
          200: "rgb(var(--color-primary-200-rgb) / <alpha-value>)",
          300: "rgb(var(--color-primary-300-rgb) / <alpha-value>)",
          400: "rgb(var(--color-primary-400-rgb) / <alpha-value>)",
          500: "rgb(var(--color-primary-500-rgb) / <alpha-value>)",
          600: "rgb(var(--color-primary-600-rgb) / <alpha-value>)",
          700: "rgb(var(--color-primary-700-rgb) / <alpha-value>)",
          800: "rgb(var(--color-primary-800-rgb) / <alpha-value>)",
          900: "rgb(var(--color-primary-900-rgb) / <alpha-value>)",
        },
        ink: "rgb(var(--color-ink-rgb) / <alpha-value>)",
        sand: "rgb(var(--color-slate-50-rgb) / <alpha-value>)",
        amber: "rgb(var(--color-amber-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-red-rgb) / <alpha-value>)",
      },
      boxShadow: {
        panel: "0 16px 40px rgba(18, 33, 23, 0.10)",
      },
      backgroundImage: {
        "dashboard-grid":
          "radial-gradient(circle at top, var(--color-accent-primary-dim), transparent 38%), linear-gradient(135deg, color-mix(in srgb, var(--color-bg-base) 96%, transparent), color-mix(in srgb, var(--color-bg-surface) 94%, transparent))",
      },
    },
  },
  plugins: [],
};

export default config;
