import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TINY_GED_PATH = join(__dirname, '../../tests/fixtures/gedcom/tiny.ged');

test.describe('GEDCOM import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/builder');
    await page.waitForLoadState('networkidle');
  });

  test('opens modal, parses fixture, imports 3 persons, closes modal', async ({ page }) => {
    const importBtn = page.locator('#importGedcomBtn');
    await expect(importBtn).toBeVisible();
    await importBtn.click();

    const modal = page.locator('#importGedcomModal');
    await expect(modal).toBeVisible();
    await expect(modal).not.toHaveClass(/hidden/);

    const heading = modal.locator('h2, h3').first();
    await expect(heading).toContainText(/import.*gedcom/i);

    await page.setInputFiles('#gedcomFileInput', TINY_GED_PATH);

    const previewSummary = page.locator('#gedcomPreviewSummary');
    await expect(previewSummary).toContainText('3', { timeout: 10000 });

    const gedcomImportBtn = page.locator('#gedcomImportBtn');
    await expect(gedcomImportBtn).toBeEnabled();

    await gedcomImportBtn.click();

    await expect(modal).toHaveClass(/hidden/, { timeout: 5000 });
    await expect(page.locator('#personCount')).toHaveText('3', { timeout: 5000 });
  });

  test('cancel button closes the modal without importing', async ({ page }) => {
    await page.locator('#importGedcomBtn').click();

    const modal = page.locator('#importGedcomModal');
    await expect(modal).toBeVisible();

    await page.locator('#gedcomCancelBtn').click();

    await expect(modal).toHaveClass(/hidden/, { timeout: 5000 });
  });
});
