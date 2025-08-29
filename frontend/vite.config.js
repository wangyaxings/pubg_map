import { defineConfig } from 'vite'

// Keep dev and prod paths consistent: serve under /static
// Only proxy the subsets that actually live in backend (/static/tiles, /static/uploads)
export default defineConfig({
  base: '/static/',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      // Proxy backend-served map tiles
      '/static/tiles': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      // Proxy uploaded images directory to backend
      '/static/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  publicDir: 'public',
  assetsInclude: ['**/*.png']
})
