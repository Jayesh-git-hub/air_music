import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves from the repo name subpath
  base: "/air_music/",
  server: {
    host: true,
    port: 3000,
  },
  build: {
    outDir: "dist",
  },
  optimizeDeps: {
    exclude: ["@mediapipe/tasks-vision"],
  },
});
