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

  // Wait for game to initialize
  await page.waitForTimeout(3000);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
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
    // Click on a valid empty spot in the map (e.g. near the center but avoiding center if there's furniture, just use a clear spot)
    await page.mouse.click(box.x + box.width / 2, box.y + 100); 
    await page.waitForTimeout(1000); // Wait for tower to be placed and tutorial to complete
  }

  expect(errors).toEqual([]);

  // Verify that meta.tutorialCompleted was set to true
  const meta = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem('itdefence-meta') || '{}');
  });

  expect(meta.tutorialCompleted).toBe(true);
});
