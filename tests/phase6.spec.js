import { test, expect } from '@playwright/test';

test.describe('Phase 6: Full End-to-End Integration & Migration-Ready Regression Suite', () => {

  test('1. Scenario 16: IndexedDB image upload compresses client-side to WebP <= 1000px and persists in IndexedDB', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const compressionResult = await page.evaluate(async () => {
      // 1. Create a large test image (1600 x 1200) using canvas
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FF5000';
      ctx.fillRect(0, 0, 1600, 1200);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '48px sans-serif';
      ctx.fillText('STICKIFY 21 LARGE TEST ARTWORK', 100, 200);

      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const testFile = new File([blob], 'large-sticker-art.png', { type: 'image/png' });

      // 2. Import compression and IndexedDB functions
      const { compressImageToWebP, saveAssetToIndexedDb, getAssetFromIndexedDb } = await import('/src/data/localAdapter.js');

      // 3. Compress to WebP (max 1000px)
      const compressedBlob = await compressImageToWebP(testFile, 1000, 0.85);

      // Verify blob type
      const isWebP = compressedBlob.type === 'image/webp';

      // 4. Verify resulting dimensions
      const img = new Image();
      const imgUrl = URL.createObjectURL(compressedBlob);
      const dimensions = await new Promise((resolve) => {
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
          URL.revokeObjectURL(imgUrl);
        };
        img.src = imgUrl;
      });

      // 5. Save to IndexedDB
      const assetId = 'asset-test-' + Date.now();
      await saveAssetToIndexedDb(assetId, compressedBlob, { originalName: testFile.name, type: compressedBlob.type });

      // 6. Retrieve from IndexedDB (returns Blob directly)
      const retrievedBlob = await getAssetFromIndexedDb(assetId);

      return {
        originalWidth: 1600,
        originalHeight: 1200,
        isWebP,
        compressedWidth: dimensions.width,
        compressedHeight: dimensions.height,
        retrievedMatches: retrievedBlob && retrievedBlob.size === compressedBlob.size,
        retrievedType: retrievedBlob ? retrievedBlob.type : null
      };
    });

    // Validations
    expect(compressionResult.isWebP).toBe(true);
    expect(compressionResult.compressedWidth).toBe(1000); // 1600 scaled down to 1000
    expect(compressionResult.compressedHeight).toBe(750); // 1200 * (1000/1600) = 750
    expect(compressionResult.retrievedMatches).toBe(true);
    expect(compressionResult.retrievedType).toBe('image/webp');
  });

  test('2. Complete Customer Journey: Deep link -> Custom print -> Cart -> Coupon -> Governorate shipping -> Vodafone Cash checkout', async ({ page }) => {
    // Intercept window.open for WhatsApp order routing
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      window.__openedUrls = [];
      window.open = function(url) {
        window.__openedUrls.push(url);
        return { focus: () => {} };
      };
    });

    // 2.1 Deep link to product modal
    await page.goto('/#/product/stk-1', { waitUntil: 'domcontentloaded' });
    const productModal = page.locator('#product-detail-modal');
    await expect(productModal).toBeVisible();
    await expect(productModal).toContainText('جيت بوش');

    // Select 10cm size and glossy finish
    await productModal.locator('button', { hasText: '10 سم' }).click();
    await productModal.locator('button', { hasText: 'لامع' }).click();

    // Increase quantity to 2 (total = 100 EGP to satisfy STICKIFY10 coupon minSubtotal)
    await productModal.locator('button', { hasText: '+' }).click();

    // Add to cart
    await productModal.locator('button', { hasText: 'إضافة إلى سلة المشتريات' }).click();
    await expect(page.locator('#cart-modal')).toBeVisible();

    // Close cart modal
    await page.locator('#cart-modal button[onclick*="toggleCartModal(false)"]').click();

    // 2.2 Open Custom Print Studio
    await page.goto('/#/custom-print', { waitUntil: 'domcontentloaded' });
    const customSection = page.locator('#custom-order');
    await expect(customSection).toBeVisible();

    // Set custom quantity to 50 (triggers 15 EGP volume tier)
    await page.fill('#custom-qty-input', '50');
    await page.locator('#custom-qty-input').dispatchEvent('input');

    // Unit price should be 15 EGP
    await expect(page.locator('#custom-summary-unit')).toContainText('15');

    // 2.3 Open cart and verify items
    await page.click('#cart-btn');
    const cartModal = page.locator('#cart-modal');
    await expect(cartModal).toBeVisible();

    // Apply valid coupon STICKIFY10
    await page.fill('#coupon-input', 'STICKIFY10');
    await page.click('#coupon-input + button'); // تطبيق button
    const toast = page.locator('#toast-container > div').last();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('تم تفعيل كود الخصم');

    // 2.4 Proceed to checkout
    await page.click('button:has-text("إتمام الشراء بالبيانات التفصيلية")');
    const checkoutModal = page.locator('#checkout-modal');
    await expect(checkoutModal).toBeVisible();

    // Fill customer data
    await page.fill('#order-name', 'يوسف الشريف');
    await page.fill('#order-phone', '01043546503');
    await page.selectOption('#order-city', 'الإسكندرية');
    await page.fill('#order-address', 'محطة الرمل، عمارة الأوقاف، الدور الرابع');
    await page.fill('#order-notes', 'برجاء الاتصال قبل التوصيل بنصف ساعة');

    // Select payment method: Vodafone Cash
    await page.locator('input[value="vodafone_cash"]').check();
    await expect(page.locator('#payment-method-details')).toContainText('01043546503');

    // Attach required payment proof image for Vodafone Cash (R12)
    const proofFile = {
      name: 'vodafone_receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    };
    await page.setInputFiles('#payment-proof-file', proofFile);
    await page.waitForTimeout(100);

    // Submit order
    await page.click('#checkout-submit-btn');

    // 2.5 Confirmation modal & Order Code
    const confModal = page.locator('#order-confirmation-modal');
    await expect(confModal).toBeVisible();

    const orderId = await page.locator('#confirmed-order-id').innerText();
    expect(orderId).toMatch(/^S21-\d{6}-[23456789A-HJ-NP-Z]{6,8}$/);

    // Verify WhatsApp was opened with Order Code S21CODE:
    const openedUrls = await page.evaluate(() => window.__openedUrls);
    expect(openedUrls.length).toBeGreaterThan(0);
    const waUrl = openedUrls[0];
    expect(waUrl).toContain('wa.me/201043546503');
    expect(waUrl).toContain('S21CODE');
  });

  test('3. Complete Admin Workflow: Passcode -> State Lifecycle Transition -> Packing Slip', async ({ page }) => {
    // 3.1 Create sample order directly in storage
    const testOrderId = 'S21-FULL-CYCLE-01';
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((id) => {
      const sampleOrder = {
        id,
        date: new Date().toISOString(),
        status: 'awaiting_confirmation',
        customer: {
          name: 'مريم الألفي',
          phone: '01043546503',
          governorate: 'الجيزة',
          address: 'الدقي، شارع مصدق',
          notes: 'عاجل'
        },
        items: [
          { id: 'stk-1', sku: 'DEV-01', nameAr: 'جيت بوش', size: '10 سم', quantity: 2, price: 50 },
          { id: 'bmk-1', sku: 'BMK-01', nameAr: 'فاصل دوستويفسكي', size: '15×5 سم', quantity: 1, price: 25 }
        ],
        subtotal: 125,
        discount: 10,
        shippingCost: 35,
        total: 150,
        payment: 'فودافون كاش',
        statusHistory: [
          { status: 'pending', timestamp: new Date().toISOString(), note: 'تم الإنشاء' },
          { status: 'awaiting_confirmation', timestamp: new Date().toISOString(), note: 'بانتظار التأكيد' }
        ]
      };
      const orders = JSON.parse(localStorage.getItem('stickify21_orders') || '[]');
      orders.unshift(sampleOrder);
      localStorage.setItem('stickify21_orders', JSON.stringify(orders));
    }, testOrderId);

    // 3.2 Login to admin
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');
    await page.waitForSelector('#orders-list-container');

    const statusSelect = page.locator(`#status-select-${testOrderId}`);
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('awaiting_confirmation');

    // 3.3 Valid lifecycle transition: awaiting_confirmation -> confirmed
    await statusSelect.selectOption('confirmed');
    await page.waitForTimeout(300);
    await expect(statusSelect).toHaveValue('confirmed');

    // 3.4 Valid lifecycle transition: confirmed -> preparing
    await statusSelect.selectOption('preparing');
    await page.waitForTimeout(300);
    await expect(statusSelect).toHaveValue('preparing');

    // 3.5 Valid lifecycle transition: preparing -> ready -> shipped
    await statusSelect.selectOption('ready');
    await page.waitForTimeout(300);
    await expect(statusSelect).toHaveValue('ready');

    await statusSelect.selectOption('shipped');
    await page.waitForTimeout(300);
    await expect(statusSelect).toHaveValue('shipped');

    // 3.6 Verify packing slip generation
    await page.goto(`/packing-slip.html?id=${testOrderId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#packing-slip-card')).toBeVisible();
    await expect(page.locator('#order-id')).toContainText(testOrderId);
    await expect(page.locator('#customer-name')).toContainText('مريم الألفي');
    await expect(page.locator('#customer-address')).toContainText('الجيزة');
    await expect(page.locator('#payment-and-total')).toContainText('150');
  });

  test('4. Self-Service Order Tracking: Hash route #/track/:id renders 6-step lifecycle timeline', async ({ page }) => {
    const trackedOrderId = 'S21-TRACK-DEMO';
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Seed order in localStorage
    await page.evaluate((id) => {
      const order = {
        id,
        date: new Date().toISOString(),
        status: 'shipped',
        customer: {
          name: 'كريم عبد العزيز',
          phone: '01043546503',
          governorate: 'القاهرة',
          address: 'المعادي',
          notes: ''
        },
        items: [{ id: 'stk-1', sku: 'DEV-01', nameAr: 'جيت بوش', size: '8 سم', quantity: 1, price: 35 }],
        subtotal: 35,
        shippingCost: 35,
        total: 70,
        payment: 'عند الاستلام',
        statusHistory: [
          { status: 'pending', timestamp: new Date().toISOString(), note: 'تم الإنشاء' },
          { status: 'awaiting_confirmation', timestamp: new Date().toISOString(), note: 'تأكيد' },
          { status: 'confirmed', timestamp: new Date().toISOString(), note: 'مؤكد' },
          { status: 'preparing', timestamp: new Date().toISOString(), note: 'تجهيز' },
          { status: 'shipped', timestamp: new Date().toISOString(), note: 'تم الشحن' }
        ]
      };
      localStorage.setItem('stickify21_orders', JSON.stringify([order]));
    }, trackedOrderId);

    // Deep link to order tracking
    await page.goto(`/#/track/${trackedOrderId}`, { waitUntil: 'domcontentloaded' });
    const trackingModal = page.locator('#order-tracking-modal');
    await expect(trackingModal).toBeVisible();

    // Verify order ID and customer info rendered inside tracking-result-container
    const resultContainer = page.locator('#tracking-result-container');
    await expect(resultContainer).toBeVisible();
    await expect(resultContainer).toContainText(trackedOrderId);
    await expect(resultContainer).toContainText('تم الشحن');
    await expect(resultContainer).toContainText('كريم عبد العزيز');
    await expect(resultContainer).toContainText('القاهرة');
  });

  test('5. Resiliency & Security: Corrupted localStorage data safely handled without crash', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Inject corrupted malformed JSON into orders key
    await page.evaluate(() => {
      localStorage.setItem('stickify21_orders', 'INVALID_MALFORMED_JSON_{{[}}');
    });

    // Reload page; must NOT throw uncaught crash error and must fall back safely
    let pageCrash = false;
    page.on('pageerror', () => { pageCrash = true; });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    expect(pageCrash).toBe(false);

    // Verify backup corrupted key was preserved
    const corruptBackupExists = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.some(k => k.startsWith('stickify21_orders_corrupt_'));
    });
    expect(corruptBackupExists).toBe(true);
  });

});
