/**
 * STICKIFY 21 - Storefront Controller
 * Minimalist Sticker & Bookmark Studio
 * WhatsApp: 01043546503 (201043546503)
 */

import { CONFIG } from './src/config/config.js';
import { escapeHtml, sanitizeUrl, sanitizeSvg } from './src/utils/escape.js';
import { getProductPriceForSize, calculatePackSummary, calculateCart, generateCartLineKey, calculateCustomPrintSummary } from './src/domain/pricing.js';
import { storage } from './src/data/storage.js';
import { validateCheckoutForm } from './src/domain/validation.js';
import { generateOrderId, generateIdempotencyKey, generateOrderCode } from './src/utils/ids.js';
import { evaluateCoupon } from './src/domain/coupons.js';
import { formatOrderWhatsAppMessage, formatCustomPrintWhatsAppMessage } from './src/domain/orders.js';
import { checkProductStock } from './src/domain/inventory.js';
import { analytics } from './src/utils/analytics.js';
import { initI18n, getLanguage, setLanguage, t, formatCurrency, applyI18nToDom, translateTag, translateGovernorate } from './src/i18n/index.js';
import { stripEmoji } from './src/utils/emoji.js';
import { getIcon } from './src/utils/icons.js';
import { DEFAULT_POLICIES } from './src/data/policies.js';
import { normalizeArabic } from './src/utils/arabic.js';
import {
  validateFile,
  UPLOAD_POLICIES,
  DEFAULT_CUSTOM_UPLOAD_POLICY,
  checkPrintDpi
} from './src/utils/fileValidation.js';

// Safe JSON parser with fallback and corrupted snapshot
function safeJsonParse(jsonString, fallback, storageKey = 'unknown') {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error(`[STICKIFY 21] Error parsing JSON for key "${storageKey}":`, err);
    try {
      localStorage.setItem(`${storageKey}_corrupt_${Date.now()}`, jsonString);
    } catch (saveErr) {}
    return fallback;
  }
}

// App State

// Global exposures for Phase C
if (typeof window !== 'undefined') {
  window.stripEmoji = stripEmoji;
  window.t = t;
  window.formatCurrency = formatCurrency;
  window.getLanguage = getLanguage;
  window.__openedUrls = window.__openedUrls || [];
}

const state = {
  settings: null,
  categories: [],
  products: [],
  showcase: [],
  cart: safeJsonParse(localStorage.getItem('stickify21_cart'), [], 'stickify21_cart'),
  wishlist: safeJsonParse(localStorage.getItem('stickify21_wishlist'), [], 'stickify21_wishlist'),
  recentlyViewed: safeJsonParse(localStorage.getItem('stickify21_recently_viewed'), [], 'stickify21_recently_viewed'),
  selectedSizes: {}, // { [productId]: 'small' | 'medium' | 'large' }
  selectedCategory: 'all',
  selectedSubCategory: 'all',
  activeTag: 'all',
  selectedGovernorate: 'القاهرة',
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
    discountPercent: 0,
    discountFixed: 0,
    type: 'percentage'
  },
  paymentMethod: 'cod',
  productDetail: {
    productId: null,
    selectedSize: 'medium',
    selectedFinish: 'matte',
    quantity: 1
  },
  customPrint: {
    file: null,
    files: [],
    fileName: '',
    fileSize: 0,
    fileUrl: '',
    lastOrder: null,
    size: '8cm',
    finish: 'glossy',
    quantity: 10,
    cutType: 'Die-cut مفرغ حول أطراف التصميم'
  }
};

// Device definitions for Mockup Studio (Neutral shapes, NO trademark logos, True-to-scale dimensions)
const devices = {
  laptop: {
    id: 'laptop',
    name: 'لابتوب',
    nameAr: 'لابتوب',
    nameEn: 'Laptop',
    realWidthCm: 30,
    realHeightCm: 21,
    frameClass: 'mockup-laptop-realistic relative flex items-center justify-center p-6 min-h-[380px] w-full max-w-xl mx-auto overflow-hidden select-none',
    decorationsHtml: `
      <!-- Display Notch & Hinge Lines -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-2 bg-[#121315] rounded-b-lg pointer-events-none opacity-80"></div>
      <div class="absolute bottom-0 left-10 right-10 h-1.5 bg-[#121315] rounded-t-sm pointer-events-none opacity-80"></div>
      <!-- Neutral Brand Medallion -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-15">
        <div class="w-16 h-16 rounded-full border-2 border-slate-300 flex items-center justify-center">
          <span class="font-mono text-xs font-black text-slate-300">S21</span>
        </div>
      </div>
      <!-- Space Gray Specular Sheen -->
      <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none"></div>
    `
  },
  phone: {
    id: 'phone',
    name: 'موبايل',
    nameAr: 'موبايل',
    nameEn: 'Phone',
    realWidthCm: 7.1,
    realHeightCm: 14.7,
    frameClass: 'mockup-phone-realistic relative flex items-center justify-center p-6 min-h-[420px] max-w-[240px] mx-auto overflow-hidden select-none',
    decorationsHtml: `
      <!-- Camera Island Plateau -->
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
      <!-- Neutral Phone Center Dot -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
        <div class="w-8 h-8 rounded-full border border-slate-400"></div>
      </div>
    `
  },
  bottle: {
    id: 'bottle',
    name: 'زجاجة مياه',
    nameAr: 'زجاجة مياه',
    nameEn: 'Water Bottle',
    realWidthCm: 11.8,
    realHeightCm: 26,
    frameClass: 'mockup-bottle-realistic relative flex items-center justify-center p-6 min-h-[440px] max-w-[220px] mx-auto select-none',
    decorationsHtml: `
      <!-- Tumbler Spout Lid & Loop Handle -->
      <div class="absolute -top-7 left-1/2 -translate-x-1/2 w-28 h-10 rounded-t-2xl bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-700 border-t-2 border-zinc-200 shadow-md pointer-events-none flex items-center justify-center">
        <div class="w-14 h-3.5 rounded-full border-2 border-zinc-800 bg-zinc-900 shadow-inner flex items-center justify-center">
          <div class="w-4 h-1 bg-zinc-600 rounded-full"></div>
        </div>
      </div>
      <!-- Neck Band & Bevel Line -->
      <div class="absolute top-3 left-0 right-0 h-1 bg-zinc-600/50 pointer-events-none"></div>
      <div class="absolute top-4 left-0 right-0 h-[1px] bg-zinc-400/30 pointer-events-none"></div>
      <!-- Specular Highlight Strip along Cylinder -->
      <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-10 bg-gradient-to-r from-transparent via-white/12 to-transparent pointer-events-none"></div>
      <!-- Powder-Coat Cylindrical Curvature Edge Shadows -->
      <div class="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/50 to-transparent pointer-events-none"></div>
      <div class="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/50 to-transparent pointer-events-none"></div>
      <!-- Base Ring -->
      <div class="absolute bottom-0 left-0 right-0 h-7 bg-gradient-to-r from-zinc-800 via-zinc-400 to-zinc-800 border-t border-zinc-600 pointer-events-none rounded-b-2xl"></div>
    `
  },
  notebook: {
    id: 'notebook',
    name: 'كشكول ملاحظات',
    nameAr: 'كشكول ملاحظات',
    nameEn: 'Notebook',
    realWidthCm: 14.8,
    realHeightCm: 21,
    frameClass: 'mockup-notebook-realistic relative flex items-center justify-center p-6 min-h-[400px] max-w-[300px] mx-auto select-none',
    decorationsHtml: `
      <!-- Wire Spiral Binding Rings on Left -->
      <div class="absolute -left-3.5 top-6 bottom-6 w-5 flex flex-col justify-between pointer-events-none z-20">
        <div class="w-6 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-200 to-zinc-800 shadow border border-zinc-600 transform -rotate-6"></div>
        <div class="w-6 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-200 to-zinc-800 shadow border border-zinc-600 transform -rotate-6"></div>
        <div class="w-6 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-200 to-zinc-800 shadow border border-zinc-600 transform -rotate-6"></div>
        <div class="w-6 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-200 to-zinc-800 shadow border border-zinc-600 transform -rotate-6"></div>
        <div class="w-6 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-200 to-zinc-800 shadow border border-zinc-600 transform -rotate-6"></div>
        <div class="w-6 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-200 to-zinc-800 shadow border border-zinc-600 transform -rotate-6"></div>
        <div class="w-6 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-200 to-zinc-800 shadow border border-zinc-600 transform -rotate-6"></div>
      </div>
      <!-- Visible Inner Page Block at Right Edge -->
      <div class="absolute top-2 bottom-2 -right-2 w-2 bg-[#F3EEEA] rounded-r-sm shadow-md border-r border-[#C9C0B7] pointer-events-none"></div>
      <!-- Elastic Closure Band on Right -->
      <div class="absolute top-0 bottom-0 right-6 w-3.5 bg-[#18181B] rounded shadow-md pointer-events-none opacity-85 z-15"></div>
    `
  },
  book: {
    id: 'book',
    name: 'كتاب / رواية',
    nameAr: 'كتاب / رواية',
    nameEn: 'Book',
    realWidthCm: 13,
    realHeightCm: 20,
    frameClass: 'mockup-book-realistic relative flex items-center justify-center p-6 min-h-[400px] max-w-[290px] mx-auto select-none',
    decorationsHtml: `
      <!-- Top Page Block (Bookmarks emerge from here!) -->
      <div class="absolute -top-3.5 left-6 right-6 h-3.5 bg-gradient-to-b from-[#FAF7F2] to-[#E5DFD7] rounded-t-sm border-t border-x border-[#D8D0C5] shadow-inner pointer-events-none z-5">
        <div class="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(0,0,0,0.04)_2px,rgba(0,0,0,0.04)_3px)]"></div>
      </div>
      <!-- Gold Embossed Geometric Filigree Frame -->
      <div class="absolute inset-5 rounded-lg border border-[#D4AF37]/35 pointer-events-none flex flex-col justify-between p-4">
        <div class="text-center font-mono text-[9px] tracking-widest text-[#D4AF37]/60">STICKIFY 21 LIMITED EDITION</div>
        <div class="text-center font-mono text-[9px] text-[#D4AF37]/40 tracking-wider">NOVEL &amp; LITERATURE</div>
      </div>
      <!-- Visible Right Edge Page Block -->
      <div class="absolute top-2 bottom-2 -right-3 w-3 bg-gradient-to-b from-[#F3EEEA] via-[#E8E2DC] to-[#DDD6CE] rounded-r-sm shadow-md border-r border-[#C9C0B7] pointer-events-none">
        <div class="absolute inset-0 bg-[repeating-linear-gradient(180deg,transparent,transparent_2px,rgba(0,0,0,0.04)_2px,rgba(0,0,0,0.04)_3px)]"></div>
      </div>
    `
  }
};

// ==========================================
// INITIALIZATION
// ==========================================

export function toggleStoreLanguage() {
  const current = getLanguage();
  const next = current === 'ar' ? 'en' : 'ar';
  setLanguage(next);
  const toggleLabel = document.getElementById('lang-toggle-label');
  if (toggleLabel) {
    toggleLabel.textContent = next === 'ar' ? 'EN' : 'عربي';
  }
  applyStaticTranslations(next);
  renderAppForLanguage();
}
window.toggleStoreLanguage = toggleStoreLanguage;

export function renderAppForLanguage() {
  renderCategories();
  renderTagChips();
  renderProducts();
  renderShowcase();
  renderRecentlyViewed();
  renderCart();
  renderPackBuilder();
  renderMockupDevice();
  updateCustomPrintSummary();
  updateCartBadge();
  updateWishlistBadge();
}

export function applyStaticTranslations(lang = getLanguage()) {
  const isEn = lang === 'en';
  const curr = isEn ? 'EGP' : 'ج.م';

  // Apply declarative data-i18n* attributes & document.title
  applyI18nToDom(lang);

  // Translate governorate <select id="order-city"> options while preserving Arabic values
  const citySelect = document.getElementById('order-city');
  if (citySelect) {
    Array.from(citySelect.options).forEach(opt => {
      if (!opt.value) {
        opt.textContent = isEn ? '-- Select Governorate --' : '-- اختر المحافظة --';
        return;
      }
      const rate = CONFIG.SHIPPING_RATES[opt.value] ?? CONFIG.DEFAULT_SHIPPING;
      const govLabel = translateGovernorate(opt.value, lang);
      opt.textContent = `${govLabel} (${rate} ${curr})`;
    });
  }

  // Brand slogan stays universal
  document.querySelectorAll('.brand-slogan').forEach(el => {
    el.textContent = 'STICK YOUR VIBE';
  });
}


export async function initApp() {
  await storage.init();

  // Load store settings
  try {
    const settings = await storage.getSettings();
    if (settings) {
      state.settings = settings;
      if (settings.whatsappNumber) CONFIG.WHATSAPP_NUMBER = settings.whatsappNumber;
      if (settings.freeShippingThreshold !== undefined) CONFIG.FREE_SHIPPING_THRESHOLD = settings.freeShippingThreshold;
      if (settings.defaultShipping !== undefined) CONFIG.DEFAULT_SHIPPING = settings.defaultShipping;
      if (settings.shippingRates) CONFIG.SHIPPING_RATES = { ...CONFIG.SHIPPING_RATES, ...settings.shippingRates };
    }
  } catch(e) {}

  // Initialize i18n
  const activeLang = initI18n();
  const toggleLabel = document.getElementById('lang-toggle-label');
  if (toggleLabel) {
    toggleLabel.textContent = activeLang === 'ar' ? 'EN' : 'عربي';
  }
  applyStaticTranslations(activeLang);

  // Load from unified storage interface
  state.categories = await storage.getCategories();
  state.products = await storage.getProducts();
  state.showcase = await storage.getShowcase();

  updateProductJsonLd(state.products);
  renderCategories();
  renderTagChips();
  renderProducts();
  renderShowcase();
  renderRecentlyViewed();
  renderCart();
  renderPackBuilder();
  renderMockupDevice();
  updateCustomPrintSummary();
  setupEventListeners();
  updateCartBadge();
  updateWishlistBadge();
  initHashRouter();

  // Restore open cart if reloaded while open
  if (sessionStorage.getItem('stickify21_cart_open') === '1') {
    toggleCartModal(true);
  }

  // Cross-tab sync
  window.addEventListener('storage', async (e) => {
    if (e.key === 'stickify21_categories') {
      state.categories = await storage.getCategories();
      renderCategories();
    }
    if (e.key === 'stickify21_products') {
      state.products = await storage.getProducts();
      updateProductJsonLd(state.products);
      renderTagChips();
      renderProducts();
    }
    if (e.key === 'stickify21_showcase') {
      state.showcase = await storage.getShowcase();
      renderShowcase();
    }
    if (e.key === 'stickify21_cart') {
      state.cart = safeJsonParse(e.newValue, [], 'stickify21_cart');
      renderCart();
      updateCartBadge();
    }
    if (e.key === 'stickify21_wishlist') {
      state.wishlist = safeJsonParse(e.newValue, [], 'stickify21_wishlist');
      updateWishlistBadge();
      renderProducts();
    }
  });
}

// ==========================================
// CATALOG & PRODUCTS
// ==========================================
export function getFilteredProducts() {
  let list = [...state.products];

  // Category / Wishlist filter
  if (state.selectedCategory === 'wishlist') {
    list = list.filter(p => state.wishlist.includes(p.id));
  } else if (state.selectedCategory !== 'all') {
    list = list.filter(p => p.category === state.selectedCategory);
  }

  // Tag filter (A12)
  if (state.activeTag && state.activeTag !== 'all') {
    const normTag = normalizeArabic(state.activeTag);
    list = list.filter(p => Array.isArray(p.tags) && p.tags.some(tg => normalizeArabic(tg) === normTag));
  }

  // Finish filter
  if (state.activeFinish !== 'all') {
    list = list.filter(p => p.finish === state.activeFinish);
  }

  // Search query filter with Arabic normalization tolerance (A12)
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase().trim();
    const normQ = normalizeArabic(state.searchQuery);
    list = list.filter(p => {
      const tagsMatch = Array.isArray(p.tags) && p.tags.some(tg => normalizeArabic(tg).includes(normQ) || String(tg).toLowerCase().includes(q));
      return (
        (p.nameAr && normalizeArabic(p.nameAr).includes(normQ)) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        (p.name && normalizeArabic(p.name).includes(normQ)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.descAr && normalizeArabic(p.descAr).includes(normQ)) ||
        (p.descEn && p.descEn.toLowerCase().includes(q)) ||
        (p.desc && normalizeArabic(p.desc).includes(normQ)) ||
        tagsMatch
      );
    });
  }

  // Sort
  if (state.sortBy === 'price-low') {
    list.sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (state.sortBy === 'price-high') {
    list.sort((a, b) => (b.price || 0) - (a.price || 0));
  } else if (state.sortBy === 'newest') {
    list.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
  }

  return list;
}

