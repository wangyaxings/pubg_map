import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      // Proxy static tiles to backend during development
      '/static': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  publicDir: 'public',
  assetsInclude: ['**/*.png']
})
