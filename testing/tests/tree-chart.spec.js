// testing/tests/tree-chart.spec.js
import { test, expect } from '@playwright/test';

async function addPersonViaCore(page, data) {
  return page.evaluate((personData) => {
    const id = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const person = {
      id,
      name: personData.name || 'Test',
      surname: personData.surname || '',
      fatherName: '',
      maidenName: '',
      dob: '',
      gender: '',
      motherId: '',
      fatherId: '',
      spouseId: ''
    };
    window.treeCore.personData.set(id, person);
    // Notify the EventBus so tree-chart view rebuilds
    const bus = window.appContext?.getEventBus?.();
    if (bus) bus.emit('tree:person:added', { person });
    return id;
  }, data);
}

test.describe('Tree Chart view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/builder/');
    await page.waitForLoadState('networkidle');
    // Wait for treeCore to be initialized
    await page.waitForFunction(() => !!window.treeCore?.personData, { timeout: 10000 });
  });

  test('switching to tree chart shows the SVG view', async ({ page }) => {
    await page.click('#viewTreeChartBtn');
    await expect(page.locator('#treeChartView')).toBeVisible();
    await expect(page.locator('#treeChartView svg.tc-svg')).toBeVisible();
    await expect(page.locator('#viewTreeChartBtn')).toHaveClass(/active/);
  });

  test('adding a person renders a node in the tree chart', async ({ page }) => {
    await addPersonViaCore(page, { name: 'Test', surname: 'Person' });

    await page.click('#viewTreeChartBtn');
    await page.waitForTimeout(300); // allow debounced rebuild

    const nodes = page.locator('#treeChartView .tc-node');
    await expect(nodes).toHaveCount(1);
  });

  test('clicking a node fades unrelated nodes', async ({ page }) => {
    await addPersonViaCore(page, { name: 'Alpha' });
    await addPersonViaCore(page, { name: 'Bravo' });

    await page.click('#viewTreeChartBtn');
    await page.waitForTimeout(300);

    const firstNode = page.locator('#treeChartView .tc-node').first();
    await firstNode.click();

    await expect(page.locator('#treeChartView svg')).toHaveClass(/tc-has-highlight/);
    await expect(page.locator('#treeChartView .tc-node.tc-on-line')).toHaveCount(1);
  });

  test('Escape clears the highlight', async ({ page }) => {
    await addPersonViaCore(page, { name: 'Alpha' });

    await page.click('#viewTreeChartBtn');
    await page.waitForTimeout(300);

    await page.locator('#treeChartView .tc-node').first().click();
    await expect(page.locator('#treeChartView svg')).toHaveClass(/tc-has-highlight/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#treeChartView svg')).not.toHaveClass(/tc-has-highlight/);
  });

  test('switching from table back to tree chart preserves added persons', async ({ page }) => {
    await addPersonViaCore(page, { name: 'X' });
    await page.click('#viewTableBtn');
    await addPersonViaCore(page, { name: 'Y' });
    await page.click('#viewTreeChartBtn');
    await page.waitForTimeout(300);
    await expect(page.locator('#treeChartView .tc-node')).toHaveCount(2);
  });
});
