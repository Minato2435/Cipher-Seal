/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EDF0F3",
        ink: "#14181F",
        "ink-soft": "#5B6470",
        instrument: "#0B1220",
        phosphor: "#86E5D0",
        calm: "#3A4453",
        elevated: "#C98A2B",
        high: "#C1541F",
        critical: "#A01E22",
      },
      fontFamily: {
        display: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
