/**
 * STICKIFY 21 - Data Migrations Engine
 * Handles versioned upgrades, automatic pre-migration snapshots, emoji purge,
 * holographic removal (R3/P1-4), and migration report logging.
 */
import { CONFIG } from '../config/config.js';
import { stripEmoji } from '../utils/emoji.js';

export const CURRENT_SCHEMA_VERSION = CONFIG.SCHEMA_VERSION || '2.0.0';

const HOLO_AR_RE = /هولوجرام|هولوغرام/gi;
const HOLO_EN_RE = /\bholographic\b/gi;

function scrubTextField(value, { isEnglish = false, stats }) {
  if (typeof value !== 'string' || !value) return value;
  let out = value;
  const afterEmoji = stripEmoji(out);
  if (afterEmoji !== out) {
    stats.emojisStripped++;
    out = afterEmoji;
  }
  const hadHolo = HOLO_AR_RE.test(out) || HOLO_EN_RE.test(out);
  HOLO_AR_RE.lastIndex = 0;
  HOLO_EN_RE.lastIndex = 0;
  if (hadHolo) {
    stats.holographicCleaned++;
    out = out
      .replace(HOLO_AR_RE, isEnglish ? 'Glossy' : 'لامع')
      .replace(HOLO_EN_RE, isEnglish ? 'Glossy' : 'لامع')
      .replace(/(لامع)\s+\1/g, '$1')
      .replace(/(Glossy)\s+\1/gi, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return out;
}

function sanitizeProductRecord(p, stats) {
  if (!p || typeof p !== 'object') return p;
  let finish = p.finish || 'matte';
  if (typeof finish === 'string' && /holographic|هولوجرام|هولوغرام/i.test(finish)) {
    finish = 'glossy';
    stats.holographicCleaned++;
  }
  let finishes = Array.isArray(p.finishes) ? [...p.finishes] : ['matte', 'glossy'];
  const beforeLen = finishes.length;
  finishes = finishes.filter(f => !/holographic|هولوجرام|هولوغرام/i.test(String(f || '')));
  if (finishes.length !== beforeLen) stats.holographicCleaned++;
  if (!finishes.includes('glossy')) finishes.push('glossy');

  const tags = Array.isArray(p.tags)
    ? p.tags
        .map(t => scrubTextField(String(t || ''), { isEnglish: false, stats }))
        .filter(t => t && t !== 'لامع')
    : p.tags;

  return {
    ...p,
    name: scrubTextField(p.name, { isEnglish: true, stats }),
    nameAr: scrubTextField(p.nameAr, { isEnglish: false, stats }),
    nameEn: scrubTextField(p.nameEn, { isEnglish: true, stats }),
    desc: scrubTextField(p.desc, { isEnglish: false, stats }),
    descAr: scrubTextField(p.descAr, { isEnglish: false, stats }),
    descEn: scrubTextField(p.descEn, { isEnglish: true, stats }),
    badge: scrubTextField(p.badge, { isEnglish: false, stats }),
    badgeAr: scrubTextField(p.badgeAr, { isEnglish: false, stats }),
    badgeEn: scrubTextField(p.badgeEn, { isEnglish: true, stats }),
    finish,
    finishes,
    tags
  };
}

function sanitizeCategoryRecord(c, stats) {
  if (!c || typeof c !== 'object') return c;
  return {
    ...c,
    name: scrubTextField(c.name, { isEnglish: false, stats }),
    nameAr: scrubTextField(c.nameAr, { isEnglish: false, stats }),
    nameEn: scrubTextField(c.nameEn, { isEnglish: true, stats }),
    badge: scrubTextField(c.badge, { isEnglish: false, stats }),
    icon: scrubTextField(c.icon, { isEnglish: false, stats })
  };
}

function sanitizeCouponRecord(c, stats) {
  if (!c || typeof c !== 'object') return c;
  return {
    ...c,
    desc: scrubTextField(c.desc, { isEnglish: false, stats }),
    descAr: scrubTextField(c.descAr, { isEnglish: false, stats }),
    descEn: scrubTextField(c.descEn, { isEnglish: true, stats })
  };
}

function sanitizeShowcaseRecord(item, stats) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    caption: scrubTextField(item.caption, { isEnglish: false, stats }),
    captionAr: scrubTextField(item.captionAr, { isEnglish: false, stats }),
    captionEn: scrubTextField(item.captionEn, { isEnglish: true, stats })
  };
}

