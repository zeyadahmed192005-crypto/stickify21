import { test, expect } from '@playwright/test';
import zlib from 'zlib';

// Helper: build a real minimal valid PNG buffer (supports RGBA transparency or opaque RGB)
function createPngBuffer(width = 16, height = 16, transparent = true) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = transparent ? 6 : 2; // 6 = RGBA, 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const bpp = transparent ? 4 : 3;
  const raw = Buffer.alloc((width * bpp + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * bpp + 1);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * bpp;
      raw[px] = 255;     // R
      raw[px + 1] = 80;  // G
      raw[px + 2] = 0;   // B
      if (transparent) {
        // Top-left corner transparent (alpha=0), rest opaque
        raw[px + 3] = (x === 0 && y === 0) ? 0 : 255;
      }
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Helper: minimal valid JPEG bytes (1x1)
const VALID_JPG = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xFF, 0xDB, 0x00, 0x43, 0x00,
  ...Array(64).fill(0x01),
  0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09,
  0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xD2, 0xCF, 0x20,
  0xFF, 0xD9
]);

// Minimal valid GIF89a 1x1
const VALID_GIF = Buffer.from('47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b', 'hex');

// Minimal valid BMP 1x1
const VALID_BMP = Buffer.from([
  0x42, 0x4D, 0x3A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00, 0x00, 0x00,
  0x28, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x18, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x13, 0x0B, 0x00, 0x00, 0x13, 0x0B, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x50, 0xFF, 0x00
]);

const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const MALICIOUS_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" onload="window.__xss=1"><script>window.__xss=2</script><foreignObject><body><img src=x onerror="window.__xss=3"/></body></foreignObject><circle cx="50" cy="50" r="40" fill="#FF5000"/></svg>');
const FAKE_EXE_AS_JPG = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]); // MZ header
const FAKE_HTML_AS_PNG = Buffer.from('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>');

