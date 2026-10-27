/* global process */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// O frontend chama "/api/..." e o Vite repassa para o Flask.
// Assim não há URL fixa no código nem problemas de CORS em desenvolvimento.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
