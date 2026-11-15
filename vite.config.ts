import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.ico'],
      manifest: {
        name: 'OzempicAI',
        short_name: 'OzempicAI',
        description: 'Personal health & fitness tracker',
        theme_color: '#C76F4A',
        background_color: '#F5EFE6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // API calls are never navigations, but keep the SPA fallback off them.
        navigateFallbackDenylist: [/^\/api\//, /^\/\.well-known\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    // `npm run dev` in server/ serves the API on 8787.
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8787',
      '/.well-known/oauth-': process.env.API_PROXY_TARGET ?? 'http://localhost:8787',
    },
  },
  preview: {
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8787',
      '/.well-known/oauth-': process.env.API_PROXY_TARGET ?? 'http://localhost:8787',
    },
  },
})
