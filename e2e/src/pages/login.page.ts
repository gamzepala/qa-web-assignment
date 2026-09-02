import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The login screen.
 *
 * Convention used across these page objects: the only assertion allowed in here
 * is expectLoaded(), which answers "am I on the right screen" - a precondition,
 * not a verdict. Everything a test is actually trying to prove is asserted in
 * the spec, so a failure message names the behaviour that broke rather than a
 * page object method.
 */
export class LoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;

  /**
   * The error banner is the one locator bound to a styling class. The app renders
   * it as a bare <div class="error-message"> with no role and no id, so there is
   * nothing more stable to hold on to. Raised as a finding in the strategy doc -
   * the fix is role="alert", which would make this a getByRole lookup and would
   * also let a screen reader announce the failure.
   */
  private readonly errorBanner: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel('User');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'LOGIN' });
    this.errorBanner = page.locator('.error-message');
  }

  async open(): Promise<void> {
    await this.page.goto('/');
    await this.expectLoaded();
  }

  /**
   * Waits for the form to be interactive. Anything that types into the form
   * should go through here first, otherwise the first fill can land before Vue
   * has mounted and silently go nowhere.
   */
  async expectLoaded(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeEnabled();
  }

  /** Fills both fields without submitting - for tests that inspect the form mid-flight. */
  async enterCredentials(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.enterCredentials(email, password);
    await this.submit();
  }

  /** Submits with Enter from the password field, the way most people finish a login form. */
  async submitWithEnter(): Promise<void> {
    await this.passwordInput.press('Enter');
  }

  async typeIntoEmail(text: string): Promise<void> {
    await this.emailInput.pressSequentially(text);
  }

  async typeIntoPassword(text: string): Promise<void> {
    await this.passwordInput.pressSequentially(text);
  }

  async focusEmail(): Promise<void> {
    await this.emailInput.focus();
  }

  // Locators are exposed for the spec to assert on directly. Returning the
  // Locator rather than a boolean keeps Playwright's retry and its "expected X,
  // received Y" message intact; a helper returning true/false would reduce every
  // failure to "expected true, received false".
  get form() {
    return {
      email: this.emailInput,
      password: this.passwordInput,
      submit: this.submitButton,
      error: this.errorBanner,
    };
  }
}
