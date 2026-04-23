import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev` we proxy /api to the local FastAPI uvicorn.
// In production the backend serves frontend/dist directly so no proxy is needed.
export default defineConfig({
  plugins: [react()],
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
