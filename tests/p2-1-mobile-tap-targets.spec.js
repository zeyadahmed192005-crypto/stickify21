import { test, expect } from '@playwright/test';

test.describe('P2-1: Mobile Tap Targets (>= 44px) & Zero Horizontal Overflow at 375px AR/EN', () => {
  for (const lang of ['ar', 'en']) {
    test(`Storefront (${lang.toUpperCase()}) at 375x812 has zero horizontal overflow and >=44px primary interactive tap targets`, async ({ page }) => {
      await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(lang === 'en' ? '/?lang=en' : '/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#products-grid .sticker-card');

      const audit = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const tooSmall = [];

        // Check visible interactive buttons, inputs, selects, and header/CTA links
        const selectors = 'header button, header a, main button, section button, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"]), select';
        const els = document.querySelectorAll(selectors);
        for (const el of els) {
          const st = getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
          if (el.closest('.hidden')) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          // Either height >= 44 or both width & height >= 44; WCAG 2.5.5 target size
          if (r.height < 44 || r.width < 44) {
            tooSmall.push({
              tag: el.tagName,
              id: el.id || '',
              cls: (el.className || '').toString().slice(0, 50),
              text: (el.textContent || '').trim().slice(0, 30),
              w: Math.round(r.width),
              h: Math.round(r.height)
            });
          }
        }
        return { docWidth, scrollWidth, tooSmallCount: tooSmall.length, sample: tooSmall.slice(0, 15) };
      });

      expect(audit.scrollWidth, `Horizontal overflow detected in ${lang}: ${audit.scrollWidth} > ${audit.docWidth}`).toBeLessThanOrEqual(audit.docWidth + 2);
      expect(audit.tooSmallCount, `Found ${audit.tooSmallCount} tap targets < 44px in ${lang}: ${JSON.stringify(audit.sample)}`).toBe(0);
    });
  }
});
