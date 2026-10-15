import { test, expect } from '@playwright/test';
test('internal ticket preview supports filtering, detail and read-only creation', async ({
  page,
}) => {
  await page.goto('/preview/ticketing');
  await expect(page.getByRole('heading', { name: 'Ticketing', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View ticket' }).click();
  await expect(page.getByRole('heading', { name: 'Update history' })).toBeVisible();
  await page.getByLabel('Search tickets').fill('missing issue');
  await expect(page.getByText('No tickets found.')).toBeVisible();
  await page.getByLabel('Search tickets').fill('printer');
  await expect(page.getByRole('button', { name: 'View ticket' })).toBeVisible();
  await page.getByRole('button', { name: 'Report an issue' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Internet connection unstable');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Connection drops in the office every hour.');
  await page.getByRole('button', { name: 'Create ticket' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('read only');
  await page.screenshot({ path: 'docs/qa/ticketing-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
