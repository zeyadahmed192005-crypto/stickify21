/**
 * STICKIFY 21 - Local Storage & IndexedDB Adapter
 */
import { CONFIG } from '../config/config.js';
import { CURRENT_SCHEMA_VERSION, migrateStorageBundle } from './migrations.js';
import { SEED_PRODUCTS, SEED_CATEGORIES, SEED_COUPONS, SEED_SHOWCASE } from './seed.js';
import { DEFAULT_POLICIES } from './policies.js';
import { stripEmoji } from '../utils/emoji.js';

const STORAGE_KEYS = {
  SCHEMA: 'stickify21_schema_version',
  PRODUCTS: 'stickify21_products',
  ORDERS: 'stickify21_orders',
  CATEGORIES: 'stickify21_categories',
  COUPONS: 'stickify21_coupons',
  SETTINGS: 'stickify21_settings',
  CART: 'stickify21_cart',
  SHOWCASE: 'stickify21_showcase'
};

const DB_NAME = 'stickify21_assets_db';
const DB_VERSION = 1;
const ASSETS_STORE = 'custom_assets';

/**
 * Open IndexedDB for large binary image assets
 */
function openAssetsDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        db.createObjectStore(ASSETS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save image asset to IndexedDB
 * @param {string} id - Asset ID
 * @param {Blob|string} blob - Image blob or data URL
 * @param {Object} metadata
 */
export async function saveAssetToIndexedDb(id, blob, metadata = {}) {
  try {
    const db = await openAssetsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSETS_STORE, 'readwrite');
      const store = tx.objectStore(ASSETS_STORE);
      const record = { id, blob, metadata, createdAt: new Date().toISOString() };
      const req = store.put(record);
      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[STICKIFY 21] IndexedDB write failed, falling back to in-memory/localStorage', err);
    return id;
  }
}

/**
 * Retrieve image asset from IndexedDB
 * @param {string} id
 */
export async function getAssetFromIndexedDb(id) {
  try {
    const db = await openAssetsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSETS_STORE, 'readonly');
      const store = tx.objectStore(ASSETS_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[STICKIFY 21] IndexedDB read failed', err);
    return null;
  }
}

/**
 * Compress image client-side to max 1000px WebP
 * @param {File|Blob} file
 * @param {number} maxDimension
 * @param {number} quality
 * @returns {Promise<Blob>}
 */
export async function compressImageToWebP(file, maxDimension = 1000, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas WebP export failed'));
      }, 'image/webp', quality);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Safe JSON parser with corruption snapshotting
 */
function safeLoad(key, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[STICKIFY 21 Storage] Corrupted JSON in "${key}":`, err);
    try {
      localStorage.setItem(`${key}_corrupt_${Date.now()}`, raw);
    } catch (saveErr) {}
    return fallback;
  }
}

function safeSave(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[STICKIFY 21 Storage] Failed to save key "${key}":`, err);
  }
}

