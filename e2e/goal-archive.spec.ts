import { test, expect } from '@playwright/test';

test('archive and unarchive a goal', async ({ page }) => {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  const goalTitle = `E2E archive goal ${Date.now()}`;

  await page.goto('/#/goals');
  await page.getByPlaceholder('Add a goal...').fill(goalTitle);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('list').getByText(goalTitle)).toBeVisible();

  await page.getByRole('list').getByText(goalTitle).click();
  await expect(page.getByRole('heading', { name: goalTitle })).toBeVisible();

  await page.locator('.navbar .dropdown.dropdown-end > button').click();
  await page.getByRole('menu').getByRole('button', { name: 'Archive goal' }).click();

  await expect(page).toHaveURL(/#\/goals$/);
  await expect(page.getByRole('list').getByText(goalTitle)).toHaveCount(0);

  await page.getByRole('tab', { name: 'Archived' }).click();
  await expect(page.getByRole('list').getByText(goalTitle)).toBeVisible();

  await page.getByRole('list').getByText(goalTitle).click();
  await expect(page.getByRole('heading', { name: goalTitle })).toBeVisible();
  await expect(page.getByText('Archived', { exact: true })).toBeVisible();

  await page.locator('.navbar .dropdown.dropdown-end > button').click();
  await page.getByRole('menu').getByRole('button', { name: 'Unarchive goal' }).click();

  await expect(page.getByText('Archived', { exact: true })).toHaveCount(0);

  await page.locator('.navbar .dropdown.dropdown-end > button').click();
  await expect(page.getByRole('menu').getByRole('button', { name: 'Archive goal' })).toBeVisible();

  await expect(errors).toEqual([]);
});
