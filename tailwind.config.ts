import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        foreground: {
          DEFAULT: "var(--text)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
        hero: {
          DEFAULT: "var(--hero-text)",
          muted: "var(--hero-text-muted)",
          faint: "var(--hero-text-faint)",
        },
        brand: {
          400: "#ff6b6b",
          500: "#e84444",
          600: "#d63a3a",
          700: "#a02525",
          800: "#5c1010",
          900: "#2e0808",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "Consolas", "monospace"],
      },
      letterSpacing: {
        "tightest-2": "-0.025em",
      },
      keyframes: {
        slowPulse: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "slow-pulse": "slowPulse 3.4s ease-in-out infinite",
        marquee: "marquee 30s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
