import { test, expect } from '@playwright/test';
test('all workspace routes render and representative layouts fit the viewport', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  for (const section of [
    'dashboard',
    'my-work',
    'projects',
    'tasks',
    'ticketing',
    'work-logs',
    'attendance',
    'employees',
    'hr',
    'finance',
    'developer-workspace',
    'performance',
    'documents',
    'reports',
    'settings',
  ]) {
    await page.goto('/preview/' + section);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (['dashboard', 'my-work', 'hr', 'finance'].includes(section))
      await page.screenshot({ path: `docs/qa/${section}-desktop.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const section of [
    'dashboard',
    'my-work',
    'projects',
    'tasks',
    'ticketing',
    'work-logs',
    'attendance',
    'employees',
    'hr',
    'finance',
    'developer-workspace',
    'performance',
    'documents',
    'reports',
    'settings',
  ]) {
    await page.goto('/preview/' + section);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.goto('/preview/dashboard');
  await page.screenshot({ path: 'docs/qa/dashboard-mobile.png', fullPage: true });
});
