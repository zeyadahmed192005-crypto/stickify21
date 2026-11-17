/**
 * STICKIFY 21 - Data Migrations Engine
 */
import { CONFIG } from '../config/config.js';

export const CURRENT_SCHEMA_VERSION = CONFIG.SCHEMA_VERSION || '2.0.0';

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
    migrateProduct: (p) => p,
    migrateOrder: (o) => {
      // Normalize status
      let s = o.status || 'pending';
      if (s === 'جديد') s = 'pending';
      else if (s === 'بانتظار التأكيد') s = 'awaiting_confirmation';
      else if (s === 'مؤكد') s = 'confirmed';
      else if (s === 'قيد التجهيز') s = 'preparing';
      else if (s === 'تم التجهيز') s = 'ready';
      else if (s === 'تم الشحن') s = 'shipped';
      else if (s === 'مكتمل') s = 'completed';
      else if (s === 'ملغي') s = 'cancelled';

      // Composite lines
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
                finish: p.finish || 'matte',
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
            finish: it.finish || 'matte',
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
 * Check and apply migrations to a raw storage bundle
 * @param {Object} bundle - { schemaVersion, products, orders, categories, coupons, settings }
 * @returns {Object} Migrated bundle
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

  MIGRATIONS.forEach(m => {
    if (fromVersion < m.version) {
      if (Array.isArray(migrated.products)) {
        migrated.products = migrated.products.map(m.migrateProduct);
      }
      if (Array.isArray(migrated.orders)) {
        migrated.orders = migrated.orders.map(m.migrateOrder);
      }
      if (Array.isArray(migrated.coupons)) {
        migrated.coupons = migrated.coupons.map(m.migrateCoupon);
      }
    }
  });

  migrated.schemaVersion = CURRENT_SCHEMA_VERSION;
  return migrated;
}
