import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(__dirname, '../fixtures/sample-avatar.jpg');
// PDF E2E upload is covered by manual smoke testing — PDF.js thumbnail
// generation is slow/flaky in CI headless environments.
const PDF = path.resolve(__dirname, '../fixtures/sample-doc.pdf');

/**
 * Creates a person, saves them (so they get an ID), then reopens the modal
 * and switches to the Documents tab.
 *
 * The Documents tab only mounts when personData?.id exists, so a fresh
 * "Add person" modal won't show the document list.  We must save first,
 * then reopen via canvas double-click.
 */
async function createPersonAndOpenDocuments(page, name) {
  await page.goto('/builder');
  await page.waitForLoadState('networkidle');

  // Open add-person modal
  await page.locator('#addPersonBtn').click();
  await expect(page.locator('#personModal')).not.toHaveClass(/hidden/);

  // Fill required fields and save.
  // Use force:true on the radio because a wrapper div (.gender-radio-option)
  // intercepts pointer events — same workaround used across other E2E specs.
  await page.locator('#personName').fill(name);
  await page.locator('#genderMale').check({ force: true });
  await page.locator('#savePerson').click();

  // Wait for modal to close (person is now saved with an ID)
  await expect(page.locator('#personModal')).toHaveClass(/hidden/, { timeout: 5000 });

  // Wait for treeCore to register the saved person.
  // #personCount lives inside a collapsed status indicator so we cannot rely on
  // its CSS visibility.  Instead poll window.treeCore.personData directly.
  await page.waitForFunction(
    () => typeof window.treeCore !== 'undefined' && (window.treeCore.personData?.size ?? 0) > 0,
    { timeout: 8000 }
  );

  // Reopen the person modal programmatically — the canvas has no stable ID and
  // the exact pixel position of the node is not deterministic, so we invoke
  // openModalForEdit via the tree engine the same way a double-click would.
  await page.evaluate(() => {
    const personId = window.treeCore.personData.keys().next().value;
    window.treeCore.renderer.onNodeDoubleClick(personId);
  });
  await expect(page.locator('#personModal')).not.toHaveClass(/hidden/, { timeout: 5000 });

  // Switch to the Documents tab
  await page.locator('#tab-documents-btn').click();
  await expect(page.locator('#tab-documents')).toBeVisible({ timeout: 3000 });
}

test.describe('document attachments', () => {
  test('add image document with metadata, appears in grid', async ({ page }) => {
    await createPersonAndOpenDocuments(page, 'Doc Owner');

    // Click the "Add document" button
    await page.locator('.document-add').click();

    // The hidden file input lives inside #documentsListMount (the container
    // passed to mountDocumentList).  Use { force: true } because it has
    // display:none.
    await page.locator('#documentsListMount input[type=file]').setInputFiles(IMG, { force: true });

    // Metadata editor should appear after the image is processed
    await expect(page.locator('.document-metadata-editor')).toBeVisible({ timeout: 8000 });

    // Fill metadata
    await page.locator('.document-metadata-editor input[name=title]').fill('Family photo 1948');
    await page.locator('.document-metadata-editor select[name=type]').selectOption('photo');
    await page.locator('.document-metadata-editor input[name=eventDate]').fill('1948');

    // Submit the metadata form
    await page.locator('.document-metadata-editor button[type=submit]').click();

    // Tile should appear in the grid
    await expect(page.locator('.document-tile')).toHaveCount(1, { timeout: 8000 });
    await expect(page.locator('.document-tile-title')).toHaveText('Family photo 1948');
    await expect(page.locator('.document-tile-year')).toHaveText('1948');
  });

  test('click document tile opens viewer, Escape closes it', async ({ page }) => {
    await createPersonAndOpenDocuments(page, 'Viewer Person');

    // Upload an image document
    await page.locator('.document-add').click();
    await page.locator('#documentsListMount input[type=file]').setInputFiles(IMG, { force: true });
    await expect(page.locator('.document-metadata-editor')).toBeVisible({ timeout: 8000 });
    await page.locator('.document-metadata-editor input[name=title]').fill('View Me');
    await page.locator('.document-metadata-editor button[type=submit]').click();
    await expect(page.locator('.document-tile')).toHaveCount(1, { timeout: 8000 });

    // Click the tile to open the document viewer lightbox
    await page.locator('.document-tile').click();
    await expect(page.locator('.document-viewer-overlay')).toBeVisible({ timeout: 5000 });

    // Escape key should close the lightbox
    await page.keyboard.press('Escape');
    await expect(page.locator('.document-viewer-overlay')).toHaveCount(0, { timeout: 3000 });
  });

  test('delete document removes tile from grid', async ({ page }) => {
    await createPersonAndOpenDocuments(page, 'Delete Person');

    // Upload and save a document
    await page.locator('.document-add').click();
    await page.locator('#documentsListMount input[type=file]').setInputFiles(IMG, { force: true });
    await expect(page.locator('.document-metadata-editor')).toBeVisible({ timeout: 8000 });
    await page.locator('.document-metadata-editor input[name=title]').fill('To Be Deleted');
    await page.locator('.document-metadata-editor button[type=submit]').click();
    await expect(page.locator('.document-tile')).toHaveCount(1, { timeout: 8000 });

    // Confirm the delete dialog automatically
    page.on('dialog', (dialog) => dialog.accept());

    // The delete button is hidden until the tile is hovered.  Hover first to
    // reveal .document-tile-actions, then click the delete button.
    await page.locator('.document-tile').hover();
    await page.locator('.document-delete-btn').click({ force: true });

    // Grid should be empty and the empty-state message should appear
    await expect(page.locator('.document-tile')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('.document-list-empty')).toBeVisible({ timeout: 3000 });
  });
});
