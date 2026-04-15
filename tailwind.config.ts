import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f6faf7",
          100: "#ebf4ee",
          200: "#d3e8db",
          300: "#afd2bd",
          400: "#74b08d",
          500: "#428c62",
          600: "#2f704e",
          700: "#25593f",
          800: "#1f4734",
          900: "#1a3b2d"
        },
        ink: "#122117",
        sand: "#f7f1e8",
        amber: "#c28c3d",
        danger: "#a43e3e"
      },
      boxShadow: {
        panel: "0 24px 60px rgba(18, 33, 23, 0.08)"
      },
      backgroundImage: {
        "dashboard-grid":
          "radial-gradient(circle at top, rgba(66, 140, 98, 0.12), transparent 38%), linear-gradient(135deg, rgba(247, 241, 232, 0.95), rgba(255, 255, 255, 0.92))"
      }
    }
  },
  plugins: []
};

export default config;
