import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    open: true
  },
  // Preview inherits server.open, which tries to launch a desktop browser.
  // Harmless when you run it by hand, but it has nowhere to go on a CI runner,
  // so the automated suite serves the built bundle from here instead.
  preview: {
    port: 4173,
    strictPort: true,
    open: false
  }
})

