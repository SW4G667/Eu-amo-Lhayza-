import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070809",
          900: "#0A0C0D",
          850: "#0C0F10",
          800: "#101314",
          750: "#141819",
          700: "#191D1F",
          600: "#232829",
          500: "#333A3C",
        },
        bone: {
          50: "#F4F6F3",
          100: "#E9EDE7",
          200: "#D6DCD3",
          300: "#B4BDB0",
          400: "#8C978A",
          500: "#6C766B",
          600: "#4C554B",
          700: "#363D35",
        },
        lime: {
          300: "#DDF79C",
          400: "#CBEF6E",
          500: "#B8E44A",
          600: "#96C22F",
        },
        ember: "#FF7A5C",
        amberglow: "#F2BA55",
        mint: "#63E6A4",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        panel: "inset 0 1px 0 rgba(255,255,255,0.035), 0 1px 0 rgba(0,0,0,0.5)",
        lift: "0 24px 60px -24px rgba(0,0,0,0.85)",
        glow: "0 0 0 1px rgba(203,239,110,0.25), 0 10px 40px -12px rgba(203,239,110,0.25)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.82)" },
        },
        sweep: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(220%)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "row-in": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.28s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        sweep: "sweep 2.4s cubic-bezier(0.4,0,0.2,1) infinite",
        "toast-in": "toast-in 0.22s cubic-bezier(0.16,1,0.3,1) both",
        "row-in": "row-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
