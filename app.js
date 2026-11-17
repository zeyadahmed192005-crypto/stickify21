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
const state = {
  categories: [],
  products: [],
  cart: safeJsonParse(localStorage.getItem('stickify21_cart'), [], 'stickify21_cart'),
  selectedSizes: {}, // { [productId]: 'small' | 'medium' | 'large' }
  selectedCategory: 'all',
  selectedSubCategory: 'all',
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
    fileName: '',
    fileSize: 0,
    fileUrl: '',
    size: '8cm',
    finish: 'glossy',
    quantity: 10,
    cutType: 'Die-cut مفرغ حول أطراف التصميم'
  }
};

// Device definitions for Mockup Studio (Neutral shapes, NO trademark logos)
const devices = {
  laptop: {
    id: 'laptop',
    name: 'لابتوب (15" Laptop)',
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
    name: 'موبايل (Smart Phone)',
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
    name: 'زجاجة ماء (Tumbler)',
    frameClass: 'mockup-bottle-realistic relative flex items-center justify-center p-6 min-h-[420px] max-w-[210px] mx-auto overflow-hidden select-none',
    decorationsHtml: `
      <!-- Tumbler Cap & Loop Handle -->
      <div class="absolute -top-6 left-1/2 -translate-x-1/2 w-28 h-9 rounded-t-2xl bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-700 border-t-2 border-zinc-200 shadow-md pointer-events-none flex items-center justify-center">
        <div class="w-14 h-3 rounded-full border-2 border-zinc-800 bg-zinc-900 shadow-inner"></div>
      </div>
      <div class="absolute top-3 left-0 right-0 h-1 bg-zinc-600/50 pointer-events-none"></div>
      <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-12 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"></div>
      <div class="absolute bottom-0 left-0 right-0 h-6 bg-zinc-950/70 border-t border-zinc-700/50 pointer-events-none"></div>
    `
  },
  book: {
    id: 'book',
    name: 'كتاب / رواية (Book)',
    frameClass: 'mockup-book-realistic relative flex items-center justify-center p-6 min-h-[400px] max-w-[290px] mx-auto select-none',
    decorationsHtml: `
      <div class="absolute inset-4 rounded-lg border border-[#D4AF37]/35 pointer-events-none flex flex-col justify-between p-4">
        <div class="text-center font-mono text-[9px] tracking-widest text-[#D4AF37]/60">STICKIFY 21 LIMITED EDITION</div>
        <div class="text-center font-mono text-[9px] text-[#D4AF37]/40 tracking-wider">★ NOVEL &amp; LITERATURE ★</div>
      </div>
      <div class="absolute -top-3 right-10 w-3.5 h-14 bg-[#FF5000] rounded-b-md shadow-md pointer-events-none transform -rotate-2"></div>
      <div class="absolute top-2 bottom-2 -right-2.5 w-2.5 bg-gradient-to-b from-[#F3EEEA] via-[#E8E2DC] to-[#DDD6CE] rounded-r-sm shadow-md border-r border-[#C9C0B7] pointer-events-none"></div>
    `
  },
  notebook: {
    id: 'notebook',
    name: 'كشكول ملاحظات',
    frameClass: 'mockup-notebook-realistic relative flex items-center justify-center p-6 min-h-[380px] max-w-[280px] mx-auto select-none',
    decorationsHtml: `
      <div class="absolute -left-3 top-4 bottom-4 w-4 flex flex-col justify-between pointer-events-none z-20">
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
        <div class="w-5 h-2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-300 to-zinc-800 shadow border border-zinc-500 transform -rotate-6"></div>
      </div>
      <div class="absolute top-0 bottom-0 right-6 w-3 bg-[#18181B] rounded shadow pointer-events-none opacity-80"></div>
    `
  },
  car_window: {
    id: 'car_window',
    name: 'زجاج سيارة (Car Window)',
    frameClass: 'mockup-car-window-realistic relative flex items-center justify-center p-6 min-h-[380px] max-w-[340px] mx-auto overflow-hidden select-none',
    decorationsHtml: `
      <!-- Car Window Edge Weatherstrip & Defroster Filament Lines -->
      <div class="absolute inset-0 border-[6px] border-[#181D24] rounded-[3rem_1.25rem_0.5rem_0.5rem] pointer-events-none"></div>
      <div class="absolute top-1/4 left-3 right-3 h-[1px] bg-red-950/40 pointer-events-none"></div>
      <div class="absolute top-2/4 left-3 right-3 h-[1px] bg-red-950/40 pointer-events-none"></div>
      <div class="absolute top-3/4 left-3 right-3 h-[1px] bg-red-950/40 pointer-events-none"></div>
      <!-- Tint Reflection Specular Streak -->
      <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/5 to-transparent pointer-events-none"></div>
      <div class="absolute bottom-3 left-4 text-[9px] font-mono font-bold text-slate-500 opacity-50 pointer-events-none">TEMPERED GLASS • S21</div>
    `
  }
};

// ==========================================
// INITIALIZATION
// ==========================================
export async function initApp() {
  await storage.init();

  // Load store settings
  try {
    const settings = await storage.getSettings();
    if (settings) {
      if (settings.whatsappNumber) CONFIG.WHATSAPP_NUMBER = settings.whatsappNumber;
      if (settings.freeShippingThreshold !== undefined) CONFIG.FREE_SHIPPING_THRESHOLD = settings.freeShippingThreshold;
      if (settings.defaultShipping !== undefined) CONFIG.DEFAULT_SHIPPING = settings.defaultShipping;
      if (settings.shippingRates) CONFIG.SHIPPING_RATES = { ...CONFIG.SHIPPING_RATES, ...settings.shippingRates };
    }
  } catch(e) {}

  // Load from unified storage interface
  state.categories = await storage.getCategories();
  state.products = await storage.getProducts();

  updateProductJsonLd(state.products);
  renderCategories();
  renderProducts();
  renderCart();
  renderPackBuilder();
  renderMockupDevice();
  updateCustomPrintSummary();
  setupEventListeners();
  updateCartBadge();
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
      renderProducts();
    }
    if (e.key === 'stickify21_cart') {
      state.cart = safeJsonParse(e.newValue, [], 'stickify21_cart');
      renderCart();
      updateCartBadge();
    }
  });
}

