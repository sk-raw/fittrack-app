import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: { allowedHosts: ['terminal.local'], proxy: { '/api': 'http://localhost:3001' } },
  plugins: [react(), tailwindcss()],
})