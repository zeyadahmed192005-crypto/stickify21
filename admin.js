/**
 * STICKIFY 21 - Admin Portal Controller
 * PIN Security: 2121 (DEMO ONLY: client-side protection, not secure for production)
 * Category, Product, Order, and Coupon Management
 */

import { CONFIG } from './src/config/config.js';
import { escapeHtml, sanitizeUrl, sanitizeSvg } from './src/utils/escape.js';

const DEFAULT_PIN = '2121';

// Safe JSON parser
function safeJsonParse(jsonString, fallback, key = 'unknown') {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error(`[STICKIFY 21 Admin] Corrupt JSON in "${key}":`, err);
    try {
      localStorage.setItem(`${key}_corrupt_${Date.now()}`, jsonString);
    } catch(e) {}
    return fallback;
  }
}

// Default Categories
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

// Default initial coupons (Fixes Bug 07: Only advertised coupon)
const defaultCoupons = [
  CONFIG.ADVERTISED_COUPON
];

// Fallback initial products
const fallbackProducts = [
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
    svg: `<svg viewBox="0 0 100 200" class="w-full h-full"><rect x="10" y="10" width="80" height="180" rx="8" fill="#18181B" stroke="#FF5000" stroke-width="3"/><text x="50" y="105" font-family="'Readex Pro'" font-weight="700" font-size="12" fill="#FF5000" text-anchor="middle">فِي الزَّمَانِ</text><text x="50" y="125" font-family="'Readex Pro'" font-weight="800" font-size="14" fill="#FFFFFF" text-anchor="middle">كِتَابُ</text></svg>`,
    dateAdded: 14
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
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="15" y="15" width="130" height="130" rx="26" fill="#0E0E10" stroke="#FF5000" stroke-width="4"/><text x="80" y="140" font-family="'Space Grotesk'" font-weight="800" font-size="12" fill="#FF5000" text-anchor="middle">GIT --FORCE</text></svg>`,
    dateAdded: 9
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
    svg: `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="15" y="30" width="130" height="100" rx="22" fill="#FFFFFF" stroke="#0E0E10" stroke-width="5"/><text x="80" y="85" font-family="'Readex Pro'" font-weight="800" font-size="34" fill="#0E0E10" text-anchor="middle">فَكّـكْ</text></svg>`,
    dateAdded: 7
  }
];

// App State
let adminState = {
  authenticated: false,
  currentTab: 'orders',
  orders: [],
  products: [],
  categories: [],
  coupons: [],
  productSearch: ''
};

// Initialize
export function initAdmin() {
  const isAuth = sessionStorage.getItem('stickify21_admin_auth');
  if (isAuth === 'true') {
    unlockDashboard();
  }

  loadData();
}

function loadData() {
  // Orders
  adminState.orders = safeJsonParse(localStorage.getItem('stickify21_orders'), [], 'stickify21_orders');
  
  // Categories
  const storedCats = safeJsonParse(localStorage.getItem('stickify21_categories'), null, 'stickify21_categories');
  if (storedCats && Array.isArray(storedCats) && storedCats.length > 0) {
    adminState.categories = storedCats;
  } else {
    adminState.categories = [...defaultCategories];
    try {
      localStorage.setItem('stickify21_categories', JSON.stringify(adminState.categories));
    } catch(e) {}
  }

  // Products
  const storedProds = safeJsonParse(localStorage.getItem('stickify21_products'), null, 'stickify21_products');
  if (storedProds && Array.isArray(storedProds) && storedProds.length > 0) {
    adminState.products = storedProds;
  } else {
    adminState.products = [...fallbackProducts];
    try {
      localStorage.setItem('stickify21_products', JSON.stringify(adminState.products));
    } catch(e) {}
  }

  // Coupons
  const storedCoupons = safeJsonParse(localStorage.getItem('stickify21_coupons'), null, 'stickify21_coupons');
  if (storedCoupons && Array.isArray(storedCoupons) && storedCoupons.length > 0) {
    adminState.coupons = storedCoupons;
  } else {
    adminState.coupons = [...defaultCoupons];
    try {
      localStorage.setItem('stickify21_coupons', JSON.stringify(adminState.coupons));
    } catch(e) {}
  }

  renderAll();
}

function renderAll() {
  renderOrders();
  renderProducts();
  renderCategories();
  renderCoupons();
  updateBadges();
}

// PIN Security (DEMO ONLY)
export function verifyAdminPin(e) {
  e.preventDefault();
  const pinInput = document.getElementById('admin-pin-input');
  if (!pinInput) return;

  if (pinInput.value === DEFAULT_PIN) {
    sessionStorage.setItem('stickify21_admin_auth', 'true');
    unlockDashboard();
  } else {
    showAdminToast('رمز الدخول غير صحيح!', 'error');
    pinInput.value = '';
    pinInput.focus();
  }
}

export function unlockDashboard() {
  adminState.authenticated = true;
  const lock = document.getElementById('admin-lock-screen');
  const dash = document.getElementById('admin-dashboard-app');
  if (lock) lock.classList.add('hidden');
  if (dash) dash.classList.remove('hidden');
  loadData();
}

export function lockAdmin() {
  sessionStorage.removeItem('stickify21_admin_auth');
  adminState.authenticated = false;
  const lock = document.getElementById('admin-lock-screen');
  const dash = document.getElementById('admin-dashboard-app');
  if (dash) dash.classList.add('hidden');
  if (lock) lock.classList.remove('hidden');
  const pinInput = document.getElementById('admin-pin-input');
  if (pinInput) pinInput.value = '';
}

// Tab Switching
export function switchTab(tabName) {
  adminState.currentTab = tabName;
  ['orders', 'products', 'categories', 'coupons'].forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (section && btn) {
      section.classList.toggle('hidden', t !== tabName);
      btn.classList.toggle('active', t === tabName);
      btn.classList.toggle('text-zinc-600', t !== tabName);
    }
  });
}

function updateBadges() {
  const oBadge = document.getElementById('orders-count-badge');
  const pBadge = document.getElementById('products-count-badge');
  const catBadge = document.getElementById('categories-count-badge');
  const cBadge = document.getElementById('coupons-count-badge');
  const catAdminBadge = document.getElementById('categories-admin-badge');
  if (oBadge) oBadge.innerText = adminState.orders.length;
  if (pBadge) pBadge.innerText = adminState.products.length;
  if (catBadge) catBadge.innerText = adminState.categories.length;
  if (cBadge) cBadge.innerText = adminState.coupons.length;
  if (catAdminBadge) catAdminBadge.innerText = `${adminState.categories.length} أقسام`;
}

// ==========================================
// ORDERS CONTROLLER (XSS Fixed)
// ==========================================
export function renderOrders() {
  const container = document.getElementById('orders-list-container');
  if (!container) return;

  const orders = adminState.orders;
  const totalRev = orders.reduce((sum, o) => sum + (parseInt(o.total, 10) || 0), 0);
  const pendingCount = orders.filter(o => o.status !== 'مكتمل').length;

  const statTotal = document.getElementById('stat-total-orders');
  const statRev = document.getElementById('stat-total-revenue');
  const statPending = document.getElementById('stat-pending-orders');
  if (statTotal) statTotal.innerText = orders.length;
  if (statRev) statRev.innerText = `${totalRev} ${CONFIG.CURRENCY}`;
  if (statPending) statPending.innerText = pendingCount;

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16">
        <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-zinc-100 flex items-center justify-center text-3xl">📭</div>
        <h3 class="text-sm font-bold text-zinc-800">لا توجد طلبات مسجلة بعد</h3>
        <p class="text-xs text-zinc-400 mt-1">أي طلب يرسله الزبون من المتجر سيظهر هنا فوراً مع إمكانية معاينته بالصور.</p>
      </div>
    `;
    return;
  }

  // Fixes SEC-01: Escape all customer free text to prevent XSS
  container.innerHTML = orders.map((order, index) => {
    const packingSlipUrl = `packing-slip.html?id=${encodeURIComponent(order.id || '')}`;
    const statusColor = order.status === 'مكتمل' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (order.status === 'تم الشحن' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200');

    return `
      <div class="bg-zinc-50 hover:bg-white rounded-2xl border border-zinc-200 p-5 transition-all duration-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        <div class="space-y-1.5 flex-grow">
          <div class="flex items-center gap-3">
            <span class="font-mono font-black text-sm text-[#FF5000]">#${escapeHtml(order.id || 'S21-ORD')}</span>
            <span class="text-xs text-zinc-400 font-mono">${escapeHtml(order.date || 'اليوم')}</span>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusColor}">
              ${escapeHtml(order.status || 'جديد')}
            </span>
          </div>

          <div class="flex items-center gap-2 text-xs font-bold text-zinc-900 flex-wrap">
            <span>👤 ${escapeHtml(order.customer?.name || 'عميل')}</span>
            <span class="text-zinc-300">•</span>
            <span class="font-mono text-zinc-600">📱 ${escapeHtml(order.customer?.phone || '')}</span>
            <span class="text-zinc-300">•</span>
            <span class="text-zinc-500">📍 ${escapeHtml(order.customer?.city || '')}</span>
          </div>

          <div class="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
            <span>عدد العناصر: <strong class="text-zinc-900 font-mono">${order.items?.length || 0}</strong></span>
            <span>•</span>
            <span>طريقة الدفع: <strong class="text-zinc-900">${escapeHtml(order.payment || 'عند الاستلام')}</strong></span>
            <span>•</span>
            <span>الإجمالي: <strong class="text-[#FF5000] font-mono text-sm">${order.total} ${CONFIG.CURRENCY}</strong></span>
          </div>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-zinc-200">
          <a href="${packingSlipUrl}" target="_blank" class="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
            <span>🖼️ تجهيز بالصور</span>
            <span>↗</span>
          </a>

          <select onchange="updateOrderStatus(${index}, this.value)" class="bg-white border border-zinc-200 rounded-xl px-2.5 py-2 text-xs text-zinc-800 font-bold focus:outline-none">
            <option value="جديد" ${order.status === 'جديد' ? 'selected' : ''}>جديد</option>
            <option value="قيد التجهيز" ${order.status === 'قيد التجهيز' ? 'selected' : ''}>قيد التجهيز</option>
            <option value="تم الشحن" ${order.status === 'تم الشحن' ? 'selected' : ''}>تم الشحن 🚚</option>
            <option value="مكتمل" ${order.status === 'مكتمل' ? 'selected' : ''}>مكتمل ✅</option>
          </select>

          <button onclick="deleteOrder(${index})" class="p-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="حذف الطلب">
            🗑️
          </button>
        </div>

      </div>
    `;
  }).join('');
}

