import { test, expect } from '@playwright/test';
import { migrateStorageBundle } from '../src/data/migrations.js';

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const HOLO_RE = /holographic|هولوجرام|هولوغرام/i;
const DECORATIVE_GLYPH_RE = /[•→←↗✓▲▼]/;

test.describe('P1-4: Migration Emoji/Holographic Purge & Clean SVG UI Glyphs', () => {
  test('migrateStorageBundle strips emojis & holographic terms (AR/EN) on legacy and v2 imported JSON and logs report', async () => {
    const dirtyBundle = {
      app: 'STICKIFY 21',
      schemaVersion: '2.0.0', // Even v2 imported JSON must be sanitized!
      products: [
        {
          id: 'p-holo',
          sku: 'HOLO-01',
          name: 'Cool Holographic Cat 🔥',
          nameAr: 'قطة هولوجرام لامعة ✨',
          nameEn: 'Holographic Cat Sticker 🚀',
          desc: 'ستيكر هولوغرام ضد الماء 💧',
          descAr: 'ستيكر هولوغرام ضد الماء 💧',
          descEn: 'Waterproof holographic vinyl 🔥',
          badge: 'هولوجرام ⭐',
          badgeAr: 'هولوجرام ⭐',
          badgeEn: 'Holographic ⭐',
          finish: 'holographic',
          finishes: ['matte', 'holographic'],
          tags: ['هولوجرام', 'قطط 🐱', 'holographic'],
          price: 35
        }
      ],
      categories: [
        { id: 'cats', nameAr: 'قطط 🐱', nameEn: 'Cats 🐱', badge: 'جديد 🔥', icon: '🐱' }
      ],
      coupons: [
        { code: 'FUN10', type: 'percentage', discountPercent: 10, desc: 'خصم 🔥 10%' }
      ],
      showcase: [
        { id: 'sc-1', captionAr: 'على اللابتوب 💻', captionEn: 'On laptop 💻', active: true }
      ],
      orders: [
        {
          id: 'S21-OLD-1',
          status: 'قيد التجهيز',
          items: [{ sku: 'HOLO-01', nameAr: 'قطة هولوجرام ✨', finish: 'holographic', price: 35, quantity: 1 }]
        }
      ]
    };

    const migrated = migrateStorageBundle(dirtyBundle);
    const prod = migrated.products[0];
    expect(prod.finish).toBe('glossy');
    expect(prod.finishes).not.toContain('holographic');

    const serialized = JSON.stringify({
      products: migrated.products,
      categories: migrated.categories,
      coupons: migrated.coupons,
      showcase: migrated.showcase
    });
    expect(EMOJI_RE.test(serialized), `Emojis leaked: ${serialized}`).toBe(false);
    expect(HOLO_RE.test(serialized), `Holographic leaked: ${serialized}`).toBe(false);

    expect(migrated.migrationReport).toBeTruthy();
    expect(migrated.migrationReport.emojisStripped).toBeGreaterThan(0);
    expect(migrated.migrationReport.holographicCleaned).toBeGreaterThan(0);
  });

  test('Storefront (index.html) and Admin (admin.html) contain zero decorative text glyphs (• → ← ↗ ✓ ▲ ▼)', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());

    const collectGlyphs = async () => await page.evaluate(() => {
      const re = /[•→←↗✓▲▼]/;
      const found = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = (node.nodeValue || '').trim();
        if (!t) continue;
        const p = node.parentElement;
        if (!p || p.tagName === 'SCRIPT' || p.tagName === 'STYLE') continue;
        if (re.test(t)) {
          found.push({ tag: p.tagName, id: p.id || '', text: t.slice(0, 80) });
        }
      }
      return found;
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');
    expect(await collectGlyphs(), 'Storefront AR has decorative glyphs').toEqual([]);

    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');
    expect(await collectGlyphs(), 'Admin has decorative glyphs').toEqual([]);
  });
});
