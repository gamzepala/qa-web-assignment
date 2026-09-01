import { expect, test } from '../src/fixtures/fixtures';
import {
  INVALID_LOGIN_MESSAGE,
  hostileInputs,
  nearMissCredentials,
  standardUser,
} from '../src/testdata/users';
import { readSession } from '../src/utils/session';

/**
 * Credentials that are almost right.
 *
 * The app compares both fields with ===, so all of these are rejected. That is
 * worth pinning down rather than assuming: trimming the email or lowercasing it
 * before comparison are both changes someone makes to be helpful, and both
 * change who can sign in. If that decision is ever taken deliberately, these
 * tests are where it gets noticed and re-agreed.
 */
test.describe('Near-miss credentials', () => {
  for (const [name, credentials] of Object.entries(nearMissCredentials)) {
    test(`rejects ${name}`, async ({ page, loginPage }) => {
      await loginPage.open();
      await loginPage.login(credentials.email, credentials.password);

      await expect(loginPage.form.error).toHaveText(INVALID_LOGIN_MESSAGE);
      await expect.poll(() => readSession(page)).toBeNull();
    });
  }
});

/**
 * Input the form was never designed for.
 *
 * None of these should sign anyone in. What they are really checking is that the
 * app rejects them the same calm way it rejects a typo - no crash, no hang, and
 * nothing rendered as markup.
 */
test.describe('Hostile and oversized input', () => {
  test('renders a script payload as text and never executes it', async ({ page, loginPage }) => {
    // Nothing echoes the entered email today, so this is a regression guard: the
    // natural next feature is an error that says which address was rejected, and
    // doing that with v-html is how the hole gets opened. Fails the moment the
    // payload reaches the DOM as markup or fires a dialog.
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await loginPage.open();
    await loginPage.login(hostileInputs.scriptTag, hostileInputs.imgOnError);

    await expect(loginPage.form.error).toHaveText(INVALID_LOGIN_MESSAGE);
    expect(dialogs, 'no script from the input may run').toEqual([]);

    // The banner shows its own fixed copy, with nothing of the payload in it.
    await expect(loginPage.form.error).not.toContainText('script');
    await expect(page.locator('img[onerror]')).toHaveCount(0);
  });

  test('treats a SQL-style string as an ordinary wrong password', async ({ page, loginPage }) => {
    // No backend to inject into, so this is about the string being handled as a
    // literal rather than doing anything clever on the way through.
    await loginPage.open();
    await loginPage.login(standardUser.email, hostileInputs.sqlish);

    await expect(loginPage.form.error).toHaveText(INVALID_LOGIN_MESSAGE);
    await expect.poll(() => readSession(page)).toBeNull();
  });

  test('keeps multi-byte characters intact instead of mangling them', async ({ loginPage }) => {
    // Catches truncation or re-encoding somewhere between the keystroke and the
    // value - the kind of bug that only ever shows up for users with accents in
    // their name.
    const value = `${hostileInputs.unicode}${hostileInputs.emoji}`;

    await loginPage.open();
    await loginPage.enterCredentials(value, value);

    await expect(loginPage.form.email).toHaveValue(value);
    await expect(loginPage.form.password).toHaveValue(value);
  });

  test('rejects a ten-thousand character entry without falling over', async ({
    page,
    loginPage,
    consoleLog,
  }) => {
    // Neither field has a maxlength, so there is nothing stopping a paste this
    // size. The app should decline it like any other wrong credential rather
    // than throwing, and the page has to stay usable afterwards.
    await loginPage.open();
    await loginPage.login(hostileInputs.veryLong, hostileInputs.veryLong);

    await expect(loginPage.form.error).toHaveText(INVALID_LOGIN_MESSAGE);
    await expect.poll(() => readSession(page)).toBeNull();

    // Still responsive: a normal sign-in works immediately afterwards.
    await loginPage.login(standardUser.email, standardUser.password);
    await expect.poll(() => readSession(page)).toBe(standardUser.email);

    expect(consoleLog.errors, 'oversized input must not throw in the browser').toEqual([]);
  });
});

test.describe('Credential field handling', () => {
  test('keeps the password field masked', async ({ loginPage }) => {
    // One attribute change turns a password box into a plain text box, and it is
    // the kind of thing that only gets noticed by someone reading over a
    // shoulder. Cheap to guard.
    await loginPage.open();
    await expect(loginPage.form.password).toHaveAttribute('type', 'password');
  });

  test('does not echo the typed password anywhere in the page', async ({ page, loginPage }) => {
    // A rejected attempt leaves the form as it was, which is the right call for
    // usability. What it must not do is copy the password into the markup while
    // it is at it - into the error banner, a hidden field, or a data attribute.
    const password = 'a-very-distinctive-wrong-password';

    await loginPage.open();
    await loginPage.login(standardUser.email, password);
    await expect(loginPage.form.error).toBeVisible();

    // The input's own value lives in the DOM property, not the serialised HTML,
    // so a match here means the password was written somewhere it should not be.
    const markup = await page.content();
    expect(markup, 'the password must not appear in the page markup').not.toContain(password);
  });
});
