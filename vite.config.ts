import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // O service worker de push do FCM é um arquivo separado em public/.
      // Não deixamos o Workbox tentar controlá-lo.
      injectRegister: 'auto',
      workbox: {
        // Precache do app offline. psalms.json NÃO entra: ele é atualizado
        // independentemente do bundle JS e o fetch em runtime cuida disso.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/psalms.json'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/firebase-messaging-sw\.js$/],
        runtimeCaching: [
          {
            // Áudio dos salmos: cacheia sob demanda, o que já foi ouvido fica offline.
            urlPattern: /\/audio\/.*\.(mp3|m4a|ogg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'salmos-audio',
              expiration: { maxEntries: 160, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
        ],
      },
      manifest: {
        name: 'Projeto Salmos',
        short_name: 'Salmos',
        description: 'Um salmo por dia, do 1 ao 150.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#101a45',
        theme_color: '#101a45',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
