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

  const { gameWidth, gameHeight } = await page.evaluate(() => {
    const cvs = document.querySelector('canvas');
    return { gameWidth: cvs?.width || 480, gameHeight: cvs?.height || 800 };
  });

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (box) {
    const scaleX = box.width / gameWidth;
    const scaleY = box.height / gameHeight;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Click "ОБУЧЕНИЕ" button in the main menu (logical y = center + 105)
    await page.mouse.click(cx, cy + 105 * scaleY);
  }

  // Wait for MainScene (the game itself) to initialize
  await page.waitForTimeout(5000);

  if (box) {
    const scaleX = box.width / gameWidth;
    const scaleY = box.height / gameHeight;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // 0. Click "ПОНЯТНО" (OK) button to dismiss intro (logical y = center + 40)
    await page.mouse.click(cx, cy + 40 * scaleY);
    await page.waitForTimeout(8000); // Wait for enemy to spawn and reach y > 200 to trigger step_furniture

    // 1. Actually do Step 1: select cabinet and place it
    await page.mouse.click(box.x + 42 * scaleX, box.y + 578 * scaleY); // Select cabinet (index 6)
    await page.waitForTimeout(500);
    // Click on a valid empty spot (try multiple in case of random obstacles)
    await page.mouse.click(box.x + 240 * scaleX, box.y + 400 * scaleY);
    await page.mouse.click(box.x + 320 * scaleX, box.y + 400 * scaleY);
    await page.mouse.click(box.x + 160 * scaleX, box.y + 400 * scaleY);
    await page.waitForTimeout(1000); // Wait for animation and step 2 to trigger
    
    // 2. Do Step 2: select tower and place it
    await page.mouse.click(box.x + 42 * scaleX, box.y + 170 * scaleY); // select first tower (Cooler)
    await page.waitForTimeout(500);
    // Click on a valid empty spot (try multiple in case of random obstacles)
    await page.mouse.click(box.x + 240 * scaleX, box.y + 320 * scaleY);
    await page.mouse.click(box.x + 320 * scaleX, box.y + 320 * scaleY);
    await page.mouse.click(box.x + 160 * scaleX, box.y + 320 * scaleY);
    await page.waitForTimeout(1500); // Wait for tower to be placed and tutorial to complete
  }

  expect(errors).toEqual([]);

  // Verify that meta.tutorialCompleted was set to true
  const meta = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem('itdefence_meta') || '{}');
  });

  expect(meta.tutorialCompleted).toBe(true);
});
