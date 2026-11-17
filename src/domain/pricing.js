/**
 * STICKIFY 21 - Domain Pricing & Cart Calculation Engine
 * Single Source of Truth for all prices, discounts, thresholds, and totals.
 */

import { CONFIG } from '../config/config.js';

/**
 * Calculates unit price for a given product and size.
 * @param {object} product
 * @param {string} sizeKey - 'small' | 'medium' | 'large' | 'standard'
 * @param {string} finish - 'glossy' | 'matte'
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
 * @param {string} finish - 'glossy' | 'matte'
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
    tierLabelEn: tier.labelEn || tier.labelAr,
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
 * Groups loose standard stickers into automatic packs (5-pack -20%, 10-pack -30%).
 * Bookmarks, explicit packs, and custom print items are excluded from auto-pack grouping.
 * @param {Array<object>} items - Raw cart items
 * @param {string} [strategy] - 'added_order' | 'highest_price' | 'lowest_price'
 * @returns {{ groupedLines: Array<object>, nudge: object|null, packSavings: number, rawSubtotal: number, looseStickerCount: number }}
 */
export function groupCartItemsIntoPacks(items = [], strategy = null) {
  const chosenStrategy = strategy || CONFIG.AUTO_PACK_STRATEGY || 'added_order';

  const nonStickerLines = [];
  const looseUnits = [];

  // 1. Separate loose standard stickers from bookmarks, packs, and custom prints
  items.forEach((item, originalIndex) => {
    const isBookmark = item.type === 'bookmark' || item.category === 'bookmarks' || (item.sku && String(item.sku).startsWith('BM-'));
    const isPack = item.type === 'pack';
    const isCustom = item.type === 'custom_print';

    if (isBookmark || isPack || isCustom) {
      nonStickerLines.push({
        ...item,
        originalIndex
      });
    } else {
      // Expand item quantity into individual sticker units
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      for (let q = 0; q < qty; q++) {
        looseUnits.push({
          id: item.id || generateCartLineKey(item),
          productId: item.productId || item.id,
          sku: item.sku,
          name: item.name,
          nameAr: item.nameAr,
          category: item.category,
          type: 'sticker',
          size: item.size || '8 سم (Medium)',
          sizeKey: item.sizeKey || 'medium',
          finish: item.finish || 'matte',
          price: Math.max(0, parseInt(item.price, 10) || 35),
          image: item.image,
          svg: item.svg,
          originalIndex
        });
      }
    }
  });

  // 2. Sort loose units if strategy requested
  const sortedUnits = [...looseUnits];
  if (chosenStrategy === 'lowest_price') {
    sortedUnits.sort((a, b) => a.price - b.price);
  } else if (chosenStrategy === 'highest_price') {
    sortedUnits.sort((a, b) => b.price - a.price);
  }
  // 'added_order' preserves addition sequence

  const pool = [...sortedUnits];
  const autoPackLines = [];
  let packSavings = 0;

  // 3. Extract 10-packs first (30% discount)
  while (pool.length >= 10) {
    const packUnits = pool.splice(0, 10);
    const rawTotal = packUnits.reduce((sum, u) => sum + u.price, 0);
    const discountedTotal = Math.round(rawTotal * (1 - (CONFIG.PACK_CONFIG[10]?.discountRate || 0.30)));
    const savings = Math.max(0, rawTotal - discountedTotal);
    packSavings += savings;

    autoPackLines.push({
      id: `auto-pack-10-${autoPackLines.length + 1}`,
      type: 'pack',
      autoPack: true,
      size: 10,
      packSize: 10,
      discountRate: CONFIG.PACK_CONFIG[10]?.discountRate || 0.30,
      nameAr: 'باقة توفير (10 استيكرات)',
      name: '10 Sticker Pack (-30%)',
      price: discountedTotal,
      packPrice: discountedTotal,
      rawTotal,
      savings,
      quantity: 1,
      items: packUnits
    });
  }

  // 4. Extract 5-pack if >= 5 remain (20% discount)
  if (pool.length >= 5) {
    const packUnits = pool.splice(0, 5);
    const rawTotal = packUnits.reduce((sum, u) => sum + u.price, 0);
    const discountedTotal = Math.round(rawTotal * (1 - (CONFIG.PACK_CONFIG[5]?.discountRate || 0.20)));
    const savings = Math.max(0, rawTotal - discountedTotal);
    packSavings += savings;

    autoPackLines.push({
      id: `auto-pack-5-${autoPackLines.length + 1}`,
      type: 'pack',
      autoPack: true,
      size: 5,
      packSize: 5,
      discountRate: CONFIG.PACK_CONFIG[5]?.discountRate || 0.20,
      nameAr: 'باقة توفير (5 استيكرات)',
      name: '5 Sticker Pack (-20%)',
      price: discountedTotal,
      packPrice: discountedTotal,
      rawTotal,
      savings,
      quantity: 1,
      items: packUnits
    });
  }

  // 5. Remaining loose units in pool are singles. Re-aggregate identical singles.
  const singleLines = [];
  pool.forEach(unit => {
    const key = `${unit.sku}_${unit.sizeKey}_${unit.finish}`;
    const existing = singleLines.find(s => `${s.sku}_${s.sizeKey}_${s.finish}` === key);
    if (existing) {
      existing.quantity += 1;
    } else {
      singleLines.push({
        ...unit,
        quantity: 1
      });
    }
  });

  // Calculate dynamic nudge message (R10)
  const totalLooseStickers = looseUnits.length;
  let nudge = null;
  if (totalLooseStickers > 0) {
    if (totalLooseStickers < 5) {
      const needed = 5 - totalLooseStickers;
      nudge = {
        neededCount: needed,
        targetDiscount: 20,
        message: `أضف ${needed} استيكر لتحصل على خصم باقة الـ 5 (20%)`,
        messageEn: `Add ${needed} more sticker${needed > 1 ? 's' : ''} to unlock the 5-Pack discount (20% off)`
      };
    } else if (totalLooseStickers < 10) {
      const needed = 10 - totalLooseStickers;
      nudge = {
        neededCount: needed,
        targetDiscount: 30,
        message: `أضف ${needed} استيكر لترقية الخصم إلى باقة الـ 10 (30%)`,
        messageEn: `Add ${needed} more sticker${needed > 1 ? 's' : ''} to upgrade to the 10-Pack discount (30% off)`
      };
    } else {
      const rem = totalLooseStickers % 10;
      if (rem > 0 && rem < 5) {
        const needed = 5 - rem;
        nudge = {
          neededCount: needed,
          targetDiscount: 20,
          message: `أضف ${needed} استيكر إضافي لتحصل على باقة 5 إضافية بخصم 20%`,
          messageEn: `Add ${needed} more sticker${needed > 1 ? 's' : ''} to unlock an extra 5-Pack (20% off)`
        };
      } else if (rem >= 5) {
        const needed = 10 - rem;
        nudge = {
          neededCount: needed,
          targetDiscount: 30,
          message: `أضف ${needed} استيكر إضافي لترقية الباقة الإضافية إلى باقة 10 بخصم 30%`,
          messageEn: `Add ${needed} more sticker${needed > 1 ? 's' : ''} to upgrade the extra pack to 10-Pack (30% off)`
        };
      }
    }
  }

  const groupedLines = [...autoPackLines, ...singleLines, ...nonStickerLines];

  return {
    groupedLines,
    nudge,
    packSavings,
    looseStickerCount: totalLooseStickers
  };
}

/**
 * Calculates comprehensive cart figures.
 * Free shipping is strictly evaluated on the post-discount subtotal.
 * @param {object} params
 * @param {Array<object>} params.items - Cart items
 * @param {object|null} params.coupon - Active coupon { code, discountPercent, discountFixed, type, minOrder }
 * @param {string|null} params.governorate - Selected Egyptian governorate
 * @param {string|null} [params.strategy] - Pack strategy
 * @returns {object} Cart calculation breakdown
 */
export function calculateCart({ items = [], coupon = null, governorate = null, strategy = null }) {
  const { groupedLines, nudge, packSavings, looseStickerCount } = groupCartItemsIntoPacks(items, strategy);

  const subtotal = groupedLines.reduce((sum, item) => {
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
    itemCount: items.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0),
    groupedLines,
    nudge,
    packSavings,
    looseStickerCount
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
