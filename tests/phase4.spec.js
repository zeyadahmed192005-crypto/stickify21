// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Helper to log in to Admin dashboard reliably
async function loginAdmin(page) {
  await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
  const pinInput = page.locator('#admin-pin-input');
  if (await pinInput.isVisible()) {
    await pinInput.fill('2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');
  }
}

test.describe('Phase 4 Acceptance Tests - Admin Dashboard, Catalog CRUD, CSV & Settings', () => {

  test('1. Full Order Lifecycle: awaiting_confirmation -> confirmed -> preparing -> shipped -> completed', async ({ page }) => {
    // Seed a fresh test order in awaiting_confirmation state
    const testOrderId = 'S21-P4-TEST-01';
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((orderId) => {
      const orders = JSON.parse(localStorage.getItem('stickify21_orders') || '[]');
      const newOrder = {
        id: orderId,
        date: new Date().toISOString(),
        status: 'awaiting_confirmation',
        customer: {
          name: 'أحمد محمود',
          phone: '01012345678',
          governorate: 'القاهرة',
          address: 'المعادي - شارع 9'
        },
        items: [
          { sku: 'DEV-01', nameAr: 'جيت بوش بالقوة 🚀', size: '8 سم', qty: 2, price: 35 }
        ],
        subtotal: 70,
        shipping: 35,
        total: 105,
        payment: 'عند الاستلام',
        statusHistory: [
          { status: 'awaiting_confirmation', timestamp: Date.now(), note: 'طلب جديد بانتظار التأكيد' }
        ]
      };
      localStorage.setItem('stickify21_orders', JSON.stringify([newOrder, ...orders.filter(o => o.id !== orderId)]));
    }, testOrderId);

    await loginAdmin(page);

    // Verify order is rendered
    const statusSelect = page.locator(`#status-select-${testOrderId}`);
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('awaiting_confirmation');

    // 1. awaiting_confirmation -> confirmed
    await statusSelect.selectOption('confirmed');
    await expect(statusSelect).toHaveValue('confirmed');

    // 2. confirmed -> preparing
    await statusSelect.selectOption('preparing');
    await expect(statusSelect).toHaveValue('preparing');

    // 3. preparing -> ready -> shipped
    await statusSelect.selectOption('ready');
    await expect(statusSelect).toHaveValue('ready');
    await statusSelect.selectOption('shipped');
    await expect(statusSelect).toHaveValue('shipped');

    // 4. shipped -> completed
    await statusSelect.selectOption('completed');
    await expect(statusSelect).toHaveValue('completed');

    // Verify status persisted in localStorage
    const savedStatus = await page.evaluate((id) => {
      const stored = JSON.parse(localStorage.getItem('stickify21_orders') || '[]');
      const found = stored.find(o => o.id === id);
      return found ? found.status : null;
    }, testOrderId);
    expect(savedStatus).toBe('completed');
  });

  test('2. Packing slip prints correct order data and supports batch slips', async ({ page }) => {
    const testOrderId1 = 'S21-P4-SLIP-01';
    const testOrderId2 = 'S21-P4-SLIP-02';

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ id1, id2 }) => {
      const stored = JSON.parse(localStorage.getItem('stickify21_orders') || '[]');
      const order1 = {
        id: id1,
        date: '2026-11-16',
        status: 'confirmed',
        customer: {
          name: 'سارة خالد المنصورة',
          phone: '01198765432',
          city: 'الدقهلية',
          governorate: 'الدقهلية',
          address: 'حي الجامعة بجوار كلية الهندسة',
          notes: 'يرجى الاتصال قبل الوصول بنصف ساعة'
        },
        items: [
          { sku: 'DEV-01', nameAr: 'جيت بوش بالقوة 🚀', size: '8 سم', qty: 3, price: 35 },
          { sku: 'BM-01', nameAr: 'فاصل كتب: خير جليس 📖', size: 'بوك مارك', qty: 1, price: 25 }
        ],
        subtotal: 130,
        shipping: 50,
        total: 180,
        payment: 'عند الاستلام'
      };
      const order2 = {
        id: id2,
        date: '2026-11-16',
        status: 'shipped',
        customer: {
          name: 'محمود عبد الرازق',
          phone: '01234567890',
          city: 'الإسكندرية',
          governorate: 'الإسكندرية',
          address: 'سموحة - ش فوزي معاذ'
        },
        items: [
          { sku: 'DEV-01', nameAr: 'جيت بوش بالقوة 🚀', size: '8 سم', qty: 1, price: 35 }
        ],
        subtotal: 35,
        shipping: 45,
        total: 80,
        payment: 'عند الاستلام'
      };
      localStorage.setItem('stickify21_orders', JSON.stringify([order1, order2, ...stored.filter(o => o.id !== id1 && o.id !== id2)]));
    }, { id1: testOrderId1, id2: testOrderId2 });

    // Open single packing slip
    await page.goto(`/packing-slip.html?id=${testOrderId1}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#order-id')).toContainText(testOrderId1);
    await expect(page.locator('#customer-name')).toContainText('سارة خالد');
    await expect(page.locator('#customer-phone-link')).toContainText('01198765432');
    await expect(page.locator('#customer-address')).toContainText('الدقهلية');
    await expect(page.locator('#customer-notes')).toContainText('يرجى الاتصال قبل الوصول');
    await expect(page.locator('#items-grid .item-card')).toHaveCount(2);

    // Test batch slips view (?ids=...)
    await page.goto(`/packing-slip.html?ids=${testOrderId1},${testOrderId2}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.packing-slip-sheet')).toHaveCount(2);
  });

  test('3. Export CSV produces valid UTF-8 BOM file with Arabic headers and data', async ({ page }) => {
    // Seed an order first so admin has data to export
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const orders = [
        {
          id: 'S21-P4-CSV-01',
          date: '2026-11-16',
          status: 'confirmed',
          customer: {
            name: 'كريم الأحمدي',
            phone: '01099887766',
            governorate: 'الجيزة',
            address: 'الدقي - شارع مصدق',
            notes: 'تسليم في العمل'
          },
          items: [
            { sku: 'DEV-01', nameAr: 'جيت بوش بالقوة 🚀', size: '8 سم', qty: 2, price: 35 }
          ],
          subtotal: 70,
          shipping: 35,
          total: 105,
          payment: 'عند الاستلام',
          couponCode: 'STICKIFY10'
        }
      ];
      localStorage.setItem('stickify21_orders', JSON.stringify(orders));
    });

    await loginAdmin(page);

    // Click "تصدير الكل CSV"
    await page.locator('button:has-text("تصدير الكل CSV")').click();

    // Verify CSV content generated in window
    const csvText = await page.evaluate(() => window.__lastExportedCsv);
    expect(csvText).toBeDefined();

    // Verify UTF-8 BOM character (0xFEFF) at index 0
    expect(csvText.charCodeAt(0)).toBe(0xFEFF);

    // Verify Arabic headers
    expect(csvText).toContain('رقم الطلب');
    expect(csvText).toContain('اسم العميل');
    expect(csvText).toContain('المحافظة');
    expect(csvText).toContain('إجمالي الطلب (ج.م)');

    // Verify order customer data
    expect(csvText).toContain('كريم الأحمدي');
    expect(csvText).toContain('الجيزة');
    expect(csvText).toContain('S21-P4-CSV-01');
  });

  test('4. Catalog CRUD: Add new product with auto-SKU and verify appearance in storefront', async ({ page }) => {
    await loginAdmin(page);

    // Switch to Products Tab
    await page.locator('#tab-btn-products').click();
    await expect(page.locator('#tab-products')).toBeVisible();

    // Open Add Product Modal
    await page.locator('button:has-text("+ إضافة منتج جديد")').click();
    await expect(page.locator('#product-modal')).toBeVisible();

    // Auto-generate SKU
    await page.locator('#prod-category').selectOption('tech');
    await page.locator('button:has-text("توليد")').click();
    const generatedSku = await page.locator('#prod-sku').inputValue();
    expect(generatedSku).toMatch(/^DEV-\d{2}$/);

    const testProductNameAr = 'استيكر مهندس برمجيات محترف';
    await page.locator('#prod-name-ar').fill(testProductNameAr);
    await page.locator('#prod-price').fill('45');
    await page.locator('#prod-badge').fill('جديد كلياً');

    // Submit product
    await page.locator('#prod-submit-btn').click();
    await expect(page.locator('#product-modal')).toBeHidden();

    // Navigate to Storefront and verify product is displayed
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.sticker-card', { hasText: testProductNameAr })).toBeVisible();
    await expect(page.locator('.sticker-card', { hasText: testProductNameAr })).toContainText('45 ج.م');
  });

  test('5. Settings: Change governorate shipping rate and verify dynamic checkout recalculation', async ({ page }) => {
    // 1. Go to Admin Settings Tab
    await loginAdmin(page);
    await page.locator('#tab-btn-settings').click();
    await expect(page.locator('#tab-settings')).toBeVisible();

    // Find Alexandria rate input in the 27-governorate grid
    const alexRateInput = page.locator('#gov-rates-grid input[data-gov-name="الإسكندرية"]');
    await expect(alexRateInput).toBeVisible();
    
    // Change rate to 65 EGP
    await alexRateInput.fill('65');
    await page.locator('button:has-text("حفظ أسعار الشحن")').click();

    // 2. Open Storefront and add 1 item to cart
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('.sticker-card button:has-text("أضف للسلة")').first().click();

    // Open cart modal
    await page.locator('#cart-btn').click();
    await expect(page.locator('#cart-modal')).toBeVisible();

    // Click checkout button
    await page.locator('#open-checkout-btn').click();
    await expect(page.locator('#checkout-modal')).toBeVisible();

    // Select Alexandria
    await page.locator('#order-city').selectOption('الإسكندرية');

    // Verify shipping cost shows 65 EGP in the pricing preview
    const preview = page.locator('#checkout-pricing-preview');
    await expect(preview).toContainText('65');
    await expect(preview).toContainText('الإسكندرية');
  });

  test('6. Coupons Management: Create new coupon and verify in active list', async ({ page }) => {
    await loginAdmin(page);
    await page.locator('#tab-btn-coupons').click();
    await expect(page.locator('#tab-coupons')).toBeVisible();

    const uniqueCode = 'PHASE4TEST' + Math.floor(10 + Math.random() * 90);
    await page.locator('#coupon-code-input').fill(uniqueCode);
    await page.locator('#coupon-percent-input').fill('25');
    await page.locator('#tab-coupons button[type="submit"]').click();

    // Verify newly created coupon appears in list
    await expect(page.locator('#coupons-list-container', { hasText: uniqueCode })).toBeVisible();
    await expect(page.locator('#coupons-list-container', { hasText: uniqueCode })).toContainText('25%');
  });

});
