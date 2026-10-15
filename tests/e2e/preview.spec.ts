import { test, expect } from '@playwright/test';
test('reference dashboard navigation, read-only approval, and search', async ({ page }) => {
  await page.goto('/preview/dashboard');
  await expect(page.getByRole('heading', { name: 'Good morning, Kajan' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Fixture preview', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Reviewer decision reason').fill('Reviewed supplier quote');
  await page.getByRole('button', { name: 'Approve request', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('read-only fixture preview');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'My Work', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make today a good day.' })).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Task', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search workspace' }).fill('Sanduni');
  await expect(page.getByRole('row').filter({ hasText: 'Sanduni Perera' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Nisal Silva' })).not.toBeVisible();
});
test('finance separates approvals and execution', async ({ page }) => {
  await page.goto('/preview/finance');
  await page.getByRole('button', { name: 'Review', exact: true }).first().click();
  await expect(page.getByRole('dialog').getByText('Unpaid', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('It never marks this expense as paid');
});
test('keyboard dialog dismissal and mobile navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview/dashboard');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New project' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
