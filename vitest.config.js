import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

// Kept separate from vite.config.js so the app's build config stays free of test
// concerns. Without the exclude, Vitest tries to collect the Playwright specs in
// e2e/ and fails on the imports it cannot resolve.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['js/**/*.test.js', 'src/**/*.spec.js'],
      exclude: ['node_modules/**', 'dist/**', 'e2e/**']
    }
  })
)
