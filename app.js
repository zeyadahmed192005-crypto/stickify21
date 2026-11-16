/**
 * STICKIFY21 - Minimalist Sticker & Bookmark Studio
 * WhatsApp: 01043546503 (201043546503)
 * Dynamic Sync with Admin Portal (admin.html)
 */

const WHATSAPP_NUMBER = '201043546503';

// Default Categories (Synchronized with admin.html)
const defaultCategories = [
  { id: 'bookmarks', nameAr: 'فواصل كتب', nameEn: 'Bookmarks', icon: '🔖', badge: 'جديد' },
  { id: 'tech', nameAr: 'برمجة وتِك', nameEn: 'Coding', icon: '💻' },
  { id: 'arabic', nameAr: 'عربي وميمز', nameEn: 'Quotes', icon: '⚡' },
  { id: 'faculties', nameAr: 'كليات ودراسة', nameEn: 'Faculties', icon: '📐' },
  { id: 'anime', nameAr: 'أنمي ومانجا', nameEn: 'Anime', icon: '🍖' },
  { id: 'gaming', nameAr: 'جيمنج وألعاب', nameEn: 'Gaming', icon: '🎮' },
  { id: 'gym', nameAr: 'جيم وفورمة', nameEn: 'Fitness', icon: '💪' },
  { id: 'brand', nameAr: 'شعار البراند', nameEn: 'Brand', icon: '🍊', image: 'logo.jpg' }
];

// Default Coupons
const defaultCoupons = [
  { code: 'STICKIFY10', discountPercent: 10 },
  { code: 'STICKIFY21', discountPercent: 21 }
];

