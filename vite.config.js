import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/reserve-inventory/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icons.svg'],
      manifest: {
        name: 'リザーブ在庫システム',
        short_name: '在庫システム',
        description: 'リザーブ在庫の入庫・出庫・履歴管理アプリ',
        start_url: '/reserve-inventory/',
        scope: '/reserve-inventory/',
        display: 'standalone',
        background_color: '#f5f7fb',
        theme_color: '#2563eb',
        icons: [
          {
            src: '/reserve-inventory/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/reserve-inventory/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
      },
    }),
  ],
})