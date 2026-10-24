import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Resolve cert paths relative to the repo root (one level up from frontend/)
const repoRoot = path.resolve(__dirname, '..');
const keyPath = process.env['SSL_KEY_PATH'] ?? path.join(repoRoot, 'localhost-key.pem');
const certPath = process.env['SSL_CERT_PATH'] ?? path.join(repoRoot, 'localhost.pem');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',  // 'localhost' avoids Safari ITP bounce-tracking restrictions on IP origins
    port: 3000,
    strictPort: true, // fail explicitly rather than silently binding to a different port
    https: {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    },
    proxy: {
      '/api': {
        target: 'https://127.0.0.1:8080',
        secure: false, // accept self-signed cert on backend
        changeOrigin: false, // keep Host as 127.0.0.1:3000 — avoids http-proxy stripping Set-Cookie on HTTPS→HTTPS redirects
        configure: (proxy) => {
          // Explicitly forward Set-Cookie headers on all backend responses (including 302 redirects).
          // http-proxy can silently drop Set-Cookie on redirect responses in some configurations,
          // which causes the auth_verification transaction cookie to never reach the browser.
          proxy.on('proxyRes', (proxyRes, req, res) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              res.setHeader('set-cookie', setCookie);
            }
            if (req.url?.includes('/api/auth/')) {
              process.stdout.write(`[proxy] ${req.method} ${req.url} → ${proxyRes.statusCode} | Set-Cookie: ${setCookie ? 'YES' : 'none'}\n`);
            }
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.url?.includes('/api/auth/')) {
              process.stdout.write(`[proxy] → backend ${req.method} ${req.url} | Cookie: ${req.headers.cookie ? 'YES' : 'none'}\n`);
            }
          });
        },
      },
    },
  },
});
