import { test, expect } from '@playwright/test';
import { generateOrderId } from '../src/utils/ids.js';

const UNAMBIGUOUS_RE = /^S21-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,}$/;

test.describe('P1-3: Order ID Entropy (F-02) & CSV Formula Injection Protection (F-03)', () => {
  test('F-02: generateOrderId produces >=6 unambiguous random chars with 0 collisions across 100,000 IDs', async () => {
    const sample = generateOrderId();
    expect(sample).toMatch(UNAMBIGUOUS_RE);
    expect(sample.split('-')[2]).not.toMatch(/[01IO]/);

    // 100,000 generated IDs -> 0 collisions
    const seen = new Set();
    let collisions = 0;
    for (let i = 0; i < 100000; i++) {
      const id = generateOrderId();
      if (seen.has(id)) collisions++;
      seen.add(id);
    }
    expect(collisions).toBe(0);
    expect(seen.size).toBe(100000);

    // Existing ID collision avoidance
    const forced = generateOrderId([sample]);
    expect(forced).not.toBe(sample);
  });

  test('F-03: exportOrdersCsv neutralizes formula injection (= + - @ \\t \\r) across all columns', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      localStorage.setItem('stickify21_orders', JSON.stringify([
        {
          id: 'S21-261118-CSVSEC01',
          date: '2026-11-18',
          status: 'confirmed',
          customer: {
            name: '=CMD|\' /C calc\'!A0',
            phone: '+201012345678',
            governorate: 'القاهرة',
            address: '-2+3+cmd|\' /C calc\'!A0',
            notes: '@SUM(1+1)*cmd|\' /C calc\'!A0'
          },
          payment: 'عند الاستلام (COD)',
          paymentMethod: 'cod',
          total: 105,
          couponCode: '\t=HYPERLINK("http://evil.com","click")',
          items: [{ sku: 'DEV-01', quantity: 1, price: 35 }]
        },
        {
          id: 'S21-261118-CSVSEC02',
          date: '2026-11-18',
          status: 'confirmed',
          customer: {
            name: '\r=1+1',
            phone: '01099998888',
            governorate: 'الجيزة',
            address: 'شارع النيل',
            notes: 'عادي'
          },
          payment: 'عند الاستلام (COD)',
          paymentMethod: 'cod',
          total: 70,
          couponCode: '',
          items: [{ sku: 'DEV-01', quantity: 1, price: 35 }]
        }
      ]));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    await page.evaluate(() => window.exportOrdersCsv());
    const csv = await page.evaluate(() => window.__lastExportedCsv || '');

    // Must prefix ' before =, +, -, @, \t, \r
    expect(csv).toContain(`"'=CMD|`);
    expect(csv).toContain(`"'+201012345678"`);
    expect(csv).toContain(`"'-2+3+cmd|`);
    expect(csv).toContain(`"'@SUM(1+1)`);
    expect(csv).toContain(`"'\t=HYPERLINK`);
    expect(csv).toContain(`"'\r=1+1"`);

    // Must NOT contain raw unprefixed formula cells
    expect(csv).not.toContain(`"=CMD|`);
    expect(csv).not.toContain(`"+201012345678"`);
    expect(csv).not.toContain(`"-2+3+cmd|`);
    expect(csv).not.toContain(`"@SUM(1+1)`);
  });
});
