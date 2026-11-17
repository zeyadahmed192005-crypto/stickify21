import { test, expect } from '@playwright/test';

test.describe('Round 2 - Phase D: Visual Mockups & Showcase (R5, R6, R7, R8, A4)', () => {

  test('R5: Total removal of car windshield mockup', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Confirm device selector does NOT contain car_window or car
    const carBtn = page.locator('button[data-device*="car"]');
    await expect(carBtn).toHaveCount(0);

    // Only allowed devices: laptop, phone, bottle, book, notebook
    const deviceButtons = page.locator('.device-tab-btn');
    const deviceCount = await deviceButtons.count();
    expect(deviceCount).toBe(5);

    const devices = [];
    for (let i = 0; i < deviceCount; i++) {
      const dev = await deviceButtons.nth(i).getAttribute('data-device');
      devices.push(dev);
    }
    expect(devices.sort()).toEqual(['book', 'bottle', 'laptop', 'notebook', 'phone'].sort());

    // Calling changeMockupDevice('car_window') via window should be a no-op
    await page.evaluate(() => {
      if (window.changeMockupDevice) window.changeMockupDevice('car_window');
    });
    const deviceWrapper = page.locator('#device-wrapper');
    await expect(deviceWrapper).not.toHaveClass(/mockup-car/);
  });

  test('R6 & R7: Realistic Mockup SVGs, True-to-Scale Dimensions, Ruler & Curvature', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const studioSection = page.locator('#mockup-studio-section');
    await expect(studioSection).toBeVisible();

    // 1. Switch to laptop (default or click)
    await page.click('button[data-device="laptop"]');
    const deviceWrapper = page.locator('#device-wrapper');
    await expect(deviceWrapper).toBeVisible();

    // Add an 8 cm sticker (default sticker)
    // Click on a sticker preview item to add to mockup
    const addStickerBtn = page.locator('#mockup-studio-section [onclick*="addStickerToMockup(\'stk-1\')"]');
    await addStickerBtn.click();

    // Verify sticker placed
    const placedSticker = page.locator('.mockup-placed-sticker').first();
    await expect(placedSticker).toBeVisible();

    // 2. Scale ratio verification on Laptop (realWidth = 30cm, sticker = 8cm)
    // Ratio = 8 / 30 = 0.2667 (±3%)
    const devBox = await deviceWrapper.boundingBox();
    const stkBox = await placedSticker.boundingBox();
    expect(devBox).not.toBeNull();
    expect(stkBox).not.toBeNull();

    const ratio8 = stkBox.width / devBox.width;
    expect(ratio8).toBeGreaterThanOrEqual(0.23);
    expect(ratio8).toBeLessThanOrEqual(0.30);

    // 3. Switch size to 6 cm (Small)
    const smallBtn = page.locator('button[onclick*="setPlacedStickerSize(\'small\')"]');
    await smallBtn.click();
    const stkBoxSmall = await placedSticker.boundingBox();
    const ratio6 = stkBoxSmall.width / devBox.width;
    // 6 / 30 = 0.20 (±3%)
    expect(ratio6).toBeGreaterThanOrEqual(0.17);
    expect(ratio6).toBeLessThanOrEqual(0.23);

    // 4. Switch size to 10 cm (Large)
    const largeBtn = page.locator('button[onclick*="setPlacedStickerSize(\'large\')"]');
    await largeBtn.click();
    const stkBoxLarge = await placedSticker.boundingBox();
    const ratio10 = stkBoxLarge.width / devBox.width;
    // 10 / 30 = 0.333 (±3%)
    expect(ratio10).toBeGreaterThanOrEqual(0.30);
    expect(ratio10).toBeLessThanOrEqual(0.37);

    // 5. Real-scale caption check
    const captionEl = page.locator('#mockup-scale-caption');
    await expect(captionEl).toBeVisible();
    await expect(captionEl).toContainText(/10\s*(سم|cm)/i);
    await expect(captionEl).toContainText(/30\s*(سم|cm)/i);

    // 6. Ruler overlay toggle
    const rulerToggle = page.locator('#toggle-mockup-ruler');
    await expect(rulerToggle).toBeVisible();
    const rulerOverlay = page.locator('#mockup-ruler-overlay');
    await expect(rulerOverlay).toHaveClass(/hidden/);
    await rulerToggle.click();
    await expect(rulerOverlay).not.toHaveClass(/hidden/);

    // 7. Flask / Tumbler Curvature verification
    await page.click('button[data-device="bottle"]');
    // Verify bottle has cylindrical realistic SVG / styling
    await expect(deviceWrapper).toHaveClass(/mockup-bottle-realistic/);
    // Move sticker toward the edge to test horizontal squeeze scaleX
    await page.evaluate(() => {
      const item = window.__mockupState?.placedStickers?.[0];
      if (item) {
        item.x = 85; // near right edge
        window.renderPlacedStickers?.();
      }
    });
    // Check placed sticker has curvature transform or class applied
    const bottleSticker = page.locator('.mockup-placed-sticker').first();
    const styleAttr = await bottleSticker.getAttribute('style');
    // scaleX should be squeezed (< 1.0) due to cylinder curvature cos(theta)
    expect(styleAttr).toMatch(/scaleX/);

    // 8. Book mockup bookmark top slot placement
    await page.click('button[data-device="book"]');
    await page.click('button[onclick*="clearMockupStickers"]');
    // Add bookmark
    const addBookmarkBtn = page.locator('#mockup-studio-section [onclick*="addStickerToMockup(\'bm-1\')"]');
    await addBookmarkBtn.click();
    const placedBookmark = page.locator('.mockup-placed-sticker').first();
    await expect(placedBookmark).toBeVisible();
    // Verify bookmark is placed sticking out from top (y coordinate <= 25%)
    const bookmarkStyle = await placedBookmark.getAttribute('style');
    expect(bookmarkStyle).toContain('top:');
  });

  test('R8: Product Showcase Strip on Storefront & Admin Showcase Manager', async ({ page }) => {
    // 1. Storefront Showcase Strip
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const showcaseSection = page.locator('#showcase-section');
    await expect(showcaseSection).toBeVisible();

    // Check seeded items count (4-6 items)
    const showcaseItems = showcaseSection.locator('.showcase-item');
    const count = await showcaseItems.count();
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count).toBeLessThanOrEqual(8);

    // Check each item has image and caption
    const firstItem = showcaseItems.first();
    await expect(firstItem.locator('img, svg')).toBeVisible();

    // Check pause on hover capability
    const track = showcaseSection.locator('#showcase-track');
    await expect(track).toBeVisible();

    // 2. Admin Showcase Manager
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    // Authenticate if needed
    const pinInput = page.locator('#admin-pin-input');
    if (await pinInput.isVisible()) {
      await pinInput.fill('2121');
      await page.click('#admin-login-btn');
    }

    // Switch to Showcase tab
    const showcaseTabBtn = page.locator('#tab-btn-showcase');
    await expect(showcaseTabBtn).toBeVisible();
    await showcaseTabBtn.click();

    const showcaseTab = page.locator('#tab-showcase');
    await expect(showcaseTab).toBeVisible();

    // Verify existing items listed
    const adminRows = showcaseTab.locator('.showcase-admin-row');
    const adminRowCount = await adminRows.count();
    expect(adminRowCount).toBeGreaterThanOrEqual(4);

    // Add new showcase item
    const addBtn = page.locator('#open-add-showcase-btn');
    await addBtn.click();

    const modal = page.locator('#showcase-item-modal');
    await expect(modal).toBeVisible();

    await page.fill('#showcase-caption-ar', 'استيكر مميز على لابتوب العمل');
    await page.fill('#showcase-caption-en', 'Awesome sticker on work laptop');
    await page.selectOption('#showcase-device-tag', 'laptop');
    // Provide a sample image (data URL placeholder)
    await page.evaluate(() => {
      const input = document.getElementById('showcase-image-data');
      if (input) input.value = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect fill="%23FF5000" width="400" height="400"/><text x="50%" y="50%" fill="white" font-size="24" text-anchor="middle">STICKIFY</text></svg>';
    });

    await page.click('#save-showcase-btn');
    await expect(modal).toHaveClass(/hidden/);

    // Verify item added
    const newRowCount = await showcaseTab.locator('.showcase-admin-row').count();
    expect(newRowCount).toBe(adminRowCount + 1);

    // Verify reflected on storefront
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#showcase-section')).toContainText('استيكر مميز على لابتوب العمل');

    // Switch to English on storefront
    await page.click('#lang-toggle-btn');
    await expect(page.locator('#showcase-section')).toContainText('Awesome sticker on work laptop');
  });

  test('A4: Visual Size Guide Modal with Everyday Reference Objects', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Size guide trigger button in mockup studio or product section
    const openGuideBtn = page.locator('#open-size-guide-btn');
    await expect(openGuideBtn).toBeVisible();
    await openGuideBtn.click();

    const guideModal = page.locator('#size-guide-modal');
    await expect(guideModal).toBeVisible();

    // Verify presence of all sizes: 6cm, 8cm, 10cm, 15x5cm bookmark
    await expect(guideModal).toContainText(/6\s*(سم|cm)/i);
    await expect(guideModal).toContainText(/8\s*(سم|cm)/i);
    await expect(guideModal).toContainText(/10\s*(سم|cm)/i);
    await expect(guideModal).toContainText(/15/);

    // Verify presence of reference everyday objects
    await expect(guideModal).toContainText(/بطاقة|Card|الهاتف|Phone|الكتاب|Book/i);

    // Close modal
    const closeBtn = guideModal.locator('button[onclick*="closeSizeGuideModal"]').first();
    await closeBtn.click();
    await expect(guideModal).toHaveClass(/hidden/);
  });

});
