import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const requiredEnvironmentVariables = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const

function validateEnvironment(mode: string) {
  const environment = loadEnv(mode, '.', '')
  const missing = requiredEnvironmentVariables.filter(
    (name) => !environment[name]?.trim(),
  )

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Set them in .env.local for local development or in Vercel Project Settings.',
    )
  }

  if (
    environment.VITE_SUPABASE_URL === 'https://your-project-ref.supabase.co' ||
    environment.VITE_SUPABASE_ANON_KEY.startsWith('your-')
  ) {
    throw new Error('Replace the example Supabase environment values before building.')
  }

  try {
    const supabaseUrl = new URL(environment.VITE_SUPABASE_URL)
    if (!['http:', 'https:'].includes(supabaseUrl.protocol)) throw new Error()
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid HTTP(S) URL.')
  }
}

export default defineConfig(({ mode }) => {
  validateEnvironment(mode)

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
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
    },
  }
})