// ==========================================
// CATALOG & PRODUCTS
// ==========================================
export function getFilteredProducts() {
  let list = [...state.products];

  // Category filter
  if (state.selectedCategory !== 'all') {
    list = list.filter(p => p.category === state.selectedCategory);
  }

  // Finish filter
  if (state.activeFinish !== 'all') {
    list = list.filter(p => p.finish === state.activeFinish);
  }

  // Search query filter
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p => 
      (p.nameAr && p.nameAr.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.desc && p.desc.toLowerCase().includes(q))
    );
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
  const countBadge = document.getElementById('filtered-count-badge');
  const emptyState = document.getElementById('catalog-empty-state');
  if (!container) return;

  const products = getFilteredProducts();

  if (countBadge) {
    countBadge.innerText = `${products.length} تصميم متوفر`;
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

    const stockCheck = checkProductStock(product);
    const isOutOfStock = !stockCheck.available;

    const currentSizeKey = state.selectedSizes[product.id] || (isBookmark ? 'standard' : 'medium');
    const currentPrice = getProductPriceForSize(product, currentSizeKey);
    const smallPrice = getProductPriceForSize(product, 'small');
    const medPrice = getProductPriceForSize(product, 'medium');
    const largePrice = getProductPriceForSize(product, 'large');

    // Valid standard Tailwind size stage classes (fixes Bug 01: w-34 h-34 replaced with w-36 h-36)
    let stageClass = 'w-28 h-28';
    if (isBookmark) {
      stageClass = 'w-24 h-36';
    } else if (currentSizeKey === 'small') {
      stageClass = 'w-24 h-24';
    } else if (currentSizeKey === 'large') {
      stageClass = 'w-36 h-36';
    }

    const currentSizeLabel = isBookmark 
      ? 'فاصل كتب 15 × 5 سم' 
      : (currentSizeKey === 'small' ? '6 سم (Small)' : (currentSizeKey === 'large' ? '10 سم (Large)' : '8 سم (Medium)'));

    return `
      <div class="sticker-card group relative rounded-2xl bg-white border border-zinc-200/90 hover:border-zinc-900 p-5 transition-all duration-200 flex flex-col justify-between hover:shadow-sm">
        
        <!-- Header Tags: Badge + SKU -->
        <div class="flex items-center justify-between mb-4">
          <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isBookmark ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-zinc-100 text-zinc-700'}">
            ${escapeHtml(product.badge)}
          </span>
          <div class="flex items-center gap-1.5 font-mono">
            ${isOutOfStock ? '<span class="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200">نفد من المخزون</span>' : ''}
            <span class="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-bold border border-zinc-200">#${escapeHtml(product.sku)}</span>
          </div>
        </div>

        <!-- Graphic Stage -->
        <div onclick="openProductDetailModal('${escapeHtml(product.id)}')" class="relative w-full aspect-square p-6 flex items-center justify-center rounded-xl bg-zinc-50 border border-zinc-100 mb-4 overflow-hidden cursor-pointer">
          <div id="graphic-wrapper-${escapeHtml(product.id)}" class="${stageClass} sticker-diecut-minimal flex items-center justify-center transition-all duration-200">
            ${hasImage && safeImage ? `<img src="${safeImage}" alt="${escapeHtml(product.nameAr)}" class="w-full h-full object-contain pointer-events-none">` : safeSvg}
          </div>

          <!-- Preview Button: touch-preview-visible fixes Bug 05 (visible on touch devices) -->
          <button onclick="event.stopPropagation(); addStickerToMockup('${escapeHtml(product.id)}')" title="جرب على جهازك" class="touch-preview-visible absolute bottom-2.5 left-2.5 px-3 py-1.5 rounded-lg bg-white/95 text-zinc-900 border border-zinc-200 hover:border-black hover:bg-black hover:text-white transition shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1.5 text-xs font-semibold">
            <span>معاينة</span>
            <span>↗</span>
          </button>
        </div>

        <!-- Info & Price -->
        <div class="mb-3">
          <div class="flex items-baseline justify-between gap-2 mb-1.5">
            <h3 onclick="openProductDetailModal('${escapeHtml(product.id)}')" class="font-bold text-sm text-zinc-900 group-hover:text-[#FF5000] transition cursor-pointer">${escapeHtml(product.nameAr)}</h3>
            <div class="text-left font-mono">
              <span id="card-price-${escapeHtml(product.id)}" class="font-extrabold text-zinc-900 text-base whitespace-nowrap">${currentPrice}</span>
              <span class="text-[10px] font-medium text-zinc-500">${CONFIG.CURRENCY}</span>
            </div>
          </div>
          <p class="text-xs text-zinc-500 leading-relaxed line-clamp-2">${escapeHtml(product.desc)}</p>
        </div>

        <!-- Size Selector Pill (Stickers only) -->
        ${!isBookmark ? `
          <div class="mb-4 bg-zinc-50 border border-zinc-200/80 p-2 rounded-xl">
            <div class="flex items-center justify-between text-[11px] mb-1.5 font-semibold text-zinc-600">
              <span>اختر المقاس:</span>
              <span id="selected-size-label-${escapeHtml(product.id)}" class="text-zinc-900 font-bold">${escapeHtml(currentSizeLabel)}</span>
            </div>
            <div class="grid grid-cols-3 gap-1 bg-zinc-200/60 p-1 rounded-lg text-xs font-bold text-center">
              <button type="button" onclick="selectCardSize('${escapeHtml(product.id)}', 'small', event)" id="size-btn-${escapeHtml(product.id)}-small" class="size-pill-btn py-1 rounded-md transition ${currentSizeKey === 'small' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}">
                6 سم <span class="text-[9px] block font-mono font-normal">(${smallPrice} ${CONFIG.CURRENCY})</span>
              </button>
              <button type="button" onclick="selectCardSize('${escapeHtml(product.id)}', 'medium', event)" id="size-btn-${escapeHtml(product.id)}-medium" class="size-pill-btn py-1 rounded-md transition ${currentSizeKey === 'medium' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}">
                8 سم <span class="text-[9px] block font-mono font-normal">(${medPrice} ${CONFIG.CURRENCY})</span>
              </button>
              <button type="button" onclick="selectCardSize('${escapeHtml(product.id)}', 'large', event)" id="size-btn-${escapeHtml(product.id)}-large" class="size-pill-btn py-1 rounded-md transition ${currentSizeKey === 'large' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-black hover:bg-white'}">
                10 سم <span class="text-[9px] block font-mono font-normal">(${largePrice} ${CONFIG.CURRENCY})</span>
              </button>
            </div>
          </div>
        ` : `
          <div class="mb-4 bg-amber-50/70 border border-amber-200/60 p-2 rounded-xl text-center">
            <span class="text-[11px] font-bold text-amber-900">🔖 مقاس قياسي فاخر: ${CONFIG.BOOKMARK_SPECS.dimensions} (${CONFIG.BOOKMARK_SPECS.material})</span>
          </div>
        `}

        <!-- Actions: Fixes Bug 04 (hide "للباقة" for bookmarks) -->
        <div class="grid ${!isBookmark ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mt-auto pt-2 border-t border-zinc-100">
          <button ${isOutOfStock ? 'disabled' : `onclick="addToCart('${escapeHtml(product.id)}')"`} class="w-full py-2.5 px-3 rounded-xl ${isOutOfStock ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-zinc-900 hover:bg-[#FF5000] text-white active:scale-95'} font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm">
            <span>${isOutOfStock ? 'نفد من المخزون' : 'أضف للسلة'}</span>
            <span>${isOutOfStock ? '🔒' : '+'}</span>
          </button>
          ${!isBookmark ? `
            <button ${isOutOfStock ? 'disabled' : `onclick="addToPack('${escapeHtml(product.id)}')"`} class="w-full py-2.5 px-2 rounded-xl ${isOutOfStock ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'} font-bold text-xs flex items-center justify-center gap-1 transition">
              <span>للباقة</span>
              <span>📦</span>
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
    if (sizeKey === 'small') {
      graphicElem.className = 'w-24 h-24 sticker-diecut-minimal flex items-center justify-center transition-all duration-200';
    } else if (sizeKey === 'large') {
      graphicElem.className = 'w-36 h-36 sticker-diecut-minimal flex items-center justify-center transition-all duration-200';
    } else {
      graphicElem.className = 'w-28 h-28 sticker-diecut-minimal flex items-center justify-center transition-all duration-200';
    }
  }
}

