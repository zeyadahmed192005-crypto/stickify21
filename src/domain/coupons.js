/**
 * STICKIFY 21 - Coupon Domain Engine
 */

/**
 * Validate and compute discount for a coupon
 * @param {string} codeEntered - Code typed by customer
 * @param {Array<Object>} availableCoupons - Coupons list from storage
 * @param {Object} cartContext - { subtotal, items: Array<{ category, price, quantity }> }
 * @returns {Object} Result { valid: boolean, error?: string, coupon?: Object, discountAmount: number }
 */
export function evaluateCoupon(codeEntered, availableCoupons = [], cartContext = { subtotal: 0, items: [] }) {
  if (!codeEntered || typeof codeEntered !== 'string') {
    return { valid: false, error: 'يرجى إدخال كود الخصم', discountAmount: 0 };
  }

  const cleanCode = codeEntered.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, error: 'يرجى إدخال كود الخصم', discountAmount: 0 };
  }

  // Lookup coupon case-insensitively
  const coupon = availableCoupons.find(c => (c.code || '').trim().toUpperCase() === cleanCode);
  if (!coupon || coupon.active === false) {
    return { valid: false, error: 'كود الخصم غير صحيح أو غير متاح حالياً', discountAmount: 0 };
  }

  const now = new Date();

  // Check Expiry Date
  if (coupon.expiryDate) {
    const expiry = new Date(coupon.expiryDate);
    // Set expiry to end of day if only date is provided
    if (coupon.expiryDate.length <= 10) {
      expiry.setHours(23, 59, 59, 999);
    }
    if (now > expiry) {
      return { valid: false, error: 'كود الخصم منتهي الصلاحية', discountAmount: 0 };
    }
  }

  // Check Usage Limit
  if (typeof coupon.usageLimit === 'number' && coupon.usageLimit > 0) {
    const currentUsage = Number(coupon.usageCount || 0);
    if (currentUsage >= coupon.usageLimit) {
      return { valid: false, error: 'تم استنفاد الحد الأقصى لاستخدام هذا الكود', discountAmount: 0 };
    }
  }

  // Check Min Order Subtotal
  const subtotal = Number(cartContext.subtotal || 0);
  if (typeof coupon.minOrder === 'number' && coupon.minOrder > 0) {
    if (subtotal < coupon.minOrder) {
      return { 
        valid: false, 
        error: `الحد الأدنى لتفعيل هذا الكود هو ${coupon.minOrder} ج.م (إجمالي سلتك الآن ${subtotal} ج.م)`, 
        discountAmount: 0 
      };
    }
  }

  // Check Valid Categories Restriction
  let eligibleSubtotal = subtotal;
  if (Array.isArray(coupon.validCategories) && coupon.validCategories.length > 0) {
    const eligibleItems = (cartContext.items || []).filter(item => {
      const cat = item.category || (item.type === 'bookmark' ? 'bookmarks' : 'stickers');
      return coupon.validCategories.includes(cat);
    });

    if (eligibleItems.length === 0) {
      return { 
        valid: false, 
        error: 'كود الخصم لا يسري على نوع المنتجات الموجودة في سلتك حالياً', 
        discountAmount: 0 
      };
    }

    eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || item.qty || 1)), 0);
  }

  // Calculate discount amount
  let discountAmount = 0;
  if (coupon.type === 'fixed' || coupon.discountFixed) {
    discountAmount = Number(coupon.discountFixed || coupon.value || 0);
  } else {
    // Default: percentage
    const percent = Number(coupon.discountPercent || coupon.discountRate || coupon.value || 0);
    discountAmount = Math.round((eligibleSubtotal * percent) / 100);
  }

  // Cap discount so total cannot be negative
  discountAmount = Math.max(0, Math.min(subtotal, discountAmount));

  return {
    valid: true,
    coupon: {
      code: coupon.code,
      type: coupon.type || 'percentage',
      value: coupon.discountPercent || coupon.discountFixed || coupon.value,
      desc: coupon.desc || ''
    },
    discountAmount
  };
}
