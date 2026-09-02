import dotenv from 'dotenv';

/**
 * Single source of truth for anything that changes between a laptop and a CI
 * runner. Nothing in the page objects or the specs reads process.env directly -
 * if a value can differ per environment it belongs here.
 *
 * Precedence: real environment variable > .env file > default below. CI sets
 * real variables, so it never picks up a stray local .env.
 */
dotenv.config({ quiet: true });

/**
 * 127.0.0.1 rather than localhost, deliberately. localhost resolves to both the
 * IPv4 and IPv6 loopback and the browser picks; the preview server binds to one.
 * Firefox intermittently chose the address nothing was listening on and failed
 * with a connection refused mid-run. Naming the address removes the guess.
 */
const DEFAULT_BASE_URL = 'http://127.0.0.1:4173';

const baseUrl = process.env.BASE_URL?.trim() || DEFAULT_BASE_URL;

export const config = {
  /**
   * Where the app under test is served. Set BASE_URL to point the suite at a
   * deployed build instead; when you do, Playwright skips starting its own server
   * rather than building locally and then testing something else entirely.
   */
  baseUrl,

  /**
   * Whether the suite is responsible for serving the app. False as soon as
   * BASE_URL names somewhere other than the local preview - see playwright.config.
   */
  servesAppItself: baseUrl === DEFAULT_BASE_URL,

  isCI: !!process.env.CI,
} as const;

/**
 * The timeout budget, in one place.
 *
 * The rule that matters: `test` has to be comfortably larger than the slowest
 * legitimate sequence of steps inside it, otherwise a slow-but-correct run turns
 * into a false failure and people start ignoring red builds.
 *
 * This app is a static bundle with no backend, so these are generous. They exist
 * to fail fast on a genuinely hung page, not to paper over slowness.
 */
export const TIMEOUTS = {
  /** One click or fill. */
  action: 10_000,
  /** One auto-retrying assertion. */
  expect: 5_000,
  /**
   * A full page load. Generous for a local static bundle, and deliberately so:
   * a cold Firefox or WebKit start is several times slower than Chromium, and a
   * test that fails because the budget was tight rather than because the app
   * broke is the fastest way to teach a team to ignore a red build.
   */
  navigation: 45_000,
  /** A whole test, with room for the slowest legitimate sequence inside one. */
  test: 60_000,
} as const;