function sanitizeOrderLinesAndItems(o, stats) {
  if (!o || typeof o !== 'object') return o;
  const cleanItem = (it) => {
    if (!it || typeof it !== 'object') return it;
    let finish = it.finish || 'matte';
    if (typeof finish === 'string' && /holographic|هولوجرام|هولوغرام/i.test(finish)) {
      finish = 'glossy';
      stats.holographicCleaned++;
    }
    return {
      ...it,
      finish,
      name: scrubTextField(it.name, { isEnglish: false, stats }),
      nameAr: scrubTextField(it.nameAr, { isEnglish: false, stats }),
      nameEn: scrubTextField(it.nameEn, { isEnglish: true, stats }),
      items: Array.isArray(it.items) ? it.items.map(cleanItem) : it.items
    };
  };
  return {
    ...o,
    lines: Array.isArray(o.lines) ? o.lines.map(cleanItem) : o.lines,
    items: Array.isArray(o.items) ? o.items.map(cleanItem) : o.items
  };
}

/**
 * Migration registry
 */
const MIGRATIONS = [
  {
    version: '1.0.0',
    description: 'Initial structured schema with stockQuantity, inStock, and statusHistory',
    migrateProduct: (p) => ({
      ...p,
      inStock: p.inStock !== undefined ? p.inStock : true,
      stockQuantity: p.stockQuantity !== undefined ? p.stockQuantity : 50
    }),
    migrateOrder: (o) => ({
      ...o,
      status: o.status || 'pending',
      statusHistory: Array.isArray(o.statusHistory) && o.statusHistory.length > 0
        ? o.statusHistory
        : [{ status: o.status || 'pending', timestamp: o.date || new Date().toISOString(), note: 'تم الترحيل' }]
    }),
    migrateCoupon: (c) => ({
      ...c,
      active: c.active !== undefined ? c.active : true,
      usageCount: c.usageCount !== undefined ? c.usageCount : 0
    })
  },
  {
    version: '2.0.0',
    description: 'Round 2 schema with composite lines[], status ready, courier/tracking fields, and payment verification',
    migrateProduct: (p) => {
      const finish = p.finish === 'holographic' ? 'glossy' : (p.finish || 'matte');
      const finishes = Array.isArray(p.finishes)
        ? p.finishes.filter(f => f !== 'holographic')
        : ['matte', 'glossy'];
      if (!finishes.includes('glossy')) finishes.push('glossy');
      return {
        ...p,
        finish,
        finishes
      };
    },
    migrateOrder: (o) => {
      let s = o.status || 'pending';
      if (s === 'جديد') s = 'pending';
      else if (s === 'بانتظار التأكيد') s = 'awaiting_confirmation';
      else if (s === 'مؤكد') s = 'confirmed';
      else if (s === 'قيد التجهيز') s = 'preparing';
      else if (s === 'تم التجهيز') s = 'ready';
      else if (s === 'تم الشحن') s = 'shipped';
      else if (s === 'مكتمل') s = 'completed';
      else if (s === 'ملغي') s = 'cancelled';

      let lines = Array.isArray(o.lines) && o.lines.length > 0 ? o.lines : [];
      if (lines.length === 0 && Array.isArray(o.items)) {
        lines = o.items.map(it => {
          if (it.type === 'pack') {
            return {
              type: 'pack',
              size: it.packSize || it.size || (it.items ? it.items.length : 5),
              discountRate: it.discountRate || (it.packSize === 10 ? 0.3 : 0.2),
              packPrice: it.price || it.packPrice || 0,
              items: (it.items || []).map(p => ({
                sku: p.sku || 'S21',
                name: p.name || p.nameAr || '',
                sizeKey: p.sizeKey || 'medium',
                finish: p.finish === 'holographic' ? 'glossy' : (p.finish || 'matte'),
                unitPrice: p.unitPrice || p.price || 35,
                image: p.image || ''
              }))
            };
          }
          return {
            type: it.type === 'bookmark' ? 'bookmark' : 'single',
            sku: it.sku || 'S21',
            name: it.name || it.nameAr || '',
            sizeKey: it.sizeKey || 'medium',
            finish: it.finish === 'holographic' ? 'glossy' : (it.finish || 'matte'),
            unitPrice: it.price || 35,
            quantity: it.quantity || it.qty || 1,
            total: (it.price || 35) * (it.quantity || it.qty || 1),
            image: it.image || ''
          };
        });
      }

      return {
        ...o,
        status: s,
        lines,
        courier: o.courier || null,
        trackingNumber: o.trackingNumber || null,
        paymentVerified: Boolean(o.paymentVerified),
        statusHistory: Array.isArray(o.statusHistory) && o.statusHistory.length > 0
          ? o.statusHistory
          : [{ status: s, timestamp: o.date || new Date().toISOString(), note: 'ترحيل إلى الإصدار 2.0.0' }]
      };
    },
    migrateCoupon: (c) => c
  }
];

