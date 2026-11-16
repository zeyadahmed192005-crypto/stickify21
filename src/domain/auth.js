/**
 * STICKIFY 21 - Admin Authentication & Passcode Security (PBKDF2 Web Crypto)
 */
import { CONFIG } from '../config/config.js';

const AUTH_CONFIG = CONFIG.AUTH;
const STORAGE_HASH_KEY = 'stickify21_admin_passcode_hash';
const STORAGE_SALT_KEY = 'stickify21_admin_passcode_salt';
const SESSION_AUTH_KEY = 'stickify21_admin_authenticated';
const SESSION_LAST_ACTIVE_KEY = 'stickify21_admin_last_active';
const RATE_LIMIT_KEY = 'stickify21_admin_rate_limit';

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

  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

    // Lockout expired, reset attempts
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
    // Default PIN: 2121
    const defaultHash = await hashPasscode('2121', AUTH_CONFIG.SALT);
    localStorage.setItem(STORAGE_HASH_KEY, defaultHash);
    localStorage.setItem(STORAGE_SALT_KEY, AUTH_CONFIG.SALT);
    return defaultHash;
  }
  return existingHash;
}

/**
 * Verify entered passcode against stored PBKDF2 hash
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
    // Establish session in sessionStorage
    sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
    sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(Date.now()));
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
 * Update the admin passcode
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

  const newSalt = 'stickify21_' + Date.now();
  const newHash = await hashPasscode(newPasscode.trim(), newSalt);

  localStorage.setItem(STORAGE_HASH_KEY, newHash);
  localStorage.setItem(STORAGE_SALT_KEY, newSalt);

  return { success: true };
}

/**
 * Check if admin is currently authenticated and session is active
 * @returns {boolean}
 */
export function isAdminAuthenticated() {
  const isAuth = sessionStorage.getItem(SESSION_AUTH_KEY) === 'true';
  if (!isAuth) return false;

  const lastActiveStr = sessionStorage.getItem(SESSION_LAST_ACTIVE_KEY);
  if (!lastActiveStr) return false;

  const lastActive = Number(lastActiveStr);
  const now = Date.now();

  // 30 min session timeout check
  if (now - lastActive > AUTH_CONFIG.SESSION_TIMEOUT_MS) {
    adminLogout();
    return false;
  }

  // Refresh active timestamp
  sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
  return true;
}

/**
 * Terminate admin session
 */
export function adminLogout() {
  sessionStorage.removeItem(SESSION_AUTH_KEY);
  sessionStorage.removeItem(SESSION_LAST_ACTIVE_KEY);
}