export function updateOrderStatus(index, newStatus) {
  if (!adminState.orders[index]) return;
  adminState.orders[index].status = newStatus;
  try {
    localStorage.setItem('stickify21_orders', JSON.stringify(adminState.orders));
  } catch(e) {}
  renderOrders();
  showAdminToast(`تم تحديث حالة الطلب إلى "${newStatus}"`);
}

export function deleteOrder(index) {
  if (!confirm('هل أنت متأكد من حذف هذا الطلب من السجل؟')) return;
  adminState.orders.splice(index, 1);
  try {
    localStorage.setItem('stickify21_orders', JSON.stringify(adminState.orders));
  } catch(e) {}
  renderOrders();
  updateBadges();
  showAdminToast('تم حذف الطلب بنجاح');
}

export function clearAllOrders() {
  if (!confirm('تحذير: هل تريد مسح سجل الطلبات بالكامل؟')) return;
  adminState.orders = [];
  try {
    localStorage.setItem('stickify21_orders', JSON.stringify([]));
  } catch(e) {}
  renderOrders();
  updateBadges();
  showAdminToast('تم تفريغ السجل بالكامل');
}

// ==========================================
// CATEGORIES CONTROLLER (XSS Fixed)
// ==========================================
export function renderCategories() {
  const container = document.getElementById('categories-list-container');
  if (!container) return;

  container.innerHTML = adminState.categories.map((cat, index) => {
    const count = adminState.products.filter(p => p.category === cat.id).length;
    const safeImage = sanitizeUrl(cat.image);

    return `
      <div class="bg-zinc-50 hover:bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between gap-3 group transition">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-2xl shadow-sm flex-shrink-0 overflow-hidden p-1">
            ${safeImage ? `<img src="${safeImage}" class="w-full h-full object-contain" alt="${escapeHtml(cat.nameAr)}">` : `<span class="text-2xl">${escapeHtml(cat.icon || '🏷️')}</span>`}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="font-bold text-xs text-zinc-900 truncate">${escapeHtml(cat.nameAr)}</h4>
              ${cat.badge ? `<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#FF5000]/10 text-[#FF5000]">${escapeHtml(cat.badge)}</span>` : ''}
              <span class="text-[10px] text-zinc-400 font-mono font-bold">(${count} منتج)</span>
            </div>
            <div class="text-[11px] text-zinc-500 font-mono mt-0.5 truncate">
              <span>${escapeHtml(cat.nameEn || '')}</span> • <span class="text-[#FF5000]">id: ${escapeHtml(cat.id)}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1 flex-shrink-0">
          <button onclick="editCategory(${index})" class="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs transition flex items-center gap-1" title="تعديل بيانات وصورة القسم">
            <span>✏️</span>
            <span>تعديل</span>
          </button>
          <button onclick="deleteCategory(${index})" class="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="حذف القسم">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function handleCategoryFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const input = document.getElementById('cat-image-url');
    if (input) input.value = evt.target.result;
    updateCategoryPreview();
    showAdminToast('تم تحميل صورة القسم بنجاح! 📸');
  };
  reader.readAsDataURL(file);
}

export function updateCategoryPreview() {
  const previewBox = document.getElementById('cat-preview-box');
  const imgUrl = document.getElementById('cat-image-url')?.value.trim();
  const icon = document.getElementById('cat-icon-input')?.value.trim();
  if (!previewBox) return;

  const safeUrl = sanitizeUrl(imgUrl);
  if (safeUrl) {
    previewBox.innerHTML = `<img src="${safeUrl}" class="w-full h-full object-contain" alt="معاينة">`;
  } else if (icon) {
    previewBox.innerHTML = `<span class="text-3xl">${escapeHtml(icon)}</span>`;
  } else {
    previewBox.innerHTML = `<span class="text-3xl">🏷️</span>`;
  }
}

export function editCategory(index) {
  const cat = adminState.categories[index];
  if (!cat) return;

  document.getElementById('cat-edit-index').value = index;
  document.getElementById('cat-name-ar').value = cat.nameAr || '';
  document.getElementById('cat-name-en').value = cat.nameEn || '';
  document.getElementById('cat-id-input').value = cat.id || '';
  document.getElementById('cat-badge-input').value = cat.badge || '';
  document.getElementById('cat-icon-input').value = cat.icon || '';
  document.getElementById('cat-image-url').value = cat.image || '';

  document.getElementById('cat-form-title').innerText = `تعديل قسم: ${cat.nameAr}`;
  document.getElementById('cat-form-desc').innerText = 'قم بتعديل بيانات أو صورة القسم ثم اضغط حفظ التعديلات';
  document.getElementById('cat-submit-btn').innerHTML = `<span>✓ حفظ تعديلات قسم "${escapeHtml(cat.nameAr)}"</span>`;
  document.getElementById('cat-cancel-edit-btn').classList.remove('hidden');

  updateCategoryPreview();

  const container = document.getElementById('category-form-container');
  if (container) {
    container.scrollIntoView({ behavior: 'smooth' });
    container.classList.add('ring-2', 'ring-[#FF5000]');
    setTimeout(() => container.classList.remove('ring-2', 'ring-[#FF5000]'), 1500);
  }
}

export function cancelEditCategory() {
  document.getElementById('cat-edit-index').value = '';
  document.getElementById('category-form').reset();
  document.getElementById('cat-image-url').value = '';
  document.getElementById('cat-form-title').innerText = 'إضافة قسم جديد';
  document.getElementById('cat-form-desc').innerText = 'سيظهر القسم تلقائياً في واجهة المتجر وشريط الفلاتر';
  document.getElementById('cat-submit-btn').innerHTML = '<span>+ حفظ وإضافة القسم للمتجر</span>';
  document.getElementById('cat-cancel-edit-btn').classList.add('hidden');
  updateCategoryPreview();
}

export function handleSaveCategory(e) {
  e.preventDefault();

  const editIndexStr = document.getElementById('cat-edit-index').value;
  const nameAr = document.getElementById('cat-name-ar').value.trim();
  const nameEn = document.getElementById('cat-name-en').value.trim();
  const id = document.getElementById('cat-id-input').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const badge = document.getElementById('cat-badge-input').value.trim();
  const icon = document.getElementById('cat-icon-input').value.trim() || '🏷️';
  const image = document.getElementById('cat-image-url').value.trim();

  if (!nameAr || !id) {
    showAdminToast('يرجى كتابة اسم القسم والكود بالإنجليزي', 'error');
    return;
  }

  if (editIndexStr === '') {
    const exists = adminState.categories.find(c => c.id === id);
    if (exists) {
      showAdminToast('هذا الكود موجود مسبقاً! اختر كود آخر', 'error');
      return;
    }

    const newCat = {
      id: id,
      nameAr: nameAr,
      nameEn: nameEn,
      icon: icon,
      image: sanitizeUrl(image) || null,
      badge: badge || null
    };

    adminState.categories.push(newCat);
    showAdminToast(`تمت إضافة قسم "${nameAr}" بنجاح!`);
  } else {
    const idx = parseInt(editIndexStr, 10);
    const oldCat = adminState.categories[idx];
    const oldId = oldCat.id;

    if (oldId !== id) {
      const exists = adminState.categories.find((c, i) => c.id === id && i !== idx);
      if (exists) {
        showAdminToast('هذا الكود مستخدم لقسم آخر! اختر كود آخر', 'error');
        return;
      }

      adminState.products.forEach(p => {
        if (p.category === oldId) {
          p.category = id;
        }
      });
      saveProducts();
      renderProducts();
    }

    adminState.categories[idx] = {
      ...oldCat,
      id: id,
      nameAr: nameAr,
      nameEn: nameEn,
      icon: icon,
      image: sanitizeUrl(image) || null,
      badge: badge || null
    };

    showAdminToast(`تم تحديث بيانات قسم "${nameAr}" بنجاح! ✓`);
  }

  try {
    localStorage.setItem('stickify21_categories', JSON.stringify(adminState.categories));
  } catch(err) {}
  cancelEditCategory();
  renderCategories();
  updateBadges();
}

export function deleteCategory(index) {
  const cat = adminState.categories[index];
  if (!confirm(`هل أنت متأكد من حذف قسم "${cat.nameAr}"؟`)) return;

  adminState.categories.splice(index, 1);
  try {
    localStorage.setItem('stickify21_categories', JSON.stringify(adminState.categories));
  } catch(err) {}

  renderCategories();
  updateBadges();
  showAdminToast(`تم حذف قسم "${cat.nameAr}"`);
}

// ==========================================
// PRODUCTS CONTROLLER (XSS Fixed)
// ==========================================
export function handleAdminProductSearch(query) {
  adminState.productSearch = query.trim().toLowerCase();
  renderProducts();
}

export function renderProducts() {
  const container = document.getElementById('admin-products-table');
  if (!container) return;

  let list = adminState.products;
  if (adminState.productSearch) {
    const q = adminState.productSearch;
    list = list.filter(p => 
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.nameAr && p.nameAr.includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-zinc-400 bg-white rounded-2xl border border-zinc-200">
        <div class="text-2xl mb-1">🔍</div>
        <p class="text-xs font-bold text-zinc-700">لا توجد استيكرات مطابقة للبحث</p>
      </div>
    `;
    return;
  }

  // Fixes SEC-01: Escape all product values before rendering into innerHTML
  container.innerHTML = list.map((p) => {
    const realIndex = adminState.products.findIndex(prod => prod.id === p.id);
    const isBookmark = p.category === 'bookmarks' || p.type === 'bookmark';
    const safeImage = sanitizeUrl(p.image);
    const safeSvg = sanitizeSvg(p.svg);

    return `
      <div class="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm flex flex-col justify-between group hover:border-zinc-900 transition">
        
        <div class="flex items-center justify-between mb-3">
          <span class="font-mono text-xs font-black text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">
            #${escapeHtml(p.sku || 'SKU')}
          </span>
          <span class="text-[10px] text-zinc-400 font-bold uppercase">
            ${escapeHtml(p.category)}
          </span>
        </div>

        <div class="w-full aspect-square bg-zinc-50 rounded-xl border border-zinc-100 p-3 mb-3 flex items-center justify-center overflow-hidden">
          <div class="${isBookmark ? 'w-20 h-32' : 'w-24 h-24'} flex items-center justify-center">
            ${safeImage ? `<img src="${safeImage}" class="w-full h-full object-contain" alt="${escapeHtml(p.nameAr)}">` : safeSvg}
          </div>
        </div>

        <div class="space-y-1 mb-3">
          <h4 class="font-bold text-xs text-zinc-900 truncate">${escapeHtml(p.nameAr)}</h4>
          <div class="flex items-center justify-between">
            <span class="text-[11px] text-zinc-500">${escapeHtml(p.finish || 'glossy')}</span>
            <div class="flex items-center gap-1">
              <input type="number" value="${p.price}" min="1" onchange="quickUpdatePrice(${realIndex}, this.value)" class="w-16 font-mono font-black text-xs text-center bg-zinc-50 border border-zinc-200 rounded px-1 py-0.5 focus:border-[#FF5000]">
              <span class="text-[10px] text-zinc-500 font-bold">${CONFIG.CURRENCY}</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs">
          <button onclick="openProductModal(${realIndex})" class="py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition flex items-center justify-center gap-1">
            <span>✏️</span>
            <span>تعديل</span>
          </button>
          <button onclick="deleteProduct(${realIndex})" class="py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold transition">
            حذف
          </button>
        </div>

      </div>
    `;
  }).join('');
}

export function quickUpdatePrice(index, newPrice) {
  const priceNum = parseInt(newPrice, 10);
  if (!priceNum || priceNum < 1) return;
  if (!adminState.products[index]) return;
  adminState.products[index].price = priceNum;
  saveProducts();
  showAdminToast(`تم تحديث سعر [${adminState.products[index].sku}] إلى ${priceNum} ${CONFIG.CURRENCY}`);
}

export function handleProductFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const input = document.getElementById('prod-image');
    if (input) input.value = evt.target.result;
    updateProductPreview();
    showAdminToast('تم تحميل صورة الاستيكر بنجاح! 📸');
  };
  reader.readAsDataURL(file);
}

export function updateProductPreview() {
  const previewBox = document.getElementById('prod-preview-box');
  const imgVal = document.getElementById('prod-image')?.value.trim();
  const editId = document.getElementById('prod-edit-id')?.value;
  if (!previewBox) return;

  const safeUrl = sanitizeUrl(imgVal);
  if (safeUrl) {
    previewBox.innerHTML = `<img src="${safeUrl}" class="w-full h-full object-contain" alt="معاينة">`;
  } else if (editId !== '' && adminState.products[parseInt(editId, 10)]?.svg) {
    previewBox.innerHTML = sanitizeSvg(adminState.products[parseInt(editId, 10)].svg);
  } else {
    previewBox.innerHTML = `<span class="text-zinc-300 text-xs font-mono">معاينة</span>`;
  }
}

export function openProductModal(index = null) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('product-modal-title');
  const submitText = document.getElementById('prod-submit-btn-text');
  const catSelect = document.getElementById('prod-category');
  const form = modal.querySelector('form');
  form.reset();

  catSelect.innerHTML = adminState.categories.map(c => `
    <option value="${escapeHtml(c.id)}">${escapeHtml(c.icon || '🏷️')} ${escapeHtml(c.nameAr)}</option>
  `).join('');

  if (index !== null) {
    const p = adminState.products[index];
    title.innerText = `تعديل الاستيكر: ${p.nameAr} (#${p.sku})`;
    if (submitText) submitText.innerText = '✓ حفظ تعديلات الاستيكر';
    document.getElementById('prod-edit-id').value = index;
    document.getElementById('prod-sku').value = p.sku || '';
    document.getElementById('prod-type').value = p.type || (p.category === 'bookmarks' ? 'bookmark' : 'sticker');
    document.getElementById('prod-name-ar').value = p.nameAr || '';
    document.getElementById('prod-name-en').value = p.name || '';
    document.getElementById('prod-price').value = p.price || 35;
    catSelect.value = p.category || 'tech';
    document.getElementById('prod-finish').value = p.finish || 'glossy';
    document.getElementById('prod-badge').value = p.badge || '';
    document.getElementById('prod-image').value = p.image || '';
    document.getElementById('prod-desc').value = p.desc || '';
  } else {
    title.innerText = 'إضافة استيكر أو بوك مارك جديد';
    if (submitText) submitText.innerText = '+ حفظ المنتج في الكتالوج';
    document.getElementById('prod-edit-id').value = '';
    document.getElementById('prod-sku').value = 'STK-' + Math.floor(10 + Math.random() * 90);
    document.getElementById('prod-image').value = '';
  }

  updateProductPreview();
  modal.classList.remove('hidden');
}

export function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
}

export function handleSaveProduct(e) {
  e.preventDefault();

  const editIndexStr = document.getElementById('prod-edit-id').value;
  const sku = document.getElementById('prod-sku').value.trim().toUpperCase();
  const type = document.getElementById('prod-type').value;
  const nameAr = document.getElementById('prod-name-ar').value.trim();
  const nameEn = document.getElementById('prod-name-en').value.trim() || nameAr;
  const price = parseInt(document.getElementById('prod-price').value, 10) || 35;
  const category = document.getElementById('prod-category').value;
  const finish = document.getElementById('prod-finish').value;
  const badge = document.getElementById('prod-badge').value.trim() || (type === 'bookmark' ? 'بوك مارك 🔖' : 'استيكر');
  const image = document.getElementById('prod-image').value.trim();
  const desc = document.getElementById('prod-desc').value.trim() || 'استيكر عالي الجودة ومقاوم لعوامل الجو من STICKIFY 21.';

  const productObj = {
    id: 'stk-' + Date.now(),
    sku: sku,
    name: nameEn,
    nameAr: nameAr,
    category: category,
    subCategory: category + '-sub',
    type: type,
    price: price,
    finish: finish,
    badge: badge,
    desc: desc,
    image: sanitizeUrl(image) || null,
    svg: !image ? `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="15" y="15" width="130" height="130" rx="26" fill="#0E0E10" stroke="#FF5000" stroke-width="4"/><text x="80" y="90" font-family="'Space Grotesk'" font-weight="800" font-size="20" fill="#FF5000" text-anchor="middle">${escapeHtml(sku)}</text></svg>` : null,
    dateAdded: Date.now()
  };

  if (editIndexStr !== '') {
    const idx = parseInt(editIndexStr, 10);
    productObj.id = adminState.products[idx].id;
    if (!productObj.image && adminState.products[idx].svg) {
      productObj.svg = adminState.products[idx].svg;
    }
    if (adminState.products[idx].dateAdded) {
      productObj.dateAdded = adminState.products[idx].dateAdded;
    }
    adminState.products[idx] = productObj;
    showAdminToast(`تم تعديل الاستيكر [${sku}] بنجاح! ✓`);
  } else {
    adminState.products.unshift(productObj);
    showAdminToast(`تمت إضافة [${sku}] إلى كتالوج المتجر بنجاح! 🎉`);
  }

  saveProducts();
  renderProducts();
  renderCategories();
  updateBadges();
  closeProductModal();
}

export function deleteProduct(index) {
  const p = adminState.products[index];
  if (!confirm(`هل أنت متأكد من حذف المنتج [${p.sku}] "${p.nameAr}"؟`)) return;
  adminState.products.splice(index, 1);
  saveProducts();
  renderProducts();
  renderCategories();
  updateBadges();
  showAdminToast(`تم حذف المنتج [${p.sku}]`);
}

function saveProducts() {
  try {
    localStorage.setItem('stickify21_products', JSON.stringify(adminState.products));
  } catch(e) {}
}

// ==========================================
// COUPONS CONTROLLER (XSS Fixed)
// ==========================================
export function renderCoupons() {
  const container = document.getElementById('coupons-list-container');
  if (!container) return;

  if (adminState.coupons.length === 0) {
    container.innerHTML = `
      <div class="text-xs text-zinc-400 py-4 text-center">لا توجد أكواد خصم نشطة</div>
    `;
    return;
  }

  container.innerHTML = adminState.coupons.map((c, index) => `
    <div class="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 border border-zinc-200">
      <div class="flex items-center gap-3">
        <span class="font-mono font-black text-sm bg-zinc-200 px-2 py-0.5 rounded text-zinc-900">${escapeHtml(c.code)}</span>
        <span class="text-xs font-bold text-emerald-600">خصم ${c.discountPercent}%</span>
      </div>
      <button onclick="deleteCoupon(${index})" class="text-xs text-red-500 hover:text-red-700 font-bold p-1">
        حذف
      </button>
    </div>
  `).join('');
}

export function handleCreateCoupon(e) {
  e.preventDefault();
  const code = document.getElementById('coupon-code-input').value.trim().toUpperCase();
  const percent = parseInt(document.getElementById('coupon-percent-input').value, 10);

  if (!code || isNaN(percent)) return;

  const exists = adminState.coupons.find(c => c.code === code);
  if (exists) {
    showAdminToast('هذا الكود موجود بالفعل!', 'error');
    return;
  }

  adminState.coupons.push({ code: code, discountPercent: percent });
  try {
    localStorage.setItem('stickify21_coupons', JSON.stringify(adminState.coupons));
  } catch(err) {}
  
  document.getElementById('coupon-code-input').value = '';
  document.getElementById('coupon-percent-input').value = '';

  renderCoupons();
  updateBadges();
  showAdminToast(`تم تفعيل كود الخصم "${code}" بنسبة ${percent}%`);
}

export function deleteCoupon(index) {
  const c = adminState.coupons[index];
  if (!confirm(`هل أنت متأكد من حذف كود الخصم "${c.code}"؟`)) return;
  adminState.coupons.splice(index, 1);
  try {
    localStorage.setItem('stickify21_coupons', JSON.stringify(adminState.coupons));
  } catch(err) {}
  renderCoupons();
  updateBadges();
  showAdminToast(`تم حذف كود الخصم "${c.code}"`);
}

// Safe Toast
export function showAdminToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-red-600' : 'bg-zinc-900';
  toast.className = `px-4 py-3 rounded-xl text-xs font-bold text-white shadow-xl flex items-center gap-2 transform transition-all duration-200 translate-y-3 opacity-0 ${bg}`;
  
  const icon = document.createElement('span');
  icon.textContent = type === 'error' ? '✕' : '✓';
  const text = document.createElement('span');
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-3', 'opacity-0');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// Window exposures
window.verifyAdminPin = verifyAdminPin;
window.unlockDashboard = unlockDashboard;
window.lockAdmin = lockAdmin;
window.switchTab = switchTab;
window.updateOrderStatus = updateOrderStatus;
window.deleteOrder = deleteOrder;
window.clearAllOrders = clearAllOrders;
window.editCategory = editCategory;
window.cancelEditCategory = cancelEditCategory;
window.deleteCategory = deleteCategory;
window.handleCategoryFileUpload = handleCategoryFileUpload;
window.updateCategoryPreview = updateCategoryPreview;
window.handleSaveCategory = handleSaveCategory;
window.handleAdminProductSearch = handleAdminProductSearch;
window.quickUpdatePrice = quickUpdatePrice;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.handleProductFileUpload = handleProductFileUpload;
window.updateProductPreview = updateProductPreview;
window.handleSaveProduct = handleSaveProduct;
window.deleteProduct = deleteProduct;
window.handleCreateCoupon = handleCreateCoupon;
window.deleteCoupon = deleteCoupon;

document.addEventListener('DOMContentLoaded', initAdmin);
