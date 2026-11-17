/**
 * STICKIFY 21 - Internationalization (i18n) Engine
 * Manages Arabic and English locales, string interpolation, and currency formatting.
 */

import { AR } from './ar.js';
import { EN, TAG_EN_MAP, GOV_EN_MAP } from './en.js';

const DICTIONARIES = { ar: AR, en: EN };
let currentLang = 'ar';

/**
 * Initialize language from URL query string or localStorage.
 * @returns {string} active language code
 */
export function initI18n() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramLang = urlParams.get('lang')?.toLowerCase();
  
  if (paramLang && (paramLang === 'ar' || paramLang === 'en')) {
    currentLang = paramLang;
    localStorage.setItem('stickify21_lang', currentLang);
  } else {
    const saved = localStorage.getItem('stickify21_lang');
    if (saved === 'ar' || saved === 'en') {
      currentLang = saved;
    } else {
      currentLang = 'ar';
    }
  }

  applyDocumentDirection(currentLang);
  return currentLang;
}

/**
 * Returns the current active language code ('ar' | 'en').
 * @returns {string}
 */
export function getLanguage() {
  return currentLang;
}

/**
 * Sets active language, updates DOM attributes, and persists to localStorage.
 * @param {'ar'|'en'} lang
 */
export function setLanguage(lang) {
  if (lang !== 'ar' && lang !== 'en') return;
  currentLang = lang;
  localStorage.setItem('stickify21_lang', lang);
  applyDocumentDirection(lang);
}

/**
 * Applies lang and dir attributes to document element.
 * @param {'ar'|'en'} lang
 */
function applyDocumentDirection(lang) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.setAttribute('lang', lang);
  html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  
  // Font family adjustment: Arabic prioritizes Readex Pro, English prioritizes Space Grotesk / Plus Jakarta Sans
  if (lang === 'en') {
    document.body.classList.add('font-en');
    document.body.classList.remove('font-ar');
  } else {
    document.body.classList.add('font-ar');
    document.body.classList.remove('font-en');
  }
}

/**
 * Translates a key with optional dynamic parameters.
 * Missing key falls back to Arabic and warns in dev console.
 * @param {string} key
 * @param {Record<string, any>} [params={}]
 * @returns {string}
 */
export function t(key, params = {}) {
  const dict = DICTIONARIES[currentLang] || AR;
  let str = dict[key];

  if (str === undefined) {
    // Fallback to Arabic
    str = AR[key];
    if (str === undefined) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[i18n] Missing translation key: "${key}" in language "${currentLang}"`);
      }
      return key;
    }
  }

  // Parameter replacement: {param}
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
}

/**
 * Formats monetary amounts with the localized currency symbol.
 * Keeps Western digits (1, 2, 3...) per brand requirements.
 * @param {number|string} amount
 * @param {string} [lang]
 * @returns {string}
 */
export function formatCurrency(amount, lang = currentLang) {
  const num = Math.round(Number(amount) || 0);
  return lang === 'en' ? `${num} EGP` : `${num} ج.م`;
}

export function translateTag(tag, lang = currentLang) {
  if (!tag) return '';
  if (lang === 'en') {
    const trimmed = String(tag).trim();
    return TAG_EN_MAP[trimmed] || trimmed;
  }
  return String(tag).trim();
}

export function translateGovernorate(govAr, lang = currentLang) {
  if (!govAr) return '';
  if (lang === 'en') return GOV_EN_MAP[govAr] || govAr;
  return govAr;
}

/**
 * Applies all data-i18n, data-i18n-placeholder, data-i18n-title, and data-i18n-aria
 * attributes across the DOM plus document.title.
 * @param {string} [lang]
 * @param {ParentNode} [root]
 */
export function applyI18nToDom(lang = currentLang, root = document) {
  if (typeof document === 'undefined' || !root) return;
  if (root === document) {
    document.title = t('pageTitle');
  }
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (key) el.setAttribute('aria-label', t(key));
  });
}

// Global exposure for non-module handlers and console debugging
if (typeof window !== 'undefined') {
  window.i18n = {
    getLanguage,
    setLanguage,
    t,
    formatCurrency,
    translateTag,
    translateGovernorate,
    applyI18nToDom,
    initI18n
  };
  window.t = t;
  window.formatCurrency = formatCurrency;
}
