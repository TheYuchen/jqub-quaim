import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Double-anonymous builds (`VITE_ANON=1 npm run build`) must not serve
// identifying strings in ANY static asset, not just the JS bundle. The
// JS side is handled by src/lib/anon.ts (build-time constant folding);
// this plugin covers index.html (title placeholders) and the PWA
// manifest (rewritten post-build).
const anonBuild = process.env.VITE_ANON === "1";
const APP_TITLE = anonBuild ? "EvidenceQ" : "QuDA Studio";

function anonStaticAssets(): Plugin {
  return {
    name: "anon-static-assets",
    transformIndexHtml(html) {
      return html
        .replaceAll("%APP_TITLE%", APP_TITLE)
        .replaceAll(
          "%THEME_KEYS%",
          anonBuild ? '["dark"]' : '["dark", "gmu"]',
        );
    },
    generateBundle(_options, bundle) {
      // Anonymous builds must not ship the university-branded theme
      // block in the stylesheet either — a curious reviewer reading
      // the served CSS would find the brand name in the selector.
      // The block is self-contained (one attribute selector, flat
      // declarations, no nested braces), so a brace-bounded regex is
      // safe. The JS side (theme registry + stored-preference
      // fallback) is dead-code-eliminated in src/lib/theme.ts.
      if (!anonBuild) return;
      for (const item of Object.values(bundle)) {
        if (
          item.type === "asset" &&
          item.fileName.endsWith(".css") &&
          typeof item.source === "string"
        ) {
          item.source = item.source.replace(
            /\[data-theme=(?:"gmu"|gmu)\]\s*\{[^}]*\}/g,
            "",
          );
        }
      }
    },
    writeBundle(options) {
      if (!anonBuild) return;
      const dir = options.dir ?? resolve(__dirname, "dist");
      writeFileSync(
        resolve(dir, "manifest.webmanifest"),
        JSON.stringify(
          {
            name: APP_TITLE,
            short_name: APP_TITLE,
            description:
              "Visual workbench for composing, running, and comparing stochastic computational experiments with full provenance.",
            start_url: "/",
            display: "standalone",
            background_color: "#f6f7fb",
            theme_color: "#f6f7fb",
            icons: [
              { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
            ],
          },
          null,
          2,
        ),
      );
    },
  };
}

// During `npm run dev` we proxy /api to the local FastAPI uvicorn.
// In production the backend serves frontend/dist directly so no proxy is needed.
export default defineConfig({
  plugins: [react(), anonStaticAssets()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:7860",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
