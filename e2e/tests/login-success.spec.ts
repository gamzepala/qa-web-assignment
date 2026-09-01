import { expect, test } from '../src/fixtures/fixtures';
import { alphabeticPasswordUser, standardUser, validUsers } from '../src/testdata/users';
import { readSession } from '../src/utils/session';

/**
 * The happy paths.
 *
 * Every test here checks two independent things: that the UI moved to the
 * signed-in view, and that a session was stored for the right person. Checking
 * only the first would pass against an app that renders the logged-in screen
 * without authenticating anybody, which is the bug you least want to miss.
 */
test.describe('Signing in with valid credentials', () => {
  for (const user of validUsers) {
    test(`admits ${user.email} and stores a session under that identity @smoke`, async ({
      page,
      loginPage,
      homePage,
    }) => {
      await loginPage.open();
      await loginPage.login(user.email, user.password);

      await homePage.expectLoaded();

      // The login form is gone, so there is no way to submit again from here.
      await expect(loginPage.form.submit).toBeHidden();

      // The independent half: the expected value comes from js/users.js, not
      // from anything this page displayed. Catches an app that signs everyone in
      // as the first user in the list, or that authenticates without persisting.
      await expect
        .poll(() => readSession(page), {
          message: `expected a stored session for ${user.email}`,
        })
        .toBe(user.email);
    });
  }

  test('accepts the form when it is submitted with Enter', async ({
    page,
    loginPage,
    homePage,
  }) => {
    // Most people finish a login form with the return key rather than the mouse.
    // Catches a handler wired to the button's click instead of the form's submit.
    await loginPage.open();
    await loginPage.enterCredentials(standardUser.email, standardUser.password);
    await loginPage.submitWithEnter();

    await homePage.expectLoaded();
    await expect.poll(() => readSession(page)).toBe(standardUser.email);
  });

  test('can be completed without ever touching the mouse', async ({
    page,
    loginPage,
    homePage,
  }) => {
    // Keyboard-only completion is the part of accessibility an axe scan cannot
    // see. Catches a broken tab order, or a submit control that focus skips.
    await loginPage.open();
    await loginPage.focusEmail();

    await page.keyboard.type(standardUser.email);
    await page.keyboard.press('Tab');
    await expect(loginPage.form.password).toBeFocused();

    await page.keyboard.type(standardUser.password);
    await page.keyboard.press('Enter');

    await homePage.expectLoaded();
    await expect.poll(() => readSession(page)).toBe(standardUser.email);
  });

  test('empties the credential fields once the sign-in succeeds', async ({
    loginPage,
    homePage,
  }) => {
    // The component resets email and password on success. Signing out re-renders
    // the same form, so if that reset ever stops happening the previous user's
    // password is sitting in the box for whoever walks up next.
    await loginPage.open();
    await loginPage.login(standardUser.email, standardUser.password);
    await homePage.expectLoaded();

    await homePage.logout();
    await loginPage.expectLoaded();

    await expect(loginPage.form.email).toHaveValue('');
    await expect(loginPage.form.password).toHaveValue('');
  });

  test('does not write the password to the browser console', async ({
    loginPage,
    homePage,
    consoleLog,
  }) => {
    // The app logs the email of whoever signs in. That is already more than it
    // needs to, and it is exactly the line someone extends to include the
    // password while debugging. This fails the moment that happens.
    //
    // Uses the account with an alphabetic password on purpose - searching the
    // console for a short numeric one would match by coincidence and the test
    // would be reporting noise.
    const user = alphabeticPasswordUser;

    await loginPage.open();
    await loginPage.login(user.email, user.password);
    await homePage.expectLoaded();

    const leaked = consoleLog.all.filter((line) => line.includes(user.password));
    expect(leaked, 'the password must never reach the browser console').toEqual([]);
  });
});
