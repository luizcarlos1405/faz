import { test, expect, type Page } from '@playwright/test';

function captureErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function addTask(page: Page, title: string) {
  await page.getByPlaceholder('Add a task...').fill(title);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('list').getByText(title)).toBeVisible();
}

async function openFocus(page: Page) {
  await page.locator('.btn-primary.btn-circle').click();
  await expect(page).toHaveURL(/#\/focus$/);
  await expect(page.getByRole('button', { name: 'Exit' })).toBeVisible();
}

const todoSection = (page: Page) =>
  page.locator('h2', { hasText: /^To Do$/i }).locator('xpath=following-sibling::ul[1]');
const laterSection = (page: Page) => page.getByTestId('later-list');

test('hide a task until a time from focus mode, then clear it from the edit form', async ({
  page,
}) => {
  const errors = captureErrors(page);
  const title = `E2E defer ${Date.now()}`;

  await page.goto('/#/tasks');
  await addTask(page, title);
  await addTask(page, `${title} second`);
  await openFocus(page);

  await expect(page.getByTestId('focus-title')).toHaveText(title);
  await page.getByRole('button', { name: 'Pick a time' }).click();
  const setButton = page.getByRole('button', { name: /^Set / });
  await expect(setButton).toBeEnabled();
  await setButton.click();

  await expect(page.getByText(/^Hidden until/)).toBeVisible();
  await expect(page.getByTestId('focus-title').last()).toHaveText(`${title} second`);

  await page.getByRole('button', { name: 'Exit' }).click();
  await expect(page).toHaveURL(/#\/tasks$/);

  await expect(laterSection(page).getByText(title, { exact: true })).toBeVisible();
  await expect(laterSection(page).getByText(/after \d/)).toBeVisible();
  await expect(todoSection(page).getByText(title, { exact: true })).toHaveCount(0);

  await laterSection(page).getByText(title, { exact: true }).click();
  await expect(page.getByTestId('edit-time-button')).toContainText('After');
  await page.getByRole('button', { name: 'Clear time' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(todoSection(page).getByText(title, { exact: true })).toBeVisible();
  await expect(laterSection(page)).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('+1 stacks the target day, x resets it, and the label moves the task', async ({ page }) => {
  const errors = captureErrors(page);
  const title = `E2E plus one ${Date.now()}`;

  await page.goto('/#/tasks');
  await addTask(page, title);
  await openFocus(page);

  const postpone = page.getByTestId('postpone-button');
  await expect(postpone).toHaveText(/Tomorrow/);
  await expect(page.getByRole('button', { name: 'Back to tomorrow' })).toHaveCount(0);

  await page.getByRole('button', { name: 'One more day' }).click();
  await expect(postpone).not.toHaveText(/Tomorrow/);
  const afterOne = (await postpone.textContent())?.trim();

  await page.getByRole('button', { name: 'One more day' }).click();
  const afterTwo = (await postpone.textContent())?.trim();
  expect(afterTwo).not.toBe(afterOne);

  await page.getByRole('button', { name: 'Back to tomorrow' }).click();
  await expect(postpone).toHaveText(/Tomorrow/);

  await page.getByRole('button', { name: 'One more day' }).click();
  await postpone.click();

  await expect(page.getByText(/^Moved to /)).toBeVisible();
  await expect(page).toHaveURL(/#\/tasks$/);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('calendar picker moves the task to the chosen day', async ({ page }) => {
  const errors = captureErrors(page);
  const title = `E2E calendar ${Date.now()}`;

  await page.goto('/#/tasks');
  await addTask(page, title);
  await openFocus(page);

  await page.getByRole('button', { name: 'Pick a date' }).click();
  const confirm = page.locator('.modal-open .btn-success');
  await expect(confirm).toBeDisabled();

  const calendar = page.locator('calendar-month');
  const enabledDays = calendar.getByRole('button', { disabled: false });
  const count = await enabledDays.count();
  if (count === 0) {
    await page.getByRole('button', { name: 'Next month' }).click();
  }
  await calendar.getByRole('button', { disabled: false }).first().click();

  await expect(confirm).toBeEnabled();
  await expect(confirm).toHaveText(/Move to/);
  await confirm.click();

  await expect(page.getByText(/^(Moved to|Postponed to tomorrow)/)).toBeVisible();
  await expect(page).toHaveURL(/#\/tasks$/);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('a hidden task comes back on its own once the time passes', async ({ page }) => {
  const errors = captureErrors(page);
  const title = `E2E tick ${Date.now()}`;

  await page.clock.install();
  await page.goto('/#/tasks');
  await addTask(page, title);
  await openFocus(page);

  await page.getByRole('button', { name: 'Pick a time' }).click();
  await page.getByRole('button', { name: /^Set / }).click();
  await expect(page.getByText(/^Hidden until/)).toBeVisible();
  await expect(page).toHaveURL(/#\/tasks$/);

  await expect(laterSection(page).getByText(title, { exact: true })).toBeVisible();

  await page.clock.fastForward('06:00');

  await expect(todoSection(page).getByText(title, { exact: true })).toBeVisible();
  await expect(laterSection(page)).toHaveCount(0);

  expect(errors).toEqual([]);
});
