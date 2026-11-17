import { test, expect } from '@playwright/test';

test.describe('Round 2 - Phase B: Pricing, Payments & Holographic Purge', () => {

  test('R3: Holographic finish completely removed from filters, product cards, detail modal, admin and migrated to glossy', async ({ page }) => {
    // 1. Check storefront finish filter
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Finish filter buttons must NOT contain holographic / هولوجرافيك
    const finishButtons = page.locator('#finish-filter-bar button, .finish-filter-btn');
    const buttonTexts = await finishButtons.allInnerTexts();
    for (const text of buttonTexts) {
      expect(text).not.toContain('هولوجرافيك');
      expect(text).not.toContain('هولوجرام');
      expect(text).not.toContain('Holographic');
    }

    // 2. Open product detail modal
    await page.goto('/#/product/stk-logo', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#product-detail-modal:not(.hidden)');

    // Finishes in detail modal: only matte and glossy allowed
    const finishOptions = page.locator('#modal-finish-options button, input[name="product-finish"]');
    const finishCount = await finishOptions.count();
    expect(finishCount).toBeGreaterThanOrEqual(1);
    const finishModalTexts = await page.locator('#modal-finish-options').innerText();
    expect(finishModalTexts).not.toContain('هولوجرافيك');
    expect(finishModalTexts).not.toContain('holographic');

    // 3. Migration: Pre-populate an item with holographic finish in localStorage and verify migration to glossy
    await page.evaluate(() => {
      const prods = JSON.parse(localStorage.getItem('stickify21_products') || '[]');
      if (prods.length > 0) {
        prods[0].finish = 'holographic';
        prods[0].finishes = ['matte', 'holographic'];
        localStorage.setItem('stickify21_products', JSON.stringify(prods));
      }
    });

    await page.reload();
    await page.waitForSelector('#products-grid .sticker-card');

    const migratedProds = await page.evaluate(() => JSON.parse(localStorage.getItem('stickify21_products') || '[]'));
    expect(migratedProds[0].finish).not.toBe('holographic');
    expect(migratedProds[0].finish).toBe('glossy');
    expect(migratedProds[0].finishes).not.toContain('holographic');
  });

  test('R10: Automatic packs grouping in cart, mixed sizes, bookmarks exclusion, and nudge message', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Clear cart
    await page.evaluate(() => {
      localStorage.setItem('stickify21_cart', '[]');
    });
    await page.reload();

    const addButtons = page.locator('.sticker-card button:has-text("أضف للسلة")');
    const cartToggle = page.locator('#cart-btn');
    
    // Add 4 loose stickers (each 35 EGP)
    for (let i = 0; i < 4; i++) {
      await addButtons.nth(i).click();
      await page.waitForTimeout(100);
    }

    // Open cart
    await cartToggle.click();
    await page.waitForSelector('#cart-modal:not(.hidden)');

    // With 4 stickers, subtotal = 4 * 35 = 140. No pack formed yet.
    // Nudge should be visible indicating 1 more sticker needed for 20% discount
    const nudgeEl = page.locator('#pack-nudge-banner, .pack-nudge');
    await expect(nudgeEl).toBeVisible();
    await expect(nudgeEl).toContainText(/1|واحد/);

    // Close cart and add 1 more sticker (5th sticker)
    await page.locator('#cart-modal button[onclick*="toggleCartModal(false)"]').click();
    await addButtons.nth(4).click();

    // Reopen cart
    await cartToggle.click();
    await page.waitForSelector('#cart-modal:not(.hidden)');

    // 5 stickers should automatically form a 5-pack (-20% discount): (35+35+35+30+30) * 0.8 = 132 EGP
    const packSection = page.locator('#cart-items-container').filter({ hasText: 'باقة' });
    await expect(packSection).toBeVisible();
    await expect(page.locator('#cart-summary-container')).toContainText('132');

    // Add 2 more stickers (total 7 stickers: 5 in pack (140) + 2 singles (60) = 200 EGP)
    await page.locator('#cart-modal button[onclick*="toggleCartModal(false)"]').click();
    await addButtons.nth(0).click();
    await addButtons.nth(1).click();

    await cartToggle.click();
    await expect(page.locator('#cart-summary-container')).toContainText('200');

    // Add 1 bookmark (25 EGP). Should NOT count toward sticker packs!
    // Total should become 200 + 25 = 225 EGP
    await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem('stickify21_cart') || '[]');
      cart.push({
        type: 'bookmark',
        sku: 'BM-01',
        nameAr: 'فاصل كتب تجريبي',
        price: 25,
        quantity: 1
      });
      localStorage.setItem('stickify21_cart', JSON.stringify(cart));
      sessionStorage.setItem('stickify21_cart_open', '1');
      window.location.reload();
    });

    await page.waitForSelector('#cart-modal:not(.hidden)');
    await expect(page.locator('#cart-summary-container')).toContainText('225');
  });

  test('R12: Payment accounts in Admin settings, proof upload in checkout, and verification workflow', async ({ page }) => {
    // 1. Visit admin settings to verify payment methods manager
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    const pinInput = page.locator('#admin-pin-input');
    if (await pinInput.isVisible()) {
      await pinInput.fill('2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Switch to Settings tab
    await page.click('#tab-btn-settings');
    await page.waitForSelector('#tab-settings:not(.hidden)');

    // Verify Payment Accounts manager exists
    const paymentAccountsManager = page.locator('#payment-accounts-manager');
    await expect(paymentAccountsManager).toBeVisible();

    // Verify default accounts exist (InstaPay and Vodafone Cash)
    await expect(paymentAccountsManager).toContainText('InstaPay');
    await expect(paymentAccountsManager).toContainText('فودافون كاش');

    // 2. Go to storefront checkout with InstaPay
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Add 1 sticker and open checkout
    const addBtn = page.locator('.sticker-card').first().locator('button:has-text("أضف للسلة")');
    await addBtn.click();
    await page.click('#cart-btn');
    await page.waitForSelector('#cart-modal:not(.hidden)');
    await page.click('#open-checkout-btn');
    await page.waitForSelector('#checkout-modal:not(.hidden)');

    // Select InstaPay payment method
    await page.click('input[value="instapay"], #pay-instapay');

    // Verify account details & copy button appear
    const instapayDetails = page.locator('#payment-method-details');
    await expect(instapayDetails).toBeVisible();
    await expect(instapayDetails.locator('button:has-text("نسخ"), .copy-btn')).toBeVisible();

    // Verify Payment Proof upload input is visible and required for InstaPay
    const proofInput = page.locator('#payment-proof-file');
    await expect(proofInput).toBeVisible();

    // Fill customer form
    await page.fill('#order-name', 'عمر شريف');
    await page.fill('#order-phone', '01234567890');
    await page.selectOption('#order-city', 'القاهرة');
    await page.fill('#order-address', 'المعادي - شارع 9');

    // Upload proof image
    await proofInput.setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    });

    // Verify proof preview is shown
    await expect(page.locator('#payment-proof-preview')).toBeVisible();

    // Submit order
    await page.click('#checkout-submit-btn');
    await page.waitForSelector('#order-confirmation-modal:not(.hidden)');

    // Verify WhatsApp payment proof share button exists in confirmation modal
    const shareProofBtn = page.locator('#share-proof-whatsapp-btn');
    await expect(shareProofBtn).toBeVisible();
  });

  test('A6 & A7: Admin quick order filters (Today, Needs Preparing, Needs Shipping, Unverified Payment) and WhatsApp templates', async ({ page }) => {
    // Seed orders with various statuses
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    const pinInput = page.locator('#admin-pin-input');
    if (await pinInput.isVisible()) {
      await pinInput.fill('2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    await page.evaluate(() => {
      const todayIso = new Date().toISOString();
      const testOrders = [
        {
          id: 'S21-P2-ORD1',
          date: todayIso,
          status: 'confirmed',
          customer: { name: 'علي حسن', phone: '01011111111', city: 'القاهرة' },
          paymentMethod: 'instapay',
          paymentVerified: false,
          total: 100,
          lines: [{ type: 'single', sku: 'S21-01', name: 'شعار', unitPrice: 35, quantity: 1 }]
        },
        {
          id: 'S21-P2-ORD2',
          date: todayIso,
          status: 'ready',
          customer: { name: 'نهى طارق', phone: '01022222222', city: 'الجيزة' },
          paymentMethod: 'cod',
          paymentVerified: true,
          total: 150,
          lines: [{ type: 'single', sku: 'S21-02', name: 'جيت بوش', unitPrice: 35, quantity: 1 }]
        }
      ];
      localStorage.setItem('stickify21_orders', JSON.stringify(testOrders));
      sessionStorage.setItem('stickify21_admin_auth', 'true');
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    const pinInputReload = page.locator('#admin-pin-input');
    if (await pinInputReload.isVisible()) {
      await pinInputReload.fill('2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Check Quick Filter Tabs exist on orders page (A6)
    const filterTabs = page.locator('#orders-quick-filter-tabs, .order-quick-filter');
    await expect(filterTabs).toBeVisible();

    // Check quick filter buttons
    const filterReadyBtn = page.locator('button[data-quick-filter="needs_shipping"], button:has-text("محتاج شحن")');
    await expect(filterReadyBtn).toBeVisible();
    await filterReadyBtn.click();

    // Only S21-P2-ORD2 (status ready) should be displayed
    const rows = page.locator('#orders-list-container > div');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('S21-P2-ORD2');

    // Check Settings has WhatsApp Message Templates manager (A7)
    await page.click('#tab-btn-settings');
    await page.waitForSelector('#tab-settings:not(.hidden)');

    const waTemplatesManager = page.locator('#whatsapp-templates-manager');
    await expect(waTemplatesManager).toBeVisible();
    await expect(waTemplatesManager.locator('textarea, input')).toHaveCount(2); // At least 2 templates: preparing & shipping
  });

});
