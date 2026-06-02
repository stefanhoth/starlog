import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      base: command === 'build' ? '/starlog/' : '/',
      manifest: {
        name: 'StarLog',
        short_name: 'StarLog',
        description: "Log your work stories, map them to competencies, rehearse until you're ready.",
        start_url: '/starlog/',
        scope: '/starlog/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#4f46e5',
        icons: [
          { src: '/starlog/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/starlog/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/starlog/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  base: command === 'build' ? '/starlog/' : '/',
  build: {
    sourcemap: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? 'dev'),
  },
}))
