import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    // Allow Cloudflare Tunnel host (Quick Tunnel domain)
    allowedHosts: [
      'yoga-garage-newton-transmitted.trycloudflare.com',
    ],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'BiuBiu English',
        short_name: 'BiuBiu',
        description: 'Learn English with BiuBiu Robot',
        theme_color: '#ffffff',
        icons: [
          { src: '/logo-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
})
