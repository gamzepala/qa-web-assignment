import { test as base, type Page } from '@playwright/test';
import { config } from '../config/env';
import { HomePage } from '../pages/home.page';
import { LoginPage } from '../pages/login.page';
import { SESSION_KEY, standardUser } from '../testdata/users';
import { blockThirdPartyRequests } from './network';

/** Everything the browser said during a test, in the order it said it. */
export class ConsoleLog {
  private readonly lines: string[] = [];

  record(line: string): void {
    this.lines.push(line);
  }

  get all(): readonly string[] {
    return this.lines;
  }

  /** Only the entries that indicate something went wrong. */
  get errors(): readonly string[] {
    return this.lines.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  }

  toText(): string {
    return this.lines.length ? this.lines.join('\n') : '(browser console was silent)';
  }
}

type Fixtures = {
  /** Applied to every test; see the comment on the fixture itself. */
  hermeticNetwork: void;
  consoleLog: ConsoleLog;
  loginPage: LoginPage;
  homePage: HomePage;
  /** A page that is already signed in, without going through the login form. */
  loggedInPage: Page;
};

export const test = base.extend<Fixtures>({
  /** Applied to every test - see blockThirdPartyRequests for the reasoning. */
  hermeticNetwork: [
    async ({ page }, use) => {
      await blockThirdPartyRequests(page);
      await use();
    },
    { auto: true },
  ],

  /**
   * Captures the browser console for the whole test and attaches it to the report
   * when the test fails. Costs nothing on a green run, and it is usually the
   * fastest way to understand a red one without reproducing it locally.
   */
  consoleLog: [
    async ({ page }, use, testInfo) => {
      const log = new ConsoleLog();
      const appHost = new URL(config.baseUrl).host;

      page.on('console', (message) => log.record(`[${message.type()}] ${message.text()}`));
      page.on('pageerror', (error) => log.record(`[pageerror] ${error.message}`));
      page.on('requestfailed', (request) => {
        // Off-origin requests are ours, aborted deliberately above - not a signal.
        if (new URL(request.url()).host !== appHost) return;
        log.record(`[netfail] ${request.url()} - ${request.failure()?.errorText}`);
      });

      await use(log);

      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('browser-console.log', {
          body: log.toText(),
          contentType: 'text/plain',
        });
      }
    },
    { auto: true },
  ],

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  /**
   * Seeds the session directly into localStorage instead of driving the login
   * form. Two reasons: the tests that use it are about what happens *after* you
   * are signed in, and routing them through the UI would mean one login bug
   * fails a dozen unrelated tests. The login form has its own tests; this is not
   * one of them.
   *
   * Deliberately not addInitScript: that re-runs on every navigation, so a test
   * that signed out and refreshed would be handed the session straight back and
   * would report a working logout no matter what the app did. Loading once,
   * writing the key, then reloading seeds it exactly once and leaves reloads
   * behaving the way they do for a real user.
   */
  loggedInPage: async ({ page, hermeticNetwork }, use) => {
    void hermeticNetwork; // ordering: request blocking must be in place before we navigate

    await page.goto('/');
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [SESSION_KEY, standardUser.email] as const,
    );
    await page.reload();

    await use(page);
  },
});

export { expect } from '@playwright/test';
