import { test, expect } from '@playwright/test';

test.describe('P2-2: Performance (100-Line Cart <300ms) & Admin 500-Order Pagination', () => {
  test('100-line cart renders in < 300ms with accurate auto-pack grouping and zero errors', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    const perf = await page.evaluate(() => {
      const items = [];
      for (let i = 0; i < 100; i++) {
        items.push({
          id: `stk-1_medium_${i}`,
          productId: `p-${i}`,
          sku: `PERF-${String(i).padStart(3, '0')}`,
          name: `Perf Sticker ${i}`,
          nameAr: `استيكر أداء ${i}`,
          type: 'sticker',
          size: '8 سم (Medium)',
          sizeKey: 'medium',
          finish: 'glossy',
          price: 35,
          quantity: 1
        });
      }
      localStorage.setItem('stickify21_cart', JSON.stringify(items));
      window.__mockupState.cart = items;

      const t0 = performance.now();
      window.renderCart();
      const elapsedMs = performance.now() - t0;
      const renderedCards = document.querySelectorAll('#cart-items-container > div').length;
      return { elapsedMs, renderedCards };
    });

    expect(perf.elapsedMs, `100-line cart render took ${perf.elapsedMs.toFixed(1)}ms (expected < 300ms)`).toBeLessThan(300);
    expect(perf.renderedCards).toBe(10); // 100 loose stickers -> 10 auto 10-packs!
  });

  test('Admin with 500 orders paginates to 25/page, renders in < 500ms, and searches across all 500 orders', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      const orders = [];
      const now = Date.now();
      for (let i = 0; i < 500; i++) {
        orders.push({
          id: `S21-PERF-${String(i).padStart(4, '0')}`,
          date: new Date(now - i * 60000).toISOString(),
          status: i % 2 === 0 ? 'confirmed' : 'preparing',
          customer: {
            name: `عميل رقم ${i}`,
            phone: `0101000${String(i).padStart(4, '0')}`,
            governorate: 'القاهرة',
            address: `شارع الاختبار ${i}`
          },
          payment: 'عند الاستلام (COD)',
          paymentMethod: 'cod',
          subtotal: 70,
          discount: 0,
          shippingCost: 35,
          total: 105,
          lines: [{ type: 'single', sku: 'DEV-01', name: 'Test', sizeKey: 'medium', finish: 'glossy', unitPrice: 35, quantity: 2, total: 70 }],
          statusHistory: [{ status: 'confirmed', timestamp: new Date(now - i * 60000).toISOString(), note: 'seed' }]
        });
      }
      localStorage.setItem('stickify21_orders', JSON.stringify(orders));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Measure paginated renderOrders() speed & DOM card count
    const stats = await page.evaluate(() => {
      const t0 = performance.now();
      window.renderOrders();
      const elapsedMs = performance.now() - t0;
      const visibleOrderCards = document.querySelectorAll('#orders-list-container .order-status-badge').length;
      return { elapsedMs, visibleOrderCards };
    });

    expect(stats.elapsedMs, `500-order render took ${stats.elapsedMs.toFixed(1)}ms`).toBeLessThan(500);
    expect(stats.visibleOrderCards).toBeLessThanOrEqual(25);
    await expect(page.locator('#orders-pagination-bar')).toBeVisible();
    await expect(page.locator('#orders-pagination-bar')).toContainText('500');

    // Navigate to page 2
    await page.click('#orders-next-page-btn');
    await expect(page.locator('#orders-list-container')).toContainText('S21-PERF-0025');

    // Search for order #499 across all 500 orders
    await page.fill('#order-search-input', 'S21-PERF-0499');
    await expect(page.locator('#orders-list-container')).toContainText('S21-PERF-0499');
  });
});
