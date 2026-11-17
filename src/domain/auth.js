/**
 * STICKIFY 21 - Admin Authentication & Passcode Security (PBKDF2 + Non-Extractable HMAC-SHA256 Session Key)
 */
import { CONFIG } from '../config/config.js';

const AUTH_CONFIG = CONFIG.AUTH;
const STORAGE_HASH_KEY = 'stickify21_admin_passcode_hash';
const STORAGE_SALT_KEY = 'stickify21_admin_passcode_salt';
const STORAGE_SESSION_KEY = 'stickify21_admin_session';
const SESSION_AUTH_KEY = 'stickify21_admin_authenticated';
const SESSION_LAST_ACTIVE_KEY = 'stickify21_admin_last_active';
const RATE_LIMIT_KEY = 'stickify21_admin_rate_limit';

const AUTH_KEYS_DB_NAME = 'stickify21_auth_keys_db';
const AUTH_KEYS_DB_VERSION = 1;
const AUTH_KEYS_STORE = 'signing_keys';
const SESSION_HMAC_KEY_ID = 'session_hmac_key';

function openAuthKeysDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB unavailable'));
    }
    const req = indexedDB.open(AUTH_KEYS_DB_NAME, AUTH_KEYS_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(AUTH_KEYS_STORE)) {
        db.createObjectStore(AUTH_KEYS_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredSigningKeyRecord() {
  try {
    const db = await openAuthKeysDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(AUTH_KEYS_STORE, 'readonly');
      const req = tx.objectStore(AUTH_KEYS_STORE).get(SESSION_HMAC_KEY_ID);
      req.onsuccess = () => {
        const res = req.result || null;
        db.close();
        resolve(res);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (e) {
    return null;
  }
}

async function generateAndStoreSigningKeyRecord(nextVersion = 1) {
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false, // non-extractable CryptoKey!
    ['sign', 'verify']
  );
  const record = {
    id: SESSION_HMAC_KEY_ID,
    key,
    version: nextVersion,
    rotatedAt: Date.now()
  };
  const db = await openAuthKeysDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(AUTH_KEYS_STORE, 'readwrite');
    const req = tx.objectStore(AUTH_KEYS_STORE).put(record);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
  return record;
}

async function getOrCreateSigningKeyRecord() {
  const existing = await getStoredSigningKeyRecord();
  if (existing && existing.key) return existing;
  return generateAndStoreSigningKeyRecord(1);
}

export async function rotateSessionSigningKey() {
  const existing = await getStoredSigningKeyRecord();
  const nextVersion = existing && typeof existing.version === 'number' ? existing.version + 1 : 2;
  return generateAndStoreSigningKeyRecord(nextVersion);
}

function bytesToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    return null;
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function canonicalSessionPayload(session) {
  return `${session.token}|${session.createdAt}|${session.lastActive}|${session.expiresAt}|${session.keyVersion}`;
}

async function signSessionObject(session, key) {
  const enc = new TextEncoder();
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(canonicalSessionPayload(session)));
  return bytesToHex(sigBuf);
}

async function issueSignedSession(keyRecord) {
  const now = Date.now();
  const tokenBytes = new Uint8Array(16);
  crypto.getRandomValues(tokenBytes);
  const sessionObj = {
    token: bytesToHex(tokenBytes),
    createdAt: now,
    lastActive: now,
    expiresAt: now + AUTH_CONFIG.SESSION_TIMEOUT_MS,
    keyVersion: keyRecord.version
  };
  sessionObj.sig = await signSessionObject(sessionObj, keyRecord.key);
  localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionObj));
  // Clear legacy unsigned sessionStorage flags
  try {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    sessionStorage.removeItem(SESSION_LAST_ACTIVE_KEY);
  } catch (e) {}
  return sessionObj;
}

/**
 * Hash a plain passcode using PBKDF2 with SHA-256
 * @param {string} passcode
 * @param {string} salt
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashPasscode(passcode, salt = AUTH_CONFIG.SALT) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passcode),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: AUTH_CONFIG.ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    AUTH_CONFIG.KEY_LENGTH * 8
  );

  return bytesToHex(derivedBits);
}

/**
 * Get rate limiting status
 * @returns {{ isLocked: boolean, remainingMs: number, attemptsLeft: number }}
 */
