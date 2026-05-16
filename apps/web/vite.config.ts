import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, "index.html"),
        widget: resolve(__dirname, "src/widget.tsx"),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "widget" ? "widget.js" : "assets/[name]-[hash].js"),
      },
    },
  },
});
