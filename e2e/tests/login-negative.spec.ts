import { expect, test } from '../src/fixtures/fixtures';
import { INVALID_LOGIN_MESSAGE, invalidCredentials, standardUser } from '../src/testdata/users';
import { readSession } from '../src/utils/session';

/**
 * The rejection paths.
 *
 * Each case asserts three things in this order: the error appears, the form is
 * still there, and no session was created. The order matters - checking "there
 * is no session" first would pass on a page that had not finished rendering,
 * because nothing is true yet on a blank page. Establishing the error state
 * first means the absence check is made against a page that has actually
 * settled.
 */
test.describe('Rejecting invalid credentials', () => {
  for (const [name, credentials] of Object.entries(invalidCredentials)) {
    test(`rejects ${name} - ${credentials.why}`, async ({ page, loginPage }) => {
      await loginPage.open();
      await loginPage.login(credentials.email, credentials.password);

      await expect(loginPage.form.error).toHaveText(INVALID_LOGIN_MESSAGE);
      await expect(loginPage.form.submit).toBeVisible();

      await expect
        .poll(() => readSession(page), {
          message: 'a rejected sign-in must not leave a session behind',
        })
        .toBeNull();
    });
  }

  test('a rejected sign-in leaves nothing behind for a reload to pick up @smoke', async ({
    page,
    loginPage,
    homePage,
  }) => {
    // Failing and then refreshing is what a real person does next. If the
    // failed attempt wrote anything to storage, this is where it would surface
    // as an accidental sign-in.
    await loginPage.open();
    await loginPage.login(standardUser.email, 'wrong-password');
    await expect(loginPage.form.error).toBeVisible();

    await page.reload();

    await loginPage.expectLoaded();
    await expect(homePage.nav.root).toBeHidden();
    await expect.poll(() => readSession(page)).toBeNull();
  });

  test('gives the same message whether the user is unknown or the password is wrong', async ({
    loginPage,
  }) => {
    // Account enumeration. The moment the copy splits into "no such user" and
    // "wrong password", anyone can work out which email addresses are
    // registered by reading the error. Both paths must stay indistinguishable.
    // Each attempt starts from a fresh load. Reusing the page would mean the
    // second read could catch the first attempt's banner before typing had
    // cleared it, and the test would pass for the wrong reason.
    await loginPage.open();
    await loginPage.login(standardUser.email, 'wrong-password');
    await expect(loginPage.form.error).toBeVisible();
    const wrongPasswordMessage = await loginPage.form.error.textContent();

    await loginPage.open();
    await loginPage.login('nobody@nowhere.test', standardUser.password);
    await expect(loginPage.form.error).toBeVisible();
    const unknownUserMessage = await loginPage.form.error.textContent();

    expect(
      unknownUserMessage,
      'the two failure modes must not be distinguishable from the message',
    ).toBe(wrongPasswordMessage);
  });

  test('shows one error, not a growing stack, across repeated attempts', async ({
    loginPage,
  }) => {
    // Submitting again after a failure is the most common thing a user does.
    // Catches a regression where each attempt appends another banner, and
    // doubles as a double-submit check.
    await loginPage.open();

    for (let attempt = 0; attempt < 3; attempt++) {
      await loginPage.login(standardUser.email, 'wrong-password');
      await expect(loginPage.form.error).toBeVisible();
    }

    await expect(loginPage.form.error).toHaveCount(1);
  });
});
