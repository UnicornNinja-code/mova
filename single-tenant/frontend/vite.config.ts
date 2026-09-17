import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 8074,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:8090',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 8074,
    strictPort: true,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react-native': 'react-native-web',
    },
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 1200,
  },
})