export function renderProducts() {
  const container = document.getElementById('products-grid');
  const countBadge = document.getElementById('filtered-count-badge') || document.getElementById('products-count');
  const emptyState = document.getElementById('catalog-empty-state');
  if (!container) return;

  const isAr = getLanguage() === 'ar';
  const curr = isAr ? 'ج.م' : 'EGP';
  const products = getFilteredProducts();

  if (countBadge) {
    countBadge.innerText = isAr ? `${products.length} تصميم متوفر` : `${products.length} Designs Available`;
  }

  if (products.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = products.map(product => {
    const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
    const hasImage = Boolean(product.image);
    const safeImage = sanitizeUrl(product.image);
    const safeSvg = sanitizeSvg(product.svg);
    const isWishlisted = state.wishlist.includes(product.id);

    const stockCheck = checkProductStock(product);
    const isOutOfStock = !stockCheck.available;

    const currentSizeKey = state.selectedSizes[product.id] || (isBookmark ? 'standard' : 'medium');
    const currentPrice = getProductPriceForSize(product, currentSizeKey);
    const smallPrice = getProductPriceForSize(product, 'small');
    const medPrice = getProductPriceForSize(product, 'medium');
    const largePrice = getProductPriceForSize(product, 'large');

    const displayName = isAr ? (product.nameAr || product.name) : (product.nameEn || product.name || product.nameAr);
    const displayBadge = isAr ? (product.badgeAr || product.badge) : (product.badgeEn || product.badge || product.badgeAr);
    const displayDesc = isAr ? (product.descAr || product.desc) : (product.descEn || product.desc || product.descAr);

    let stageClass = 'w-28 h-28';
    if (isBookmark) {
      stageClass = 'w-24 h-36';
    } else if (currentSizeKey === 'small') {
      stageClass = 'w-24 h-24';
    } else if (currentSizeKey === 'large') {
      stageClass = 'w-36 h-36';
    }

    const currentSizeLabel = isBookmark 
      ? (isAr ? 'فاصل كتب 15 × 5 سم' : 'Bookmark 15 × 5 cm')
      : (currentSizeKey === 'small' ? (isAr ? '6 سم (Small)' : '6 cm (Small)') : (currentSizeKey === 'large' ? (isAr ? '10 سم (Large)' : '10 cm (Large)') : (isAr ? '8 سم (Medium)' : '8 cm (Medium)')));

    return `
      <div class="sticker-card group relative rounded-2xl bg-white border border-zinc-200/90 hover:border-zinc-900 p-5 transition-all duration-200 flex flex-col justify-between hover:shadow-sm">
        
        <!-- Header Tags: Badge + SKU + Wishlist -->
        <div class="flex items-center justify-between mb-4">
          <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isBookmark ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-zinc-100 text-zinc-700'}">
            ${escapeHtml(displayBadge)}
          </span>
          <div class="flex items-center gap-1.5 font-mono">
            ${isOutOfStock ? `<span class="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200">${isAr ? 'نفد من المخزون' : 'Out of Stock'}</span>` : ''}
            <span class="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-bold border border-zinc-200">#${escapeHtml(product.sku)}</span>
            <button type="button" onclick="event.stopPropagation(); toggleWishlist('${escapeHtml(product.id)}')" class="wishlist-toggle-btn ${isWishlisted ? 'active text-red-500' : 'text-zinc-400 hover:text-red-500'} p-1 rounded-full hover:bg-zinc-100 transition" title="${isWishlisted ? (isAr ? 'إزالة من المفضلة' : 'Remove from Wishlist') : (isAr ? 'أضف للمفضلة' : 'Add to Wishlist')}" aria-label="Wishlist">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
            </button>
          </div>
        </div>

        <!-- Graphic Stage -->
        <div onclick="openProductDetailModal('${escapeHtml(product.id)}')" class="relative w-full aspect-square p-6 flex items-center justify-center rounded-xl bg-zinc-50 border border-zinc-100 mb-4 overflow-hidden cursor-pointer">
          <div id="graphic-wrapper-${escapeHtml(product.id)}" data-allow-arabic="true" class="${stageClass} sticker-diecut-minimal flex items-center justify-center transition-all duration-200">
            ${hasImage && safeImage ? `<img src="${safeImage}" alt="${escapeHtml(displayName)}" class="w-full h-full object-contain pointer-events-none">` : safeSvg}
          </div>

          <!-- Preview Button -->
          <button onclick="event.stopPropagation(); addStickerToMockup('${escapeHtml(product.id)}')" title="${isAr ? 'جرب على جهازك' : 'Preview on item'}" class="touch-preview-visible absolute bottom-2.5 left-2.5 px-3 py-1.5 rounded-lg bg-white/95 text-zinc-900 border border-zinc-200 hover:border-black hover:bg-black hover:text-white transition shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1.5 text-xs font-semibold">
            <span>${isAr ? 'معاينة' : 'Preview'}</span>
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"/></svg>
          </button>
        </div>

        <!-- Info & Price -->
        <div class="mb-3">
          <div class="flex items-baseline justify-between gap-2 mb-1.5">
            <h3 onclick="openProductDetailModal('${escapeHtml(product.id)}')" class="font-bold text-sm text-zinc-900 group-hover:text-[#FF5000] transition cursor-pointer">${escapeHtml(displayName)}</h3>
            <div class="text-left font-mono">
              <span id="card-price-${escapeHtml(product.id)}" class="price-tag font-extrabold text-zinc-900 text-base whitespace-nowrap">${currentPrice}</span>
              <span class="text-[10px] font-medium text-zinc-500">${curr}</span>
            </div>
          </div>
          <p class="text-xs text-zinc-500 leading-relaxed line-clamp-2">${escapeHtml(displayDesc)}</p>
        </div>

        <!-- Size Selector Pill (Stickers only) -->
        ${!isBookmark ? `
          <div class="mb-4 bg-zinc-50 border border-zinc-200/80 p-2 rounded-xl">
            <div class="flex items-center justify-between text-[11px] mb-1.5 font-semibold text-zinc-600">
              <span>${isAr ? 'اختر المقاس:' : 'Select Size:'}</span>
              <span id="selected-size-label-${escapeHtml(product.id)}" class="text-zinc-900 font-bold">${escapeHtml(currentSizeLabel)}</span>
            </div>
            <div class="grid grid-cols-3 gap-1 bg-zinc-200/60 p-1 rounded-lg text-xs font-bold text-center">
              <button type="button" onclick="selectCardSize('${escapeHtml(product.id)}', 'small', event)" id="size-btn-${escapeHtml(product.id)}-small" class="size-pill-btn py-1 rounded-md transition ${currentSizeKey === 'small' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}">
                6 ${isAr ? 'سم' : 'cm'} <span class="text-[9px] block font-mono font-normal">(${smallPrice} ${curr})</span>
              </button>
              <button type="button" onclick="selectCardSize('${escapeHtml(product.id)}', 'medium', event)" id="size-btn-${escapeHtml(product.id)}-medium" class="size-pill-btn py-1 rounded-md transition ${currentSizeKey === 'medium' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}">
                8 ${isAr ? 'سم' : 'cm'} <span class="text-[9px] block font-mono font-normal">(${medPrice} ${curr})</span>
              </button>
              <button type="button" onclick="selectCardSize('${escapeHtml(product.id)}', 'large', event)" id="size-btn-${escapeHtml(product.id)}-large" class="size-pill-btn py-1 rounded-md transition ${currentSizeKey === 'large' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}">
                10 ${isAr ? 'سم' : 'cm'} <span class="text-[9px] block font-mono font-normal">(${largePrice} ${curr})</span>
              </button>
            </div>
          </div>
        ` : `
          <div class="mb-4 bg-amber-50/70 border border-amber-200/60 p-2 rounded-xl text-center">
            <span class="text-[11px] font-bold text-amber-900">${isAr ? `مقاس قياسي فاخر: ${CONFIG.BOOKMARK_SPECS.dimensions} (${CONFIG.BOOKMARK_SPECS.material})` : 'Standard Dimensions: 15 × 5 cm (350gsm Premium Cardstock)'}</span>
          </div>
        `}

        <!-- Actions -->
        <div class="grid ${!isBookmark ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mt-auto pt-2 border-t border-zinc-100">
          <button ${isOutOfStock ? 'disabled' : `onclick="addToCart('${escapeHtml(product.id)}')"`} class="w-full py-2.5 px-3 rounded-xl ${isOutOfStock ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-zinc-900 hover:bg-[#FF5000] text-white active:scale-95'} font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm">
            <span>${isOutOfStock ? (isAr ? 'نفد من المخزون' : 'Out of Stock') : (isAr ? 'أضف للسلة' : 'Add to Cart')}</span>
          </button>
          ${!isBookmark ? `
            <button ${isOutOfStock ? 'disabled' : `onclick="addToPack('${escapeHtml(product.id)}')"`} class="w-full py-2.5 px-2 rounded-xl ${isOutOfStock ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'} font-bold text-xs flex items-center justify-center gap-1 transition">
              <span>${isAr ? 'للباقة' : 'Add to Pack'}</span>
            </button>
          ` : ''}
        </div>

      </div>
    `;
  }).join('');
}

export function selectCardSize(productId, sizeKey, e) {
  if (e) e.stopPropagation();
  state.selectedSizes[productId] = sizeKey;

  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const price = getProductPriceForSize(product, sizeKey);
  const sizeObj = CONFIG.STICKER_SIZES.find(s => s.key === sizeKey) || CONFIG.STICKER_SIZES[1];

  const priceElem = document.getElementById(`card-price-${productId}`);
  if (priceElem) priceElem.innerText = price;

  const labelElem = document.getElementById(`selected-size-label-${productId}`);
  if (labelElem) labelElem.innerText = getLanguage() === 'en' ? sizeObj.labelEn : sizeObj.labelAr;

  ['small', 'medium', 'large'].forEach(sk => {
    const btn = document.getElementById(`size-btn-${productId}-${sk}`);
    if (btn) {
      const active = sk === sizeKey;
      btn.className = `size-pill-btn py-1 rounded-md transition ${active ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}`;
    }
  });

  const graphicElem = document.getElementById(`graphic-wrapper-${productId}`);
  if (graphicElem) {
    if (sizeKey === 'small') {
      graphicElem.className = 'w-24 h-24 sticker-diecut-minimal flex items-center justify-center transition-all duration-200';
    } else if (sizeKey === 'large') {
      graphicElem.className = 'w-36 h-36 sticker-diecut-minimal flex items-center justify-center transition-all duration-200';
    } else {
      graphicElem.className = 'w-28 h-28 sticker-diecut-minimal flex items-center justify-center transition-all duration-200';
    }
  }
}

// ==========================================
// SHOWCASE STRIP (R8)
// ==========================================
export function renderShowcase() {
  const section = document.getElementById('showcase-section');
  const track = document.getElementById('showcase-track');
  if (!section || !track) return;

  const items = (state.showcase || []).filter(item => item.active !== false);
  if (items.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  const lang = getLanguage();
  const deviceTagMap = {
    laptop: { ar: 'لابتوب', en: 'Laptop' },
    bottle: { ar: 'زجاجة مياه', en: 'Water Bottle' },
    book: { ar: 'كتاب / رواية', en: 'Book' },
    notebook: { ar: 'كشكول ملاحظات', en: 'Notebook' },
    phone: { ar: 'موبايل', en: 'Phone' },
    other: { ar: 'أخرى', en: 'Other' }
  };

  const renderCard = (item) => {
    const caption = (lang === 'en' ? (item.captionEn || item.captionAr) : (item.captionAr || item.captionEn)) || '';
    const tagInfo = deviceTagMap[item.deviceTag] || deviceTagMap.other;
    const tagName = lang === 'en' ? tagInfo.en : tagInfo.ar;
    const isSvgData = item.image && item.image.startsWith('data:image/svg+xml');

    return `
      <div class="showcase-item w-72 flex-shrink-0 bg-white rounded-2xl border border-zinc-200/90 shadow-sm overflow-hidden flex flex-col group hover:border-black transition">
        <div class="w-full h-48 bg-zinc-100 overflow-hidden flex items-center justify-center relative">
          ${isSvgData 
            ? `<img src="${item.image}" alt="${escapeHtml(caption)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">`
            : `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(caption)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">`
          }
          <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/70 backdrop-blur-sm text-white">
            ${escapeHtml(tagName)}
          </span>
        </div>
        <div class="p-3.5 flex flex-col justify-between flex-1">
          <p class="text-xs font-bold text-zinc-900 line-clamp-2">${escapeHtml(caption)}</p>
          <div class="flex items-center justify-between pt-2 mt-2 border-t border-zinc-100 text-[10px] text-zinc-400">
            <span>STICKIFY 21 Real Life</span>
            <span class="text-[#FF5000] font-bold">${lang === 'en' ? '100% Vinyl' : '100% فينيل'}</span>
          </div>
        </div>
      </div>
    `;
  };

  const cardsHtml = items.map(renderCard).join('');
  track.innerHTML = cardsHtml;
}

export function renderCategories() {
  const gridContainer = document.getElementById('categories-cards-grid');
  const pillsContainer = document.getElementById('category-pills-container');
  const isAr = getLanguage() === 'ar';

  if (gridContainer) {
    gridContainer.innerHTML = state.categories.map(cat => {
      const isActive = state.selectedCategory === cat.id;
      const safeImage = sanitizeUrl(cat.image);
      const catName = isAr ? (cat.nameAr || cat.name) : (cat.nameEn || cat.nameAr || cat.name);
      const catSub = isAr ? (cat.nameEn || '') : '';
      const iconKey = cat.iconKey || 'tag';

      return `
        <div onclick="selectCategoryByCard('${escapeHtml(cat.id)}')" class="category-card p-4 flex flex-col items-center justify-between text-center group border transition-all duration-200 cursor-pointer ${isActive ? 'border-zinc-900 ring-2 ring-[#FF5000] bg-orange-50/40 shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-900'}">
          <div class="w-full flex justify-between items-start mb-2 min-h-[18px]">
            ${cat.badge ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FF5000]/10 text-[#FF5000]">${escapeHtml(isAr ? cat.badge : (cat.badge === 'جديد' ? 'New' : (cat.badgeEn || cat.badge)))}</span>` : '<span></span>'}
            <span class="text-[9px] text-zinc-300 font-mono">#${escapeHtml(cat.id)}</span>
          </div>

          <div class="w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center overflow-hidden cat-thumb-img mb-3 p-2 shadow-inner text-zinc-700 group-hover:text-[#FF5000] transition">
            ${safeImage ? `<img src="${safeImage}" alt="${escapeHtml(catName)}" class="w-full h-full object-contain">` : getIcon(iconKey, 28)}
          </div>

          <div>
            <h3 class="text-xs sm:text-sm font-bold text-zinc-900 group-hover:text-[#FF5000] transition">${escapeHtml(catName)}</h3>
            ${catSub ? `<span class="text-[10px] text-zinc-400 font-mono block mt-0.5">${escapeHtml(catSub)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  if (pillsContainer) {
    const isAll = state.selectedCategory === 'all';
    const isWishlist = state.selectedCategory === 'wishlist';
    let pillsHtml = `
      <button onclick="selectCategoryByCard('all')" data-category="all" class="cat-filter-btn px-4 py-2 rounded-full whitespace-nowrap transition text-xs font-semibold ${isAll ? 'bg-zinc-900 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:text-black hover:bg-zinc-200'}">
        ${isAr ? 'الكل' : 'All'}
      </button>
      <button onclick="selectCategoryByCard('wishlist')" data-category="wishlist" class="cat-filter-btn px-4 py-2 rounded-full whitespace-nowrap transition text-xs font-semibold flex items-center gap-1.5 ${isWishlist ? 'bg-red-600 text-white shadow-sm' : 'bg-red-50 text-red-700 hover:bg-red-100'}">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="${isWishlist ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
        <span>${isAr ? 'المفضلة' : 'Wishlist'} (${state.wishlist.length})</span>
      </button>
    `;

    pillsHtml += state.categories.map(cat => {
      const isActive = state.selectedCategory === cat.id;
      const safeImage = sanitizeUrl(cat.image);
      const catName = isAr ? (cat.nameAr || cat.name) : (cat.nameEn || cat.nameAr || cat.name);
      const iconKey = cat.iconKey || 'tag';
      return `
        <button onclick="selectCategoryByCard('${escapeHtml(cat.id)}')" data-category="${escapeHtml(cat.id)}" class="cat-filter-btn px-4 py-2 rounded-full whitespace-nowrap transition text-xs font-semibold flex items-center gap-1.5 ${isActive ? 'bg-zinc-900 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:text-black hover:bg-zinc-200'}">
          ${safeImage ? `<img src="${safeImage}" class="w-4 h-4 object-contain rounded" alt="">` : `<span class="inline-block text-zinc-500">${getIcon(iconKey, 14)}</span>`}
          <span>${escapeHtml(catName)}</span>
        </button>
      `;
    }).join('');

    pillsContainer.innerHTML = pillsHtml;
  }
}

export function selectCategoryByCard(catId) {
  state.selectedCategory = catId;
  state.selectedSubCategory = 'all';
  renderCategories();
  renderProducts();

  const catalogElem = document.getElementById('catalog-products-area');
  if (catalogElem && window.innerWidth < 768) {
    catalogElem.scrollIntoView({ behavior: 'smooth' });
  }
}

export function resetFilters() {
  state.selectedCategory = 'all';
  state.selectedSubCategory = 'all';
  state.activeTag = 'all';
  state.activeFinish = 'all';
  state.searchQuery = '';
  state.sortBy = 'featured';

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = 'featured';

  document.querySelectorAll('.finish-filter-btn').forEach(btn => {
    btn.classList.remove('bg-zinc-900', 'text-white');
    btn.classList.add('text-zinc-600');
  });
  const allFinishBtn = document.querySelector('.finish-filter-btn[data-finish="all"]');
  if (allFinishBtn) {
    allFinishBtn.classList.add('bg-zinc-900', 'text-white');
    allFinishBtn.classList.remove('text-zinc-600');
  }

  renderCategories();
  renderProducts();
}

// ==========================================
// CART & PRICING
// ==========================================
function recordCartCreation() {
  try {
    const cur = parseInt(localStorage.getItem('stickify21_cart_creations') || '0', 10);
    localStorage.setItem('stickify21_cart_creations', String(cur + 1));
  } catch(e) {}
}

export function saveCart() {
  try {
    localStorage.setItem('stickify21_cart', JSON.stringify(state.cart));
  } catch(e) {}
}

export function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const stockCheck = checkProductStock(product);
  if (!stockCheck.available) {
    showToast(stockCheck.reason || 'هذا المنتج نفد من المخزون حالياً', 'warning');
    return;
  }

  const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
  const sizeKey = isBookmark ? 'standard' : (state.selectedSizes[productId] || 'medium');
  const sizeObj = CONFIG.STICKER_SIZES.find(s => s.key === sizeKey);
  const sizeLabel = isBookmark ? 'فاصل كتب (15×5 سم)' : (sizeObj ? sizeObj.labelAr : '8 سم (Medium)');
  const price = getProductPriceForSize(product, sizeKey);

  // Deterministic cart line key (Fixes Bug 10)
  const lineKey = generateCartLineKey({ productId: product.id, sizeKey });

  const existingIndex = state.cart.findIndex(item => item.id === lineKey);

  if (existingIndex > -1) {
    state.cart[existingIndex].quantity += 1;
  } else {
    if (state.cart.length === 0) recordCartCreation();
    state.cart.push({
      id: lineKey,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      nameAr: product.nameAr,
      nameEn: product.nameEn || product.name,
      category: product.category,
      type: product.type || (isBookmark ? 'bookmark' : 'sticker'),
      size: sizeLabel,
      sizeKey: sizeKey,
      price: price,
      image: product.image,
      svg: product.svg,
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  updateCartBadge();
  analytics.trackAddToCart({ sku: product.sku, productId: product.id, nameAr: product.nameAr, name: product.name, price: price, quantity: 1 });
  const isAr = getLanguage() === 'ar';
  const toastSize = isBookmark
    ? (isAr ? 'فاصل كتب (15×5 سم)' : 'Bookmark (15×5 cm)')
    : (sizeObj ? (isAr ? sizeObj.labelAr : sizeObj.labelEn) : (isAr ? '8 سم (Medium)' : '8 cm (Medium)'));
  showToast(isAr
    ? `تمت إضافة [${escapeHtml(product.sku)}] (${escapeHtml(toastSize)}) إلى السلة بنجاح`
    : `Added [${escapeHtml(product.sku)}] (${escapeHtml(toastSize)}) to cart`);
}

export function updateCartQuantity(index, delta) {
  if (!state.cart[index]) return;
  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) {
    state.cart.splice(index, 1);
  }
  saveCart();
  renderCart();
  updateCartBadge();
}

export function removeCartItem(index) {
  state.cart.splice(index, 1);
  saveCart();
  renderCart();
  updateCartBadge();
}

export function updateCartBadge() {
  const totalCount = state.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const badge = document.getElementById('cart-badge');
  if (badge) {
    badge.innerText = totalCount;
    badge.classList.toggle('hidden', totalCount === 0);
  }
}

export function removeGroupedLine(groupedIndex) {
  const calc = calculateCart({ items: state.cart, coupon: state.coupon, governorate: state.selectedGovernorate });
  const line = calc.groupedLines[groupedIndex];
  if (!line) return;

  if (line.autoPack && Array.isArray(line.items)) {
    // Remove each item that was in this pack from state.cart
    line.items.forEach(u => {
      const idx = state.cart.findIndex(c => (c.id === u.id || c.productId === u.productId) && c.quantity > 0);
      if (idx > -1) {
        state.cart[idx].quantity -= 1;
        if (state.cart[idx].quantity <= 0) {
          state.cart.splice(idx, 1);
        }
      }
    });
  } else if (line.originalIndex !== undefined && state.cart[line.originalIndex]) {
    state.cart.splice(line.originalIndex, 1);
  }
  saveCart();
  renderCart();
  updateCartBadge();
}

export function renderCart() {
  const itemsContainer = document.getElementById('cart-items-container');
  const summaryContainer = document.getElementById('cart-summary-container');
  const nudgeEl = document.getElementById('pack-nudge-banner');
  if (!itemsContainer || !summaryContainer) return;

  const isAr = getLanguage() === 'ar';
  const curr = isAr ? 'ج.م' : 'EGP';

  // Cart modal header text
  const cartModalHeader = document.querySelector('#cart-modal h3');
  if (cartModalHeader) {
    cartModalHeader.textContent = isAr ? 'سلة المشتريات' : 'Shopping Cart';
  }

  if (state.cart.length === 0) {
    if (nudgeEl) {
      nudgeEl.classList.add('hidden');
      nudgeEl.innerHTML = '';
    }
    itemsContainer.innerHTML = `
      <div class="text-center py-20">
        <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
          <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>
        </div>
        <h4 class="text-sm font-bold text-zinc-800">${isAr ? 'سلتك فارغة' : 'Your cart is empty'}</h4>
        <p class="text-zinc-500 text-xs mt-1 mb-5">${isAr ? 'تصفح الاستيكرات وفواصل الكتب وضيف ما يعجبك' : 'Browse the collection and add your favorite stickers or bookmarks'}</p>
        <button onclick="toggleCartModal(false)" class="px-5 py-2.5 rounded-full bg-zinc-900 hover:bg-black text-white font-bold text-xs transition">
          ${isAr ? 'ابدأ التسوق' : 'Start Shopping'}
        </button>
      </div>
    `;
    summaryContainer.innerHTML = '';
    return;
  }

  // Calculations via single source of truth (pricing.js)
  const calc = calculateCart({
    items: state.cart,
    coupon: state.coupon,
    governorate: state.selectedGovernorate
  });

  // Dynamic Pack Nudge Banner (R10)
  if (nudgeEl) {
    if (calc.nudge && calc.nudge.message) {
      const nudgeText = isAr ? calc.nudge.message : (calc.nudge.messageEn || calc.nudge.message);
      nudgeEl.innerHTML = `
        <span class="flex-grow">${escapeHtml(stripEmoji(nudgeText))}</span>
      `;
      nudgeEl.classList.remove('hidden');
    } else {
      nudgeEl.classList.add('hidden');
      nudgeEl.innerHTML = '';
    }
  }

  // Render items (Groups loose standard stickers into automatic packs R10)
  itemsContainer.innerHTML = calc.groupedLines.map((item, index) => {
    const isPack = item.type === 'pack';
    const safeImage = sanitizeUrl(item.image);
    const safeSvg = sanitizeSvg(item.svg);

    if (isPack) {
      const packTitle = isAr ? (item.nameAr || `باقة ${item.size} استيكرات`) : `${item.size}-Sticker Pack`;
      return `
        <div class="p-3.5 rounded-xl bg-orange-50/50 border border-[#FF5000]/30 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span class="bg-[#FF5000] text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">${isAr ? 'باقة توفير' : 'Bundle'}</span>
              <h4 class="font-bold text-zinc-900 text-xs">${escapeHtml(packTitle)}</h4>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="removeGroupedLine(${index})" class="text-zinc-400 hover:text-red-500 p-1 text-xs transition" title="${isAr ? 'حذف الباقة بالكامل' : 'Remove pack'}">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          <!-- Included items mini gallery -->
          <div class="flex items-center gap-1.5 overflow-x-auto py-1">
            ${(item.items || []).map(sub => {
              const subImg = sanitizeUrl(sub.image);
              const subSvg = sanitizeSvg(sub.svg);
              const subName = isAr ? (sub.nameAr || sub.name || '') : (sub.nameEn || sub.name || '');
              return `
                <div data-allow-arabic="true" class="w-8 h-8 rounded-lg bg-white border border-zinc-200 p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden" title="${escapeHtml(subName)}">
                  ${subImg ? `<img src="${subImg}" class="w-full h-full object-contain">` : subSvg}
                </div>
              `;
            }).join('')}
          </div>

          <div class="flex items-center justify-between text-[11px] text-zinc-500 font-mono border-t border-orange-100 pt-1.5">
            <span>${item.autoPack ? (isAr ? 'باقة تلقائية' : 'Auto Pack') : (isAr ? `المقاس: ${escapeHtml(item.size || '8 سم')}` : `Size: ${item.sizeKey === 'small' ? '6 cm' : (item.sizeKey === 'large' ? '10 cm' : '8 cm')}`)}</span>
            <div>
              ${item.savings ? `<span class="line-through text-zinc-400 ml-1.5">${item.rawTotal} ${curr}</span>` : ''}
              <span class="text-[#FF5000] font-black text-xs">${item.price * (item.quantity || 1)} ${curr}</span>
            </div>
          </div>
        </div>
      `;
    }

    const itemName = isAr ? (item.nameAr || item.name) : (item.nameEn || item.name || item.nameAr);
    const sizeObj = CONFIG.STICKER_SIZES.find(s => s.key === item.sizeKey);
    const itemSize = item.type === 'bookmark'
      ? (isAr ? 'بوك مارك' : 'Bookmark')
      : (isAr ? (item.size || '8 سم') : (sizeObj ? sizeObj.labelEn : '8 cm (Medium)'));

    return `
      <div class="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 gap-3">
        <div data-allow-arabic="true" class="w-14 h-14 p-1 rounded-lg bg-white border border-zinc-200 flex-shrink-0 flex items-center justify-center">
          ${safeImage ? `<img src="${safeImage}" alt="" class="w-11 h-11 object-contain">` : safeSvg}
        </div>
        <div class="flex-grow min-w-0">
          <div class="flex items-center gap-1.5 truncate">
            <span class="bg-zinc-200 text-zinc-800 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold">#${escapeHtml(item.sku || 'SKU')}</span>
            <h4 class="font-bold text-zinc-900 text-xs truncate">${escapeHtml(itemName)}</h4>
          </div>
          <div class="text-[11px] text-zinc-500 flex items-center gap-2 mt-1 font-mono">
            <span>${escapeHtml(itemSize)}</span>
            <span class="text-zinc-300" aria-hidden="true">|</span>
            <span class="text-zinc-900 font-bold">${item.price * item.quantity} ${curr}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <div class="flex items-center border border-zinc-300 rounded-lg overflow-hidden bg-white">
            <button onclick="updateCartQuantity(${item.originalIndex !== undefined ? item.originalIndex : index}, -1)" class="px-2 py-1 text-zinc-600 hover:text-black hover:bg-zinc-100 font-bold text-xs">-</button>
            <span class="px-2 py-1 text-xs font-bold text-zinc-900 font-mono">${item.quantity}</span>
            <button onclick="updateCartQuantity(${item.originalIndex !== undefined ? item.originalIndex : index}, 1)" class="px-2 py-1 text-zinc-600 hover:text-black hover:bg-zinc-100 font-bold text-xs">+</button>
          </div>
          <button onclick="removeCartItem(${item.originalIndex !== undefined ? item.originalIndex : index})" class="text-zinc-400 hover:text-red-500 p-1 text-xs transition" title="${isAr ? 'حذف' : 'Remove'}">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  summaryContainer.innerHTML = `
    <!-- Coupon -->
    <div class="flex gap-2 mb-4">
      <input type="text" id="coupon-input" value="${escapeHtml(state.coupon.code)}" placeholder="${isAr ? 'كود الخصم (جرب STICKIFY10)' : 'Discount Code (e.g. STICKIFY10)'}" class="flex-grow bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 uppercase focus:outline-none focus:border-zinc-900">
      <button onclick="applyCoupon()" class="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition">${isAr ? 'تطبيق' : 'Apply'}</button>
    </div>

    <!-- Free Shipping Indicator -->
    <div class="mb-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
      <div class="flex justify-between text-xs font-semibold mb-1">
        <span class="text-zinc-700">${isAr ? `شحن مجاني فوق ${CONFIG.FREE_SHIPPING_THRESHOLD} ${curr}` : `Free shipping on orders over ${CONFIG.FREE_SHIPPING_THRESHOLD} ${curr}`}</span>
        <span class="${calc.isFreeShipping ? 'text-[#FF5000] font-bold' : 'text-zinc-500'}">
          ${calc.isFreeShipping ? (isAr ? 'تم تفعيل الشحن المجاني!' : 'Free shipping unlocked!') : (isAr ? `باقي ${calc.freeShippingRemaining} ${curr}` : `Add ${calc.freeShippingRemaining} ${curr} for free shipping`)}
        </span>
      </div>
      <div class="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
        <div class="bg-[#FF5000] h-full rounded-full transition-all duration-300" style="width: ${calc.freeShippingProgress}%"></div>
      </div>
    </div>

    <!-- Pricing Summary -->
    <div class="space-y-1.5 text-xs text-zinc-600 border-t border-zinc-200 pt-3 mb-4 font-mono">
      <div class="flex justify-between">
        <span class="font-sans text-zinc-600">${isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
        <span class="font-bold text-zinc-900">${calc.subtotal} ${curr}</span>
      </div>
      ${calc.discount > 0 ? `
        <div class="flex justify-between text-[#FF5000] font-bold">
          <span class="font-sans">${isAr ? `الخصم (${escapeHtml(state.coupon.code)}):` : `Discount (${escapeHtml(state.coupon.code)}):`}</span>
          <span>-${calc.discount} ${curr}</span>
        </div>
      ` : ''}
      <div class="flex justify-between">
        <span class="font-sans text-zinc-600">${isAr ? `الشحن (${escapeHtml(state.selectedGovernorate)}):` : `Shipping (${escapeHtml(translateGovernorate(state.selectedGovernorate, 'en'))}):`}</span>
        <span class="text-zinc-900 font-bold">${calc.shipping === 0 ? `<span class="text-[#FF5000]">${isAr ? 'مجاناً' : 'Free'}</span>` : `${calc.shipping} ${curr}`}</span>
      </div>
      <div class="flex justify-between text-base font-extrabold text-zinc-900 border-t border-zinc-200 pt-2 font-mono">
        <span class="font-sans">${isAr ? 'الإجمالي:' : 'Total:'}</span>
        <span class="text-[#FF5000]">${calc.total} ${curr}</span>
      </div>
    </div>

    <!-- CTAs -->
    <div class="space-y-2">
      <button onclick="checkoutViaWhatsAppDirect()" class="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm">
        <span>${isAr ? `إرسال الطلب عبر واتساب (${CONFIG.WHATSAPP_DISPLAY})` : `Order via WhatsApp (${CONFIG.WHATSAPP_DISPLAY})`}</span>
      </button>
      <button id="open-checkout-btn" onclick="openCheckoutModal()" class="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-semibold text-xs flex items-center justify-center gap-2 transition">
        <span>${isAr ? 'إتمام الشراء بالبيانات التفصيلية' : 'Proceed to Checkout'}</span>
      </button>
    </div>
  `;
}

export async function applyCoupon() {
  const input = document.getElementById('coupon-input');
  if (!input) return;
  const val = input.value.trim();

  const coupons = await storage.getCoupons();
  const calc = calculateCart({ items: state.cart, coupon: null, governorate: state.selectedGovernorate });
  const result = evaluateCoupon(val, coupons, { subtotal: calc.subtotal, items: state.cart });

  if (result.valid) {
    state.coupon = {
      code: result.coupon.code,
      discountPercent: result.coupon.type === 'percentage' ? result.coupon.value : 0,
      discountFixed: result.coupon.type === 'fixed' ? result.coupon.value : 0,
      type: result.coupon.type
    };
    showToast(`تم تفعيل كود الخصم "${escapeHtml(result.coupon.code)}" بنجاح!`);
    renderCart();
  } else {
    showToast(result.error || 'كود الخصم غير صحيح أو منتهي الصلاحية', 'error');
  }
}

// ==========================================
// PACK BUILDER
// ==========================================
export function setPackSize(size) {
  if (size !== 5 && size !== 10) size = 5;
  state.packBuilder.targetSize = size;
  
  if (state.packBuilder.items.length > size) {
    state.packBuilder.items = state.packBuilder.items.slice(0, size);
  }
  
  const btn5 = document.getElementById('pack-btn-5');
  const btn10 = document.getElementById('pack-btn-10');
  if (btn5 && btn10) {
    if (size === 5) {
      btn5.className = 'pack-size-pill py-2.5 px-4 rounded-xl border font-bold text-xs transition bg-zinc-900 text-white border-zinc-900 shadow-sm';
      btn10.className = 'pack-size-pill py-2.5 px-4 rounded-xl border font-bold text-xs transition bg-white text-zinc-700 border-zinc-200 hover:border-black';
    } else {
      btn5.className = 'pack-size-pill py-2.5 px-4 rounded-xl border font-bold text-xs transition bg-white text-zinc-700 border-zinc-200 hover:border-black';
      btn10.className = 'pack-size-pill py-2.5 px-4 rounded-xl border font-bold text-xs transition bg-zinc-900 text-white border-zinc-900 shadow-sm';
    }
  }

  renderPackBuilder();
}

export function addToPack(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const stockCheck = checkProductStock(product);
  if (!stockCheck.available) {
    showToast(stockCheck.reason || 'هذا المنتج نفد من المخزون', 'warning');
    return;
  }

  // Pack rule: Stickers only (Bookmarks are rejected per Bug 04)
  if (product.category === 'bookmarks' || product.type === 'bookmark') {
    showToast('الباقات مخصصة لاستيكرات اللابتوب والموبايل فقط!', 'warning');
    return;
  }

  const target = state.packBuilder.targetSize;
  if (state.packBuilder.items.length >= target) {
    showToast(`اكتملت خانات باقة الـ ${target} استيكرات! يمكنك إضافتها للسلة الآن.`, 'warning');
    return;
  }

  state.packBuilder.items.push(product);
  renderPackBuilder();
  showToast(`تمت إضافة [${escapeHtml(product.sku)}] للباقة (${state.packBuilder.items.length} من ${target})`);

  const builderElem = document.getElementById('pack-builder-section');
  if (builderElem && window.innerWidth < 768) {
    builderElem.scrollIntoView({ behavior: 'smooth' });
  }
}

export function removePackItem(index) {
  state.packBuilder.items.splice(index, 1);
  renderPackBuilder();
}

export function renderPackBuilder() {
  const slotsContainer = document.getElementById('pack-slots-container');
  const packInfoContainer = document.getElementById('pack-info-container');
  if (!slotsContainer || !packInfoContainer) return;

  const isAr = getLanguage() === 'ar';
  const curr = isAr ? 'ج.م' : 'EGP';
  const target = state.packBuilder.targetSize;
  const currentCount = state.packBuilder.items.length;
  const isFull = currentCount >= target;

  let slotsHtml = '';
  for (let i = 0; i < target; i++) {
    const item = state.packBuilder.items[i];
    if (item) {
      const safeImg = sanitizeUrl(item.image);
      const safeSvg = sanitizeSvg(item.svg);
      slotsHtml += `
        <div class="relative w-20 h-20 rounded-2xl bg-white border border-[#FF5000] p-2 flex items-center justify-center group shadow-sm">
          <div data-allow-arabic="true" class="w-14 h-14 sticker-diecut-minimal">
            ${safeImg ? `<img src="${safeImg}" alt="" class="w-full h-full object-contain">` : safeSvg}
          </div>
          <button onclick="removePackItem(${i})" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-900 text-white font-bold text-[10px] flex items-center justify-center transition hover:bg-red-500 shadow">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      `;
    } else {
      slotsHtml += `
        <div class="w-20 h-20 rounded-2xl border-2 border-dashed border-zinc-300 bg-white/60 flex flex-col items-center justify-center text-zinc-400 text-xs">
          <span class="text-lg opacity-40">+</span>
          <span class="text-[9px] text-zinc-400 font-mono">${i + 1}</span>
        </div>
      `;
    }
  }
  slotsContainer.innerHTML = slotsHtml;

  const summary = calculatePackSummary(state.packBuilder.items, target);

  packInfoContainer.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-zinc-200">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-zinc-900">${isAr ? `المكتمل: ${currentCount} من ${target}` : `Completed: ${currentCount} of ${target}`}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isFull ? 'bg-[#FF5000]/10 text-[#FF5000]' : 'bg-zinc-100 text-zinc-600'}">
            ${isFull ? (isAr ? 'الباقة جاهزة!' : 'Pack Ready!') : (isAr ? `وفر ${Math.round(summary.discountRate * 100)}% عند اكتمال ${target} قطع` : `Save ${Math.round(summary.discountRate * 100)}% when you fill ${target} slots`)}
          </span>
        </div>
        <div class="text-xs text-zinc-500 mt-1 font-mono">
          ${isAr ? 'السعر بعد الخصم:' : 'Discounted price:'} <span class="text-base font-extrabold text-[#FF5000]">${summary.discountedTotal} ${curr}</span>
          ${summary.savings > 0 ? `<span class="line-through text-zinc-400 ml-2">${summary.rawTotal} ${curr}</span> (${isAr ? `وفرت ${summary.savings} ${curr}` : `Saved ${summary.savings} ${curr}`})` : ''}
        </div>
      </div>

      <button onclick="addPackToCart()" ${!isFull ? 'disabled' : ''} class="px-7 py-3.5 rounded-full ${isFull ? 'bg-[#FF5000] hover:bg-[#E04600] text-white shadow-sm' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'} font-bold text-xs transition">
        ${isAr ? `إضافة باقة الـ ${target} بالكامل للسلة` : `Add Full ${target}-Pack to Cart`}
      </button>
    </div>
  `;
}

export function addPackToCart() {
  const target = state.packBuilder.targetSize;
  if (state.packBuilder.items.length < target) {
    showToast(`اكمل جميع خانات باقة الـ ${target} أولاً!`, 'warning');
    return;
  }

  const summary = calculatePackSummary(state.packBuilder.items, target);
  const packItemIds = state.packBuilder.items.map(p => p.id);
  const packLineKey = generateCartLineKey({ type: 'pack', packSize: target, sizeKey: 'medium', itemIds: packItemIds });

  const existingPackIdx = state.cart.findIndex(item => item.id === packLineKey);
  if (existingPackIdx > -1) {
    state.cart[existingPackIdx].quantity += 1;
  } else {
    state.cart.push({
      id: packLineKey,
      type: 'pack',
      packSize: target,
      nameAr: `باقة توفير (${target} استيكرات)`,
      name: `Custom Pack (${target} Stickers)`,
      size: '8 سم (Medium)',
      sizeKey: 'medium',
      price: summary.discountedTotal,
      rawTotal: summary.rawTotal,
      savings: summary.savings,
      quantity: 1,
      items: state.packBuilder.items.map(p => ({
        id: p.id,
        sku: p.sku || 'S21',
        nameAr: p.nameAr,
        image: p.image,
        svg: p.svg
      }))
    });
  }

  saveCart();
  renderCart();
  updateCartBadge();
  showToast(`تمت إضافة باقة الـ ${target} استيكرات إلى السلة بخصم ${summary.discountRate * 100}%! `);

  state.packBuilder.items = [];
  renderPackBuilder();
  toggleCartModal(true);
}

// ==========================================
// MOCKUP STUDIO (True-to-Scale & Realistic SVGs) (R5, R6, R7, A4)
// ==========================================
export function getMockupPxPerCm() {
  const container = document.getElementById('device-wrapper');
  const dev = devices[state.activeDevice] || devices.laptop;
  if (!container) return 15;
  const rect = container.getBoundingClientRect();
  const widthPx = rect.width || 500;
  return widthPx / dev.realWidthCm;
}

export function getPlacedStickerDimensions(item) {
  const pxPerCm = getMockupPxPerCm();
  if (item.isBookmark) {
    return {
      widthPx: Math.round(5 * pxPerCm),
      heightPx: Math.round(15 * pxPerCm)
    };
  }
  const sizeCm = item.sizeKey === 'small' ? 6 : (item.sizeKey === 'large' ? 10 : 8);
  const sizePx = Math.round(sizeCm * pxPerCm);
  return {
    widthPx: sizePx,
    heightPx: sizePx
  };
}

export function renderMockupDevice() {
  const container = document.getElementById('device-wrapper');
  if (!container) return;

  const dev = devices[state.activeDevice] || devices.laptop;
  container.className = `w-full transition-all duration-300 ${dev.frameClass}`;
  
  container.innerHTML = `
    ${dev.decorationsHtml || ''}
    <div id="mockup-stickers-layer" class="absolute inset-0 z-10 w-full h-full pointer-events-auto"></div>
  `;
  renderPlacedStickers();
  const rulerOverlay = document.getElementById('mockup-ruler-overlay');
  if (rulerOverlay && !rulerOverlay.classList.contains('hidden')) {
    renderMockupRuler();
  }
}

export function changeMockupDevice(devId) {
  if (!devices[devId]) return;
  state.activeDevice = devId;
  document.querySelectorAll('.device-tab-btn').forEach(btn => {
    btn.classList.toggle('active-device-btn', btn.dataset.device === devId);
  });
  renderMockupDevice();
}

export function addStickerToMockup(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
  const sizeKey = isBookmark ? 'standard' : (state.selectedSizes[productId] || 'medium');
  const sizeObj = CONFIG.STICKER_SIZES.find(s => s.key === sizeKey);

  const isBookDevice = state.activeDevice === 'book';
  // Bookmark on book preview emerges naturally from the top page block (R6)
  const defaultX = isBookmark && isBookDevice ? 62 : (42 + (Math.random() * 16));
  const defaultY = isBookmark && isBookDevice ? 15 : (38 + (Math.random() * 16));
  const defaultRotation = isBookmark ? (isBookDevice ? -2 : 0) : 0;

  const newPlaced = {
    id: 'placed-' + Date.now(),
    productId: product.id,
    sku: product.sku,
    nameAr: product.nameAr,
    nameEn: product.nameEn || product.name,
    finish: product.finish || 'matte',
    svg: product.svg,
    image: product.image,
    isBookmark: isBookmark,
    sizeKey: sizeKey,
    x: defaultX,
    y: defaultY,
    rotation: defaultRotation
  };

  state.placedStickers.push(newPlaced);
  state.selectedPlacedId = newPlaced.id;
  renderPlacedStickers();

  const sizeName = isBookmark ? 'فاصل كتب' : (sizeObj ? sizeObj.labelAr : '8 سم');
  showToast(`تم وضع [${escapeHtml(product.sku)}] مقاس ${escapeHtml(sizeName)} على المعاينة`);

  const studioElem = document.getElementById('mockup-studio-section');
  if (studioElem && window.innerWidth < 768) {
    studioElem.scrollIntoView({ behavior: 'smooth' });
  }
}

export function renderPlacedStickers() {
  const board = document.getElementById('mockup-stickers-layer');
  if (!board) return;

  const isBottle = state.activeDevice === 'bottle';

  board.innerHTML = state.placedStickers.map(item => {
    const safeImg = sanitizeUrl(item.image);
    const safeSvg = sanitizeSvg(item.svg);
    const { widthPx, heightPx } = getPlacedStickerDimensions(item);

    // Cylindrical horizontal squeeze for bottle/tumbler (R6)
    let scaleXTransform = '';
    let curvatureStyle = '';
    if (isBottle) {
      const normX = (item.x - 50) / 45;
      const angle = Math.max(-1, Math.min(1, normX)) * (Math.PI / 2.6);
      const cosTheta = Math.max(0.35, Math.cos(angle));
      scaleXTransform = ` scaleX(${cosTheta.toFixed(3)})`;
      if (Math.abs(normX) > 0.35) {
        const brightness = (0.75 + 0.25 * cosTheta).toFixed(2);
        curvatureStyle = `filter: brightness(${brightness});`;
      }
    }

    const isGlossy = item.finish !== 'matte';
    const finishSheen = isGlossy ? `<div class="sticker-glossy-sheen pointer-events-none"></div>` : '';

    return `
      <div id="${escapeHtml(item.id)}" 
           data-allow-arabic="true"
           class="mockup-placed-sticker sticker-diecut-contour relative ${state.selectedPlacedId === item.id ? 'selected' : ''}"
           style="width: ${widthPx}px; height: ${heightPx}px; left: ${item.x}%; top: ${item.y}%; transform: translate(-50%, -50%) rotate(${item.rotation}deg)${scaleXTransform}; ${curvatureStyle}"
           data-placed-id="${escapeHtml(item.id)}">
        ${safeImg ? `<img src="${safeImg}" alt="" class="w-full h-full object-contain pointer-events-none">` : safeSvg}
        ${finishSheen}
      </div>
    `;
  }).join('');

  attachPointerDragListeners();
  updatePlacedControls();
  updateMockupScaleCaption();
}

function attachPointerDragListeners() {
  const board = document.getElementById('mockup-stickers-layer');
  if (!board) return;

  board.querySelectorAll('.mockup-placed-sticker').forEach(el => {
    const id = el.dataset.placedId;
    el.onpointerdown = (e) => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}
      state.selectedPlacedId = id;
      board.querySelectorAll('.mockup-placed-sticker').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');
      updatePlacedControls();
      updateMockupScaleCaption();

      const item = state.placedStickers.find(s => s.id === id);
      if (!item) return;

      const boardRect = board.getBoundingClientRect();
      let rafId = null;

      const onPointerMove = (moveEvt) => {
        const xPct = ((moveEvt.clientX - boardRect.left) / boardRect.width) * 100;
        const yPct = ((moveEvt.clientY - boardRect.top) / boardRect.height) * 100;
        
        item.x = Math.max(5, Math.min(95, xPct));
        item.y = Math.max(5, Math.min(95, yPct));

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          el.style.left = `${item.x}%`;
          el.style.top = `${item.y}%`;
          if (state.activeDevice === 'bottle') {
            const normX = (item.x - 50) / 45;
            const angle = Math.max(-1, Math.min(1, normX)) * (Math.PI / 2.6);
            const cosTheta = Math.max(0.35, Math.cos(angle));
            el.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg) scaleX(${cosTheta.toFixed(3)})`;
            if (Math.abs(normX) > 0.35) {
              const brightness = (0.75 + 0.25 * cosTheta).toFixed(2);
              el.style.filter = `brightness(${brightness})`;
            } else {
              el.style.filter = '';
            }
          }
        });
      };

      const onPointerUp = (upEvt) => {
        if (rafId) cancelAnimationFrame(rafId);
        el.style.left = `${item.x}%`;
        el.style.top = `${item.y}%`;
        try {
          el.releasePointerCapture(upEvt.pointerId);
        } catch(err) {}
        el.onpointermove = null;
        el.onpointerup = null;
        el.onpointercancel = null;
      };

      el.onpointermove = onPointerMove;
      el.onpointerup = onPointerUp;
      el.onpointercancel = onPointerUp;
    };
  });
}

