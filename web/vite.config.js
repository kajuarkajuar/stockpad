import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base './' so a production build can also be opened statically.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
