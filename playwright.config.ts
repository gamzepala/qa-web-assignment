import { defineConfig, devices } from '@playwright/test';
import { config, TIMEOUTS } from './e2e/src/config/env';

/**
 * Playwright runs one browser per worker and one fresh BrowserContext per test.
 * That context boundary is what isolates the tests from each other: the app keeps
 * its session in localStorage, so without a clean context per test a logged-in
 * test would leak its session into the next one.
 *
 * Every timeout lives in e2e/src/config/env.ts so there is one place to tune them.
 */
export default defineConfig({
  testDir: './e2e/tests',

  // The suite is stateless, so there is no reason to serialise anything.
  fullyParallel: true,

  // A stray .only would silently shrink the suite to one test in CI.
  forbidOnly: config.isCI,

  /**
   * One retry in CI to absorb runner hiccups (a cold browser start, a slow
   * preview server boot). Locally we want a failure to stay failed so it gets
   * fixed rather than retried away.
   */
  retries: config.isCI ? 1 : 0,

  // Two workers in CI: GitHub's standard runner has 2 cores and browsers are heavy.
  workers: config.isCI ? 2 : undefined,

  timeout: TIMEOUTS.test,
  expect: { timeout: TIMEOUTS.expect },

  reporter: config.isCI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: config.baseUrl,
    actionTimeout: TIMEOUTS.action,
    navigationTimeout: TIMEOUTS.navigation,

    /**
     * A trace is the difference between "the CI job went red overnight" and
     * "here is the DOM, the network and every action at the moment it broke".
     * Kept only for failures so a green run costs nothing.
     */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /a11y\//,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /a11y\//,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /a11y\//,
    },
    {
      /**
       * The login form is the whole app on mobile, and the stylesheet has its own
       * breakpoint for it. Only the smoke path runs here - the input validation
       * cases are viewport-independent and would just duplicate the desktop run.
       */
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      grep: /@smoke/,
      testIgnore: /a11y\//,
    },
    {
      /**
       * Accessibility lives in its own project so a new axe rule can never block
       * a functional merge. Run it with: npm run test:a11y
       */
      name: 'a11y',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /a11y\/.*\.spec\.ts/,
    },
  ],

  /**
   * Tests run against the production build rather than the dev server. It is what
   * actually ships, and it avoids the dev server's HMR websocket showing up as
   * unexpected network noise in the console-error checks.
   *
   * Skipped entirely when BASE_URL points somewhere else. Without that check,
   * setting BASE_URL to a deployed environment would still build and serve the app
   * locally and then quietly test the remote one - config that claims a capability
   * it does not have is worse than config that has none.
   */
  webServer: config.servesAppItself
    ? {
        command: 'npm run build && npm run preview',
        url: config.baseUrl,
        reuseExistingServer: !config.isCI,
        timeout: 120_000,
        // Build output is kept: when the server fails to come up, the reason is
        // almost always in there, and discarding it leaves only a port timeout.
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,
});
