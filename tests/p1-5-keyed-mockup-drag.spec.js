import { test, expect } from '@playwright/test';

test.describe('P1-5: Keyed Mockup Sticker Reconciliation & GPU Transform Drag via rAF', () => {
  test('Dragging, rotating, resizing, and adding stickers preserves DOM node identity (===) of other stickers and updates transform', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Place 3 stickers onto the mockup studio
    await page.evaluate(() => {
      window.addStickerToMockup('stk-1');
      window.addStickerToMockup('stk-3');
      window.addStickerToMockup('stk-2');
    });

    const ids = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('#mockup-stickers-layer .mockup-placed-sticker'));
      window.__stickerRefs = {};
      nodes.forEach(n => { window.__stickerRefs[n.dataset.placedId] = n; });
      return nodes.map(n => n.dataset.placedId);
    });
    expect(ids.length).toBe(3);
    expect(new Set(ids).size).toBe(3);

    const [id0, id1, id2] = ids;

    // Scroll studio into view and drag topmost sticker (id2)
    await page.locator('#device-wrapper').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);

    // Record initial bounding box & style.transform of sticker 2 (topmost)
    const before = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, transform: el.style.transform, left: el.style.left, top: el.style.top };
    }, id2);

    // Drag sticker 2 using mouse
    const s2 = page.locator(`#${id2}`);
    const box = await s2.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(80);

    const afterDrag = await page.evaluate(({ id0, id1, id2 }) => {
      const el0 = document.getElementById(id0);
      const el1 = document.getElementById(id1);
      const el2 = document.getElementById(id2);
      const r2 = el2.getBoundingClientRect();
      return {
        x: r2.x,
        y: r2.y,
        transform: el2.style.transform,
        left: el2.style.left,
        top: el2.style.top,
        same0: el0 === window.__stickerRefs[id0],
        same1: el1 === window.__stickerRefs[id1],
        same2: el2 === window.__stickerRefs[id2]
      };
    }, { id0, id1, id2 });

    expect(Math.abs(afterDrag.x - before.x)).toBeGreaterThan(30);
    expect(afterDrag.transform).not.toBe(before.transform); // GPU transform updated!
    expect(afterDrag.left).toBe(before.left); // No layout left mutation!
    expect(afterDrag.top).toBe(before.top);   // No layout top mutation!
    expect(afterDrag.same0).toBe(true);
    expect(afterDrag.same1).toBe(true);
    expect(afterDrag.same2).toBe(true);

    // Now rotate, resize, and add a 4th sticker -> existing DOM nodes MUST remain identical (===)!
    await page.evaluate(() => {
      window.rotateCurrentSticker();
      window.setPlacedStickerSize('large');
      window.addStickerToMockup('stk-6');
    });

    const afterOps = await page.evaluate(({ id0, id1, id2 }) => ({
      same0: document.getElementById(id0) === window.__stickerRefs[id0],
      same1: document.getElementById(id1) === window.__stickerRefs[id1],
      same2: document.getElementById(id2) === window.__stickerRefs[id2],
      total: document.querySelectorAll('#mockup-stickers-layer .mockup-placed-sticker').length
    }), { id0, id1, id2 });

    expect(afterOps.total).toBe(4);
    expect(afterOps.same0).toBe(true);
    expect(afterOps.same1).toBe(true);
    expect(afterOps.same2).toBe(true);
  });
});
