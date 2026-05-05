import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('homepage loads with title and nav', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/MapMyRoots|Family Tree/i);
    await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
  });

  test('builder page renders canvas', async ({ page }) => {
    await page.goto('/builder/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('canvas')).toBeVisible();
  });
});
