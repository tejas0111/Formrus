import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/widget.tsx"),
      name: "FormrusEmbed",
      fileName: () => "widget.js",
      formats: ["iife"],
    },
    outDir: "dist-widget",
    emptyOutDir: true,
    rollupOptions: {
      // We don't want to externalize anything for the widget to be self-contained
      // but React might be too large if bundled.
      // However, for a drop-in widget, bundling React is common if the host doesn't have it.
    },
  },
});
