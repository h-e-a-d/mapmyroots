import { test, expect } from '@playwright/test';

test.describe('person modal — rich fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/builder');
    await page.waitForLoadState('networkidle');
    // Open add-person modal
    await page.locator('#addPersonBtn').click();
    await expect(page.locator('#personModal')).not.toHaveClass(/hidden/);
  });

  test('birth date section is visible in modal', async ({ page }) => {
    await expect(page.locator('#personBirthGroup')).toBeVisible();
    await expect(page.locator('#personBirthDateMount')).toBeVisible();
    // date-input text field is mounted inside the mount point
    await expect(page.locator('#personBirthDate')).toBeVisible();
  });

  test('death date section is visible in modal', async ({ page }) => {
    await expect(page.locator('#personDeathGroup')).toBeVisible();
    await expect(page.locator('#personDeathDate')).toBeVisible();
  });

  test('birth place is hidden initially and reveals on click', async ({ page }) => {
    await expect(page.locator('#personBirthPlaceWrapper')).toBeHidden();
    await page.locator('#personBirthPlaceReveal').click();
    await expect(page.locator('#personBirthPlaceWrapper')).toBeVisible();
  });

  test('birth note is hidden initially and reveals on click', async ({ page }) => {
    await expect(page.locator('#personBirthNoteWrapper')).toBeHidden();
    await page.locator('#personBirthNoteReveal').click();
    await expect(page.locator('#personBirthNoteWrapper')).toBeVisible();
  });

  test('marriages section is visible in modal', async ({ page }) => {
    await expect(page.locator('#personMarriagesMount')).toBeVisible();
  });

  test('general notes reveal works', async ({ page }) => {
    await expect(page.locator('#personNotesWrapper')).toBeHidden();
    await page.locator('#personNotesReveal').click();
    await expect(page.locator('#personNotesWrapper')).toBeVisible();
  });

  test('saves person with birth year and verifies person count', async ({ page }) => {
    await page.locator('#genderMale').check();
    await page.locator('#personName').fill('Anna');
    await page.locator('#personBirthDate').fill('1930');
    await page.locator('#personBirthDate').press('Tab');

    await page.locator('#savePerson').click();
    await expect(page.locator('#personModal')).toHaveClass(/hidden/, { timeout: 5000 });
    await expect(page.locator('#personCount')).toHaveText('1', { timeout: 5000 });
  });

  test('saves person with full birth date dd.mm.yyyy', async ({ page }) => {
    await page.locator('#genderFemale').check();
    await page.locator('#personName').fill('Maria');
    await page.locator('#personBirthDate').fill('15.06.1945');
    await page.locator('#personBirthDate').press('Tab');

    await page.locator('#savePerson').click();
    await expect(page.locator('#personModal')).toHaveClass(/hidden/, { timeout: 5000 });
    await expect(page.locator('#personCount')).toHaveText('1', { timeout: 5000 });
  });

  test('saves birth place when revealed', async ({ page }) => {
    await page.locator('#genderMale').check();
    await page.locator('#personName').fill('Georg');
    await page.locator('#personBirthPlaceReveal').click();
    await page.locator('#personBirthPlace').fill('Berlin');

    await page.locator('#savePerson').click();
    await expect(page.locator('#personModal')).toHaveClass(/hidden/, { timeout: 5000 });
  });

  test('invalid birth date shows aria-invalid on the input', async ({ page }) => {
    await page.locator('#personBirthDate').fill('not-a-date');
    await page.locator('#personBirthDate').press('Tab');
    await expect(page.locator('#personBirthDate')).toHaveAttribute('aria-invalid', 'true');
  });

  test('invalid date blocks save and shows validation error', async ({ page }) => {
    await page.locator('#genderMale').check();
    await page.locator('#personName').fill('Otto');
    await page.locator('#personBirthDate').fill('not-a-date');
    await page.locator('#personBirthDate').press('Tab');

    await page.locator('#savePerson').click();
    // Modal should stay open
    await expect(page.locator('#personModal')).not.toHaveClass(/hidden/);
  });

  test('re-opening edit modal pre-populates birth year', async ({ page }) => {
    // Add first person
    await page.locator('#genderMale').check();
    await page.locator('#personName').fill('Ivan');
    await page.locator('#personBirthDate').fill('1910');
    await page.locator('#personBirthDate').press('Tab');
    await page.locator('#savePerson').click();
    await expect(page.locator('#personModal')).toHaveClass(/hidden/, { timeout: 5000 });

    // Click the person node to open edit modal
    const node = page.locator('.person-group, [data-person-id]').first();
    await node.dblclick();
    await expect(page.locator('#personModal')).not.toHaveClass(/hidden/, { timeout: 5000 });

    // Birth date should be pre-populated
    await expect(page.locator('#personBirthDate')).toHaveValue('1910');
  });
});
