import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      // IMPORTANT: do NOT override manifest here
      manifest: false,

      includeAssets: [
        "cal_logo.png"
      ],

      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
      },

      devOptions: {
        enabled: true
      }
    }),
  ],
});