export function getRateLimitStatus() {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_KEY) || localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) {
      return { isLocked: false, remainingMs: 0, attemptsLeft: AUTH_CONFIG.MAX_ATTEMPTS };
    }
    const state = JSON.parse(raw);
    const now = Date.now();

    if (state.lockedUntil && state.lockedUntil > now) {
      return {
        isLocked: true,
        remainingMs: state.lockedUntil - now,
        attemptsLeft: 0
      };
    }

    if (state.lockedUntil && state.lockedUntil <= now) {
      clearRateLimit();
      return { isLocked: false, remainingMs: 0, attemptsLeft: AUTH_CONFIG.MAX_ATTEMPTS };
    }

    const attemptsLeft = Math.max(0, AUTH_CONFIG.MAX_ATTEMPTS - (state.failedAttempts || 0));
    return {
      isLocked: false,
      remainingMs: 0,
      attemptsLeft
    };
  } catch (e) {
    return { isLocked: false, remainingMs: 0, attemptsLeft: AUTH_CONFIG.MAX_ATTEMPTS };
  }
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt() {
  const now = Date.now();
  let state = { failedAttempts: 0, lockedUntil: 0 };
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_KEY) || localStorage.getItem(RATE_LIMIT_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {}

  state.failedAttempts = (state.failedAttempts || 0) + 1;

  if (state.failedAttempts >= AUTH_CONFIG.MAX_ATTEMPTS) {
    state.lockedUntil = now + AUTH_CONFIG.LOCKOUT_MS;
  }

  const payload = JSON.stringify(state);
  sessionStorage.setItem(RATE_LIMIT_KEY, payload);
  localStorage.setItem(RATE_LIMIT_KEY, payload);

  return getRateLimitStatus();
}

/**
 * Clear rate limiting after successful login
 */
export function clearRateLimit() {
  try {
    sessionStorage.removeItem(RATE_LIMIT_KEY);
    localStorage.removeItem(RATE_LIMIT_KEY);
  } catch (e) {}
}

/**
 * Initialize default passcode if not set
 */
export async function ensureAdminPasscodeInitialized() {
  let existingHash = localStorage.getItem(STORAGE_HASH_KEY);
  if (!existingHash) {
    const defaultHash = await hashPasscode('2121', AUTH_CONFIG.SALT);
    localStorage.setItem(STORAGE_HASH_KEY, defaultHash);
    localStorage.setItem(STORAGE_SALT_KEY, AUTH_CONFIG.SALT);
    return defaultHash;
  }
  return existingHash;
}

/**
 * Verify entered passcode against stored PBKDF2 hash and issue HMAC-signed session
 * @param {string} enteredPasscode
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function verifyAdminPasscode(enteredPasscode) {
  const status = getRateLimitStatus();
  if (status.isLocked) {
    const remainingMins = Math.ceil(status.remainingMs / 60000);
    return {
      success: false,
      error: `تم قفل الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى المحاولة بعد ${remainingMins} دقيقة.`
    };
  }

  await ensureAdminPasscodeInitialized();
  const storedHash = localStorage.getItem(STORAGE_HASH_KEY);
  const storedSalt = localStorage.getItem(STORAGE_SALT_KEY) || AUTH_CONFIG.SALT;

  const enteredHash = await hashPasscode(enteredPasscode, storedSalt);

  if (enteredHash === storedHash) {
    clearRateLimit();
    const keyRecord = await getOrCreateSigningKeyRecord();
    const sessionObj = await issueSignedSession(keyRecord);

    try {
      const bc = new BroadcastChannel('stickify21_auth_channel');
      bc.postMessage({ type: 'login', token: sessionObj.token });
      bc.close();
    } catch (e) {}

    return { success: true };
  } else {
    const newStatus = recordFailedAttempt();
    if (newStatus.isLocked) {
      const mins = Math.ceil(AUTH_CONFIG.LOCKOUT_MS / 60000);
      return {
        success: false,
        error: `تم تجاوز الحد الأقصى للمحاولات (5 محاولات). تم قفل تسجيل الدخول لمدة ${mins} دقيقة.`
      };
    }
    return {
      success: false,
      error: `رمز الدخول غير صحيح. متبقي ${newStatus.attemptsLeft} محاولات قبل القفل المؤقت.`
    };
  }
}

/**
 * Update the admin passcode AND rotate the non-extractable HMAC session signing key
 * (immediately invalidating all previously issued session tokens).
 * @param {string} oldPasscode
 * @param {string} newPasscode
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function changeAdminPasscode(oldPasscode, newPasscode) {
  const verifyOld = await verifyAdminPasscode(oldPasscode);
  if (!verifyOld.success) {
    return { success: false, error: 'رمز الدخول الحالي غير صحيح' };
  }

  if (!newPasscode || newPasscode.trim().length < 4) {
    return { success: false, error: 'رمز الدخول الجديد يجب ألا يقل عن 4 أرقام/حروف' };
  }

  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const newSalt = 'stickify21_' + bytesToHex(saltBytes);
  const newHash = await hashPasscode(newPasscode.trim(), newSalt);

  localStorage.setItem(STORAGE_HASH_KEY, newHash);
  localStorage.setItem(STORAGE_SALT_KEY, newSalt);

  // Rotate non-extractable HMAC CryptoKey in IndexedDB & re-issue signed session
  const rotatedKeyRecord = await rotateSessionSigningKey();
  await issueSignedSession(rotatedKeyRecord);

  return { success: true };
}

/**
 * Cryptographically verify the stored admin session token against the non-extractable
 * HMAC-SHA256 CryptoKey stored in IndexedDB.
 * Rejects forged localStorage values, tampered timestamps, expired tokens, and rotated keys.
 * @returns {Promise<boolean>}
 */
