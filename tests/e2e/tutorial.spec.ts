import { test, expect } from '@playwright/test';

test('tutorial should complete successfully', async ({ page }) => {
  test.setTimeout(90000); // 90 seconds timeout for slow CI environments
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
  await page.waitForTimeout(3000);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (box) {
    const scale = box.height / 800;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Click "ОБУЧЕНИЕ" button in the main menu (centered, logical y = center + 105)
    await page.mouse.click(cx, cy + 105 * scale);
  }

  // Wait for MainScene (the game itself) to initialize
  await page.waitForTimeout(5000);

  if (box) {
    const scale = box.height / 800;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // 0. Click "ПОНЯТНО" (OK) button to dismiss intro (logical x = center, y = center + 40)
    await page.mouse.click(cx, cy + 40 * scale);
    await page.waitForTimeout(15000); // Wait for enemy to spawn and reach y > 200 to trigger step_furniture

    // 1. Trigger furniture_moved by dispatching it via __EventBus
    await page.evaluate(() => {
      if ((window as any).__EventBus) {
        (window as any).__EventBus.emit('furniture_moved');
      }
    });

    await page.waitForTimeout(1000); // Wait for step 2 animation to settle
    
    // 2. Simulate tower build (clicking left toolbar, then clicking map)
    await page.mouse.click(box.x + 36 * scale, box.y + 170 * scale); // select first tower from toolbar
    await page.waitForTimeout(500);
    // Click on a valid empty spot in the map inside the office (y > 224). 
    await page.mouse.click(box.x + 200 * scale, box.y + 300 * scale);
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + 200 * scale, box.y + 400 * scale);
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + 300 * scale, box.y + 300 * scale);
    await page.waitForTimeout(1000); // Wait for tower to be placed and tutorial to complete
  }

  expect(errors).toEqual([]);

  // Verify that meta.tutorialCompleted was set to true
  const meta = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem('itdefence_meta') || '{}');
  });

  expect(meta.tutorialCompleted).toBe(true);
});