export const LocalAdapter = {
  /**
   * Initialize and seed storage on first run
   */
  async init() {
    let existingVersion = localStorage.getItem(STORAGE_KEYS.SCHEMA);
    const hasExistingData = localStorage.getItem(STORAGE_KEYS.PRODUCTS) !== null || localStorage.getItem(STORAGE_KEYS.ORDERS) !== null;

    if (!existingVersion && !hasExistingData) {
      // True First run on empty client: Seed demo data
      safeSave(STORAGE_KEYS.SCHEMA, CURRENT_SCHEMA_VERSION);
      safeSave(STORAGE_KEYS.PRODUCTS, SEED_PRODUCTS);
      safeSave(STORAGE_KEYS.CATEGORIES, SEED_CATEGORIES);
      safeSave(STORAGE_KEYS.COUPONS, SEED_COUPONS);
      safeSave(STORAGE_KEYS.SHOWCASE, SEED_SHOWCASE);
      safeSave(STORAGE_KEYS.ORDERS, []);
      safeSave(STORAGE_KEYS.SETTINGS, {
        brandName: CONFIG.BRAND_NAME,
        whatsappNumber: CONFIG.WHATSAPP_NUMBER,
        freeShippingThreshold: CONFIG.FREE_SHIPPING_THRESHOLD
      });
      return;
    }

    // Ensure showcase seeded if missing
    if (!localStorage.getItem(STORAGE_KEYS.SHOWCASE)) {
      safeSave(STORAGE_KEYS.SHOWCASE, SEED_SHOWCASE);
    }

    // If existing data was unversioned, treat as 0.0.0 (F-01 fix: never overwrite existing data with seeds)
    if (!existingVersion && hasExistingData) {
      existingVersion = '0.0.0';
    }

    // Run migrations if version outdated
    if (existingVersion < CURRENT_SCHEMA_VERSION) {
      const bundle = {
        schemaVersion: existingVersion,
        products: safeLoad(STORAGE_KEYS.PRODUCTS, SEED_PRODUCTS),
        orders: safeLoad(STORAGE_KEYS.ORDERS, []),
        categories: safeLoad(STORAGE_KEYS.CATEGORIES, SEED_CATEGORIES),
        coupons: safeLoad(STORAGE_KEYS.COUPONS, SEED_COUPONS),
        settings: safeLoad(STORAGE_KEYS.SETTINGS, {})
      };
      const migrated = migrateStorageBundle(bundle);
      safeSave(STORAGE_KEYS.SCHEMA, migrated.schemaVersion);
      safeSave(STORAGE_KEYS.PRODUCTS, migrated.products);
      safeSave(STORAGE_KEYS.ORDERS, migrated.orders);
      safeSave(STORAGE_KEYS.COUPONS, migrated.coupons);
      safeSave(STORAGE_KEYS.CATEGORIES, migrated.categories);
      safeSave(STORAGE_KEYS.SETTINGS, migrated.settings);
    }
  },

  // Products
  async getProducts() {
    let prods = safeLoad(STORAGE_KEYS.PRODUCTS, SEED_PRODUCTS);
    let changed = false;
    prods = prods.map(p => {
      let updated = false;
      let finish = p.finish;
      let finishes = p.finishes;
      if (finish === 'holographic') {
        finish = 'glossy';
        updated = true;
      }
      if (Array.isArray(finishes) && finishes.includes('holographic')) {
        finishes = finishes.filter(f => f !== 'holographic');
        if (!finishes.includes('glossy')) finishes.push('glossy');
        updated = true;
      }

      // Strip any emojis from product strings
      const cleanNameAr = stripEmoji(p.nameAr || p.name);
      const cleanDescAr = stripEmoji(p.descAr || p.desc);
      const cleanBadgeAr = stripEmoji(p.badgeAr || p.badge);
      const cleanNameEn = stripEmoji(p.nameEn || p.name);
      const cleanDescEn = stripEmoji(p.descEn || p.desc);
      const cleanBadgeEn = stripEmoji(p.badgeEn || p.badge);

      if (cleanNameAr !== p.nameAr || cleanDescAr !== p.descAr || cleanBadgeAr !== p.badgeAr || !p.nameEn) {
        updated = true;
      }

      if (updated) {
        changed = true;
        return {
          ...p,
          finish,
          finishes,
          name: cleanNameAr,
          nameAr: cleanNameAr,
          desc: cleanDescAr,
          descAr: cleanDescAr,
          badge: cleanBadgeAr,
          badgeAr: cleanBadgeAr,
          nameEn: cleanNameEn || cleanNameAr,
          descEn: cleanDescEn || cleanDescAr,
          badgeEn: cleanBadgeEn || cleanBadgeAr
        };
      }
      return p;
    });
    if (changed) {
      safeSave(STORAGE_KEYS.PRODUCTS, prods);
    }
    return prods;
  },
  async saveProduct(product) {
    const cleanProduct = {
      ...product,
      name: stripEmoji(product.nameAr || product.name),
      nameAr: stripEmoji(product.nameAr || product.name),
      desc: stripEmoji(product.descAr || product.desc),
      descAr: stripEmoji(product.descAr || product.desc),
      badge: stripEmoji(product.badgeAr || product.badge),
      badgeAr: stripEmoji(product.badgeAr || product.badge),
      nameEn: stripEmoji(product.nameEn || product.name),
      descEn: stripEmoji(product.descEn || product.desc),
      badgeEn: stripEmoji(product.badgeEn || product.badge)
    };
    const products = await this.getProducts();
    const idx = products.findIndex(p => p.id === cleanProduct.id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...cleanProduct };
    } else {
      products.unshift(cleanProduct);
    }
    safeSave(STORAGE_KEYS.PRODUCTS, products);
    return cleanProduct;
  },
  async deleteProduct(productId) {
    const products = await this.getProducts();
    const filtered = products.filter(p => p.id !== productId);
    safeSave(STORAGE_KEYS.PRODUCTS, filtered);
    return true;
  },

  // Orders
  async getOrders() {
    return safeLoad(STORAGE_KEYS.ORDERS, []);
  },
  async getOrderById(orderId) {
    const orders = await this.getOrders();
    return orders.find(o => o.id === orderId) || null;
  },
  async createOrder(order) {
    const orders = await this.getOrders();
    const existingIdx = orders.findIndex(o => o.id === order.id);
    if (existingIdx !== -1) {
      orders[existingIdx] = { ...orders[existingIdx], ...order };
    } else {
      orders.unshift(order);
    }
    safeSave(STORAGE_KEYS.ORDERS, orders);
    return order;
  },
  async updateOrder(order) {
    return this.createOrder(order);
  },
  async updateOrderStatus(orderId, newStatus, note = '') {
    const orders = await this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) {
      throw new Error(`الطلب رقم [${orderId}] غير موجود.`);
    }

    const order = orders[idx];
    const history = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
    history.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      note: note || `تحديث الحالة إلى ${newStatus}`
    });

    order.status = newStatus;
    order.statusHistory = history;
    order.updatedAt = new Date().toISOString();

    orders[idx] = order;
    safeSave(STORAGE_KEYS.ORDERS, orders);
    return order;
  },

  // Categories
  async getCategories() {
    let cats = safeLoad(STORAGE_KEYS.CATEGORIES, SEED_CATEGORIES);
    const iconMap = { '🔖': 'bookmark', '💻': 'code', '⚡': 'quote', '📐': 'faculty', '🍖': 'anime', '🎮': 'gaming', '💪': 'fitness', '🍊': 'brand' };
    let changed = false;
    cats = cats.map(c => {
      let iconKey = c.iconKey || iconMap[c.icon] || 'tag';
      let nameAr = stripEmoji(c.nameAr || c.name);
      let badge = stripEmoji(c.badge || '');
      if (c.iconKey !== iconKey || c.nameAr !== nameAr || c.icon || c.badge !== badge) {
        changed = true;
        const copy = { ...c, iconKey, nameAr, badge };
        delete copy.icon;
        return copy;
      }
      return c;
    });
    if (changed) safeSave(STORAGE_KEYS.CATEGORIES, cats);
    return cats;
  },
  async saveCategory(cat) {
    const categories = await this.getCategories();
    const idx = categories.findIndex(c => c.id === cat.id);
    if (idx !== -1) {
      categories[idx] = { ...categories[idx], ...cat };
    } else {
      categories.push(cat);
    }
    safeSave(STORAGE_KEYS.CATEGORIES, categories);
    return cat;
  },

  // Coupons
  async getCoupons() {
    return safeLoad(STORAGE_KEYS.COUPONS, SEED_COUPONS);
  },
  async saveCoupon(coupon) {
    const coupons = await this.getCoupons();
    const idx = coupons.findIndex(c => c.code.toUpperCase() === coupon.code.toUpperCase());
    if (idx !== -1) {
      coupons[idx] = { ...coupons[idx], ...coupon };
    } else {
      coupons.push(coupon);
    }
    safeSave(STORAGE_KEYS.COUPONS, coupons);
    return coupon;
  },
  async incrementCouponUsage(code) {
    const coupons = await this.getCoupons();
    const coupon = coupons.find(c => c.code.toUpperCase() === code.toUpperCase());
    if (coupon) {
      coupon.usageCount = (coupon.usageCount || 0) + 1;
      safeSave(STORAGE_KEYS.COUPONS, coupons);
    }
  },

  // Settings
  async getSettings() {
    const defaultSettings = {
      brandName: CONFIG.BRAND_NAME,
      whatsappNumber: CONFIG.WHATSAPP_NUMBER,
      freeShippingThreshold: CONFIG.FREE_SHIPPING_THRESHOLD,
      defaultShipping: CONFIG.DEFAULT_SHIPPING,
      shippingRates: { ...CONFIG.SHIPPING_RATES },
      governorates: CONFIG.GOVERNORATES.map(g => ({ ...g })),
      paymentAccounts: (CONFIG.PAYMENT_ACCOUNTS || []).map(a => ({ ...a })),
      whatsappTemplates: { ...(CONFIG.WHATSAPP_TEMPLATES || {}) },
      policies: JSON.parse(JSON.stringify(DEFAULT_POLICIES))
    };
    const loaded = safeLoad(STORAGE_KEYS.SETTINGS, defaultSettings);
    return {
      ...defaultSettings,
      ...loaded,
      paymentAccounts: loaded.paymentAccounts || defaultSettings.paymentAccounts,
      whatsappTemplates: { ...defaultSettings.whatsappTemplates, ...(loaded.whatsappTemplates || {}) },
      policies: { ...defaultSettings.policies, ...(loaded.policies || {}) }
    };
  },
  async saveSettings(settings) {
    safeSave(STORAGE_KEYS.SETTINGS, settings);
    return settings;
  },

  // Showcase
  async getShowcase() {
    return safeLoad(STORAGE_KEYS.SHOWCASE, SEED_SHOWCASE);
  },
  async saveShowcase(items) {
    safeSave(STORAGE_KEYS.SHOWCASE, items);
    return items;
  },
  async saveShowcaseItem(item) {
    const list = await this.getShowcase();
    const cleanItem = {
      id: item.id || 'sc-' + Date.now(),
      image: item.image || '',
      captionAr: stripEmoji(item.captionAr || item.caption || ''),
      captionEn: stripEmoji(item.captionEn || item.caption || ''),
      deviceTag: item.deviceTag || 'other',
      productId: item.productId || '',
      active: item.active !== false,
      order: item.order !== undefined ? item.order : list.length + 1
    };
    const idx = list.findIndex(x => x.id === cleanItem.id);
    if (idx !== -1) {
      list[idx] = cleanItem;
    } else {
      list.push(cleanItem);
    }
    safeSave(STORAGE_KEYS.SHOWCASE, list);
    return cleanItem;
  },
  async deleteShowcaseItem(id) {
    const list = await this.getShowcase();
    const filtered = list.filter(x => x.id !== id);
    safeSave(STORAGE_KEYS.SHOWCASE, filtered);
    return true;
  },

  // Export / Import
  async exportData() {
    return {
      app: 'STICKIFY 21',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      products: await this.getProducts(),
      orders: await this.getOrders(),
      categories: await this.getCategories(),
      coupons: await this.getCoupons(),
      showcase: await this.getShowcase(),
      settings: await this.getSettings()
    };
  },
  async importData(jsonString) {
    if (!jsonString) throw new Error('لا توجد بيانات للاستيراد');
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (err) {
      throw new Error('ملف الاستيراد تالف أو ليس بتنسيق JSON صحيح');
    }

    if (!parsed || parsed.app !== 'STICKIFY 21' || !Array.isArray(parsed.products)) {
      throw new Error('الملف لا ينتمي لمتجر STICKIFY 21 أو تنقصه بيانات المنتجات الأساسية');
    }

    // Automatic pre-import backup snapshot
    const currentData = await this.exportData();
    localStorage.setItem(`stickify21_pre_import_snapshot_${Date.now()}`, JSON.stringify(currentData));

    // Migrate if needed
    const migrated = migrateStorageBundle(parsed);

    safeSave(STORAGE_KEYS.SCHEMA, migrated.schemaVersion || CURRENT_SCHEMA_VERSION);
    if (Array.isArray(migrated.products)) safeSave(STORAGE_KEYS.PRODUCTS, migrated.products);
    if (Array.isArray(migrated.orders)) safeSave(STORAGE_KEYS.ORDERS, migrated.orders);
    if (Array.isArray(migrated.categories)) safeSave(STORAGE_KEYS.CATEGORIES, migrated.categories);
    if (Array.isArray(migrated.coupons)) safeSave(STORAGE_KEYS.COUPONS, migrated.coupons);
    if (Array.isArray(migrated.showcase)) safeSave(STORAGE_KEYS.SHOWCASE, migrated.showcase);
    if (migrated.settings) safeSave(STORAGE_KEYS.SETTINGS, migrated.settings);

    return true;
  },

  // Reset to initial demo data
  async resetDemoData() {
    // Take a safety snapshot
    try {
      const current = await this.exportData();
      localStorage.setItem(`stickify21_pre_reset_snapshot_${Date.now()}`, JSON.stringify(current));
    } catch(e) {}

    safeSave(STORAGE_KEYS.SCHEMA, CURRENT_SCHEMA_VERSION);
    safeSave(STORAGE_KEYS.PRODUCTS, SEED_PRODUCTS);
    safeSave(STORAGE_KEYS.CATEGORIES, SEED_CATEGORIES);
    safeSave(STORAGE_KEYS.COUPONS, SEED_COUPONS);
    safeSave(STORAGE_KEYS.SHOWCASE, SEED_SHOWCASE);
    safeSave(STORAGE_KEYS.ORDERS, []);
    safeSave(STORAGE_KEYS.SETTINGS, {
      brandName: CONFIG.BRAND_NAME,
      whatsappNumber: CONFIG.WHATSAPP_NUMBER,
      freeShippingThreshold: CONFIG.FREE_SHIPPING_THRESHOLD
    });
    return true;
  }
};
