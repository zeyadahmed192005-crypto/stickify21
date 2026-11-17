import { test, expect } from '@playwright/test';

test.describe('Phase 2 Acceptance Tests', () => {

  test('1. Invalid coupon rejected with Arabic reason', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Add a sticker to cart
    const addBtn = page.locator('.sticker-card button:has-text("أضف للسلة")').first();
    await addBtn.click();

    // Open cart modal
    await page.click('#cart-btn');
    await page.waitForSelector('#cart-modal:not(.hidden)');

    // 1a. Try entering a non-existent coupon code
    await page.fill('#coupon-input', 'INVALID_CODE_999');
    await page.click('button:has-text("تطبيق")');

    // Toast with Arabic rejection message appears
    const toast = page.locator('#toast-container > div').last();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('كود الخصم غير صحيح');

    // 1b. Test with an expired coupon in storage
    await page.evaluate(() => {
      const expiredCoupon = {
        code: 'EXPIRED50',
        type: 'percentage',
        discountPercent: 50,
        expiryDate: '2020-01-01',
        active: true,
        desc: 'Expired 50%'
      };
      const existing = JSON.parse(localStorage.getItem('stickify21_coupons') || '[]');
      existing.push(expiredCoupon);
      localStorage.setItem('stickify21_coupons', JSON.stringify(existing));
    });

    await page.fill('#coupon-input', 'EXPIRED50');
    await page.click('button:has-text("تطبيق")');
    const toast2 = page.locator('#toast-container > div').last();
    await expect(toast2).toBeVisible();
    await expect(toast2).toContainText('منتهي الصلاحية');
  });

  test('2. Checkout without phone/governorate blocked with inline error', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Add item to cart
    await page.locator('.sticker-card button:has-text("أضف للسلة")').first().click();

    // Open cart and proceed to checkout
    await page.click('#cart-btn');
    await page.waitForSelector('#cart-modal:not(.hidden)');
    await page.click('button:has-text("إتمام الشراء بالبيانات التفصيلية")');

    await page.waitForSelector('#checkout-modal:not(.hidden)');

    // Fill name only, leave phone, governorate, and address blank
    await page.fill('#order-name', 'أحمد زكي');
    await page.fill('#order-phone', '');
    await page.selectOption('#order-city', '');

    // Submit form
    await page.click('#checkout-submit-btn');

    // Inline errors must be visible and modal should NOT close
    const phoneError = page.locator('#order-phone-error');
    await expect(phoneError).toBeVisible();
    await expect(phoneError).toContainText('رقم الهاتف');

    const cityError = page.locator('#order-city-error');
    await expect(cityError).toBeVisible();
    await expect(cityError).toContainText('المحافظة');

    // Checkout modal is still open
    await expect(page.locator('#checkout-modal')).toBeVisible();
    // Order confirmation modal must NOT be open
    await expect(page.locator('#order-confirmation-modal')).toBeHidden();
  });

  test('3. Valid checkout creates order, shows confirmation modal, opens WhatsApp with Order Code, exports to admin via copy-paste', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Intercept window.open to inspect WhatsApp URL and message payload
    await page.evaluate(() => {
      window.__openedUrls = [];
      window.open = function(url) {
        window.__openedUrls.push(url);
        return { focus: () => {} };
      };
    });

    // Add sticker to cart
    await page.locator('.sticker-card button:has-text("أضف للسلة")').first().click();

    // Open checkout modal
    await page.click('#cart-btn');
    await page.waitForSelector('#cart-modal:not(.hidden)');
    await page.click('button:has-text("إتمام الشراء بالبيانات التفصيلية")');
    await page.waitForSelector('#checkout-modal:not(.hidden)');

    // Fill valid data
    await page.fill('#order-name', 'سارة محمود');
    await page.fill('#order-phone', '01043546503');
    await page.selectOption('#order-city', 'الإسكندرية');
    await page.fill('#order-address', 'شارع فؤاد، لوران، عمارة 15');
    await page.fill('#order-notes', 'تسليم بعد الساعة 5 مساء');

    // Submit order
    await page.click('#checkout-submit-btn');

    // Confirmation modal appears
    const confModal = page.locator('#order-confirmation-modal');
    await expect(confModal).toBeVisible();

    const orderIdEl = page.locator('#confirmed-order-id');
    const orderIdText = await orderIdEl.innerText();
    // ID must match non-guessable format: S21-YYMMDD-XXXX
    expect(orderIdText).toMatch(/^S21-\d{6}-[23456789A-HJ-NP-Z]{6,8}$/);

    // Verify WhatsApp URL was opened with Order Code (S21CODE:)
    const openedUrls = await page.evaluate(() => window.__openedUrls);
    expect(openedUrls.length).toBeGreaterThan(0);
    const waUrl = openedUrls[0];
    expect(waUrl).toContain('wa.me/201043546503');
    expect(waUrl).toContain('S21CODE');

    // Extract the raw WhatsApp message containing S21CODE:
    const urlObj = new URL(waUrl);
    const decodedMessage = urlObj.searchParams.get('text');
    expect(decodedMessage).toContain('S21CODE:');

    // 3b. Test Admin WhatsApp Import via copy-paste bridge
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Click "استيراد طلب من واتساب"
    await page.click('#btn-open-whatsapp-import');
    await page.waitForSelector('#whatsapp-import-modal:not(.hidden)');

    // Paste the WhatsApp message containing S21CODE:
    await page.fill('#whatsapp-import-input', decodedMessage);
    await page.click('#whatsapp-import-submit-btn');

    // Verify order was imported into Admin orders list
    await page.waitForSelector('#orders-list-container');
    const ordersHtml = await page.innerHTML('#orders-list-container');
    expect(ordersHtml).toContain(orderIdText);
    expect(ordersHtml).toContain('سارة محمود');
    expect(ordersHtml).toContain('الإسكندرية');
    expect(ordersHtml).toContain('WHATSAPP CODE');
  });

  test('4. Status transition pending -> shipped directly is rejected', async ({ page }) => {
    // Seed an order with status 'pending' (جديد)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const order = {
        id: 'S21-TRANS-TEST',
        date: new Date().toISOString(),
        status: 'pending',
        customer: {
          name: 'اختبار انتقال الحالة',
          phone: '01012345678',
          governorate: 'القاهرة',
          address: 'شارع التحرير',
          notes: ''
        },
        items: [{ id: 'stk-1', sku: 'DEV-01', nameAr: 'جيت بوش', size: '8 سم', quantity: 1, price: 35 }],
        subtotal: 35,
        shippingCost: 35,
        total: 70,
        payment: 'عند الاستلام',
        statusHistory: [{ status: 'pending', timestamp: new Date().toISOString(), note: 'بداية' }]
      };
      localStorage.setItem('stickify21_orders', JSON.stringify([order]));
    });

    // Login to Admin
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#orders-list-container');

    // Find the status dropdown for this order
    const statusSelect = page.locator('#status-select-S21-TRANS-TEST');
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('pending');

    // Attempt illegal transition directly from pending -> shipped
    await statusSelect.selectOption('shipped');

    // Toast error must appear rejecting illegal transition
    const toast = page.locator('#toast-container > div').last();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('لا يمكن تغيير حالة الطلب');

    // Dropdown value must be reset to pending
    await expect(statusSelect).toHaveValue('pending');
  });

  test('5. 5 wrong admin pins locks out', async ({ page }) => {
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#admin-lock-screen');

    // Clear rate limit for clean test state
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem('stickify21_admin_rate_limit');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    const pinInput = page.locator('#admin-pin-input');
    const loginBtn = page.locator('#admin-login-btn');

    // Submit 5 incorrect PINs
    for (let i = 1; i <= 5; i++) {
      await pinInput.fill(`000${i}`);
      await loginBtn.click();
      await page.waitForTimeout(100);
    }

    // After 5 attempts, lockout warning message must be visible and inputs disabled
    const warning = page.locator('#lockout-warning-message');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('تم قفل الدخول مؤقتاً');
    await expect(pinInput).toBeDisabled();
    await expect(loginBtn).toBeDisabled();
  });

});
