import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// The "attendance" scope is the only offline-first route (TRD 5.1). Other
// routes are network-required for staff/manager screens.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Детсад CRM",
        short_name: "Детсад CRM",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2563eb",
        icons: [],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\/api\/attendance\/.*/,
            handler: "NetworkOnly",
            options: {
              backgroundSync: {
                name: "attendance-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
