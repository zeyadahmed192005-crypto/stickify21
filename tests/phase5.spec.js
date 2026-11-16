import { test, expect } from '@playwright/test';

test.describe('Phase 5 Acceptance Tests: SEO, Performance, Legal Policies & Launch Prep', () => {

  test('1. Head meta tags, OpenGraph, Twitter Cards, canonical link & favicon in index.html', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Document title
    const title = await page.title();
    expect(title).toContain('STICKIFY 21');
    expect(title).toContain('استيكرات');

    // Meta description (Arabic, informative)
    const metaDesc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDesc).toBeTruthy();
    expect(metaDesc.length).toBeGreaterThan(20);
    expect(metaDesc).toContain('استيكرات');

    // Canonical link
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe('https://stickify21.com/');

    // OpenGraph tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toContain('STICKIFY 21');

    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content');
    expect(ogDesc).toBeTruthy();

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toContain('logo.jpg');

    const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content');
    expect(ogLocale).toBe('ar_EG');

    // Twitter Card
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    expect(twitterCard).toBe('summary_large_image');

    const twitterTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content');
    expect(twitterTitle).toContain('STICKIFY 21');

    // Theme color & Icons
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor.toLowerCase()).toBe('#ff5000');

    const icon = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(icon).toContain('logo.jpg');
  });

  test('2. Search engine directives: robots.txt, sitemap.xml, and noindex on admin/packing-slip', async ({ request, page }) => {
    // 2.1 robots.txt validation
    const robotsRes = await request.get('/robots.txt');
    expect(robotsRes.ok()).toBeTruthy();
    const robotsText = await robotsRes.text();
    expect(robotsText).toContain('User-agent: *');
    expect(robotsText).toContain('Disallow: /admin.html');
    expect(robotsText).toContain('Disallow: /packing-slip.html');
    expect(robotsText).toContain('Sitemap: https://stickify21.com/sitemap.xml');

    // 2.2 sitemap.xml validation
    const sitemapRes = await request.get('/sitemap.xml');
    expect(sitemapRes.ok()).toBeTruthy();
    const sitemapText = await sitemapRes.text();
    expect(sitemapText).toContain('<urlset');
    expect(sitemapText).toContain('https://stickify21.com/');
    expect(sitemapText).toContain('https://stickify21.com/#/custom-print');
    expect(sitemapText).toContain('https://stickify21.com/#/track');

    // 2.3 admin.html noindex
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    const adminRobots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(adminRobots).toBe('noindex, nofollow');

    // 2.4 packing-slip.html noindex
    await page.goto('/packing-slip.html', { waitUntil: 'domcontentloaded' });
    const slipRobots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(slipRobots).toBe('noindex, nofollow');
  });

  test('3. Structured data (JSON-LD): static Organization/WebSite and dynamic Product ItemList', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Static JSON-LD
    const staticLd = await page.locator('#jsonld-static-schema').textContent();
    expect(staticLd).toBeTruthy();
    const staticJson = JSON.parse(staticLd);
    expect(staticJson['@graph']).toBeDefined();
    const org = staticJson['@graph'].find(item => item['@type'] === 'Organization');
    expect(org).toBeDefined();
    expect(org.name).toBe('STICKIFY 21');
    expect(org.telephone).toBe('+201043546503');

    const website = staticJson['@graph'].find(item => item['@type'] === 'WebSite');
    expect(website).toBeDefined();
    expect(website.url).toMatch(/^https:\/\/stickify21\.com\/?$/);

    // Dynamic Product JSON-LD (populated by app.js on load)
    await page.waitForFunction(() => {
      const el = document.getElementById('jsonld-products-schema');
      return el && el.textContent.includes('ItemList');
    }, { timeout: 10000 });

    const productLdEl = page.locator('#jsonld-products-schema');
    await expect(productLdEl).toBeAttached();
    const productLdText = await productLdEl.textContent();
    expect(productLdText).toBeTruthy();
    expect(productLdText).toContain('ItemList');
    const productJson = JSON.parse(productLdText);
    expect(productJson['@type']).toBe('ItemList');
    expect(Array.isArray(productJson.itemListElement)).toBeTruthy();
    expect(productJson.itemListElement.length).toBeGreaterThan(0);

    // Verify first product item structure
    const firstItem = productJson.itemListElement[0];
    const firstProduct = firstItem.item || firstItem;
    expect(firstProduct['@type']).toBe('Product');
    expect(firstProduct.name).toBeTruthy();
    expect(firstProduct.sku).toBeTruthy();
    expect(firstProduct.offers).toBeDefined();
    expect(firstProduct.offers.priceCurrency).toBe('EGP');
  });

  test('4. Legal / trust policy modal opens, switches tabs, and handles hash routes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const policyModal = page.locator('#policy-modal');
    await expect(policyModal).toBeHidden();

    // 4.1 Open via footer link
    const termsLink = page.locator('[onclick*="openPolicyModal(\'terms\')"]');
    await termsLink.click();
    await expect(policyModal).toBeVisible();

    // Verify legal draft disclaimer banner is displayed
    await expect(page.locator('#policy-modal-draft-notice')).toBeVisible();
    await expect(page.locator('#policy-modal-draft-notice')).toContainText('مسودة استرشادية');

    // Verify terms tab is active and content matches
    await expect(page.locator('#policy-modal-title')).toContainText('الشروط والأحكام');
    await expect(page.locator('#policy-modal-body')).toContainText('العملة والأسعار');

    // 4.2 Switch tab to Shipping & Returns
    const shippingTabBtn = page.locator('button[data-policy-tab="shipping_returns"]');
    await shippingTabBtn.click();
    await expect(page.locator('#policy-modal-title')).toContainText('الشحن والتوصيل');
    await expect(page.locator('#policy-modal-body')).toContainText('جمهورية مصر العربية');

    // 4.3 Switch tab to Privacy
    const privacyTabBtn = page.locator('button[data-policy-tab="privacy"]');
    await privacyTabBtn.click();
    await expect(page.locator('#policy-modal-title')).toContainText('سياسة الخصوصية');
    await expect(page.locator('#policy-modal-body')).toContainText('البيانات المطلوبة للشحن');

    // 4.4 Close modal
    const closeBtn = page.locator('#policy-modal button[onclick*="closePolicyModal()"]');
    await closeBtn.click();
    await expect(policyModal).toBeHidden();

    // 4.5 Test hash routing deep link #/shipping-returns
    await page.goto('/#/shipping-returns', { waitUntil: 'domcontentloaded' });
    await expect(policyModal).toBeVisible();
    await expect(page.locator('#policy-modal-title')).toContainText('الشحن والتوصيل');

    // Close via close button
    await closeBtn.click();
    await expect(policyModal).toBeHidden();
  });

  test('5. Analytics hooks dispatch correctly without console errors', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify window.analytics is available and test manual hook dispatch
    const trackResult = await page.evaluate(() => {
      if (!window.analytics) return { success: false, reason: 'window.analytics missing' };

      // Dispatch custom test event
      window.analytics.track('test_custom_event', { sample_prop: 'val123' });

      // Dispatch standard hooks
      window.analytics.trackAddToCart({ sku: 'STK-TEST', nameAr: 'استيكر تجريبي', price: 35, quantity: 2 });
      window.analytics.trackViewItem({ sku: 'STK-TEST', nameAr: 'استيكر تجريبي', price: 35 });
      window.analytics.trackBeginCheckout([{ sku: 'STK-TEST', price: 35, quantity: 2 }], 70);

      return { success: true };
    });

    expect(trackResult.success).toBe(true);

    // Verify debug logs captured the events
    const debugLogs = consoleLogs.filter(l => l.text.includes('[STICKIFY Analytics Hook]'));
    expect(debugLogs.length).toBeGreaterThanOrEqual(4);
    expect(debugLogs.some(l => l.text.includes('test_custom_event'))).toBeTruthy();
    expect(debugLogs.some(l => l.text.includes('add_to_cart'))).toBeTruthy();
    expect(debugLogs.some(l => l.text.includes('view_item'))).toBeTruthy();
    expect(debugLogs.some(l => l.text.includes('begin_checkout'))).toBeTruthy();
  });

  test('6. Clean store load has zero uncaught console errors', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', exception => {
      pageErrors.push(exception.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore transient socket / connection refused from test server teardown
        if (text.includes('ERR_CONNECTION_REFUSED')) return;
        consoleErrors.push(text);
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

});
