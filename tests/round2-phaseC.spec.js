import { test, expect } from '@playwright/test';

test.describe('Round 2 - Phase C: Language & Clean UI (R4, R9, A11)', () => {
  // Regex to detect standard unicode emojis and pictographs
  const EMOJI_REGEX = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  test('R4: Bilingual Storefront Switch (AR/EN), RTL/LTR mirroring, i18n layer, and English checkout', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // 1. Check initial Arabic state
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    // 2. Language toggle in navbar
    const langToggle = page.locator('#lang-toggle-btn, [data-action="toggle-lang"]');
    await expect(langToggle).toBeVisible();

    // Switch to English
    await langToggle.click();
    await page.waitForTimeout(200);

    // Verify HTML attributes updated
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    // Verify localStorage persistence
    const savedLang = await page.evaluate(() => localStorage.getItem('stickify21_lang'));
    expect(savedLang).toBe('en');

    // Verify English UI texts rendered (no untranslated placeholders like 't(' or 'undefined')
    const brandTagline = page.locator('#header-tagline, .brand-slogan');
    if (await brandTagline.isVisible()) {
      await expect(brandTagline).not.toContainText('undefined');
    }

    // Verify currency renders EGP in English
    const firstPrice = page.locator('.sticker-card .price-tag, .sticker-card').first();
    await expect(firstPrice).toContainText(/EGP/i);
    await expect(firstPrice).not.toContainText('ج.م');

    // Check no horizontal overflow at mobile (375px), tablet (768px), desktop (1280px)
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(100);
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      });
      expect(isOverflowing).toBeFalsy();
    }

    // 3. Complete checkout in English
    await page.setViewportSize({ width: 1280, height: 800 });
    const addBtn = page.locator('.sticker-card button').filter({ hasText: /Add to Cart|Add/i }).first();
    await addBtn.click();

    await page.click('#cart-btn');
    await page.waitForSelector('#cart-modal:not(.hidden)');

    // Cart modal should show English headings and totals
    await expect(page.locator('#cart-modal')).toContainText(/Cart|Subtotal|Total/i);

    // Open checkout modal
    const checkoutBtn = page.locator('#open-checkout-btn, button:has-text("Checkout")');
    await checkoutBtn.click();
    await page.waitForSelector('#checkout-modal:not(.hidden)');

    // Fill customer form in English mode
    await page.fill('#order-name', 'John Doe');
    await page.fill('#order-phone', '01012345678');
    await page.selectOption('#order-city', 'القاهرة');
    await page.fill('#order-address', '15 Garden City St, Flat 4');

    // Select COD payment method
    await page.click('input[value="cod"], #pay-cod');

    // Submit order
    const submitBtn = page.locator('#checkout-submit-btn');
    await submitBtn.click();

    // Verify confirmation modal opens in English
    await page.waitForSelector('#order-confirmation-modal:not(.hidden)');
    await expect(page.locator('#order-confirmation-modal')).toContainText(/Order Confirmed|Thank You|Order Number/i);

    // Check WhatsApp message generated
    const openedUrls = await page.evaluate(() => window.__openedUrls || []);
    expect(openedUrls.length).toBeGreaterThan(0);
    const waUrl = openedUrls[0];
    const decodedWa = decodeURIComponent(waUrl);

    // Message to owner must still be Arabic for the owner to process, but must include customer language: EN
    expect(decodedWa).toMatch(/لغة العميل:\*?\s*EN|Customer Language:?\s*EN|Language:?\s*EN/i);
  });

  test('R9: Total Emoji & Decorative Purge, Clean SVG Outline Icons, and stripEmoji Utility', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // 1. Verify stripEmoji utility is globally exposed and works
    const testStripped = await page.evaluate(() => {
      if (typeof window.stripEmoji === 'function') {
        return window.stripEmoji('استيكر تجريبي 🔥 🚀 🍊 ✨ test 123');
      }
      return null;
    });
    expect(testStripped).toBe('استيكر تجريبي test 123');

    // 2. Scan rendered Storefront DOM for visible Unicode emojis
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasStoreEmoji = EMOJI_REGEX.test(bodyText);
    expect(hasStoreEmoji).toBeFalsy();

    // 3. Category cards must use clean outline SVGs instead of raw emoji icons
    const catIcons = await page.locator('#categories-section .category-card, #categories-pills button').allInnerTexts();
    for (const text of catIcons) {
      expect(EMOJI_REGEX.test(text)).toBeFalsy();
    }

    // 4. Admin page must be free of emojis
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    const adminPin = page.locator('#admin-pin-input');
    if (await adminPin.isVisible()) {
      await adminPin.fill('2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    const adminBodyText = await page.evaluate(() => document.body.innerText);
    const hasAdminEmoji = EMOJI_REGEX.test(adminBodyText);
    expect(hasAdminEmoji).toBeFalsy();
  });

  test('A11: Bilingual Policies / FAQ Editable in Admin Settings and Storefront Display', async ({ page }) => {
    // 1. Visit admin settings
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    const adminPin = page.locator('#admin-pin-input');
    if (await adminPin.isVisible()) {
      await adminPin.fill('2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Go to Settings tab
    await page.click('#tab-btn-settings');
    await page.waitForSelector('#tab-settings:not(.hidden)');

    // Check policies / FAQ manager exists
    const policiesManager = page.locator('#policies-faq-manager');
    await expect(policiesManager).toBeVisible();

    // Edit an English policy snippet
    const enShippingInput = page.locator('#policy-edit-shipping-en');
    await expect(enShippingInput).toBeVisible();
    await enShippingInput.fill('Express courier delivery across all 27 governorates in 48-72 hours.');

    // Save policy settings
    await page.click('#save-policies-btn');
    await page.waitForTimeout(300);

    // 2. Go to storefront in English mode and open policy modal
    await page.goto('/?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Open policy modal via footer or hash
    await page.evaluate(() => {
      if (typeof window.openPolicyModal === 'function') {
        window.openPolicyModal('shipping');
      }
    });

    const policyModal = page.locator('#policy-modal');
    await expect(policyModal).toBeVisible();
    await expect(policyModal).toContainText('Express courier delivery across all 27 governorates in 48-72 hours.');
  });
});
