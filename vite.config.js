import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      // Proxy all /api requests to our local Express server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