export function renderCategories() {
  const gridContainer = document.getElementById('categories-cards-grid');
  const pillsContainer = document.getElementById('category-pills-container');

  if (gridContainer) {
    gridContainer.innerHTML = state.categories.map(cat => {
      const isActive = state.selectedCategory === cat.id;
      const safeImage = sanitizeUrl(cat.image);

      return `
        <div onclick="selectCategoryByCard('${escapeHtml(cat.id)}')" class="category-card p-4 flex flex-col items-center justify-between text-center group border transition-all duration-200 cursor-pointer ${isActive ? 'border-zinc-900 ring-2 ring-[#FF5000] bg-orange-50/40 shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-900'}">
          <div class="w-full flex justify-between items-start mb-2 min-h-[18px]">
            ${cat.badge ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FF5000]/10 text-[#FF5000]">${escapeHtml(cat.badge)}</span>` : '<span></span>'}
            <span class="text-[9px] text-zinc-300 font-mono">#${escapeHtml(cat.id)}</span>
          </div>

          <div class="w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center overflow-hidden cat-thumb-img mb-3 p-1.5 shadow-inner">
            ${safeImage ? `<img src="${safeImage}" alt="${escapeHtml(cat.nameAr)}" class="w-full h-full object-contain">` : `<span class="text-3xl">${escapeHtml(cat.icon || '🏷️')}</span>`}
          </div>

          <div>
            <h3 class="text-xs sm:text-sm font-bold text-zinc-900 group-hover:text-[#FF5000] transition">${escapeHtml(cat.nameAr)}</h3>
            <span class="text-[10px] text-zinc-400 font-mono block mt-0.5">${escapeHtml(cat.nameEn || '')}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  if (pillsContainer) {
    const isAll = state.selectedCategory === 'all';
    let pillsHtml = `
      <button onclick="selectCategoryByCard('all')" data-category="all" class="cat-filter-btn px-4 py-2 rounded-full whitespace-nowrap transition text-xs font-semibold ${isAll ? 'bg-zinc-900 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:text-black hover:bg-zinc-200'}">
        ✨ الكل
      </button>
    `;

    pillsHtml += state.categories.map(cat => {
      const isActive = state.selectedCategory === cat.id;
      const safeImage = sanitizeUrl(cat.image);
      return `
        <button onclick="selectCategoryByCard('${escapeHtml(cat.id)}')" data-category="${escapeHtml(cat.id)}" class="cat-filter-btn px-4 py-2 rounded-full whitespace-nowrap transition text-xs font-semibold flex items-center gap-1.5 ${isActive ? 'bg-zinc-900 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:text-black hover:bg-zinc-200'}">
          ${safeImage ? `<img src="${safeImage}" class="w-4 h-4 object-contain rounded" alt="">` : `<span>${escapeHtml(cat.icon || '🏷️')}</span>`}
          <span>${escapeHtml(cat.nameAr)}</span>
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
  showToast(`تمت إضافة [${escapeHtml(product.sku)}] (${escapeHtml(sizeLabel)}) إلى السلة بنجاح 🛒`);
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

  if (state.cart.length === 0) {
    if (nudgeEl) {
      nudgeEl.classList.add('hidden');
      nudgeEl.innerHTML = '';
    }
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

  // Calculations via single source of truth (pricing.js)
  const calc = calculateCart({
    items: state.cart,
    coupon: state.coupon,
    governorate: state.selectedGovernorate
  });

  // Dynamic Pack Nudge Banner (R10)
  if (nudgeEl) {
    if (calc.nudge && calc.nudge.message) {
      nudgeEl.innerHTML = `
        <span class="text-base flex-shrink-0">🎁</span>
        <span class="flex-grow">${escapeHtml(calc.nudge.message)}</span>
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
      return `
        <div class="p-3.5 rounded-xl bg-orange-50/50 border border-[#FF5000]/30 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span class="bg-[#FF5000] text-white px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">باقة توفير</span>
              <h4 class="font-bold text-zinc-900 text-xs">${escapeHtml(item.nameAr || 'باقة استيكرات')}</h4>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="removeGroupedLine(${index})" class="text-zinc-400 hover:text-red-500 p-1 text-xs transition" title="حذف الباقة بالكامل">✕</button>
            </div>
          </div>

          <!-- Included items mini gallery -->
          <div class="flex items-center gap-1.5 overflow-x-auto py-1">
            ${(item.items || []).map(sub => {
              const subImg = sanitizeUrl(sub.image);
              const subSvg = sanitizeSvg(sub.svg);
              return `
                <div class="w-8 h-8 rounded-lg bg-white border border-zinc-200 p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden" title="${escapeHtml(sub.nameAr || sub.name || '')}">
                  ${subImg ? `<img src="${subImg}" class="w-full h-full object-contain">` : subSvg}
                </div>
              `;
            }).join('')}
          </div>

          <div class="flex items-center justify-between text-[11px] text-zinc-500 font-mono border-t border-orange-100 pt-1.5">
            <span>${item.autoPack ? 'باقة تلقائية' : `المقاس: ${escapeHtml(item.size || '8 سم')}`}</span>
            <div>
              ${item.savings ? `<span class="line-through text-zinc-400 ml-1.5">${item.rawTotal} ${CONFIG.CURRENCY}</span>` : ''}
              <span class="text-[#FF5000] font-black text-xs">${item.price * (item.quantity || 1)} ${CONFIG.CURRENCY}</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 gap-3">
        <div class="w-14 h-14 p-1 rounded-lg bg-white border border-zinc-200 flex-shrink-0 flex items-center justify-center">
          ${safeImage ? `<img src="${safeImage}" alt="" class="w-11 h-11 object-contain">` : safeSvg}
        </div>
        <div class="flex-grow min-w-0">
          <div class="flex items-center gap-1.5 truncate">
            <span class="bg-zinc-200 text-zinc-800 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold">#${escapeHtml(item.sku || 'SKU')}</span>
            <h4 class="font-bold text-zinc-900 text-xs truncate">${escapeHtml(item.nameAr || item.name)}</h4>
          </div>
          <div class="text-[11px] text-zinc-500 flex items-center gap-2 mt-1 font-mono">
            <span>${escapeHtml(item.type === 'bookmark' ? 'بوك مارك' : (item.size || '8 سم'))}</span>
            <span>•</span>
            <span class="text-zinc-900 font-bold">${item.price * item.quantity} ${CONFIG.CURRENCY}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <div class="flex items-center border border-zinc-300 rounded-lg overflow-hidden bg-white">
            <button onclick="updateCartQuantity(${item.originalIndex !== undefined ? item.originalIndex : index}, -1)" class="px-2 py-1 text-zinc-600 hover:text-black hover:bg-zinc-100 font-bold text-xs">-</button>
            <span class="px-2 py-1 text-xs font-bold text-zinc-900 font-mono">${item.quantity}</span>
            <button onclick="updateCartQuantity(${item.originalIndex !== undefined ? item.originalIndex : index}, 1)" class="px-2 py-1 text-zinc-600 hover:text-black hover:bg-zinc-100 font-bold text-xs">+</button>
          </div>
          <button onclick="removeCartItem(${item.originalIndex !== undefined ? item.originalIndex : index})" class="text-zinc-400 hover:text-red-500 p-1 text-xs transition">✕</button>
        </div>
      </div>
    `;
  }).join('');

  summaryContainer.innerHTML = `
    <!-- Coupon -->
    <div class="flex gap-2 mb-4">
      <input type="text" id="coupon-input" value="${escapeHtml(state.coupon.code)}" placeholder="كود الخصم (جرب STICKIFY10)" class="flex-grow bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 uppercase focus:outline-none focus:border-zinc-900">
      <button onclick="applyCoupon()" class="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition">تطبيق</button>
    </div>

    <!-- Free Shipping Indicator (Fixes Bug 08: evaluated post-discount!) -->
    <div class="mb-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
      <div class="flex justify-between text-xs font-semibold mb-1">
        <span class="text-zinc-700">شحن مجاني فوق ${CONFIG.FREE_SHIPPING_THRESHOLD} ${CONFIG.CURRENCY}</span>
        <span class="${calc.isFreeShipping ? 'text-[#FF5000] font-bold' : 'text-zinc-500'}">
          ${calc.isFreeShipping ? 'تم تفعيل الشحن المجاني! 🚚' : `باقي ${calc.freeShippingRemaining} ${CONFIG.CURRENCY}`}
        </span>
      </div>
      <div class="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
        <div class="bg-[#FF5000] h-full rounded-full transition-all duration-300" style="width: ${calc.freeShippingProgress}%"></div>
      </div>
    </div>

    <!-- Pricing Summary -->
    <div class="space-y-1.5 text-xs text-zinc-600 border-t border-zinc-200 pt-3 mb-4 font-mono">
      <div class="flex justify-between">
        <span class="font-sans text-zinc-600">المجموع الفرعي:</span>
        <span class="font-bold text-zinc-900">${calc.subtotal} ${CONFIG.CURRENCY}</span>
      </div>
      ${calc.discount > 0 ? `
        <div class="flex justify-between text-[#FF5000] font-bold">
          <span class="font-sans">الخصم (${escapeHtml(state.coupon.code)}):</span>
          <span>-${calc.discount} ${CONFIG.CURRENCY}</span>
        </div>
      ` : ''}
      <div class="flex justify-between">
        <span class="font-sans text-zinc-600">الشحن (${escapeHtml(state.selectedGovernorate)}):</span>
        <span class="text-zinc-900 font-bold">${calc.shipping === 0 ? '<span class="text-[#FF5000]">مجاناً</span>' : `${calc.shipping} ${CONFIG.CURRENCY}`}</span>
      </div>
      <div class="flex justify-between text-base font-extrabold text-zinc-900 border-t border-zinc-200 pt-2 font-mono">
        <span class="font-sans">الإجمالي:</span>
        <span class="text-[#FF5000]">${calc.total} ${CONFIG.CURRENCY}</span>
      </div>
    </div>

    <!-- CTAs -->
    <div class="space-y-2">
      <button onclick="checkoutViaWhatsAppDirect()" class="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm">
        <span>إرسال الطلب عبر واتساب (${CONFIG.WHATSAPP_DISPLAY})</span>
        <span>💬</span>
      </button>
      <button id="open-checkout-btn" onclick="openCheckoutModal()" class="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-semibold text-xs flex items-center justify-center gap-2 transition">
        <span>إتمام الشراء بالبيانات التفصيلية</span>
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
    showToast(`تم تفعيل كود الخصم "${escapeHtml(result.coupon.code)}" بنجاح! 🎉`);
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
          <div class="w-14 h-14 sticker-diecut-minimal">
            ${safeImg ? `<img src="${safeImg}" alt="" class="w-full h-full object-contain">` : safeSvg}
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
          <span class="text-xs font-bold text-zinc-900">المكتمل: ${currentCount} من ${target}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isFull ? 'bg-[#FF5000]/10 text-[#FF5000]' : 'bg-zinc-100 text-zinc-600'}">
            ${isFull ? 'الباقة جاهزة!' : `وفر ${summary.discountRate * 100}% عند اكتمال ${target} قطع`}
          </span>
        </div>
        <div class="text-xs text-zinc-500 mt-1 font-mono">
          السعر بعد الخصم: <span class="text-base font-extrabold text-[#FF5000]">${summary.discountedTotal} ${CONFIG.CURRENCY}</span>
          ${summary.savings > 0 ? `<span class="line-through text-zinc-400 ml-2">${summary.rawTotal} ${CONFIG.CURRENCY}</span> (وفرت ${summary.savings} ${CONFIG.CURRENCY})` : ''}
        </div>
      </div>

      <button onclick="addPackToCart()" ${!isFull ? 'disabled' : ''} class="px-7 py-3.5 rounded-full ${isFull ? 'bg-[#FF5000] hover:bg-[#E04600] text-white shadow-sm' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'} font-bold text-xs transition">
        إضافة باقة الـ ${target} بالكامل للسلة
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
  showToast(`تمت إضافة باقة الـ ${target} استيكرات إلى السلة بخصم ${summary.discountRate * 100}%! 🎉`);

  state.packBuilder.items = [];
  renderPackBuilder();
  toggleCartModal(true);
}

// ==========================================
// MOCKUP STUDIO (Fixes Bug 02 & Bug 06)
// ==========================================
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
  const scale = isBookmark ? 1.0 : (sizeObj ? sizeObj.scale : 1.0);

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
    rotation: isBookmark ? (Math.random() * 8 - 4) : ((Math.random() * 20) - 10),
    scale: scale
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

  board.innerHTML = state.placedStickers.map(item => {
    const safeImg = sanitizeUrl(item.image);
    const safeSvg = sanitizeSvg(item.svg);

    return `
      <div id="${escapeHtml(item.id)}" 
           class="mockup-placed-sticker ${item.isBookmark ? 'w-16 h-32' : 'w-24 h-24'} ${state.selectedPlacedId === item.id ? 'selected' : ''}"
           style="left: ${item.x}%; top: ${item.y}%; transform: translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale});"
           data-placed-id="${escapeHtml(item.id)}">
        ${safeImg ? `<img src="${safeImg}" alt="" class="w-full h-full object-contain pointer-events-none">` : safeSvg}
      </div>
    `;
  }).join('');

  attachPointerDragListeners();
  updatePlacedControls();
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
        <span class="font-mono text-[10px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded font-bold border border-zinc-200">#${escapeHtml(current.sku)}</span>
        <span class="font-bold text-zinc-900">${escapeHtml(current.nameAr)}</span>
      </div>

      ${!current.isBookmark ? `
        <div class="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl font-bold text-xs">
          <span class="text-[10px] text-zinc-500 mr-1.5 font-semibold">المقاس:</span>
          <button onclick="setPlacedStickerSize('small')" class="px-2.5 py-1 rounded-lg transition ${current.sizeKey === 'small' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:text-black hover:bg-zinc-200'}">6 سم (S)</button>
          <button onclick="setPlacedStickerSize('medium')" class="px-2.5 py-1 rounded-lg transition ${current.sizeKey === 'medium' || !current.sizeKey ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:text-black hover:bg-zinc-200'}">8 سم (M)</button>
          <button onclick="setPlacedStickerSize('large')" class="px-2.5 py-1 rounded-lg transition ${current.sizeKey === 'large' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-600 hover:text-black hover:bg-zinc-200'}">10 سم (L)</button>
        </div>
      ` : ''}

      <div class="flex items-center gap-2">
        <button onclick="rotateCurrentSticker()" class="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition" title="تدوير الاستيكر">
          🔄 تدوير
        </button>
        <button onclick="deleteCurrentSticker()" class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition" title="إزالة من المعاينة">
          🗑️ إزالة
        </button>
      </div>
    </div>
  `;
}

export function setPlacedStickerSize(sizeKey) {
  const current = state.placedStickers.find(s => s.id === state.selectedPlacedId);
  if (!current || current.isBookmark) return;

  const sizeObj = CONFIG.STICKER_SIZES.find(s => s.key === sizeKey) || CONFIG.STICKER_SIZES[1];
  current.sizeKey = sizeKey;
  current.scale = sizeObj.scale;
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

  const calc = calculateCart({
    items: state.cart,
    coupon: state.coupon,
    governorate: state.selectedGovernorate
  });

  if (itemsContainer) {
    itemsContainer.innerHTML = calc.groupedLines.map((item, idx) => {
      if (item.type === 'pack') {
        const subListHtml = (item.items || []).map(sub => `
          <div class="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-zinc-100 text-[11px]">
            <span class="font-mono font-bold text-zinc-900">#${escapeHtml(sub.sku || 'S21')}</span>
            <span class="text-zinc-700 truncate font-semibold">${escapeHtml(sub.nameAr || sub.name || '')}</span>
            <span class="text-zinc-400 font-mono text-[10px] mr-auto">(${escapeHtml(sub.sizeKey || '8 سم')} - ${escapeHtml(sub.finish || 'مطفي')})</span>
          </div>
        `).join('');

        return `
          <div class="p-2.5 rounded-xl bg-orange-50/60 border border-orange-200/80 space-y-1.5">
            <div class="flex items-center justify-between font-bold text-xs">
              <span class="text-[#FF5000]">🎁 ${escapeHtml(item.nameAr || 'باقة استيكرات')} (الكمية: ${item.quantity || 1})</span>
              <span class="font-mono">${item.price * (item.quantity || 1)} ${CONFIG.CURRENCY}</span>
            </div>
            <div class="space-y-1 pr-2 border-r-2 border-[#FF5000]/40">
              ${subListHtml}
            </div>
          </div>
        `;
      }
      return `
        <div class="flex items-center justify-between p-2 rounded-xl bg-white border border-zinc-200/80 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold bg-zinc-100 px-1.5 py-0.5 rounded text-[10px]">#${escapeHtml(item.sku || 'S21')}</span>
            <span class="font-bold text-zinc-900">${escapeHtml(item.nameAr || item.name)}</span>
            <span class="text-zinc-400 font-mono text-[10px]">(${escapeHtml(item.type === 'bookmark' ? 'بوك مارك' : (item.size || '8 سم'))})</span>
          </div>
          <span class="font-mono font-bold">${item.price * (item.quantity || 1)} ${CONFIG.CURRENCY}</span>
        </div>
      `;
    }).join('');
  }

  if (!container) return;

  container.innerHTML = `
    <div class="flex justify-between">
      <span class="font-sans text-zinc-600">المجموع الفرعي:</span>
      <span class="font-bold text-zinc-900">${calc.subtotal} ${CONFIG.CURRENCY}</span>
    </div>
    ${calc.discount > 0 ? `
      <div class="flex justify-between text-[#FF5000] font-bold">
        <span class="font-sans">الخصم (${escapeHtml(state.coupon.code)}):</span>
        <span>-${calc.discount} ${CONFIG.CURRENCY}</span>
      </div>
    ` : ''}
    <div class="flex justify-between">
      <span class="font-sans text-zinc-600">مصاريف الشحن (${escapeHtml(state.selectedGovernorate || 'لم تحدد')}):</span>
      <span class="text-zinc-900 font-bold">${calc.shipping === 0 ? '<span class="text-[#FF5000]">مجاناً 🎉</span>' : `${calc.shipping} ${CONFIG.CURRENCY}`}</span>
    </div>
    <div class="flex justify-between text-sm font-extrabold text-zinc-900 border-t border-zinc-200/80 pt-1 mt-1 font-mono">
      <span class="font-sans">الإجمالي المطلوب:</span>
      <span class="text-[#FF5000]">${calc.total} ${CONFIG.CURRENCY}</span>
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

    // Generate Order Code and WhatsApp message
    const orderCode = generateOrderCode(order);
    const whatsappMsg = formatOrderWhatsAppMessage(order, orderCode);
    const whatsappUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMsg)}`;

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

    showToast(`تم تسجيل الطلب ${orderId} بنجاح! 🚀`);
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

  if (idEl) idEl.textContent = order.id;

  if (copyIdBtn) {
    copyIdBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(order.id);
        showToast(`تم نسخ رقم الطلب #${order.id} بنجاح!`);
      } catch (e) {
        showToast('تعذر النسخ التلقائي لرقم الطلب', 'warning');
      }
    };
  }

  if (summaryEl) {
    const linesCount = (order.lines || order.items || []).length;
    summaryEl.innerHTML = `
      <div class="flex justify-between text-zinc-900 font-bold border-b border-zinc-200 pb-1.5 mb-1.5">
        <span>الإجمالي المستحق:</span>
        <span class="text-[#FF5000] text-sm">${order.total} ${CONFIG.CURRENCY}</span>
      </div>
      <div class="flex justify-between text-zinc-600">
        <span>عدد البنود:</span>
        <span class="text-zinc-900 font-bold">${linesCount} بنود</span>
      </div>
      <div class="flex justify-between text-zinc-600">
        <span>طريقة الدفع:</span>
        <span class="text-zinc-900">${escapeHtml(order.payment)}</span>
      </div>
      <div class="flex justify-between text-zinc-600">
        <span>عنوان التوصيل:</span>
        <span class="text-zinc-900 truncate max-w-[200px]">${escapeHtml(order.customer?.city || order.customer?.governorate || '')} - ${escapeHtml(order.customer?.address || '')}</span>
      </div>
    `;
  }

  if (trackBtn) {
    trackBtn.href = `#/track/${encodeURIComponent(order.id)}`;
    trackBtn.onclick = () => {
      closeConfirmationModal();
      window.location.hash = `#/track/${encodeURIComponent(order.id)}`;
    };
  }

  if (reopenBtn) {
    reopenBtn.onclick = () => {
      window.open(whatsappUrl, '_blank');
    };
  }

  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(whatsappMsg);
        if (copyBtnText) copyBtnText.textContent = 'تم نسخ الرسالة بنجاح! ✓';
        showToast('تم نسخ نص رسالة الطلب للحافظة بنجاح');
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = 'نسخ نص رسالة الطلب يدوياً';
        }, 3000);
      } catch (e) {
        showToast('تعذر النسخ التلقائي، يمكنك تحديد النص ونسخه يدوياً', 'warning');
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
        const text = encodeURIComponent(`مرحباً 👋 مرفق إشعار التحويل لطلب رقم #${order.id} بمبلغ ${order.total} ج.م`);
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

  const calc = calculateCart({
    items: state.cart,
    coupon: state.coupon,
    governorate: state.selectedGovernorate
  });

  if (method === 'instapay') {
    detailsEl.innerHTML = `
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-zinc-900">⚡ الدفع عبر تطبيق InstaPay المعتمد:</span>
          <span class="text-zinc-600 font-mono text-xs">المطلوب: <strong class="text-[#FF5000]">${calc.total} ${CONFIG.CURRENCY}</strong></span>
        </div>
        <div class="flex items-center justify-between bg-white p-2 rounded-lg border border-purple-200">
          <span class="font-mono font-black text-purple-900 select-all" id="instapay-handle-text">stickify21@instapay</span>
          <button type="button" onclick="copyToClipboardText('stickify21@instapay')" class="copy-btn px-2.5 py-1 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-800 text-[11px] font-bold transition flex items-center gap-1">
            <span>نسخ</span>
            <span>📋</span>
          </button>
        </div>
        <p class="text-[10px] text-purple-800">يرجى تحويل المبلغ بدقة ورفع صورة الإشعار بالأسفل لتأكيد حجز طلبك فورياً.</p>
      </div>
    `;
    detailsEl.className = 'mt-2 p-3 rounded-xl bg-purple-50/80 border border-purple-200/80 text-[11px] text-purple-950 leading-relaxed';
    if (proofGroup) proofGroup.classList.remove('hidden');
  } else if (method === 'vodafone_cash') {
    detailsEl.innerHTML = `
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-zinc-900">📱 التحويل عبر محفظة فودافون كاش:</span>
          <span class="text-zinc-600 font-mono text-xs">المطلوب: <strong class="text-[#FF5000]">${calc.total} ${CONFIG.CURRENCY}</strong></span>
        </div>
        <div class="flex items-center justify-between bg-white p-2 rounded-lg border border-rose-200">
          <span class="font-mono font-black text-rose-900 select-all" id="vodafone-number-text">01043546503</span>
          <button type="button" onclick="copyToClipboardText('01043546503')" class="copy-btn px-2.5 py-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-bold transition flex items-center gap-1">
            <span>نسخ</span>
            <span>📋</span>
          </button>
        </div>
        <p class="text-[10px] text-rose-800">يرجى تحويل المبلغ لرقم الكاش الموضح ورفع لقطة شاشة التحويل بالأسفل لتأكيد حجز طلبك.</p>
      </div>
    `;
    detailsEl.className = 'mt-2 p-3 rounded-xl bg-rose-50/80 border border-rose-200/80 text-[11px] text-rose-950 leading-relaxed';
    if (proofGroup) proofGroup.classList.remove('hidden');
  } else {
    detailsEl.innerHTML = `💵 الدفع نقداً للمندوب عند استلام الشحنة ومعاينتها والتأكد من سلامتها.`;
    detailsEl.className = 'mt-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed';
    if (proofGroup) proofGroup.classList.add('hidden');
  }
}

