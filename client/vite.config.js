import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          sentry: ['@sentry/react'],
          sockets: ['socket.io-client'],
          vendor: ['axios']
        }
      }
    }
  },
  server: {
    port: 5173 // Use consistent port for Vite dev server
  }
})