// Fallback initial products
const initialProducts = [
  {
    id: 'stk-logo',
    sku: 'S21-01',
    name: 'STICKIFY 21 Official Logo',
    nameAr: 'شعار STICKIFY 21 الرسمي 🍊',
    category: 'brand',
    subCategory: 'brand-all',
    type: 'sticker',
    price: 30,
    finish: 'holographic',
    badge: 'شعار البراند',
    desc: 'لوجو STICKIFY21 الأصلي بقص Die-cut دقيق وطبقة حماية ضد المياه والحرارة.',
    image: 'logo.jpg',
    dateAdded: 15
  },
  {
    id: 'bm-1',
    sku: 'BM-01',
    name: 'Classic Literature Bookmark',
    nameAr: 'فاصل كتب: خير جليس في الزمان كتاب 📖',
    category: 'bookmarks',
    subCategory: 'bookmarks-quotes',
    type: 'bookmark',
    price: 25,
    finish: 'matte',
    badge: 'بوك مارك فاخر 🔖',
    desc: 'فاصل كتب كرتون مقوى 350gsm بطبقة سلوفان مطفي فاخر مع شريطة أنيقة.',
    svg: `<svg viewBox="0 0 100 200" class="w-full h-full"><rect x="10" y="10" width="80" height="180" rx="8" fill="#18181B" stroke="#FF5000" stroke-width="3"/><circle cx="50" cy="25" r="4" fill="#FF5000"/><line x1="20" y1="45" x2="80" y2="45" stroke="#E4E4E7" stroke-width="1"/><text x="50" y="85" font-family="'Readex Pro'" font-weight="700" font-size="12" fill="#FFFFFF" text-anchor="middle">خَيْرُ جَلِيسٍ</text><text x="50" y="105" font-family="'Readex Pro'" font-weight="700" font-size="12" fill="#FF5000" text-anchor="middle">فِي الزَّمَانِ</text><text x="50" y="125" font-family="'Readex Pro'" font-weight="800" font-size="14" fill="#FFFFFF" text-anchor="middle">كِتَابُ</text><circle cx="50" cy="155" r="14" fill="#27272A"/><text x="50" y="160" font-size="14" text-anchor="middle">📚</text></svg>`,
    dateAdded: 14
  },
  {
    id: 'bm-2',
    sku: 'BM-02',
    name: 'Om Kalthoum Vintage Bookmark',
    nameAr: 'فاصل كتب: لسّة فاكر - أم كلثوم 🎙️',
    category: 'bookmarks',
    subCategory: 'bookmarks-vintage',
    type: 'bookmark',
    price: 25,
    finish: 'matte',
    badge: 'طرب وروايات 🔖',
    desc: 'تصميم فينتدج راقي لكوكب الشرق، رفيق مثالي لجلسات القراءة مع فنجان الشاي.',
    svg: `<svg viewBox="0 0 100 200" class="w-full h-full"><rect x="10" y="10" width="80" height="180" rx="8" fill="#FDFBF7" stroke="#0E0E10" stroke-width="3"/><circle cx="50" cy="24" r="4" fill="#0E0E10"/><ellipse cx="40" cy="65" rx="12" ry="8" fill="#0E0E10"/><ellipse cx="60" cy="65" rx="12" ry="8" fill="#0E0E10"/><line x1="48" y1="65" x2="52" y2="65" stroke="#0E0E10" stroke-width="2"/><line x1="20" y1="90" x2="80" y2="90" stroke="#FF5000" stroke-width="2"/><text x="50" y="115" font-family="'Readex Pro'" font-weight="700" font-size="11" fill="#0E0E10" text-anchor="middle">لسّة فاكر</text><text x="50" y="132" font-family="'Readex Pro'" font-weight="600" font-size="10" fill="#71717A" text-anchor="middle">كان زمان</text><text x="50" y="170" font-family="'Space Grotesk'" font-weight="800" font-size="10" fill="#FF5000" text-anchor="middle">S21 BOOKS</text></svg>`,
    dateAdded: 13
  },
  {
    id: 'bm-3',
    sku: 'BM-03',
    name: 'Coffee & Late Night Reading Bookmark',
    nameAr: 'فاصل كتب: قهوة ورواية هادئة ☕',
    category: 'bookmarks',
    subCategory: 'bookmarks-aesthetic',
    type: 'bookmark',
    price: 25,
    finish: 'matte',
    badge: 'عشاق القراءة 🔖',
    desc: 'ألوان ترابية هادئة وطباعة عالية الوضوح تدوم لسنوات بين صفحات كتبك المفضلة.',
    svg: `<svg viewBox="0 0 100 200" class="w-full h-full"><rect x="10" y="10" width="80" height="180" rx="8" fill="#0E0E10" stroke="#E4E4E7" stroke-width="2"/><circle cx="50" cy="25" r="4" fill="#FF5000"/><text x="50" y="65" font-size="24" text-anchor="middle">☕</text><text x="50" y="95" font-family="'Readex Pro'" font-weight="700" font-size="11" fill="#FFFFFF" text-anchor="middle">صفحة كمان</text><text x="50" y="112" font-family="'Readex Pro'" font-weight="600" font-size="10" fill="#FF5000" text-anchor="middle">وهنام خلاص!</text><rect x="25" y="130" width="50" height="4" rx="2" fill="#27272A"/><rect x="35" y="140" width="30" height="4" rx="2" fill="#27272A"/><text x="50" y="172" font-family="'Space Grotesk'" font-weight="700" font-size="9" fill="#71717A" text-anchor="middle">CHAPTER NEXT</text></svg>`,
    dateAdded: 12
  },
  {
    id: 'bm-4',
    sku: 'BM-04',
    name: 'One Piece Luffy Strawhat Bookmark',
    nameAr: 'فاصل كتب: ون بيس - قبعة القش 🍖',
    category: 'bookmarks',
    subCategory: 'bookmarks-anime',
    type: 'bookmark',
    price: 25,
    finish: 'glossy',
    badge: 'أنمي 🔖',
    desc: 'فاصل كتب كارتون مقوى لشعار طاقم قبعة القش مع طبقة حماية ضد الخدش.',
    svg: `<svg viewBox="0 0 100 200" class="w-full h-full"><rect x="10" y="10" width="80" height="180" rx="8" fill="#18181B" stroke="#FF5000" stroke-width="3"/><ellipse cx="50" cy="55" rx="30" ry="8" fill="#FFC107"/><circle cx="50" cy="80" r="16" fill="#FFFFFF"/><circle cx="45" cy="78" r="3" fill="#000000"/><circle cx="55" cy="78" r="3" fill="#000000"/><text x="50" y="125" font-family="'Space Grotesk'" font-weight="900" font-size="12" fill="#FF5000" text-anchor="middle">STRAW HAT</text><text x="50" y="145" font-family="'Readex Pro'" font-weight="700" font-size="10" fill="#FFFFFF" text-anchor="middle">ملك القراصنة</text><text x="50" y="175" font-family="'Space Grotesk'" font-weight="700" font-size="9" fill="#71717A" text-anchor="middle">ONE PIECE</text></svg>`,
    dateAdded: 11
  },
  {
    id: 'stk-1',
    sku: 'DEV-01',
    name: 'Git Push --Force',
    nameAr: 'جيت بوش بالقوة 🚀',
    category: 'tech',
    subCategory: 'coding',
    type: 'sticker',
    price: 35,
    finish: 'holographic',
    badge: 'الأكثر طلباً',
    desc: 'للمبرمجين الشجعان. تصميم بخط مينيمال حاد وألوان عالية التباين.',
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="15" y="15" width="130" height="130" rx="26" fill="#0E0E10" stroke="#FF5000" stroke-width="4"/><circle cx="80" cy="52" r="13" fill="#FF5000"/><circle cx="52" cy="108" r="13" fill="#FFFFFF"/><circle cx="108" cy="108" r="13" fill="#FFFFFF"/><path d="M80 65 L52 95 M80 65 L108 95" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/><text x="80" y="140" font-family="'Space Grotesk', monospace" font-weight="800" font-size="12" fill="#FF5000" text-anchor="middle">GIT --FORCE</text></svg>`,
    dateAdded: 9
  },
  {
    id: 'stk-3',
    sku: 'DEV-02',
    name: '404 Sleep Not Found',
    nameAr: '404 لا يوجد نوم ☕',
    category: 'tech',
    subCategory: 'coding',
    type: 'sticker',
    price: 35,
    finish: 'matte',
    badge: 'سهرانين',
    desc: 'مخصص لكل مبرمج ومصمم ومهندس سهران للفجر.',
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="18" y="24" width="124" height="112" rx="18" fill="#18181B" stroke="#0E0E10" stroke-width="3"/><text x="80" y="74" font-family="'Space Grotesk', sans-serif" font-weight="800" font-size="36" fill="#FF5000" text-anchor="middle">404</text><text x="80" y="104" font-family="'Readex Pro', sans-serif" font-weight="600" font-size="13" fill="#FFFFFF" text-anchor="middle">SLEEP NOT FOUND</text></svg>`,
    dateAdded: 8
  },
  {
    id: 'stk-2',
    sku: 'ARB-01',
    name: 'فكّك - FAKKEK',
    nameAr: 'استيكر فكّك ⚡',
    category: 'arabic',
    subCategory: 'memes',
    type: 'sticker',
    price: 30,
    finish: 'glossy',
    badge: 'تريند مصري',
    desc: 'روقان مصري خالص يطرد أي ضغط أو طاقة سلبية.',
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="15" y="30" width="130" height="100" rx="22" fill="#FFFFFF" stroke="#0E0E10" stroke-width="5"/><text x="80" y="85" font-family="'Readex Pro', sans-serif" font-weight="800" font-size="34" fill="#0E0E10" text-anchor="middle">فَكّـكْ</text><line x1="45" y1="98" x2="115" y2="98" stroke="#FF5000" stroke-width="5" stroke-linecap="round"/><text x="80" y="118" font-family="'Plus Jakarta Sans', sans-serif" font-weight="700" font-size="10" fill="#71717A" text-anchor="middle" letter-spacing="2">LET IT GO</text></svg>`,
    dateAdded: 7
  },
  {
    id: 'stk-5',
    sku: 'ARB-02',
    name: 'سيبها لله وتوكل',
    nameAr: 'سيبها لله وتوكل 🤍',
    category: 'arabic',
    subCategory: 'quotes',
    type: 'sticker',
    price: 30,
    finish: 'matte',
    badge: 'طمأنينة',
    desc: 'خط عربي كاليجرافي أنيق وبسيط يعطيك سكينة وتركيز.',
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><circle cx="80" cy="80" r="66" fill="#FFFFFF" stroke="#0E0E10" stroke-width="5"/><circle cx="80" cy="80" r="56" fill="none" stroke="#FF5000" stroke-width="2" stroke-dasharray="3 3"/><text x="80" y="76" font-family="'Readex Pro', sans-serif" font-weight="700" font-size="20" fill="#0E0E10" text-anchor="middle">سِيبْهَا لِله</text><text x="80" y="104" font-family="'Readex Pro', sans-serif" font-weight="600" font-size="13" fill="#FF5000" text-anchor="middle">وَتَوَكَّلْ</text></svg>`,
    dateAdded: 6
  },
  {
    id: 'stk-eng',
    sku: 'FAC-01',
    name: 'Engineering Survival',
    nameAr: 'باشمهندس تحت الإنشاء 📐',
    category: 'faculties',
    subCategory: 'engineering',
    type: 'sticker',
    price: 35,
    finish: 'matte',
    badge: 'كليات',
    desc: 'لكل طلاب وخريجي هندسة اللي شغالين بمبدأ سيبها على الله.',
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="20" y="20" width="120" height="120" rx="24" fill="#FFFFFF" stroke="#0E0E10" stroke-width="5"/><path d="M 80 40 L 50 110 M 80 40 L 110 110 M 60 90 L 100 90" stroke="#0E0E10" stroke-width="6" stroke-linecap="round"/><circle cx="80" cy="40" r="7" fill="#FF5000"/><text x="80" y="132" font-family="'Readex Pro'" font-weight="700" font-size="12" fill="#FF5000" text-anchor="middle">هندسة</text></svg>`,
    dateAdded: 5
  },
  {
    id: 'stk-med',
    sku: 'FAC-02',
    name: 'Doctor in Progress',
    nameAr: 'دكتور قريباً - سماعة وطب 🩺',
    category: 'faculties',
    subCategory: 'medicine',
    type: 'sticker',
    price: 35,
    finish: 'glossy',
    badge: 'طب وبشري',
    desc: 'استيكر مميز لسماعة الطبيب ومج الروتين اليومي في المستشفى.',
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><circle cx="80" cy="80" r="64" fill="#0E0E10" stroke="#FF5000" stroke-width="4"/><path d="M 55 45 L 55 75 Q 80 110 105 75 L 105 45" stroke="#FFFFFF" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="80" cy="115" r="9" fill="#FF5000"/><line x1="80" y1="95" x2="80" y2="106" stroke="#FFFFFF" stroke-width="5"/><text x="80" y="70" font-family="'Readex Pro'" font-weight="800" font-size="16" fill="#FFFFFF" text-anchor="middle">DR</text></svg>`,
    dateAdded: 4
  },
  {
    id: 'stk-6',
    sku: 'ANM-01',
    name: 'Luffy Strawhat Minimal',
    nameAr: 'طاقم ون بيس - لوفي 🍖',
    category: 'anime',
    subCategory: 'one-piece',
    type: 'sticker',
    price: 35,
    finish: 'glossy',
    badge: 'أنمي',
    desc: 'شعار طاقم قبعة القش بتصميم مينيمال عالي التباين.',
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><ellipse cx="80" cy="50" rx="52" ry="14" fill="#FFC107" stroke="#0E0E10" stroke-width="3"/><path d="M 54 50 Q 80 24 106 50 Z" fill="#FFC107" stroke="#0E0E10" stroke-width="3"/><path d="M 54 48 Q 80 38 106 48" stroke="#FF5000" stroke-width="6"/><circle cx="80" cy="88" r="28" fill="#FFFFFF" stroke="#0E0E10" stroke-width="4"/><circle cx="71" cy="86" r="6" fill="#0E0E10"/><circle cx="89" cy="86" r="6" fill="#0E0E10"/><path d="M 70 102 Q 80 110 90 102" stroke="#0E0E10" stroke-width="3" fill="none"/></svg>`,
    dateAdded: 3
  },
  {
    id: 'stk-8',
    sku: 'GAM-01',
    name: 'Retro Game Controller',
    nameAr: 'يد تحكم كلاسيكية 🎮',
    category: 'gaming',
    subCategory: 'retro',
    type: 'sticker',
    price: 35,
    finish: 'glossy',
    badge: 'جيمنج',
    desc: 'لعشاق الألعاب الكلاسيكية وعصر الروقان.',
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="22" y="44" width="116" height="72" rx="20" fill="#F4F4F5" stroke="#0E0E10" stroke-width="5"/><rect x="42" y="74" width="22" height="7" fill="#0E0E10"/><rect x="49" y="67" width="7" height="22" fill="#0E0E10"/><circle cx="106" cy="74" r="7" fill="#FF5000"/><circle cx="94" cy="85" r="7" fill="#0E0E10"/></svg>`,
    dateAdded: 2
  },
  {
    id: 'stk-7',
    sku: 'GYM-01',
    name: 'Heavy Weights & Discipline',
    nameAr: 'جيم وانضباط 🏋️',
    category: 'gym',
    subCategory: 'fitness',
    type: 'sticker',
    price: 35,
    finish: 'matte',
    badge: 'فورمة',
    desc: 'استيكر مميز للشيكر والشنطة يذكرك يومياً بالانضباط.',
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="18" y="22" width="124" height="116" rx="20" fill="#0E0E10" stroke="#FF5000" stroke-width="4"/><rect x="25" y="74" width="110" height="12" fill="#E4E4E7"/><rect x="38" y="55" width="14" height="50" rx="3" fill="#FF5000"/><rect x="108" y="55" width="14" height="50" rx="3" fill="#FF5000"/><text x="80" y="122" font-family="'Space Grotesk', sans-serif" font-weight="800" font-size="12" fill="#FFFFFF" text-anchor="middle">DISCIPLINE</text></svg>`,
    dateAdded: 1
  }
];

// Sticker Sizes System (6cm Small, 8cm Medium, 10cm Large)
const STICKER_SIZES = [
  { key: 'small', labelAr: '6 سم (Small)', cm: '6cm', badge: 'Small', scale: 0.75, offset: -10 },
  { key: 'medium', labelAr: '8 سم (Medium)', cm: '8cm', badge: 'Medium', scale: 1.0, offset: 0 },
  { key: 'large', labelAr: '10 سم (Large)', cm: '10cm', badge: 'Large', scale: 1.35, offset: 15 }
];

function getProductPriceForSize(product, sizeKey = 'medium') {
  if (product.category === 'bookmarks' || product.type === 'bookmark') {
    return product.price || 25;
  }
  const base = product.price || 35;
  if (sizeKey === 'small') return Math.max(20, base - 10);
  if (sizeKey === 'large') return base + 15;
  return base;
}

const state = {
  categories: [],
  products: [],
  cart: JSON.parse(localStorage.getItem('stickify21_cart') || '[]'),
  selectedSizes: {}, // { [productId]: 'small' | 'medium' | 'large' }
  selectedCategory: 'all',
  selectedSubCategory: 'all',
  sortBy: 'featured',
  searchQuery: '',
  activeFinish: 'all',
  activeDevice: 'laptop',
  placedStickers: [],
  selectedPlacedId: null,
  packBuilder: {
    targetSize: 5,
    items: []
  },
  coupon: {
    code: '',
    discountPercent: 0
  }
};

const devices = {
  laptop: {
    id: 'laptop',
    name: 'لابتوب (MacBook)',
    aspectRatio: '16/10',
    frameClass: 'mockup-laptop-realistic relative flex items-center justify-center p-6 min-h-[380px] w-full max-w-xl mx-auto overflow-hidden select-none',
    decorationsHtml: `
      <!-- MacBook Display Notch & Hinge Lines -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-2 bg-[#121315] rounded-b-lg pointer-events-none opacity-80"></div>
      <div class="absolute bottom-0 left-10 right-10 h-1.5 bg-[#121315] rounded-t-sm pointer-events-none opacity-80"></div>
      <!-- Polished Chrome Apple Logo -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-25">
        <svg class="w-16 h-16 drop-shadow-[0_1px_2px_rgba(255,255,255,0.2)]" viewBox="0 0 170 170" fill="#CBD5E1">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.77-11.7-14.19-5.76-8.91-10.37-18.81-13.84-29.7-3.48-10.89-5.21-21.36-5.21-31.41 0-14.35 3.69-26.24 11.07-35.68 7.38-9.44 16.58-14.28 27.6-14.53 4.58 0 9.87 1.25 15.87 3.75 6 2.5 10.15 3.81 12.44 3.93 2.18-.12 6.44-1.46 12.79-4.04 6.35-2.58 11.75-3.75 16.2-3.53 12.28.62 22.37 5.37 30.26 14.25-10.76 6.53-16.03 15.54-15.82 27.05.22 9.02 3.69 16.64 10.42 22.86 6.73 6.22 14.53 9.77 23.4 10.66-2.5 7.64-5.59 15.22-9.28 22.75zM119.22 33.04c0-7.19 2.61-13.92 7.83-20.19 5.22-6.27 11.59-10.39 19.11-12.35.76 7.4-1.74 14.33-7.5 20.79-5.76 6.46-12.24 10.59-19.44 11.75z"/>
        </svg>
      </div>
      <!-- Subtle Space Gray Metal Specular Sheen -->
      <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none"></div>
    `
  },
  phone: {
    id: 'phone',
    name: 'موبايل (iPhone)',
    aspectRatio: '9/19',
    frameClass: 'mockup-phone-realistic relative flex items-center justify-center p-6 min-h-[420px] max-w-[240px] mx-auto overflow-hidden select-none',
    decorationsHtml: `
      <!-- iPhone 15/16 Pro Triple Camera Island Plateau -->
      <div class="absolute top-4 left-4 w-24 h-24 rounded-3xl bg-[#202226] border border-[#3A3D44] shadow-lg p-2.5 pointer-events-none flex flex-col justify-between">
        <div class="flex justify-between items-center">
          <div class="w-8 h-8 rounded-full bg-[#08080A] border-2 border-[#525661] flex items-center justify-center shadow-inner">
            <div class="w-4 h-4 rounded-full bg-[#181926] border border-[#2D3340]"></div>
          </div>
          <div class="w-8 h-8 rounded-full bg-[#08080A] border-2 border-[#525661] flex items-center justify-center shadow-inner">
            <div class="w-4 h-4 rounded-full bg-[#181926] border border-[#2D3340]"></div>
          </div>
        </div>
        <div class="flex justify-between items-center">
          <div class="w-8 h-8 rounded-full bg-[#08080A] border-2 border-[#525661] flex items-center justify-center shadow-inner">
            <div class="w-4 h-4 rounded-full bg-[#181926] border border-[#2D3340]"></div>
          </div>
          <div class="flex flex-col items-center gap-1.5 pr-1">
            <div class="w-3 h-3 rounded-full bg-[#FFE8C2] border border-[#C29B53] shadow"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-[#0D0E10] border border-[#222]"></div>
          </div>
        </div>
      </div>
      <!-- Apple Logo -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
        <svg class="w-12 h-12" viewBox="0 0 170 170" fill="#E2E8F0">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.77-11.7-14.19-5.76-8.91-10.37-18.81-13.84-29.7-3.48-10.89-5.21-21.36-5.21-31.41 0-14.35 3.69-26.24 11.07-35.68 7.38-9.44 16.58-14.28 27.6-14.53 4.58 0 9.87 1.25 15.87 3.75 6 2.5 10.15 3.81 12.44 3.93 2.18-.12 6.44-1.46 12.79-4.04 6.35-2.58 11.75-3.75 16.2-3.53 12.28.62 22.37 5.37 30.26 14.25-10.76 6.53-16.03 15.54-15.82 27.05.22 9.02 3.69 16.64 10.42 22.86 6.73 6.22 14.53 9.77 23.4 10.66-2.5 7.64-5.59 15.22-9.28 22.75zM119.22 33.04c0-7.19 2.61-13.92 7.83-20.19 5.22-6.27 11.59-10.39 19.11-12.35.76 7.4-1.74 14.33-7.5 20.79-5.76 6.46-12.24 10.59-19.44 11.75z"/>
        </svg>
      </div>
    `
  },
  bottle: {
    id: 'bottle',
    name: 'زجاجة ماء (Tumbler)',
    aspectRatio: '1/2.5',
    frameClass: 'mockup-bottle-realistic relative flex items-center justify-center p-6 min-h-[420px] max-w-[210px] mx-auto overflow-hidden select-none',
    decorationsHtml: `
      <!-- Tumbler Stainless Cap & Loop Handle -->
      <div class="absolute -top-6 left-1/2 -translate-x-1/2 w-28 h-9 rounded-t-2xl bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-700 border-t-2 border-zinc-200 shadow-md pointer-events-none flex items-center justify-center">
        <div class="w-14 h-3 rounded-full border-2 border-zinc-800 bg-zinc-900 shadow-inner"></div>
      </div>
      <div class="absolute top-3 left-0 right-0 h-1 bg-zinc-600/50 pointer-events-none"></div>
      <!-- Cylindrical Center Reflection Highlight -->
      <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"></div>
      <!-- Bottom Boot Rim -->
      <div class="absolute bottom-0 left-0 right-0 h-6 bg-zinc-950/70 border-t border-zinc-700/50 pointer-events-none"></div>
    `
  },
  book: {
    id: 'book',
    name: 'كتاب / رواية (Book)',
    aspectRatio: '4/5',
    frameClass: 'mockup-book-realistic relative flex items-center justify-center p-6 min-h-[400px] max-w-[290px] mx-auto select-none',
    decorationsHtml: `
      <!-- Hardcover Gilded Borders & Silk Ribbon -->
      <div class="absolute inset-4 rounded-lg border border-[#D4AF37]/35 pointer-events-none flex flex-col justify-between p-4">
        <div class="text-center font-mono text-[9px] tracking-widest text-[#D4AF37]/60">STICKIFY 21 LIMITED EDITION</div>
        <div class="text-center font-mono text-[9px] text-[#D4AF37]/40 tracking-wider">★ NOVEL & LITERATURE ★</div>
      </div>
      <!-- Silk Ribbon Bookmark hanging from top -->
      <div class="absolute -top-3 right-10 w-3.5 h-14 bg-[#FF5000] rounded-b-md shadow-md pointer-events-none transform -rotate-2"></div>
      <!-- Stacked Pages Edge Texture on Right -->
      <div class="absolute top-2 bottom-2 -right-2.5 w-2.5 bg-gradient-to-b from-[#F3EEEA] via-[#E8E2DC] to-[#DDD6CE] rounded-r-sm shadow-md border-r border-[#C9C0B7] pointer-events-none"></div>
    `
  },
  notebook: {
    id: 'notebook',
    name: 'كشكول ملاحظات',
    aspectRatio: '3/4',
    frameClass: 'mockup-notebook-realistic relative flex items-center justify-center p-6 min-h-[380px] max-w-[280px] mx-auto select-none',
    decorationsHtml: `
      <!-- Metallic Twin Wire Spiral Binding on Spine -->
      <div class="absolute -left-3 top-4 bottom-4 w-4 flex flex-col justify-between pointer-events-none z-20">
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
      </div>
      <!-- Elastic Closure Strap on Right -->
      <div class="absolute top-0 bottom-0 right-6 w-3 bg-[#18181B] rounded shadow pointer-events-none opacity-80"></div>
    `
  }
};

function initApp() {
  // Sync categories with Admin localStorage
  const storedCats = localStorage.getItem('stickify21_categories');
  if (storedCats) {
    try {
      state.categories = JSON.parse(storedCats);
    } catch(e) {
      state.categories = [...defaultCategories];
    }
  } else {
    state.categories = [...defaultCategories];
    localStorage.setItem('stickify21_categories', JSON.stringify(state.categories));
  }

  // Sync products with Admin localStorage
  const storedProds = localStorage.getItem('stickify21_products');
  if (storedProds) {
    try {
      state.products = JSON.parse(storedProds);
    } catch(e) {
      state.products = [...initialProducts];
    }
  } else {
    state.products = [...initialProducts];
    localStorage.setItem('stickify21_products', JSON.stringify(state.products));
  }

  renderCategories();
  renderProducts();
  renderCart();
  renderPackBuilder();
  renderMockupDevice();
  setupEventListeners();
  updateCartBadge();

  // Instant sync with admin actions from other tabs or windows
  window.addEventListener('storage', (e) => {
    if (e.key === 'stickify21_categories') {
      try {
        state.categories = JSON.parse(e.newValue || '[]');
        renderCategories();
        renderProducts();
      } catch(err) {}
    } else if (e.key === 'stickify21_products') {
      try {
        state.products = JSON.parse(e.newValue || '[]');
        renderProducts();
      } catch(err) {}
    }
  });
}

function getFilteredAndSortedProducts() {
  let list = state.products.filter(p => {
    const matchCat = state.selectedCategory === 'all' || p.category === state.selectedCategory;
    const matchSubCat = state.selectedSubCategory === 'all' || p.subCategory === state.selectedSubCategory;
    const matchFinish = state.activeFinish === 'all' || p.finish === state.activeFinish;
    const matchSearch = p.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                        p.nameAr.includes(state.searchQuery) ||
                        p.desc.includes(state.searchQuery) ||
                        (p.sku && p.sku.toLowerCase().includes(state.searchQuery.toLowerCase()));
    return matchCat && matchSubCat && matchFinish && matchSearch;
  });

  if (state.sortBy === 'price-low') {
    list.sort((a, b) => a.price - b.price);
  } else if (state.sortBy === 'price-high') {
    list.sort((a, b) => b.price - a.price);
  } else if (state.sortBy === 'newest') {
    list.sort((a, b) => b.dateAdded - a.dateAdded);
  }

  return list;
}

function renderProducts() {
  const container = document.getElementById('products-grid');
  const countLabel = document.getElementById('products-count');
  if (!container) return;

  const filtered = getFilteredAndSortedProducts();
  if (countLabel) {
    countLabel.innerText = `${filtered.length} منتج`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-zinc-100 flex items-center justify-center text-2xl text-zinc-400">🔍</div>
        <h3 class="text-base font-bold text-zinc-900">مفيش عناصر مطابقة للقسم المحدد</h3>
        <p class="text-zinc-500 text-xs mt-1">جرب اختيار قسم آخر أو مسح الفلاتر</p>
        <button onclick="resetFilters()" class="mt-4 px-4 py-2 rounded-full bg-zinc-900 text-white font-medium text-xs hover:bg-black transition">
          عرض كل المنتجات
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(product => {
    const isHolo = product.finish === 'holographic';
    const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
    const hasImage = !!product.image;
    const currentSizeKey = state.selectedSizes[product.id] || 'medium';
    const currentPrice = getProductPriceForSize(product, currentSizeKey);
    const smallPrice = getProductPriceForSize(product, 'small');
    const medPrice = getProductPriceForSize(product, 'medium');
    const largePrice = getProductPriceForSize(product, 'large');
    const currentSizeLabel = isBookmark ? 'فاصل كتب 15 × 5 سم' : (currentSizeKey === 'small' ? '6 سم (Small)' : (currentSizeKey === 'large' ? '10 سم (Large)' : '8 سم (Medium)'));

    return `
      <div class="sticker-card group relative rounded-2xl bg-white border border-zinc-200/90 hover:border-zinc-900 p-5 transition-all duration-200 flex flex-col justify-between hover:shadow-sm">
        
        <!-- Header Tags: Badge + SKU -->
        <div class="flex items-center justify-between mb-4">
          <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isBookmark ? 'bg-amber-50 text-amber-800 border border-amber-200' : (isHolo ? 'bg-[#FF5000]/10 text-[#FF5000] border border-[#FF5000]/30' : 'bg-zinc-100 text-zinc-700')}">
            ${product.badge}
          </span>
          <div class="flex items-center gap-1.5 font-mono">
            <span class="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-bold border border-zinc-200">#${product.sku}</span>
          </div>
        </div>

        <!-- Graphic Stage -->
        <div class="relative w-full aspect-square p-6 flex items-center justify-center rounded-xl bg-zinc-50 border border-zinc-100 mb-4 overflow-hidden ${isHolo ? 'hologram-effect' : ''}">
          <div id="graphic-wrapper-${product.id}" class="${isBookmark ? 'w-24 h-36' : (currentSizeKey === 'small' ? 'w-24 h-24' : (currentSizeKey === 'large' ? 'w-34 h-34' : 'w-28 h-28'))} sticker-diecut-minimal flex items-center justify-center transition-all duration-200">
            ${hasImage ? `<img src="${product.image}" alt="${product.name}" class="w-full h-full object-contain">` : product.svg}
          </div>

          <button onclick="addStickerToMockup('${product.id}')" title="جرب على جهازك" class="absolute bottom-2.5 left-2.5 px-3 py-1.5 rounded-lg bg-white/95 text-zinc-900 border border-zinc-200 hover:border-black hover:bg-black hover:text-white transition shadow-sm opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-xs font-semibold">
            <span>معاينة</span>
            <span>↗</span>
          </button>
        </div>

        <!-- Info & Dynamic Price Display -->
        <div class="mb-3">
          <div class="flex items-baseline justify-between gap-2 mb-1.5">
            <h3 class="font-bold text-sm text-zinc-900 group-hover:text-[#FF5000] transition">${product.nameAr}</h3>
            <div class="text-left font-mono">
              <span id="card-price-${product.id}" class="font-extrabold text-zinc-900 text-base whitespace-nowrap">${currentPrice}</span>
              <span class="text-[10px] font-medium text-zinc-500">ج.م</span>
            </div>
          </div>
          <p class="text-xs text-zinc-500 leading-relaxed line-clamp-2">${product.desc}</p>
        </div>

        <!-- Size Selector Pill (Interactive 6cm, 8cm, 10cm) -->
        ${!isBookmark ? `
          <div class="mb-4 bg-zinc-50 border border-zinc-200/80 p-2 rounded-xl">
            <div class="flex items-center justify-between text-[11px] mb-1.5 font-semibold text-zinc-600">
              <span>اختر المقاس:</span>
              <span id="selected-size-label-${product.id}" class="text-zinc-900 font-bold">${currentSizeLabel}</span>
            </div>
            <div class="grid grid-cols-3 gap-1 bg-zinc-200/60 p-1 rounded-lg text-xs font-bold text-center">
              <button type="button" onclick="selectCardSize('${product.id}', 'small', event)" id="size-btn-${product.id}-small" class="size-pill-btn py-1 rounded-md transition ${currentSizeKey === 'small' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}">
                6 سم <span class="text-[9px] block font-mono font-normal">(${smallPrice} ج.م)</span>
              </button>
              <button type="button" onclick="selectCardSize('${product.id}', 'medium', event)" id="size-btn-${product.id}-medium" class="size-pill-btn py-1 rounded-md transition ${currentSizeKey === 'medium' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}">
                8 سم <span class="text-[9px] block font-mono font-normal">(${medPrice} ج.م)</span>
              </button>
              <button type="button" onclick="selectCardSize('${product.id}', 'large', event)" id="size-btn-${product.id}-large" class="size-pill-btn py-1 rounded-md transition ${currentSizeKey === 'large' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}">
                10 سم <span class="text-[9px] block font-mono font-normal">(${largePrice} ج.م)</span>
              </button>
            </div>
          </div>
        ` : `
          <div class="mb-4 bg-amber-50/70 border border-amber-200/60 p-2 rounded-xl text-center">
            <span class="text-[11px] font-bold text-amber-900">🔖 مقاس قياسي فاخر: 15 × 5 سم (كرتون 350gsm)</span>
          </div>
        `}

        <!-- Action Buttons -->
        <div class="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-zinc-100">
          <button onclick="addToCart('${product.id}')" class="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-[#FF5000] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm">
            <span>أضف للسلة</span>
            <span>+</span>
          </button>
          <button onclick="addToPack('${product.id}')" class="w-full py-2.5 px-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1 transition">
            <span>للباقة</span>
            <span>📦</span>
          </button>
        </div>

      </div>
    `;
  }).join('');
}

function selectCardSize(productId, sizeKey, e) {
  if (e) e.stopPropagation();
  state.selectedSizes[productId] = sizeKey;

  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const price = getProductPriceForSize(product, sizeKey);
  const sizeObj = STICKER_SIZES.find(s => s.key === sizeKey) || STICKER_SIZES[1];

  const priceElem = document.getElementById(`card-price-${productId}`);
  if (priceElem) priceElem.innerText = price;

  const labelElem = document.getElementById(`selected-size-label-${productId}`);
  if (labelElem) labelElem.innerText = sizeObj.labelAr;

  ['small', 'medium', 'large'].forEach(sk => {
    const btn = document.getElementById(`size-btn-${productId}-${sk}`);
    if (btn) {
      const active = sk === sizeKey;
      btn.className = `size-pill-btn py-1 rounded-md transition ${active ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}`;
    }
  });

  const graphicElem = document.getElementById(`graphic-wrapper-${productId}`);
  if (graphicElem) {
    if (sizeKey === 'small') graphicElem.className = 'w-24 h-24 sticker-diecut-minimal flex items-center justify-center transition-all duration-200';
    else if (sizeKey === 'large') graphicElem.className = 'w-34 h-34 sticker-diecut-minimal flex items-center justify-center transition-all duration-200';
    else graphicElem.className = 'w-28 h-28 sticker-diecut-minimal flex items-center justify-center transition-all duration-200';
  }
}

function renderCategories() {
  const gridContainer = document.getElementById('categories-cards-grid');
  const pillsContainer = document.getElementById('category-pills-container');

  // 1. Render Visual Category Cards (Sticka Egypt style with image/emoji support)
  if (gridContainer) {
    gridContainer.innerHTML = state.categories.map(cat => {
      const isActive = state.selectedCategory === cat.id;
      return `
        <div onclick="selectCategoryByCard('${cat.id}')" class="category-card p-4 flex flex-col items-center justify-between text-center group border transition-all duration-200 cursor-pointer ${isActive ? 'border-zinc-900 ring-2 ring-[#FF5000] bg-orange-50/40 shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-900'}">
          <div class="w-full flex justify-between items-start mb-2 min-h-[18px]">
            ${cat.badge ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FF5000]/10 text-[#FF5000]">${cat.badge}</span>` : '<span></span>'}
            <span class="text-[9px] text-zinc-300 font-mono">#${cat.id}</span>
          </div>

          <div class="w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center overflow-hidden cat-thumb-img mb-3 p-1.5 shadow-inner">
            ${cat.image ? `<img src="${cat.image}" alt="${cat.nameAr}" class="w-full h-full object-contain">` : `<span class="text-3xl">${cat.icon || '🏷️'}</span>`}
          </div>

          <div>
            <h3 class="text-xs sm:text-sm font-bold text-zinc-900 group-hover:text-[#FF5000] transition">${cat.nameAr}</h3>
            <span class="text-[10px] text-zinc-400 font-mono block mt-0.5">${cat.nameEn || ''}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Render Category Filter Pills above catalog
  if (pillsContainer) {
    const isAll = state.selectedCategory === 'all';
    let pillsHtml = `
      <button onclick="selectCategoryByCard('all')" data-category="all" class="cat-filter-btn px-4 py-2 rounded-full whitespace-nowrap transition text-xs font-semibold ${isAll ? 'bg-zinc-900 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:text-black hover:bg-zinc-200'}">
        ✨ الكل
      </button>
    `;

    pillsHtml += state.categories.map(cat => {
      const isActive = state.selectedCategory === cat.id;
      return `
        <button onclick="selectCategoryByCard('${cat.id}')" data-category="${cat.id}" class="cat-filter-btn px-4 py-2 rounded-full whitespace-nowrap transition text-xs font-semibold flex items-center gap-1.5 ${isActive ? 'bg-zinc-900 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:text-black hover:bg-zinc-200'}">
          ${cat.image ? `<img src="${cat.image}" class="w-4 h-4 object-contain rounded" alt="">` : `<span>${cat.icon || '🏷️'}</span>`}
          <span>${cat.nameAr}</span>
        </button>
      `;
    }).join('');

    pillsContainer.innerHTML = pillsHtml;
  }
}

function selectCategoryByCard(catId) {
  state.selectedCategory = catId;
  state.selectedSubCategory = 'all';
  renderCategories();
  renderProducts();

  const catalogElem = document.getElementById('catalog-products-area');
  if (catalogElem) {
    catalogElem.scrollIntoView({ behavior: 'smooth' });
  }
}

function resetFilters() {
  state.selectedCategory = 'all';
  state.selectedSubCategory = 'all';
  state.activeFinish = 'all';
  state.searchQuery = '';
  state.sortBy = 'featured';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = 'featured';

  document.querySelectorAll('.finish-filter-btn').forEach((b, i) => {
    b.classList.toggle('bg-zinc-900', i === 0);
    b.classList.toggle('text-white', i === 0);
    b.classList.toggle('text-zinc-600', i !== 0);
  });

  renderCategories();
  renderProducts();
}

function addToCart(productId, customSizeKey = null) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
  const selectedKey = customSizeKey || (isBookmark ? 'standard' : (state.selectedSizes[productId] || 'medium'));
  const sizeObj = STICKER_SIZES.find(s => s.key === selectedKey);
  const sizeLabel = isBookmark ? 'فاصل كتب (15 × 5 سم)' : (sizeObj ? sizeObj.labelAr : '8 سم (Medium)');
  const itemPrice = getProductPriceForSize(product, selectedKey);

  const cartItemId = `${product.id}-${selectedKey}`;
  const existingIndex = state.cart.findIndex(item => item.id === cartItemId || (item.productId === product.id && item.size === sizeLabel));
  
  if (existingIndex > -1) {
    state.cart[existingIndex].quantity += 1;
  } else {
    state.cart.push({
      id: cartItemId,
      productId: product.id,
      sku: product.sku || 'S21-XX',
      nameAr: product.nameAr,
      name: product.name,
      price: itemPrice,
      size: sizeLabel,
      sizeKey: selectedKey,
      finish: product.finish,
      type: isBookmark ? 'bookmark' : 'sticker',
      image: product.image,
      svg: product.svg,
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  updateCartBadge();
  showToast(`تمت إضافة [${product.sku}] مقاس ${sizeLabel} بسعر ${itemPrice} ج.م للسلة 🛍️`);
}

function updateCartQuantity(index, delta) {
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) {
    state.cart.splice(index, 1);
  }
  saveCart();
  renderCart();
  updateCartBadge();
}

function removeCartItem(index) {
  const removed = state.cart.splice(index, 1);
  saveCart();
  renderCart();
  updateCartBadge();
  if (removed[0]) {
    showToast(`تم حذف "${removed[0].nameAr}" من السلة`, 'info');
  }
}

function saveCart() {
  localStorage.setItem('stickify21_cart', JSON.stringify(state.cart));
}

function updateCartBadge() {
  const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cart-badge');
  if (badge) {
    badge.innerText = totalCount;
    badge.classList.toggle('hidden', totalCount === 0);
  }
}

function getCartCalculations() {
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = Math.round(subtotal * (state.coupon.discountPercent / 100));
  const shipping = subtotal >= 200 ? 0 : (subtotal > 0 ? 35 : 0);
  const total = subtotal - discount + shipping;

  return { subtotal, discount, shipping, total };
}

function renderCart() {
  const itemsContainer = document.getElementById('cart-items-container');
  const summaryContainer = document.getElementById('cart-summary-container');
  if (!itemsContainer || !summaryContainer) return;

  if (state.cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="text-center py-20">
        <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-zinc-100 flex items-center justify-center text-2xl text-zinc-400">🛍️</div>
        <h4 class="text-sm font-bold text-zinc-800">سلتك فارغة</h4>
        <p class="text-zinc-500 text-xs mt-1 mb-5">تصفح الاستيكرات وفواصل الكتب وضيف ما يعجبك</p>
        <button onclick="toggleCartModal(false)" class="px-5 py-2.5 rounded-full bg-zinc-900 hover:bg-black text-white font-bold text-xs transition">
          ابدأ التسوق
        </button>
      </div>
    `;
    summaryContainer.innerHTML = '';
    return;
  }

  itemsContainer.innerHTML = state.cart.map((item, index) => `
    <div class="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 gap-3">
      <div class="w-14 h-14 p-1 rounded-lg bg-white border border-zinc-200 flex-shrink-0 flex items-center justify-center">
        ${item.image ? `<img src="${item.image}" alt="" class="w-11 h-11 object-contain">` : item.svg}
      </div>
      <div class="flex-grow">
        <div class="flex items-center gap-1.5">
          <span class="bg-zinc-200 text-zinc-800 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold">#${item.sku || 'SKU'}</span>
          <h4 class="font-bold text-zinc-900 text-xs">${item.nameAr}</h4>
        </div>
        <div class="text-[11px] text-zinc-500 flex items-center gap-2 mt-1 font-mono">
          <span>${item.type === 'bookmark' ? 'بوك مارك' : item.size}</span>
          <span>•</span>
          <span class="text-zinc-900 font-bold">${item.price} ج.م</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center border border-zinc-300 rounded-lg overflow-hidden bg-white">
          <button onclick="updateCartQuantity(${index}, -1)" class="px-2 py-1 text-zinc-600 hover:text-black hover:bg-zinc-100 font-bold text-xs">-</button>
          <span class="px-2 py-1 text-xs font-bold text-zinc-900 font-mono">${item.quantity}</span>
          <button onclick="updateCartQuantity(${index}, 1)" class="px-2 py-1 text-zinc-600 hover:text-black hover:bg-zinc-100 font-bold text-xs">+</button>
        </div>
        <button onclick="removeCartItem(${index})" class="text-zinc-400 hover:text-red-500 p-1 text-xs transition">✕</button>
      </div>
    </div>
  `).join('');

  const { subtotal, discount, shipping, total } = getCartCalculations();

  summaryContainer.innerHTML = `
    <!-- Coupon -->
    <div class="flex gap-2 mb-4">
      <input type="text" id="coupon-input" placeholder="كود الخصم (جرب STICKIFY10)" class="flex-grow bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 uppercase focus:outline-none focus:border-zinc-900">
      <button onclick="applyCoupon()" class="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition">تطبيق</button>
    </div>

    <!-- Free Shipping Indicator -->
    <div class="mb-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
      <div class="flex justify-between text-xs font-semibold mb-1">
        <span class="text-zinc-700">شحن مجاني فوق 200 ج.م</span>
        <span class="${subtotal >= 200 ? 'text-[#FF5000] font-bold' : 'text-zinc-500'}">
          ${subtotal >= 200 ? 'تم تفعيل الشحن المجاني! 🚚' : `باقي ${200 - subtotal} ج.م`}
        </span>
      </div>
      <div class="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
        <div class="bg-[#FF5000] h-full rounded-full transition-all duration-300" style="width: ${Math.min(100, (subtotal/200)*100)}%"></div>
      </div>
    </div>

    <!-- Pricing Summary -->
    <div class="space-y-1.5 text-xs text-zinc-600 border-t border-zinc-200 pt-3 mb-4 font-mono">
      <div class="flex justify-between">
        <span class="font-sans text-zinc-600">المجموع الفرعي:</span>
        <span class="font-bold text-zinc-900">${subtotal} ج.م</span>
      </div>
      ${discount > 0 ? `
        <div class="flex justify-between text-[#FF5000] font-bold">
          <span class="font-sans">الخصم (${state.coupon.code}):</span>
          <span>-${discount} ج.م</span>
        </div>
      ` : ''}
      <div class="flex justify-between">
        <span class="font-sans text-zinc-600">الشحن:</span>
        <span class="text-zinc-900 font-bold">${shipping === 0 ? '<span class="text-[#FF5000]">مجاناً</span>' : `${shipping} ج.م`}</span>
      </div>
      <div class="flex justify-between text-base font-extrabold text-zinc-900 border-t border-zinc-200 pt-2 font-mono">
        <span class="font-sans">الإجمالي:</span>
        <span class="text-[#FF5000]">${total} ج.م</span>
      </div>
    </div>

    <!-- CTAs -->
    <div class="space-y-2">
      <button onclick="checkoutViaWhatsAppDirect()" class="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm">
        <span>إرسال الطلب عبر واتساب (01043546503)</span>
        <span>💬</span>
      </button>
      <button onclick="openCheckoutModal()" class="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-semibold text-xs flex items-center justify-center gap-2 transition">
        <span>إتمام الشراء بالبيانات التفصيلية</span>
      </button>
    </div>
  `;
}

// Dynamic Coupons Check against Admin settings
function applyCoupon() {
  const input = document.getElementById('coupon-input');
  if (!input) return;
  const val = input.value.trim().toUpperCase();

  const storedCoupons = JSON.parse(localStorage.getItem('stickify21_coupons') || '[]');
  const validCoupons = storedCoupons.length > 0 ? storedCoupons : defaultCoupons;

  const found = validCoupons.find(c => c.code === val);
  if (found) {
    state.coupon = { code: found.code, discountPercent: found.discountPercent };
    showToast(`تم تفعيل كود الخصم "${found.code}" بنسبة ${found.discountPercent}% 🎉`);
    renderCart();
  } else {
    showToast('كود الخصم غير صحيح أو منتهي الصلاحية', 'error');
  }
}

// ==========================================
// MOCKUP STUDIO
// ==========================================
function renderMockupDevice() {
  const container = document.getElementById('device-wrapper');
  if (!container) return;

  const dev = devices[state.activeDevice];
  container.className = `w-full transition-all duration-300 ${dev.frameClass}`;
  container.innerHTML = `
    ${dev.decorationsHtml || ''}
    <div id="mockup-stickers-layer" class="absolute inset-0 z-10 w-full h-full pointer-events-auto"></div>
  `;
  renderPlacedStickers();
}

function changeMockupDevice(devId) {
  if (!devices[devId]) return;
  state.activeDevice = devId;
  document.querySelectorAll('.device-tab-btn').forEach(btn => {
    btn.classList.toggle('active-device-btn', btn.dataset.device === devId);
  });
  renderMockupDevice();
}

function addStickerToMockup(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
  const sizeKey = isBookmark ? 'standard' : (state.selectedSizes[productId] || 'medium');
  const scale = isBookmark ? 1.0 : (sizeKey === 'small' ? 0.75 : (sizeKey === 'large' ? 1.35 : 1.0));

  const newPlaced = {
    id: 'placed-' + Date.now(),
    productId: product.id,
    sku: product.sku,
    nameAr: product.nameAr,
    svg: product.svg,
    image: product.image,
    isBookmark: isBookmark,
    sizeKey: sizeKey,
    x: 42 + (Math.random() * 16),
    y: 38 + (Math.random() * 16),
    rotation: isBookmark ? (Math.random() * 10 - 5) : ((Math.random() * 20) - 10),
    scale: scale
  };

  state.placedStickers.push(newPlaced);
  state.selectedPlacedId = newPlaced.id;
  renderPlacedStickers();
  const sizeName = isBookmark ? 'فاصل كتب' : (sizeKey === 'small' ? '6 سم Small' : (sizeKey === 'large' ? '10 سم Large' : '8 سم Medium'));
  showToast(`تم وضع [${product.sku}] مقاس ${sizeName} على المعاينة الواقعية`);

  const studioElem = document.getElementById('mockup-studio-section');
  if (studioElem && window.innerWidth < 768) {
    studioElem.scrollIntoView({ behavior: 'smooth' });
  }
}

function renderPlacedStickers() {
  const board = document.getElementById('mockup-stickers-layer');
  if (!board) return;

  board.innerHTML = state.placedStickers.map(item => `
    <div id="${item.id}" 
         class="mockup-placed-sticker ${item.isBookmark ? 'w-16 h-32' : 'w-24 h-24'} ${state.selectedPlacedId === item.id ? 'selected' : ''}"
         style="left: ${item.x}%; top: ${item.y}%; transform: translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale});"
         onmousedown="startDragSticker(event, '${item.id}')"
         ontouchstart="startTouchDragSticker(event, '${item.id}')"
         onclick="selectPlacedSticker('${item.id}')">
      ${item.image ? `<img src="${item.image}" alt="" class="w-full h-full object-contain pointer-events-none">` : item.svg}
    </div>
  `).join('');

  updatePlacedControls();
}

function selectPlacedSticker(id) {
  state.selectedPlacedId = id;
  renderPlacedStickers();
}

function updatePlacedControls() {
  const controls = document.getElementById('mockup-controls');
  if (!controls) return;

  if (!state.selectedPlacedId || state.placedStickers.length === 0) {
    controls.innerHTML = `
      <div class="text-[11px] text-zinc-400 text-center py-2 font-semibold">
        اضغط على أي استيكر أو بوك مارك لمعاينته واقعياً على اللابتوب أو الموبايل وتجربة المقاسات
      </div>
    `;
    return;
  }

  const current = state.placedStickers.find(s => s.id === state.selectedPlacedId);
  if (!current) return;

  controls.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-3 p-3 bg-white rounded-2xl border border-zinc-200 text-xs shadow-sm">
      <div class="flex items-center gap-2">
        <span class="font-mono text-[10px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded font-bold border border-zinc-200">#${current.sku}</span>
        <span class="font-bold text-zinc-900">${current.nameAr}</span>
      </div>

      <!-- Size Switcher inside Mockup -->
      ${!current.isBookmark ? `
        <div class="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl font-bold text-xs">
          <span class="text-[10px] text-zinc-500 mr-1.5 font-semibold">المقاس:</span>
          <button onclick="setPlacedStickerSize('small')" class="px-2.5 py-1 rounded-lg transition ${current.sizeKey === 'small' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:text-black hover:bg-zinc-200'}">6 سم (S)</button>
          <button onclick="setPlacedStickerSize('medium')" class="px-2.5 py-1 rounded-lg transition ${current.sizeKey === 'medium' || !current.sizeKey ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:text-black hover:bg-zinc-200'}">8 سم (M)</button>
          <button onclick="setPlacedStickerSize('large')" class="px-2.5 py-1 rounded-lg transition ${current.sizeKey === 'large' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:text-black hover:bg-zinc-200'}">10 سم (L)</button>
        </div>
      ` : ''}

      <!-- Rotate & Delete Actions -->
      <div class="flex items-center gap-1.5">
        <button onclick="rotateCurrentSticker(-15)" class="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition" title="تدوير يسار">↺</button>
        <button onclick="rotateCurrentSticker(15)" class="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition" title="تدوير يمين">↻</button>
        <button onclick="deleteCurrentSticker()" class="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold transition" title="حذف">✕ حذف</button>
      </div>
    </div>
  `;
}

function setPlacedStickerSize(sizeKey) {
  const item = state.placedStickers.find(s => s.id === state.selectedPlacedId);
  if (!item) return;
  item.sizeKey = sizeKey;
  item.scale = sizeKey === 'small' ? 0.75 : (sizeKey === 'large' ? 1.35 : 1.0);
  renderPlacedStickers();
  const label = sizeKey === 'small' ? '6 سم (Small)' : (sizeKey === 'large' ? '10 سم (Large)' : '8 سم (Medium)');
  showToast(`تم تغيير مقاس الاستيكر على المعاينة إلى ${label}`);
}

function rotateCurrentSticker(deg) {
  const item = state.placedStickers.find(s => s.id === state.selectedPlacedId);
  if (!item) return;
  item.rotation = (item.rotation + deg) % 360;
  renderPlacedStickers();
}

function scaleCurrentSticker(delta) {
  const item = state.placedStickers.find(s => s.id === state.selectedPlacedId);
  if (!item) return;
  item.scale = Math.max(0.5, Math.min(2.2, item.scale + delta));
  renderPlacedStickers();
}

function deleteCurrentSticker() {
  state.placedStickers = state.placedStickers.filter(s => s.id !== state.selectedPlacedId);
  state.selectedPlacedId = state.placedStickers.length > 0 ? state.placedStickers[0].id : null;
  renderPlacedStickers();
}

function clearMockupStickers() {
  state.placedStickers = [];
  state.selectedPlacedId = null;
  renderPlacedStickers();
  showToast('تم إخلاء الشاشة');
}

let dragItem = null;

function startDragSticker(e, id) {
  e.preventDefault();
  dragItem = state.placedStickers.find(s => s.id === id);
  if (!dragItem) return;

  state.selectedPlacedId = id;
  const board = document.getElementById('mockup-stickers-layer');
  const rect = board.getBoundingClientRect();

  function onMouseMove(moveEvent) {
    if (!dragItem) return;
    const xPct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
    const yPct = ((moveEvent.clientY - rect.top) / rect.height) * 100;
    dragItem.x = Math.max(5, Math.min(95, xPct));
    dragItem.y = Math.max(5, Math.min(95, yPct));
    renderPlacedStickers();
  }

  function onMouseUp() {
    dragItem = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function startTouchDragSticker(e, id) {
  if (e.touches.length !== 1) return;
  dragItem = state.placedStickers.find(s => s.id === id);
  if (!dragItem) return;

  state.selectedPlacedId = id;
  const board = document.getElementById('mockup-stickers-layer');
  const rect = board.getBoundingClientRect();

  function onTouchMove(moveEvent) {
    if (!dragItem || moveEvent.touches.length !== 1) return;
    const touch = moveEvent.touches[0];
    const xPct = ((touch.clientX - rect.left) / rect.width) * 100;
    const yPct = ((touch.clientY - rect.top) / rect.height) * 100;
    dragItem.x = Math.max(5, Math.min(95, xPct));
    dragItem.y = Math.max(5, Math.min(95, yPct));
    renderPlacedStickers();
  }

  function onTouchEnd() {
    dragItem = null;
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
  }

  window.addEventListener('touchmove', onTouchMove);
  window.addEventListener('touchend', onTouchEnd);
}

// ==========================================
// PACK BUILDER (5 & 10 only)
// ==========================================
function setPackSize(size) {
  if (size !== 5 && size !== 10) size = 5;
  state.packBuilder.targetSize = size;
  
  if (state.packBuilder.items.length > size) {
    state.packBuilder.items = state.packBuilder.items.slice(0, size);
  }
  
  const btn5 = document.getElementById('pack-btn-5');
  const btn10 = document.getElementById('pack-btn-10');
  if (btn5 && btn10) {
    if (size === 5) {
      btn5.className = 'px-5 py-2.5 rounded-full text-xs font-bold bg-[#FF5000] text-white shadow-sm transition';
      btn10.className = 'px-5 py-2.5 rounded-full text-xs font-semibold text-zinc-700 hover:text-black transition';
    } else {
      btn5.className = 'px-5 py-2.5 rounded-full text-xs font-semibold text-zinc-700 hover:text-black transition';
      btn10.className = 'px-5 py-2.5 rounded-full text-xs font-bold bg-[#FF5000] text-white shadow-sm transition';
    }
  }

  renderPackBuilder();
}

function addToPack(productId) {
  if (state.packBuilder.items.length >= state.packBuilder.targetSize) {
    showToast(`اكتملت باقة الـ ${state.packBuilder.targetSize} استيكرات! ضيفها للسلة أو اختر باقة الـ 10.`, 'warning');
    return;
  }

  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  state.packBuilder.items.push(product);
  renderPackBuilder();
  showToast(`تمت إضافة [${product.sku}] "${product.nameAr}" للباقة`);
}

function removePackItem(index) {
  state.packBuilder.items.splice(index, 1);
  renderPackBuilder();
}

function renderPackBuilder() {
  const slotsContainer = document.getElementById('pack-slots-container');
  const packInfoContainer = document.getElementById('pack-info-container');
  if (!slotsContainer || !packInfoContainer) return;

  const target = state.packBuilder.targetSize;
  const currentCount = state.packBuilder.items.length;
  const isFull = currentCount === target;

  let slotsHtml = '';
  for (let i = 0; i < target; i++) {
    const item = state.packBuilder.items[i];
    if (item) {
      slotsHtml += `
        <div class="relative w-20 h-20 rounded-2xl bg-white border border-[#FF5000] p-2 flex items-center justify-center group shadow-sm">
          <div class="w-14 h-14 sticker-diecut-minimal">
            ${item.image ? `<img src="${item.image}" alt="" class="w-full h-full object-contain">` : item.svg}
          </div>
          <button onclick="removePackItem(${i})" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-900 text-white font-bold text-[10px] flex items-center justify-center transition hover:bg-red-500 shadow">
            ✕
          </button>
        </div>
      `;
    } else {
      slotsHtml += `
        <div class="w-20 h-20 rounded-2xl border-2 border-dashed border-zinc-300 bg-white/60 flex flex-col items-center justify-center text-zinc-400 text-xs">
          <span class="text-lg opacity-40">+</span>
          <span class="text-[9px] text-zinc-400">${i + 1}</span>
        </div>
      `;
    }
  }
  slotsContainer.innerHTML = slotsHtml;

  const rawTotal = state.packBuilder.items.reduce((sum, item) => sum + item.price, 0);
  let discountRate = target === 5 ? 0.20 : 0.30;
  const discountedTotal = Math.round(rawTotal * (1 - discountRate));
  const savings = rawTotal - discountedTotal;

  packInfoContainer.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-zinc-200">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-zinc-900">المكتمل: ${currentCount} من ${target}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isFull ? 'bg-[#FF5000]/10 text-[#FF5000]' : 'bg-zinc-100 text-zinc-600'}">
            ${isFull ? 'الباقة جاهزة!' : `وفر ${(discountRate*100)}% عند اكتمال ${target} قطع`}
          </span>
        </div>
        <div class="text-xs text-zinc-500 mt-1 font-mono">
          السعر بعد الخصم: <span class="text-base font-extrabold text-[#FF5000]">${discountedTotal} ج.م</span>
          ${savings > 0 ? `<span class="line-through text-zinc-400 ml-2">${rawTotal} ج.م</span> (وفرت ${savings} ج.م)` : ''}
        </div>
      </div>

      <button onclick="addPackToCart()" ${!isFull ? 'disabled' : ''} class="px-7 py-3.5 rounded-full ${isFull ? 'bg-[#FF5000] hover:bg-[#E04600] text-white shadow-sm' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'} font-bold text-xs transition">
        إضافة باقة الـ ${target} بالكامل للسلة
      </button>
    </div>
  `;
}

function addPackToCart() {
  if (state.packBuilder.items.length < state.packBuilder.targetSize) {
    showToast(`اكمل جميع خانات باقة الـ ${state.packBuilder.targetSize} أولاً!`, 'warning');
    return;
  }

  const target = state.packBuilder.targetSize;
  let discountRate = target === 5 ? 0.20 : 0.30;

  state.packBuilder.items.forEach(prod => {
    const discountedPrice = Math.round(prod.price * (1 - discountRate));
    state.cart.push({
      id: prod.id + '-pack',
      sku: prod.sku || 'S21-PK',
      nameAr: `${prod.nameAr} (باقة ${target})`,
      name: prod.name,
      price: discountedPrice,
      size: '7.5cm',
      type: prod.type || 'sticker',
      finish: prod.finish,
      image: prod.image,
      svg: prod.svg,
      quantity: 1
    });
  });

  saveCart();
  renderCart();
  updateCartBadge();
  showToast(`تمت إضافة باقة الـ ${target} استيكرات إلى السلة بخصم ${discountRate*100}%! 🎉`);

  state.packBuilder.items = [];
  renderPackBuilder();
  toggleCartModal(true);
}

// ==========================================
// SUBMIT ORDER (Stores in Admin, Clean WhatsApp)
// ==========================================
function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast('السلة فارغة!', 'error');
    return;
  }
  document.getElementById('checkout-modal').classList.remove('hidden');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

function submitOrder(e) {
  e.preventDefault();

  const name = document.getElementById('order-name').value.trim();
  const phone = document.getElementById('order-phone').value.trim();
  const address = document.getElementById('order-address').value.trim();
  const city = document.getElementById('order-city').value;
  const payment = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';
  const notes = document.getElementById('order-notes').value.trim();

  if (!name || !phone || !address) {
    showToast('يرجى ملء البيانات المطلوبة', 'error');
    return;
  }

  const { subtotal, discount, shipping, total } = getCartCalculations();
  const orderId = 'S21-' + Math.floor(1000 + Math.random() * 9000);

  // 1. Save Order to Admin History in localStorage
  const newOrder = {
    id: orderId,
    date: new Date().toLocaleDateString('ar-EG'),
    status: 'جديد',
    customer: { name, phone, city, address, notes },
    payment: payment === 'cod' ? 'عند الاستلام' : 'InstaPay / فودافون كاش',
    subtotal: subtotal,
    discount: discount,
    shipping: shipping,
    total: total,
    items: state.cart.map(item => ({
      sku: item.sku || 'S21',
      nameAr: item.nameAr,
      size: item.type === 'bookmark' ? 'بوك مارك' : item.size,
      qty: item.quantity,
      price: item.price
    }))
  };

  const existingOrders = JSON.parse(localStorage.getItem('stickify21_orders') || '[]');
  existingOrders.unshift(newOrder);
  localStorage.setItem('stickify21_orders', JSON.stringify(existingOrders));

  // 2. Clean WhatsApp Message for Customer (NO packing-slip link visible to public!)
  let message = `📦 *طلب جديد من متجر STICKIFY 21* (#${orderId}) 📦\n\n`;
  message += `👤 *الاسم:* ${name}\n`;
  message += `📱 *رقم الهاتف:* ${phone}\n`;
  message += `📍 *عنوان التوصيل:* ${address} - ${city}\n`;
  message += `💳 *طريقة الدفع:* ${payment === 'cod' ? 'الدفع عند الاستلام' : 'InstaPay / فودافون كاش'}\n`;
  if (notes) message += `📝 *ملاحظات:* ${notes}\n`;

  message += `\n🏷️ *الاستيكرات والبوك مارك المطلوبة:*\n`;
  state.cart.forEach((item, i) => {
    const typeLabel = item.type === 'bookmark' ? 'بوك مارك' : item.size;
    message += `${i+1}. [${item.sku}] ${item.nameAr} (${typeLabel}) × ${item.quantity} = ${item.price * item.quantity} ج.م\n`;
  });

  message += `\n💰 *المجموع:* ${subtotal} ج.م`;
  if (discount > 0) message += `\n🎁 *الخصم (${state.coupon.code}):* -${discount} ج.م`;
  message += `\n🚚 *الشحن:* ${shipping === 0 ? 'مجاني' : shipping + ' ج.م'}`;
  message += `\n✨ *الإجمالي النهائي: ${total} ج.م*\n`;
  message += `\nشكراً لطلبك من STICKIFY 21! 🚀`;

  const encodedMsg = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMsg}`;

  // Clear cart
  state.cart = [];
  saveCart();
  renderCart();
  updateCartBadge();
  closeCheckoutModal();

  showToast('تم تأكيد الطلب بنجاح! يتم الآن تحويلك إلى واتساب...');
  setTimeout(() => {
    window.open(whatsappUrl, '_blank');
  }, 700);
}

function checkoutViaWhatsAppDirect() {
  if (state.cart.length === 0) {
    showToast('السلة فارغة!', 'error');
    return;
  }
  openCheckoutModal();
}

function toggleCartModal(open) {
  const modal = document.getElementById('cart-modal');
  if (!modal) return;
  modal.classList.toggle('hidden', !open);
}

function setupEventListeners() {
  document.querySelectorAll('.cat-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedCategory = btn.dataset.category;
      state.selectedSubCategory = 'all';
      updateFilterButtons();
      renderProducts();
    });
  });

  document.querySelectorAll('.finish-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.finish-filter-btn').forEach(b => {
        b.classList.remove('bg-zinc-900', 'text-white');
        b.classList.add('text-zinc-600');
      });
      btn.classList.add('bg-zinc-900', 'text-white');
      state.activeFinish = btn.dataset.finish;
      renderProducts();
    });
  });

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderProducts();
    });
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderProducts();
    });
  }
}

function updateFilterButtons() {
  renderCategories();
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-red-600 text-white' : (type === 'warning' ? 'bg-amber-500 text-white' : 'bg-zinc-900 text-white');
  toast.className = `px-4 py-3 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2 transform transition-all duration-200 translate-y-3 opacity-0 ${bg}`;
  toast.innerHTML = `
    <span>${type === 'error' ? '✕' : (type === 'warning' ? '!' : '✓')}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-3', 'opacity-0');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

document.addEventListener('DOMContentLoaded', initApp);
