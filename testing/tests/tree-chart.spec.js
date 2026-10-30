// testing/tests/tree-chart.spec.js
import { test, expect } from '@playwright/test';
import { openBuilder, addPersonViaUi } from './helpers.js';

test.describe('Tree Chart view', () => {
  test.beforeEach(async ({ page }) => {
    await openBuilder(page, '/builder/');
  });

  test('switching to tree chart shows the SVG view', async ({ page }) => {
    await page.click('#viewTreeChartBtn');
    await expect(page.locator('#treeChartView')).toBeVisible();
    await expect(page.locator('#treeChartView svg.tc-svg')).toBeVisible();
    await expect(page.locator('#viewTreeChartBtn')).toHaveClass(/active/);
  });

  test('adding a person renders a node in the tree chart', async ({ page }) => {
    await addPersonViaUi(page, { name: 'Test' });

    await page.click('#viewTreeChartBtn');

    const nodes = page.locator('#treeChartView .tc-node');
    await expect(nodes).toHaveCount(1);
  });

  test('clicking a node fades unrelated nodes', async ({ page }) => {
    await addPersonViaUi(page, { name: 'Alpha' });
    await addPersonViaUi(page, { name: 'Bravo' });

    await page.click('#viewTreeChartBtn');

    const firstNode = page.locator('#treeChartView .tc-node').first();
    await firstNode.click();

    await expect(page.locator('#treeChartView svg')).toHaveClass(/tc-has-highlight/);
    await expect(page.locator('#treeChartView .tc-node.tc-on-line')).toHaveCount(1);
  });

  test('Escape clears the highlight', async ({ page }) => {
    await addPersonViaUi(page, { name: 'Alpha' });

    await page.click('#viewTreeChartBtn');

    await page.locator('#treeChartView .tc-node').first().click();
    await expect(page.locator('#treeChartView svg')).toHaveClass(/tc-has-highlight/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#treeChartView svg')).not.toHaveClass(/tc-has-highlight/);
  });

  test('switching from table back to tree chart preserves added persons', async ({ page }) => {
    await addPersonViaUi(page, { name: 'X' });
    await page.click('#viewTableBtn');
    await addPersonViaUi(page, { name: 'Y' });
    await page.click('#viewTreeChartBtn');
    await expect(page.locator('#treeChartView .tc-node')).toHaveCount(2);
  });
});
