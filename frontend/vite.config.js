import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = String(env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
  let apiOrigin = "";
  if (apiBase) {
    try {
      apiOrigin = new URL(apiBase).origin;
    } catch {
      apiOrigin = "";
    }
  }

  const devProxyTarget = String(env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8000").replace(
    /\/+$/,
    ""
  );

  return {
    // GitHub Pages project site: app is served from /court-legal-chatbot/ (see package.json "homepage").
    base: mode === "production" ? "/court-legal-chatbot/" : "/",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server:
      mode === "development"
        ? {
            proxy: {
              "^/(health|auth|intake|chat|ai-chat|admin|resources)(/|$)": {
                target: devProxyTarget,
                changeOrigin: true,
              },
            },
          }
        : undefined,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",

        // IMPORTANT: do NOT override manifest here
        manifest: false,

        includeAssets: ["cal_logo.png"],

        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        },

        devOptions: {
          enabled: false,
        },
      }),
      {
        name: "inject-api-preconnect",
        transformIndexHtml(html) {
          if (!apiOrigin) return html;
          const tags = `
    <link rel="preconnect" href="${apiOrigin}" crossorigin />
    <link rel="dns-prefetch" href="${apiOrigin}" />`;
          const anchor = /<meta\s+name="viewport"[^>]*>/i;
          if (anchor.test(html)) {
            return html.replace(anchor, (m) => `${m}${tags}`);
          }
          return html.replace("</head>", `${tags}\n</head>`);
        },
      },
    ],
  };
});