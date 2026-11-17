import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

function analyzePdfWithPyMuPdf(pdfPath) {
  const pyCode = [
    'import json, sys, pymupdf',
    'doc = pymupdf.open(sys.argv[1])',
    'pages_text = [p.get_text("text") for p in doc]',
    'fonts = sorted({f[3] for p in doc for f in p.get_fonts()})',
    'out = {"page_count": doc.page_count, "fonts": fonts, "full_text": "\\n".join(pages_text), "pages_text_len": [len(t.strip()) for t in pages_text]}',
    'doc.close()',
    'print(json.dumps(out, ensure_ascii=False))'
  ].join('\n');
  const raw = execFileSync('python', ['-c', pyCode, pdfPath], { encoding: 'utf8' });
  return JSON.parse(raw);
}

function buildSyntheticOrder(count) {
  const lines = [];
  const expectedSkus = [];
  if (count >= 10) {
    const packItems = Array.from({ length: 10 }, (_, i) => {
      const sku = `PK10-${i + 1}`;
      expectedSkus.push(sku);
      return { sku, name: `استيكر باقة ${i + 1} Mixed LTR/RTL`, sizeKey: 'medium', finish: i % 2 ? 'glossy' : 'matte', unitPrice: 35 };
    });
    lines.push({ type: 'pack', size: 10, discountRate: 0.3, packPrice: 245, items: packItems });
  }
  const rem = count >= 10 ? count - 10 : count;
  for (let i = 0; i < rem; i++) {
    const sku = `STK-${count}-${i + 1}`;
    expectedSkus.push(sku);
    lines.push({ type: 'single', sku, name: `استيكر رقم ${i + 1} بتصميم مخصص`, sizeKey: 'medium', finish: 'matte', unitPrice: 35, quantity: 1 });
  }
  return {
    order: {
      id: `S21-P02-${count}`,
      date: '2026-11-17T12:00:00.000Z',
      status: 'ready',
      customer: {
        name: `عبدالرحمن محمد إبراهيم الشناوي — Customer ${count}`,
        phone: '01098765432',
        city: 'الإسكندرية',
        address: 'سموحة شارع فوزي معاذ برج الزهور الدور السابع شقة 74 بجوار نادي سموحة',
        notes: 'يرجى الاتصال قبل الوصول بنصف ساعة — Call before arrival'
      },
      payment: count === 5
        ? { method: 'instapay', accountId: 'acc-1', proofAttached: true, status: 'verified' }
        : { method: 'cod', accountId: null, proofAttached: false, status: 'pending' },
      subtotal: count * 35,
      shipping: 0,
      discount: 0,
      total: count * 35,
      lines
    },
    expectedSkus
  };
}

