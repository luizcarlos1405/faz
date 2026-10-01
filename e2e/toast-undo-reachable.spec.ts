import { test, expect, type Page, type Locator } from '@playwright/test';

async function addTask(page: Page, title: string) {
  await page.getByPlaceholder('Add a task...').fill(title);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('li[data-task-id]', { hasText: title })).toBeVisible();
}

async function toast(page: Page, text: string): Promise<Locator> {
  const toast = page.locator('div[aria-live="polite"] [role="status"]').filter({ hasText: text });
  await expect(toast).toBeVisible();
  return toast;
}

async function swipeRight(target: Locator) {
  await target.evaluate((el) => {
    const touchAt = (x: number) =>
      new Touch({ identifier: 1, target: el, clientX: x, clientY: 40 });
    const opts = { bubbles: true, cancelable: true } as const;
    el.dispatchEvent(new TouchEvent('touchstart', { ...opts, touches: [touchAt(100)] }));
    el.dispatchEvent(new TouchEvent('touchmove', { ...opts, touches: [touchAt(180)] }));
    el.dispatchEvent(new TouchEvent('touchmove', { ...opts, touches: [touchAt(250)] }));
    el.dispatchEvent(
      new TouchEvent('touchend', { ...opts, touches: [], changedTouches: [touchAt(250)] }),
    );
  });
}

async function spinWheel(page: Page, label: string, index: number) {
  await page
    .locator(`[role="listbox"][aria-label="${label}"] .wheel-viewport`)
    .evaluate((el, idx) => {
      const count = el.querySelectorAll('.wheel-item').length / 3;
      el.scrollTop = (count + idx) * 44;
      el.dispatchEvent(new Event('scroll'));
    }, index);
  await page.waitForTimeout(300);
}

test('toast Undo is clickable above the focus mode overlay', async ({ page }) => {
  await page.goto('/#/tasks');
  await addTask(page, 'Focus task one');
  await addTask(page, 'Focus task two');

  await page.locator('button.btn-primary.btn-circle').click();
  await expect(page.getByTestId('focus-title')).toHaveText('Focus task one');

  await page.getByRole('button', { name: 'Pick a time' }).click();
  const setButton = page.getByRole('button', { name: /^Set / });
  if (await setButton.isDisabled()) {
    await spinWheel(page, 'Hour', 23);
    await spinWheel(page, 'Minute', 59);
  }
  await setButton.click();

  const undo = (await toast(page, 'Hidden until')).getByRole('button', { name: 'Undo' });
  await undo.click();

  await expect(page.getByTestId('focus-title').filter({ hasText: 'Focus task one' })).toBeVisible();
});

test('toast Undo is clickable above the tasks page FAB', async ({ page }) => {
  await page.goto('/#/tasks');
  await addTask(page, 'Postpone me');
  await addTask(page, 'Keep me around');

  await swipeRight(
    page.locator('[aria-roledescription="swipeable"]').filter({ hasText: 'Postpone me' }),
  );

  const todoList = page.locator('h2:has-text("To Do") + ul');
  await expect(todoList.getByText('Postpone me')).toBeHidden();

  const undo = (await toast(page, 'Postponed to tomorrow')).getByRole('button', {
    name: 'Undo',
  });
  await undo.click();

  await expect(todoList.getByText('Postpone me')).toBeVisible();
});
