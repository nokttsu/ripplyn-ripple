import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from /ripplyn-ripple/
export default defineConfig({
  base: '/ripplyn-ripple/',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 800 },
})
