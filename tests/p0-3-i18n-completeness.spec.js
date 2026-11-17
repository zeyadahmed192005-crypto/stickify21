import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { AR } from '../src/i18n/ar.js';
import { EN } from '../src/i18n/en.js';

const ARABIC_RE = /[\u0600-\u06FF]/;

async function collectArabicLeaksInDom(page) {
  return await page.evaluate(() => {
    const arRe = /[\u0600-\u06FF]/;
    const leaks = [];
    const allowedExact = new Set(['عربي', 'AR']);

    const isVisible = (el) => {
      if (!el || el.nodeType !== 1) return false;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    // Walk visible text nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const txt = (node.nodeValue || '').trim();
      if (!txt || allowedExact.has(txt)) continue;
      if (arRe.test(txt)) {
        const parent = node.parentElement;
        if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE' && isVisible(parent)) {
          // Allow inside <option> elements only if select is visible, wait: even options should be translated!
          if (!parent.closest('#lang-toggle-btn') && !parent.closest('[data-allow-arabic="true"]')) {
            leaks.push({ kind: 'text', tag: parent.tagName, id: parent.id || '', text: txt.slice(0, 80) });
          }
        }
      }
    }

    // Check attributes on visible elements
    for (const el of document.querySelectorAll('input, textarea, button, a, img, select')) {
      if (!isVisible(el) || el.closest('#lang-toggle-btn')) continue;
      for (const attr of ['placeholder', 'title', 'aria-label']) {
        const v = el.getAttribute(attr);
        if (v && arRe.test(v)) {
          leaks.push({ kind: `attr:${attr}`, tag: el.tagName, id: el.id || '', text: v.slice(0, 80) });
        }
      }
    }
    return leaks;
  });
}

test.describe('P0-3: Bilingual i18n Completeness & Zero Arabic Leak in EN Mode', () => {
  test('Dictionary key parity: every used i18n key exists in AR & EN, and EN values differ from AR', async () => {
    const arKeys = Object.keys(AR);
    const enKeys = Object.keys(EN);
    expect(enKeys.sort()).toEqual(arKeys.sort());

    const allowedIdentical = new Set(['brandName', 'slogan', 'whatsappNumber']);
    const identical = arKeys.filter(k => !allowedIdentical.has(k) && AR[k] === EN[k]);
    expect(identical, 'English translations must not be identical to Arabic').toEqual([]);

    // Scan index.html and app.js for data-i18n* and t('...') keys
    const files = ['index.html', 'app.js'];
    const missing = [];
    for (const f of files) {
      const content = fs.readFileSync(path.resolve(f), 'utf8');
      for (const m of content.matchAll(/data-i18n(?:-placeholder|-title|-aria)?=["']([a-zA-Z0-9_.]+)["']/g)) {
        if (!AR[m[1]] || !EN[m[1]]) missing.push(`${f}:${m[1]}`);
      }
      for (const m of content.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
        if (!AR[m[1]] || !EN[m[1]]) missing.push(`${f}:${m[1]}`);
      }
    }
    expect(missing, 'Missing i18n keys in AR/EN dictionaries').toEqual([]);
  });

  test('Home page in ?lang=en has ZERO visible Arabic text or attribute leaks and translated document title', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('ltr');
    expect(ARABIC_RE.test(await page.title())).toBe(false);

    const homeLeaks = await collectArabicLeaksInDom(page);
    expect(homeLeaks, `Found ${homeLeaks.length} Arabic leaks on EN home page`).toEqual([]);
  });

  test('Modals (Cart, Checkout, Product Detail, Tracking, Policies, Size Guide) have ZERO Arabic leaks in EN mode', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/?lang=en', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Product Detail Modal
    await page.locator('#products-grid .sticker-card h3').first().click();
    await page.waitForSelector('#product-detail-modal:not(.hidden)');
    expect(await collectArabicLeaksInDom(page), 'Product detail modal has Arabic leaks').toEqual([]);
    await page.locator('#product-detail-modal .modal-close-btn').click();

    // Add item -> Cart Modal
    await page.locator('#products-grid .sticker-card button').filter({ hasText: 'Add to Cart' }).first().click();
    await page.click('#cart-btn');
    await page.waitForSelector('#cart-modal:not(.hidden)');
    expect(await collectArabicLeaksInDom(page), 'Cart modal has Arabic leaks').toEqual([]);

    // Checkout Modal (also check InstaPay & Vodafone Cash details in EN!)
    await page.click('button[onclick*="openCheckoutModal"]');
    await page.waitForSelector('#checkout-modal:not(.hidden)');
    expect(await collectArabicLeaksInDom(page), 'Checkout modal (COD) has Arabic leaks').toEqual([]);
    await page.click('#pay-instapay');
    expect(await collectArabicLeaksInDom(page), 'Checkout modal (InstaPay) has Arabic leaks').toEqual([]);
    await page.click('#pay-vodafone');
    expect(await collectArabicLeaksInDom(page), 'Checkout modal (Vodafone Cash) has Arabic leaks').toEqual([]);
    await page.click('#checkout-modal button[onclick*="closeCheckoutModal"]');
    await page.evaluate(() => window.toggleCartModal(false));

    // Tracking Modal
    await page.click('#nav-track-link');
    await page.waitForSelector('#order-tracking-modal:not(.hidden)');
    expect(await collectArabicLeaksInDom(page), 'Tracking modal has Arabic leaks').toEqual([]);
    await page.click('#order-tracking-modal button[onclick*="closeOrderTrackingModal"]');

    // Size Guide Modal
    await page.click('#open-size-guide-btn');
    await page.waitForSelector('#size-guide-modal:not(.hidden)');
    expect(await collectArabicLeaksInDom(page), 'Size guide modal has Arabic leaks').toEqual([]);
    await page.click('#size-guide-modal button[onclick*="closeSizeGuideModal"]');

    // Policy Modal (all 5 tabs)
    await page.evaluate(() => window.openPolicyModal('about'));
    await page.waitForSelector('#policy-modal:not(.hidden)');
    for (const tab of ['about', 'shipping', 'returns', 'terms', 'privacy']) {
      await page.evaluate((tKey) => window.switchPolicyTab(tKey), tab);
      expect(await collectArabicLeaksInDom(page), `Policy modal (${tab}) has Arabic leaks`).toEqual([]);
    }
    await page.evaluate(() => window.closePolicyModal());
  });
});
