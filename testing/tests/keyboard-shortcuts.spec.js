import { test, expect } from '@playwright/test';
import { openBuilder, addPersonViaUi } from './helpers.js';

// Fast presses: modifiers and the letter within a few ms, as Playwright's press() does. The old
// debounce started on the modifier keydown and swallowed the letter.
test.describe('keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await openBuilder(page);
    await addPersonViaUi(page, { name: 'Shortcut Test' });
  });

  for (const mod of ['Control', 'Meta']) {
    test(`${mod}+Shift+P exports a PDF`, async ({ page }) => {
      const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press(`${mod}+Shift+P`)]);
      expect(download.suggestedFilename()).toBe('family-tree.pdf');
    });
  }

  test('Control+Shift+G exports GEDCOM', async ({ page }) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+Shift+G')]);
    expect(download.suggestedFilename()).toMatch(/\.ged$/);
  });

  test('Control+/ focuses search', async ({ page }) => {
    await page.keyboard.press('Control+/');
    await expect(page.locator('#searchField')).toBeFocused();
  });
});
