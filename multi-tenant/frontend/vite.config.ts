import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_SOCKET_URL || (env.VITE_API_URL ? env.VITE_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:9968')

  return {
    plugins: [
      tailwindcss(),
      svelte()
    ],
    resolve: {
      alias: {
        $lib: path.resolve(__dirname, './src/lib'),
        $components: path.resolve(__dirname, './src/components')
      }
    },
    server: {
      host: true,
      allowedHosts: true,
      port: 9967,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendTarget,
          ws: true,
        },
        '/data-map': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
        }
      }
    }
  }
})
