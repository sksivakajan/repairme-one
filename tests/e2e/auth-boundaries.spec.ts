import { test, expect } from '@playwright/test';

test('signed-out users cannot open connected task and ticket pages', async ({ page }) => {
  for (const route of ['/dashboard', '/my-work', '/tasks', '/ticketing']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  }
});

test('login validates required fields and links to recovery', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Work email')).toHaveAttribute('type', 'email');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect(
    await page
      .getByLabel('Work email')
      .evaluate((el: HTMLInputElement) => el.validity.valueMissing),
  ).toBe(true);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/recovery$/);
  await expect(page.getByRole('button', { name: 'Send recovery link' })).toBeVisible();
  await page.getByRole('link', { name: 'Company sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('session and command endpoints reject requests from an untrusted origin', async ({
  request,
}) => {
  for (const route of ['/auth/session', '/api/commands']) {
    const response = await request.post(route, {
      headers: { origin: 'https://untrusted.invalid' },
      data: {},
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: 'Request origin denied' });
  }
});
