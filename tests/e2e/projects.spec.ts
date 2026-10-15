import { test, expect } from '@playwright/test';
test('a project overview lets the CEO or leader change the leader or delete the project', async ({
  page,
}) => {
  await page.goto('/preview/projects');
  await page.getByText('Website Redesign').first().click();
  const overview = page.getByRole('dialog', { name: 'Project overview' });
  await expect(overview.getByText('Project leader', { exact: true })).toBeVisible();
  await expect(overview.getByRole('button', { name: 'Change leader' })).toBeVisible();
  await overview.getByRole('button', { name: 'Change leader' }).click();
  const change = page.getByRole('dialog', { name: 'Change project leader' });
  await expect(change.getByText('Current leader')).toBeVisible();
  await expect(change.getByLabel('New project leader')).toBeVisible();
  await expect(change.getByRole('button', { name: 'Change leader' })).toBeVisible();
});
test('deleting a project asks for a reason and explains what happens', async ({ page }) => {
  await page.goto('/preview/projects');
  await page.getByText('Website Redesign').first().click();
  await page.getByRole('button', { name: 'Delete project' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete project' });
  await expect(dialog.getByText('Open tasks are cancelled')).toBeVisible();
  await expect(dialog.getByLabel('Why is it being deleted?')).toBeVisible();
  // This project has a completed task, so the CEO must also type its name.
  await expect(dialog.getByText(/This project has completed tasks or work logs/)).toBeVisible();
  await expect(dialog.getByLabel(/to confirm/)).toBeVisible();
});
test('creating a project requires choosing a leader', async ({ page }) => {
  await page.goto('/preview/projects');
  await page
    .getByRole('button', { name: /new project/i })
    .first()
    .click();
  await expect(page.getByLabel('Project leader')).toBeVisible();
});
