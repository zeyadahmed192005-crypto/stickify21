import { test, expect } from '@playwright/test';
import { ORDER_STATUSES, ORDER_TRANSITIONS, isValidStatusTransition, applyStatusTransition } from '../src/domain/orders.js';

const EXPECTED_ALLOWED = {
  pending: ['awaiting_confirmation', 'confirmed', 'cancelled'],
  awaiting_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'], // P1-2: MUST NOT skip 'ready' to 'shipped'!
  ready: ['shipped', 'cancelled'],
  shipped: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

test.describe('P1-2: Strict N x N Order Status Transitions (No Skipping Ready)', () => {
  test('Domain N x N matrix (8x8 = 64 transitions): only legal transitions pass, preparing -> shipped is rejected', async () => {
    const allStates = Object.keys(ORDER_STATUSES);
    expect(allStates.sort()).toEqual(Object.keys(EXPECTED_ALLOWED).sort());
    expect(ORDER_TRANSITIONS.preparing).toEqual(['ready', 'cancelled']);

    for (const from of allStates) {
      for (const to of allStates) {
        const shouldBeAllowed = (from === to) || EXPECTED_ALLOWED[from].includes(to);
        const actual = isValidStatusTransition(from, to);
        expect(actual, `Transition ${from} -> ${to}`).toBe(shouldBeAllowed);

        const order = { id: 'S21-TEST-01', status: from, statusHistory: [] };
        if (shouldBeAllowed) {
          const updated = applyStatusTransition(order, to, 'test note');
          expect(updated.status).toBe(to);
          expect(updated.statusHistory.length).toBe(1);
          expect(updated.statusHistory[0].status).toBe(to);
          expect(updated.statusHistory[0].timestamp).toBeTruthy();
        } else {
          expect(() => applyStatusTransition(order, to, 'illegal'), `Should throw for ${from} -> ${to}`).toThrow();
        }
      }
    }
  });

  test('Admin UI disables preparing -> shipped option and enforces preparing -> ready -> shipped', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      localStorage.setItem('stickify21_orders', JSON.stringify([{
        id: 'S21-P12-PREP',
        date: new Date().toISOString(),
        status: 'preparing',
        customer: { name: 'اختبار الحالة', phone: '01012345678', governorate: 'القاهرة', address: 'المعادي' },
        payment: 'عند الاستلام (COD)',
        paymentMethod: 'cod',
        subtotal: 70,
        discount: 0,
        shippingCost: 35,
        total: 105,
        lines: [{ type: 'single', sku: 'DEV-01', name: 'Test', sizeKey: 'medium', finish: 'glossy', unitPrice: 35, quantity: 2, total: 70 }],
        statusHistory: [{ status: 'preparing', timestamp: new Date().toISOString(), note: 'seed' }]
      }]));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    const shippedOptionDisabled = await page.locator('#status-select-S21-P12-PREP option[value="shipped"]').isDisabled();
    const readyOptionDisabled = await page.locator('#status-select-S21-P12-PREP option[value="ready"]').isDisabled();
    expect(shippedOptionDisabled).toBe(true);
    expect(readyOptionDisabled).toBe(false);
  });
});
