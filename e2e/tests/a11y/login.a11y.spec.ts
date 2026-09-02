import { expect, test } from '../../src/fixtures/fixtures';
import { standardUser } from '../../src/testdata/users';
import { describeViolations, scan } from '../../src/utils/a11y';

/**
 * Accessibility checks, kept in their own Playwright project so they never block
 * a functional merge. Run them with: npm run test:a11y
 *
 * Worth being honest about what this buys: an automated scan catches somewhere
 * around a third of real accessibility problems. It is very good at contrast,
 * missing labels and broken ARIA, and completely blind to whether a keyboard
 * user can actually get anywhere. So the scans below are paired with explicit
 * checks for the things axe cannot see, and those are where this app's real
 * problems turned out to be.
 */

test.describe('Automated scan', () => {
  test('the login page is clean', async ({ page, loginPage }) => {
    // Asserted at zero rather than against a baseline, because the login page
    // genuinely has no violations today. Anything that appears here is a
    // regression somebody introduced, not inherited debt.
    await loginPage.open();

    const { violations } = await scan(page);

    expect(violations.length, `login page:\n${describeViolations(violations)}`).toBe(0);
  });

  test('the login page is still clean while showing an error', async ({ page, loginPage }) => {
    // The error banner only exists after a failed attempt, so the default scan
    // never sees it. Scanning this state separately is the only way the banner
    // gets checked at all.
    await loginPage.open();
    await loginPage.login(standardUser.email, 'wrong-password');
    await expect(loginPage.form.error).toBeVisible();

    const { violations } = await scan(page);

    expect(violations.length, `login page in error state:\n${describeViolations(violations)}`).toBe(
      0,
    );
  });

  test('the signed-in page has nothing beyond the one known issue', async ({
    loggedInPage,
    homePage,
  }) => {
    // The Logout button's contrast is the only thing wrong here, and it is
    // tracked as its own expected-failure test below. Filtering it out rather
    // than skipping the whole page means a brand new violation still fails,
    // which is the part that matters day to day.
    const KNOWN_ISSUES = ['color-contrast'];

    await homePage.expectLoaded();

    const { violations } = await scan(loggedInPage);
    const unexpected = violations.filter((v) => !KNOWN_ISSUES.includes(v.id));

    expect(
      unexpected.length,
      `new violations on the signed-in page:\n${describeViolations(unexpected)}`,
    ).toBe(0);
  });
});

/**
 * Things the app gets wrong today.
 *
 * All three run and are expected to fail, so they stay visible in the report
 * and start failing loudly the day someone fixes them - at which point the
 * annotation comes off. Leaving them out entirely would make this suite look
 * like the app is in better shape than it is.
 */
test.describe('Known accessibility gaps', () => {
  test('the Logout button should meet the contrast minimum', async ({
    loggedInPage,
    homePage,
  }) => {
    test.fail();

    // White text on #d9534f measures 3.96:1 where AA wants 4.5:1 for text this
    // size. Darkening the red to about #c9302c - the colour already used for
    // the hover state - would clear it.
    await homePage.expectLoaded();

    const { violations } = await scan(loggedInPage);
    const contrast = violations.filter((v) => v.id === 'color-contrast');

    expect(contrast.length, describeViolations(contrast)).toBe(0);
  });

  test('the failure message should be announced to a screen reader', async ({ loginPage }) => {
    test.fail();

    // The banner is a plain <div>. It appears silently, so someone using a
    // screen reader submits the form and gets no feedback at all - the page
    // simply sits there. role="alert" on that div is the whole fix, and axe
    // cannot flag this because it has no way to know the element is new.
    await loginPage.open();
    await loginPage.login(standardUser.email, 'wrong-password');
    await expect(loginPage.form.error).toBeVisible();

    const announced = await loginPage.form.error.evaluate(
      (el) => el.getAttribute('role') === 'alert' || el.hasAttribute('aria-live'),
    );

    expect(announced, 'the error banner needs role="alert" or an aria-live region').toBe(true);
  });

  test('every nav control should be reachable by keyboard', async ({
    loggedInPage,
    homePage,
  }) => {
    test.fail();

    // Tabbing through the signed-in page reaches exactly one thing: the Logout
    // button. Home, Products, Contact and the user menu are all plain <div>s
    // with click handlers, so a keyboard user cannot get to any of them. The
    // user menu is the one that actually matters, since it holds Sign Out.
    await homePage.expectLoaded();

    const focusable: string[] = [];
    for (let i = 0; i < 8; i++) {
      await loggedInPage.keyboard.press('Tab');
      focusable.push(
        await loggedInPage.evaluate(() => document.activeElement?.className ?? ''),
      );
    }

    expect(
      focusable.some((className) => className.includes('user-section')),
      `tab order never reaches the user menu. Reached: ${[...new Set(focusable)].join(', ')}`,
    ).toBe(true);
  });
});
