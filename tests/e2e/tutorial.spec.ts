import { test, expect } from '@playwright/test';

test('tutorial should complete successfully', async ({ page }) => {
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

  // Wait for the main menu to load
  await page.waitForTimeout(1500);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (box) {
    // Click "СТАРТ" button in the main menu (centered, y = height/2 - 20)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 20);
  }

  // Wait for MainScene (the game itself) to initialize
  await page.waitForTimeout(2000);

  if (box) {
    // 1. Trigger furniture_moved by dispatching it via __EventBus
    await page.evaluate(() => {
      if ((window as any).__EventBus) {
        (window as any).__EventBus.emit('furniture_moved');
      }
    });

    await page.waitForTimeout(1000); // Wait for step 2 animation to settle
    
    // 2. Simulate tower build (clicking left toolbar, then clicking map)
    await page.mouse.click(box.x + 36, box.y + 170); // select first tower from toolbar
    await page.waitForTimeout(500);
    // Click on a valid empty spot in the map inside the office (y > 224). 
    // Try multiple spots in case one is occupied by random furniture.
    await page.mouse.click(box.x + 200, box.y + 300);
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + 200, box.y + 400);
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + 300, box.y + 300);
    await page.waitForTimeout(1000); // Wait for tower to be placed and tutorial to complete
  }

  expect(errors).toEqual([]);

  // Verify that meta.tutorialCompleted was set to true
  const meta = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem('itdefence_meta') || '{}');
  });

  expect(meta.tutorialCompleted).toBe(true);
});
