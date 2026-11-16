import { test, expect } from '@playwright/test';

test.describe('Phase 3 Acceptance Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Clear storage for clean slate
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
  });

  test('1. Hash routing #/product/:id opens Product Detail Modal with size/finish selection and adds to cart', async ({ page }) => {
    // Navigate directly with hash
    await page.goto('/#/product/stk-1', { waitUntil: 'domcontentloaded' });

    const modal = page.locator('#product-detail-modal');
    await expect(modal).toBeVisible();

    // Verify product name displayed
    await expect(modal).toContainText('جيت بوش');

    // Default size is 8cm (medium) at 35 EGP
    const totalPriceEl = page.locator('#product-detail-total-price');
    await expect(totalPriceEl).toContainText('35');

    // Click 10cm size button (large)
    const largeBtn = modal.locator('button', { hasText: '10 سم' });
    await largeBtn.click();
    await expect(totalPriceEl).toContainText('50');

    // Increase quantity to 2
    const plusBtn = modal.locator('button', { hasText: '+' });
    await plusBtn.click();
    await expect(page.locator('#product-detail-qty-val')).toHaveText('2');
    await expect(totalPriceEl).toContainText('100');

    // Add to cart
    const addToCartBtn = modal.locator('button', { hasText: 'إضافة إلى سلة المشتريات' });
    await addToCartBtn.click();

    // Cart modal should open and contain item
    const cartModal = page.locator('#cart-modal');
    await expect(cartModal).toBeVisible();
    await expect(cartModal).toContainText('جيت بوش');
    await expect(cartModal).toContainText('100'); // 2 * 50

    // Product detail modal should now be closed
    await expect(modal).toBeHidden();
  });

  test('2. Live shipping calculation updates dynamically for 27 governorates in checkout', async ({ page }) => {
    // Add product to cart
    await page.click('button:has-text("أضف للسلة")');
    await page.click('#cart-btn');

    // Open checkout
    await page.click('#open-checkout-btn');
    const checkoutModal = page.locator('#checkout-modal');
    await expect(checkoutModal).toBeVisible();

    const citySelect = page.locator('#order-city');
    const preview = page.locator('#checkout-pricing-preview');

    // Select Alexandria (45 EGP shipping)
    await citySelect.selectOption('الإسكندرية');
    await expect(preview).toContainText('45');
    await expect(preview).toContainText('الإسكندرية');

    // Select Matrouh (75 EGP shipping)
    await citySelect.selectOption('مطروح');
    await expect(preview).toContainText('75');
    await expect(preview).toContainText('مطروح');

    // Select Cairo (35 EGP shipping)
    await citySelect.selectOption('القاهرة');
    await expect(preview).toContainText('35');
    await expect(preview).toContainText('القاهرة');
  });

  test('3. Payment method selection updates instructions with account/wallet details', async ({ page }) => {
    // Add product to cart and open checkout
    await page.click('button:has-text("أضف للسلة")');
    await page.click('#cart-btn');
    await page.click('#open-checkout-btn');

    const paymentDetails = page.locator('#payment-method-details');

    // Default is COD
    await expect(paymentDetails).toContainText('الدفع نقداً للمندوب');

    // Select InstaPay
    await page.locator('input[value="instapay"]').check();
    await expect(paymentDetails).toContainText('stickify21@instapay');

    // Select Vodafone Cash
    await page.locator('input[value="vodafone_cash"]').check();
    await expect(paymentDetails).toContainText('01043546503');
  });

  test('4. Mockup Studio supports neutral shapes including Car Window and switches cleanly', async ({ page }) => {
    // Check initial device (Laptop)
    const deviceWrapper = page.locator('#device-wrapper');
    await expect(deviceWrapper).toHaveClass(/mockup-laptop-realistic/);

    // Switch to Car Window
    const carWindowBtn = page.locator('button[data-device="car_window"]');
    await carWindowBtn.click();
    await expect(deviceWrapper).toHaveClass(/mockup-car-window-realistic/);

    // Switch to Phone
    const phoneBtn = page.locator('button[data-device="phone"]');
    await phoneBtn.click();
    await expect(deviceWrapper).toHaveClass(/mockup-phone-realistic/);

    // Switch to Tumbler / Bottle
    const bottleBtn = page.locator('button[data-device="bottle"]');
    await bottleBtn.click();
    await expect(deviceWrapper).toHaveClass(/mockup-bottle-realistic/);
  });

  test('5. Custom Print Studio applies tiered volume discounts (10-49: 20 EGP, 50-99: 15 EGP, 100+: 10 EGP)', async ({ page }) => {
    // Scroll to custom print
    await page.goto('/#custom-order', { waitUntil: 'domcontentloaded' });

    const qtyInput = page.locator('#custom-qty-input');
    const unitEl = page.locator('#custom-summary-unit');
    const totalEl = page.locator('#custom-summary-total');
    const tierBadge = page.locator('#custom-qty-tier-badge');

    // Default 10 pcs: 20 EGP/unit, 200 EGP total
    await expect(qtyInput).toHaveValue('10');
    await expect(unitEl).toHaveText('20 ج.م');
    await expect(totalEl).toHaveText('200');

    // Change to 50 pcs: 15 EGP/unit, 750 EGP total
    await qtyInput.fill('50');
    await qtyInput.dispatchEvent('input');
    await expect(unitEl).toHaveText('15 ج.م');
    await expect(totalEl).toHaveText('750');
    await expect(tierBadge).toContainText('50–99');

    // Change to 100 pcs: 10 EGP/unit, 1000 EGP total
    await qtyInput.fill('100');
    await qtyInput.dispatchEvent('input');
    await expect(unitEl).toHaveText('10 ج.م');
    await expect(totalEl).toHaveText('1000');
    await expect(tierBadge).toContainText('100+');
  });

  test('6. Order tracking view #/track allows searching by order ID and shows progress timeline', async ({ page }) => {
    // First, place an order through checkout to have one in storage
    await page.click('button:has-text("أضف للسلة")');
    await page.click('#cart-btn');
    await page.click('#open-checkout-btn');

    await page.fill('#order-name', 'مروان الشافعي');
    await page.fill('#order-phone', '01012345678');
    await page.selectOption('#order-city', 'القاهرة');
    await page.fill('#order-address', 'شارع التحرير، الدقي، عمارة 15');

    // Catch WhatsApp popup
    const popupPromise = page.waitForEvent('popup');
    await page.click('#checkout-submit-btn');
    const popup = await popupPromise;
    await popup.close();

    const orderId = (await page.locator('#confirmed-order-id').innerText()).trim();
    expect(orderId).toMatch(/^S21-\d{6}-[A-Z0-9]{4}$/);

    // Close confirmation modal
    await page.click('button:has-text("إغلاق ومتابعة التسوق")');

    // Navigate to #/track
    await page.goto(`/#/track/${orderId}`, { waitUntil: 'domcontentloaded' });

    const trackModal = page.locator('#order-tracking-modal');
    await expect(trackModal).toBeVisible();

    const resultContainer = page.locator('#tracking-result-container');
    await expect(resultContainer).toContainText(orderId);
    await expect(resultContainer).toContainText('مروان الشافعي');
    await expect(resultContainer).toContainText('بانتظار التأكيد');
  });

});
