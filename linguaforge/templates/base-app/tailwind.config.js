/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm, low-glare neutrals instead of clinical slate — the app is
        // meant to be looked at for long study sessions.
        canvas: {
          light: "#faf9f7",
          dark: "#15181d",
        },
      },
      keyframes: {
        "flip-in": {
          "0%": { transform: "rotateY(90deg)", opacity: "0" },
          "100%": { transform: "rotateY(0deg)", opacity: "1" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-up": {
          "0%": { transform: "translateY(4px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "flip-in": "flip-in 0.35s ease-out",
        "pop-in": "pop-in 0.25s ease-out",
        "fade-up": "fade-up 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
