import { test, expect } from '@playwright/test';

test.describe('Round 2 - Phase E: Recommendations, Hardening & Power Tools', () => {

  test('A1: Admin Backup Reminder banner, one-click backup download, and weekly toggle', async ({ page }) => {
    // 1. Open admin and log in
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    if (await page.locator('#admin-lock-screen').isVisible()) {
      await page.fill('#admin-pin-input', '2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Simulate stale backup date (5 days ago)
    await page.evaluate(() => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      localStorage.setItem('stickify21_last_backup_date', fiveDaysAgo);
    });
    await page.reload();
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Backup reminder banner must be visible
    const reminderBanner = page.locator('#backup-reminder-banner');
    await expect(reminderBanner).toBeVisible();
    await expect(reminderBanner).toContainText(/نسخة احتياطية/);

    // Capture the anchor download payload cleanly (avoids msedge headless CRPage.didClose unhandled rejection on blob teardown)
    await page.evaluate(() => {
      window.__capturedBackup = null;
      document.addEventListener('click', async (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
        if (a && a.download) {
          e.preventDefault();
          const resp = await fetch(a.href);
          const text = await resp.text();
          window.__capturedBackup = { filename: a.download, size: text.length, json: JSON.parse(text) };
        }
      }, true);
    });

    // Click "تنزيل نسخة احتياطية الآن" one-click button
    await page.locator('#download-backup-now-btn').click();

    // Verify backup download was triggered with valid filename and JSON payload
    await page.waitForFunction(() => window.__capturedBackup !== null);
    const captured = await page.evaluate(() => window.__capturedBackup);
    expect(captured.filename).toMatch(/stickify21.*\.json$/i);
    expect(captured.size).toBeGreaterThan(100);
    expect(captured.json).toHaveProperty('products');

    // Banner should disappear after backup
    await expect(reminderBanner).toBeHidden();

    // Verify last backup date was updated to today
    const lastBackup = await page.evaluate(() => localStorage.getItem('stickify21_last_backup_date'));
    expect(lastBackup).toBeTruthy();
    const backupDate = new Date(lastBackup);
    expect(Date.now() - backupDate.getTime()).toBeLessThan(60000);
  });

  test('A5: Admin Duplicate Product and Bulk Actions with 10s Undo', async ({ page }) => {
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    if (await page.locator('#admin-lock-screen').isVisible()) {
      await page.fill('#admin-pin-input', '2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Navigate to Catalog tab
    await page.click('#tab-btn-products');
    await page.waitForSelector('#products-table-body tr');

    const initialRowCount = await page.locator('#products-table-body tr').count();

    // 1. Test Duplicate Product
    const firstRow = page.locator('#products-table-body tr').first();
    const originalName = await firstRow.locator('.product-name-cell').innerText();
    
    // Click duplicate button on first row
    const duplicateBtn = firstRow.locator('button[data-action="duplicate"]');
    await duplicateBtn.click();

    // Wait for row count to increase by 1
    await expect(page.locator('#products-table-body tr')).toHaveCount(initialRowCount + 1);
    
    // Verify duplicated product has "(نسخة)" in title
    const copyRow = page.locator('#products-table-body tr').filter({ hasText: 'نسخة' }).first();
    await expect(copyRow).toBeVisible();

    // 2. Test Bulk Selection and Actions
    // Select first 2 products via checkboxes
    const checkboxes = page.locator('.product-select-chk');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // Bulk actions bar should appear
    const bulkBar = page.locator('#bulk-actions-bar');
    await expect(bulkBar).toBeVisible();
    await expect(bulkBar).toContainText('تم تحديد 2');

    // Test Bulk Price Change by +10%
    await page.click('#bulk-price-adjust-btn');
    await page.fill('#bulk-price-percent-input', '10');
    await page.click('#apply-bulk-price-btn');

    // Undo toast should appear with 10s countdown
    const undoToast = page.locator('#bulk-undo-toast');
    await expect(undoToast).toBeVisible();
    await expect(undoToast).toContainText('تراجع');

    // Click Undo
    await undoToast.locator('button:has-text("تراجع")').click();
    await expect(undoToast).toBeHidden();
  });

  test('A8 & A9: Dashboard summary with date range filter and Stock alerts', async ({ page }) => {
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    if (await page.locator('#admin-lock-screen').isVisible()) {
      await page.fill('#admin-pin-input', '2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Ensure we are on Dashboard tab
    await page.click('#tab-btn-dashboard');

    // Check presence of Summary Analytics card with date range filter
    const summaryCard = page.locator('#dashboard-analytics-summary');
    await expect(summaryCard).toBeVisible();

    const dateFilter = page.locator('#dashboard-date-range');
    await expect(dateFilter).toBeVisible();

    // Verify key metrics exist: Orders, Revenue, Best Sellers, Pending Payment
    await expect(page.locator('#metric-total-orders')).toBeVisible();
    await expect(page.locator('#metric-total-revenue')).toBeVisible();
    await expect(page.locator('#metric-pending-payments')).toBeVisible();
    await expect(page.locator('#metric-top-sellers')).toBeVisible();

    // Switch date range to 'week' and verify metric update without error
    await dateFilter.selectOption('week');
    await page.waitForTimeout(300);
    await expect(page.locator('#metric-total-orders')).toBeVisible();

    // Check Stock alerts card
    const stockAlerts = page.locator('#dashboard-stock-alerts');
    await expect(stockAlerts).toBeVisible();
  });

  test('A10 & A12: Wishlist, Recently Viewed, Arabic Search Tolerance, and Product Tags', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // 1. Wishlist toggle
    const firstCard = page.locator('.sticker-card').first();
    const wishlistBtn = firstCard.locator('.wishlist-toggle-btn');
    await expect(wishlistBtn).toBeVisible();

    // Click wishlist
    await wishlistBtn.click();
    // Nav wishlist count should become 1
    const wishlistBadge = page.locator('#wishlist-badge');
    await expect(wishlistBadge).toHaveText('1');

    // 2. Arabic Search Normalization: Test matching despite different alef/tashkeel
    const searchInput = page.locator('#search-input');
    // Search with un-normalized Arabic letter e.g. "جيت" or "برمجه" (with ha instead of teh marbuta)
    await searchInput.fill('برمجه');
    await page.waitForTimeout(400);
    const visibleCards = page.locator('#products-grid .sticker-card:visible');
    // Should still match "برمجة"
    const count = await visibleCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // 3. Product Tags and Filter Chips
    const tagFilterBar = page.locator('#tag-filter-chips');
    await expect(tagFilterBar).toBeVisible();
    const chips = tagFilterBar.locator('button');
    expect(await chips.count()).toBeGreaterThan(0);

    // 4. Recently Viewed: Open a product detail modal to record as viewed
    await firstCard.locator('h3').click();
    await page.waitForSelector('#product-detail-modal:not(.hidden)');
    await page.locator('#product-detail-modal .modal-close-btn').click();
    await expect(page.locator('#product-detail-modal')).toBeHidden();

    // Reload and verify Recently Viewed strip appears
    await page.reload();
    await page.waitForSelector('#products-grid .sticker-card');
    const recentlyViewedSection = page.locator('#recently-viewed-section');
    await expect(recentlyViewedSection).toBeVisible();
    await expect(recentlyViewedSection.locator('.recently-viewed-card')).toHaveCount(1);
  });

  test('A13, A15, A17: Storage meter, Production Aggregate print, and Admin Theme toggle', async ({ page }) => {
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    if (await page.locator('#admin-lock-screen').isVisible()) {
      await page.fill('#admin-pin-input', '2121');
      await page.locator('#admin-login-btn').click();
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // 1. Admin Theme toggle (A17)
    const themeToggle = page.locator('#admin-theme-toggle');
    await expect(themeToggle).toBeVisible();
    await themeToggle.click();
    // Verify dark class toggled on body or html
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'));
    expect(isDark).toBe(true);
    // Click again to toggle back
    await themeToggle.click();

    // 2. Storage meter in Settings tab (A13)
    await page.click('#tab-btn-settings');
    const storageMeter = page.locator('#storage-usage-meter');
    await expect(storageMeter).toBeVisible();
    await expect(storageMeter).toContainText(/KB|MB|بايت|كيلوبايت/i);

    // 3. Production Aggregate Print Summary (A15)
    await page.click('#tab-btn-orders');
    const aggregateBtn = page.locator('#open-production-summary-btn');
    await expect(aggregateBtn).toBeVisible();
    await aggregateBtn.click();

    // Production summary modal should open displaying grouped sticker sizes
    const prodModal = page.locator('#production-summary-modal');
    await expect(prodModal).toBeVisible();
    await expect(prodModal).toContainText(/أمر تشغيل الإنتاج|ملخص كميات الطباعة/);
    await prodModal.locator('.modal-close-btn').click();
    await expect(prodModal).toBeHidden();
  });

});
