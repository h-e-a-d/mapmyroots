// Shared helpers for the builder e2e specs. They drive the UI the way a user does.
import { expect } from '@playwright/test';

export async function openBuilder(page, path = '/builder') {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  // builder-page.ts sets this once the sidebar, view buttons and tree chart are wired.
  await page.waitForSelector('body[data-builder-ready="true"]', { timeout: 10000 });
}

export async function openAddPersonModal(page) {
  await page.locator('#addPersonBtn').click();
  await expect(page.locator('#personModal')).not.toHaveClass(/hidden/);
}

// The radios are pointer-events:none; the card around them takes the click (see modal.css).
export async function selectGender(page, gender) {
  const id = gender === 'female' ? 'genderFemale' : 'genderMale';
  await page.locator(`.gender-radio-option:has(#${id})`).click();
  await expect(page.locator(`#${id}`)).toBeChecked();
}

export async function addPersonViaUi(page, { name, gender = 'male', birthDate } = {}) {
  await openAddPersonModal(page);
  await selectGender(page, gender);
  await page.locator('#personName').fill(name);
  if (birthDate) {
    await page.locator('#personBirthDate').fill(birthDate);
    await page.locator('#personBirthDate').press('Tab');
  }
  await page.locator('#savePerson').click();
  await expect(page.locator('#personModal')).toHaveClass(/hidden/, { timeout: 5000 });
}

// Read the real state: the cache indicator's #personCount only refreshes when it is expanded.
export function personCount(page) {
  return page.evaluate(() => window.treeCore.renderer.nodes.size);
}

// Nodes are drawn on the canvas, not in the DOM, so find the node by name and double-click its
// screen position, which opens the edit modal.
export async function openEditModalFor(page, name) {
  const point = await page.evaluate((personName) => {
    const renderer = window.treeCore.renderer;
    const node = [...renderer.nodes.values()].find((n) => n.name === personName);
    if (!node) return null;
    const rect = renderer.canvas.getBoundingClientRect();
    const screen = renderer.worldToScreen(node.x, node.y);
    return { x: rect.left + screen.x, y: rect.top + screen.y };
  }, name);
  expect(point, `node "${name}" on the canvas`).not.toBeNull();
  await page.mouse.dblclick(point.x, point.y);
  await expect(page.locator('#personModal')).not.toHaveClass(/hidden/, { timeout: 5000 });
}
