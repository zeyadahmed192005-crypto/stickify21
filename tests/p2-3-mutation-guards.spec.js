import { test, expect } from '@playwright/test';
import { generateOrderCode, parseOrderCode } from '../src/utils/ids.js';
import { isValidStatusTransition, applyStatusTransition } from '../src/domain/orders.js';
import { detectMagicKind } from '../src/utils/fileValidation.js';

test.describe('P2-3: Mutation Gap Closure Guards (M2, M3, M7, M10)', () => {
  test('M2 Guard: generateOrderCode -> parseOrderCode preserves exact 5-pack items (SKUs, sizes, finishes)', async () => {
    const order = {
      id: 'S21-261118-PACKM299',
      date: '2026-11-18T10:00:00Z',
      status: 'awaiting_confirmation',
      customer: { name: 'اختبار باقة', phone: '01012345678', governorate: 'القاهرة', address: 'المعادي' },
      payment: 'عند الاستلام (COD)',
      subtotal: 140,
      discount: 0,
      shippingCost: 35,
      total: 175,
      lines: [
        {
          type: 'pack',
          size: 5,
          discountRate: 0.2,
          packPrice: 140,
          items: [
            { sku: 'DEV-01', name: 'Git Push', sizeKey: 'small', finish: 'glossy', unitPrice: 35 },
            { sku: 'DEV-02', name: '404 Sleep', sizeKey: 'medium', finish: 'matte', unitPrice: 35 },
            { sku: 'ARB-01', name: 'Fakkek', sizeKey: 'large', finish: 'glossy', unitPrice: 30 },
            { sku: 'ANM-01', name: 'Ramen', sizeKey: 'medium', finish: 'glossy', unitPrice: 35 },
            { sku: 'GYM-01', name: 'Discipline', sizeKey: 'small', finish: 'matte', unitPrice: 35 }
          ]
        }
      ]
    };

    const code = generateOrderCode(order);
    expect(code).toContain('S21CODE:');
    const parsed = parseOrderCode(code);
    expect(parsed.lines).toBeDefined();
    expect(parsed.lines.length).toBe(1);
    expect(parsed.lines[0].type).toBe('pack');
    expect(parsed.lines[0].items.length).toBe(5);
    expect(parsed.lines[0].items.map(i => i.sku)).toEqual(['DEV-01', 'DEV-02', 'ARB-01', 'ANM-01', 'GYM-01']);
    expect(parsed.lines[0].items.map(i => i.sizeKey)).toEqual(['small', 'medium', 'large', 'medium', 'small']);
    expect(parsed.lines[0].items.map(i => i.finish)).toEqual(['glossy', 'matte', 'glossy', 'glossy', 'matte']);
  });

  test('M3 Guard: Illegal status jumps (awaiting_confirmation->shipped & preparing->shipped) strictly blocked', async () => {
    expect(isValidStatusTransition('awaiting_confirmation', 'shipped')).toBe(false);
    expect(isValidStatusTransition('preparing', 'shipped')).toBe(false);
    expect(() => applyStatusTransition({ id: 'O1', status: 'awaiting_confirmation' }, 'shipped')).toThrow();
    expect(() => applyStatusTransition({ id: 'O2', status: 'preparing' }, 'shipped')).toThrow();
  });

  test('M7 Guard: Magic-byte detector distinguishes real PNG from disguised JPEG, EXE, and HTML', async () => {
    const pngSig = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
    const jpgSig = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const mzExe = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03]);
    const htmlBytes = new TextEncoder().encode('<!DOCTYPE html><html><script>alert(1)</script></html>');

    expect(detectMagicKind(pngSig, 'png')).toBe('png');
    expect(detectMagicKind(jpgSig, 'png')).toBe('jpg'); // Disguised JPEG with .png ext!
    expect(detectMagicKind(mzExe, 'jpg')).toBe('executable_mz');
    expect(detectMagicKind(htmlBytes, 'png')).toBe('html');
  });

  test('M10 Guard: Non-COD checkout (InstaPay & Vodafone Cash) without payment proof is BLOCKED and creates 0 orders', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Add item -> open checkout
    await page.locator('#products-grid .sticker-card button').filter({ hasText: 'أضف للسلة' }).first().click();
    await page.click('#cart-btn');
    await page.click('#open-checkout-btn');
    await page.waitForSelector('#checkout-modal:not(.hidden)');

    // Fill all valid customer fields
    await page.fill('#order-name', 'اختبار الدفع');
    await page.fill('#order-phone', '01012345678');
    await page.selectOption('#order-city', 'القاهرة');
    await page.fill('#order-address', 'شارع 9 المعادي');

    // Try InstaPay WITHOUT proof -> must be blocked!
    await page.click('#pay-instapay');
    await page.click('#checkout-submit-btn');
    await expect(page.locator('#payment-proof-error')).toBeVisible();

    let orderCount = await page.evaluate(() => JSON.parse(localStorage.getItem('stickify21_orders') || '[]').length);
    expect(orderCount).toBe(0);

    // Try Vodafone Cash WITHOUT proof -> must also be blocked!
    await page.click('#pay-vodafone');
    await page.click('#checkout-submit-btn');
    await expect(page.locator('#payment-proof-error')).toBeVisible();

    orderCount = await page.evaluate(() => JSON.parse(localStorage.getItem('stickify21_orders') || '[]').length);
    expect(orderCount).toBe(0);
  });
});
