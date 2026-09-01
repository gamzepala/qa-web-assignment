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

const DEFAULT_BASE_URL = 'http://localhost:4173';

function required(name: string, value: string | undefined, fallback: string): string {
  const resolved = value?.trim() || fallback;
  if (!resolved) {
    throw new Error(
      `Missing configuration "${name}". Set it as an environment variable, ` +
        `or copy .env.example and fill it in.`,
    );
  }
  return resolved;
}

export const config = {
  /** Where the app under test is served. Overridable so the suite can point at a deployed build. */
  baseUrl: required('BASE_URL', process.env.BASE_URL, DEFAULT_BASE_URL),

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
  /** A full page load. */
  navigation: 30_000,
  /** A whole test. */
  test: 30_000,
} as const;
