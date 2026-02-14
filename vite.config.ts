import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { resolve } from 'path'

const isAnalyze = process.env.ANALYZE === 'true'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    // Bundle analyzer - only enabled when ANALYZE=true
    isAnalyze &&
      visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'motion': ['framer-motion'],
          'headless': ['@headlessui/react'],
          'icons': ['lucide-react'],
          'aria': ['react-aria-components'],
          'db': ['dexie'],
          'state': ['zustand'],
          'map': ['leaflet', 'react-leaflet'],
          'google-maps': ['@googlemaps/js-api-loader'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'pdf': ['@react-pdf/renderer'],
          'sentry': ['@sentry/react'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
