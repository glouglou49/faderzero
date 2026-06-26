import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

const devPfxPath = path.resolve(__dirname, './.cert/localhost-dev.pfx');
const httpsConfig = fs.existsSync(devPfxPath)
  ? {
      pfx: fs.readFileSync(devPfxPath),
      passphrase: 'faderzero-dev',
    }
  : undefined;

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    https: httpsConfig,
  },
  preview: {
    host: true,
    port: 4173,
    https: httpsConfig,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FaderZero PWA',
        short_name: 'FaderZero',
        description: 'Workspace offline-first pour morceaux, setlists et prompteur.',
        theme_color: '#151312',
        background_color: '#151312',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
