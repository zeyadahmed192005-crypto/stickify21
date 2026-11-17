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
  SITE_URL: 'https://stickify21.com',
  
  // Financial & Shipping
  CURRENCY: 'ج.م',
  FREE_SHIPPING_THRESHOLD: 200,
  FREE_SHIPPING_AFTER_DISCOUNT: true, // Ground truth: free shipping applies to the post-discount subtotal
  DEFAULT_SHIPPING: 35,
  
  // Schema
  SCHEMA_VERSION: '2.0.0',

  // Default Advertised Coupon
  ADVERTISED_COUPON: {
    code: 'STICKIFY10',
    discountPercent: 10
  },

  // Sticker Sizes System
  STICKER_SIZES: [
    { key: 'small', labelAr: '6 سم (Small)', labelEn: '6 cm (Small)', cm: '6cm', sizeCm: 6, badge: 'Small', priceOffset: -10, stageClass: 'w-24 h-24' },
    { key: 'medium', labelAr: '8 سم (Medium)', labelEn: '8 cm (Medium)', cm: '8cm', sizeCm: 8, badge: 'Medium', priceOffset: 0, stageClass: 'w-28 h-28' },
    { key: 'large', labelAr: '10 سم (Large)', labelEn: '10 cm (Large)', cm: '10cm', sizeCm: 10, badge: 'Large', priceOffset: 15, stageClass: 'w-36 h-36' }
  ],

  // Mockup Studio Devices Dimensions (Ground Truth for True-to-Scale calculations)
  MOCKUP_DEVICES: {
    laptop: { id: 'laptop', nameAr: 'لابتوب', nameEn: 'Laptop', realWidthCm: 30, realHeightCm: 21 },
    phone: { id: 'phone', nameAr: 'موبايل', nameEn: 'Phone', realWidthCm: 7.1, realHeightCm: 14.7 },
    bottle: { id: 'bottle', nameAr: 'زجاجة مياه', nameEn: 'Water Bottle', realWidthCm: 11.8, realHeightCm: 26 },
    notebook: { id: 'notebook', nameAr: 'كشكول ملاحظات', nameEn: 'Notebook', realWidthCm: 14.8, realHeightCm: 21 },
    book: { id: 'book', nameAr: 'كتاب / رواية', nameEn: 'Book', realWidthCm: 13, realHeightCm: 20 }
  },

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
    5: { discountRate: 0.20, labelAr: 'باقة 5 استيكرات (-20%)' },
    10: { discountRate: 0.30, labelAr: 'باقة 10 استيكرات (-30%)' }
  },
  AUTO_PACK_STRATEGY: 'added_order', // 'added_order' | 'highest_price' | 'lowest_price'

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
    ready: { key: 'ready', labelAr: 'تم التجهيز', badgeClass: 'bg-teal-100 text-teal-800 border-teal-200' },
    shipped: { key: 'shipped', labelAr: 'تم الشحن', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    completed: { key: 'completed', labelAr: 'مكتمل', badgeClass: 'bg-green-100 text-green-800 border-green-200' },
    cancelled: { key: 'cancelled', labelAr: 'ملغي', badgeClass: 'bg-red-100 text-red-800 border-red-200' }
  },

  // Valid status transitions
  ORDER_TRANSITIONS: {
    pending: ['awaiting_confirmation', 'confirmed', 'cancelled'],
    awaiting_confirmation: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['shipped', 'cancelled'],
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
    SESSION_TIMEOUT_MS: 12 * 60 * 60 * 1000 // 12 hours sliding expiry (R11)
  },

  // Payment Methods
  PAYMENT_METHODS: {
    cod: {
      id: 'cod',
      labelAr: 'الدفع عند الاستلام (COD)',
      icon: 'cash',
      instructions: 'الدفع نقداً للمندوب عند استلام الشحنة والتأكد من سلامتها.'
    },
    instapay: {
      id: 'instapay',
      labelAr: 'انستاباي (InstaPay)',
      icon: 'instapay',
      handle: 'stickify21@instapay',
      instructions: 'الدفع عبر تطبيق InstaPay المعتمد إلى المعرّف: stickify21@instapay (يرجى إرسال إشعار التحويل عبر واتساب).'
    },
    vodafone_cash: {
      id: 'vodafone_cash',
      labelAr: 'فودافون كاش (Vodafone Cash)',
      icon: 'vodafone',
      walletNumber: '01043546503',
      instructions: 'التحويل عبر محفظة فودافون كاش إلى الرقم: 01043546503 (يرجى إرسال لقطة شاشة للتحويل عبر واتساب).'
    }
  },

  // Configurable Payment Accounts (R12)
  PAYMENT_ACCOUNTS: [
    {
      id: 'acc-instapay-1',
      type: 'instapay',
      nameAr: 'إنستاباي الرسمي (InstaPay)',
      holder: 'STICKIFY 21',
      handle: 'stickify21@instapay',
      instructionsAr: 'تحويل عبر تطبيق إنستاباي للمعرف stickify21@instapay',
      active: true,
      order: 1
    },
    {
      id: 'acc-vodafone-1',
      type: 'vodafone_cash',
      nameAr: 'فودافون كاش كاشير (Vodafone Cash)',
      holder: 'أحمد STICKIFY',
      number: '01043546503',
      instructionsAr: 'تحويل كاش على الرقم 01043546503',
      active: true,
      order: 2
    },
    {
      id: 'acc-bank-1',
      type: 'bank',
      nameAr: 'البنك التجاري الدولي CIB',
      holder: 'شركة ستيكيفاي 21',
      iban: 'EG0000000000000000000000000',
      bankName: 'CIB Egypt',
      instructionsAr: 'تحويل بنكي / إيداع فوري لحساب CIB',
      active: false,
      order: 3
    }
  ],

  // Customizable WhatsApp Message Templates (A7)
  WHATSAPP_TEMPLATES: {
    new_order: 'مرحباً {name}\nشكراً لطلبك من STICKIFY 21\nتم استلام طلبك #{order} بنجاح.\nإجمالي الطلب: {total} ج.م\nسنقوم بتأكيد الطلب وتجهيزه فوراً.',
    ready: 'مرحباً {name}\nطلبك #{order} تم تجهيزه وتغليفه بنجاح وهو الآن بانتظار استلام المندوب.\nإجمالي المبلغ: {total} ج.م',
    shipped: 'مرحباً {name}\nتم شحن طلبك #{order} عبر {courier}!\nرقم البوليصة / التتبع: {tracking}\nالمبلغ المطلوب: {total} ج.م\nرابط التتبع: {tracking_url}'
  },

  // Custom Print Order Tiers
  CUSTOM_PRINT: {
    MIN_QUANTITY: 10,
    MAX_FILE_SIZE_MB: 10,
    TIERS: [
      { min: 10, max: 49, unitBase: 20, labelAr: '10–49 قطعة (السعر الأساسي)', labelEn: '10–49 pcs (Standard Rate)', discountPercent: 0 },
      { min: 50, max: 99, unitBase: 15, labelAr: '50–99 قطعة (وفر 25%)', labelEn: '50–99 pcs (Save 25%)', discountPercent: 25 },
      { min: 100, max: Infinity, unitBase: 10, labelAr: '100+ قطعة (وفر 50%)', labelEn: '100+ pcs (Save 50%)', discountPercent: 50 }
    ],
    FINISH_EXTRAS: {
      glossy: 0,
      matte: 0
    },
    SIZE_EXTRAS: {
      '6cm': 0,
      '8cm': 0,
      '10cm': 5,
      'custom': 5
    }
  },

  // Analytics Hooks Configuration (Hooks only; no real keys in prototype)
  ANALYTICS: {
    ENABLED: false,
    GA4_ID: null,       // e.g. 'G-XXXXXXXXXX'
    META_PIXEL_ID: null,// e.g. '1234567890'
    DEBUG: true
  }
};
