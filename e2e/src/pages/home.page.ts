import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The screen behind the login: nav bar plus the article content.
 *
 * There are two ways to sign out - a plain Logout button, and a "Sign Out" entry
 * hidden behind the user icon. Both are modelled because they are separate
 * handlers in the component and only one of them is obvious enough that a
 * developer would remember to test it by hand.
 */
export class HomePage {
  private readonly navigation: Locator;
  private readonly content: Locator;
  private readonly logoutButton: Locator;

  /**
   * The user icon is a <div> with a click handler - no role, no tabindex, not a
   * button. Nothing accessible to bind to, hence the class selector. Raised as a
   * finding: it is also unreachable by keyboard, which the a11y suite pins down.
   */
  private readonly userMenuToggle: Locator;
  private readonly signOutMenuItem: Locator;

  constructor(page: Page) {
    this.navigation = page.locator('nav.navigation');
    this.content = page.locator('section.content');
    this.logoutButton = page.getByRole('button', { name: 'Logout' });
    this.userMenuToggle = page.locator('.user-section');
    this.signOutMenuItem = page.locator('.logout');
  }

  /**
   * The nav bar and the Logout button are the honest markers that we are signed
   * in. The content section deliberately is not: it renders but is invisible,
   * which is a real defect the suite pins down separately rather than baking
   * into every readiness check.
   */
  async expectLoaded(): Promise<void> {
    await expect(this.navigation).toBeVisible();
    await expect(this.logoutButton).toBeVisible();
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }

  /** The other route out: open the user icon, then pick Sign Out. */
  async logoutViaUserMenu(): Promise<void> {
    await this.userMenuToggle.click();
    await expect(this.signOutMenuItem).toBeVisible();
    await this.signOutMenuItem.click();
  }

  async openUserMenu(): Promise<void> {
    await this.userMenuToggle.click();
  }

  get nav() {
    return {
      root: this.navigation,
      content: this.content,
      logoutButton: this.logoutButton,
      userMenuToggle: this.userMenuToggle,
      signOut: this.signOutMenuItem,
      items: this.navigation.locator('.menu > div'),
    };
  }
}
