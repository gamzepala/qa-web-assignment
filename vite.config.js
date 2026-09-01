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
  //
  // host is pinned to 127.0.0.1 rather than left as localhost. By default the
  // server binds to the IPv6 loopback only, and "localhost" resolves to either
  // stack depending on the client - Chromium picked ::1 every time, Firefox
  // sometimes picked 127.0.0.1 and got connection refused partway through a run.
  // Naming one address makes the whole thing unambiguous.
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    open: false
  }
})

