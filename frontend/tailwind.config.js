/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Modern quantum-ish palette: deep navy + electric cyan accents
        canvas: "#0b1020",        // app background
        surface: "#111830",       // panel background
        surfaceAlt: "#151d38",    // card background
        edge: "#1f2a4a",          // borders
        mute: "#8492c7",          // secondary text
        ink: "#e6ebff",           // primary text
        accent: "#4cc9f0",        // cyan — primary action
        accent2: "#7b5cff",       // violet — QuCAD
        accent3: "#f72585",       // magenta — QuBound
        accent4: "#06d6a0",       // teal — CompressVQC
        warn: "#f4a261",
        danger: "#ef476f",
        ok: "#2dd4bf",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(76,201,240,0.35), 0 8px 24px -6px rgba(76,201,240,0.25)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 30px -10px rgba(0,0,0,0.55)",
      },
    },
  },
  plugins: [],
};