export function handlePaymentProofSelected(event) {
  const file = event.target.files?.[0];
  const errEl = document.getElementById('payment-proof-error');
  const previewBox = document.getElementById('payment-proof-preview');
  const previewImg = document.getElementById('payment-proof-preview-img');
  const filenameEl = document.getElementById('payment-proof-filename');

  if (errEl) errEl.classList.add('hidden');

  if (!file) {
    state.checkoutPaymentProof = null;
    if (previewBox) previewBox.classList.add('hidden');
    return;
  }

  // Check 5MB limit
  if (file.size > 5 * 1024 * 1024) {
    if (errEl) {
      errEl.textContent = 'حجم الصورة يتجاوز الحد الأقصى (5 ميجابايت). يرجى اختيار صورة أصغر.';
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
    if (filenameEl) filenameEl.textContent = file.name;
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
    showToast(`تم نسخ [${text}] بنجاح ✓`);
  } catch (e) {
    showToast('تعذر النسخ التلقائي، يمكنك النسخ يدوياً', 'warning');
  }
}

export function sharePaymentProofOnWhatsApp() {
  const text = encodeURIComponent(`مرحباً 👋 مرفق إشعار التحويل لتأكيد الطلب`);
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
    const isBookmark = product.category === 'bookmarks' || product.type === 'bookmark';
    const unitPrice = getProductPriceForSize(product, state.productDetail.selectedSize, state.productDetail.selectedFinish);
    const totalPriceEl = document.getElementById('product-detail-total-price');
    if (totalPriceEl) totalPriceEl.textContent = `${unitPrice * next} ${CONFIG.CURRENCY}`;
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
  showToast(`تمت إضافة ${qty} قطعة من "${product.nameAr}" إلى السلة 🛍️`);
  toggleCartModal(true);
}

export function addDetailProductToMockup() {
  if (state.productDetail.productId) {
    addStickerToMockup(state.productDetail.productId);
    closeProductDetailModal();
    document.getElementById('mockup-studio-section')?.scrollIntoView({ behavior: 'smooth' });
    showToast('تمت إضافة التصميم إلى استوديو المعاينة 💻');
  }
}

export function renderProductDetailModal(product) {
  const container = document.getElementById('product-detail-content');
  if (!container) return;

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
          <div class="${stageClass} sticker-diecut-minimal flex items-center justify-center transition-all duration-300">
            ${hasImage && safeImage ? `<img src="${safeImage}" alt="${escapeHtml(product.nameAr)}" class="w-full h-full object-contain pointer-events-none">` : safeSvg}
          </div>
          <span class="absolute bottom-3 right-3 text-[10px] font-mono text-zinc-400 font-semibold bg-white/80 px-2 py-0.5 rounded-full border border-zinc-200">
            ${isBookmark ? '350gsm Cardstock' : 'Vinyl Die-Cut'}
          </span>
        </div>

        <button onclick="addDetailProductToMockup()" class="mt-4 w-full py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition flex items-center justify-center gap-1.5">
          <span>تجربة على الأجهزة (المعاينة)</span>
          <span>💻</span>
        </button>
      </div>

      <!-- Right: Product Details & Controls (7 cols) -->
      <div class="md:col-span-7 space-y-5 text-right">
        
        <div>
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-xs font-bold px-3 py-1 rounded-full ${isBookmark ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-[#FF5000]/10 text-[#FF5000] border border-[#FF5000]/20'}">
              ${escapeHtml(product.badge || (isBookmark ? 'فاصل كتب' : 'استيكر فينيل'))}
            </span>
            <span class="font-mono text-xs text-zinc-400 font-bold">#${escapeHtml(product.sku)}</span>
          </div>

          <h2 class="text-2xl font-extrabold text-zinc-900 leading-snug">${escapeHtml(product.nameAr)}</h2>
          <p class="text-xs font-mono text-zinc-400 mt-0.5">${escapeHtml(product.name || '')}</p>
          <p class="text-xs text-zinc-600 mt-3 leading-relaxed">${escapeHtml(product.desc)}</p>
        </div>

        <!-- Size Options -->
        ${!isBookmark ? `
          <div>
            <label class="block text-xs font-bold text-zinc-800 mb-1.5">المقاس:</label>
            <div class="grid grid-cols-3 gap-2 text-xs font-semibold text-center">
              <button type="button" onclick="selectProductDetailSize('small')" class="p-2.5 rounded-xl border transition ${currentSizeKey === 'small' ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-black'}">
                <span>6 سم (Small)</span>
                <span class="block text-[10px] font-mono mt-0.5 opacity-80">${smallPrice} ج.م</span>
              </button>
              <button type="button" onclick="selectProductDetailSize('medium')" class="p-2.5 rounded-xl border transition ${currentSizeKey === 'medium' ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-black'}">
                <span>8 سم (Medium)</span>
                <span class="block text-[10px] font-mono mt-0.5 opacity-80">${medPrice} ج.م</span>
              </button>
              <button type="button" onclick="selectProductDetailSize('large')" class="p-2.5 rounded-xl border transition ${currentSizeKey === 'large' ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-black'}">
                <span>10 سم (Large)</span>
                <span class="block text-[10px] font-mono mt-0.5 opacity-80">${largePrice} ج.م</span>
              </button>
            </div>
          </div>
        ` : `
          <div class="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-xs text-amber-950 space-y-1">
            <p class="font-bold">🔖 مواصفات فاصل الكتب القياسي:</p>
            <p class="text-[11px] text-amber-900/90 leading-relaxed">
              المقاس: ${CONFIG.BOOKMARK_SPECS.dimensions} • كرتون كوشيه مقوى فاخر 350gsm • طبقة حماية سلوفان مطفي ناعمة فاخرة ضد الرطوبة.
            </p>
          </div>
        `}

        <!-- Finish Options -->
        <div>
          <label class="block text-xs font-bold text-zinc-800 mb-1.5">اللمسة النهائية واللمعان:</label>
          <div id="modal-finish-options" class="grid grid-cols-2 gap-2 text-xs font-semibold text-center">
            <button type="button" onclick="selectProductDetailFinish('matte')" class="p-2.5 rounded-xl border transition ${currentFinishKey === 'matte' ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-black'}">
              <span>مطفي (Matte)</span>
            </button>
            <button type="button" onclick="selectProductDetailFinish('glossy')" class="p-2.5 rounded-xl border transition ${currentFinishKey === 'glossy' ? 'border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-black'}">
              <span>لامع (Glossy)</span>
            </button>
          </div>
        </div>

        <!-- Quantity & Price Summary -->
        <div class="pt-4 border-t border-zinc-100 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-xs font-bold text-zinc-700">الكمية:</span>
            <div class="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl">
              <button type="button" onclick="updateProductDetailQty(-1)" class="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 font-bold text-sm flex items-center justify-center transition active:scale-95">-</button>
              <span id="product-detail-qty-val" class="w-8 text-center font-mono font-bold text-xs">${qty}</span>
              <button type="button" onclick="updateProductDetailQty(1)" class="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 font-bold text-sm flex items-center justify-center transition active:scale-95">+</button>
            </div>
          </div>

          <div class="text-left font-mono">
            <span class="text-[10px] text-zinc-400 block font-sans">الإجمالي:</span>
            <span id="product-detail-total-price" class="text-2xl font-black text-[#FF5000]">${totalPrice} ${CONFIG.CURRENCY}</span>
          </div>
        </div>

        <!-- Add to cart CTA -->
        <button ${isOutOfStock ? 'disabled' : 'onclick="addProductDetailToCart()"'} class="w-full py-4 rounded-2xl ${isOutOfStock ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-zinc-900 hover:bg-[#FF5000] text-white active:scale-95'} font-bold text-xs shadow-md transition flex items-center justify-center gap-2">
          <span>${isOutOfStock ? 'المنتج نفد من المخزون' : 'إضافة إلى سلة المشتريات 🛍️'}</span>
        </button>

      </div>

    </div>

    <!-- Related Products -->
    ${relatedProducts.length > 0 ? `
      <div class="pt-6 border-t border-zinc-100 mt-6">
        <h4 class="text-xs font-extrabold text-zinc-900 mb-3 flex items-center justify-between">
          <span>منتجات مشابهة قد تعجبك:</span>
          <span class="text-[11px] font-normal text-zinc-400 font-mono">You might also like</span>
        </h4>
        <div class="grid grid-cols-3 gap-3">
          ${relatedProducts.map(rel => {
            const relSafeImg = sanitizeUrl(rel.image);
            const relSafeSvg = sanitizeSvg(rel.svg);
            return `
              <div onclick="openProductDetailModal('${escapeHtml(rel.id)}')" class="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 hover:border-black cursor-pointer transition text-center group">
                <div class="w-16 h-16 mx-auto flex items-center justify-center mb-2">
                  ${rel.image && relSafeImg ? `<img src="${relSafeImg}" alt="" class="w-12 h-12 object-contain">` : relSafeSvg}
                </div>
                <p class="text-xs font-bold text-zinc-900 truncate group-hover:text-[#FF5000] transition">${escapeHtml(rel.nameAr)}</p>
                <p class="text-[11px] font-mono font-bold text-zinc-500 mt-0.5">${rel.price} ${CONFIG.CURRENCY}</p>
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

  const input = document.getElementById('track-order-input');
  if (input && prefill) {
    input.value = prefill;
    await searchTrackOrder(prefill);
  } else {
    const container = document.getElementById('tracking-result-container');
    if (container && !input?.value) {
      container.innerHTML = `
        <div class="p-6 bg-zinc-50 border border-zinc-200 rounded-2xl text-center text-xs text-zinc-500 leading-relaxed">
          <span>أدخل رقم الطلب الخاص بك لمتابعة مسار شحن وتجهيز الاستيكرات والبوك مارك لحظة بلحظة.</span>
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

  const cleanQuery = (query || '').trim();
  if (!cleanQuery) {
    container.innerHTML = `
      <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 text-center font-semibold">
        يرجى إدخال رقم الطلب (مثال: S21-261116-ABCD) أو رقم الهاتف
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="py-8 text-center text-xs text-zinc-500 font-mono">
      <span>جاري البحث في سجلات الطلبات... ⏳</span>
    </div>
  `;

  const order = await storage.findOrder(cleanQuery);
  if (!order) {
    container.innerHTML = `
      <div class="p-6 bg-zinc-50 border border-zinc-200 rounded-2xl text-center space-y-3">
        <div class="text-3xl">🔍</div>
        <h4 class="font-bold text-sm text-zinc-900">لم يتم العثور على طلب بهذا الرقم</h4>
        <p class="text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto">
          لم نتمكن من العثور على طلب مسجل برقم <strong class="font-mono text-zinc-900">${escapeHtml(cleanQuery)}</strong> في متصفحك الحالي.
        </p>
        <div class="p-3 bg-amber-50 rounded-xl text-[11px] text-amber-800 text-right leading-relaxed border border-amber-200/60">
          💡 <strong>ملاحظة (DEMO):</strong> في هذه النسخة المحلية (Prototype)، تُحفظ الطلبات في متصفح العميل فقط حتى يتم تفعيل الخادم المركزي. يمكنك التواصل مع خدمة العملاء لمتابعة طلبك:
        </div>
        <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(`مرحباً STICKIFY 21، أود الاستفسار عن حالة طلبي رقم: ${cleanQuery}`)}" target="_blank" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:bg-[#20ba59] transition shadow-sm">
          <span>تواصل مع الدعم عبر واتساب (01043546503)</span>
          <span>💬</span>
        </a>
      </div>
    `;
    return;
  }

  // Visual status timeline
  const lifecycleSteps = [
    { key: 'pending', label: 'جديد', icon: '📝' },
    { key: 'awaiting_confirmation', label: 'بانتظار التأكيد', icon: '⏳' },
    { key: 'confirmed', label: 'مؤكد', icon: '✓' },
    { key: 'preparing', label: 'قيد التجهيز', icon: '📦' },
    { key: 'shipped', label: 'تم الشحن', icon: '🚚' },
    { key: 'completed', label: 'مكتمل', icon: '🎉' }
  ];

  const isCancelled = order.status === 'cancelled';
  const currentStepIdx = lifecycleSteps.findIndex(s => s.key === order.status);

  const timelineHtml = isCancelled ? `
    <div class="p-4 bg-red-50 border border-red-200 rounded-2xl text-center text-xs text-red-800 font-bold mb-4">
      ⚠️ تم إلغاء هذا الطلب. إذا كان لديك استفسار يرجى التواصل معنا عبر واتساب.
    </div>
  ` : `
    <div class="py-4 px-2 bg-zinc-50 rounded-2xl border border-zinc-200 mb-5">
      <div class="flex items-center justify-between relative">
        <div class="absolute top-4 left-6 right-6 h-1 bg-zinc-200 z-0"></div>
        <div class="absolute top-4 right-6 h-1 bg-[#FF5000] z-0 transition-all duration-300" style="width: ${Math.max(0, Math.min(100, (currentStepIdx / (lifecycleSteps.length - 1)) * 100))}%;"></div>
        ${lifecycleSteps.map((step, idx) => {
          const isPassed = currentStepIdx >= idx;
          const isCurrent = currentStepIdx === idx;
          return `
            <div class="relative z-10 flex flex-col items-center text-center">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${isCurrent ? 'bg-[#FF5000] text-white ring-4 ring-[#FF5000]/20 scale-110' : (isPassed ? 'bg-zinc-900 text-white' : 'bg-white border-2 border-zinc-300 text-zinc-400')}">
                ${isPassed && !isCurrent ? '✓' : step.icon}
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
        <p class="font-bold text-zinc-900">${escapeHtml(it.nameAr || it.name)}</p>
        <p class="text-[11px] text-zinc-400 font-mono">${escapeHtml(it.size || '')} • الكمية: ${it.quantity}</p>
      </div>
      <div class="font-mono font-bold text-zinc-900">
        ${it.price * it.quantity} ${CONFIG.CURRENCY}
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="space-y-4 text-right">
      <div class="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 flex items-center justify-between">
        <div>
          <span class="text-[10px] text-zinc-400 font-mono block">رقم الطلب</span>
          <span class="font-mono font-black text-sm text-[#FF5000]">${escapeHtml(order.id)}</span>
        </div>
        <div class="text-left">
          <span class="text-[10px] text-zinc-400 font-mono block">تاريخ التسجيل</span>
          <span class="text-xs font-semibold text-zinc-700">${new Date(order.date || Date.now()).toLocaleDateString('ar-EG')}</span>
        </div>
      </div>

      ${timelineHtml}

      <div class="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3">
        <h5 class="text-xs font-bold text-zinc-900 pb-2 border-b border-zinc-100">تفاصيل الشحن والعميل:</h5>
        <div class="grid grid-cols-2 gap-2 text-xs text-zinc-600">
          <div><span class="text-zinc-400">الاسم:</span> <strong class="text-zinc-900">${escapeHtml(order.customer?.name || '')}</strong></div>
          <div><span class="text-zinc-400">الهاتف:</span> <strong class="text-zinc-900 font-mono">${escapeHtml(order.customer?.phone || '')}</strong></div>
          <div><span class="text-zinc-400">المحافظة:</span> <strong class="text-zinc-900">${escapeHtml(order.customer?.governorate || order.customer?.city || '')}</strong></div>
          <div><span class="text-zinc-400">طريقة الدفع:</span> <strong class="text-zinc-900">${escapeHtml(order.payment || 'عند الاستلام')}</strong></div>
          <div class="col-span-2"><span class="text-zinc-400">العنوان:</span> <strong class="text-zinc-900">${escapeHtml(order.customer?.address || '')}</strong></div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-zinc-200 p-4 space-y-2">
        <h5 class="text-xs font-bold text-zinc-900 pb-1">محتويات الطلب:</h5>
        ${itemsHtml}
        <div class="pt-2 border-t border-zinc-100 space-y-1 text-xs">
          <div class="flex justify-between text-zinc-500"><span>المجموع الفرعي:</span><span class="font-mono">${order.subtotal} ${CONFIG.CURRENCY}</span></div>
          ${order.discount ? `<div class="flex justify-between text-emerald-600"><span>الخصم:</span><span class="font-mono">-${order.discount} ${CONFIG.CURRENCY}</span></div>` : ''}
          <div class="flex justify-between text-zinc-500"><span>مصاريف الشحن:</span><span class="font-mono">${order.shippingCost === 0 ? 'مجاناً' : `${order.shippingCost} ${CONFIG.CURRENCY}`}</span></div>
          <div class="flex justify-between font-extrabold text-sm text-zinc-900 pt-1 border-t border-zinc-100">
            <span>الإجمالي:</span>
            <span class="font-mono text-[#FF5000]">${order.total} ${CONFIG.CURRENCY}</span>
          </div>
        </div>
      </div>

      <div class="pt-2">
        <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(`مرحباً STICKIFY 21، أود المتابعة بخصوص طلبي رقم: ${order.id}`)}" target="_blank" class="w-full py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm">
          <span>متابعة الطلب مع الدعم الفني على واتساب</span>
          <span>💬</span>
        </a>
      </div>
    </div>
  `;
}

// ==========================================
// CUSTOM PRINT STUDIO (IndexedDB & Tiered Pricing)
// ==========================================
export function handleCustomFileSelect(files) {
  const errorEl = document.getElementById('custom-file-error');
  if (errorEl) errorEl.classList.add('hidden');

  if (!files || files.length === 0) return;
  const file = files[0];

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    if (errorEl) {
      errorEl.textContent = 'صيغة الملف غير مدعومة. يرجى رفع ملف بصيغة PNG أو JPG أو PDF.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const maxBytes = 10 * 1024 * 1024; // 10MB
  if (file.size > maxBytes) {
    if (errorEl) {
      errorEl.textContent = 'حجم الملف يتجاوز الحد المسموح (10MB). يرجى تقليل حجم الملف.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  state.customPrint.file = file;
  state.customPrint.fileName = file.name;
  state.customPrint.fileSize = file.size;

  const dropPrompt = document.getElementById('dropzone-prompt');
  const dropPreview = document.getElementById('dropzone-preview');
  const nameEl = document.getElementById('preview-file-name');
  const sizeEl = document.getElementById('preview-file-size');
  const mediaBox = document.getElementById('preview-media-box');

  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

  if (mediaBox) {
    if (file.type === 'application/pdf') {
      mediaBox.innerHTML = '<span class="text-3xl">📄</span>';
    } else {
      const url = URL.createObjectURL(file);
      mediaBox.innerHTML = `<img src="${url}" class="w-full h-full object-contain">`;
    }
  }

  if (dropPrompt) dropPrompt.classList.add('hidden');
  if (dropPreview) dropPreview.classList.remove('hidden');
  showToast('تم تحميل ملف التصميم بنجاح ✓');
}

export function clearCustomUpload(e) {
  if (e) e.stopPropagation();
  state.customPrint.file = null;
  state.customPrint.fileName = '';
  state.customPrint.fileSize = 0;

  const fileInput = document.getElementById('custom-file-input');
  if (fileInput) fileInput.value = '';

  const dropPrompt = document.getElementById('dropzone-prompt');
  const dropPreview = document.getElementById('dropzone-preview');
  if (dropPrompt) dropPrompt.classList.remove('hidden');
  if (dropPreview) dropPreview.classList.add('hidden');
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
  const qty = Math.max(10, state.customPrint.quantity || 10);
  const summary = calculateCustomPrintSummary(qty, state.customPrint.size, state.customPrint.finish);

  const qtyEl = document.getElementById('custom-summary-qty');
  const unitEl = document.getElementById('custom-summary-unit');
  const specEl = document.getElementById('custom-summary-spec');
  const totalEl = document.getElementById('custom-summary-total');
  const savingsRow = document.getElementById('custom-summary-savings-row');
  const savingsEl = document.getElementById('custom-summary-savings');
  const badgeEl = document.getElementById('custom-qty-tier-badge');

  if (qtyEl) qtyEl.textContent = `${qty} قطعة`;
  if (unitEl) unitEl.textContent = `${summary.unitPrice} ج.م`;
  
  const finishLabels = { glossy: 'لامع', matte: 'مطفي' };
  const sizeLabels = { '6cm': '6 سم', '8cm': '8 سم', '10cm': '10 سم', 'custom': 'مقاس مخصص' };
  if (specEl) specEl.textContent = `${sizeLabels[state.customPrint.size] || '8 سم'} • ${finishLabels[state.customPrint.finish] || 'لامع'}`;
  
  if (totalEl) totalEl.textContent = summary.total;

  if (summary.savings > 0) {
    if (savingsRow) savingsRow.classList.remove('hidden');
    if (savingsEl) savingsEl.textContent = `-${summary.savings} ج.م`;
  } else {
    if (savingsRow) savingsRow.classList.add('hidden');
  }

  if (badgeEl) badgeEl.textContent = summary.tierLabel;
}

export async function submitCustomPrintOrder() {
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
      nameError.textContent = 'يرجى كتابة الاسم بالكامل (3 أحرف على الأقل)';
      nameError.classList.remove('hidden');
    }
    hasError = true;
  }

  const cleanPhone = phone.replace(/\s+/g, '');
  const egRegex = /^(?:\+20|0020|0)?(1[0125]\d{8})$/;
  if (!egRegex.test(cleanPhone)) {
    if (phoneError) {
      phoneError.textContent = 'يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678)';
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
    if (state.customPrint.file) {
      try {
        await storage.uploadImage(state.customPrint.file);
      } catch (err) {
        console.warn('Could not store image in IndexedDB:', err);
      }
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
      fileName: state.customPrint.fileName || '',
      date: new Date().toISOString()
    };

    const waMsg = formatCustomPrintWhatsAppMessage(customOrder);
    const waUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;

    showToast(`تم تجهيز طلب الطباعة المخصصة ${customOrderId}! 🎉`);
    window.open(waUrl, '_blank');
  } catch (err) {
    console.error('Error submitting custom print order:', err);
    showToast('حدث خطأ أثناء معالجة طلب الطباعة، يرجى المحاولة مرة أخرى.', 'error');
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
export const POLICY_DATA = {
  about: {
    title: 'قصة STICKIFY 21 (Stick Your Vibe)',
    content: `
      <div class="space-y-4">
        <p class="font-bold text-zinc-900 text-sm">
          أهلاً بك في STICKIFY 21 — استيكرات وفواصل كتب تعبر عن هويتك وشغفك 🍊
        </p>
        <p>
          نحن براند مصري مستقل تأسس لخدمة مجتمع القراء والطلاب والمهندسين وصناع المحتوى في مصر. نؤمن أن اللابتوب، الهواتف الذكية، زجاجات المياه، ورواياتك المفضلة ليست مجرد مقتنيات، بل مساحات تعكس هويتك وأفكارك وشغفك اليومي.
        </p>
        <h4 class="font-bold text-zinc-800 text-xs">خاماتنا ومواصفات الإنتاج:</h4>
        <ul class="list-disc list-inside space-y-1.5 pr-2">
          <li><strong>استيكرات الفينيل المقاومة للماء (Die-Cut Vinyl):</strong> مقاومة تماماً للمياه، الرطوبة، والخدوش. متوفرة بثلاثة مقاسات قياسية (6 سم، 8 سم، 10 سم) وتشطيبات فاخرة (لامع Glossy، ومطفي Matte).</li>
          <li><strong>فواصل الكتب الفاخرة (Bookmarks):</strong> مطبوعة على ورق كرتون مقوى 350gsm بسلوفان مطفي ناعم الملمس وتصميمات أدبية وسينمائية تلهم القراءة.</li>
          <li><strong>الطباعة المخصصة (Custom Printing):</strong> نوفر لنوادي الجامعات، الشركات الناشئة، المدارس، والمكتبات خدمة طباعة التصاميم والشعارات الخاصة ابتداءً من 10 قطع وحتى آلاف القطع بأعلى جودة وسرعة تنفيذ.</li>
        </ul>
        <div class="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between">
          <span class="font-bold text-zinc-800">تواصل مباشر مع فريق العمل:</span>
          <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}" target="_blank" class="font-mono text-[#FF5000] font-bold hover:underline">01043546503</a>
        </div>
      </div>
    `
  },
  shipping_returns: {
    title: 'سياسة الشحن والتوصيل والاستبدال',
    content: `
      <div class="space-y-4">
        <h4 class="font-bold text-zinc-900 text-sm">🚚 الشحن والتوصيل لكافة المحافظات</h4>
        <p>
          نقوم بالتوصيل إلى جميع محافظات جمهورية مصر العربية الـ 27 عبر شركات شحن متخصصة تضمن تسليم الشحنات سليمة في أسرع وقت.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
            <span class="font-bold text-zinc-900 block mb-1">القاهرة الكبرى والإسكندرية:</span>
            <span class="text-zinc-600">خلال 2 – 4 أيام عمل (تكلفة الشحن 35 – 45 ج.م).</span>
          </div>
          <div class="bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
            <span class="font-bold text-zinc-900 block mb-1">باقي محافظات مصر والصعيد:</span>
            <span class="text-zinc-600">خلال 3 – 5 أيام عمل (تكلفة الشحن 50 – 75 ج.م).</span>
          </div>
        </div>
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 font-bold">
          🎉 شحن مجاني بالكامل لأي طلب يتجاوز ${CONFIG.FREE_SHIPPING_THRESHOLD} ج.م (يُحتسب بعد تطبيق كود الخصم).
        </div>

        <h4 class="font-bold text-zinc-900 text-sm pt-2">🔄 سياسة الاسترجاع والاستبدال (14 يوماً)</h4>
        <ul class="list-disc list-inside space-y-1.5 pr-2">
          <li>طبقاً لقانون حماية المستهلك المصري، يحق للعميل استبدال أو إرجاع الاستيكرات الجاهزة وفواصل الكتب خلال <strong>14 يوماً</strong> من تاريخ الاستلام، بشرط أن تكون المنتجات بحالتها الأصلية غير مستخدمة.</li>
          <li>في حال وجود أي عيب طباعة، أو تلف بالمنتج، أو خطأ في المحتوى مقارنة بالطلب، يتحمل متجر STICKIFY 21 كافة مصاريف الشحن للاستبدال أو إعادة كامل المبلغ للعميل فوراً.</li>
          <li><strong>الطلبات المخصصة (Custom Prints):</strong> نظراً لتصنيعها خصيصاً بناءً على طلب العميل وتصاميمه المعتمدة، لا يمكن استرجاعها إلا في حال وجود عيب مصنعي في خامة الفينيل أو خطأ في أبعاد الطباعة مقارنة بالملف المرسل.</li>
        </ul>
      </div>
    `
  },
  terms: {
    title: 'الشروط والأحكام العامة للمتجر',
    content: `
      <div class="space-y-4">
        <p>
          مرحباً بكم في STICKIFY 21. تنطبق هذه الشروط والأحكام على كافة عمليات الشراء واستخدام المتجر الإلكتروني.
        </p>
        <h4 class="font-bold text-zinc-800 text-xs">1. العملة والأسعار</h4>
        <p>
          جميع الأسعار المعروضة في المتجر مقوّمة بـ <strong>الجنيه المصري (EGP / ج.م)</strong>. يحق للمتجر تحديث الأسعار والعروض الترويجية في أي وقت دون إشعار مسبق، مع التزام المتجر بالأسعار المعتمدة للطلبات التي تم تأكيدها بالفعل.
        </p>
        <h4 class="font-bold text-zinc-800 text-xs">2. آليات الدفع وتأكيد الحجز</h4>
        <p>
          يوفر المتجر خيارات الدفع عند الاستلام (COD)، إنستاباي (InstaPay)، ومحافظ فودافون كاش. في حال الدفع الإلكتروني، يتعين على العميل إرفاق لقطة شاشة أو معرّف التحويل عبر واتساب لمطابقة العملية واعتماد الطلب من الإدارة.
        </p>
        <h4 class="font-bold text-zinc-800 text-xs">3. كوبونات الخصم والعروض الترويجية</h4>
        <p>
          يتم تطبيق الخصم وفق الشروط المحددة لكل كوبون (الحد الأدنى، تاريخ الانتهاء، وعدد مرات الاستخدام). لا يجوز دمج أكثر من كود خصم في الطلب الواحد ما لم يتم النص على ذلك صراحة.
        </p>
        <h4 class="font-bold text-zinc-800 text-xs">4. حقوق الملكية الفكرية</h4>
        <p>
          جميع العلامات التجارية، الشعار الرسمي لـ STICKIFY 21، والمحتوى البصري المعروض بالموقع ملك لأصحابها ومحمية بموجب القوانين. التصاميم المتاحة مخصصة للاستخدام الشخصي المستقل.
        </p>
      </div>
    `
  },
  privacy: {
    title: 'سياسة الخصوصية وأمان البيانات',
    content: `
      <div class="space-y-4">
        <p class="font-bold text-zinc-900">
          خصوصيتك وأمان بياناتك الشخصية أولوية قصوى لدينا في STICKIFY 21.
        </p>
        <h4 class="font-bold text-zinc-800 text-xs">1. تخزين البيانات في هذا النموذج الأولي</h4>
        <p>
          يعمل هذا المتجر بنظام محلي آمن يعتمد على تقنيات المتصفح الحديثة (LocalStorage و IndexedDB). يتم حفظ محتويات السلة، مسودات الطلبات، والتفضيلات محلياً داخل جهازك فقط، ولا يتم إرسال أي بيانات شخصية إلى أي خوادم طرف ثالث غير مصرح بها.
        </p>
        <h4 class="font-bold text-zinc-800 text-xs">2. البيانات المطلوبة للشحن</h4>
        <p>
          عند إتمام الطلب، يتم طلب الاسم، رقم الهاتف المحمول، المحافظة، والعنوان التفصيلي. تُستخدم هذه البيانات حصراً لتجهيز الطلبية، التواصل بشأن موعد التسليم، والتنسيق مع شركة الشحن لتوصيل الطلب إلى باب منزلك.
        </p>
        <h4 class="font-bold text-zinc-800 text-xs">3. كود الطلب المشفر عبر واتساب (Order Code)</h4>
        <p>
          لضمان دقة الطلب وسرعة اعتماده، يتم تضمين كود رقمي مؤمن في نهاية رسالة الواتساب يحتوي على تفاصيل العناصر والكميات ليتمكن فريق الإدارة من استيراد الطلب بدقة 100% دون أخطاء كتابية.
        </p>
        <h4 class="font-bold text-zinc-800 text-xs">4. حق التحكم ومسح البيانات</h4>
        <p>
          يحق لك في أي وقت مسح بياناتك من خلال إفراغ سلة الشراء أو مسح بيانات الموقع المحلي من إعدادات المتصفح.
        </p>
      </div>
    `
  },
  contact: {
    title: 'تواصل مع فريق STICKIFY 21',
    content: `
      <div class="space-y-4">
        <p>
          فريق خدمة العملاء والدعم الفني في STICKIFY 21 جاهز للرد على استفساراتك واستقبال طلباتك المخصصة.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
            <span class="text-xs text-zinc-400 block font-bold mb-1">واتساب المبيعات والدعم:</span>
            <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}" target="_blank" class="font-mono text-base font-extrabold text-[#25D366] hover:underline flex items-center gap-1.5">
              <span>💬</span>
              <span>01043546503</span>
            </a>
            <span class="text-[11px] text-zinc-500 block mt-1">متاح يومياً من 10 ص حتى 10 م بتوقيت مصر.</span>
          </div>
          <div class="bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
            <span class="text-xs text-zinc-400 block font-bold mb-1">طلبات الطباعة المخصصة والجملة:</span>
            <span class="font-bold text-zinc-900 block text-sm">نوادي، شركات، مكتبات، وجامعات</span>
            <span class="text-[11px] text-zinc-500 block mt-1">خصومات تبدأ من 10 قطع وتصل لـ 50% على الكميات الكبيرة.</span>
          </div>
        </div>
        <div class="p-3 bg-zinc-100 rounded-2xl text-[11px] text-zinc-600 font-mono text-center">
          STICKIFY 21 — Made with Passion in Egypt 🇪🇬
        </div>
      </div>
    `
  }
};

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
  const data = POLICY_DATA[section] || POLICY_DATA.about;

  // Update tab buttons style
  document.querySelectorAll('.policy-tab-btn').forEach(btn => {
    btn.classList.remove('bg-zinc-900', 'text-white');
    btn.classList.add('bg-zinc-100', 'text-zinc-700');
  });
  const activeBtn = document.getElementById(`policy-tab-btn-${section}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-zinc-100', 'text-zinc-700');
    activeBtn.classList.add('bg-zinc-900', 'text-white');
  }

  if (contentEl) {
    contentEl.innerHTML = `
      <h3 id="policy-modal-title" class="font-extrabold text-base text-zinc-900 mb-3">${escapeHtml(data.title)}</h3>
      <div id="policy-modal-body">${data.content}</div>
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
  iconSpan.textContent = type === 'error' ? '✕' : (type === 'warning' ? '!' : '✓');

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
window.clearCustomUpload = clearCustomUpload;
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
window.analytics = analytics;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
