import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
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
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
