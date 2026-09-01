import { expect, test } from '@playwright/test';

/**
 * Temporary placeholder that proves the config, the preview server and the
 * browser install all line up. Replaced by the real login suite.
 */
test('the app under test is served and reachable @smoke', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'LOGIN' })).toBeVisible();
});
