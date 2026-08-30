/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f3f2f2",
        paper: "#faf9f7",
        ink: "#201f1d",
        n500: "#8c8377",
        n600: "#6b6255",
        n700: "#4a4339",
        gold: "#b68235",
        "gold-600": "#996a28",
        "gold-800": "#553a15",
        instrument: "#161209",
        "risk-elevated": "#996a28",
        "risk-high": "#9c4a22",
        "risk-critical": "#7a1f1f",
      },
      fontFamily: {
        head: ['"Cormorant Garamond"', "serif"],
        body: ['"Lora"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "4px", lg: "6px" },
    },
  },
  plugins: [],
};