export async function verifyAdminSession() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return false;

    const session = JSON.parse(raw);
    const now = Date.now();
    if (
      !session ||
      typeof session.token !== 'string' ||
      typeof session.createdAt !== 'number' ||
      typeof session.lastActive !== 'number' ||
      typeof session.expiresAt !== 'number' ||
      typeof session.keyVersion !== 'number' ||
      typeof session.sig !== 'string' ||
      now > session.expiresAt
    ) {
      adminLogout();
      return false;
    }

    const keyRecord = await getStoredSigningKeyRecord();
    if (!keyRecord || !keyRecord.key || keyRecord.version !== session.keyVersion) {
      adminLogout();
      return false;
    }

    const sigBytes = hexToBytes(session.sig);
    if (!sigBytes || sigBytes.length !== 32) {
      adminLogout();
      return false;
    }

    const enc = new TextEncoder();
    const isValidSig = await crypto.subtle.verify(
      'HMAC',
      keyRecord.key,
      sigBytes,
      enc.encode(canonicalSessionPayload(session))
    );

    if (!isValidSig) {
      adminLogout();
      return false;
    }

    // Valid! Refresh sliding 12h expiry and re-sign with non-extractable CryptoKey
    session.lastActive = now;
    session.expiresAt = now + AUTH_CONFIG.SESSION_TIMEOUT_MS;
    session.sig = await signSessionObject(session, keyRecord.key);
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    return true;
  } catch (e) {
    adminLogout();
    return false;
  }
}

/**
 * Quick synchronous structural check (authoritative check is verifyAdminSession()).
 * Does NOT accept unsigned sessionStorage flags.
 * @returns {boolean}
 */
export function isAdminAuthenticated() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    const now = Date.now();
    if (
      !session ||
      typeof session.sig !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(session.sig) ||
      typeof session.expiresAt !== 'number' ||
      now > session.expiresAt
    ) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Terminate admin session across all tabs (R11)
 */
export function adminLogout() {
  try {
    localStorage.removeItem(STORAGE_SESSION_KEY);
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    sessionStorage.removeItem(SESSION_LAST_ACTIVE_KEY);
  } catch (e) {}

  try {
    const bc = new BroadcastChannel('stickify21_auth_channel');
    bc.postMessage({ type: 'logout' });
    bc.close();
  } catch (e) {}
}

/**
 * Set up cross-tab synchronization listener
 * @param {Function} onLogout Callback when logout occurs in another tab
 */
export function setupAuthSync(onLogout) {
  if (typeof window === 'undefined') return;

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_SESSION_KEY && !e.newValue) {
      if (typeof onLogout === 'function') onLogout();
    }
  });

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel('stickify21_auth_channel');
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'logout') {
          if (typeof onLogout === 'function') onLogout();
        }
      };
    } catch (e) {}
  }
}
