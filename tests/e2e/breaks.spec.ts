import { test, expect } from '@playwright/test';
test('after an hour of work the portal offers a coffee break that can be started or pushed back', async ({
  page,
}) => {
  await page.goto('/preview/my-work?break=due');
  const prompt = page.getByRole('alertdialog', { name: 'Coffee break' });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole('button', { name: /Start 10-minute break/ })).toBeVisible();
  await expect(prompt.getByRole('button', { name: /Not now/ })).toBeVisible();
});
test('during a break the watch is paused and a countdown shows with a way to end it', async ({
  page,
}) => {
  await page.goto('/preview/my-work?break=on');
  const banner = page.getByRole('status').filter({ hasText: 'Coffee break' });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('your work time is paused');
  await expect(banner.getByRole('button', { name: 'End break' })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Tracked work time today' })).toContainText(
    'Coffee break',
  );
});
test('the install page explains the desktop app', async ({ page }) => {
  await page.goto('/install');
  await expect(page.getByRole('heading', { name: 'Install RepairMe Desktop' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Download RepairMeSetup/ })).toBeVisible();
});
