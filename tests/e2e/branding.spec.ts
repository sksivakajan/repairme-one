import { test, expect } from '@playwright/test';
test('supplied logo loads on login and portal, with reachable mobile navigation', async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    const logo = page.getByAltText('RepairMe — Fixed. Fast. Trusted.');
    await expect(logo).toBeVisible();
    await expect
      .poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `docs/qa/login-${width}.png`, fullPage: true });
  }
  await page.goto('/preview/dashboard');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByAltText('RepairMe — Fixed. Fast. Trusted.')).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
});
