import { expect, test } from '../src/fixtures/fixtures';
import { standardUser } from '../src/testdata/users';
import { denyLocalStorage } from '../src/utils/session';

/**
 * What happens when the one browser API this app depends on refuses to work.
 *
 * This is the app's substitute for the usual "force the API to return 500" test.
 * It makes no requests of its own, so there is no endpoint to intercept — but it
 * puts its entire session model in `localStorage`, and `localStorage` is allowed
 * to throw. It does in a private window with site data blocked, under an
 * enterprise policy that disables storage for an origin, and when the quota is
 * full. None of those are exotic; the first is a checkbox in Firefox's settings.
 *
 * `src/App.vue` calls `getItem` in `mounted()` and `setItem` in `logIn()`, and
 * neither call is guarded.
 */
test.describe('When localStorage is unavailable', () => {
  test.beforeEach(async ({ page }) => {
    await denyLocalStorage(page);
  });

  test('the login form still renders rather than white-screening', async ({ loginPage }) => {
    // The read that throws happens in mounted(), after the first render, so the
    // form survives. Worth pinning: move that call into setup() or a computed and
    // the page would go blank instead, which is a far worse failure than the one
    // below.
    await loginPage.open();

    await expect(loginPage.form.email).toBeVisible();
    await expect(loginPage.form.submit).toBeEnabled();
  });

  test('a correct sign-in silently does nothing at all', async ({
    loginPage,
    homePage,
    consoleLog,
  }) => {
    // Finding A-7, pinned precisely. The credentials are right, the click
    // registers, setItem throws, and the exception goes nowhere: no error, no
    // navigation, the form still filled in exactly as it was. From the user's
    // side the button simply does nothing, and pressing it again does nothing
    // again.
    //
    // This asserts what happens today rather than what should. It carries the
    // weight so that the expected-failure test below can be a single line - if
    // the app ever white-screens here instead, this fails loudly rather than
    // being quietly absorbed as "well, it failed, as expected".
    await loginPage.open();
    await loginPage.login(standardUser.email, standardUser.password);

    await expect(homePage.nav.root).toBeHidden();
    await expect(loginPage.form.submit).toBeVisible();
    await expect(loginPage.form.email).toHaveValue(standardUser.email);
    await expect(loginPage.form.error).toHaveCount(0);

    // The failure is not invisible to a developer, only to the user - it reaches
    // the console as an uncaught exception. That is exactly the gap: the app
    // knows the sign-in failed and tells nobody who matters.
    expect(
      consoleLog.errors.length,
      'the storage failure should at least be reaching the console',
    ).toBeGreaterThan(0);
  });

  // Nested so the reporter line reads "... > Known defect > ...". The other two
  // expected-failure groups say so in their describe too, and a reviewer skimming
  // for the ✘ marks should not have to open a file to know they are deliberate.
  test.describe('Known defect', () => {
    test('the user should be told the sign-in could not be completed', async ({ loginPage }) => {
      test.fail();

      // The behaviour A-7 asks for, kept to one assertion on purpose. Whatever
      // the fix turns out to be — surface a message, or fall back to an
      // in-memory session — the user has to end up somewhere other than staring
      // at a form that ignored them.
      await loginPage.open();
      await loginPage.login(standardUser.email, standardUser.password);

      await expect(loginPage.form.error).toBeVisible();
    });
  });
});