/**
 * Check, migrate, and sanitize a raw storage bundle (including imported JSON).
 * Always takes a snapshot before migrating and returns a detailed migrationReport.
 * @param {Object} bundle
 * @returns {Object} Migrated bundle with migrationReport
 */
export function migrateStorageBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') {
    return { schemaVersion: CURRENT_SCHEMA_VERSION };
  }

  // Pre-migration snapshot in localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`stickify21_migration_snapshot_${CURRENT_SCHEMA_VERSION}_${Date.now()}`, JSON.stringify(bundle));
    }
  } catch (e) {}

  const fromVersion = bundle.schemaVersion || '0.0.0';
  let migrated = { ...bundle };
  const stats = {
    timestamp: new Date().toISOString(),
    fromVersion,
    toVersion: CURRENT_SCHEMA_VERSION,
    emojisStripped: 0,
    holographicCleaned: 0,
    legacyOrdersNormalized: 0
  };

  // 1. Versioned schema migrations
  MIGRATIONS.forEach(m => {
    if (fromVersion < m.version) {
      if (Array.isArray(migrated.products)) {
        migrated.products = migrated.products.map(m.migrateProduct);
      }
      if (Array.isArray(migrated.orders)) {
        migrated.orders = migrated.orders.map(o => {
          stats.legacyOrdersNormalized++;
          return m.migrateOrder(o);
        });
      }
      if (Array.isArray(migrated.coupons)) {
        migrated.coupons = migrated.coupons.map(m.migrateCoupon);
      }
    }
  });

  // 2. Always run emoji + holographic cleanup pass (covers legacy upgrades AND v2 JSON imports)
  if (Array.isArray(migrated.products)) {
    migrated.products = migrated.products.map(p => sanitizeProductRecord(p, stats));
  }
  if (Array.isArray(migrated.categories)) {
    migrated.categories = migrated.categories.map(c => sanitizeCategoryRecord(c, stats));
  }
  if (Array.isArray(migrated.coupons)) {
    migrated.coupons = migrated.coupons.map(c => sanitizeCouponRecord(c, stats));
  }
  if (Array.isArray(migrated.showcase)) {
    migrated.showcase = migrated.showcase.map(s => sanitizeShowcaseRecord(s, stats));
  }
  if (Array.isArray(migrated.orders)) {
    migrated.orders = migrated.orders.map(o => sanitizeOrderLinesAndItems(o, stats));
  }

  migrated.schemaVersion = CURRENT_SCHEMA_VERSION;
  migrated.migrationReport = stats;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('stickify21_last_migration_report', JSON.stringify(stats));
    }
  } catch (e) {}

  return migrated;
}