test.describe('P0-2: Packing Slip, Payment Formatter & Real PDF Integrity', () => {
  test('Zero [object Object], undefined, NaN, or null leaks across pages and object payment renders cleanly', async ({ page }) => {
    const badTokens = /\[object Object\]|\bundefined\b|\bNaN\b/;

    // 1. Storefront
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');
    expect(await page.locator('body').innerText()).not.toMatch(badTokens);

    // 2. Admin with object payment order
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    if (await page.locator('#admin-lock-screen').isVisible()) {
      await page.fill('#admin-pin-input', '2121');
      await page.click('#admin-login-btn');
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    const sample = buildSyntheticOrder(5).order;
    await page.evaluate((ord) => {
      localStorage.setItem('stickify21_orders', JSON.stringify([ord]));
    }, sample);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');
    expect(await page.locator('#orders-list-container').innerText()).not.toMatch(badTokens);

    // 3. Packing slip + shipping label
    await page.goto(`/packing-slip.html?id=${sample.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.packing-slip-sheet');
    const slipText = await page.locator('body').innerText();
    expect(slipText).not.toMatch(badTokens);
    expect(slipText).toMatch(/InstaPay|إنستاباي/i);
  });

  test('A4 PDFs for 1, 5, 12, 30, 60 items fit on EXACTLY 1 page with >=8.5pt font and ZERO truncated SKUs', async ({ page }) => {
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    if (await page.locator('#admin-lock-screen').isVisible()) {
      await page.fill('#admin-pin-input', '2121');
      await page.click('#admin-login-btn');
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    const counts = [1, 5, 12, 30, 60];
    const built = counts.map(c => buildSyntheticOrder(c));
    await page.evaluate((orders) => {
      localStorage.setItem('stickify21_orders', JSON.stringify(orders));
    }, built.map(b => b.order));

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 's21-p02-'));
    try {
      for (const { order, expectedSkus } of built) {
        await page.goto(`/packing-slip.html?id=${order.id}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.packing-slip-sheet');
        await page.waitForTimeout(150);

        // Verify computed minimum font size >= 8.5pt (11.33px)
        const minFontPx = await page.evaluate(() => {
          let min = 999;
          for (const el of document.querySelectorAll('.packing-slip-sheet *')) {
            if (el.children.length === 0 && (el.textContent || '').trim().length > 0) {
              const style = getComputedStyle(el);
              if (style.display !== 'none' && style.visibility !== 'hidden') {
                const sz = parseFloat(style.fontSize);
                if (sz > 0 && sz < min) min = sz;
              }
            }
          }
          return min;
        });
        expect(minFontPx, `Min font px for ${order.id} must be >= 11.3px (8.5pt)`).toBeGreaterThanOrEqual(11.3);

        const a4Path = path.join(tmpDir, `${order.id}_A4.pdf`);
        await page.pdf({ path: a4Path, format: 'A4', printBackground: true });
        const info = analyzePdfWithPyMuPdf(a4Path);

        expect(info.page_count, `A4 PDF for ${order.id} must be exactly 1 page`).toBe(1);
        expect(info.fonts.length, `A4 PDF for ${order.id} must embed fonts`).toBeGreaterThan(0);
        expect(info.full_text).not.toContain('[object Object]');
        expect(info.full_text).toContain(String(order.total));
        for (const sku of expectedSkus) {
          expect(info.full_text, `Missing SKU ${sku} in A4 PDF for ${order.id}`).toContain(sku);
        }
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('A5 PDFs (1, 5, 12 on 1 page; 60 warns without truncation), Shipping Label (1 page), and Bulk Print (3 orders = 3 pages)', async ({ page }) => {
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    if (await page.locator('#admin-lock-screen').isVisible()) {
      await page.fill('#admin-pin-input', '2121');
      await page.click('#admin-login-btn');
    }
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    const o1 = buildSyntheticOrder(1);
    const o12 = buildSyntheticOrder(12);
    const o60 = buildSyntheticOrder(60);
    await page.evaluate((orders) => {
      localStorage.setItem('stickify21_orders', JSON.stringify(orders));
    }, [o1.order, o12.order, o60.order]);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 's21-p02-a5-'));
    try {
      // A5 for 12 items -> 1 page
      await page.goto(`/packing-slip.html?id=${o12.order.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.packing-slip-sheet');
      await page.click('button[data-mode="a5"]');
      await page.waitForTimeout(150);
      const a5_12 = path.join(tmpDir, 'a5_12.pdf');
      await page.pdf({ path: a5_12, format: 'A5', printBackground: true });
      const info12 = analyzePdfWithPyMuPdf(a5_12);
      expect(info12.page_count).toBe(1);
      for (const sku of o12.expectedSkus) {
        expect(info12.full_text).toContain(sku);
      }

      // A5 for 60 items -> warning shown, zero SKUs truncated
      await page.goto(`/packing-slip.html?id=${o60.order.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.packing-slip-sheet');
      await page.click('button[data-mode="a5"]');
      await page.waitForTimeout(150);
      expect(await page.locator('body').innerText()).toContain('الطلب كبير جدًا، استخدم A4');
      const a5_60 = path.join(tmpDir, 'a5_60.pdf');
      await page.pdf({ path: a5_60, format: 'A5', printBackground: true });
      const info60 = analyzePdfWithPyMuPdf(a5_60);
      for (const sku of o60.expectedSkus) {
        expect(info60.full_text, `A5 60-item PDF truncated SKU ${sku}`).toContain(sku);
      }

      // Shipping label -> 1 page
      await page.goto(`/packing-slip.html?id=${o1.order.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.packing-slip-sheet');
      await page.click('button[data-mode="label"]');
      await page.waitForTimeout(150);
      const lblPath = path.join(tmpDir, 'label.pdf');
      await page.pdf({ path: lblPath, width: '100mm', height: '150mm', printBackground: true });
      const infoLbl = analyzePdfWithPyMuPdf(lblPath);
      expect(infoLbl.page_count).toBe(1);
      expect(infoLbl.full_text).toContain(o1.order.id);
      expect(infoLbl.full_text).not.toContain('[object Object]');

      // Bulk print 3 orders -> exact 3 pages (using o1, o12, o60 on A4)
      await page.goto(`/packing-slip.html?ids=${o1.order.id},${o12.order.id},${o60.order.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.packing-slip-sheet');
      await page.waitForTimeout(150);
      const bulkPath = path.join(tmpDir, 'bulk3.pdf');
      await page.pdf({ path: bulkPath, format: 'A4', printBackground: true });
      const infoBulk = analyzePdfWithPyMuPdf(bulkPath);
      expect(infoBulk.page_count).toBe(3);
      expect(infoBulk.full_text).toContain(o1.order.id);
      expect(infoBulk.full_text).toContain(o12.order.id);
      expect(infoBulk.full_text).toContain(o60.order.id);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
