import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env file based on the current active configuration mode (development, production, etc.)
  // This searches your root directory and pulls in variables cleanly.
  const env = loadEnv(mode, process.cwd(), '')

  // Fallback target validation to prevent proxy failures if env isn't loaded yet
  const proxyTarget = env.VITE_API_BASE_URL || 'http://localhost:3000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/config': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
  }
})