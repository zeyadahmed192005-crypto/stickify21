/**
 * STICKIFY 21 - Data Migrations Engine
 */
import { CONFIG } from '../config/config.js';

export const CURRENT_SCHEMA_VERSION = CONFIG.SCHEMA_VERSION || '1.0.0';

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
