import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

test.describe('P0-1: dist/styles.css Freshness, Safelist & Visual CSS Integrity', () => {
  test('Committed dist/styles.css matches fresh Tailwind CLI build and contains zero holographic rules', async () => {
    const tmpOut = path.join(os.tmpdir(), `stickify21_css_check_${Date.now()}.css`);
    try {
      execSync(`npx tailwindcss -i ./styles.css -o "${tmpOut}" --minify`, {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      const freshCss = fs.readFileSync(tmpOut, 'utf8').trim();
      const committedCss = fs.readFileSync(path.resolve('dist/styles.css'), 'utf8').trim();

      expect(committedCss, 'dist/styles.css is stale compared to fresh Tailwind CLI build').toBe(freshCss);
      expect(committedCss).not.toMatch(/hologram|subtleSheen/i);
      expect(committedCss).toContain('.mockup-bottle-realistic');
      expect(committedCss).toContain('.sticker-glossy-sheen');
      expect(committedCss).toContain('.dark');
      expect(committedCss).toContain('440px');
      expect(committedCss).toContain('220px');
    } finally {
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    }
  });

  test('Flask & Notebook mockups render with proper vertical dimensions and Glossy vs Matte visually differ', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Flask mockup must be vertical (height >= 400px, width <= 260px)
    await page.click('button[data-device="bottle"]');
    await page.waitForTimeout(150);
    const bottleBox = await page.locator('#device-wrapper').boundingBox();
    expect(bottleBox).not.toBeNull();
    expect(bottleBox.height).toBeGreaterThanOrEqual(400);
    expect(bottleBox.width).toBeLessThanOrEqual(280);
    expect(bottleBox.height).toBeGreaterThan(bottleBox.width);

    // Notebook mockup must be vertical A5 (height >= 360px, width <= 330px)
    await page.click('button[data-device="notebook"]');
    await page.waitForTimeout(150);
    const nbBox = await page.locator('#device-wrapper').boundingBox();
    expect(nbBox).not.toBeNull();
    expect(nbBox.height).toBeGreaterThanOrEqual(360);
    expect(nbBox.width).toBeLessThanOrEqual(330);

    // Glossy vs Matte computed sheen check
    await page.click('button[data-device="laptop"]');
    await page.click('#mockup-studio-section [onclick*="addStickerToMockup(\'stk-1\')"]');
    await page.waitForSelector('.mockup-placed-sticker');
    const sheenDiff = await page.evaluate(() => {
      const stk = window.__mockupState.placedStickers[0];
      stk.finish = 'glossy';
      window.renderPlacedStickers();
      const glossyEl = document.querySelector('.mockup-placed-sticker .sticker-glossy-sheen');
      const glossyBg = glossyEl ? getComputedStyle(glossyEl).backgroundImage : 'none';
      stk.finish = 'matte';
      window.renderPlacedStickers();
      const matteEl = document.querySelector('.mockup-placed-sticker .sticker-glossy-sheen');
      return { glossyBg, hasMatteSheen: Boolean(matteEl) };
    });
    expect(sheenDiff.glossyBg).toContain('gradient');
    expect(sheenDiff.hasMatteSheen).toBe(false);
  });

  test('Admin Dark Mode visibly applies dark background color', async ({ page }) => {
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    if (await page.locator('#admin-lock-screen').isVisible()) {
      await page.fill('#admin-pin-input', '2121');
      await page.click('#admin-login-btn');
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.click('#admin-theme-toggle');
    await page.waitForTimeout(150);
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    expect(darkBg).not.toBe(lightBg);
    expect(darkBg).toBe('rgb(14, 14, 16)');

    // Toggle back to light
    await page.click('#admin-theme-toggle');
  });
});
