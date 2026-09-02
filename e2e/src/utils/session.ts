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

/**
 * Makes every localStorage call throw, the way a real browser does when the user
 * has blocked site data, is in a locked-down private window, or has filled their
 * storage quota.
 *
 * This is the fault injection this app can actually have done to it. It makes no
 * requests of its own, so there is no network call to intercept - but it leans
 * completely on one browser API that is genuinely allowed to fail, and does not
 * guard a single call to it.
 *
 * Deliberately addInitScript rather than evaluate: this has to be in place before
 * the component mounts and reads storage, and it has to stay broken across
 * navigations, because that is what the real condition looks like.
 */
export async function denyLocalStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const denied = () => {
      throw new DOMException('Access to storage is not allowed from this context.', 'SecurityError');
    };

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => ({
        getItem: denied,
        setItem: denied,
        removeItem: denied,
        clear: denied,
        key: denied,
        length: 0,
      }),
    });
  });
}
