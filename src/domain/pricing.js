/**
 * STICKIFY 21 - Domain Pricing & Cart Calculation Engine
 * Single Source of Truth for all prices, discounts, thresholds, and totals.
 */

import { CONFIG } from '../config/config.js';

/**
 * Calculates unit price for a given product and size.
 * @param {object} product
 * @param {string} sizeKey - 'small' | 'medium' | 'large' | 'standard'
 * @param {string} finish - 'holographic' | 'glossy' | 'matte'
 * @returns {number} Integer price in EGP
 */
export function getProductPriceForSize(product, sizeKey = 'medium', finish = 'matte') {
  if (!product) return 0;
  if (product.category === 'bookmarks' || product.type === 'bookmark') {
    return Math.round(product.price || CONFIG.BOOKMARK_SPECS.defaultPrice);
  }

  const base = Math.round(product.price || 35);
  const sizeObj = CONFIG.STICKER_SIZES.find(s => s.key === sizeKey);
  const offset = sizeObj ? sizeObj.priceOffset : 0;
  
  return Math.max(15, base + offset);
}

/**
 * Calculates tiered pricing breakdown for custom print orders (min 10 pcs).
 * @param {number} quantity - Quantity of custom prints (min 10)
 * @param {string} sizeKey - '6cm' | '8cm' | '10cm' | 'custom'
 * @param {string} finish - 'glossy' | 'matte' | 'holographic'
 * @returns {object} Tier calculation details
 */
export function calculateCustomPrintSummary(quantity = 10, sizeKey = '8cm', finish = 'glossy') {
  const qty = Math.max(CONFIG.CUSTOM_PRINT.MIN_QUANTITY, parseInt(quantity, 10) || 10);
  const tier = CONFIG.CUSTOM_PRINT.TIERS.find(t => qty >= t.min && qty <= t.max) || CONFIG.CUSTOM_PRINT.TIERS[0];

  const finishExtra = CONFIG.CUSTOM_PRINT.FINISH_EXTRAS[finish] || 0;
  const sizeExtra = CONFIG.CUSTOM_PRINT.SIZE_EXTRAS[sizeKey] || 0;

  const unitPrice = tier.unitBase + finishExtra + sizeExtra;
  const baseUnitPrice = 20 + finishExtra + sizeExtra;
  const standardTotal = baseUnitPrice * qty;
  const total = unitPrice * qty;
  const savings = Math.max(0, standardTotal - total);

  return {
    quantity: qty,
    unitPrice,
    total,
    standardTotal,
    savings,
    tierLabel: tier.labelAr,
    discountPercent: tier.discountPercent
  };
}

/**
 * Calculates raw, discounted price and savings for a custom pack.
 * @param {Array<object>} items - Array of products in the pack
 * @param {number} targetSize - 5 or 10
 * @returns {{ rawTotal: number, discountedTotal: number, savings: number, discountRate: number }}
 */
export function calculatePackSummary(items, targetSize = 5) {
  const safeTarget = targetSize === 10 ? 10 : 5;
  const packConfig = CONFIG.PACK_CONFIG[safeTarget];
  const discountRate = packConfig.discountRate;

  const rawTotal = (items || []).reduce((sum, item) => {
    const p = item.price || 35;
    return sum + p;
  }, 0);

  const discountedTotal = Math.round(rawTotal * (1 - discountRate));
  const savings = Math.max(0, rawTotal - discountedTotal);

  return {
    rawTotal,
    discountedTotal,
    savings,
    discountRate
  };
}

/**
 * Calculates comprehensive cart figures.
 * Free shipping is strictly evaluated on the post-discount subtotal.
 * @param {object} params
 * @param {Array<object>} params.items - Cart items
 * @param {object|null} params.coupon - Active coupon { code, discountPercent, discountFixed, type, minOrder }
 * @param {string|null} params.governorate - Selected Egyptian governorate
 * @returns {object} Cart calculation breakdown
 */
export function calculateCart({ items = [], coupon = null, governorate = null }) {
  const subtotal = items.reduce((sum, item) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Math.max(0, parseInt(item.price, 10) || 0);
    return sum + (price * qty);
  }, 0);

  let discount = 0;
  let couponWarning = null;

  if (coupon && subtotal > 0) {
    const minOrder = coupon.minOrder || 0;
    if (subtotal < minOrder) {
      couponWarning = `كود الخصم يتطلب حداً أدنى للطلب ${minOrder} ج.م`;
    } else {
      if (coupon.type === 'fixed' || coupon.discountFixed) {
        discount = Math.round(Number(coupon.discountFixed || coupon.value || 0));
      } else {
        const pct = Math.min(100, Math.max(0, Number(coupon.discountPercent || coupon.value || 0)));
        discount = Math.round(subtotal * (pct / 100));
      }
      discount = Math.max(0, Math.min(discount, subtotal)); // Prevent negative total
    }
  }

  const postDiscountSubtotal = Math.max(0, subtotal - discount);

  // Free shipping rule: evaluated on post-discount subtotal
  let threshold = CONFIG.FREE_SHIPPING_THRESHOLD;
  let ratesMap = { ...CONFIG.SHIPPING_RATES };
  let defaultShipping = CONFIG.DEFAULT_SHIPPING;

  try {
    if (typeof localStorage !== 'undefined') {
      const rawSettings = localStorage.getItem('stickify21_settings');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed.freeShippingThreshold !== undefined) {
          threshold = Number(parsed.freeShippingThreshold);
        }
        if (parsed.shippingRates) {
          ratesMap = { ...ratesMap, ...parsed.shippingRates };
        }
        if (parsed.defaultShipping !== undefined) {
          defaultShipping = Number(parsed.defaultShipping);
        }
      }
    }
  } catch (e) {}

  const isFreeShipping = subtotal > 0 && postDiscountSubtotal >= threshold;
  const freeShippingRemaining = isFreeShipping ? 0 : Math.max(0, threshold - postDiscountSubtotal);
  const freeShippingProgress = threshold > 0 ? Math.min(100, Math.round((postDiscountSubtotal / threshold) * 100)) : 100;

  // Shipping rate lookup
  let shippingRate = defaultShipping;
  if (governorate) {
    // Lookup by exact name or in ratesMap or CONFIG.GOVERNORATES
    if (ratesMap[governorate] !== undefined) {
      shippingRate = ratesMap[governorate];
    } else {
      const govObj = CONFIG.GOVERNORATES.find(g => g.nameAr === governorate || g.id === governorate);
      if (govObj) {
        shippingRate = ratesMap[govObj.nameAr] !== undefined ? ratesMap[govObj.nameAr] : govObj.rate;
      }
    }
  }

  const shipping = subtotal === 0 ? 0 : (isFreeShipping ? 0 : shippingRate);
  const total = postDiscountSubtotal + shipping;

  return {
    subtotal,
    discount,
    postDiscountSubtotal,
    shipping,
    total,
    isFreeShipping,
    freeShippingRemaining,
    freeShippingProgress,
    couponWarning,
    itemCount: items.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0)
  };
}

/**
 * Generates a deterministic unique line key for merging cart items.
 * @param {object} item
 * @returns {string} Unique identifier for line merge
 */
export function generateCartLineKey(item) {
  if (item.type === 'pack') {
    const sortedIds = (item.itemIds || []).slice().sort().join(':');
    return `pack:${item.packSize || 5}:${item.sizeKey || 'medium'}:${sortedIds}`;
  }
  return `item:${item.productId}:${item.sizeKey || 'medium'}`;
}
