/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0A0D16",
        surface: "#121724",
        "surface-2": "#161C2C",
        line: "#242C40",
        text: "#E8EBF5",
        muted: "#8B93A8",
        faint: "#5A6379",
        violet: "#7C5CFF",
        cyan: "#3DD6D0",
        gold: "#F5C451",
        "risk-calm": "#5B6478",
        "risk-elevated": "#F2A93B",
        "risk-high": "#F26430",
        "risk-critical": "#F03D5F",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "aurora-drift": {
          "0%,100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "seal-pop": {
          "0%": { transform: "scale(.5)", opacity: "0" },
          "70%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 var(--ring)" },
          "70%": { boxShadow: "0 0 0 12px transparent" },
          "100%": { boxShadow: "0 0 0 0 transparent" },
        },
      },
      animation: {
        "rise-in": "rise-in .38s cubic-bezier(.2,.7,.3,1) both",
        "aurora-drift": "aurora-drift 8s ease-in-out infinite",
        "seal-pop": "seal-pop .3s ease-out both",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};
