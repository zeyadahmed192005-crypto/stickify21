import { test, expect } from '@playwright/test';

test.describe('P1-1: HMAC-Signed Admin Session with Non-Extractable IndexedDB CryptoKey', () => {
  test('Forged localStorage session and forged sessionStorage bypass are REJECTED', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    // 1. Forge localStorage session without valid HMAC signature
    await page.evaluate(() => {
      localStorage.setItem('stickify21_admin_session', JSON.stringify({
        token: 'forged-token-1234',
        createdAt: Date.now(),
        lastActive: Date.now(),
        expiresAt: Date.now() + 12 * 3600 * 1000,
        sig: '0'.repeat(64)
      }));
      sessionStorage.setItem('stickify21_admin_authenticated', 'true');
      sessionStorage.setItem('stickify21_admin_last_active', String(Date.now()));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    // Must remain locked!
    await expect(page.locator('#admin-lock-screen')).toBeVisible();
    await expect(page.locator('#admin-dashboard-app')).toBeHidden();
  });

  test('Real login issues HMAC-signed session backed by non-extractable CryptoKey; tampering and key rotation invalidate tokens', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });

    // Login with real PIN
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');

    // 1. Check session has 64-hex HMAC signature and CryptoKey in IndexedDB is non-extractable
    const cryptoInfo = await page.evaluate(async () => {
      const sess = JSON.parse(localStorage.getItem('stickify21_admin_session') || 'null');
      const keyInfo = await new Promise((resolve) => {
        const req = indexedDB.open('stickify21_auth_keys_db');
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('signing_keys')) {
            db.close();
            return resolve(null);
          }
          const tx = db.transaction('signing_keys', 'readonly');
          const getReq = tx.objectStore('signing_keys').get('session_hmac_key');
          getReq.onsuccess = () => {
            const rec = getReq.result;
            db.close();
            resolve(rec && rec.key ? {
              type: rec.key.type,
              extractable: rec.key.extractable,
              algo: rec.key.algorithm?.name,
              version: rec.version
            } : null);
          };
          getReq.onerror = () => { db.close(); resolve(null); };
        };
      });
      return { sess, keyInfo };
    });

    expect(cryptoInfo.sess).toBeTruthy();
    expect(cryptoInfo.sess.sig).toMatch(/^[0-9a-f]{64}$/);
    expect(cryptoInfo.keyInfo).toBeTruthy();
    expect(cryptoInfo.keyInfo.extractable).toBe(false);
    expect(cryptoInfo.keyInfo.algo).toBe('HMAC');

    // Save valid signed session before tampering / rotation
    const savedValidRaw = await page.evaluate(() => localStorage.getItem('stickify21_admin_session'));

    // 2. Reload with untouched valid signed session -> stays unlocked
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#admin-dashboard-app')).toBeVisible();

    // 3. Tamper with expiresAt on valid session -> REJECTED on reload
    await page.evaluate((raw) => {
      const s = JSON.parse(raw);
      s.expiresAt += 86400000;
      localStorage.setItem('stickify21_admin_session', JSON.stringify(s));
    }, savedValidRaw);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#admin-lock-screen')).toBeVisible();
    await expect(page.locator('#admin-dashboard-app')).toBeHidden();

    // 4. Re-login, capture token, change passcode (rotates HMAC key), replay captured token -> REJECTED
    await page.fill('#admin-pin-input', '2121');
    await page.click('#admin-login-btn');
    await page.waitForSelector('#admin-dashboard-app:not(.hidden)');
    const preRotationSession = await page.evaluate(() => localStorage.getItem('stickify21_admin_session'));

    await page.click('#tab-btn-settings');
    await page.fill('#change-old-passcode', '2121');
    await page.fill('#change-new-passcode', '9876');
    await page.click('#change-passcode-btn');
    await page.waitForTimeout(400);

    // Replay pre-rotation session token -> must be REJECTED because HMAC key rotated!
    await page.evaluate((oldRaw) => {
      localStorage.setItem('stickify21_admin_session', oldRaw);
    }, preRotationSession);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#admin-lock-screen')).toBeVisible();
    await expect(page.locator('#admin-dashboard-app')).toBeHidden();
  });
});
