import { test, expect } from '@playwright/test';

test('tutorial should complete without console errors', async ({ page }) => {
  const errors: string[] = [];
  
  page.on('pageerror', err => {
    errors.push(`PageError: ${err.message}`);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`ConsoleError: ${msg.text()}`);
    }
  });

  // Clear localStorage to ensure tutorial runs
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.goto('/');

  // Wait for game to initialize
  await page.waitForTimeout(3000);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (box) {
    // Attempt to interact with the game (click around the center to potentially move furniture or trigger tutorial step)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
    await page.mouse.up();
    await page.waitForTimeout(1000);
    
    // Simulate tower build (clicking left toolbar, then clicking map)
    await page.mouse.click(box.x + 36, box.y + 170); // left toolbar slot
    await page.waitForTimeout(500);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1000);
  }

  expect(errors).toEqual([]);
});
