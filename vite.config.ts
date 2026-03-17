import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { resolve } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const isAnalyze = process.env.ANALYZE === 'true'

// BUG-12: Plugin to inject build hash into sw.js after build
function swBuildHashPlugin() {
  return {
    name: 'sw-build-hash',
    closeBundle() {
      const swPath = resolve(__dirname, 'dist/sw.js')
      try {
        const content = readFileSync(swPath, 'utf-8')
        const hash = Date.now().toString(36)
        const updated = content.replace('__BUILD_HASH__', hash)
        writeFileSync(swPath, updated, 'utf-8')
        console.log(`[sw-build-hash] Injected hash: ${hash}`)
      } catch {
        // sw.js may not exist in dev mode
      }
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    swBuildHashPlugin(),
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
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
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
          'date': ['date-fns', 'date-fns-tz'],
          'validation': ['zod'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
