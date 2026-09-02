import { expect, test } from '../src/fixtures/fixtures';
import { invalidCredentials, standardUser } from '../src/testdata/users';
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
 *
 * These assert that an error is *shown*, not what it says. The wording is pinned
 * in exactly one place, error-message.spec.ts, because these tests are about who
 * gets turned away rather than about the copy - and if every rejection test
 * asserted the exact sentence, changing a word would turn three files red and
 * tell you nothing you did not already know.
 */
test.describe('Rejecting invalid credentials', () => {
  for (const [name, credentials] of Object.entries(invalidCredentials)) {
    test(`rejects ${name} - ${credentials.why}`, async ({ page, loginPage }) => {
      await loginPage.open();
      await loginPage.login(credentials.email, credentials.password);

      await expect(loginPage.form.error).toBeVisible();
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
    // "wrong password", anyone can work out which addresses are registered by
    // reading the error. Both paths have to stay indistinguishable.
    //
    // The two messages are compared to each other rather than to the known
    // wording, because that is what the property actually is. If someone changed
    // both messages to something else entirely, enumeration is still prevented
    // and this test should still pass - it is error-message.spec.ts's job to
    // notice the wording changed.
    //
    // Each attempt starts from a fresh load. Reusing the page would let the
    // second read catch the first attempt's banner before typing had cleared it.
    await loginPage.open();
    await loginPage.login(standardUser.email, 'wrong-password');
    await expect(loginPage.form.error).toBeVisible();
    const wrongPasswordMessage = ((await loginPage.form.error.textContent()) ?? '').trim();

    // Guards the comparison below. Two empty strings match each other happily,
    // so without this the test would pass against a form that says nothing at all.
    expect(wrongPasswordMessage, 'a rejected sign-in has to actually say something').not.toBe('');

    await loginPage.open();
    await loginPage.login('nobody@nowhere.test', standardUser.password);

    await expect(
      loginPage.form.error,
      'the two failure modes must not be distinguishable from the message',
    ).toHaveText(wrongPasswordMessage);
  });

  test('keeps rejecting cleanly when the user tries again', async ({ loginPage }) => {
    // Submitting again after a failure is the most common thing a person does
    // next. Catches a state bug where the second attempt silently does nothing
    // because the component thinks it has already handled this input.
    await loginPage.open();

    for (let attempt = 0; attempt < 3; attempt++) {
      await loginPage.login(standardUser.email, 'wrong-password');
      await expect(loginPage.form.error).toBeVisible();
    }

    // One banner, not three stacked up. The component holds a single string
    // behind a v-if so this is close to structural, but it is the assertion that
    // would fail first if the error were ever moved into a list.
    await expect(loginPage.form.error).toHaveCount(1);
  });
});