export function updateMockupScaleCaption() {
  const captionEl = document.getElementById('mockup-scale-caption');
  if (!captionEl) return;

  const dev = devices[state.activeDevice] || devices.laptop;
  const current = state.placedStickers.find(s => s.id === state.selectedPlacedId) || state.placedStickers[0];

  const lang = getLanguage();
  const devName = lang === 'en' ? dev.nameEn : dev.nameAr;

  if (!current) {
    captionEl.textContent = lang === 'en' 
      ? `True-to-scale dimensions matching real-world sizes (${dev.realWidthCm} cm ${devName})`
      : `المقاسات مطابقة للأبعاد الواقعية (${devName} ${dev.realWidthCm} سم)`;
    return;
  }

  if (current.isBookmark) {
    captionEl.textContent = lang === 'en'
      ? `15×5 cm bookmark inside ${dev.realWidthCm} cm ${devName}`
      : `بوك مارك 15×5 سم على ${devName} ${dev.realWidthCm} سم`;
  } else {
    const sizeCm = current.sizeKey === 'small' ? 6 : (current.sizeKey === 'large' ? 10 : 8);
    captionEl.textContent = lang === 'en'
      ? `${sizeCm} cm sticker on ${dev.realWidthCm} cm ${devName}`
      : `استيكر ${sizeCm} سم على ${devName} ${dev.realWidthCm} سم`;
  }
}

