/** @type {import('tailwindcss').Config} */
// Color tokens are CSS variables so themes can swap them at runtime without
// re-building Tailwind. The variable values are `R G B` triplets (no commas,
// no rgb() wrapper) so Tailwind's `/ <alpha-value>` slash syntax still works
// — e.g. `bg-canvas/80` compiles to `rgb(var(--color-canvas) / 0.8)`.
// Default (dark) values live in `index.css :root`; `[data-theme="light"]`
// and `[data-theme="gmu"]` override them.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        surfaceAlt: "rgb(var(--color-surfaceAlt) / <alpha-value>)",
        edge: "rgb(var(--color-edge) / <alpha-value>)",
        mute: "rgb(var(--color-mute) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        accent2: "rgb(var(--color-accent2) / <alpha-value>)",
        accent3: "rgb(var(--color-accent3) / <alpha-value>)",
        accent4: "rgb(var(--color-accent4) / <alpha-value>)",
        warn: "rgb(var(--color-warn) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        ok: "rgb(var(--color-ok) / <alpha-value>)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--color-accent) / 0.35), 0 8px 24px -6px rgb(var(--color-accent) / 0.25)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 30px -10px rgba(0,0,0,0.55)",
      },
    },
  },
  plugins: [],
};
