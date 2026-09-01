import { config } from '../src/config/env';
import { expect, test } from '../src/fixtures/fixtures';
import { blockThirdPartyRequests } from '../src/fixtures/network';
import { HomePage } from '../src/pages/home.page';
import { LoginPage } from '../src/pages/login.page';
import { SESSION_KEY, standardUser } from '../src/testdata/users';
import { readSession, writeSession } from '../src/utils/session';

/**
 * What happens after the sign-in, and on the way back out.
 *
 * These tests seed the session directly rather than driving the login form.
 * Logging in through the UI as a precondition would mean one bug in the form
 * turns every test in this file red, which tells you nothing you did not
 * already know from the login suite.
 */
test.describe('Session lifetime', () => {
  test('survives a page reload', async ({ loggedInPage, homePage }) => {
    // The session is kept in localStorage, so it is expected to outlive the tab.
    // Catches a regression to sessionStorage or to an in-memory flag, either of
    // which would silently sign people out on refresh.
    await homePage.expectLoaded();

    await loggedInPage.reload();

    await homePage.expectLoaded();
    await expect.poll(() => readSession(loggedInPage)).toBe(standardUser.email);
  });

  test('ends when the user signs out @smoke', async ({ loggedInPage, homePage, loginPage }) => {
    await homePage.expectLoaded();

    await homePage.logout();

    await loginPage.expectLoaded();
    await expect(homePage.nav.root).toBeHidden();
    await expect
      .poll(() => readSession(loggedInPage), {
        message: 'signing out must remove the stored session, not just hide the view',
      })
      .toBeNull();
  });

  test('stays ended after a reload', async ({ loggedInPage, homePage, loginPage }) => {
    // Signing out and refreshing is how someone checks they really are out. If
    // logout only hid the view without clearing storage, this is where the
    // session would come back.
    await homePage.expectLoaded();
    await homePage.logout();
    await loginPage.expectLoaded();

    await loggedInPage.reload();

    await loginPage.expectLoaded();
    await expect(homePage.nav.root).toBeHidden();
  });

  test('is not shared between two independent browser contexts', async ({ browser }) => {
    // One person signing in must not sign in everyone else. A context is a
    // separate cookie jar and storage area, so this is the closest thing to two
    // different people on two different machines.
    // Seeded through storageState, which applies the entry once when the context
    // is created. Doing it with addInitScript would re-apply it on every
    // navigation, and any later reload would quietly hand the session back.
    const signedIn = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [
          {
            origin: new URL(config.baseUrl).origin,
            localStorage: [{ name: SESSION_KEY, value: standardUser.email }],
          },
        ],
      },
    });
    const anonymous = await browser.newContext();

    try {
      await blockThirdPartyRequests(signedIn);
      await blockThirdPartyRequests(anonymous);

      const signedInPage = await signedIn.newPage();
      await signedInPage.goto(config.baseUrl);
      await new HomePage(signedInPage).expectLoaded();

      const anonymousPage = await anonymous.newPage();
      await anonymousPage.goto(config.baseUrl);

      await new LoginPage(anonymousPage).expectLoaded();
      await expect(new HomePage(anonymousPage).nav.root).toBeHidden();
      await expect.poll(() => readSession(anonymousPage)).toBeNull();
    } finally {
      // Both contexts close even if an assertion above throws, so a failure here
      // cannot leak browser processes into the rest of the run.
      await signedIn.close();
      await anonymous.close();
    }
  });
});

test.describe('Known defects', () => {
  /**
   * These two run and are expected to fail. They assert the behaviour the app
   * should have, so the day someone fixes the stylesheet Playwright reports an
   * unexpected pass and the annotation has to come off. A skipped test would
   * just rot quietly instead.
   *
   * Shared root cause: css/style.css still carries the display rules from the
   * pre-Vue version, where js/index.js flipped them by hand. The rewrite moved
   * to v-if and the old defaults were never removed, so both elements mount and
   * stay invisible.
   */

  test('the content area should be visible once signed in', async ({
    loggedInPage,
    homePage,
  }) => {
    test.fail();

    // style.css:128 sets .content { display: none } and nothing ever unsets it.
    // A signed-in user sees a nav bar, a footer, and nothing in between.
    void loggedInPage;
    await homePage.expectLoaded();
    await expect(homePage.nav.content).toBeVisible();
  });

  test('the Sign Out item in the user menu should be usable', async ({
    loggedInPage,
    homePage,
  }) => {
    test.fail();

    // style.css:161 hides .logout unless it also has .active, which the old
    // script used to add. App.vue toggles it with v-if instead, so the item
    // mounts with display:none and can never be seen or clicked. The Logout
    // button is currently the only way out.
    void loggedInPage;
    await homePage.expectLoaded();
    await homePage.logoutViaUserMenu();
  });
});

test.describe('Session trust', () => {
  test('accepts any value in the session key as a signed-in user @security-finding', async ({
    page,
    homePage,
    loginPage,
  }) => {
    // Documents what the app does today rather than what it should do. There is
    // no server and no token, so the only thing standing between a visitor and
    // the signed-in view is one editable localStorage entry: typing
    // localStorage.logged = 'x' in the console is a complete bypass.
    //
    // Acceptable for a demo with no protected data behind it. Recorded here so
    // the limitation is visible, and so this test starts failing the day real
    // content or a real backend arrives and the check needs to mean something.
    await page.goto('/');
    await loginPage.expectLoaded();

    await writeSession(page, 'not-a-registered-user@example.com');
    await page.reload();

    await homePage.expectLoaded();
  });
});
