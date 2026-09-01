import { expect, test } from '../src/fixtures/fixtures';
import { INVALID_LOGIN_MESSAGE, standardUser } from '../src/testdata/users';

/**
 * How the failure message behaves over time.
 *
 * The message appearing is covered by the negative suite. What is checked here
 * is when it goes away again, because a banner that lingers after the user has
 * fixed their typo reads as "still broken" and one that never appears at all
 * leaves people guessing.
 */
test.describe('The invalid-credentials message', () => {
  test('is absent on a freshly loaded form', async ({ loginPage }) => {
    await loginPage.open();

    // The form is confirmed present first. Asserting the absence of something on
    // a page that has not rendered yet is trivially true and proves nothing.
    await expect(loginPage.form.email).toBeVisible();
    await expect(loginPage.form.error).toHaveCount(0);
  });

  test('reads exactly as specified', async ({ loginPage }) => {
    // Pinned word for word. Copy changes should be a deliberate decision that
    // someone updates this line for, not something that drifts unnoticed.
    await loginPage.open();
    await loginPage.login(standardUser.email, 'wrong-password');

    await expect(loginPage.form.error).toHaveText(INVALID_LOGIN_MESSAGE);
  });

  test('disappears as soon as the user edits the email', async ({ loginPage }) => {
    await loginPage.open();
    await loginPage.login(standardUser.email, 'wrong-password');
    await expect(loginPage.form.error).toBeVisible();

    await loginPage.typeIntoEmail('x');

    await expect(loginPage.form.error).toHaveCount(0);
  });

  test('disappears as soon as the user edits the password', async ({ loginPage }) => {
    // The same handler is wired to both fields. Worth testing separately -
    // wiring it to one and forgetting the other is an easy thing to ship.
    await loginPage.open();
    await loginPage.login(standardUser.email, 'wrong-password');
    await expect(loginPage.form.error).toBeVisible();

    await loginPage.typeIntoPassword('x');

    await expect(loginPage.form.error).toHaveCount(0);
  });

  test('does not survive a page reload', async ({ page, loginPage }) => {
    // The message describes one attempt, so it has no business outliving the
    // page it was shown on.
    await loginPage.open();
    await loginPage.login(standardUser.email, 'wrong-password');
    await expect(loginPage.form.error).toBeVisible();

    await page.reload();

    await loginPage.expectLoaded();
    await expect(loginPage.form.error).toHaveCount(0);
  });
});
