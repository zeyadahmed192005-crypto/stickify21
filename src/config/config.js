/**
 * STICKIFY 21 - Global Configuration & Ground Truth
 */

export const CONFIG = {
  // Brand details
  BRAND_NAME: 'STICKIFY 21',
  BRAND_TAGLINE: 'استيكرات وفواصل كتب تعبر عن هويتك',
  BRAND_SLOGAN: 'STICK YOUR VIBE',
  
  // Contacts
  WHATSAPP_NUMBER: '201043546503',
  WHATSAPP_DISPLAY: '01043546503',
  
  // Financial & Shipping
  CURRENCY: 'ج.م',
  FREE_SHIPPING_THRESHOLD: 200,
  FREE_SHIPPING_AFTER_DISCOUNT: true, // Ground truth: free shipping applies to the post-discount subtotal
  DEFAULT_SHIPPING: 35,
  
  // Schema
  SCHEMA_VERSION: 1,

  // Default Advertised Coupon
  ADVERTISED_COUPON: {
    code: 'STICKIFY10',
    discountPercent: 10
  },

  // Sticker Sizes System
  STICKER_SIZES: [
    { key: 'small', labelAr: '6 سم (Small)', cm: '6cm', badge: 'Small', scale: 0.75, priceOffset: -10, stageClass: 'w-24 h-24' },
    { key: 'medium', labelAr: '8 سم (Medium)', cm: '8cm', badge: 'Medium', scale: 1.0, priceOffset: 0, stageClass: 'w-28 h-28' },
    { key: 'large', labelAr: '10 سم (Large)', cm: '10cm', badge: 'Large', scale: 1.35, priceOffset: 15, stageClass: 'w-36 h-36' }
  ],

  // Bookmark Specs
  BOOKMARK_SPECS: {
    dimensions: '15 × 5 سم',
    material: 'كرتون مقوى فاخر 350gsm',
    finish: 'سلوفان مطفي فاخر',
    defaultPrice: 25,
    stageClass: 'w-24 h-36'
  },

  // Pack builder discounts
  PACK_CONFIG: {
    5: { discountRate: 0.20, labelAr: 'باقة 5 استيكرات (-20% 🔥)' },
    10: { discountRate: 0.30, labelAr: 'باقة 10 استيكرات (-30% 👑)' }
  },

  // Shipping Rates by Egyptian Governorate (editable placeholder table)
  SHIPPING_RATES: {
    'القاهرة': 35,
    'الجيزة': 35,
    'الإسكندرية': 45,
    'الدقهلية / المنصورة': 50,
    'الغربية / طنطا': 50,
    'الشرقية': 50,
    'القليوبية': 40,
    'المنوفية': 50,
    'البحيرة': 50,
    'كفر الشيخ': 50,
    'دمياط': 50,
    'بورسعيد': 50,
    'الإسماعيلية': 50,
    'السويس': 50,
    'شمال سيناء': 75,
    'جنوب سيناء': 75,
    'البحر الأحمر': 75,
    'الفيوم': 55,
    'بني سويف': 55,
    'المنيا': 60,
    'أسيوط': 60,
    'سوهاج': 60,
    'قنا': 65,
    'الأقصر': 65,
    'أسوان': 70,
    'الوادي الجديد': 75,
    'مطروح': 75,
    'محافظة أخرى': 50
  }
};
