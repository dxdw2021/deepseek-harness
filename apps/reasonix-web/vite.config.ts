import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone Reasonix frontend. Dev server proxies /api to the DeepSeek-Harness
// web host so the same build can talk to a live backend during development.
//
// The host's /api trust fence (client-connection/api-request-trust) binds every
// request to a loopback Host and rejects cross-site browser markers. A plain
// cross-origin proxy would forward Origin: http://localhost:5174 plus
// sec-fetch-site: cross-site, which the fence refuses with 403. This dev-only
// proxy therefore rewrites those markers to look same-origin to the backend —
// the proxy is a local, trusted intermediary, so this does not weaken the
// DNS-rebinding/cross-site defenses the fence protects against.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.REASONIX_API_TARGET ?? "http://127.0.0.1:7890",
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("origin");
            proxyReq.setHeader("sec-fetch-site", "same-origin");
            proxyReq.setHeader("sec-fetch-mode", "same-origin");
            proxyReq.setHeader("sec-fetch-dest", "empty");
          });
          // WebSocket upgrades ride a different http-proxy event; rewrite the
          // same browser markers so /api/events.mux passes the trust fence too.
          proxy.on("proxyReqWs", (proxyReq) => {
            proxyReq.removeHeader("origin");
            proxyReq.setHeader("sec-fetch-site", "same-origin");
          });
        },
      },
      "/ws": {
        target: process.env.REASONIX_API_TARGET ?? "http://127.0.0.1:7890",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