export function renderMockupRuler() {
  const overlay = document.getElementById('mockup-ruler-overlay');
  if (!overlay) return;

  const dev = devices[state.activeDevice] || devices.laptop;
  const pxPerCm = getMockupPxPerCm();
  const totalCm = dev.realWidthCm;

  let ticksHtml = '';
  for (let cm = 0; cm <= totalCm; cm++) {
    const leftPx = cm * pxPerCm;
    const isMajor = cm % 5 === 0;
    ticksHtml += `
      <div class="absolute bottom-0 flex flex-col items-center pointer-events-none" style="left: ${leftPx}px; transform: translateX(-50%);">
        ${isMajor ? `<span class="text-[9px] font-mono font-bold text-zinc-700 leading-none mb-1">${cm}</span>` : ''}
        <div class="w-[1px] ${isMajor ? 'h-3.5 bg-zinc-900' : 'h-2 bg-zinc-400'}"></div>
      </div>
    `;
    if (cm < totalCm) {
      const halfPx = (cm + 0.5) * pxPerCm;
      ticksHtml += `
        <div class="absolute bottom-0 pointer-events-none" style="left: ${halfPx}px; transform: translateX(-50%);">
          <div class="w-[1px] h-1.5 bg-zinc-300"></div>
        </div>
      `;
    }
  }

  overlay.innerHTML = `
    <div class="mockup-ruler relative w-full h-8 overflow-hidden rounded-t-xl px-2">
      <div class="absolute top-1 left-2 text-[8px] font-mono uppercase tracking-wider text-zinc-500 font-bold">Metric (cm)</div>
      ${ticksHtml}
    </div>
  `;
}

export function toggleMockupRuler() {
  const overlay = document.getElementById('mockup-ruler-overlay');
  const btn = document.getElementById('toggle-mockup-ruler');
  if (!overlay) return;
  const isHidden = overlay.classList.contains('hidden');
  overlay.classList.toggle('hidden', !isHidden);
  if (isHidden) renderMockupRuler();
  if (btn) {
    const lang = getLanguage();
    btn.textContent = isHidden 
      ? (lang === 'en' ? 'Hide Ruler' : 'إخفاء المسطرة') 
      : (lang === 'en' ? 'Show Ruler' : 'عرض المسطرة');
  }
}

export function openSizeGuideModal() {
  const modal = document.getElementById('size-guide-modal');
  if (modal) modal.classList.remove('hidden');
}

export function closeSizeGuideModal() {
  const modal = document.getElementById('size-guide-modal');
  if (modal) modal.classList.add('hidden');
}

