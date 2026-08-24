import { test, expect } from '@playwright/test';

test('pause and resume a goal', async ({ page }) => {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  const goalTitle = `E2E pause goal ${Date.now()}`;

  await page.goto('/#/goals');
  await page.getByPlaceholder('Add a goal...').fill(goalTitle);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('list').getByText(goalTitle)).toBeVisible();

  await page.getByRole('list').getByText(goalTitle).click();
  await expect(page.getByRole('heading', { name: goalTitle })).toBeVisible();

  await page.locator('.navbar .dropdown.dropdown-end > button').click();
  await page.getByRole('menu').getByRole('button', { name: 'Pause goal' }).click();

  await expect(page).toHaveURL(/#\/goals$/);
  await expect(page.getByRole('list').getByText(goalTitle)).toHaveCount(0);

  await page.getByRole('tab', { name: 'Paused' }).click();
  await expect(page.getByRole('list').getByText(goalTitle)).toBeVisible();

  await page.getByRole('list').getByText(goalTitle).click();
  await expect(page.getByRole('heading', { name: goalTitle })).toBeVisible();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();

  await page.locator('.navbar .dropdown.dropdown-end > button').click();
  await page.getByRole('menu').getByRole('button', { name: 'Resume goal' }).click();

  await expect(page.getByText('Paused', { exact: true })).toHaveCount(0);

  await page.locator('.navbar .dropdown.dropdown-end > button').click();
  await expect(page.getByRole('menu').getByRole('button', { name: 'Pause goal' })).toBeVisible();

  await expect(errors).toEqual([]);
});

test('adding a goal on the paused tab creates it paused', async ({ page }) => {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  const goalTitle = `E2E born-paused goal ${Date.now()}`;

  await page.goto('/#/goals');
  await page.getByRole('tab', { name: 'Paused' }).click();
  await expect(page.getByText('Nothing paused yet.')).toBeVisible();

  await page.getByPlaceholder('Add a goal...').fill(goalTitle);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('list').getByText(goalTitle)).toBeVisible();

  await page.getByRole('tab', { name: 'Active' }).click();
  await expect(page.getByRole('list').getByText(goalTitle)).toHaveCount(0);

  await page.getByRole('tab', { name: 'Paused' }).click();
  await page.getByRole('list').getByText(goalTitle).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();

  await expect(errors).toEqual([]);
});
