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
  SCHEMA_VERSION: '1.0.0',

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

  // 27 Official Egyptian Governorates and Shipping Rates
  GOVERNORATES: [
    { id: 'cairo', nameAr: 'القاهرة', rate: 35 },
    { id: 'giza', nameAr: 'الجيزة', rate: 35 },
    { id: 'qalyubia', nameAr: 'القليوبية', rate: 40 },
    { id: 'alexandria', nameAr: 'الإسكندرية', rate: 45 },
    { id: 'beheira', nameAr: 'البحيرة', rate: 50 },
    { id: 'matrouh', nameAr: 'مطروح', rate: 75 },
    { id: 'damietta', nameAr: 'دمياط', rate: 50 },
    { id: 'dakahlia', nameAr: 'الدقهلية', rate: 50 },
    { id: 'kafr_el_sheikh', nameAr: 'كفر الشيخ', rate: 50 },
    { id: 'gharbia', nameAr: 'الغربية', rate: 50 },
    { id: 'monufia', nameAr: 'المنوفية', rate: 50 },
    { id: 'sharqia', nameAr: 'الشرقية', rate: 50 },
    { id: 'port_said', nameAr: 'بورسعيد', rate: 50 },
    { id: 'ismailia', nameAr: 'الإسماعيلية', rate: 50 },
    { id: 'suez', nameAr: 'السويس', rate: 50 },
    { id: 'north_sinai', nameAr: 'شمال سيناء', rate: 75 },
    { id: 'south_sinai', nameAr: 'جنوب سيناء', rate: 75 },
    { id: 'fayoum', nameAr: 'الفيوم', rate: 55 },
    { id: 'beni_suef', nameAr: 'بني سويف', rate: 55 },
    { id: 'minya', nameAr: 'المنيا', rate: 60 },
    { id: 'asyut', nameAr: 'أسيوط', rate: 60 },
    { id: 'sohag', nameAr: 'سوهاج', rate: 60 },
    { id: 'qena', nameAr: 'قنا', rate: 65 },
    { id: 'luxor', nameAr: 'الأقصر', rate: 65 },
    { id: 'aswan', nameAr: 'أسوان', rate: 70 },
    { id: 'red_sea', nameAr: 'البحر الأحمر', rate: 75 },
    { id: 'new_valley', nameAr: 'الوادي الجديد', rate: 75 }
  ],

  // Backward-compatible shipping rate lookup map
  SHIPPING_RATES: {
    'القاهرة': 35,
    'الجيزة': 35,
    'القليوبية': 40,
    'الإسكندرية': 45,
    'البحيرة': 50,
    'مطروح': 75,
    'دمياط': 50,
    'الدقهلية': 50,
    'كفر الشيخ': 50,
    'الغربية': 50,
    'المنوفية': 50,
    'الشرقية': 50,
    'بورسعيد': 50,
    'الإسماعيلية': 50,
    'السويس': 50,
    'شمال سيناء': 75,
    'جنوب سيناء': 75,
    'الفيوم': 55,
    'بني سويف': 55,
    'المنيا': 60,
    'أسيوط': 60,
    'سوهاج': 60,
    'قنا': 65,
    'الأقصر': 65,
    'أسوان': 70,
    'البحر الأحمر': 75,
    'الوادي الجديد': 75,
    // Aliases for historical data
    'الدقهلية / المنصورة': 50,
    'الغربية / طنطا': 50,
    'محافظة أخرى': 50
  },

  // Order Lifecycle States & Arabic Labels
  ORDER_STATUSES: {
    pending: { key: 'pending', labelAr: 'جديد', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
    awaiting_confirmation: { key: 'awaiting_confirmation', labelAr: 'بانتظار التأكيد', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
    confirmed: { key: 'confirmed', labelAr: 'مؤكد', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    preparing: { key: 'preparing', labelAr: 'قيد التجهيز', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' },
    shipped: { key: 'shipped', labelAr: 'تم الشحن', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    completed: { key: 'completed', labelAr: 'مكتمل', badgeClass: 'bg-green-100 text-green-800 border-green-200' },
    cancelled: { key: 'cancelled', labelAr: 'ملغي', badgeClass: 'bg-red-100 text-red-800 border-red-200' }
  },

  // Valid status transitions
  ORDER_TRANSITIONS: {
    pending: ['awaiting_confirmation', 'confirmed', 'cancelled'],
    awaiting_confirmation: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['shipped', 'cancelled'],
    shipped: ['completed', 'cancelled'],
    completed: [],
    cancelled: []
  },

  // Admin Security Configuration
  AUTH: {
    SALT: 'stickify21_salt_2026',
    ITERATIONS: 100000,
    KEY_LENGTH: 32, // bytes
    MAX_ATTEMPTS: 5,
    LOCKOUT_MS: 15 * 60 * 1000, // 15 minutes
    SESSION_TIMEOUT_MS: 30 * 60 * 1000 // 30 minutes
  }
};
