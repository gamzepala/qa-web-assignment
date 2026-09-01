import { type Page } from '@playwright/test';
import { SESSION_KEY } from '../testdata/users';

/**
 * Reads the session the app keeps in localStorage.
 *
 * This is the independent half of the login assertions: the visible page tells
 * you the UI switched screens, this tells you a session was actually created and
 * for whom. A login that renders the logged-in view without storing a session -
 * or stores the wrong identity - passes the first check and fails this one.
 *
 * It is a one-shot read with no retry, so always use it through expect.poll()
 * after an action rather than asserting on the returned value directly.
 */
export function readSession(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), SESSION_KEY);
}

/** Plants a session value directly, for the tests that probe what the app trusts. */
export function writeSession(page: Page, value: string): Promise<void> {
  return page.evaluate(
    ([key, sessionValue]) => window.localStorage.setItem(key, sessionValue),
    [SESSION_KEY, value] as const,
  );
}
