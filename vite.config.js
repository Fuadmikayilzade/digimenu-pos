import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ⚠️ Electron `file://` protokolu ilə açır (adi veb server yox) — bu
  // olmadan build olunmuş JS/CSS faylları tapılmır, "boş ağ ekran" çıxır:
  base: './',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})