function updatePlacedControls() {
  const controls = document.getElementById('mockup-controls');
  if (!controls) return;
  const isAr = getLanguage() === 'ar';

  if (!state.selectedPlacedId || state.placedStickers.length === 0) {
    controls.innerHTML = `
      <div class="text-[11px] text-zinc-400 text-center py-2 font-semibold">
        ${isAr ? 'اضغط على أي استيكر أو بوك مارك لمعاينته واقعياً على اللابتوب أو الموبايل وتجربة المقاسات' : 'Click any sticker or bookmark to preview true-to-scale on your device and compare sizes'}
      </div>
    `;
    return;
  }

  const current = state.placedStickers.find(s => s.id === state.selectedPlacedId);
  if (!current) return;
  const itemName = isAr ? (current.nameAr || current.nameEn || '') : (current.nameEn || current.nameAr || '');

  controls.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-3 p-3 bg-white rounded-2xl border border-zinc-200 text-xs shadow-sm">
      <div class="flex items-center gap-2">
        <span class="font-mono text-[10px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded font-bold border border-zinc-200">#${escapeHtml(current.sku)}</span>
        <span class="font-bold text-zinc-900">${escapeHtml(itemName)}</span>
      </div>

      ${!current.isBookmark ? `
        <div class="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl font-bold text-xs">
          <span class="text-[10px] text-zinc-500 mr-1.5 font-semibold">${isAr ? 'المقاس:' : 'Size:'}</span>
          <button onclick="setPlacedStickerSize('small')" class="px-2.5 py-1 rounded-lg transition ${current.sizeKey === 'small' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:text-black hover:bg-zinc-200'}">${isAr ? '6 سم (S)' : '6 cm (S)'}</button>
          <button onclick="setPlacedStickerSize('medium')" class="px-2.5 py-1 rounded-lg transition ${current.sizeKey === 'medium' || !current.sizeKey ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:text-black hover:bg-zinc-200'}">${isAr ? '8 سم (M)' : '8 cm (M)'}</button>
          <button onclick="setPlacedStickerSize('large')" class="px-2.5 py-1 rounded-lg transition ${current.sizeKey === 'large' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:text-black hover:bg-zinc-200'}">${isAr ? '10 سم (L)' : '10 cm (L)'}</button>
        </div>
      ` : ''}

      <div class="flex items-center gap-2">
        <button onclick="rotateCurrentSticker()" class="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition" title="${isAr ? 'تدوير الاستيكر' : 'Rotate sticker'}">
          ${isAr ? 'تدوير' : 'Rotate'}
        </button>
        <button onclick="deleteCurrentSticker()" class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition" title="${isAr ? 'إزالة من المعاينة' : 'Remove from preview'}">
          ${isAr ? 'إزالة' : 'Remove'}
        </button>
      </div>
    </div>
  `;
}

export function setPlacedStickerSize(sizeKey) {
  const current = state.placedStickers.find(s => s.id === state.selectedPlacedId);
  if (!current || current.isBookmark) return;

  current.sizeKey = sizeKey;
  renderPlacedStickers();
}

export function rotateCurrentSticker() {
  const current = state.placedStickers.find(s => s.id === state.selectedPlacedId);
  if (!current) return;
  current.rotation = (current.rotation + 15) % 360;
  renderPlacedStickers();
}

export function deleteCurrentSticker() {
  state.placedStickers = state.placedStickers.filter(s => s.id !== state.selectedPlacedId);
  state.selectedPlacedId = null;
  renderPlacedStickers();
}

export function clearMockupStickers() {
  state.placedStickers = [];
  state.selectedPlacedId = null;
  renderPlacedStickers();
  showToast('تم إفراغ شاشة المعاينة');
}

// ==========================================
// MODALS & CHECKOUT FLOW
// ==========================================
export function toggleCartModal(open) {
  const modal = document.getElementById('cart-modal');
  if (modal) {
    const shouldOpen = open !== undefined ? Boolean(open) : modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !shouldOpen);
    sessionStorage.setItem('stickify21_cart_open', shouldOpen ? '1' : '0');
  }
}

export function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast('السلة فارغة!', 'error');
    return;
  }

  const citySelect = document.getElementById('order-city');
  if (citySelect && state.selectedGovernorate) {
    citySelect.value = state.selectedGovernorate;
  }

  handlePaymentMethodChange(state.paymentMethod || 'cod');
  updateCheckoutPricingPreview();
  const pricing = calculateCart({ items: state.cart, coupon: state.coupon, governorate: state.selectedGovernorate });
  analytics.trackBeginCheckout(state.cart, pricing.total);
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.remove('hidden');
}

export function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.add('hidden');
}

export function handleCheckoutCityChange(city) {
  state.selectedGovernorate = city;
  updateCheckoutPricingPreview();
  renderCart();
}

export function updateCheckoutPricingPreview() {
  const container = document.getElementById('checkout-pricing-preview');
  const itemsContainer = document.getElementById('checkout-items-summary');
  const isAr = getLanguage() === 'ar';
  const curr = isAr ? 'ج.م' : 'EGP';

  const calc = calculateCart({
    items: state.cart,
    coupon: state.coupon,
    governorate: state.selectedGovernorate
  });

  if (itemsContainer) {
    itemsContainer.innerHTML = calc.groupedLines.map((item) => {
      if (item.type === 'pack') {
        const subListHtml = (item.items || []).map(sub => {
          const sName = isAr ? (sub.nameAr || sub.name || '') : (sub.nameEn || sub.name || sub.nameAr || '');
          const sSize = sub.sizeKey === 'small' ? (isAr ? '6 سم' : '6 cm') : (sub.sizeKey === 'large' ? (isAr ? '10 سم' : '10 cm') : (isAr ? '8 سم' : '8 cm'));
          const sFinish = sub.finish === 'glossy' ? (isAr ? 'لامع' : 'Glossy') : (isAr ? 'مطفي' : 'Matte');
          return `
          <div class="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-zinc-100 text-[11px]">
            <span class="font-mono font-bold text-zinc-900">#${escapeHtml(sub.sku || 'S21')}</span>
            <span class="text-zinc-700 truncate font-semibold">${escapeHtml(sName)}</span>
            <span class="text-zinc-400 font-mono text-[10px] mr-auto">(${escapeHtml(sSize)} - ${escapeHtml(sFinish)})</span>
          </div>
        `;
        }).join('');

        const packName = isAr ? (item.nameAr || 'باقة استيكرات') : `${item.packSize || item.size || 5}-Sticker Pack`;
        return `
          <div class="p-2.5 rounded-xl bg-orange-50/60 border border-orange-200/80 space-y-1.5">
            <div class="flex items-center justify-between font-bold text-xs">
              <span class="text-[#FF5000]">${escapeHtml(packName)} (${isAr ? 'الكمية' : 'Qty'}: ${item.quantity || 1})</span>
              <span class="font-mono">${item.price * (item.quantity || 1)} ${curr}</span>
            </div>
            <div class="space-y-1 pr-2 border-r-2 border-[#FF5000]/40">
              ${subListHtml}
            </div>
          </div>
        `;
      }
      const itName = isAr ? (item.nameAr || item.name) : (item.nameEn || item.name || item.nameAr);
      const sizeObj = CONFIG.STICKER_SIZES.find(s => s.key === item.sizeKey);
      const itSize = item.type === 'bookmark'
        ? (isAr ? 'بوك مارك' : 'Bookmark')
        : (isAr ? (item.size || '8 سم') : (sizeObj ? sizeObj.labelEn : '8 cm (Medium)'));
      return `
        <div class="flex items-center justify-between p-2 rounded-xl bg-white border border-zinc-200/80 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold bg-zinc-100 px-1.5 py-0.5 rounded text-[10px]">#${escapeHtml(item.sku || 'S21')}</span>
            <span class="font-bold text-zinc-900">${escapeHtml(itName)}</span>
            <span class="text-zinc-400 font-mono text-[10px]">(${escapeHtml(itSize)})</span>
          </div>
          <span class="font-mono font-bold">${item.price * (item.quantity || 1)} ${curr}</span>
        </div>
      `;
    }).join('');
  }

  if (!container) return;

  const govDisplay = state.selectedGovernorate
    ? translateGovernorate(state.selectedGovernorate, getLanguage())
    : (isAr ? 'لم تحدد' : 'Not Selected');

  container.innerHTML = `
    <div class="flex justify-between">
      <span class="font-sans text-zinc-600">${isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
      <span class="font-bold text-zinc-900">${calc.subtotal} ${curr}</span>
    </div>
    ${calc.discount > 0 ? `
      <div class="flex justify-between text-[#FF5000] font-bold">
        <span class="font-sans">${isAr ? `الخصم (${escapeHtml(state.coupon.code)}):` : `Discount (${escapeHtml(state.coupon.code)}):`}</span>
        <span>-${calc.discount} ${curr}</span>
      </div>
    ` : ''}
    <div class="flex justify-between">
      <span class="font-sans text-zinc-600">${isAr ? `مصاريف الشحن (${escapeHtml(govDisplay)}):` : `Shipping (${escapeHtml(govDisplay)}):`}</span>
      <span class="text-zinc-900 font-bold">${calc.shipping === 0 ? `<span class="text-[#FF5000]">${isAr ? 'مجاناً' : 'Free'}</span>` : `${calc.shipping} ${curr}`}</span>
    </div>
    <div class="flex justify-between text-sm font-extrabold text-zinc-900 border-t border-zinc-200/80 pt-1 mt-1 font-mono">
      <span class="font-sans">${isAr ? 'الإجمالي المطلوب:' : 'Total Due:'}</span>
      <span class="text-[#FF5000]">${calc.total} ${curr}</span>
    </div>
  `;
}

export function checkoutViaWhatsAppDirect() {
  if (state.cart.length === 0) {
    showToast('السلة فارغة!', 'error');
    return;
  }
  openCheckoutModal();
}

export async function submitOrder(e) {
  if (e) e.preventDefault();

  const nameInput = document.getElementById('order-name');
  const phoneInput = document.getElementById('order-phone');
  const citySelect = document.getElementById('order-city');
  const addressInput = document.getElementById('order-address');
  const notesInput = document.getElementById('order-notes');
  const submitBtn = document.getElementById('checkout-submit-btn');

  const rawFormData = {
    name: nameInput?.value,
    phone: phoneInput?.value,
    governorate: citySelect?.value,
    address: addressInput?.value,
    notes: notesInput?.value
  };

  // Reset inline errors
  ['name', 'phone', 'city', 'address', 'notes'].forEach(field => {
    const errEl = document.getElementById(`order-${field}-error`);
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }
  });

  const validationResult = validateCheckoutForm(rawFormData);
  if (!validationResult.isValid) {
    // Show inline errors
    Object.entries(validationResult.errors).forEach(([field, msg]) => {
      const fieldId = field === 'governorate' ? 'city' : field;
      const errEl = document.getElementById(`order-${fieldId}-error`);
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
      }
    });
    showToast('يرجى تصحيح الأخطاء في نموذج الطلب', 'error');
    return;
  }

  if (state.cart.length === 0) {
    showToast('سلة المشتريات فارغة!', 'error');
    return;
  }

  // Double-submit protection
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }

  try {
    const cleanValues = validationResult.values;
    state.selectedGovernorate = cleanValues.governorate;

    const calc = calculateCart({
      items: state.cart,
      coupon: state.coupon,
      governorate: cleanValues.governorate
    });

    const existingOrders = await storage.getOrders();
    const existingIds = existingOrders.map(o => o.id);
    const orderId = generateOrderId(existingIds);
    const idempotencyKey = generateIdempotencyKey();

    const paymentRadio = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';
    const proofError = document.getElementById('payment-proof-error');

    if (paymentRadio !== 'cod' && !state.checkoutPaymentProof) {
      if (proofError) {
        proofError.textContent = 'يرجى رفع صورة إشعار التحويل لتأكيد حجز طلبك *';
        proofError.classList.remove('hidden');
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
      showToast('يرجى رفع صورة إشعار التحويل لتأكيد طلبك', 'error');
      return;
    }

    const paymentLabel = paymentRadio === 'vodafone_cash' 
      ? 'فودافون كاش (01043546503)' 
      : (paymentRadio === 'instapay' ? 'InstaPay (stickify21@instapay)' : 'عند الاستلام (COD)');

    const structuredLines = calc.groupedLines.map(item => {
      if (item.type === 'pack') {
        const pSize = item.packSize || item.size || (item.items ? item.items.length : 5);
        const dRate = item.discountRate || (pSize === 10 ? 0.3 : 0.2);
        return {
          type: 'pack',
          size: pSize,
          discountRate: dRate,
          packPrice: item.price * (item.quantity || 1),
          quantity: item.quantity || 1,
          items: (item.items || []).map(p => ({
            sku: p.sku || 'S21',
            name: p.nameAr || p.name || 'استيكر',
            sizeKey: p.sizeKey || 'medium',
            finish: p.finish || 'matte',
            unitPrice: p.price || 35,
            image: p.image || ''
          }))
        };
      }
      return {
        type: item.type === 'bookmark' ? 'bookmark' : 'single',
        sku: item.sku || 'S21',
        name: item.nameAr || item.name || '',
        sizeKey: item.sizeKey || 'medium',
        size: item.size || '8 سم',
        finish: item.finish || 'matte',
        unitPrice: item.price,
        quantity: item.quantity || 1,
        total: item.price * (item.quantity || 1),
        image: item.image || ''
      };
    });

    const order = {
      id: orderId,
      idempotencyKey,
      date: new Date().toISOString(),
      status: 'awaiting_confirmation',
      customer: {
        name: cleanValues.name,
        phone: cleanValues.phone,
        governorate: cleanValues.governorate,
        city: cleanValues.governorate,
        address: cleanValues.address,
        notes: cleanValues.notes || ''
      },
      payment: paymentLabel,
      paymentMethod: paymentRadio,
      paymentVerified: false,
      paymentProof: state.checkoutPaymentProof || null,
      paymentDetails: {
        method: paymentRadio,
        label: paymentLabel,
        proofAttached: Boolean(state.checkoutPaymentProof),
        proofDataUrl: state.checkoutPaymentProof || null,
        status: state.checkoutPaymentProof ? 'proof_received' : (paymentRadio === 'cod' ? 'unpaid' : 'pending_proof'),
        verified: false
      },
      subtotal: calc.subtotal,
      discount: calc.discount,
      shippingCost: calc.shipping,
      total: calc.total,
      couponCode: state.coupon.code || null,
      courier: null,
      trackingNumber: null,
      lines: structuredLines,
      items: state.cart.map(item => ({
        id: item.id,
        productId: item.productId,
        sku: item.sku || 'S21',
        nameAr: item.nameAr,
        name: item.name,
        type: item.type || 'sticker',
        size: item.size || '8 سم',
        quantity: item.quantity || 1,
        price: item.price,
        items: item.items
      })),
      statusHistory: [
        {
          status: 'awaiting_confirmation',
          timestamp: new Date().toISOString(),
          note: 'تم إنشاء الطلب من المتجر بانتظار التأكيد'
        }
      ]
    };

    // Save order through storage interface FIRST
    await storage.createOrder(order);
    analytics.trackPurchase(order);

    // Increment coupon usage if used
    if (state.coupon.code) {
      await storage.incrementCouponUsage(state.coupon.code);
    }

    // Record customer language (R4)
    order.lang = getLanguage();

    // Generate Order Code and WhatsApp message
    const orderCode = generateOrderCode(order);
    const whatsappMsg = formatOrderWhatsAppMessage(order, orderCode);
    const whatsappUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMsg)}`;

    // Record opened WhatsApp URL for verification & tests
    window.__openedUrls = window.__openedUrls || [];
    window.__openedUrls.push(whatsappUrl);

    // Clear cart ONLY AFTER order is saved successfully
    state.cart = [];
    saveCart();
    renderCart();
    updateCartBadge();
    closeCheckoutModal();

    // Show Confirmation Modal
    openConfirmationModal(order, whatsappUrl, whatsappMsg);

    // Open WhatsApp popup
    try {
      window.open(whatsappUrl, '_blank');
    } catch (popupErr) {
      console.warn('Popup blocked, customer can use modal buttons', popupErr);
    }

    showToast(getLanguage() === 'en' ? `Order #${orderId} placed successfully!` : `تم تسجيل الطلب ${orderId} بنجاح!`);
  } catch (err) {
    console.error('Failed to create order:', err);
    showToast('حدث خطأ أثناء حفظ الطلب، لم يتم مسح السلة. يرجى المحاولة مرة أخرى.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

export function openConfirmationModal(order, whatsappUrl, whatsappMsg) {
  const modal = document.getElementById('order-confirmation-modal');
  const idEl = document.getElementById('confirmed-order-id');
  const reopenBtn = document.getElementById('reopen-whatsapp-btn');
  const copyBtn = document.getElementById('copy-order-msg-btn');
  const copyBtnText = document.getElementById('copy-btn-text');
  const copyIdBtn = document.getElementById('copy-order-id-btn');
  const summaryEl = document.getElementById('confirmed-order-summary');
  const trackBtn = document.getElementById('track-confirmed-order-btn');

  const isEn = (order.lang || getLanguage()) === 'en';
  const curr = isEn ? 'EGP' : 'ج.م';

  if (idEl) idEl.textContent = order.id;

  if (modal) {
    const heading = modal.querySelector('h3');
    if (heading) heading.textContent = isEn ? 'Order Confirmed' : 'تم تسجيل طلبك بنجاح!';
    const badge = modal.querySelector('span.rounded-full');
    if (badge) badge.textContent = isEn ? 'Status: Awaiting Confirmation' : 'الحالة: بانتظار التأكيد (Awaiting Confirmation)';
    const idLabel = modal.querySelector('p.text-xs.text-zinc-500');
    if (idLabel) idLabel.textContent = isEn ? 'Order Number:' : 'رقم الطلب الخاص بك:';
  }

  if (copyIdBtn) {
    const copyLabel = copyIdBtn.querySelector('span');
    if (copyLabel) copyLabel.textContent = isEn ? 'Copy' : 'نسخ';
    copyIdBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(order.id);
        showToast(isEn ? `Order #${order.id} copied to clipboard!` : `تم نسخ رقم الطلب #${order.id} بنجاح!`);
      } catch (e) {
        showToast(isEn ? 'Could not copy order number' : 'تعذر النسخ التلقائي لرقم الطلب', 'warning');
      }
    };
  }

  if (summaryEl) {
    const linesCount = (order.lines || order.items || []).length;
    summaryEl.innerHTML = `
      <div class="flex justify-between text-zinc-900 font-bold border-b border-zinc-200 pb-1.5 mb-1.5">
        <span>${isEn ? 'Total Due:' : 'الإجمالي المستحق:'}</span>
        <span class="text-[#FF5000] text-sm">${order.total} ${curr}</span>
      </div>
      <div class="flex justify-between text-zinc-600">
        <span>${isEn ? 'Items Count:' : 'عدد البنود:'}</span>
        <span class="text-zinc-900 font-bold">${linesCount} ${isEn ? 'items' : 'بنود'}</span>
      </div>
      <div class="flex justify-between text-zinc-600">
        <span>${isEn ? 'Payment Method:' : 'طريقة الدفع:'}</span>
        <span class="text-zinc-900">${escapeHtml(order.paymentMethod ? (order.paymentMethod === 'cod' ? (isEn ? 'Cash on Delivery (COD)' : 'عند الاستلام (COD)') : (order.paymentMethod === 'instapay' ? 'InstaPay' : 'Vodafone Cash')) : (order.payment || (isEn ? 'Cash on Delivery' : 'عند الاستلام')))}</span>
      </div>
      <div class="flex justify-between text-zinc-600">
        <span>${isEn ? 'Delivery Address:' : 'عنوان التوصيل:'}</span>
        <span class="text-zinc-900 truncate max-w-[200px]">${escapeHtml(order.customer?.city || order.customer?.governorate || '')} - ${escapeHtml(order.customer?.address || '')}</span>
      </div>
    `;
  }

  if (trackBtn) {
    const trackSpan = trackBtn.querySelector('span');
    if (trackSpan) trackSpan.textContent = isEn ? 'Track Your Order Now' : 'تتبع مسار طلبك الآن';
    trackBtn.href = `#/track/${encodeURIComponent(order.id)}`;
    trackBtn.onclick = () => {
      closeConfirmationModal();
      window.location.hash = `#/track/${encodeURIComponent(order.id)}`;
    };
  }

  if (reopenBtn) {
    const reopenSpan = reopenBtn.querySelector('span');
    if (reopenSpan) reopenSpan.textContent = isEn ? `Open WhatsApp (${CONFIG.WHATSAPP_DISPLAY})` : `إعادة فتح محادثة واتساب (${CONFIG.WHATSAPP_DISPLAY})`;
    reopenBtn.onclick = () => {
      window.open(whatsappUrl, '_blank');
    };
  }

  if (copyBtn) {
    if (copyBtnText) copyBtnText.textContent = isEn ? 'Copy WhatsApp Message' : 'نسخ نص رسالة الطلب يدوياً';
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(whatsappMsg);
        if (copyBtnText) copyBtnText.textContent = isEn ? 'Message Copied!' : 'تم نسخ الرسالة بنجاح!';
        showToast(isEn ? 'WhatsApp message copied to clipboard' : 'تم نسخ نص رسالة الطلب للحافظة بنجاح');
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = isEn ? 'Copy WhatsApp Message' : 'نسخ نص رسالة الطلب يدوياً';
        }, 3000);
      } catch (e) {
        showToast(isEn ? 'Could not copy message' : 'تعذر النسخ التلقائي، يمكنك تحديد النص ونسخه يدوياً', 'warning');
      }
    };
  }

  if (modal) modal.classList.remove('hidden');

  const shareProofBtn = document.getElementById('share-proof-whatsapp-btn');
  const hasProof = Boolean(order.paymentProof || (order.payment && order.payment.proofAttached) || (order.paymentMethod && order.paymentMethod !== 'cod'));
  if (shareProofBtn) {
    if (hasProof) {
      shareProofBtn.classList.remove('hidden');
      shareProofBtn.onclick = () => {
        const text = encodeURIComponent(`مرحباً، مرفق إشعار التحويل لطلب رقم #${order.id} بمبلغ ${order.total} ج.م`);
        window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${text}`, '_blank');
      };
    } else {
      shareProofBtn.classList.add('hidden');
    }
  }
}

export function closeConfirmationModal() {
  const modal = document.getElementById('order-confirmation-modal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================
// PAYMENT METHOD SELECTION & DETAILS (R12)
// ==========================================
export function handlePaymentMethodChange(method) {
  state.paymentMethod = method;
  const detailsEl = document.getElementById('payment-method-details');
  const proofGroup = document.getElementById('payment-proof-group');
  if (!detailsEl) return;

  const isAr = getLanguage() === 'ar';
  const curr = isAr ? 'ج.م' : 'EGP';
  const calc = calculateCart({
    items: state.cart,
    coupon: state.coupon,
    governorate: state.selectedGovernorate
  });

  if (method === 'instapay') {
    detailsEl.innerHTML = `
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-zinc-900">${isAr ? 'الدفع عبر تطبيق InstaPay المعتمد:' : 'Official InstaPay Transfer:'}</span>
          <span class="text-zinc-600 font-mono text-xs">${isAr ? 'المطلوب:' : 'Due:'} <strong class="text-[#FF5000]">${calc.total} ${curr}</strong></span>
        </div>
        <div class="flex items-center justify-between bg-white p-2 rounded-lg border border-purple-200">
          <span class="font-mono font-black text-purple-900 select-all" id="instapay-handle-text">stickify21@instapay</span>
          <button type="button" onclick="copyToClipboardText('stickify21@instapay')" class="copy-btn px-2.5 py-1 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-800 text-[11px] font-bold transition flex items-center gap-1">
            <span>${isAr ? 'نسخ' : 'Copy'}</span>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
        </div>
        <p class="text-[10px] text-purple-800">${isAr ? 'يرجى تحويل المبلغ بدقة ورفع صورة الإشعار بالأسفل لتأكيد حجز طلبك فورياً.' : 'Please transfer the exact amount and attach your receipt screenshot below to confirm your order.'}</p>
      </div>
    `;
    detailsEl.className = 'mt-2 p-3 rounded-xl bg-purple-50/80 border border-purple-200/80 text-[11px] text-purple-950 leading-relaxed';
    if (proofGroup) proofGroup.classList.remove('hidden');
  } else if (method === 'vodafone_cash') {
    detailsEl.innerHTML = `
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-zinc-900">${isAr ? 'التحويل عبر محفظة فودافون كاش:' : 'Vodafone Cash Wallet Transfer:'}</span>
          <span class="text-zinc-600 font-mono text-xs">${isAr ? 'المطلوب:' : 'Due:'} <strong class="text-[#FF5000]">${calc.total} ${curr}</strong></span>
        </div>
        <div class="flex items-center justify-between bg-white p-2 rounded-lg border border-rose-200">
          <span class="font-mono font-black text-rose-900 select-all" id="vodafone-number-text">01043546503</span>
          <button type="button" onclick="copyToClipboardText('01043546503')" class="copy-btn px-2.5 py-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-bold transition flex items-center gap-1">
            <span>${isAr ? 'نسخ' : 'Copy'}</span>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
        </div>
        <p class="text-[10px] text-rose-800">${isAr ? 'يرجى تحويل المبلغ لرقم الكاش الموضح ورفع لقطة شاشة التحويل بالأسفل لتأكيد حجز طلبك.' : 'Please transfer to the wallet number above and upload the confirmation screenshot below.'}</p>
      </div>
    `;
    detailsEl.className = 'mt-2 p-3 rounded-xl bg-rose-50/80 border border-rose-200/80 text-[11px] text-rose-950 leading-relaxed';
    if (proofGroup) proofGroup.classList.remove('hidden');
  } else {
    detailsEl.innerHTML = isAr
      ? `الدفع نقداً للمندوب عند استلام الشحنة ومعاينتها والتأكد من سلامتها.`
      : `Pay cash directly to the courier upon receiving and inspecting your package.`;
    detailsEl.className = 'mt-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed';
    if (proofGroup) proofGroup.classList.add('hidden');
  }
}

export async function handlePaymentProofSelected(event) {
  const file = event.target.files?.[0];
  const errEl = document.getElementById('payment-proof-error');
  const previewBox = document.getElementById('payment-proof-preview');
  const previewImg = document.getElementById('payment-proof-preview-img');
  const filenameEl = document.getElementById('payment-proof-filename');

  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }

  if (!file) {
    state.checkoutPaymentProof = null;
    if (previewBox) previewBox.classList.add('hidden');
    return;
  }

  const check = await validateFile(file, UPLOAD_POLICIES.paymentProof, getLanguage());
  if (!check.valid) {
    if (errEl) {
      errEl.textContent = check.reason;
      errEl.classList.remove('hidden');
    }
    event.target.value = '';
    state.checkoutPaymentProof = null;
    if (previewBox) previewBox.classList.add('hidden');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    state.checkoutPaymentProof = e.target.result;
    if (previewImg) previewImg.src = e.target.result;
    if (filenameEl) filenameEl.textContent = check.cleanName;
    if (previewBox) previewBox.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

export function clearPaymentProof() {
  state.checkoutPaymentProof = null;
  const fileInput = document.getElementById('payment-proof-file');
  if (fileInput) fileInput.value = '';
  const previewBox = document.getElementById('payment-proof-preview');
  if (previewBox) previewBox.classList.add('hidden');
}

export async function copyToClipboardText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`تم نسخ [${text}] بنجاح`);
  } catch (e) {
    showToast('تعذر النسخ التلقائي، يمكنك النسخ يدوياً', 'warning');
  }
}

export function sharePaymentProofOnWhatsApp() {
  const text = encodeURIComponent(`مرحباً، مرفق إشعار التحويل لتأكيد الطلب`);
  window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${text}`, '_blank');
}

// ==========================================
// PRODUCT DETAIL MODAL & HASH ROUTING
// ==========================================
export async function openProductDetailModal(productId, updateHash = true) {
  let product = state.products.find(p => p.id === productId);
  if (!product) {
    product = await storage.getProduct(productId);
  }
  if (!product) {
    showToast('المنتج المطلوب غير موجود أو تم حذفه', 'error');
    if (window.location.hash.startsWith('#/product')) {
      window.location.hash = '';
    }
    return;
  }

  const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
  state.productDetail = {
    productId: product.id,
    selectedSize: isBookmark ? 'standard' : (state.selectedSizes[product.id] || 'medium'),
    selectedFinish: product.finish || 'matte',
    quantity: 1
  };

  renderProductDetailModal(product);
  analytics.trackViewItem(product);
  recordRecentlyViewed(product.id);

  const modal = document.getElementById('product-detail-modal');
  if (modal) modal.classList.remove('hidden');

  if (updateHash && window.location.hash !== `#/product/${product.id}`) {
    window.location.hash = `#/product/${product.id}`;
  }
}

export function closeProductDetailModal() {
  const modal = document.getElementById('product-detail-modal');
  if (modal) modal.classList.add('hidden');
  if (window.location.hash.startsWith('#/product')) {
    history.pushState('', document.title, window.location.pathname + window.location.search);
  }
}

export function selectProductDetailSize(sizeKey) {
  state.productDetail.selectedSize = sizeKey;
  const product = state.products.find(p => p.id === state.productDetail.productId);
  if (product) renderProductDetailModal(product);
}

export function selectProductDetailFinish(finishKey) {
  state.productDetail.selectedFinish = finishKey;
  const product = state.products.find(p => p.id === state.productDetail.productId);
  if (product) renderProductDetailModal(product);
}

export function updateProductDetailQty(delta) {
  const current = state.productDetail.quantity || 1;
  const next = Math.max(1, Math.min(99, current + delta));
  state.productDetail.quantity = next;
  const qtyEl = document.getElementById('product-detail-qty-val');
  if (qtyEl) qtyEl.textContent = next;
  
  const product = state.products.find(p => p.id === state.productDetail.productId);
  if (product) {
    const unitPrice = getProductPriceForSize(product, state.productDetail.selectedSize, state.productDetail.selectedFinish);
    const totalPriceEl = document.getElementById('product-detail-total-price');
    const curr = getLanguage() === 'en' ? 'EGP' : 'ج.م';
    if (totalPriceEl) totalPriceEl.textContent = `${unitPrice * next} ${curr}`;
  }
}

export function addProductDetailToCart() {
  const product = state.products.find(p => p.id === state.productDetail.productId);
  if (!product) return;

  const stockCheck = checkProductStock(product);
  if (!stockCheck.available) {
    showToast('عذراً، هذا المنتج غير متوفر حالياً', 'error');
    return;
  }

  const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
  const sizeKey = isBookmark ? 'standard' : state.productDetail.selectedSize;
  const finishKey = state.productDetail.selectedFinish;
  const unitPrice = getProductPriceForSize(product, sizeKey, finishKey);
  const qty = state.productDetail.quantity || 1;

  const sizeLabel = isBookmark 
    ? CONFIG.BOOKMARK_SPECS.dimensions
    : (sizeKey === 'small' ? '6 سم (Small)' : (sizeKey === 'large' ? '10 سم (Large)' : '8 سم (Medium)'));

  const finishLabel = finishKey === 'glossy' ? 'لامع' : 'مطفي';

  const lineKey = generateCartLineKey({ productId: product.id, sizeKey });
  const existingIndex = state.cart.findIndex(i => i.id === lineKey);

  if (existingIndex > -1) {
    state.cart[existingIndex].quantity += qty;
  } else {
    state.cart.push({
      id: lineKey,
      productId: product.id,
      sku: product.sku || 'S21',
      nameAr: product.nameAr,
      name: product.name,
      type: isBookmark ? 'bookmark' : 'sticker',
      size: `${sizeLabel} (${finishLabel})`,
      sizeKey: sizeKey,
      finish: finishKey,
      price: unitPrice,
      quantity: qty,
      image: product.image,
      svg: product.svg
    });
  }

  saveCart();
  renderCart();
  updateCartBadge();
  closeProductDetailModal();
  const isArToast = getLanguage() === 'ar';
  showToast(isArToast
    ? `تمت إضافة ${qty} قطعة من "${product.nameAr}" إلى السلة`
    : `Added ${qty}x "${product.nameEn || product.name}" to cart`);
  toggleCartModal(true);
}

export function addDetailProductToMockup() {
  if (state.productDetail.productId) {
    addStickerToMockup(state.productDetail.productId);
    closeProductDetailModal();
    document.getElementById('mockup-studio-section')?.scrollIntoView({ behavior: 'smooth' });
    showToast('تمت إضافة التصميم إلى استوديو المعاينة');
  }
}

export function renderProductDetailModal(product) {
  const container = document.getElementById('product-detail-content');
  if (!container) return;

  const isAr = getLanguage() === 'ar';
  const curr = isAr ? 'ج.م' : 'EGP';
  const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
  const hasImage = Boolean(product.image);
  const safeImage = sanitizeUrl(product.image);
  const safeSvg = sanitizeSvg(product.svg);

  const stockCheck = checkProductStock(product);
  const isOutOfStock = !stockCheck.available;

  const currentSizeKey = state.productDetail.selectedSize;
  const currentFinishKey = state.productDetail.selectedFinish;
  const unitPrice = getProductPriceForSize(product, currentSizeKey, currentFinishKey);
  const qty = state.productDetail.quantity || 1;
  const totalPrice = unitPrice * qty;

  const smallPrice = getProductPriceForSize(product, 'small', currentFinishKey);
  const medPrice = getProductPriceForSize(product, 'medium', currentFinishKey);
  const largePrice = getProductPriceForSize(product, 'large', currentFinishKey);

  const displayName = isAr ? (product.nameAr || product.name) : (product.nameEn || product.name || product.nameAr);
  const displayBadge = isAr
    ? (product.badgeAr || product.badge || (isBookmark ? 'فاصل كتب' : 'استيكر فينيل'))
    : (product.badgeEn || (isBookmark ? 'Bookmark' : 'Vinyl Sticker'));
  const displayDesc = isAr ? (product.descAr || product.desc) : (product.descEn || product.desc || product.descAr);

  let stageClass = 'w-40 h-40';
  if (isBookmark) {
    stageClass = 'w-32 h-52';
  } else if (currentSizeKey === 'small') {
    stageClass = 'w-32 h-32';
  } else if (currentSizeKey === 'large') {
    stageClass = 'w-48 h-48';
  }

  // Related products (from same category, max 3)
  const relatedProducts = state.products
    .filter(p => p.id !== product.id && (p.category === product.category || isBookmark === (p.category === 'bookmarks')))
    .slice(0, 3);

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start pt-2">
      
      <!-- Left: Visual Graphic Stage (5 cols) -->
      <div class="md:col-span-5 flex flex-col items-center">
        <div class="w-full aspect-square rounded-3xl bg-zinc-50 border border-zinc-200/90 p-8 flex items-center justify-center relative overflow-hidden shadow-inner">
          <div data-allow-arabic="true" class="${stageClass} sticker-diecut-minimal flex items-center justify-center transition-all duration-300">
            ${hasImage && safeImage ? `<img src="${safeImage}" alt="${escapeHtml(displayName)}" class="w-full h-full object-contain pointer-events-none">` : safeSvg}
          </div>
          <span class="absolute bottom-3 right-3 text-[10px] font-mono text-zinc-400 font-semibold bg-white/80 px-2 py-0.5 rounded-full border border-zinc-200">
            ${isBookmark ? '350gsm Cardstock' : 'Vinyl Die-Cut'}
          </span>
        </div>

        <button onclick="addDetailProductToMockup()" class="mt-4 w-full py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition flex items-center justify-center gap-1.5">
          <span>${isAr ? 'تجربة على الأجهزة (المعاينة)' : 'Preview on Device'}</span>
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 21h8m-4-4v4"/></svg>
        </button>
      </div>

      <!-- Right: Product Details & Controls (7 cols) -->
      <div class="md:col-span-7 space-y-5 ${isAr ? 'text-right' : 'text-left'}">
        
        <div>
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-xs font-bold px-3 py-1 rounded-full ${isBookmark ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-[#FF5000]/10 text-[#FF5000] border border-[#FF5000]/20'}">
              ${escapeHtml(displayBadge)}
            </span>
            <span class="font-mono text-xs text-zinc-400 font-bold">#${escapeHtml(product.sku)}</span>
          </div>

          <h2 class="text-2xl font-extrabold text-zinc-900 leading-snug">${escapeHtml(displayName)}</h2>
          ${isAr && product.name ? `<p class="text-xs font-mono text-zinc-400 mt-0.5">${escapeHtml(product.name)}</p>` : ''}
          <p class="text-xs text-zinc-600 mt-3 leading-relaxed">${escapeHtml(displayDesc)}</p>
        </div>

        <!-- Size Options -->
        ${!isBookmark ? `
          <div>
            <label class="block text-xs font-bold text-zinc-800 mb-1.5">${isAr ? 'المقاس:' : 'Size:'}</label>
            <div class="grid grid-cols-3 gap-2 text-xs font-semibold text-center">
              <button type="button" onclick="selectProductDetailSize('small')" class="p-2.5 rounded-xl border transition ${currentSizeKey === 'small' ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-black'}">
                <span>${isAr ? '6 سم (Small)' : '6 cm (Small)'}</span>
                <span class="block text-[10px] font-mono mt-0.5 opacity-80">${smallPrice} ${curr}</span>
              </button>
              <button type="button" onclick="selectProductDetailSize('medium')" class="p-2.5 rounded-xl border transition ${currentSizeKey === 'medium' ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-black'}">
                <span>${isAr ? '8 سم (Medium)' : '8 cm (Medium)'}</span>
                <span class="block text-[10px] font-mono mt-0.5 opacity-80">${medPrice} ${curr}</span>
              </button>
              <button type="button" onclick="selectProductDetailSize('large')" class="p-2.5 rounded-xl border transition ${currentSizeKey === 'large' ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-black'}">
                <span>${isAr ? '10 سم (Large)' : '10 cm (Large)'}</span>
                <span class="block text-[10px] font-mono mt-0.5 opacity-80">${largePrice} ${curr}</span>
              </button>
            </div>
          </div>
        ` : `
          <div class="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-xs text-amber-950 space-y-1">
            <p class="font-bold">${isAr ? 'مواصفات فاصل الكتب القياسي:' : 'Standard Bookmark Specs:'}</p>
            <p class="text-[11px] text-amber-900/90 leading-relaxed">
              ${isAr ? `المقاس: ${CONFIG.BOOKMARK_SPECS.dimensions} | كرتون كوشيه مقوى فاخر 350gsm | طبقة حماية سلوفان مطفي ناعمة فاخرة ضد الرطوبة.` : 'Dimensions: 15 × 5 cm | 350gsm Premium Artboard | Soft-touch matte protective laminate.'}
            </p>
          </div>
        `}

        <!-- Finish Options -->
        <div>
          <label class="block text-xs font-bold text-zinc-800 mb-1.5">${isAr ? 'اللمسة النهائية واللمعان:' : 'Finish:'}</label>
          <div id="modal-finish-options" class="grid grid-cols-2 gap-2 text-xs font-semibold text-center">
            <button type="button" onclick="selectProductDetailFinish('matte')" class="p-2.5 rounded-xl border transition ${currentFinishKey === 'matte' ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-black'}">
              <span>${isAr ? 'مطفي (Matte)' : 'Matte'}</span>
            </button>
            <button type="button" onclick="selectProductDetailFinish('glossy')" class="p-2.5 rounded-xl border transition ${currentFinishKey === 'glossy' ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-black'}">
              <span>${isAr ? 'لامع (Glossy)' : 'Glossy'}</span>
            </button>
          </div>
        </div>

        <!-- Quantity & Price Summary -->
        <div class="pt-4 border-t border-zinc-100 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-xs font-bold text-zinc-700">${isAr ? 'الكمية:' : 'Quantity:'}</span>
            <div class="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl">
              <button type="button" onclick="updateProductDetailQty(-1)" class="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 font-bold text-sm flex items-center justify-center transition active:scale-95">-</button>
              <span id="product-detail-qty-val" class="w-8 text-center font-mono font-bold text-xs">${qty}</span>
              <button type="button" onclick="updateProductDetailQty(1)" class="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 font-bold text-sm flex items-center justify-center transition active:scale-95">+</button>
            </div>
          </div>

          <div class="text-left font-mono">
            <span class="text-[10px] text-zinc-400 block font-sans">${isAr ? 'الإجمالي:' : 'Total:'}</span>
            <span id="product-detail-total-price" class="text-2xl font-black text-[#FF5000]">${totalPrice} ${curr}</span>
          </div>
        </div>

        <!-- Add to cart CTA -->
        <button ${isOutOfStock ? 'disabled' : 'onclick="addProductDetailToCart()"'} class="w-full py-4 rounded-2xl ${isOutOfStock ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-zinc-900 hover:bg-[#FF5000] text-white active:scale-95'} font-bold text-xs shadow-md transition flex items-center justify-center gap-2">
          <span>${isOutOfStock ? (isAr ? 'المنتج نفد من المخزون' : 'Out of Stock') : (isAr ? 'إضافة إلى سلة المشتريات' : 'Add to Cart')}</span>
        </button>

      </div>

    </div>

    <!-- Related Products -->
    ${relatedProducts.length > 0 ? `
      <div class="pt-6 border-t border-zinc-100 mt-6">
        <h4 class="text-xs font-extrabold text-zinc-900 mb-3 flex items-center justify-between">
          <span>${isAr ? 'منتجات مشابهة قد تعجبك:' : 'Related Designs'}</span>
          ${isAr ? '<span class="text-[11px] font-normal text-zinc-400 font-mono">You might also like</span>' : ''}
        </h4>
        <div class="grid grid-cols-3 gap-3">
          ${relatedProducts.map(rel => {
            const relSafeImg = sanitizeUrl(rel.image);
            const relSafeSvg = sanitizeSvg(rel.svg);
            const relName = isAr ? (rel.nameAr || rel.name) : (rel.nameEn || rel.name || rel.nameAr);
            return `
              <div onclick="openProductDetailModal('${escapeHtml(rel.id)}')" class="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 hover:border-black cursor-pointer transition text-center group">
                <div data-allow-arabic="true" class="w-16 h-16 mx-auto flex items-center justify-center mb-2">
                  ${rel.image && relSafeImg ? `<img src="${relSafeImg}" alt="" class="w-12 h-12 object-contain">` : relSafeSvg}
                </div>
                <p class="text-xs font-bold text-zinc-900 truncate group-hover:text-[#FF5000] transition">${escapeHtml(relName)}</p>
                <p class="text-[11px] font-mono font-bold text-zinc-500 mt-0.5">${rel.price} ${curr}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// ==========================================
// ORDER TRACKING MODAL & SEARCH
// ==========================================
export async function openOrderTrackingModal(prefill = '', updateHash = true) {
  const modal = document.getElementById('order-tracking-modal');
  if (modal) modal.classList.remove('hidden');

  const isAr = getLanguage() === 'ar';
  const input = document.getElementById('track-order-input');
  if (input && prefill) {
    input.value = prefill;
    await searchTrackOrder(prefill);
  } else {
    const container = document.getElementById('tracking-result-container');
    if (container && !input?.value) {
      container.innerHTML = `
        <div class="p-6 bg-zinc-50 border border-zinc-200 rounded-2xl text-center text-xs text-zinc-500 leading-relaxed">
          <span>${isAr ? 'أدخل رقم الطلب الخاص بك لمتابعة مسار شحن وتجهيز الاستيكرات والبوك مارك لحظة بلحظة.' : 'Enter your order number to track preparation and shipping status in real time.'}</span>
        </div>
      `;
    }
  }

  if (updateHash && !window.location.hash.startsWith('#/track')) {
    window.location.hash = prefill ? `#/track/${prefill}` : '#/track';
  }
}

export function closeOrderTrackingModal() {
  const modal = document.getElementById('order-tracking-modal');
  if (modal) modal.classList.add('hidden');
  if (window.location.hash.startsWith('#/track')) {
    history.pushState('', document.title, window.location.pathname + window.location.search);
  }
}

export async function handleTrackOrderSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('track-order-input');
  const query = (input?.value || '').trim();
  if (query) {
    window.location.hash = `#/track/${encodeURIComponent(query)}`;
    await searchTrackOrder(query);
  }
}

export async function searchTrackOrder(query) {
  const container = document.getElementById('tracking-result-container');
  if (!container) return;

  const isAr = getLanguage() === 'ar';
  const curr = isAr ? 'ج.م' : 'EGP';
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) {
    container.innerHTML = `
      <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 text-center font-semibold">
        ${isAr ? 'يرجى إدخال رقم الطلب (مثال: S21-261116-ABCD) أو رقم الهاتف' : 'Please enter your order number (e.g. S21-261116-ABCD) or phone number'}
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="py-8 text-center text-xs text-zinc-500 font-mono">
      <span>${isAr ? 'جاري البحث في سجلات الطلبات...' : 'Searching order records...'}</span>
    </div>
  `;

  const order = await storage.findOrder(cleanQuery);
  if (!order) {
    container.innerHTML = `
      <div class="p-6 bg-zinc-50 border border-zinc-200 rounded-2xl text-center space-y-3">
        <div class="w-10 h-10 mx-auto text-zinc-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
        <h4 class="font-bold text-sm text-zinc-900">${isAr ? 'لم يتم العثور على طلب بهذا الرقم' : 'Order Not Found'}</h4>
        <p class="text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto">
          ${isAr ? `لم نتمكن من العثور على طلب مسجل برقم <strong class="font-mono text-zinc-900">${escapeHtml(cleanQuery)}</strong> في متصفحك الحالي.` : `We could not find an order matching <strong class="font-mono text-zinc-900">${escapeHtml(cleanQuery)}</strong> in this browser.`}
        </p>
        <div class="p-3 bg-amber-50 rounded-xl text-[11px] text-amber-800 ${isAr ? 'text-right' : 'text-left'} leading-relaxed border border-amber-200/60">
          ${isAr ? '<strong>ملاحظة (DEMO):</strong> في هذه النسخة المحلية (Prototype)، تُحفظ الطلبات في متصفح العميل فقط حتى يتم تفعيل الخادم المركزي. يمكنك التواصل مع خدمة العملاء لمتابعة طلبك:' : '<strong>Note (DEMO):</strong> In this local prototype, orders are stored in your current browser until backend sync is enabled. You can contact support on WhatsApp:'}
        </div>
        <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(`مرحباً STICKIFY 21، أود الاستفسار عن حالة طلبي رقم: ${cleanQuery}`)}" target="_blank" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:bg-[#20ba59] transition shadow-sm">
          <span>${isAr ? `تواصل مع الدعم عبر واتساب (${CONFIG.WHATSAPP_DISPLAY})` : `Contact Support via WhatsApp (${CONFIG.WHATSAPP_DISPLAY})`}</span>
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
        </a>
      </div>
    `;
    return;
  }

  // Visual status timeline
  const lifecycleSteps = [
    { key: 'pending', label: isAr ? 'جديد' : 'New', icon: '1' },
    { key: 'awaiting_confirmation', label: isAr ? 'بانتظار التأكيد' : 'Awaiting', icon: '2' },
    { key: 'confirmed', label: isAr ? 'مؤكد' : 'Confirmed', icon: '3' },
    { key: 'preparing', label: isAr ? 'قيد التجهيز' : 'Preparing', icon: '4' },
    { key: 'ready', label: isAr ? 'تم التجهيز' : 'Ready', icon: '5' },
    { key: 'shipped', label: isAr ? 'تم الشحن' : 'Shipped', icon: '6' },
    { key: 'completed', label: isAr ? 'مكتمل' : 'Delivered', icon: '7' }
  ];

  const isCancelled = order.status === 'cancelled';
  const currentStepIdx = lifecycleSteps.findIndex(s => s.key === order.status);

  const timelineHtml = isCancelled ? `
    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl text-center text-xs text-red-800 font-bold mb-4">
      ${isAr ? 'تم إلغاء هذا الطلب. إذا كان لديك استفسار يرجى التواصل معنا عبر واتساب.' : 'This order has been cancelled. Contact us via WhatsApp if you have any questions.'}
    </div>
  ` : `
    <div class="py-4 px-2 bg-zinc-50 rounded-2xl border border-zinc-200 mb-5">
      <div class="flex items-center justify-between relative">
        <div class="absolute top-4 left-6 right-6 h-1 bg-zinc-200 z-0"></div>
        <div class="absolute top-4 ${isAr ? 'right-6' : 'left-6'} h-1 bg-[#FF5000] z-0 transition-all duration-300" style="width: ${Math.max(0, Math.min(100, (currentStepIdx / (lifecycleSteps.length - 1)) * 100))}%;"></div>
        ${lifecycleSteps.map((step, idx) => {
          const isPassed = currentStepIdx >= idx;
          const isCurrent = currentStepIdx === idx;
          return `
            <div class="relative z-10 flex flex-col items-center text-center">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${isCurrent ? 'bg-[#FF5000] text-white ring-4 ring-[#FF5000]/20 scale-110' : (isPassed ? 'bg-zinc-900 text-white' : 'bg-white border-2 border-zinc-300 text-zinc-400')}">
                ${step.icon}
              </div>
              <span class="text-[10px] mt-1.5 font-bold whitespace-nowrap ${isCurrent ? 'text-[#FF5000]' : (isPassed ? 'text-zinc-900' : 'text-zinc-400')}">
                ${step.label}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  const itemsHtml = (order.items || []).map(it => `
    <div class="flex items-center justify-between py-2 border-b border-zinc-100 text-xs">
      <div>
        <p class="font-bold text-zinc-900">${escapeHtml(isAr ? (it.nameAr || it.name) : (it.nameEn || it.name || it.nameAr))}</p>
        <p class="text-[11px] text-zinc-400 font-mono">${escapeHtml(it.size || '')} | ${isAr ? 'الكمية' : 'Qty'}: ${it.quantity}</p>
      </div>
      <div class="font-mono font-bold text-zinc-900">
        ${it.price * it.quantity} ${curr}
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="space-y-4 ${isAr ? 'text-right' : 'text-left'}">
      <div class="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 flex items-center justify-between">
        <div>
          <span class="text-[10px] text-zinc-400 font-mono block">${isAr ? 'رقم الطلب' : 'Order Number'}</span>
          <span class="font-mono font-black text-sm text-[#FF5000]">${escapeHtml(order.id)}</span>
        </div>
        <div class="${isAr ? 'text-left' : 'text-right'}">
          <span class="text-[10px] text-zinc-400 font-mono block">${isAr ? 'تاريخ التسجيل' : 'Order Date'}</span>
          <span class="text-xs font-semibold text-zinc-700">${new Date(order.date || Date.now()).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}</span>
        </div>
      </div>

      ${timelineHtml}

      <div class="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3">
        <h5 class="text-xs font-bold text-zinc-900 pb-2 border-b border-zinc-100">${isAr ? 'تفاصيل الشحن والعميل:' : 'Shipping & Customer Details:'}</h5>
        <div class="grid grid-cols-2 gap-2 text-xs text-zinc-600">
          <div><span class="text-zinc-400">${isAr ? 'الاسم:' : 'Name:'}</span> <strong class="text-zinc-900">${escapeHtml(order.customer?.name || '')}</strong></div>
          <div><span class="text-zinc-400">${isAr ? 'الهاتف:' : 'Phone:'}</span> <strong class="text-zinc-900 font-mono">${escapeHtml(order.customer?.phone || '')}</strong></div>
          <div><span class="text-zinc-400">${isAr ? 'المحافظة:' : 'Governorate:'}</span> <strong class="text-zinc-900">${escapeHtml(translateGovernorate(order.customer?.governorate || order.customer?.city || '', getLanguage()))}</strong></div>
          <div><span class="text-zinc-400">${isAr ? 'طريقة الدفع:' : 'Payment:'}</span> <strong class="text-zinc-900">${escapeHtml(typeof order.payment === 'string' ? order.payment : (order.paymentMethod || 'COD'))}</strong></div>
          <div class="col-span-2"><span class="text-zinc-400">${isAr ? 'العنوان:' : 'Address:'}</span> <strong class="text-zinc-900">${escapeHtml(order.customer?.address || '')}</strong></div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-zinc-200 p-4 space-y-2">
        <h5 class="text-xs font-bold text-zinc-900 pb-1">${isAr ? 'محتويات الطلب:' : 'Order Items:'}</h5>
        ${itemsHtml}
        <div class="pt-2 border-t border-zinc-100 space-y-1 text-xs">
          <div class="flex justify-between text-zinc-500"><span>${isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span><span class="font-mono">${order.subtotal} ${curr}</span></div>
          ${order.discount ? `<div class="flex justify-between text-emerald-600"><span>${isAr ? 'الخصم:' : 'Discount:'}</span><span class="font-mono">-${order.discount} ${curr}</span></div>` : ''}
          <div class="flex justify-between text-zinc-500"><span>${isAr ? 'مصاريف الشحن:' : 'Shipping:'}</span><span class="font-mono">${order.shippingCost === 0 ? (isAr ? 'مجاناً' : 'Free') : `${order.shippingCost} ${curr}`}</span></div>
          <div class="flex justify-between font-extrabold text-sm text-zinc-900 pt-1 border-t border-zinc-100">
            <span>${isAr ? 'الإجمالي:' : 'Total:'}</span>
            <span class="font-mono text-[#FF5000]">${order.total} ${curr}</span>
          </div>
        </div>
      </div>

      <div class="pt-2">
        <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(`مرحباً STICKIFY 21، أود المتابعة بخصوص طلبي رقم: ${order.id}`)}" target="_blank" class="w-full py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm">
          <span>${isAr ? 'متابعة الطلب مع الدعم الفني على واتساب' : 'Follow Up on WhatsApp'}</span>
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
        </a>
      </div>
    </div>
  `;
}

// ==========================================
// CUSTOM PRINT STUDIO (R14 Multi-Format Safe Uploads, Original Bytes & 300 DPI)
// ==========================================
function getCustomUploadPolicy() {
  const cfg = state.settings?.customUpload || {};
  return {
    allowedExtensions: Array.isArray(cfg.allowedExtensions) && cfg.allowedExtensions.length > 0
      ? cfg.allowedExtensions
      : DEFAULT_CUSTOM_UPLOAD_POLICY.allowedExtensions,
    maxFileSizeMb: Number(cfg.maxFileSizeMb) > 0 ? Number(cfg.maxFileSizeMb) : DEFAULT_CUSTOM_UPLOAD_POLICY.maxFileSizeMb,
    maxFiles: Number(cfg.maxFiles) > 0 ? Number(cfg.maxFiles) : DEFAULT_CUSTOM_UPLOAD_POLICY.maxFiles,
    maxTotalSizeMb: Number(cfg.maxTotalSizeMb) > 0 ? Number(cfg.maxTotalSizeMb) : DEFAULT_CUSTOM_UPLOAD_POLICY.maxTotalSizeMb
  };
}

function updateCustomDpiWarning() {
  const warnEl = document.getElementById('custom-dpi-warning');
  if (!warnEl) return;
  const isAr = getLanguage() === 'ar';
  const lowResItems = (state.customPrint.files || []).filter(f => {
    if (!f.dimensions || !f.dimensions.width || !f.dimensions.height) return false;
    const dpiInfo = checkPrintDpi(f.dimensions.width, f.dimensions.height, state.customPrint.size);
    f.dpiInfo = dpiInfo;
    return dpiInfo.isLowRes;
  });

  if (lowResItems.length > 0) {
    const first = lowResItems[0];
    warnEl.textContent = isAr
      ? `تنبيه دقة الطباعة (300 DPI): الملف "${first.cleanName}" أبعاده ${first.dimensions.width}×${first.dimensions.height}px (${first.dpiInfo.dpi} DPI) أقل من الدقة المثالية لمقاس ${first.dpiInfo.cm} سم (الموصى به ≥ ${first.dpiInfo.minRequiredPx}px).`
      : `Print resolution warning (300 DPI): "${first.cleanName}" is ${first.dimensions.width}×${first.dimensions.height}px (${first.dpiInfo.dpi} DPI), below optimal 300 DPI for ${first.dpiInfo.cm} cm (recommended ≥ ${first.dpiInfo.minRequiredPx}px).`;
    warnEl.classList.remove('hidden');
  } else {
    warnEl.textContent = '';
    warnEl.classList.add('hidden');
  }
}

function renderCustomFilesList() {
  const listEl = document.getElementById('custom-files-list');
  const dropPrompt = document.getElementById('dropzone-prompt');
  const dropPreview = document.getElementById('dropzone-preview');
  const nameEl = document.getElementById('preview-file-name');
  const sizeEl = document.getElementById('preview-file-size');
  const mediaBox = document.getElementById('preview-media-box');
  const isAr = getLanguage() === 'ar';

  const items = state.customPrint.files || [];
  if (items.length === 0) {
    if (dropPrompt) dropPrompt.classList.remove('hidden');
    if (dropPreview) dropPreview.classList.add('hidden');
    if (listEl) {
      listEl.innerHTML = '';
      listEl.classList.add('hidden');
    }
    updateCustomDpiWarning();
    return;
  }

  const first = items[0];
  state.customPrint.file = first.originalFile;
  state.customPrint.fileName = items.map(i => i.cleanName).join(', ');
  state.customPrint.fileSize = items.reduce((sum, i) => sum + (i.size || 0), 0);

  if (nameEl) nameEl.textContent = items.length === 1 ? first.cleanName : (isAr ? `${items.length} ملفات جاهزة للطباعة` : `${items.length} files ready to print`);
  if (sizeEl) sizeEl.textContent = `${(state.customPrint.fileSize / (1024 * 1024)).toFixed(2)} MB`;

  if (mediaBox) {
    if (first.previewImgUrl) {
      mediaBox.innerHTML = `<img src="${escapeHtml(first.previewImgUrl)}" alt="${escapeHtml(first.cleanName)}" class="w-full h-full object-contain">`;
    } else {
      mediaBox.innerHTML = `<span class="text-[11px] text-zinc-700 font-mono font-black uppercase">${escapeHtml(first.kind || 'FILE')}</span>`;
    }
  }

  if (dropPrompt) dropPrompt.classList.add('hidden');
  if (dropPreview) dropPreview.classList.remove('hidden');

  if (listEl) {
    listEl.innerHTML = items.map((entry, idx) => {
      const sizeStr = entry.size < 1024 * 1024
        ? `${Math.max(1, Math.round(entry.size / 1024))} KB`
        : `${(entry.size / (1024 * 1024)).toFixed(2)} MB`;
      const dimsStr = entry.dimensions ? `${entry.dimensions.width}×${entry.dimensions.height}px` : entry.kind.toUpperCase();
      return `
        <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shrink-0 overflow-hidden">
              ${entry.previewImgUrl
                ? `<img src="${escapeHtml(entry.previewImgUrl)}" alt="" class="w-full h-full object-contain">`
                : `<span class="text-[9px] font-mono font-black text-zinc-700 uppercase">${escapeHtml(entry.kind)}</span>`}
            </div>
            <div class="min-w-0">
              <p class="font-bold text-zinc-900 truncate">${escapeHtml(entry.cleanName)}</p>
              <p class="text-[10px] text-zinc-500 font-mono">${escapeHtml(sizeStr)} | ${escapeHtml(dimsStr)}</p>
            </div>
          </div>
          <button type="button" onclick="removeCustomFile(${idx})" class="text-[11px] text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded-lg hover:bg-red-50 transition">
            ${isAr ? 'حذف' : 'Remove'}
          </button>
        </div>
      `;
    }).join('');
    listEl.classList.remove('hidden');
  }

  updateCustomDpiWarning();
}

export function removeCustomFile(idx) {
  const items = state.customPrint.files || [];
  const removed = items.splice(idx, 1)[0];
  if (removed && removed.previewImgUrl && removed.previewImgUrl.startsWith('blob:')) {
    try { URL.revokeObjectURL(removed.previewImgUrl); } catch (e) {}
  }
  renderCustomFilesList();
}

export async function handleCustomFileSelect(fileList) {
  const errorEl = document.getElementById('custom-file-error');
  const isAr = getLanguage() === 'ar';
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  if (!fileList || fileList.length === 0) return;
  const files = Array.from(fileList);
  const policyCfg = getCustomUploadPolicy();

  if (files.length > policyCfg.maxFiles) {
    if (errorEl) {
      errorEl.textContent = isAr
        ? `الحد الأقصى هو ${policyCfg.maxFiles} ملفات في الطلب الواحد.`
        : `Maximum ${policyCfg.maxFiles} files allowed per request.`;
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalBytes > policyCfg.maxTotalSizeMb * 1024 * 1024) {
    if (errorEl) {
      errorEl.textContent = isAr
        ? `الحجم الإجمالي للملفات يتجاوز الحد المسموح (${policyCfg.maxTotalSizeMb} ميجابايت).`
        : `Total files size exceeds the ${policyCfg.maxTotalSizeMb} MB limit.`;
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const filePolicy = {
    name: 'custom_print',
    allowedExtensions: policyCfg.allowedExtensions,
    maxBytes: policyCfg.maxFileSizeMb * 1024 * 1024,
    requireImageDecode: false
  };

  const validated = [];
  for (const file of files) {
    const res = await validateFile(file, filePolicy, getLanguage());
    if (!res.valid) {
      if (errorEl) {
        errorEl.textContent = res.reason;
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // Build safe preview URL:
    // - SVG: ALWAYS sanitize first and render via <img src="blob:..."> (never inline DOM!)
    // - Web raster (png/jpg/webp/gif/bmp): blob URL of original file
    // - Vector/Print docs (pdf/ai/eps/psd/cdr/tiff/heic): icon + name + size only
    let previewImgUrl = '';
    let fileToStore = file;
    if (res.kind === 'svg') {
      const safeSvgBlob = new Blob([res.sanitizedSvgText], { type: 'image/svg+xml' });
      fileToStore = new File([safeSvgBlob], res.cleanName, { type: 'image/svg+xml' });
      previewImgUrl = URL.createObjectURL(safeSvgBlob);
    } else if (['png', 'jpg', 'webp', 'gif', 'bmp'].includes(res.kind)) {
      previewImgUrl = URL.createObjectURL(file);
    }

    validated.push({
      originalFile: fileToStore,
      cleanName: res.cleanName,
      kind: res.kind,
      ext: res.ext,
      size: fileToStore.size,
      sha256: res.sha256,
      dimensions: res.dimensions,
      previewImgUrl
    });
  }

  // Revoke previous object URLs
  (state.customPrint.files || []).forEach(old => {
    if (old.previewImgUrl && old.previewImgUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(old.previewImgUrl); } catch (e) {}
    }
  });

  state.customPrint.files = validated;
  renderCustomFilesList();
  showToast(isAr
    ? `تم تجهيز ${validated.length} ملف بنجاح (بالجودة الأصلية)`
    : `${validated.length} file(s) validated and ready at original quality`);
}

export function clearCustomUpload(e) {
  if (e) e.stopPropagation();
  (state.customPrint.files || []).forEach(old => {
    if (old.previewImgUrl && old.previewImgUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(old.previewImgUrl); } catch (err) {}
    }
  });
  state.customPrint.file = null;
  state.customPrint.files = [];
  state.customPrint.fileName = '';
  state.customPrint.fileSize = 0;

  const fileInput = document.getElementById('custom-file-input');
  if (fileInput) fileInput.value = '';

  renderCustomFilesList();
}

export function selectCustomSize(sizeKey) {
  state.customPrint.size = sizeKey;
  document.querySelectorAll('.custom-size-btn').forEach(btn => {
    btn.classList.remove('border-zinc-900', 'bg-zinc-900', 'text-white', 'active-custom-size');
    btn.classList.add('border-zinc-200', 'text-zinc-700');
  });
  const activeBtn = document.getElementById(`custom-size-${sizeKey}`);
  if (activeBtn) {
    activeBtn.classList.remove('border-zinc-200', 'text-zinc-700');
    activeBtn.classList.add('border-zinc-900', 'bg-zinc-900', 'text-white', 'active-custom-size');
  }
  updateCustomPrintSummary();
  updateCustomDpiWarning();
}

export function selectCustomFinish(finishKey) {
  state.customPrint.finish = finishKey;
  document.querySelectorAll('.custom-finish-btn').forEach(btn => {
    btn.classList.remove('border-zinc-900', 'bg-zinc-900', 'text-white', 'active-custom-finish');
    btn.classList.add('border-zinc-200', 'text-zinc-700');
  });
  const activeBtn = document.getElementById(`custom-finish-${finishKey}`);
  if (activeBtn) {
    activeBtn.classList.remove('border-zinc-200', 'text-zinc-700');
    activeBtn.classList.add('border-zinc-900', 'bg-zinc-900', 'text-white', 'active-custom-finish');
  }
  updateCustomPrintSummary();
}

export function adjustCustomQty(delta) {
  const current = state.customPrint.quantity || 10;
  const next = Math.max(10, current + delta);
  state.customPrint.quantity = next;
  const input = document.getElementById('custom-qty-input');
  if (input) input.value = next;
  updateCustomPrintSummary();
}

export function handleCustomQtyChange(val) {
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed >= 10) {
    state.customPrint.quantity = parsed;
    updateCustomPrintSummary();
  }
}

export function updateCustomPrintSummary() {
  const isAr = getLanguage() === 'ar';
  const curr = isAr ? 'ج.م' : 'EGP';
  const qty = Math.max(10, state.customPrint.quantity || 10);
  const summary = calculateCustomPrintSummary(qty, state.customPrint.size, state.customPrint.finish);

  const qtyEl = document.getElementById('custom-summary-qty');
  const unitEl = document.getElementById('custom-summary-unit');
  const specEl = document.getElementById('custom-summary-spec');
  const totalEl = document.getElementById('custom-summary-total');
  const savingsRow = document.getElementById('custom-summary-savings-row');
  const savingsEl = document.getElementById('custom-summary-savings');
  const badgeEl = document.getElementById('custom-qty-tier-badge');

  if (qtyEl) qtyEl.textContent = isAr ? `${qty} قطعة` : `${qty} pcs`;
  if (unitEl) unitEl.textContent = `${summary.unitPrice} ${curr}`;
  
  const finishLabels = isAr ? { glossy: 'لامع', matte: 'مطفي' } : { glossy: 'Glossy', matte: 'Matte' };
  const sizeLabels = isAr
    ? { '6cm': '6 سم', '8cm': '8 سم', '10cm': '10 سم', 'custom': 'مقاس مخصص' }
    : { '6cm': '6 cm', '8cm': '8 cm', '10cm': '10 cm', 'custom': 'Custom Size' };
  if (specEl) specEl.textContent = `${sizeLabels[state.customPrint.size] || (isAr ? '8 سم' : '8 cm')} / ${finishLabels[state.customPrint.finish] || (isAr ? 'لامع' : 'Glossy')}`;
  
  if (totalEl) totalEl.textContent = summary.total;

  if (summary.savings > 0) {
    if (savingsRow) savingsRow.classList.remove('hidden');
    if (savingsEl) savingsEl.textContent = `-${summary.savings} ${curr}`;
  } else {
    if (savingsRow) savingsRow.classList.add('hidden');
  }

  if (badgeEl) badgeEl.textContent = isAr ? summary.tierLabel : (summary.tierLabelEn || summary.tierLabel);
}

export async function shareCustomOrderFiles() {
  const last = state.customPrint.lastOrder;
  const isAr = getLanguage() === 'ar';
  if (!last) return;
  const filesToShare = (state.customPrint.files || []).map(f => f.originalFile).filter(Boolean);
  if (typeof navigator !== 'undefined' && navigator.share && filesToShare.length > 0 && (!navigator.canShare || navigator.canShare({ files: filesToShare }))) {
    try {
      await navigator.share({
        title: `STICKIFY 21 Custom Print ${last.id}`,
        text: last.waMsg,
        files: filesToShare
      });
      return;
    } catch (e) {
      // Fall through to WhatsApp link if share cancelled/failed
    }
  }
  window.open(last.waUrl, '_blank');
  showToast(isAr
    ? 'يرجى إرفاق الملف الأصلي كمستند (Document) في محادثة واتساب للحفاظ على الجودة.'
    : 'Please attach your original file as a Document in WhatsApp to preserve full print quality.', 'warning');
}

export async function submitCustomPrintOrder() {
  const isAr = getLanguage() === 'ar';
  const nameInput = document.getElementById('custom-customer-name');
  const phoneInput = document.getElementById('custom-customer-phone');
  const notesInput = document.getElementById('custom-order-notes');
  const cutTypeSelect = document.getElementById('custom-cut-type');
  const nameError = document.getElementById('custom-name-error');
  const phoneError = document.getElementById('custom-phone-error');

  if (nameError) nameError.classList.add('hidden');
  if (phoneError) phoneError.classList.add('hidden');

  const name = (nameInput?.value || '').trim();
  const phone = (phoneInput?.value || '').trim();
  const notes = (notesInput?.value || '').trim();
  const cutType = cutTypeSelect?.value || 'Die-cut مفرغ حول أطراف التصميم';

  let hasError = false;

  if (name.length < 3) {
    if (nameError) {
      nameError.textContent = isAr ? 'يرجى كتابة الاسم بالكامل (3 أحرف على الأقل)' : 'Please enter your full name (at least 3 characters)';
      nameError.classList.remove('hidden');
    }
    hasError = true;
  }

  const cleanPhone = phone.replace(/\s+/g, '');
  const egRegex = /^(?:\+20|0020|0)?(1[0125]\d{8})$/;
  if (!egRegex.test(cleanPhone)) {
    if (phoneError) {
      phoneError.textContent = isAr ? 'يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678)' : 'Please enter a valid Egyptian phone number (e.g. 01012345678)';
      phoneError.classList.remove('hidden');
    }
    hasError = true;
  }

  if (hasError) return;

  const submitBtn = document.getElementById('custom-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50');
  }

  try {
    // Store exact original bytes in IndexedDB (NO re-encoding!)
    const storedFiles = [];
    for (const entry of (state.customPrint.files || [])) {
      const dpiInfo = entry.dimensions ? checkPrintDpi(entry.dimensions.width, entry.dimensions.height, state.customPrint.size) : null;
      let assetId = null;
      try {
        const stored = await storage.storeOriginalAsset(entry.originalFile, {
          name: entry.cleanName,
          kind: entry.kind,
          mimeType: entry.originalFile.type || 'application/octet-stream',
          sha256: entry.sha256,
          dimensions: entry.dimensions
        });
        assetId = stored.id;
      } catch (err) {
        console.warn('Could not store original file in IndexedDB:', err);
      }
      storedFiles.push({
        assetId,
        name: entry.cleanName,
        kind: entry.kind,
        size: entry.size,
        sha256: entry.sha256,
        dimensions: entry.dimensions || null,
        dpi: dpiInfo ? dpiInfo.dpi : null,
        isLowRes: dpiInfo ? dpiInfo.isLowRes : false
      });
    }

    const qty = Math.max(10, state.customPrint.quantity || 10);
    const summary = calculateCustomPrintSummary(qty, state.customPrint.size, state.customPrint.finish);
    const customOrderId = 'S21-CUST-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const customOrder = {
      id: customOrderId,
      name,
      phone,
      notes,
      cutType,
      size: state.customPrint.size,
      sizeLabel: state.customPrint.size === '6cm' ? '6 سم' : (state.customPrint.size === '10cm' ? '10 سم' : (state.customPrint.size === 'custom' ? 'مقاس مخصص' : '8 سم')),
      finish: state.customPrint.finish,
      quantity: qty,
      unitPrice: summary.unitPrice,
      total: summary.total,
      savings: summary.savings,
      tierLabel: summary.tierLabel,
      fileName: storedFiles.map(f => f.name).join(', ') || state.customPrint.fileName || '',
      files: storedFiles,
      receivedOnWhatsApp: false,
      date: new Date().toISOString()
    };

    await storage.saveCustomPrintRequest(customOrder);

    const waMsg = formatCustomPrintWhatsAppMessage(customOrder);
    const waUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;
    state.customPrint.lastOrder = { id: customOrderId, waMsg, waUrl };

    const confirmBox = document.getElementById('custom-order-confirmation');
    if (confirmBox) {
      confirmBox.innerHTML = `
        <div class="font-bold text-emerald-900">${isAr ? `تم حفظ طلب الطباعة #${escapeHtml(customOrderId)} بالملفات الأصلية` : `Custom Print Request #${escapeHtml(customOrderId)} Saved`}</div>
        <p class="text-[11px] text-emerald-800 leading-relaxed">
          ${isAr
            ? 'ملاحظة (DEMO محلي): تم حفظ ملفاتك الأصلية داخل متصفحك. لإرسالها لفريق الطباعة بأعلى جودة، استخدم زر المشاركة أدناه أو أرفقها كمستند (Document) في واتساب حتى لا يتم ضغطها.'
            : 'Local Prototype Notice (DEMO): Your original files are saved locally in your browser. Use Share below or attach them as a Document in WhatsApp so they are not compressed.'}
        </p>
        <div class="flex flex-wrap gap-2">
          <button type="button" id="custom-share-file-btn" onclick="shareCustomOrderFiles()" class="flex-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-[11px] transition">
            ${isAr ? 'مشاركة الملفات عبر واتساب' : 'Share Files via WhatsApp'}
          </button>
          <a href="${waUrl}" target="_blank" class="py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-[11px] transition">
            ${isAr ? 'فتح واتساب' : 'Open WhatsApp'}
          </a>
        </div>
      `;
      confirmBox.classList.remove('hidden');
    }

    showToast(isAr ? `تم تجهيز طلب الطباعة المخصصة ${customOrderId}!` : `Custom print request ${customOrderId} ready!`);
    window.open(waUrl, '_blank');
  } catch (err) {
    console.error('Error submitting custom print order:', err);
    showToast(isAr ? 'حدث خطأ أثناء معالجة طلب الطباعة، يرجى المحاولة مرة أخرى.' : 'Failed to process custom print request. Please try again.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50');
    }
  }
}

// ==========================================
// DYNAMIC PRODUCT JSON-LD SCHEMA GENERATOR
// ==========================================
export function updateProductJsonLd(products) {
  let scriptEl = document.getElementById('jsonld-products-schema');
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'jsonld-products-schema';
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }

  const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : CONFIG.SITE_URL;
  const items = (products || []).map((p, index) => {
    const isBookmark = p.category === 'bookmarks' || p.type === 'bookmark';
    const prodImg = p.image ? (p.image.startsWith('data:') ? p.image : new URL(p.image, origin).href) : `${origin}/logo.jpg`;
    return {
      '@type': 'Product',
      'position': index + 1,
      'name': p.nameAr || p.name,
      'description': p.desc || 'استيكر فينيل عالي الجودة ومقاوم للماء من STICKIFY 21',
      'sku': p.sku || `S21-${p.id}`,
      'image': prodImg,
      'offers': {
        '@type': 'Offer',
        'priceCurrency': 'EGP',
        'price': p.price || (isBookmark ? 25 : 35),
        'availability': p.inStock !== false ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        'url': `${origin}/#/product/${p.id}`,
        'seller': {
          '@type': 'Organization',
          'name': 'STICKIFY 21'
        }
      }
    };
  });

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': 'كتالوج منتجات STICKIFY 21',
    'numberOfItems': items.length,
    'itemListElement': items
  };

  scriptEl.textContent = JSON.stringify(schema, null, 2);
}

// ==========================================
// POLICY MODAL & LEGAL VIEWS
// ==========================================
export const POLICY_DATA = DEFAULT_POLICIES;

export function openPolicyModal(section = 'about') {
  const modal = document.getElementById('policy-modal');
  if (!modal) return;
  switchPolicyTab(section);
  modal.classList.remove('hidden');
}

export function closePolicyModal() {
  const modal = document.getElementById('policy-modal');
  if (modal) modal.classList.add('hidden');
}

export function switchPolicyTab(section = 'about') {
  const contentEl = document.getElementById('policy-content');
  const policies = state.settings?.policies || DEFAULT_POLICIES;
  const lang = getLanguage();
  const isAr = lang === 'ar';

  let key = section;
  if (section === 'shipping_returns' || section === 'shipping') {
    key = 'shipping';
  }

  const pData = policies[key] || policies.about || DEFAULT_POLICIES.about;
  const title = isAr ? (pData.titleAr || pData.title || '') : (pData.titleEn || pData.titleAr || pData.title || '');
  const rawContent = isAr ? (pData.contentAr || pData.content || '') : (pData.contentEn || pData.contentAr || pData.content || '');

  const cleanText = stripEmoji(rawContent);
  const formattedHtml = cleanText.split('\n\n').map(para => {
    if (para.includes('\n- ')) {
      const parts = para.split('\n- ');
      const head = parts[0];
      const items = parts.slice(1);
      return `<p class="font-bold text-zinc-800 text-xs mb-1.5">${escapeHtml(head)}</p><ul class="list-disc list-inside space-y-1 pr-2">${items.map(it => `<li>${escapeHtml(it)}</li>`).join('')}</ul>`;
    }
    return `<p class="text-zinc-600 leading-relaxed">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`;
  }).join('<div class="h-2"></div>');

  // Update tab buttons style
  document.querySelectorAll('.policy-tab-btn').forEach(btn => {
    btn.classList.remove('bg-zinc-900', 'text-white');
    btn.classList.add('bg-zinc-100', 'text-zinc-700');
  });
  const activeBtn = document.getElementById(`policy-tab-btn-${section}`) || document.getElementById(`policy-tab-btn-${key}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-zinc-100', 'text-zinc-700');
    activeBtn.classList.add('bg-zinc-900', 'text-white');
  }

  if (contentEl) {
    contentEl.innerHTML = `
      <h3 id="policy-modal-title" class="font-extrabold text-base text-zinc-900 mb-3">${escapeHtml(title)}</h3>
      <div id="policy-modal-body" class="space-y-3 text-xs">${formattedHtml}</div>
    `;
  }
}

// ==========================================
// HASH ROUTER
// ==========================================
export function initHashRouter() {
  function handleRoute() {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/product/')) {
      const prodId = hash.replace('#/product/', '').trim();
      if (prodId) openProductDetailModal(prodId, false);
    } else if (hash.startsWith('#/track')) {
      const parts = hash.split('/');
      const orderId = parts[2] ? decodeURIComponent(parts[2]) : '';
      openOrderTrackingModal(orderId, false);
    } else if (hash === '#custom-order' || hash === '#/custom-print') {
      document.getElementById('custom-order')?.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === '#/about') {
      openPolicyModal('about');
    } else if (hash === '#/shipping' || hash === '#/shipping-returns') {
      openPolicyModal('shipping_returns');
    } else if (hash === '#/terms') {
      openPolicyModal('terms');
    } else if (hash === '#/privacy') {
      openPolicyModal('privacy');
    } else if (hash === '#/contact') {
      openPolicyModal('contact');
    } else {
      const prodModal = document.getElementById('product-detail-modal');
      if (prodModal && !prodModal.classList.contains('hidden')) {
        prodModal.classList.add('hidden');
      }
      const trackModal = document.getElementById('order-tracking-modal');
      if (trackModal && !trackModal.classList.contains('hidden')) {
        trackModal.classList.add('hidden');
      }
      const policyModal = document.getElementById('policy-modal');
      if (policyModal && !policyModal.classList.contains('hidden')) {
        policyModal.classList.add('hidden');
      }
    }
  }

  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProductDetailModal();
      closeOrderTrackingModal();
      closeCheckoutModal();
      closePolicyModal();
      toggleCartModal(false);
    }
  });

  handleRoute();
}

// ==========================================
// TOAST NOTIFICATIONS (XSS Safe)
// ==========================================
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-red-600 text-white' : (type === 'warning' ? 'bg-amber-500 text-white' : 'bg-zinc-900 text-white');
  toast.className = `px-4 py-3 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2 transform transition-all duration-200 translate-y-3 opacity-0 ${bg}`;
  
  const iconSpan = document.createElement('span');
  iconSpan.textContent = '';

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(textSpan);
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-3', 'opacity-0');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// ==========================================
// EVENT LISTENERS & GLOBAL EXPOSURE
// ==========================================
function setupEventListeners() {
  document.querySelectorAll('.cat-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedCategory = btn.dataset.category;
      state.selectedSubCategory = 'all';
      renderCategories();
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

  const orderCitySelect = document.getElementById('order-city');
  if (orderCitySelect) {
    orderCitySelect.addEventListener('change', (e) => {
      handleCheckoutCityChange(e.target.value);
    });
  }

  // Custom print dropzone events
  const dropzone = document.getElementById('custom-dropzone');
  const fileInput = document.getElementById('custom-file-input');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        fileInput.click();
      }
    });
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-zinc-900', 'bg-zinc-100');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-zinc-900', 'bg-zinc-100');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-zinc-900', 'bg-zinc-100');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleCustomFileSelect(e.dataTransfer.files);
      }
    });
  }
}

// Window exposures for HTML event handlers
// ==========================================
// PHASE E: WISHLIST, TAGS & RECENTLY VIEWED (A10, A12)
// ==========================================
export function toggleWishlist(productId) {
  const idx = state.wishlist.indexOf(productId);
  const isAr = getLanguage() === 'ar';
  if (idx >= 0) {
    state.wishlist.splice(idx, 1);
    showToast(isAr ? 'تمت الإزالة من المفضلة' : 'Removed from Wishlist', 'info');
  } else {
    state.wishlist.push(productId);
    showToast(isAr ? 'تمت الإضافة إلى المفضلة' : 'Added to Wishlist', 'success');
  }
  try {
    localStorage.setItem('stickify21_wishlist', JSON.stringify(state.wishlist));
  } catch (e) {}
  updateWishlistBadge();
  renderCategories();
  renderProducts();
}

export function updateWishlistBadge() {
  const badge = document.getElementById('wishlist-badge');
  if (badge) {
    badge.textContent = String(state.wishlist.length);
  }
}

export function toggleWishlistFilter() {
  if (state.selectedCategory === 'wishlist') {
    selectCategoryByCard('all');
  } else {
    selectCategoryByCard('wishlist');
  }
  const el = document.getElementById('catalog-products-area');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

export function renderTagChips() {
  const container = document.getElementById('tag-filter-chips');
  if (!container) return;
  const isAr = getLanguage() === 'ar';
  const tagCounts = new Map();
  state.products.forEach(p => {
    if (Array.isArray(p.tags)) {
      p.tags.forEach(tg => {
        const trimmed = String(tg || '').trim();
        if (trimmed) tagCounts.set(trimmed, (tagCounts.get(trimmed) || 0) + 1);
      });
    }
  });
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tName]) => tName);

  if (topTags.length === 0) {
    container.innerHTML = '';
    return;
  }

  const isAll = state.activeTag === 'all';
  let html = `
    <button type="button" onclick="filterByTag('all')" class="tag-chip px-3 py-1 rounded-full whitespace-nowrap transition font-semibold border ${isAll ? 'active bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-900 hover:text-black'}">
      ${isAr ? 'كل الوسوم' : 'All Tags'}
    </button>
  `;
  html += topTags.map(tg => {
    const isActive = state.activeTag === tg;
    const tagDisplay = translateTag(tg, getLanguage());
    return `
      <button type="button" onclick="filterByTag('${escapeHtml(tg)}')" class="tag-chip px-3 py-1 rounded-full whitespace-nowrap transition font-medium border ${isActive ? 'active bg-[#FF5000] text-white border-[#FF5000]' : 'bg-white text-zinc-600 border-zinc-200 hover:border-[#FF5000] hover:text-[#FF5000]'}">
        #${escapeHtml(tagDisplay)}
      </button>
    `;
  }).join('');
  container.innerHTML = html;
}

export function filterByTag(tag) {
  state.activeTag = state.activeTag === tag ? 'all' : tag;
  renderTagChips();
  renderProducts();
}

export function recordRecentlyViewed(productId) {
  if (!productId) return;
  const list = Array.isArray(state.recentlyViewed) ? [...state.recentlyViewed] : [];
  const existingIdx = list.indexOf(productId);
  if (existingIdx >= 0) list.splice(existingIdx, 1);
  list.unshift(productId);
  state.recentlyViewed = list.slice(0, 6);
  try {
    localStorage.setItem('stickify21_recently_viewed', JSON.stringify(state.recentlyViewed));
  } catch (e) {}
  renderRecentlyViewed();
}

export function renderRecentlyViewed() {
  const section = document.getElementById('recently-viewed-section');
  const track = document.getElementById('recently-viewed-track');
  if (!section || !track) return;

  const isAr = getLanguage() === 'ar';
  const curr = isAr ? 'ج.م' : 'EGP';
  const items = (state.recentlyViewed || [])
    .map(id => state.products.find(p => p.id === id))
    .filter(Boolean);

  if (items.length === 0) {
    section.classList.add('hidden');
    track.innerHTML = '';
    return;
  }

  section.classList.remove('hidden');
  track.innerHTML = items.map(product => {
    const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
    const safeImage = sanitizeUrl(product.image);
    const safeSvg = sanitizeSvg(product.svg);
    const displayName = isAr ? (product.nameAr || product.name) : (product.nameEn || product.name || product.nameAr);
    const price = getProductPriceForSize(product, isBookmark ? 'standard' : 'medium');
    return `
      <div onclick="openProductDetailModal('${escapeHtml(product.id)}')" class="recently-viewed-card group bg-white rounded-2xl border border-zinc-200 hover:border-zinc-900 p-3 cursor-pointer transition flex flex-col items-center text-center shadow-sm">
        <div data-allow-arabic="true" class="w-16 h-16 flex items-center justify-center mb-2 overflow-hidden">
          ${product.image && safeImage ? `<img src="${safeImage}" alt="${escapeHtml(displayName)}" class="w-full h-full object-contain">` : `<div class="w-14 h-14 flex items-center justify-center">${safeSvg}</div>`}
        </div>
        <div class="text-xs font-bold text-zinc-900 group-hover:text-[#FF5000] line-clamp-1">${escapeHtml(displayName)}</div>
        <div class="text-[11px] font-mono text-zinc-500 mt-0.5">${price} ${curr}</div>
      </div>
    `;
  }).join('');
}

export function clearRecentlyViewed() {
  state.recentlyViewed = [];
  try {
    localStorage.removeItem('stickify21_recently_viewed');
  } catch (e) {}
  renderRecentlyViewed();
}

window.toggleWishlist = toggleWishlist;
window.toggleWishlistFilter = toggleWishlistFilter;
window.filterByTag = filterByTag;
window.clearRecentlyViewed = clearRecentlyViewed;
window.selectCategoryByCard = selectCategoryByCard;
window.resetFilters = resetFilters;
window.addToCart = addToCart;
window.addToPack = addToPack;
window.setPackSize = setPackSize;
window.removePackItem = removePackItem;
window.addPackToCart = addPackToCart;
window.selectCardSize = selectCardSize;
window.addStickerToMockup = addStickerToMockup;
window.changeMockupDevice = changeMockupDevice;
window.setPlacedStickerSize = setPlacedStickerSize;
window.rotateCurrentSticker = rotateCurrentSticker;
window.deleteCurrentSticker = deleteCurrentSticker;
window.clearMockupStickers = clearMockupStickers;
window.toggleCartModal = toggleCartModal;
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.updateCartQuantity = updateCartQuantity;
window.removeCartItem = removeCartItem;
window.applyCoupon = applyCoupon;
window.checkoutViaWhatsAppDirect = checkoutViaWhatsAppDirect;
window.submitOrder = submitOrder;
window.handleCheckoutCityChange = handleCheckoutCityChange;
window.closeConfirmationModal = closeConfirmationModal;
window.handlePaymentMethodChange = handlePaymentMethodChange;
window.openProductDetailModal = openProductDetailModal;
window.closeProductDetailModal = closeProductDetailModal;
window.selectProductDetailSize = selectProductDetailSize;
window.selectProductDetailFinish = selectProductDetailFinish;
window.updateProductDetailQty = updateProductDetailQty;
window.addProductDetailToCart = addProductDetailToCart;
window.addDetailProductToMockup = addDetailProductToMockup;
window.openOrderTrackingModal = openOrderTrackingModal;
window.closeOrderTrackingModal = closeOrderTrackingModal;
window.handleTrackOrderSubmit = handleTrackOrderSubmit;
window.searchTrackOrder = searchTrackOrder;
window.handleCustomFileSelect = handleCustomFileSelect;
window.removeCustomFile = removeCustomFile;
window.clearCustomUpload = clearCustomUpload;
window.shareCustomOrderFiles = shareCustomOrderFiles;
window.selectCustomSize = selectCustomSize;
window.selectCustomFinish = selectCustomFinish;
window.adjustCustomQty = adjustCustomQty;
window.handleCustomQtyChange = handleCustomQtyChange;
window.submitCustomPrintOrder = submitCustomPrintOrder;
window.openPolicyModal = openPolicyModal;
window.closePolicyModal = closePolicyModal;
window.switchPolicyTab = switchPolicyTab;
window.removeGroupedLine = removeGroupedLine;
window.handlePaymentProofSelected = handlePaymentProofSelected;
window.clearPaymentProof = clearPaymentProof;
window.copyToClipboardText = copyToClipboardText;
window.sharePaymentProofOnWhatsApp = sharePaymentProofOnWhatsApp;
window.toggleMockupRuler = toggleMockupRuler;
window.openSizeGuideModal = openSizeGuideModal;
window.closeSizeGuideModal = closeSizeGuideModal;
window.renderShowcase = renderShowcase;
window.renderPlacedStickers = renderPlacedStickers;
window.__mockupState = state;
window.analytics = analytics;

// ResizeObserver for True-to-Scale studio recalculation (R7)
if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => {
    if (state.placedStickers && state.placedStickers.length > 0) {
      renderPlacedStickers();
    }
    const ruler = document.getElementById('mockup-ruler-overlay');
    if (ruler && !ruler.classList.contains('hidden')) {
      renderMockupRuler();
    }
  });
  const devEl = document.getElementById('device-wrapper');
  if (devEl) ro.observe(devEl);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
