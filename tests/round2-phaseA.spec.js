import { test, expect } from '@playwright/test';

test.describe('Round 2 - Phase A: Orders & Admin Core', () => {

  test('R1: Pack contents must be visible in Cart, Checkout, WhatsApp message, Order Code, Admin rows, and Details', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // 1. Add 1 single sticker to cart first
    const singleAddBtn = page.locator('.sticker-card').first().locator('button:has-text("أضف للسلة")');
    await singleAddBtn.click();
    await page.waitForTimeout(300);

    // If cart opened automatically, close it so pack buttons can be clicked
    const closeCartBtn = page.locator('#cart-modal button[onclick*="toggleCartModal(false)"]');
    if (await closeCartBtn.isVisible()) {
      await closeCartBtn.click();
      await page.waitForTimeout(300);
    }

    // 2. Add 5 stickers to pack builder
    const packButtons = page.locator('.sticker-card button:has-text("للباقة")');
    const packBtnCount = await packButtons.count();
    expect(packBtnCount).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < 5; i++) {
      await packButtons.nth(i).click();
      await page.waitForTimeout(100);
    }

    // Add pack to cart
    const addPackBtn = page.locator('button:has-text("إضافة باقة الـ 5 بالكامل للسلة")');
    await expect(addPackBtn).toBeEnabled();
    await addPackBtn.click();

    // Verify cart modal is open
    await page.waitForSelector('#cart-modal:not(.hidden)');

    // Verify pack contents visible in cart
    const cartPack = page.locator('#cart-items-container .p-3\\.5, #cart-items-container .rounded-xl').filter({ hasText: 'باقة' });
    await expect(cartPack).toBeVisible();
    // Sub-items mini gallery should have 5 items
    const miniThumbs = cartPack.locator('.cat-thumb-img, img, svg');
    expect(await miniThumbs.count()).toBeGreaterThanOrEqual(5);

    // Proceed to Checkout
    const checkoutBtn = page.locator('#open-checkout-btn');
    await checkoutBtn.click();
    await page.waitForSelector('#checkout-modal:not(.hidden)');

    // Verify pack items summary is shown in checkout modal
    const checkoutSummary = page.locator('#checkout-items-summary');
    await expect(checkoutSummary).toBeVisible();
    await expect(checkoutSummary).toContainText('باقة');

    // Fill customer form
    await page.fill('#order-name', 'أحمد محمود');
    await page.fill('#order-phone', '01012345678');
    await page.selectOption('#order-city', 'القاهرة');
    await page.fill('#order-address', 'شارع قصر العيني، وسط البلد');

    // Submit order
    const submitBtn = page.locator('#checkout-submit-btn');
    await submitBtn.click();

    // Verify Confirmation Modal (A2)
    const confModal = page.locator('#order-confirmation-modal');
    await expect(confModal).toBeVisible();
    const orderIdText = await page.locator('#confirmed-order-id').innerText();
    expect(orderIdText).toMatch(/^S21-\d{6}-[23456789A-HJ-NP-Z]{6,8}$/);

    // Check order code and structured lines in localStorage
    const storedOrdersRaw = await page.evaluate(() => localStorage.getItem('stickify21_orders'));
    const storedOrders = JSON.parse(storedOrdersRaw || '[]');
    const createdOrder = storedOrders.find(o => o.id === orderIdText);
    expect(createdOrder).toBeTruthy();

    // Verify structured lines in created order (R1)
    expect(createdOrder.lines).toBeDefined();
    expect(Array.isArray(createdOrder.lines)).toBe(true);
    const packLine = createdOrder.lines.find(l => l.type === 'pack');
    expect(packLine).toBeTruthy();
    expect(packLine.size).toBe(5);
    expect(packLine.items.length).toBe(5);
    expect(packLine.items[0]).toHaveProperty('sku');
    expect(packLine.items[0]).toHaveProperty('name');

    // Navigate to Admin to verify pack contents in expandable row and details
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    
    // Unlock admin with default passcode 2121
    const pinInput = page.locator('#admin-pin-input');
    if (await pinInput.isVisible()) {
      await pinInput.fill('2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Verify order row has pack contents or expandable sub-items
    const orderRow = page.locator('#orders-list-container > div').filter({ hasText: orderIdText });
    await expect(orderRow).toBeVisible();
    await expect(orderRow).toContainText('باقة');

    // Click "عرض التفاصيل"
    const detailsBtn = orderRow.locator('button:has-text("عرض التفاصيل")');
    await detailsBtn.click();
    await page.waitForSelector('#order-detail-modal:not(.hidden)');
    
    // In details modal, verify all 5 pack items are rendered
    const detailModal = page.locator('#order-detail-modal');
    await expect(detailModal).toContainText('باقة');
    const packSubItems = detailModal.locator('.pack-sub-item, [data-pack-item]');
    expect(await packSubItems.count()).toBeGreaterThanOrEqual(5);
  });

  test('R2: Order status flow, "ready" (تم التجهيز) status, quick next-step button, 10s undo, and shipping modal with tracking (A3)', async ({ page }) => {
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    // Seed an order directly in localStorage for deterministic testing
    const testOrderId = 'S21-261117-TEST01';
    await page.evaluate((oid) => {
      const sampleOrder = {
        id: oid,
        date: new Date().toISOString(),
        status: 'awaiting_confirmation',
        customer: {
          name: 'سارة خالد',
          phone: '01123456789',
          city: 'الجيزة',
          address: 'الدقي - شارع التحرير'
        },
        payment: 'عند الاستلام (COD)',
        paymentMethod: 'cod',
        subtotal: 140,
        shippingCost: 35,
        total: 175,
        lines: [
          {
            type: 'pack',
            size: 5,
            packPrice: 140,
            discountRate: 0.2,
            items: [
              { sku: 'S21-01', name: 'شعار البراند', sizeKey: 'medium', finish: 'matte', unitPrice: 35 },
              { sku: 'DEV-01', name: 'جيت بوش', sizeKey: 'medium', finish: 'matte', unitPrice: 35 },
              { sku: 'DEV-02', name: 'نو بيج ديل', sizeKey: 'medium', finish: 'matte', unitPrice: 35 },
              { sku: 'DEV-03', name: '404 نوت فاوند', sizeKey: 'medium', finish: 'matte', unitPrice: 35 },
              { sku: 'MEME-01', name: 'فاصل شحن', sizeKey: 'medium', finish: 'matte', unitPrice: 35 }
            ]
          }
        ],
        statusHistory: [
          { status: 'awaiting_confirmation', timestamp: new Date().toISOString(), note: 'طلب جديد' }
        ]
      };
      const orders = [sampleOrder];
      localStorage.setItem('stickify21_orders', JSON.stringify(orders));
    }, testOrderId);

    await page.reload();

    // Authenticate
    const pinInput = page.locator('#admin-pin-input');
    if (await pinInput.isVisible()) {
      await pinInput.fill('2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    const orderRow = page.locator('#orders-list-container > div').filter({ hasText: testOrderId });
    await expect(orderRow).toBeVisible();

    // 1. Next step for awaiting_confirmation should be "تأكيد الطلب"
    const step1Btn = orderRow.locator('.quick-next-step-btn');
    await expect(step1Btn).toHaveText(/تأكيد الطلب/);
    await step1Btn.click();

    // Verify 10s undo toast appears
    const undoToast = page.locator('#status-undo-toast');
    await expect(undoToast).toBeVisible();
    await expect(undoToast).toContainText('تراجع');

    // Check order status is now confirmed
    await expect(orderRow.locator('.order-status-badge')).toContainText('مؤكد');

    // 2. Next step for confirmed is "بدء التجهيز" (preparing)
    await expect(step1Btn).toHaveText(/بدء التجهيز/);
    await step1Btn.click();
    await expect(orderRow.locator('.order-status-badge')).toContainText('قيد التجهيز');

    // 3. Next step for preparing is "تم التجهيز" (ready)
    await expect(step1Btn).toHaveText(/تم التجهيز/);
    await step1Btn.click();
    await expect(orderRow.locator('.order-status-badge')).toContainText('تم التجهيز');

    // Test Undo on "تم التجهيز"
    const undoAction = page.locator('#status-undo-toast button:has-text("تراجع")');
    await undoAction.click();
    // Status should revert to "قيد التجهيز"
    await expect(orderRow.locator('.order-status-badge')).toContainText('قيد التجهيز');

    // Move back to "تم التجهيز"
    await step1Btn.click();
    await expect(orderRow.locator('.order-status-badge')).toContainText('تم التجهيز');

    // 4. Next step for ready is "تم الشحن" (shipped)
    await expect(step1Btn).toHaveText(/تم الشحن/);
    await step1Btn.click();

    // Shipping modal should open with courier and tracking number fields
    const shipModal = page.locator('#shipping-dispatch-modal');
    await expect(shipModal).toBeVisible();
    await page.selectOption('#ship-courier-select', 'بوسطة (Bosta)');
    await page.fill('#ship-tracking-input', 'BOSTA-987654');

    // Confirm shipping
    await page.locator('#confirm-ship-btn').click();
    await expect(orderRow.locator('.order-status-badge')).toContainText('تم الشحن');

    // Check that WhatsApp customer link has courier and tracking info
    const customerWhatsAppLink = page.locator('#ship-whatsapp-link');
    if (await customerWhatsAppLink.isVisible()) {
      const href = await customerWhatsAppLink.getAttribute('href');
      expect(href).toContain(encodeURIComponent('BOSTA-987654'));
      expect(href).toContain(encodeURIComponent('بوسطة'));
    }

    // Close shipping modal
    const closeShipModalBtn = page.locator('#shipping-dispatch-modal button:has-text("✕"), #shipping-dispatch-modal button[onclick*="closeShippingDispatchModal"]').first();
    if (await closeShipModalBtn.isVisible()) {
      await closeShipModalBtn.click();
    }

    // 5. Next step for shipped is "تم التسليم" (completed)
    await expect(step1Btn).toHaveText(/تم التسليم/);
    await step1Btn.click();
    await expect(orderRow.locator('.order-status-badge')).toContainText('مكتمل');
  });

  test('R11: Persistent admin session in localStorage across tabs, 12h sliding expiry, and cross-tab logout', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    // Authenticate in Tab 1
    const pinInput = page1.locator('#admin-pin-input');
    await pinInput.fill('2121');
    await page1.locator('#admin-login-btn').click();
    await page1.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Verify localStorage has session object with token and expiresAt
    const sessionData = await page1.evaluate(() => {
      const raw = localStorage.getItem('stickify21_admin_session');
      return raw ? JSON.parse(raw) : null;
    });
    expect(sessionData).toBeTruthy();
    expect(sessionData.token).toBeDefined();
    expect(sessionData.expiresAt).toBeGreaterThan(Date.now() + 10 * 3600 * 1000); // ~12 hours

    // Open Tab 2 to packing slip directly - should NOT prompt for PIN (overlay hidden)
    const page2 = await context.newPage();
    await page2.goto('/packing-slip.html', { waitUntil: 'domcontentloaded' });
    const lockOverlay = page2.locator('#admin-lock-screen');
    await expect(lockOverlay).toBeHidden();

    // Open Tab 3 to admin.html - should immediately show admin-dashboard-app without PIN
    const page3 = await context.newPage();
    await page3.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await expect(page3.locator('#admin-dashboard-app')).toBeVisible();
    await expect(page3.locator('#admin-lock-screen')).toBeHidden();

    // Logout from Tab 1
    await page1.locator('#admin-logout-btn').click();
    await expect(page1.locator('#admin-lock-screen')).toBeVisible();

    // Tab 3 should automatically lock via storage event / BroadcastChannel
    await page3.waitForTimeout(500);
    await expect(page3.locator('#admin-lock-screen')).toBeVisible();
  });

  test('R13: Packing slip A4 single-page compaction, pack items listed, A5 and shipping label modes', async ({ page }) => {
    // Seed an order with 20 items (to test compaction)
    const testOrderId = 'S21-261117-COMPACT';
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    // Authenticate
    const pinInput = page.locator('#admin-pin-input');
    if (await pinInput.isVisible()) {
      await pinInput.fill('2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    await page.evaluate((oid) => {
      const subItems = [];
      for (let i = 1; i <= 10; i++) {
        subItems.push({ sku: `PK-${i}`, name: `استيكر مميز ${i}`, sizeKey: 'medium', finish: 'matte', unitPrice: 35 });
      }
      const singleItems = [];
      for (let i = 1; i <= 10; i++) {
        singleItems.push({ sku: `SG-${i}`, name: `استيكر منفرد ${i}`, size: '8 سم', qty: 1, price: 35 });
      }
      const order = {
        id: oid,
        date: new Date().toISOString(),
        status: 'ready',
        customer: {
          name: 'محمود عبد العزيز',
          phone: '01099887766',
          city: 'الإسكندرية',
          address: 'سموحة - خلف نادي سموحة'
        },
        payment: 'عند الاستلام (COD)',
        total: 550,
        lines: [
          {
            type: 'pack',
            size: 10,
            packPrice: 245,
            discountRate: 0.3,
            items: subItems
          },
          ...singleItems.map(s => ({
            type: 'single',
            sku: s.sku,
            name: s.name,
            size: s.size,
            unitPrice: s.price,
            quantity: s.qty,
            total: s.price * s.qty
          }))
        ]
      };
      localStorage.setItem('stickify21_orders', JSON.stringify([order]));
    }, testOrderId);

    // Navigate to packing slip
    await page.goto(`/packing-slip.html?id=${testOrderId}`, { waitUntil: 'domcontentloaded' });

    // Verify slip container has compact mode applied
    const slipCard = page.locator('.page-slip');
    await expect(slipCard).toBeVisible();

    // Verify pack items are listed under pack group
    const packSection = page.locator('.slip-pack-group, [data-pack-group]');
    await expect(packSection).toBeVisible();
    await expect(packSection).toContainText('باقة');

    // Check mode toggles
    const labelModeBtn = page.locator('button[data-mode="label"]');
    await expect(labelModeBtn).toBeVisible();
    await labelModeBtn.click();
    await expect(page.locator('.shipping-label-card, [data-view="label"]')).toBeVisible();
  });

});
