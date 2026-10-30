import { test, expect } from '@playwright/test';
import { openBuilder, openAddPersonModal, selectGender, personCount, openEditModalFor } from './helpers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../fixtures/sample-avatar.jpg');

test.describe('avatar cropper', () => {
  test.beforeEach(async ({ page }) => {
    await openBuilder(page);
    await openAddPersonModal(page);
  });

  test('photo tab is present and switchable', async ({ page }) => {
    await expect(page.locator('#tab-photo-btn')).toBeVisible();
    await page.locator('#tab-photo-btn').click();
    await expect(page.locator('#tab-photo')).toBeVisible();
  });

  test('upload shows cropper canvas', async ({ page }) => {
    await page.locator('#personName').fill('Test Avatar');
    await selectGender(page, 'male');
    await page.locator('#tab-photo-btn').click();
    await page.locator('#personPhotoInput').setInputFiles(FIXTURE);
    await expect(page.locator('.avatar-cropper-canvas')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#personPhotoRemove')).toBeVisible();
  });

  test('upload, save, reopen — transform retained', async ({ page }) => {
    await page.locator('#personName').fill('Crop Person');
    await selectGender(page, 'female');
    await page.locator('#tab-photo-btn').click();
    await page.locator('#personPhotoInput').setInputFiles(FIXTURE);
    await expect(page.locator('.avatar-cropper-canvas')).toBeVisible({ timeout: 8000 });

    await page.locator('#avatarZoom').fill('2');
    await page.locator('#avatarZoom').dispatchEvent('input');

    await page.locator('#savePerson').click();
    await expect(page.locator('#personModal')).toHaveClass(/hidden/, { timeout: 5000 });

    const transform = await page.evaluate(() => {
      const persons = Array.from(window.treeCore?.personData?.values() ?? []);
      return persons.find((p) => p.name === 'Crop Person')?.photo?.transform ?? null;
    });
    expect(transform).not.toBeNull();
    expect(transform.scale).toBeGreaterThanOrEqual(1.5);

    await openEditModalFor(page, 'Crop Person');
    await page.locator('#tab-photo-btn').click();
    await expect(page.locator('.avatar-cropper-canvas')).toBeVisible({ timeout: 8000 });
  });

  test('remove photo clears the cropper', async ({ page }) => {
    await page.locator('#personName').fill('Removable');
    await selectGender(page, 'male');
    await page.locator('#tab-photo-btn').click();
    await page.locator('#personPhotoInput').setInputFiles(FIXTURE);
    await expect(page.locator('.avatar-cropper-canvas')).toBeVisible({ timeout: 8000 });
    await page.locator('#personPhotoRemove').click();
    await expect(page.locator('.avatar-cropper-canvas')).toHaveCount(0);
    await expect(page.locator('#personPhotoRemove')).toBeHidden();
  });

  test('reset button restores default transform', async ({ page }) => {
    await page.locator('#tab-photo-btn').click();
    await page.locator('#personPhotoInput').setInputFiles(FIXTURE);
    await expect(page.locator('.avatar-cropper-canvas')).toBeVisible({ timeout: 8000 });
    await page.locator('#avatarZoom').fill('3');
    await page.locator('#avatarZoom').dispatchEvent('input');
    await page.locator('#avatarReset').click();
    const zoomVal = await page.locator('#avatarZoom').inputValue();
    expect(Number(zoomVal)).toBeCloseTo(1.0, 1);
  });
});
