import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${Date.now()}[hash].js`,
        chunkFileNames: `assets/[name]-${Date.now()}[hash].js`,
        assetFileNames: `assets/[name]-${Date.now()}[hash][extname]`
      }
    }
  },
  
  plugins: [react()],
})