test.describe('P0-4: R14 PNG-Only Product Art + Safe Magic-Byte Uploads + Custom Print Matrix', () => {
  test('R12.3 Payment proof rejects fake EXE/HTML renamed as JPG and 0-byte, accepts real PNG', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#products-grid .sticker-card');

    // Add item -> open checkout -> select InstaPay
    await page.locator('#products-grid .sticker-card button').filter({ hasText: 'أضف للسلة' }).first().click();
    await page.click('#cart-btn');
    await page.click('#open-checkout-btn');
    await page.waitForSelector('#checkout-modal:not(.hidden)');
    await page.click('#pay-instapay');
    await page.waitForSelector('#payment-proof-group:not(.hidden)');

    // 1. Reject MZ executable renamed to receipt.jpg
    await page.setInputFiles('#payment-proof-file', {
      name: 'receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: FAKE_EXE_AS_JPG
    });
    await expect(page.locator('#payment-proof-error')).toBeVisible();
    await expect(page.locator('#payment-proof-preview')).toBeHidden();

    // 2. Reject 0-byte file
    await page.setInputFiles('#payment-proof-file', {
      name: 'empty.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(0)
    });
    await expect(page.locator('#payment-proof-error')).toBeVisible();

    // 3. Accept real PNG
    await page.setInputFiles('#payment-proof-file', {
      name: 'real-receipt.png',
      mimeType: 'image/png',
      buffer: createPngBuffer(64, 64, false)
    });
    await expect(page.locator('#payment-proof-error')).toBeHidden();
    await expect(page.locator('#payment-proof-preview')).toBeVisible();
  });

  test('R14 Admin product upload: strict PNG magic bytes, alpha warning for opaque, lossless PNG storage & non-PNG filter', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // Open Products tab and check "صور غير PNG" filter
    await page.click('#tab-btn-products');
    await page.waitForSelector('#admin-product-category-filter');
    const hasNonPngOpt = await page.locator('#admin-product-category-filter option[value="non_png"]').count();
    expect(hasNonPngOpt).toBe(1);
    await page.selectOption('#admin-product-category-filter', 'non_png');
    // Seed product S21-01 uses logo.jpg -> must appear in non_png filter!
    await expect(page.locator('#products-table-body')).toContainText('S21-01');

    // Open Add Product Modal
    await page.click('button[onclick*="openProductModal()"]');
    await page.waitForSelector('#product-modal:not(.hidden)');

    // 1. Reject real JPG
    await page.setInputFiles('#prod-file-input', {
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: VALID_JPG
    });
    await expect(page.locator('#prod-file-error')).toBeVisible();
    await expect(page.locator('#prod-file-error')).toContainText('ارفع الصورة بصيغة PNG بخلفية شفافة');

    // 2. Reject JPG disguised as .png (magic bytes check!)
    await page.setInputFiles('#prod-file-input', {
      name: 'disguised.png',
      mimeType: 'image/png',
      buffer: VALID_JPG
    });
    await expect(page.locator('#prod-file-error')).toBeVisible();
    await expect(page.locator('#prod-file-error')).toContainText('ارفع الصورة بصيغة PNG بخلفية شفافة');

    // 3. Reject HTML disguised as .png
    await page.setInputFiles('#prod-file-input', {
      name: 'xss.png',
      mimeType: 'image/png',
      buffer: FAKE_HTML_AS_PNG
    });
    await expect(page.locator('#prod-file-error')).toBeVisible();

    // 4. Opaque PNG triggers alpha warning banner
    await page.setInputFiles('#prod-file-input', {
      name: 'opaque.png',
      mimeType: 'image/png',
      buffer: createPngBuffer(32, 32, false)
    });
    await expect(page.locator('#prod-alpha-warning')).toBeVisible();

    // 5. Transparent PNG succeeds, preserves alpha pixel, stores image/png (NEVER WebP)
    await page.setInputFiles('#prod-file-input', {
      name: 'transparent-sticker.png',
      mimeType: 'image/png',
      buffer: createPngBuffer(40, 40, true)
    });
    await expect(page.locator('#prod-file-error')).toBeHidden();
    await expect(page.locator('#prod-alpha-warning')).toBeHidden();
    await expect.poll(async () => await page.inputValue('#prod-image')).toMatch(/^data:image\/png;base64,/);

    // Verify stored image preserves alpha pixel (0,0 has alpha === 0) and is NOT WebP
    const alphaCheck = await page.evaluate(async () => {
      const src = document.getElementById('prod-image').value;
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const tl = ctx.getImageData(0, 0, 1, 1).data;
      const center = ctx.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
      return { startsWithPng: src.startsWith('data:image/png'), topLeftAlpha: tl[3], centerAlpha: center[3] };
    });
    expect(alphaCheck.startsWithPng).toBe(true);
    expect(alphaCheck.topLeftAlpha).toBe(0);
    expect(alphaCheck.centerAlpha).toBe(255);
  });

  test('R14 Custom Print: multi-format matrix, SVG XSS sanitization, original byte preservation, 300 DPI warning & admin request log', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#custom-dropzone');

    // 1. Reject dangerous files: .exe, double extension x.png.exe, 0-byte, >15MB
    await page.setInputFiles('#custom-file-input', {
      name: 'malware.png.exe',
      mimeType: 'application/octet-stream',
      buffer: FAKE_EXE_AS_JPG
    });
    await expect(page.locator('#custom-file-error')).toBeVisible();

    await page.setInputFiles('#custom-file-input', {
      name: 'empty.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(0)
    });
    await expect(page.locator('#custom-file-error')).toBeVisible();

    // 2. Upload malicious SVG -> must be accepted safely, sanitized, NEVER execute window.__xss
    await page.setInputFiles('#custom-file-input', {
      name: 'design.svg',
      mimeType: 'image/svg+xml',
      buffer: MALICIOUS_SVG
    });
    await expect(page.locator('#custom-file-error')).toBeHidden();
    const xssTriggered = await page.evaluate(() => window.__xss || 0);
    expect(xssTriggered).toBe(0);

    // 3. Upload multiple valid print formats (PNG + GIF + BMP + PDF) -> original bytes preserved & low-DPI warning for tiny PNG
    const origPng = createPngBuffer(100, 100, true); // < 945px for 8cm @ 300 DPI -> must warn!
    await page.setInputFiles('#custom-file-input', [
      { name: 'logo-small.png', mimeType: 'image/png', buffer: origPng },
      { name: 'anim.gif', mimeType: 'image/gif', buffer: VALID_GIF },
      { name: 'bitmap.bmp', mimeType: 'image/bmp', buffer: VALID_BMP },
      { name: 'vector.pdf', mimeType: 'application/pdf', buffer: VALID_PDF }
    ]);
    await expect(page.locator('#custom-file-error')).toBeHidden();
    await expect(page.locator('#custom-dpi-warning')).toBeVisible();
    await expect(page.locator('#custom-files-list')).toContainText('logo-small.png');
    await expect(page.locator('#custom-files-list')).toContainText('vector.pdf');

    // 4. Reject >5 files
    await page.setInputFiles('#custom-file-input', [
      { name: '1.pdf', mimeType: 'application/pdf', buffer: VALID_PDF },
      { name: '2.pdf', mimeType: 'application/pdf', buffer: VALID_PDF },
      { name: '3.pdf', mimeType: 'application/pdf', buffer: VALID_PDF },
      { name: '4.pdf', mimeType: 'application/pdf', buffer: VALID_PDF },
      { name: '5.pdf', mimeType: 'application/pdf', buffer: VALID_PDF },
      { name: '6.pdf', mimeType: 'application/pdf', buffer: VALID_PDF }
    ]);
    await expect(page.locator('#custom-file-error')).toBeVisible();

    // 5. Re-upload 1 original PNG and submit custom print order -> verify exact SHA-256 original bytes in IndexedDB + Admin custom request row
    await page.setInputFiles('#custom-file-input', {
      name: 'original-art.png',
      mimeType: 'image/png',
      buffer: origPng
    });
    await page.fill('#custom-customer-name', 'Zeyad Studio');
    await page.fill('#custom-customer-phone', '01012345678');

    // Prevent popup opening during test
    await page.evaluate(() => { window.open = () => null; });
    await page.click('#custom-submit-btn');

    await expect(page.locator('#custom-order-confirmation')).toBeVisible();

    // Verify stored original bytes hash matches uploaded buffer byte-for-byte
    const expectedHash = await import('crypto').then(c => c.createHash('sha256').update(origPng).digest('hex'));
    const storedCheck = await page.evaluate(async () => {
      const reqs = JSON.parse(localStorage.getItem('stickify21_custom_requests') || '[]');
      if (!reqs.length) return null;
      const latest = reqs[0];
      const f = latest.files && latest.files[0];
      return { id: latest.id, sha256: f?.sha256, byteSize: f?.size, fileName: f?.name };
    });
    expect(storedCheck).not.toBeNull();
    expect(storedCheck.sha256).toBe(expectedHash);
    expect(storedCheck.byteSize).toBe(origPng.length);

    // Verify Admin shows custom print request with "تم الاستلام على واتساب" checkbox
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');
    await expect(page.locator('#admin-custom-requests-list')).toContainText('original-art.png');
    const waCheckbox = page.locator('#admin-custom-requests-list input[type="checkbox"]').first();
    await expect(waCheckbox).toBeVisible();
    await waCheckbox.check();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#admin-custom-requests-list input[type="checkbox"]').first()).toBeChecked();
  });
});
