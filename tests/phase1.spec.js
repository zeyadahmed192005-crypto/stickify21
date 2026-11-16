import { test, expect } from '@playwright/test';

test.describe('Phase 1 Acceptance Tests', () => {

  test('1. Zero console errors on clean load of index.html, admin.html, and packing-slip.html', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(errors, 'index.html has console errors').toEqual([]);

    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    expect(errors, 'admin.html has console errors').toEqual([]);

    await page.goto('/packing-slip.html', { waitUntil: 'domcontentloaded' });
    expect(errors, 'packing-slip.html has console errors').toEqual([]);
  });

  test('2. Sticker sizes visibly differ in stage and update prices correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // First sticker (DEV-01: Git Push --Force)
    const stickerCard = page.locator('.sticker-card').filter({ hasText: 'جيت بوش بالقوة' }).first();
    const stage = stickerCard.locator('[id^="graphic-wrapper-"]');
    const price = stickerCard.locator('[id^="card-price-"]');

    // Default is Medium (8cm) -> w-28 h-28
    await expect(stage).toHaveClass(/w-28 h-28/);
    await expect(price).toHaveText('35');

    // Click Small (6cm) -> w-24 h-24
    await stickerCard.locator('button:has-text("6 سم")').click();
    await expect(stage).toHaveClass(/w-24 h-24/);
    await expect(price).toHaveText('25');

    // Click Large (10cm) -> w-36 h-36 (Fixes Bug 01: w-34 h-34 replaced with w-36 h-36)
    await stickerCard.locator('button:has-text("10 سم")').click();
    await expect(stage).toHaveClass(/w-36 h-36/);
    await expect(price).toHaveText('50');
  });

  test('3. Bookmarks do not have "للباقة" button and packs contain only stickers', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Find a bookmark card
    const bookmarkCard = page.locator('.sticker-card').filter({ hasText: 'فاصل كتب' }).first();
    await expect(bookmarkCard).toBeVisible();

    // Verify "للباقة" button does NOT exist on the bookmark card
    const packBtn = bookmarkCard.locator('button:has-text("للباقة")');
    await expect(packBtn).toHaveCount(0);
  });

  test('4. Pack builder adds pack as a single atomic cart item with discount', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Click 5 stickers to add to pack
    const stickerCards = page.locator('.sticker-card').filter({ hasText: 'للباقة' });
    const count = await stickerCards.count();
    expect(count).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < 5; i++) {
      await stickerCards.nth(i).locator('button:has-text("للباقة")').click();
    }

    // Pack builder info should show ready
    const packSection = page.locator('#pack-builder-section');
    await expect(packSection).toContainText('المكتمل: 5 من 5');

    // Click "إضافة باقة الـ 5 بالكامل للسلة"
    const addPackBtn = packSection.locator('button:has-text("إضافة باقة الـ 5 بالكامل للسلة")');
    await expect(addPackBtn).toBeEnabled();
    await addPackBtn.click();

    // Cart modal opens
    const cartModal = page.locator('#cart-modal');
    await expect(cartModal).toBeVisible();

    // The pack must be ONE single bundle card in the cart, not 5 separate items
    const packCartItem = cartModal.locator('#cart-items-container > div');
    await expect(packCartItem).toHaveCount(1);
    await expect(packCartItem).toContainText('باقة توفير (5 استيكرات)');

    // Deleting the pack removes the entire bundle cleanly
    const deleteBtn = packCartItem.locator('button[title="حذف الباقة بالكامل"]');
    await deleteBtn.click();
    await expect(cartModal.locator('#cart-items-container')).toContainText('سلتك فارغة');
  });

  test('5. XSS Prevention: malicious customer name renders as plain text without executing', async ({ page }) => {
    const maliciousPayload = '<img src=x onerror="window.__xssTriggered=true">';
    
    // Set an order with XSS payload in localStorage
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((payload) => {
      const order = {
        id: 'S21-XSS-TEST',
        date: '2026/11/16',
        status: 'جديد',
        customer: {
          name: payload,
          phone: '01043546503',
          city: 'القاهرة',
          address: '123 Test St',
          notes: 'XSS test'
        },
        payment: 'عند الاستلام',
        total: 100,
        items: [
          { sku: 'DEV-01', nameAr: 'جيت بوش ' + payload, size: '8 سم', qty: 1, price: 35 }
        ]
      };
      localStorage.setItem('stickify21_orders', JSON.stringify([order]));
    }, maliciousPayload);

    // 1. Check Admin Portal
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#admin-pin-input', '2121');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#orders-list-container');

    const adminHtml = await page.innerHTML('#orders-list-container');
    // Must be escaped HTML entity, not live element
    expect(adminHtml).toContain('&lt;img src=x onerror=');
    const xssInAdmin = await page.evaluate(() => window.__xssTriggered);
    expect(xssInAdmin).toBeUndefined();

    // 2. Check Packing Slip
    await page.goto('/packing-slip.html?id=S21-XSS-TEST', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#customer-name');
    const customerNameText = await page.innerText('#customer-name');
    expect(customerNameText).toBe(maliciousPayload);

    const itemsGridHtml = await page.innerHTML('#items-grid');
    expect(itemsGridHtml).toContain('&lt;img src=x');
    const xssInSlip = await page.evaluate(() => window.__xssTriggered);
    expect(xssInSlip).toBeUndefined();
  });

  test('6. Mockup drag moves placed sticker smoothly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mockup-studio-section');

    // Click on a sticker card's preview button
    const previewBtn = page.locator('.sticker-card button[title="جرب على جهازك"]').first();
    await previewBtn.click();
    await page.waitForSelector('.mockup-placed-sticker');

    const sticker = page.locator('.mockup-placed-sticker').first();
    await expect(sticker).toBeVisible();
    await sticker.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400); // Allow scroll to settle

    const initialBox = await sticker.boundingBox();
    expect(initialBox).not.toBeNull();

    // Drag sticker with mouse/pointer
    await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(initialBox.x + initialBox.width / 2 + 60, initialBox.y + initialBox.height / 2 + 50, { steps: 5 });
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(50);

    const newBox = await sticker.boundingBox();
    expect(newBox.x).not.toEqual(initialBox.x);
  });

});
