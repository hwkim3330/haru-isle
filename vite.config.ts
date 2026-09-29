import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/haru-isle/" : "./",
  server: { port: 5471, strictPort: true },
  build: { target: "es2022", chunkSizeWarningLimit: 3000 },
  define: { __BUILD__: JSON.stringify(process.env.BUILD_ID ?? "dev") },
});
