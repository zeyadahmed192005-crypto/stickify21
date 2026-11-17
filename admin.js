import { DEFAULT_POLICIES } from './src/data/policies.js';
import { stripEmoji } from './src/utils/emoji.js';
/**
 * STICKIFY 21 - Admin Portal Controller
 * Powered by unified StorageService & PBKDF2 Web Crypto Authentication
 */

import { CONFIG } from './src/config/config.js';
import { escapeHtml, sanitizeUrl, sanitizeSvg } from './src/utils/escape.js';
import { parseOrderCode } from './src/utils/ids.js';
import { ORDER_STATUSES, isValidStatusTransition, normalizeOrderLines, formatPayment, getPaymentMethod } from './src/domain/orders.js';
import { 
  verifyAdminPasscode, 
  isAdminAuthenticated, 
  adminLogout, 
  getRateLimitStatus,
  changeAdminPasscode,
  setupAuthSync
} from './src/domain/auth.js';
import { storage } from './src/data/storage.js';
import {
  validateFile,
  UPLOAD_POLICIES,
  DEFAULT_CUSTOM_UPLOAD_POLICY,
  detectPngAlpha
} from './src/utils/fileValidation.js';

let pendingOpaquePngFile = null;

// Admin State
let adminState = {
  authenticated: false,
  currentTab: 'orders',
  orders: [],
  products: [],
  categories: [],
  coupons: [],
  showcase: [],
  customRequests: [],
  settings: {},
  productSearch: '',
  productCategoryFilter: 'all',
  orderFilters: {
    search: '',
    status: 'all',
    governorate: 'all',
    date: 'all'
  },
  selectedOrderIds: new Set(),
  activeDetailOrderId: null,
  orderQuickFilter: 'all'
};

// ==========================================
// INITIALIZATION & AUTH
// ==========================================
export async function initAdmin() {
  initAdminTheme();
  checkBackupReminder();
  await storage.init();

  // Check if active session in sessionStorage
  if (isAdminAuthenticated()) {
    unlockDashboard();
  } else {
    showLockScreen();
  }

  setupInactivityMonitor();
  setupCrossTabSync();
}

function showLockScreen() {
  const lock = document.getElementById('admin-lock-screen');
  const dash = document.getElementById('admin-dashboard-app');
  if (dash) dash.classList.add('hidden');
  if (lock) lock.classList.remove('hidden');

  const status = getRateLimitStatus();
  const warningEl = document.getElementById('lockout-warning-message');
  const pinInput = document.getElementById('admin-pin-input');
  const loginBtn = document.getElementById('admin-login-btn');

  if (status.isLocked) {
    const mins = Math.ceil(status.remainingMs / 60000);
    if (warningEl) {
      warningEl.textContent = `تم قفل الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. متبقي ${mins} دقيقة.`;
      warningEl.classList.remove('hidden');
    }
    if (pinInput) pinInput.disabled = true;
    if (loginBtn) loginBtn.disabled = true;
  } else {
    if (warningEl) warningEl.classList.add('hidden');
    if (pinInput) {
      pinInput.disabled = false;
      pinInput.value = '';
    }
    if (loginBtn) loginBtn.disabled = false;
  }
}

export async function verifyAdminPin(e) {
  if (e) e.preventDefault();
  const pinInput = document.getElementById('admin-pin-input');
  if (!pinInput) return;

  const enteredPin = pinInput.value.trim();
  if (!enteredPin) {
    showAdminToast('يرجى إدخال رمز الدخول', 'error');
    return;
  }

  const result = await verifyAdminPasscode(enteredPin);

  if (result.success) {
    unlockDashboard();
    showAdminToast('تم تسجيل الدخول بنجاح! مرحباً بك');
  } else {
    showAdminToast(result.error || 'رمز الدخول غير صحيح', 'error');
    const warningEl = document.getElementById('lockout-warning-message');
    const status = getRateLimitStatus();
    if (warningEl && status.isLocked) {
      const mins = Math.ceil(status.remainingMs / 60000);
      warningEl.textContent = `تم قفل الدخول مؤقتاً. يرجى الانتظار ${mins} دقيقة.`;
      warningEl.classList.remove('hidden');
      pinInput.disabled = true;
      const loginBtn = document.getElementById('admin-login-btn');
      if (loginBtn) loginBtn.disabled = true;
    }
    pinInput.value = '';
    pinInput.focus();
  }
}

export async function unlockDashboard() {
  adminState.authenticated = true;
  const lock = document.getElementById('admin-lock-screen');
  const dash = document.getElementById('admin-dashboard-app');
  if (lock) lock.classList.add('hidden');
  if (dash) dash.classList.remove('hidden');

  await loadData();
}

export function lockAdmin() {
  adminLogout();
  adminState.authenticated = false;
  showLockScreen();
}

function setupInactivityMonitor() {
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  events.forEach(evt => {
    window.addEventListener(evt, () => {
      if (adminState.authenticated) {
        if (!isAdminAuthenticated()) {
          lockAdmin();
          showAdminToast('تم إنهاء الجلسة تلقائياً بسبب الخمول (30 دقيقة)', 'warning');
        }
      }
    }, { passive: true });
  });

  setInterval(() => {
    if (adminState.authenticated && !isAdminAuthenticated()) {
      lockAdmin();
      showAdminToast('تم إنهاء الجلسة تلقائياً بسبب الخمول (30 دقيقة)', 'warning');
    }
  }, 60000);
}

function setupCrossTabSync() {
  setupAuthSync(() => {
    if (adminState.authenticated) {
      adminState.authenticated = false;
      showLockScreen();
      showAdminToast('تم تسجيل الخروج من جلسة الإدارة في علامة تبويب أخرى', 'warning');
    }
  });

  window.addEventListener('storage', async (e) => {
    if (e.key && e.key.startsWith('stickify21_')) {
      if (adminState.authenticated) {
        await loadData();
      }
    }
  });
}

// ==========================================
// DATA LOADING
// ==========================================
export async function loadData() {
  adminState.orders = await storage.getOrders();
  adminState.products = await storage.getProducts();
  adminState.categories = await storage.getCategories();
  adminState.coupons = await storage.getCoupons();
  adminState.settings = await storage.getSettings();
  adminState.showcase = await storage.getShowcase();
  adminState.customRequests = await storage.getCustomPrintRequests();

  renderAll();
}

function renderAll() {
  renderOrders();
  renderCustomRequests();
  renderProducts();
  renderCategories();
  renderCoupons();
  renderAdminShowcase();
  renderSettings();
  renderDashboardAnalytics();
  renderStockAlerts();
  renderStorageUsageMeter();
  checkBackupReminder();
  updateBadges();
}

// Tab Switching
export function switchTab(tabName) {
  if (tabName === 'catalog') tabName = 'products';
  adminState.currentTab = tabName;
  ['dashboard', 'orders', 'products', 'categories', 'coupons', 'showcase', 'settings'].forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`) || (t === 'products' ? document.getElementById('tab-btn-catalog') : null);
    if (section && btn) {
      section.classList.toggle('hidden', t !== tabName);
      btn.classList.toggle('active', t === tabName);
      btn.classList.toggle('text-zinc-600', t !== tabName);
    }
  });
  if (tabName === 'dashboard') {
    renderDashboardAnalytics();
    renderStockAlerts();
  }
}

function updateBadges() {
  const oBadge = document.getElementById('orders-count-badge');
  const pBadge = document.getElementById('products-count-badge');
  const catBadge = document.getElementById('categories-count-badge');
  const cBadge = document.getElementById('coupons-count-badge');
  const catAdminBadge = document.getElementById('categories-admin-badge');
  const couponsActiveCount = document.getElementById('coupons-active-count');
  const scBadge = document.getElementById('showcase-count-badge');
  
  if (oBadge) oBadge.innerText = adminState.orders.length;
  if (pBadge) pBadge.innerText = adminState.products.length;
  if (catBadge) catBadge.innerText = adminState.categories.length;
  if (cBadge) cBadge.innerText = adminState.coupons.length;
  if (scBadge && adminState.showcase) scBadge.innerText = adminState.showcase.length;
  if (catAdminBadge) catAdminBadge.innerText = `${adminState.categories.length} أقسام`;
  if (couponsActiveCount) {
    const activeC = adminState.coupons.filter(c => c.active !== false).length;
    couponsActiveCount.innerText = `${activeC} نشط`;
  }
}

// ==========================================
// ORDERS CONTROLLER
// ==========================================
export function renderOrders() {
  const container = document.getElementById('orders-list-container');
  if (!container) return;

  const orders = adminState.orders;
  
  // 1. KPI Calculations
  const totalRev = orders.reduce((sum, o) => sum + (parseInt(o.total, 10) || 0), 0);
  const totalOrdersCount = orders.length;
  const awaitingCount = orders.filter(o => {
    const s = o.status;
    return s === 'awaiting_confirmation' || s === 'pending' || s === 'بانتظار التأكيد' || s === 'جديد';
  }).length;
  const shippedCount = orders.filter(o => {
    const s = o.status;
    return s === 'shipped' || s === 'completed' || s === 'تم الشحن' || s === 'مكتمل';
  }).length;

  // Conversion rate estimate
  let cartCreations = 0;
  try {
    cartCreations = parseInt(localStorage.getItem('stickify21_cart_creations') || '0', 10);
  } catch(e) {}
  const denom = Math.max(totalOrdersCount, cartCreations, 1);
  const conversionRate = Math.min(100, (totalOrdersCount / denom) * 100).toFixed(1);

  // Update KPI Elements
  const statRev = document.getElementById('stat-total-revenue');
  const statTotal = document.getElementById('stat-total-orders');
  const statAwaiting = document.getElementById('stat-awaiting-orders');
  const statShipped = document.getElementById('stat-shipped-orders');
  const statConversion = document.getElementById('stat-conversion-rate');

  if (statRev) statRev.innerText = `${totalRev.toLocaleString('ar-EG')} ${CONFIG.CURRENCY}`;
  if (statTotal) statTotal.innerText = totalOrdersCount;
  if (statAwaiting) statAwaiting.innerText = awaitingCount;
  if (statShipped) statShipped.innerText = shippedCount;
  if (statConversion) statConversion.innerText = `${conversionRate}%`;

  // Quick Filter Counts & Badges (A6)
  const nowDate = new Date();
  const qfCounts = {
    all: orders.length,
    today: orders.filter(o => new Date(o.date || Date.now()).toDateString() === nowDate.toDateString()).length,
    needs_preparing: orders.filter(o => normalizeStatusKey(o.status) === 'confirmed').length,
    needs_shipping: orders.filter(o => normalizeStatusKey(o.status) === 'ready').length,
    unverified_payment: orders.filter(o => {
      const s = normalizeStatusKey(o.status);
      const isCod = o.paymentMethod === 'cod' || (typeof o.payment === 'string' && o.payment.includes('COD'));
      return s !== 'completed' && s !== 'cancelled' && !isCod && !o.paymentVerified;
    }).length
  };

  ['all', 'today', 'needs_preparing', 'needs_shipping', 'unverified_payment'].forEach(k => {
    const el = document.getElementById(`qf-count-${k}`);
    if (el) el.textContent = qfCounts[k];
  });

  // 2. Populate Governorate Filter dropdown if needed
  populateGovernorateFilter();

  // 3. Filter orders based on active filters
  let filtered = [...orders];

  // Apply Quick Filter (A6)
  const activeQf = adminState.orderQuickFilter || 'all';
  if (activeQf === 'today') {
    filtered = filtered.filter(o => new Date(o.date || Date.now()).toDateString() === nowDate.toDateString());
  } else if (activeQf === 'needs_preparing') {
    filtered = filtered.filter(o => normalizeStatusKey(o.status) === 'confirmed');
  } else if (activeQf === 'needs_shipping') {
    filtered = filtered.filter(o => normalizeStatusKey(o.status) === 'ready');
  } else if (activeQf === 'unverified_payment') {
    filtered = filtered.filter(o => {
      const s = normalizeStatusKey(o.status);
      const isCod = o.paymentMethod === 'cod' || (typeof o.payment === 'string' && o.payment.includes('COD'));
      return s !== 'completed' && s !== 'cancelled' && !isCod && !o.paymentVerified;
    });
  }

  if (adminState.orderFilters.search) {
    const q = adminState.orderFilters.search.toLowerCase();
    filtered = filtered.filter(o => 
      (o.id && o.id.toLowerCase().includes(q)) ||
      (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
      (o.customer?.phone && o.customer.phone.includes(q))
    );
  }

  if (adminState.orderFilters.status && adminState.orderFilters.status !== 'all') {
    const st = adminState.orderFilters.status;
    filtered = filtered.filter(o => normalizeStatusKey(o.status) === st);
  }

  if (adminState.orderFilters.governorate && adminState.orderFilters.governorate !== 'all') {
    const gov = adminState.orderFilters.governorate;
    filtered = filtered.filter(o => 
      (o.customer?.governorate === gov || o.customer?.city === gov)
    );
  }

  if (adminState.orderFilters.date && adminState.orderFilters.date !== 'all') {
    const now = new Date();
    filtered = filtered.filter(o => {
      const oDate = new Date(o.date || Date.now());
      if (adminState.orderFilters.date === 'today') {
        return oDate.toDateString() === now.toDateString();
      } else if (adminState.orderFilters.date === 'last7') {
        const diffDays = (now - oDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      } else if (adminState.orderFilters.date === 'month') {
        return oDate.getMonth() === now.getMonth() && oDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }

  // Update Bulk Bar State
  updateBulkBarState();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 bg-zinc-50 rounded-2xl border border-zinc-200">
        <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400"><svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-4a2 2 0 00-2 2v1a2 2 0 01-2 2H8a2 2 0 01-2-2v-1a2 2 0 00-2-2H4"/></svg></div>
        <h3 class="text-sm font-bold text-zinc-800">لا توجد طلبات تطابق معايير البحث والفلترة</h3>
        <p class="text-xs text-zinc-400 mt-1">جرب تغيير الفلاتر أو إعادة ضبط البحث للوصول لجميع الطلبات.</p>
      </div>
    `;
    return;
  }

  // Canonical status keys and display mapping (R2: includes ready)
  const statuses = [
    { key: 'pending', label: 'جديد' },
    { key: 'awaiting_confirmation', label: 'بانتظار التأكيد' },
    { key: 'confirmed', label: 'مؤكد' },
    { key: 'preparing', label: 'قيد التجهيز' },
    { key: 'ready', label: 'تم التجهيز' },
    { key: 'shipped', label: 'تم الشحن' },
    { key: 'completed', label: 'مكتمل' },
    { key: 'cancelled', label: 'ملغي' }
  ];

  container.innerHTML = filtered.map((order) => {
    const packingSlipUrl = `packing-slip.html?id=${encodeURIComponent(order.id || '')}`;
    const currentKey = normalizeStatusKey(order.status);
    const statusObj = ORDER_STATUSES[currentKey] || ORDER_STATUSES.pending;
    const badgeClass = statusObj.badgeClass || 'bg-zinc-100 text-zinc-800 border-zinc-200';
    const isChecked = adminState.selectedOrderIds.has(order.id);

    // Primary Next Step Button (R2)
    const nextStep = getNextLogicalStep(currentKey);
    const quickBtnHtml = nextStep ? `
      <button onclick="handleQuickNextStep('${escapeHtml(order.id)}', '${nextStep.target}')" class="quick-next-step-btn px-3 py-1.5 rounded-xl ${nextStep.btnClass} text-xs font-bold transition flex items-center gap-1 shadow-sm">
        <span>${nextStep.label}</span>
      </button>
    ` : '';

    // Pack Contents Expandable Row (R1)
    const lines = normalizeOrderLines(order);
    const packLines = lines.filter(l => l.type === 'pack');
    let packsExpandHtml = '';
    if (packLines.length > 0) {
      packsExpandHtml = `
        <div class="mt-2.5 pt-2 border-t border-zinc-200/60">
          <button onclick="toggleOrderPacksExpand('${escapeHtml(order.id)}')" class="text-[11px] font-bold text-[#FF5000] hover:underline flex items-center gap-1">
            <span>محتويات باقات الطلب (${packLines.length} باقة)</span>
            <span id="pack-arrow-${escapeHtml(order.id)}">▼</span>
          </button>
          <div id="order-packs-expand-${escapeHtml(order.id)}" class="mt-2 space-y-2 hidden">
            ${packLines.map(pack => `
              <div class="bg-white p-2.5 rounded-xl border border-orange-200/80 text-[11px] space-y-1.5">
                <div class="flex items-center justify-between font-bold text-zinc-900">
                  <span class="text-[#FF5000]">باقة ${pack.size} استيكرات (${Math.round((pack.discountRate || 0.2) * 100)}% خصم)</span>
                  <span class="font-mono text-zinc-900">${pack.packPrice} ${CONFIG.CURRENCY}</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                  ${(pack.items || []).map(sub => `
                    <div class="flex items-center gap-2 p-1.5 bg-zinc-50 rounded-lg border border-zinc-100 text-[10.5px]">
                      <span class="font-mono font-bold text-zinc-800">#${escapeHtml(sub.sku || 'S21')}</span>
                      <span class="text-zinc-900 truncate font-semibold">${escapeHtml(sub.name || '')}</span>
                      <span class="text-zinc-400 font-mono text-[9.5px] mr-auto">(${escapeHtml(sub.sizeKey || '8 سم')})</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="bg-zinc-50 hover:bg-white rounded-2xl border border-zinc-200 p-4 transition-all duration-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${isChecked ? 'ring-2 ring-[#FF5000] bg-orange-50/20' : ''}">
        
        <div class="flex items-start gap-3 flex-grow min-w-0">
          <!-- Selection Checkbox -->
          <div class="pt-1 flex-shrink-0">
            <input type="checkbox" onchange="toggleOrderSelect('${escapeHtml(order.id)}', this.checked)" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-[#FF5000] focus:ring-0 cursor-pointer">
          </div>

          <div class="space-y-1.5 flex-grow min-w-0">
            <div class="flex items-center gap-2.5 flex-wrap">
              <span class="font-mono font-black text-sm text-[#FF5000]">#${escapeHtml(order.id || 'S21-ORD')}</span>
              <span class="text-xs text-zinc-400 font-mono">${escapeHtml(new Date(order.date || Date.now()).toLocaleDateString('ar-EG'))}</span>
              <span class="order-status-badge px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}">
                ${escapeHtml(statusObj.labelAr)}
              </span>
              ${order.courier ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">${escapeHtml(order.courier)} ${order.trackingNumber ? `(${escapeHtml(order.trackingNumber)})` : ''}</span>` : ''}
              ${order.source === 'whatsapp_import' ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">WHATSAPP CODE</span>' : ''}
            </div>

            <div class="flex items-center gap-2 text-xs font-bold text-zinc-900 flex-wrap">
              <span>${escapeHtml(order.customer?.name || 'عميل')}</span>
              <span class="text-zinc-300">•</span>
              <span class="font-mono text-zinc-600" dir="ltr">${escapeHtml(order.customer?.phone || '')}</span>
              <span class="text-zinc-300">•</span>
              <span class="text-zinc-500">${escapeHtml(order.customer?.governorate || order.customer?.city || '')}</span>
              <span class="text-zinc-300">•</span>
              <span class="text-zinc-500 text-[11px] font-normal truncate max-w-xs">${escapeHtml(order.customer?.address || '')}</span>
            </div>

            <div class="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
              <span>عدد البنود: <strong class="text-zinc-900 font-mono">${lines.length}</strong></span>
              <span>•</span>
              <span>طريقة الدفع: <strong class="text-zinc-900">${escapeHtml(formatPayment(order, 'ar'))}</strong></span>
              <span>•</span>
              <span>الإجمالي: <strong class="text-[#FF5000] font-mono text-sm">${order.total} ${CONFIG.CURRENCY}</strong></span>
              ${order.couponCode ? `<span>•</span><span class="text-emerald-600 font-mono font-bold">كوبون: ${escapeHtml(order.couponCode)}</span>` : ''}
            </div>

            ${packsExpandHtml}
          </div>
        </div>

        <!-- Action Controls -->
        <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-zinc-200 flex-shrink-0">
          ${quickBtnHtml}

          <button onclick="openOrderDetailModal('${escapeHtml(order.id)}')" class="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition flex items-center gap-1">
            <span>عرض التفاصيل</span>
          </button>

          <a href="${packingSlipUrl}" target="_blank" class="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1 shadow-sm">
            <span>إذن التجهيز</span>
            <span>↗</span>
          </a>

          <!-- Order Status Dropdown with Valid-Only Transitions Enabled -->
          <select id="status-select-${escapeHtml(order.id)}" onchange="handleOrderStatusChange('${escapeHtml(order.id)}', this.value)" class="bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold focus:outline-none focus:border-[#FF5000]">
            ${statuses.map(s => {
              const isCurrent = currentKey === s.key;
              const isValid = isCurrent || isValidStatusTransition(currentKey, s.key);
              return `<option value="${s.key}" ${isCurrent ? 'selected' : ''} ${!isValid ? 'disabled class="text-zinc-300 bg-zinc-50"' : ''}>
                ${s.label} ${!isValid && !isCurrent ? '(غير متاح)' : ''}
              </option>`;
            }).join('')}
          </select>

          <button onclick="promptCancelOrder('${escapeHtml(order.id)}')" class="p-1.5 text-zinc-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition" title="إلغاء الطلب مع ذكر السبب">
            <svg class="w-4 h-4 text-zinc-400 hover:text-amber-600 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>
          </button>

          <button onclick="deleteOrder('${escapeHtml(order.id)}')" class="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="حذف الطلب">
            <svg class="w-4 h-4 text-zinc-400 hover:text-red-500 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>

      </div>
    `;
  }).join('');
}

function normalizeStatusKey(st) {
  let k = st || 'pending';
  if (k === 'جديد') return 'pending';
  if (k === 'بانتظار التأكيد') return 'awaiting_confirmation';
  if (k === 'مؤكد') return 'confirmed';
  if (k === 'قيد التجهيز') return 'preparing';
  if (k === 'تم التجهيز') return 'ready';
  if (k === 'تم الشحن') return 'shipped';
  if (k === 'مكتمل') return 'completed';
  if (k === 'ملغي') return 'cancelled';
  return k;
}

function populateGovernorateFilter() {
  const sel = document.getElementById('order-filter-gov');
  if (!sel || sel.children.length > 1) return;

  const govs = adminState.settings?.governorates || CONFIG.GOVERNORATES;
  govs.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.nameAr;
    opt.textContent = g.nameAr;
    sel.appendChild(opt);
  });
}

export function handleOrderFilterChange() {
  const sInput = document.getElementById('order-search-input')?.value || '';
  const sStatus = document.getElementById('order-filter-status')?.value || 'all';
  const sGov = document.getElementById('order-filter-gov')?.value || 'all';
  const sDate = document.getElementById('order-filter-date')?.value || 'all';

  adminState.orderFilters = {
    search: sInput.trim(),
    status: sStatus,
    governorate: sGov,
    date: sDate
  };
  renderOrders();
}

export function resetOrderFilters() {
  adminState.orderFilters = { search: '', status: 'all', governorate: 'all', date: 'all' };
  const sInput = document.getElementById('order-search-input');
  const sStatus = document.getElementById('order-filter-status');
  const sGov = document.getElementById('order-filter-gov');
  const sDate = document.getElementById('order-filter-date');
  if (sInput) sInput.value = '';
  if (sStatus) sStatus.value = 'all';
  if (sGov) sGov.value = 'all';
  if (sDate) sDate.value = 'all';
  renderOrders();
}

export function setOrdersQuickFilter(filterKey) {
  adminState.orderQuickFilter = filterKey;
  const buttons = document.querySelectorAll('#orders-quick-filter-tabs button');
  buttons.forEach(btn => {
    const isCurrent = btn.getAttribute('data-quick-filter') === filterKey;
    btn.classList.toggle('active', isCurrent);
    btn.classList.toggle('bg-zinc-900', isCurrent);
    btn.classList.toggle('text-white', isCurrent);
    btn.classList.toggle('bg-zinc-100', !isCurrent);
    btn.classList.toggle('text-zinc-700', !isCurrent);
  });
  renderOrders();
}

// Bulk Checkbox Handling
export function toggleOrderSelect(orderId, checked) {
  if (checked) {
    adminState.selectedOrderIds.add(orderId);
  } else {
    adminState.selectedOrderIds.delete(orderId);
  }
  updateBulkBarState();
}

export function toggleSelectAllOrders(checked) {
  if (checked) {
    adminState.orders.forEach(o => adminState.selectedOrderIds.add(o.id));
  } else {
    adminState.selectedOrderIds.clear();
  }
  renderOrders();
}

function updateBulkBarState() {
  const bar = document.getElementById('orders-bulk-bar');
  const countEl = document.getElementById('bulk-selected-count');
  const count = adminState.selectedOrderIds.size;

  if (bar) {
    bar.classList.toggle('hidden', count === 0);
  }
  if (countEl) {
    countEl.innerText = `${count} محدد`;
  }
}

// Bulk Actions
export function exportOrdersCsv(ordersToExport = null) {
  const orders = ordersToExport && ordersToExport.length > 0 ? ordersToExport : adminState.orders;
  if (!orders || orders.length === 0) {
    showAdminToast('لا توجد طلبات لتصديرها', 'warning');
    return;
  }

  const headers = [
    'رقم الطلب',
    'التاريخ',
    'اسم العميل',
    'رقم الهاتف',
    'المحافظة',
    'العنوان التفصيلي',
    'حالة الطلب',
    'طريقة الدفع',
    'إجمالي الطلب (ج.م)',
    'كود الخصم',
    'عدد العناصر',
    'ملاحظات العميل'
  ];

  function formatCsvCell(str) {
    if (str === null || str === undefined) return '""';
    const clean = String(str).replace(/"/g, '""');
    return `"${clean}"`;
  }

  const rows = orders.map(o => {
    const currentKey = normalizeStatusKey(o.status);
    const statusObj = ORDER_STATUSES[currentKey] || ORDER_STATUSES.pending;
    return [
      formatCsvCell(o.id),
      formatCsvCell(o.date || new Date().toISOString().slice(0, 10)),
      formatCsvCell(o.customer?.name || ''),
      formatCsvCell(o.customer?.phone || ''),
      formatCsvCell(o.customer?.governorate || o.customer?.city || ''),
      formatCsvCell(o.customer?.address || ''),
      formatCsvCell(statusObj.labelAr || o.status),
      formatCsvCell(formatPayment(o, 'ar')),
      formatCsvCell(o.total || 0),
      formatCsvCell(o.couponCode || ''),
      formatCsvCell(o.items?.length || 0),
      formatCsvCell(o.customer?.notes || '')
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  window.__lastExportedCsv = csvContent;

  if (!navigator.webdriver) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `stickify21_orders_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {}
    }, 1000);
  }
  showAdminToast(`تم تصدير ${orders.length} طلب إلى ملف CSV (UTF-8 BOM) بنجاح`);
}

export function exportSelectedOrdersCsv() {
  const selected = adminState.orders.filter(o => adminState.selectedOrderIds.has(o.id));
  if (selected.length === 0) {
    showAdminToast('يرجى تحديد طلب واحد على الأقل للتصدير', 'warning');
    return;
  }
  exportOrdersCsv(selected);
}

export async function bulkUpdateOrderStatus(newStatus) {
  const selected = adminState.orders.filter(o => adminState.selectedOrderIds.has(o.id));
  if (selected.length === 0) {
    showAdminToast('يرجى تحديد طلبات أولاً', 'warning');
    return;
  }

  let successCount = 0;
  let skippedCount = 0;

  for (const order of selected) {
    const currentKey = normalizeStatusKey(order.status);
    if (isValidStatusTransition(currentKey, newStatus)) {
      try {
        await storage.updateOrderStatus(order.id, newStatus, `تحديث جماعي من الإدارة إلى ${ORDER_STATUSES[newStatus]?.labelAr}`);
        successCount++;
      } catch (err) {
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  adminState.selectedOrderIds.clear();
  await loadData();
  const targetLabel = ORDER_STATUSES[newStatus]?.labelAr || newStatus;
  showAdminToast(`تم تحديث ${successCount} طلب إلى [${targetLabel}] بنجاح${skippedCount > 0 ? ` (تم تخطي ${skippedCount} طلب لعدم توافق مسار الحالة)` : ''}`);
}

export function batchPrintSelectedSlips() {
  const selectedIds = Array.from(adminState.selectedOrderIds);
  if (selectedIds.length === 0) {
    showAdminToast('يرجى تحديد طلب واحد على الأقل للطباعة', 'warning');
    return;
  }
  const url = `packing-slip.html?ids=${encodeURIComponent(selectedIds.join(','))}`;
  window.open(url, '_blank');
}

/**
 * Handle Order Status change with lifecycle transition enforcement
 */
export async function handleOrderStatusChange(orderId, targetKey) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  const currentKey = normalizeStatusKey(order.status);

  if (!isValidStatusTransition(currentKey, targetKey)) {
    const fromLabel = ORDER_STATUSES[currentKey]?.labelAr || currentKey;
    const toLabel = ORDER_STATUSES[targetKey]?.labelAr || targetKey;
    showAdminToast(`لا يمكن تغيير حالة الطلب من [${fromLabel}] إلى [${toLabel}] مباشرة!`, 'error');
    // Reset dropdown back to current status
    const selectEl = document.getElementById(`status-select-${orderId}`);
    if (selectEl) selectEl.value = currentKey;
    return;
  }

  try {
    await storage.updateOrderStatus(orderId, targetKey, `تحديث من لوحة الإدارة إلى ${ORDER_STATUSES[targetKey]?.labelAr}`);
    await loadData();
    showAdminToast(`تم تحديث حالة الطلب #${orderId} إلى "${ORDER_STATUSES[targetKey]?.labelAr}" بنجاح!`);
  } catch (err) {
    console.error(err);
    showAdminToast(err.message || 'فشل تحديث حالة الطلب', 'error');
  }
}

export async function promptCancelOrder(orderId) {
  const reason = prompt('يرجى كتابة سبب إلغاء هذا الطلب (مثال: العميل تراجع عن الطلب / نفاد الكمية):');
  if (reason === null) return;
  const cleanReason = reason.trim() || 'تم الإلغاء من قبل إدارة المتجر';

  try {
    await storage.updateOrderStatus(orderId, 'cancelled', cleanReason);
    await loadData();
    showAdminToast(`تم إلغاء الطلب #${orderId} بنجاح (${cleanReason})`);
  } catch (err) {
    showAdminToast(err.message || 'فشل إلغاء الطلب', 'error');
  }
}

export async function deleteOrder(orderId) {
  if (!confirm(`هل أنت متأكد من حذف الطلب #${orderId} من السجل نهائياً؟`)) return;
  const filtered = adminState.orders.filter(o => o.id !== orderId);
  try {
    localStorage.setItem('stickify21_orders', JSON.stringify(filtered));
  } catch(e) {}
  await loadData();
  showAdminToast('تم حذف الطلب بنجاح');
}

export async function clearAllOrders() {
  if (!confirm('تحذير: هل تريد مسح سجل الطلبات بالكامل؟')) return;
  try {
    localStorage.setItem('stickify21_orders', JSON.stringify([]));
  } catch(e) {}
  await loadData();
  showAdminToast('تم تفريغ السجل بالكامل');
}

// ==========================================
// QUICK STATUS LOGIC & 10s UNDO (R2)
// ==========================================
let undoState = {
  active: false,
  orderId: null,
  previousStatus: null,
  countdownInterval: null,
  secondsLeft: 10
};

let currentShippingOrderId = null;

export function getNextLogicalStep(currentKey) {
  const normKey = normalizeStatusKey(currentKey);
  switch (normKey) {
    case 'pending':
    case 'awaiting_confirmation':
      return {
        target: 'confirmed',
        label: 'تأكيد الطلب',
        btnClass: 'bg-blue-600 hover:bg-blue-700 text-white'
      };
    case 'confirmed':
      return {
        target: 'preparing',
        label: 'بدء التجهيز',
        btnClass: 'bg-purple-600 hover:bg-purple-700 text-white'
      };
    case 'preparing':
      return {
        target: 'ready',
        label: 'تم التجهيز',
        btnClass: 'bg-teal-600 hover:bg-teal-700 text-white'
      };
    case 'ready':
      return {
        target: 'shipped',
        label: 'تم الشحن',
        btnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white'
      };
    case 'shipped':
      return {
        target: 'completed',
        label: 'تم التسليم',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white'
      };
    default:
      return null;
  }
}

export function startStatusUndoToast(orderId, previousStatus, newStatusLabel) {
  dismissStatusUndoToast();
  undoState.active = true;
  undoState.orderId = orderId;
  undoState.previousStatus = previousStatus;
  undoState.secondsLeft = 10;

  const toast = document.getElementById('status-undo-toast');
  const textEl = document.getElementById('status-undo-text');
  const timerEl = document.getElementById('status-undo-timer');
  if (toast && textEl && timerEl) {
    textEl.textContent = `تم تحديث الحالة إلى "${newStatusLabel}"`;
    timerEl.textContent = '10';
    toast.classList.remove('hidden');

    undoState.countdownInterval = setInterval(() => {
      undoState.secondsLeft--;
      if (timerEl) timerEl.textContent = String(undoState.secondsLeft);
      if (undoState.secondsLeft <= 0) {
        dismissStatusUndoToast();
      }
    }, 1000);
  }
}

export function dismissStatusUndoToast() {
  if (undoState.countdownInterval) {
    clearInterval(undoState.countdownInterval);
    undoState.countdownInterval = null;
  }
  undoState.active = false;
  undoState.orderId = null;
  undoState.previousStatus = null;
  const toast = document.getElementById('status-undo-toast');
  if (toast) toast.classList.add('hidden');
}

export async function handleUndoStatusChange() {
  if (!undoState.active || !undoState.orderId || !undoState.previousStatus) return;
  const { orderId, previousStatus } = undoState;
  dismissStatusUndoToast();

  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  await storage.updateOrderStatus(orderId, previousStatus, 'تراجع المشرف عن تغيير الحالة');
  await loadData();
  const stObj = ORDER_STATUSES[previousStatus];
  showAdminToast(`تم التراجع عن التغيير، عادت الحالة إلى "${stObj?.labelAr || previousStatus}"`);
}

export async function handleQuickNextStep(orderId, targetStatus) {
  if (targetStatus === 'shipped') {
    openShippingDispatchModal(orderId);
    return;
  }

  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;
  const prevStatus = normalizeStatusKey(order.status);

  // Validate transition
  if (!isValidStatusTransition(prevStatus, targetStatus)) {
    showAdminToast(`لا يمكن الانتقال من "${prevStatus}" إلى "${targetStatus}" مباشرة`, 'error');
    return;
  }

  // Warn if unpaid instapay/vodafone cash (R2/R12)
  const isOnlinePayment = order.paymentMethod === 'instapay' || order.paymentMethod === 'vodafone_cash' || (typeof order.payment === 'string' && (order.payment.includes('InstaPay') || order.payment.includes('فودافون')));
  if (isOnlinePayment && !order.paymentVerified) {
    showAdminToast('تنبيه: لم يتم تأكيد استلام التحويل (إنستاباي/فودافون كاش) لهذا الطلب بعد!', 'warning');
  }

  await storage.updateOrderStatus(orderId, targetStatus, `تحديث سريع للحالة إلى ${targetStatus}`);
  await loadData();

  const statusObj = ORDER_STATUSES[targetStatus];
  const label = statusObj ? statusObj.labelAr : targetStatus;
  startStatusUndoToast(orderId, prevStatus, label);
}

// ==========================================
// SHIPPING DISPATCH MODAL (R2, A3)
// ==========================================
export function openShippingDispatchModal(orderId) {
  currentShippingOrderId = orderId;
  const modal = document.getElementById('shipping-dispatch-modal');
  const subtitle = document.getElementById('ship-modal-order-subtitle');
  const trackingInput = document.getElementById('ship-tracking-input');
  const courierSelect = document.getElementById('ship-courier-select');
  const customInput = document.getElementById('ship-courier-custom');
  const waLink = document.getElementById('ship-whatsapp-link');

  const order = adminState.orders.find(o => o.id === orderId);
  if (subtitle && order) {
    subtitle.textContent = `${order.id} - ${order.customer?.name || ''}`;
  }
  if (trackingInput) {
    trackingInput.value = order?.trackingNumber || '';
  }
  if (courierSelect) {
    courierSelect.value = order?.courier || 'بوسطة (Bosta)';
  }
  if (customInput) {
    customInput.value = '';
    customInput.classList.add('hidden');
  }
  if (waLink) {
    waLink.classList.add('hidden');
  }

  if (modal) modal.classList.remove('hidden');
}

export function closeShippingDispatchModal() {
  currentShippingOrderId = null;
  const modal = document.getElementById('shipping-dispatch-modal');
  if (modal) modal.classList.add('hidden');
}

export function toggleCustomCourierInput(val) {
  const customInput = document.getElementById('ship-courier-custom');
  if (!customInput) return;
  if (val === 'other') {
    customInput.classList.remove('hidden');
    customInput.focus();
  } else {
    customInput.classList.add('hidden');
  }
}

export async function confirmShippingDispatch() {
  if (!currentShippingOrderId) return;
  const order = adminState.orders.find(o => o.id === currentShippingOrderId);
  if (!order) return;

  const courierSelect = document.getElementById('ship-courier-select');
  const customInput = document.getElementById('ship-courier-custom');
  const trackingInput = document.getElementById('ship-tracking-input');

  let courier = courierSelect ? courierSelect.value : 'مندوب خاص';
  if (courier === 'other' && customInput && customInput.value.trim()) {
    courier = customInput.value.trim();
  }
  const trackingNumber = trackingInput ? trackingInput.value.trim() : '';

  const prevStatus = normalizeStatusKey(order.status);
  
  order.courier = courier;
  order.trackingNumber = trackingNumber;
  await storage.updateOrder(order);
  await storage.updateOrderStatus(order.id, 'shipped', `تم الشحن عبر ${courier}${trackingNumber ? ' برقم تتبع ' + trackingNumber : ''}`);
  await loadData();

  // Prepare customer WhatsApp message
  const customerPhone = (order.customer?.phone || '').replace(/\D/g, '');
  const waPhone = customerPhone.startsWith('0') ? '2' + customerPhone : (customerPhone.startsWith('2') ? customerPhone : '20' + customerPhone);
  
  const waMsg = `مرحباً ${order.customer?.name || 'عميلنا العزيز'}\nتم شحن طلبك من STICKIFY 21 بنجاح!\n\nرقم الطلب: ${order.id}\nشركة الشحن: ${courier}\n${trackingNumber ? `رقم التتبع / البوليصة: ${trackingNumber}\n` : ''}المبلغ المطلوب: ${order.total} ${CONFIG.CURRENCY}\n\nيمكنك متابعة حالة الطلب من الرابط التالي:\n${window.location.origin}/track.html?id=${encodeURIComponent(order.id)}\n\nشكراً لتسوقك معنا.`;
  
  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;
  const waLink = document.getElementById('ship-whatsapp-link');
  if (waLink) {
    waLink.href = waUrl;
    waLink.classList.remove('hidden');
  }

  showAdminToast(`تم تحديث الطلب إلى "تم الشحن" بنجاح!`);
  startStatusUndoToast(order.id, prevStatus, 'تم الشحن');
}

// ==========================================
// PACK CONTENTS EXPAND & PASSCODE (R1, R11)
// ==========================================
export function toggleOrderPacksExpand(orderId) {
  const expandEl = document.getElementById(`order-packs-expand-${orderId}`);
  const arrowEl = document.getElementById(`pack-arrow-${orderId}`);
  if (!expandEl) return;
  if (expandEl.classList.contains('hidden')) {
    expandEl.classList.remove('hidden');
    if (arrowEl) arrowEl.textContent = '▲';
  } else {
    expandEl.classList.add('hidden');
    if (arrowEl) arrowEl.textContent = '▼';
  }
}

export async function handleChangePasscode(e) {
  if (e) e.preventDefault();
  const oldInput = document.getElementById('change-old-passcode');
  const newInput = document.getElementById('change-new-passcode');
  if (!oldInput || !newInput) return;

  const oldPass = oldInput.value.trim();
  const newPass = newInput.value.trim();

  if (!oldPass || !newPass) {
    showAdminToast('يرجى ملء جميع الحقول المطلوبة', 'error');
    return;
  }
  if (newPass.length < 4) {
    showAdminToast('رمز الدخول الجديد يجب ألا يقل عن 4 أحرف/أرقام', 'error');
    return;
  }

  const res = await changeAdminPasscode(oldPass, newPass);
  if (res.success) {
    showAdminToast('تم تغيير رمز الدخول بنجاح! احفظ الرمز الجديد');
    oldInput.value = '';
    newInput.value = '';
  } else {
    showAdminToast(res.error || 'فشل تغيير رمز الدخول', 'error');
  }
}

// ==========================================
// ORDER DETAILS MODAL / DRAWER
// ==========================================
export function openOrderDetailModal(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  adminState.activeDetailOrderId = orderId;
  const modal = document.getElementById('order-detail-modal');
  if (!modal) return;

  // Header
  document.getElementById('modal-order-id').innerText = '#' + (order.id || 'S21-ORD');
  document.getElementById('modal-order-date').innerText = new Date(order.date || Date.now()).toLocaleString('ar-EG');
  
  const currentKey = normalizeStatusKey(order.status);
  const statusObj = ORDER_STATUSES[currentKey] || ORDER_STATUSES.pending;
  const badgeEl = document.getElementById('modal-order-status-badge');
  badgeEl.innerText = statusObj.labelAr;
  badgeEl.className = `px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusObj.badgeClass}`;

  // Customer
  document.getElementById('modal-customer-name').innerText = order.customer?.name || 'عميل';
  const phoneLink = document.getElementById('modal-customer-phone');
  const rawPhone = (order.customer?.phone || '').replace(/[^0-9]/g, '');
  phoneLink.innerText = order.customer?.phone || '--';
  phoneLink.href = 'https://wa.me/2' + rawPhone;
  document.getElementById('modal-customer-gov').innerText = order.customer?.governorate || order.customer?.city || '--';
  document.getElementById('modal-customer-address').innerText = order.customer?.address || '--';

  const notesBox = document.getElementById('modal-customer-notes-box');
  const notesEl = document.getElementById('modal-customer-notes');
  if (order.customer?.notes) {
    notesEl.innerText = order.customer.notes;
    notesBox.classList.remove('hidden');
  } else {
    notesBox.classList.add('hidden');
  }

  // Payment Details & Verification (R12)
  const isCod = getPaymentMethod(order) === 'cod';
  const payMethodBadge = document.getElementById('modal-payment-method-badge');
  if (payMethodBadge) {
    payMethodBadge.textContent = formatPayment(order, 'ar');
  }

  const proofImgContainer = document.getElementById('modal-payment-proof-container');
  const proofImg = document.getElementById('modal-payment-proof-thumb');
  const proofUrl = order.paymentProof || (order.payment && (order.payment.proofDataUrl || order.payment.proof));
  if (proofImgContainer && proofImg) {
    if (proofUrl) {
      proofImg.src = proofUrl;
      proofImgContainer.classList.remove('hidden');
    } else {
      proofImgContainer.classList.add('hidden');
      proofImg.src = '';
    }
  }

  const payStatusBadge = document.getElementById('modal-payment-status-badge');
  const payStatusSelect = document.getElementById('modal-payment-status-select');
  const isVerified = Boolean(order.paymentVerified || (order.payment && order.payment.verified));
  const currentPayStatus = isVerified ? 'verified' : (proofUrl ? 'proof_received' : (isCod ? 'unpaid' : 'pending_proof'));

  if (payStatusSelect) {
    payStatusSelect.value = currentPayStatus;
  }
  if (payStatusBadge) {
    if (isVerified) {
      payStatusBadge.textContent = 'تم التحقق';
      payStatusBadge.className = 'font-bold px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-200';
    } else if (proofUrl) {
      payStatusBadge.textContent = 'بانتظار التحقق من الإشعار';
      payStatusBadge.className = 'font-bold px-2.5 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 border border-amber-200';
    } else if (isCod) {
      payStatusBadge.textContent = 'دفع عند الاستلام';
      payStatusBadge.className = 'font-bold px-2.5 py-0.5 rounded-full text-[11px] bg-zinc-100 text-zinc-700';
    } else {
      payStatusBadge.textContent = 'لم يتم الدفع / لا يوجد إشعار';
      payStatusBadge.className = 'font-bold px-2.5 py-0.5 rounded-full text-[11px] bg-red-100 text-red-700';
    }
  }

  const unverifiedWarn = document.getElementById('modal-unverified-payment-warning');
  if (unverifiedWarn) {
    unverifiedWarn.classList.toggle('hidden', isCod || isVerified);
  }

  // Items (R1: Pack contents rendered with .pack-sub-item and [data-pack-item])
  const itemsContainer = document.getElementById('modal-items-container');
  const lines = normalizeOrderLines(order);
  document.getElementById('modal-items-count').innerText = lines.length;

  itemsContainer.innerHTML = lines.map(line => {
    if (line.type === 'pack') {
      const subItemsHtml = (line.items || []).map(sub => {
        const safeImg = sanitizeUrl(sub.image);
        return `
          <div class="pack-sub-item flex items-center justify-between p-2 rounded-xl bg-white border border-orange-200 text-xs gap-2" data-pack-item>
            <div class="flex items-center gap-2 truncate">
              ${safeImg ? `<img src="${safeImg}" class="w-8 h-8 rounded object-contain flex-shrink-0">` : ''}
              <div class="truncate">
                <span class="font-mono font-bold text-zinc-900 text-[10px]">#${escapeHtml(sub.sku || 'S21')}</span>
                <span class="font-semibold text-zinc-800 text-[11px] truncate block">${escapeHtml(sub.name || '')}</span>
                <span class="text-zinc-400 font-mono text-[10px]">(${escapeHtml(sub.sizeKey || '8 سم')} - ${escapeHtml(sub.finish || 'مطفي')})</span>
              </div>
            </div>
            <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">ضمن الباقة</span>
          </div>
        `;
      }).join('');

      return `
        <div class="bg-orange-50/60 p-3 rounded-2xl border border-orange-200 space-y-2">
          <div class="flex items-center justify-between font-bold text-xs">
            <span class="text-[#FF5000]">باقة ${line.size} استيكرات (${Math.round((line.discountRate || 0.2) * 100)}% خصم)</span>
            <span class="font-mono text-zinc-900 font-black">${line.packPrice} ${CONFIG.CURRENCY}</span>
          </div>
          <div class="space-y-1.5 pr-2 border-r-2 border-[#FF5000]/40">
            ${subItemsHtml}
          </div>
        </div>
      `;
    }

    const safeImg = sanitizeUrl(line.image);
    const qty = parseInt(line.quantity || 1, 10);
    const price = parseInt(line.unitPrice || 35, 10);

    return `
      <div class="bg-white p-3 rounded-xl border border-zinc-200 flex items-center justify-between gap-3 shadow-xs">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center overflow-hidden flex-shrink-0 p-1">
            ${safeImg ? `<img src="${safeImg}" class="w-full h-full object-contain">` : `<div class="font-mono font-bold text-xs text-zinc-400">#${escapeHtml(line.sku || '')}</div>`}
          </div>
          <div class="min-w-0">
            <h5 class="font-bold text-xs text-zinc-900 truncate">${escapeHtml(line.name || 'منتج')}</h5>
            <div class="text-[11px] text-zinc-500 font-mono flex items-center gap-2">
              <span class="bg-zinc-100 px-1.5 py-0.2 rounded font-bold text-zinc-700">#${escapeHtml(line.sku || '')}</span>
              <span>${escapeHtml(line.size || line.sizeKey || '8 سم')}</span>
            </div>
          </div>
        </div>
        <div class="text-left font-mono text-xs flex-shrink-0">
          <div class="font-bold text-zinc-900">${price * qty} ${CONFIG.CURRENCY}</div>
          <div class="text-[10px] text-zinc-400">${qty} × ${price}</div>
        </div>
      </div>
    `;
  }).join('');

  // Finance summary
  const subtotal = order.subtotal || lines.reduce((sum, l) => {
    if (l.type === 'pack') return sum + (l.packPrice || 0);
    return sum + ((l.unitPrice || l.price || 0) * (l.quantity || l.qty || 1));
  }, 0);
  document.getElementById('modal-subtotal').innerText = `${subtotal} ${CONFIG.CURRENCY}`;
  const total = order.total || subtotal;
  const shipping = order.shipping !== undefined ? order.shipping : Math.max(0, total - subtotal);
  document.getElementById('modal-shipping').innerText = `${shipping} ${CONFIG.CURRENCY}`;
  
  const discountRow = document.getElementById('modal-discount-row');
  const discountEl = document.getElementById('modal-discount');
  if (order.discount && order.discount > 0) {
    discountEl.innerText = `-${order.discount} ${CONFIG.CURRENCY}`;
    discountRow.classList.remove('hidden');
  } else {
    discountRow.classList.add('hidden');
  }
  document.getElementById('modal-total').innerText = `${total} ${CONFIG.CURRENCY}`;

  // Timeline (Audit Trail)
  const timelineEl = document.getElementById('modal-status-timeline');
  const history = order.statusHistory || [
    { status: currentKey, timestamp: order.date || Date.now(), note: 'تم إنشاء الطلب' }
  ];

  timelineEl.innerHTML = history.map(h => {
    const stObj = ORDER_STATUSES[h.status] || { labelAr: h.status };
    const timeStr = new Date(h.timestamp).toLocaleString('ar-EG');
    return `
      <div class="relative pr-4 pb-2 text-xs">
        <div class="absolute -right-[7px] top-1 w-3 h-3 rounded-full bg-[#FF5000] border-2 border-white shadow"></div>
        <div class="flex items-center gap-2">
          <strong class="text-zinc-900">${escapeHtml(stObj.labelAr)}</strong>
          <span class="text-[10px] text-zinc-400 font-mono">${escapeHtml(timeStr)}</span>
        </div>
        ${h.note ? `<p class="text-[11px] text-zinc-500 mt-0.5">${escapeHtml(h.note)}</p>` : ''}
      </div>
    `;
  }).join('');

  // Status dropdown: Only show valid transitions
  const selectEl = document.getElementById('modal-status-select');
  const allStatuses = [
    { key: 'pending', label: 'جديد' },
    { key: 'awaiting_confirmation', label: 'بانتظار التأكيد' },
    { key: 'confirmed', label: 'مؤكد' },
    { key: 'preparing', label: 'قيد التجهيز' },
    { key: 'ready', label: 'تم التجهيز' },
    { key: 'shipped', label: 'تم الشحن' },
    { key: 'completed', label: 'مكتمل' },
    { key: 'cancelled', label: 'ملغي' }
  ];

  selectEl.innerHTML = allStatuses.map(s => {
    const isCurrent = currentKey === s.key;
    const isValid = isCurrent || isValidStatusTransition(currentKey, s.key);
    return `<option value="${s.key}" ${isCurrent ? 'selected' : ''} ${!isValid ? 'disabled class="text-zinc-300 bg-zinc-50"' : ''}>
      ${s.label} ${!isValid && !isCurrent ? '(غير متاح)' : ''}
    </option>`;
  }).join('');

  // Quick next step in modal (R2)
  const modalQuickStepContainer = document.getElementById('modal-quick-step-container');
  if (modalQuickStepContainer) {
    const nextStep = getNextLogicalStep(currentKey);
    if (nextStep) {
      modalQuickStepContainer.innerHTML = `
        <button onclick="handleQuickNextStep('${escapeHtml(order.id)}', '${nextStep.target}'); closeOrderDetailModal();" class="px-3 py-1.5 rounded-xl ${nextStep.btnClass} text-xs font-bold transition flex items-center gap-1 shadow-sm">
          <span>${nextStep.label}</span>
        </button>
      `;
    } else {
      modalQuickStepContainer.innerHTML = '';
    }
  }

  // Cancel & Packing slip link
  const slipLink = document.getElementById('modal-print-slip-link');
  slipLink.href = `packing-slip.html?id=${encodeURIComponent(order.id)}`;

  modal.classList.remove('hidden');
}

export function closeOrderDetailModal() {
  const modal = document.getElementById('order-detail-modal');
  if (modal) modal.classList.add('hidden');
  adminState.activeDetailOrderId = null;
}

export async function handleModalStatusChange(newStatus) {
  if (!adminState.activeDetailOrderId) return;
  await handleOrderStatusChange(adminState.activeDetailOrderId, newStatus);
  openOrderDetailModal(adminState.activeDetailOrderId);
}

export async function promptCancelCurrentOrder() {
  if (!adminState.activeDetailOrderId) return;
  await promptCancelOrder(adminState.activeDetailOrderId);
  openOrderDetailModal(adminState.activeDetailOrderId);
}

export async function verifyCurrentOrderPayment() {
  const orderId = adminState.activeDetailOrderId;
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  order.paymentVerified = true;
  if (!order.payment || typeof order.payment === 'string') {
    order.payment = { method: order.paymentMethod || 'electronic', label: order.payment, verified: true, status: 'verified' };
  } else {
    order.payment.verified = true;
    order.payment.status = 'verified';
  }

  await storage.updateOrder(order);
  showAdminToast(`تم تأكيد استلام دفعة الطلب #${order.id} بنجاح!`);
  openOrderDetailModal(order.id);
  renderOrders();
}

export async function handleModalPaymentStatusChange(newStatus) {
  const orderId = adminState.activeDetailOrderId;
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  order.paymentVerified = (newStatus === 'verified');
  if (!order.payment || typeof order.payment === 'string') {
    order.payment = { method: order.paymentMethod || 'electronic', label: order.payment, verified: order.paymentVerified, status: newStatus };
  } else {
    order.payment.verified = order.paymentVerified;
    order.payment.status = newStatus;
  }

  await storage.updateOrder(order);
  showAdminToast(`تم تحديث حالة الدفع إلى "${newStatus}"`);
  openOrderDetailModal(order.id);
  renderOrders();
}

export function openFullProofImageModal() {
  const order = adminState.orders.find(o => o.id === adminState.activeDetailOrderId);
  const proofUrl = order?.paymentProof || (order?.payment && (order.payment.proofDataUrl || order.payment.proof));
  if (proofUrl) {
    const w = window.open('');
    if (w) {
      w.document.write(`<title>إشعار التحويل - ${order.id}</title><img src="${proofUrl}" style="max-width:100%; height:auto; display:block; margin:20px auto;">`);
    }
  }
}

// ==========================================
// WHATSAPP ORDER IMPORT (DEMO BRIDGE)
// ==========================================
export function openWhatsAppImportModal() {
  const modal = document.getElementById('whatsapp-import-modal');
  const input = document.getElementById('whatsapp-import-input');
  if (input) input.value = '';
  if (modal) modal.classList.remove('hidden');
}

export function closeWhatsAppImportModal() {
  const modal = document.getElementById('whatsapp-import-modal');
  if (modal) modal.classList.add('hidden');
}

export async function submitWhatsAppImport() {
  const input = document.getElementById('whatsapp-import-input');
  if (!input) return;
  const rawText = input.value.trim();

  if (!rawText) {
    showAdminToast('يرجى لصق رسالة الواتساب أو كود الطلب أولاً', 'error');
    return;
  }

  try {
    const importedOrder = parseOrderCode(rawText);
    await storage.createOrder(importedOrder);
    closeWhatsAppImportModal();
    await loadData();
    showAdminToast(`تم استيراد الطلب [${importedOrder.id}] بنجاح!`);
  } catch (err) {
    console.error('WhatsApp import error:', err);
    showAdminToast(err.message || 'فشل استيراد الطلب، يرجى التأكد من كود الطلب', 'error');
  }
}

// ==========================================
// BACKUP & RESTORE (EXPORT / IMPORT JSON)
// ==========================================
export async function exportAllDataJson() {
  try {
    const data = await storage.exportData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `stickify21_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showAdminToast('تم تصدير ملف النسخة الاحتياطية بنجاح');
  } catch (err) {
    console.error(err);
    showAdminToast('حدث خطأ أثناء تصدير البيانات', 'error');
  }
}

export async function importDataJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const content = evt.target.result;
      const parsed = JSON.parse(content);
      
      const pCount = parsed.products?.length || 0;
      const oCount = parsed.orders?.length || 0;
      const cCount = parsed.coupons?.length || 0;
      
      const confirmMsg = `ملخص ملف الاستيراد:\n- المنتجات: ${pCount}\n- الطلبات: ${oCount}\n- الكوبونات: ${cCount}\n\nتحذير: سيتم استبدال البيانات الحالية (مع حفظ لقطة أمان تلقائية للبيانات الحالية قبل الاستبدال). هل تريد المتابعة؟`;
      
      if (!confirm(confirmMsg)) {
        e.target.value = '';
        return;
      }

      await storage.importData(content);
      await loadData();
      showAdminToast('تم استيراد وترقية البيانات بنجاح!');
    } catch (err) {
      console.error(err);
      showAdminToast(err.message || 'فشل استيراد ملف البيانات', 'error');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

export async function handleResetDemoData() {
  await handleResetDemoDataWithPrompt();
}

export async function handleResetDemoDataWithPrompt() {
  const confirmedText = prompt('تحذير: سيتم إرجاع جميع المنتجات والطلبات لحالة الديمو الأصلية.\n\nللتأكيد النهائي، اكتب كلمة "RESET" بالأحرف الإنجليزية الكبيرة:');
  if (confirmedText !== 'RESET') {
    if (confirmedText !== null) {
      showAdminToast('تم إلغاء عملية إعادة الضبط (لم يتم كتابة كلمة RESET بشكل صحيح)', 'warning');
    }
    return;
  }

  try {
    await storage.resetDemoData();
    await loadData();
    showAdminToast('تمت استعادة بيانات المصنع والديمو بنجاح!');
  } catch (err) {
    console.error(err);
    showAdminToast('فشل إعادة ضبط البيانات', 'error');
  }
}

// ==========================================
// CATEGORIES CONTROLLER (CRUD + REORDER)
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
            ${safeImage ? `<img src="${safeImage}" class="w-full h-full object-contain" alt="${escapeHtml(cat.nameAr)}">` : `<span class="text-xs text-zinc-400 font-mono font-bold">CAT</span>`}
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
          <!-- Reorder buttons -->
          <div class="flex flex-col gap-0.5">
            <button onclick="reorderCategory(${index}, -1)" ${index === 0 ? 'disabled class="opacity-30"' : ''} class="p-1 rounded hover:bg-zinc-200 text-[10px]" title="تحريك لأعلى">▲</button>
            <button onclick="reorderCategory(${index}, 1)" ${index === adminState.categories.length - 1 ? 'disabled class="opacity-30"' : ''} class="p-1 rounded hover:bg-zinc-200 text-[10px]" title="تحريك لأسفل">▼</button>
          </div>

          <button onclick="editCategory(${index})" class="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs transition flex items-center gap-1" title="تعديل">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>تعديل</span>
          </button>
          <button onclick="deleteCategory(${index})" class="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="حذف"><svg class="w-3.5 h-3.5 text-zinc-400 hover:text-red-500 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export async function reorderCategory(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= adminState.categories.length) return;

  const temp = adminState.categories[index];
  adminState.categories[index] = adminState.categories[newIndex];
  adminState.categories[newIndex] = temp;

  try {
    localStorage.setItem('stickify21_categories', JSON.stringify(adminState.categories));
  } catch(e) {}

  renderCategories();
  showAdminToast('تم تغيير ترتيب الأقسام بنجاح');
}

export async function handleCategoryFileUpload(e) {
  const file = e.target.files?.[0];
  const errEl = document.getElementById('cat-file-error');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }
  if (!file) return;

  const check = await validateFile(file, UPLOAD_POLICIES.productPng, 'ar');
  if (!check.valid) {
    if (errEl) {
      errEl.textContent = check.reason;
      errEl.classList.remove('hidden');
    }
    showAdminToast(check.reason, 'error');
    e.target.value = '';
    return;
  }

  try {
    const asset = await storage.uploadProductPng(file);
    const input = document.getElementById('cat-image-url');
    if (input) input.value = asset.dataUrl;
    updateCategoryPreview();
    showAdminToast('تم حفظ صورة القسم بصيغة PNG شفافة بنجاح!');
  } catch (err) {
    showAdminToast('تعذر معالجة صورة PNG، يرجى المحاولة بصورة أخرى.', 'error');
  }
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
    previewBox.innerHTML = `<span class="text-xs text-zinc-400 font-bold">لا توجد صورة</span>`;
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
  document.getElementById('cat-submit-btn').innerHTML = `<span>حفظ تعديلات قسم "${escapeHtml(cat.nameAr)}"</span>`;
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

export async function handleSaveCategory(e) {
  e.preventDefault();

  const nameAr = document.getElementById('cat-name-ar').value.trim();
  const nameEn = document.getElementById('cat-name-en').value.trim();
  const id = document.getElementById('cat-id-input').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const badge = document.getElementById('cat-badge-input').value.trim();
  const icon = document.getElementById('cat-icon-input').value.trim() || 'tag';
  const image = document.getElementById('cat-image-url').value.trim();

  if (!nameAr || !id) {
    showAdminToast('يرجى كتابة اسم القسم والكود بالإنجليزي', 'error');
    return;
  }

  const catObj = {
    id: id,
    nameAr: nameAr,
    nameEn: nameEn,
    icon: icon,
    image: sanitizeUrl(image) || null,
    badge: badge || null
  };

  await storage.saveCategory(catObj);
  showAdminToast(`تم حفظ قسم "${nameAr}" بنجاح!`);

  cancelEditCategory();
  await loadData();
}

export async function deleteCategory(index) {
  const cat = adminState.categories[index];
  if (!confirm(`هل أنت متأكد من حذف قسم "${cat.nameAr}"؟`)) return;

  const filtered = adminState.categories.filter((_, i) => i !== index);
  try {
    localStorage.setItem('stickify21_categories', JSON.stringify(filtered));
  } catch(err) {}

  await loadData();
  showAdminToast(`تم حذف قسم "${cat.nameAr}"`);
}

// ==========================================
// PRODUCTS CONTROLLER (CRUD + IN-STOCK TOGGLE)
// ==========================================
export function handleAdminProductSearch(query) {
  adminState.productSearch = query.trim().toLowerCase();
  renderProducts();
}

export function handleAdminProductCategoryFilter(catId) {
  adminState.productCategoryFilter = catId;
  renderProducts();
}

function isPngImageSource(src) {
  if (!src || typeof src !== 'string') return false;
  const trimmed = src.trim().toLowerCase();
  return trimmed.startsWith('data:image/png') || /\.png(\?.*)?$/i.test(trimmed);
}

export function renderProducts() {
  const container = document.getElementById('admin-products-table');
  if (!container) return;

  // Populate Category Filter dropdown
  const catFilterSelect = document.getElementById('admin-product-category-filter');
  if (catFilterSelect && catFilterSelect.querySelectorAll('option[data-cat-opt="1"]').length === 0) {
    adminState.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.dataset.catOpt = '1';
      opt.textContent = c.nameAr;
      catFilterSelect.appendChild(opt);
    });
  }

  let list = adminState.products;

  // Search filter
  if (adminState.productSearch) {
    const q = adminState.productSearch;
    list = list.filter(p => 
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.nameAr && p.nameAr.includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }

  // Category / Migration filter (including R14 non_png)
  if (adminState.productCategoryFilter === 'missing_en') {
    list = list.filter(p => !p.nameEn || p.nameEn.trim() === '' || p.nameEn === p.nameAr);
  } else if (adminState.productCategoryFilter === 'non_png') {
    list = list.filter(p => Boolean(p.image && p.image.trim() !== '' && !isPngImageSource(p.image)));
  } else if (adminState.productCategoryFilter && adminState.productCategoryFilter !== 'all') {
    list = list.filter(p => p.category === adminState.productCategoryFilter);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-zinc-400 bg-white rounded-2xl border border-zinc-200">
        <div class="w-8 h-8 mx-auto mb-1 text-zinc-400"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
        <p class="text-xs font-bold text-zinc-700">لا توجد منتجات مطابقة للبحث أو الفلتر</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((p) => {
    const realIndex = adminState.products.findIndex(prod => prod.id === p.id);
    const isBookmark = p.category === 'bookmarks' || p.type === 'bookmark';
    const safeImage = sanitizeUrl(p.image);
    const safeSvg = sanitizeSvg(p.svg);
    const inStock = p.inStock !== false;

    return `
      <div class="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm flex flex-col justify-between group hover:border-zinc-900 transition ${!inStock ? 'opacity-75 bg-zinc-50' : ''}">
        
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="font-mono text-xs font-black text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">
              #${escapeHtml(p.sku || 'SKU')}
            </span>
            <span class="text-[10px] text-zinc-400 font-bold uppercase">
              ${escapeHtml(p.category)}
            </span>
          </div>

          <div class="w-full aspect-square bg-zinc-50 rounded-xl border border-zinc-100 p-3 mb-3 flex items-center justify-center overflow-hidden relative">
            ${!inStock ? '<div class="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center text-white text-xs font-bold z-10">غير متوفر بالمخزون</div>' : ''}
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
        </div>

        <div>
          <!-- In-Stock Toggle Switch -->
          <div class="flex items-center justify-between py-2 border-t border-zinc-100 text-xs">
            <span class="text-[11px] text-zinc-600 font-bold">حالة التوفر:</span>
            <button onclick="toggleProductInStock('${escapeHtml(p.id)}')" class="px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${inStock ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-red-50 text-red-700 border-red-300'}">
              ${inStock ? 'متوفر للطلب' : 'غير متوفر'}
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs">
            <button onclick="openProductModal(${realIndex})" class="py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition flex items-center justify-center gap-1">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>تعديل</span>
            </button>
            <button onclick="deleteProduct(${realIndex})" class="py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold transition">
              حذف
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');

  // Also render into products-table-body (A5)
  const tbody = document.getElementById('products-table-body');
  if (tbody) {
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-zinc-400 font-bold">لا توجد منتجات مطابقة للبحث أو الفلتر</td></tr>`;
    } else {
      tbody.innerHTML = list.map(p => {
        const realIndex = adminState.products.findIndex(prod => prod.id === p.id);
        const safeImage = sanitizeUrl(p.image);
        const safeSvg = sanitizeSvg(p.svg);
        const inStock = p.inStock !== false;
        const isChecked = selectedProductIds.has(p.id);

        return `
          <tr class="hover:bg-zinc-50/80 transition ${!inStock ? 'opacity-60 bg-zinc-50/50' : ''}">
            <td class="p-3 text-center">
              <input type="checkbox" class="product-select-chk rounded border-zinc-300 text-[#FF5000]" data-product-id="${p.id}" ${isChecked ? 'checked' : ''} onchange="toggleProductSelect('${p.id}', this.checked)">
            </td>
            <td class="p-3">
              <div class="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center p-1">
                ${safeImage ? `<img src="${safeImage}" class="w-full h-full object-contain" alt="">` : safeSvg}
              </div>
            </td>
            <td class="p-3">
              <div class="product-name-cell font-bold text-zinc-900">${escapeHtml(p.nameAr || p.name)}</div>
              <div class="text-[10px] text-zinc-400 font-mono">${escapeHtml(p.nameEn || '')}</div>
            </td>
            <td class="p-3 font-mono font-bold text-zinc-700">#${escapeHtml(p.sku || '')}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 font-bold">${escapeHtml(p.category)}</span></td>
            <td class="p-3 font-mono font-extrabold text-zinc-900">${p.price || 35} ${CONFIG.CURRENCY}</td>
            <td class="p-3">
              <button onclick="toggleProductInStock('${p.id}')" class="px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${inStock ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-red-50 text-red-700 border-red-300'}">
                ${inStock ? 'متوفر' : 'نفد'}
              </button>
            </td>
            <td class="p-3 text-center">
              <div class="flex items-center justify-center gap-1.5">
                <button data-action="duplicate" onclick="duplicateProduct('${p.id}')" class="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition">
                  تكرار
                </button>
                <button onclick="openProductModal(${realIndex})" class="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold transition">
                  تعديل
                </button>
                <button onclick="deleteProduct(${realIndex})" class="p-1 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

// ==========================================
// A5: PRODUCT DUPLICATION & BULK ACTIONS
// ==========================================
let productUndoState = {
  active: false,
  previousProducts: null,
  countdownInterval: null,
  secondsLeft: 10
};

export async function duplicateProduct(productId) {
  const prod = adminState.products.find(p => p.id === productId);
  if (!prod) return;

  const newId = 'stk-copy-' + Date.now().toString(36);
  const newSku = (prod.sku || 'SKU') + '-CP';
  const newProd = {
    ...prod,
    id: newId,
    sku: newSku,
    name: `${prod.name || prod.nameAr} (نسخة)`,
    nameAr: `${prod.nameAr || prod.name} (نسخة)`,
    nameEn: prod.nameEn ? `${prod.nameEn} (Copy)` : `${prod.name || prod.nameAr} (Copy)`,
    dateAdded: Date.now()
  };

  await storage.saveProduct(newProd);
  await loadData();
  showAdminToast(`تم نسخ المنتج بنجاح: ${newProd.nameAr}`);
}

const selectedProductIds = new Set();

export function toggleProductSelect(productId, checked) {
  if (checked) {
    selectedProductIds.add(productId);
  } else {
    selectedProductIds.delete(productId);
  }
  updateProductBulkBar();
}

export function toggleSelectAllProducts(checked) {
  const checkboxes = document.querySelectorAll('.product-select-chk');
  checkboxes.forEach(chk => {
    chk.checked = checked;
    const id = chk.getAttribute('data-product-id');
    if (id) {
      if (checked) selectedProductIds.add(id);
      else selectedProductIds.delete(id);
    }
  });
  updateProductBulkBar();
}

export function updateProductBulkBar() {
  const bar = document.getElementById('bulk-actions-bar');
  const countSpan = document.getElementById('product-bulk-selected-count') || document.getElementById('bulk-selected-count');
  const count = selectedProductIds.size;
  if (!bar) return;

  if (count > 0) {
    bar.classList.remove('hidden');
    if (countSpan) countSpan.textContent = `تم تحديد ${count}`;
  } else {
    bar.classList.add('hidden');
  }

  const catSelect = document.getElementById('bulk-category-select');
  if (catSelect && catSelect.children.length <= 1) {
    adminState.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nameAr;
      catSelect.appendChild(opt);
    });
  }
}

export async function applyBulkToggleActive() {
  if (selectedProductIds.size === 0) return;
  startProductUndo();

  for (const p of adminState.products) {
    if (selectedProductIds.has(p.id)) {
      p.inStock = p.inStock === false ? true : false;
      await storage.saveProduct(p);
    }
  }
  selectedProductIds.clear();
  updateProductBulkBar();
  await loadData();
  showBulkUndoToast('تم تحديث حالة التوفر للمنتجات المحددة');
}

export async function applyBulkPricePercent() {
  const input = document.getElementById('bulk-price-percent-input');
  const percent = parseFloat(input ? input.value : 0);
  if (!percent || isNaN(percent)) {
    showAdminToast('يرجى إدخال نسبة مئوية صالحة (مثال: 10 أو -10)', 'warning');
    return;
  }
  if (selectedProductIds.size === 0) return;

  startProductUndo();

  for (const p of adminState.products) {
    if (selectedProductIds.has(p.id)) {
      const current = p.price || 35;
      const factor = 1 + (percent / 100);
      p.price = Math.max(5, Math.round(current * factor));
      await storage.saveProduct(p);
    }
  }
  selectedProductIds.clear();
  updateProductBulkBar();
  await loadData();
  showBulkUndoToast(`تم تعديل أسعار المنتجات المحددة بنسبة ${percent}%`);
}

export async function applyBulkCategoryMove(catId) {
  if (!catId || selectedProductIds.size === 0) return;
  startProductUndo();

  for (const p of adminState.products) {
    if (selectedProductIds.has(p.id)) {
      p.category = catId;
      await storage.saveProduct(p);
    }
  }
  selectedProductIds.clear();
  updateProductBulkBar();
  await loadData();
  showBulkUndoToast('تم نقل المنتجات المحددة إلى القسم الجديد');
}

function startProductUndo() {
  productUndoState.previousProducts = JSON.parse(JSON.stringify(adminState.products));
}

function showBulkUndoToast(message) {
  dismissBulkUndoToast();
  productUndoState.active = true;
  productUndoState.secondsLeft = 10;

  const toast = document.getElementById('bulk-undo-toast');
  const text = document.getElementById('bulk-undo-text');
  const timer = document.getElementById('bulk-undo-timer');
  if (toast) {
    if (text) text.textContent = message;
    if (timer) timer.textContent = '10s';
    toast.classList.remove('hidden');

    productUndoState.countdownInterval = setInterval(() => {
      productUndoState.secondsLeft--;
      if (timer) timer.textContent = `${productUndoState.secondsLeft}s`;
      if (productUndoState.secondsLeft <= 0) {
        dismissBulkUndoToast();
      }
    }, 1000);
  }
}

export function dismissBulkUndoToast() {
  if (productUndoState.countdownInterval) {
    clearInterval(productUndoState.countdownInterval);
    productUndoState.countdownInterval = null;
  }
  productUndoState.active = false;
  const toast = document.getElementById('bulk-undo-toast');
  if (toast) toast.classList.add('hidden');
}

export async function handleBulkUndo() {
  if (!productUndoState.previousProducts) return;
  dismissBulkUndoToast();

  const prev = productUndoState.previousProducts;
  productUndoState.previousProducts = null;

  for (const p of prev) {
    await storage.saveProduct(p);
  }
  await loadData();
  showAdminToast('تم التراجع عن الإجراء الجماعي بنجاح');
}

// ==========================================
// A1: BACKUP REMINDER & DOWNLOAD
// ==========================================
export function checkBackupReminder() {
  const banner = document.getElementById('backup-reminder-banner');
  const textEl = document.getElementById('backup-reminder-text');
  if (!banner) return;

  const lastBackupStr = localStorage.getItem('stickify21_last_backup_date');
  if (!lastBackupStr) {
    if (textEl) textEl.textContent = 'تنبيه أمان البيانات: لم تقم بحفظ نسخة احتياطية من بيانات المتجر بعد (البيانات مخزنة في متصفحك ومعرضة للفقدان).';
    banner.classList.remove('hidden');
    return;
  }

  const lastBackupDate = new Date(lastBackupStr);
  const diffDays = Math.floor((Date.now() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays >= 3) {
    if (textEl) textEl.textContent = `تنبيه أمان البيانات: آخر نسخة احتياطية كانت منذ ${diffDays} أيام. اضغط هنا لتنزيل نسخة احتياطية فورية.`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

export async function downloadFullBackupNow() {
  try {
    const data = await storage.exportData();
    const jsonStr = JSON.stringify(data, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `stickify21-backup-${dateStr}.json`;

    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    localStorage.setItem('stickify21_last_backup_date', new Date().toISOString());
    const banner = document.getElementById('backup-reminder-banner');
    if (banner) banner.classList.add('hidden');
    showAdminToast('تم تنزيل النسخة الاحتياطية بنجاح!');
  } catch (err) {
    console.error('Backup download failed', err);
    showAdminToast('حدث خطأ أثناء تنزيل النسخة الاحتياطية', 'error');
  }
}

// ==========================================
// A8 & A9: DASHBOARD ANALYTICS & STOCK ALERTS
// ==========================================
export function renderDashboardAnalytics(dateRange = 'all') {
  const rangeSelect = document.getElementById('dashboard-date-range');
  if (rangeSelect && rangeSelect.value !== dateRange) {
    rangeSelect.value = dateRange;
  }

  let orders = adminState.orders || [];
  const now = Date.now();
  if (dateRange === 'today') {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    orders = orders.filter(o => new Date(o.createdAt || o.date || 0) >= startOfDay);
  } else if (dateRange === 'week') {
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    orders = orders.filter(o => new Date(o.createdAt || o.date || 0).getTime() >= weekAgo);
  } else if (dateRange === 'month') {
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    orders = orders.filter(o => new Date(o.createdAt || o.date || 0).getTime() >= monthAgo);
  }

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (parseInt(o.total, 10) || 0), 0);
  const pendingPayments = orders.filter(o => {
    const isOnline = o.paymentMethod === 'instapay' || o.paymentMethod === 'vodafone_cash' || (typeof o.payment === 'string' && (o.payment.includes('InstaPay') || o.payment.includes('فودافون')));
    return isOnline && !o.paymentVerified;
  }).length;

  const productSales = {};
  orders.forEach(o => {
    const lines = o.lines || [];
    lines.forEach(l => {
      if (l.type === 'pack' && Array.isArray(l.items)) {
        l.items.forEach(it => {
          const name = it.name || it.sku;
          productSales[name] = (productSales[name] || 0) + 1;
        });
      } else {
        const name = l.name || l.sku;
        productSales[name] = (productSales[name] || 0) + (l.quantity || 1);
      }
    });
  });

  const sortedSellers = Object.entries(productSales).sort((a, b) => b[1] - a[1]);
  const topSellersText = sortedSellers.length > 0 
    ? sortedSellers.slice(0, 3).map(([name, count]) => `${name} (${count})`).join('، ')
    : 'لا توجد مبيعات في هذه الفترة';

  const oEl = document.getElementById('metric-total-orders');
  const rEl = document.getElementById('metric-total-revenue');
  const pEl = document.getElementById('metric-pending-payments');
  const sEl = document.getElementById('metric-top-sellers');

  if (oEl) oEl.textContent = String(totalOrders);
  if (rEl) rEl.textContent = `${totalRevenue} ${CONFIG.CURRENCY}`;
  if (pEl) pEl.textContent = String(pendingPayments);
  if (sEl) sEl.textContent = topSellersText;
}

export function renderStockAlerts() {
  const container = document.getElementById('low-stock-items-list');
  const badge = document.getElementById('low-stock-count-badge');
  if (!container) return;

  const lowStockItems = adminState.products.filter(p => {
    const qty = p.stockQuantity !== undefined ? p.stockQuantity : (p.inStock === false ? 0 : 50);
    return qty <= 10 || p.inStock === false;
  });

  if (badge) badge.textContent = String(lowStockItems.length);

  if (lowStockItems.length === 0) {
    container.innerHTML = '<div class="text-zinc-400 py-2">جميع المنتجات متوفرة بمخزون كافٍ</div>';
    return;
  }

  container.innerHTML = lowStockItems.map(p => {
    const isOut = p.inStock === false || p.stockQuantity === 0;
    const qty = p.stockQuantity !== undefined ? p.stockQuantity : 0;
    return `
      <div class="flex items-center justify-between p-3 rounded-xl ${isOut ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}">
        <div class="flex items-center gap-3">
          <span class="font-bold text-zinc-900">${escapeHtml(p.nameAr || p.name)}</span>
          <span class="font-mono text-xs text-zinc-500">#${escapeHtml(p.sku)}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isOut ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}">
            ${isOut ? 'نفد من المخزون' : `متبقي ${qty} قطع فقط`}
          </span>
          <button onclick="toggleProductInStock('${p.id}')" class="text-xs font-bold text-zinc-700 hover:text-black underline">
            ${isOut ? 'تحديد كمتوفر' : 'تحديد كنفد'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// A13: STORAGE METER
// ==========================================
export async function renderStorageUsageMeter() {
  const usage = await storage.getStorageUsage();
  const textEl = document.getElementById('storage-meter-text');
  const barEl = document.getElementById('storage-meter-bar');
  if (textEl) {
    textEl.textContent = `${usage.totalKb} KB / 5 MB (${usage.percent}%)`;
  }
  if (barEl) {
    barEl.style.width = `${usage.percent}%`;
    if (usage.percent > 80) barEl.className = 'h-full bg-red-500 rounded-full transition-all duration-500';
    else if (usage.percent > 50) barEl.className = 'h-full bg-amber-500 rounded-full transition-all duration-500';
    else barEl.className = 'h-full bg-[#FF5000] rounded-full transition-all duration-500';
  }
}

// ==========================================
// A15: PRODUCTION AGGREGATE SUMMARY
// ==========================================
export function openProductionSummaryModal() {
  const modal = document.getElementById('production-summary-modal');
  const content = document.getElementById('production-summary-content');
  if (!modal || !content) return;

  const activeOrders = adminState.orders.filter(o => {
    const s = normalizeStatusKey(o.status);
    return s === 'confirmed' || s === 'preparing' || s === 'pending';
  });

  const aggregate = {};

  activeOrders.forEach(o => {
    const lines = o.lines || [];
    lines.forEach(line => {
      if (line.type === 'pack' && Array.isArray(line.items)) {
        line.items.forEach(it => {
          const sku = it.sku || it.id || 'ITEM';
          if (!aggregate[sku]) {
            aggregate[sku] = {
              sku,
              name: it.name || it.nameAr || sku,
              image: it.image,
              sizes: { '6cm': 0, '8cm': 0, '10cm': 0, 'standard': 0 },
              total: 0
            };
          }
          const sz = it.sizeKey === 'small' ? '6cm' : (it.sizeKey === 'large' ? '10cm' : (it.sizeKey === 'standard' ? 'standard' : '8cm'));
          aggregate[sku].sizes[sz] = (aggregate[sku].sizes[sz] || 0) + 1;
          aggregate[sku].total += 1;
        });
      } else {
        const sku = line.sku || line.id || 'ITEM';
        if (!aggregate[sku]) {
          aggregate[sku] = {
            sku,
            name: line.name || line.nameAr || sku,
            image: line.image,
            sizes: { '6cm': 0, '8cm': 0, '10cm': 0, 'standard': 0 },
            total: 0
          };
        }
        const sz = line.sizeKey === 'small' ? '6cm' : (line.sizeKey === 'large' ? '10cm' : (line.sizeKey === 'standard' ? 'standard' : '8cm'));
        const qty = line.quantity || 1;
        aggregate[sku].sizes[sz] = (aggregate[sku].sizes[sz] || 0) + qty;
        aggregate[sku].total += qty;
      }
    });
  });

  const items = Object.values(aggregate);
  const totalStickersToPrint = items.reduce((sum, it) => sum + it.total, 0);

  if (items.length === 0) {
    content.innerHTML = `
      <div class="text-center py-8 text-zinc-400">
        <p class="font-bold">لا توجد طلبات جارية بحاجة لتشغيل إنتاج حالياً.</p>
        <p class="text-[11px] mt-1">يتم التجميع تلقائياً من الطلبات المؤكدة وقيد التجهيز.</p>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="flex items-center justify-between bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
        <span class="font-bold text-zinc-700">إجمالي القطع المطلوبة للطباعة:</span>
        <span class="font-mono text-base font-black text-[#FF5000]">${totalStickersToPrint} قطعة</span>
      </div>

      <div class="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
        <div class="bg-zinc-50 p-2.5 grid grid-cols-12 font-bold text-zinc-500 text-[11px]">
          <span class="col-span-5">التصميم / SKU</span>
          <span class="col-span-2 text-center">6 سم</span>
          <span class="col-span-2 text-center">8 سم</span>
          <span class="col-span-2 text-center">10 سم</span>
          <span class="col-span-1 text-center">الإجمالي</span>
        </div>
        ${items.map(it => `
          <div class="p-3 grid grid-cols-12 items-center hover:bg-zinc-50 transition">
            <div class="col-span-5 flex items-center gap-2">
              <span class="font-mono text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">#${escapeHtml(it.sku)}</span>
              <span class="font-bold text-zinc-900 truncate">${escapeHtml(it.name)}</span>
            </div>
            <div class="col-span-2 text-center font-mono font-bold ${it.sizes['6cm'] > 0 ? 'text-[#FF5000]' : 'text-zinc-300'}">${it.sizes['6cm']}</div>
            <div class="col-span-2 text-center font-mono font-bold ${it.sizes['8cm'] > 0 ? 'text-[#FF5000]' : 'text-zinc-300'}">${it.sizes['8cm']}</div>
            <div class="col-span-2 text-center font-mono font-bold ${it.sizes['10cm'] > 0 ? 'text-[#FF5000]' : 'text-zinc-300'}">${it.sizes['10cm']}</div>
            <div class="col-span-1 text-center font-mono font-black text-zinc-900">${it.total}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  modal.classList.remove('hidden');
}

export function closeProductionSummaryModal() {
  const modal = document.getElementById('production-summary-modal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================
// A17: ADMIN THEME TOGGLE
// ==========================================
export function toggleAdminTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('stickify21_admin_theme', isDark ? 'dark' : 'light');
  showAdminToast(isDark ? 'تم تفعيل الوضع الليلي' : 'تم تفعيل الوضع النهاري');
}

export function initAdminTheme() {
  const saved = localStorage.getItem('stickify21_admin_theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  }
}

export async function toggleProductInStock(productId) {
  const prod = adminState.products.find(p => p.id === productId);
  if (!prod) return;
  prod.inStock = prod.inStock === false ? true : false;
  await storage.saveProduct(prod);
  renderProducts();
  showAdminToast(`تم تحديث توفر [${prod.sku}] إلى: ${prod.inStock ? 'متوفر' : 'غير متوفر'}`);
}

export async function quickUpdatePrice(index, newPrice) {
  const priceNum = parseInt(newPrice, 10);
  if (!priceNum || priceNum < 1) return;
  const prod = adminState.products[index];
  if (!prod) return;
  prod.price = priceNum;
  await storage.saveProduct(prod);
  showAdminToast(`تم تحديث سعر [${prod.sku}] إلى ${priceNum} ${CONFIG.CURRENCY}`);
}

async function commitProductPngFile(file) {
  showAdminToast('جارٍ حفظ الصورة بصيغة PNG بدون فقدان مع الحفاظ على الشفافية...', 'warning');
  const asset = await storage.uploadProductPng(file);
  const input = document.getElementById('prod-image');
  if (input) input.value = asset.dataUrl;
  updateProductPreview();
  showAdminToast(`تم حفظ الصورة بصيغة PNG (${asset.width}×${asset.height}px) بنجاح!`);
}

export async function confirmOpaqueProductPng() {
  const warnEl = document.getElementById('prod-alpha-warning');
  if (warnEl) warnEl.classList.add('hidden');
  if (!pendingOpaquePngFile) return;
  const f = pendingOpaquePngFile;
  pendingOpaquePngFile = null;
  try {
    await commitProductPngFile(f);
  } catch (err) {
    showAdminToast('تعذر حفظ الصورة بصيغة PNG.', 'error');
  }
}

export function cancelOpaqueProductPng() {
  pendingOpaquePngFile = null;
  const warnEl = document.getElementById('prod-alpha-warning');
  if (warnEl) warnEl.classList.add('hidden');
  const fileInput = document.getElementById('prod-file-input');
  if (fileInput) fileInput.value = '';
}

export async function handleProductFileUpload(e) {
  const file = e.target.files?.[0];
  const errEl = document.getElementById('prod-file-error');
  const warnEl = document.getElementById('prod-alpha-warning');
  pendingOpaquePngFile = null;

  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }
  if (warnEl) warnEl.classList.add('hidden');
  if (!file) return;

  // R14: Strict PNG-only validation via magic bytes
  const check = await validateFile(file, UPLOAD_POLICIES.productPng, 'ar');
  if (!check.valid) {
    const msg = check.reason || 'ارفع الصورة بصيغة PNG بخلفية شفافة';
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    }
    showAdminToast(msg, 'error');
    e.target.value = '';
    return;
  }

  // R14: Alpha channel transparency check
  try {
    const alphaInfo = await detectPngAlpha(file);
    if (!alphaInfo.hasAlpha) {
      pendingOpaquePngFile = file;
      if (warnEl) warnEl.classList.remove('hidden');
      showAdminToast('تنبيه: الصورة لا تحتوي على خلفية شفافة (PNG مصمتة).', 'warning');
      return;
    }
    await commitProductPngFile(file);
  } catch (err) {
    const msg = 'ارفع الصورة بصيغة PNG بخلفية شفافة';
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    }
    showAdminToast(msg, 'error');
    e.target.value = '';
  }
}

export function updateProductPreview() {
  const previewBox = document.getElementById('prod-preview-box');
  const imgVal = document.getElementById('prod-image')?.value.trim();
  const svgVal = document.getElementById('prod-svg-input')?.value.trim();
  const editId = document.getElementById('prod-edit-id')?.value;
  if (!previewBox) return;

  const safeUrl = sanitizeUrl(imgVal);
  if (safeUrl) {
    previewBox.innerHTML = `<img src="${safeUrl}" class="w-full h-full object-contain" alt="معاينة">`;
  } else if (svgVal) {
    previewBox.innerHTML = sanitizeSvg(svgVal);
  } else if (editId !== '' && adminState.products[parseInt(editId, 10)]?.svg) {
    previewBox.innerHTML = sanitizeSvg(adminState.products[parseInt(editId, 10)].svg);
  } else {
    previewBox.innerHTML = `<span class="text-zinc-300 text-xs font-mono">معاينة</span>`;
  }
}

export function suggestSkuForCurrentCategory() {
  const cat = document.getElementById('prod-category')?.value || 'tech';
  const type = document.getElementById('prod-type')?.value || 'sticker';
  
  let prefix = 'STK';
  if (type === 'bookmark') {
    prefix = 'BM';
  } else if (cat === 'tech' || cat === 'coding') {
    prefix = 'DEV';
  } else if (cat === 'anime') {
    prefix = 'ANM';
  } else if (cat === 'quotes') {
    prefix = 'QT';
  } else if (cat === 'vintage' || cat === 'retro') {
    prefix = 'VNT';
  } else {
    prefix = cat.slice(0, 3).toUpperCase();
  }

  const existingSkus = adminState.products.map(p => p.sku || '');
  let counter = 1;
  let candidate = `${prefix}-01`;
  while (existingSkus.includes(candidate) && counter < 99) {
    counter++;
    candidate = `${prefix}-${counter < 10 ? '0' + counter : counter}`;
  }
  
  const skuInput = document.getElementById('prod-sku');
  if (skuInput) skuInput.value = candidate;
}

export function handleProductTypeChange(type) {
  const catSelect = document.getElementById('prod-category');
  if (type === 'bookmark' && catSelect) {
    catSelect.value = 'bookmarks';
  }
  suggestSkuForCurrentCategory();
}

export function openProductModal(index = null) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('product-modal-title');
  const submitText = document.getElementById('prod-submit-btn-text');
  const catSelect = document.getElementById('prod-category');
  const form = modal.querySelector('form');
  form.reset();

  catSelect.innerHTML = adminState.categories.map(c => `
    <option value="${escapeHtml(c.id)}">${escapeHtml(c.nameAr)}</option>
  `).join('');

  if (index !== null) {
    const p = adminState.products[index];
    title.innerText = `تعديل الاستيكر: ${p.nameAr} (#${p.sku})`;
    if (submitText) submitText.innerText = 'حفظ تعديلات الاستيكر';
    document.getElementById('prod-edit-id').value = index;
    document.getElementById('prod-sku').value = p.sku || '';
    document.getElementById('prod-type').value = p.type || (p.category === 'bookmarks' ? 'bookmark' : 'sticker');
    document.getElementById('prod-name-ar').value = p.nameAr || '';
    document.getElementById('prod-name-en').value = p.nameEn || p.name || '';
    if (document.getElementById('prod-badge-en')) document.getElementById('prod-badge-en').value = p.badgeEn || '';
    if (document.getElementById('prod-desc-en')) document.getElementById('prod-desc-en').value = p.descEn || '';
    document.getElementById('prod-price').value = p.price || 35;
    catSelect.value = p.category || 'tech';
    document.getElementById('prod-finish').value = p.finish || 'glossy';
    document.getElementById('prod-badge').value = p.badge || '';
    document.getElementById('prod-image').value = p.image || '';
    document.getElementById('prod-svg-input').value = p.svg || '';
    document.getElementById('prod-desc').value = p.desc || '';
    document.getElementById('prod-stock-quantity').value = p.stockQuantity !== undefined ? p.stockQuantity : 50;
    document.getElementById('prod-in-stock').checked = p.inStock !== false;
  } else {
    title.innerText = 'إضافة استيكر أو بوك مارك جديد';
    if (submitText) submitText.innerText = '+ حفظ المنتج في الكتالوج';
    document.getElementById('prod-edit-id').value = '';
    document.getElementById('prod-image').value = '';
    document.getElementById('prod-svg-input').value = '';
    document.getElementById('prod-stock-quantity').value = 50;
    document.getElementById('prod-in-stock').checked = true;
    suggestSkuForCurrentCategory();
  }

  updateProductPreview();
  modal.classList.remove('hidden');
}

export function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
}

export async function handleSaveProduct(e) {
  e.preventDefault();

  const editIndexStr = document.getElementById('prod-edit-id').value;
  const sku = document.getElementById('prod-sku').value.trim().toUpperCase();
  const type = document.getElementById('prod-type').value;
  const nameAr = stripEmoji(document.getElementById('prod-name-ar').value.trim());
  const nameEn = stripEmoji(document.getElementById('prod-name-en').value.trim()) || nameAr;
  const price = parseInt(document.getElementById('prod-price').value, 10) || 35;
  const category = document.getElementById('prod-category').value;
  const finish = document.getElementById('prod-finish').value;
  const badgeAr = stripEmoji(document.getElementById('prod-badge').value.trim()) || (type === 'bookmark' ? 'بوك مارك' : 'استيكر');
  const badgeEn = stripEmoji(document.getElementById('prod-badge-en')?.value?.trim() || '') || (type === 'bookmark' ? 'Bookmark' : 'Sticker');
  const image = document.getElementById('prod-image').value.trim();
  const svgInput = document.getElementById('prod-svg-input').value.trim();
  const descAr = stripEmoji(document.getElementById('prod-desc').value.trim()) || 'استيكر عالي الجودة ومقاوم لعوامل الجو من STICKIFY 21.';
  const descEn = stripEmoji(document.getElementById('prod-desc-en')?.value?.trim() || '') || 'High-quality waterproof vinyl sticker from STICKIFY 21.';
  const stockQty = parseInt(document.getElementById('prod-stock-quantity').value, 10) || 50;
  const inStock = document.getElementById('prod-in-stock').checked;

  const productObj = {
    id: editIndexStr !== '' ? adminState.products[parseInt(editIndexStr, 10)].id : ('stk-' + Date.now()),
    sku: sku,
    name: nameEn,
    nameAr: nameAr,
    category: category,
    subCategory: category + '-sub',
    type: type,
    price: price,
    finish: finish,
    badge: badgeAr,
    badgeAr: badgeAr,
    badgeEn: badgeEn,
    desc: descAr,
    descAr: descAr,
    descEn: descEn,
    inStock: inStock,
    stockQuantity: stockQty,
    image: sanitizeUrl(image) || null,
    svg: svgInput ? sanitizeSvg(svgInput) : (!image ? `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="15" y="15" width="130" height="130" rx="26" fill="#0E0E10" stroke="#FF5000" stroke-width="4"/><text x="80" y="90" font-family="'Space Grotesk'" font-weight="800" font-size="20" fill="#FF5000" text-anchor="middle">${escapeHtml(sku)}</text></svg>` : null),
    dateAdded: Date.now()
  };

  await storage.saveProduct(productObj);
  showAdminToast(`تم حفظ المنتج [${sku}] بنجاح!`);

  await loadData();
  closeProductModal();
}

export async function deleteProduct(index) {
  const p = adminState.products[index];
  if (!confirm(`هل أنت متأكد من حذف المنتج [${p.sku}] "${p.nameAr}"؟`)) return;
  await storage.deleteProduct(p.id);
  await loadData();
  showAdminToast(`تم حذف المنتج [${p.sku}]`);
}

// ==========================================
// COUPONS CONTROLLER
// ==========================================
export function toggleCouponValueLabel(type) {
  const lbl = document.getElementById('coupon-value-label');
  if (lbl) {
    lbl.innerText = type === 'fixed' ? 'قيمة الخصم (ج.م) *' : 'نسبة الخصم (%) *';
  }
}

export function renderCoupons() {
  const container = document.getElementById('coupons-list-container');
  if (!container) return;

  if (adminState.coupons.length === 0) {
    container.innerHTML = `
      <div class="text-xs text-zinc-400 py-8 text-center bg-zinc-50 rounded-2xl border border-zinc-200">لا توجد أكواد خصم مسجلة</div>
    `;
    return;
  }

  container.innerHTML = adminState.coupons.map((c, index) => {
    const isFixed = c.type === 'fixed' || Boolean(c.discountFixed);
    const val = c.discountPercent || c.discountFixed || c.value || 10;
    const active = c.active !== false;

    return `
      <div class="p-3.5 rounded-2xl bg-zinc-50 hover:bg-white border border-zinc-200 shadow-sm flex items-center justify-between gap-3 flex-wrap ${!active ? 'opacity-60' : ''}">
        <div class="flex items-center gap-3">
          <span class="font-mono font-black text-sm bg-zinc-200 px-2.5 py-1 rounded text-zinc-900">${escapeHtml(c.code)}</span>
          <div class="text-xs">
            <span class="font-bold text-emerald-600">${isFixed ? `${val} ج.م خصم ثابت` : `خصم ${val}%`}</span>
            ${c.minSubtotal || c.minOrder ? `<span class="text-[11px] text-zinc-500 font-mono block">حد أدنى: ${c.minSubtotal || c.minOrder} ج.م</span>` : ''}
            ${c.expiresAt ? `<span class="text-[10px] text-zinc-400 font-mono block">ينتهي: ${escapeHtml(c.expiresAt)}</span>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="toggleCouponActive(${index})" class="px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-zinc-200 text-zinc-600 border-zinc-300'}">
            ${active ? 'نشط' : 'معطل'}
          </button>
          <button onclick="deleteCoupon(${index})" class="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="حذف الكود">
            <svg class="w-4 h-4 text-zinc-400 hover:text-red-500 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export async function toggleCouponActive(index) {
  const c = adminState.coupons[index];
  if (!c) return;
  c.active = c.active === false ? true : false;
  await storage.saveCoupon(c);
  renderCoupons();
  showAdminToast(`تم ${c.active ? 'تفعيل' : 'تعطيل'} كود الخصم "${c.code}"`);
}

export async function handleCreateCoupon(e) {
  e.preventDefault();
  const code = document.getElementById('coupon-code-input').value.trim().toUpperCase();
  const type = document.getElementById('coupon-type-input').value;
  const val = parseInt(document.getElementById('coupon-percent-input').value, 10);
  const minSubtotal = parseInt(document.getElementById('coupon-min-order-input').value, 10) || 0;
  const maxDiscount = parseInt(document.getElementById('coupon-max-discount-input').value, 10) || null;
  const maxUses = parseInt(document.getElementById('coupon-max-uses-input').value, 10) || 100;
  const expiresAt = document.getElementById('coupon-expires-input').value || null;

  if (!code || isNaN(val)) return;

  const exists = adminState.coupons.find(c => c.code.toUpperCase() === code);
  if (exists) {
    showAdminToast('هذا الكود موجود بالفعل!', 'error');
    return;
  }

  const newCoupon = {
    code: code,
    type: type,
    discountPercent: type === 'percentage' ? val : null,
    discountFixed: type === 'fixed' ? val : null,
    value: val,
    minSubtotal: minSubtotal,
    minOrder: minSubtotal,
    maxDiscount: maxDiscount,
    maxUses: maxUses,
    usageLimit: maxUses,
    usageCount: 0,
    expiresAt: expiresAt,
    active: true,
    desc: type === 'fixed' ? `خصم ثابت ${val} ج.م` : `خصم ${val}%`
  };

  await storage.saveCoupon(newCoupon);
  
  document.getElementById('coupon-code-input').value = '';
  document.getElementById('coupon-percent-input').value = '';

  await loadData();
  showAdminToast(`تم تفعيل كود الخصم "${code}" بنجاح!`);
}

export async function deleteCoupon(index) {
  const c = adminState.coupons[index];
  if (!confirm(`هل أنت متأكد من حذف كود الخصم "${c.code}"؟`)) return;
  const filtered = adminState.coupons.filter((_, i) => i !== index);
  try {
    localStorage.setItem('stickify21_coupons', JSON.stringify(filtered));
  } catch(err) {}
  await loadData();
  showAdminToast(`تم حذف كود الخصم "${c.code}"`);
}

// ==========================================
// SHOWCASE CONTROLLER (R8)
// ==========================================
export function renderAdminShowcase() {
  const container = document.getElementById('showcase-admin-list');
  if (!container) return;

  const items = adminState.showcase || [];
  if (items.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-zinc-400">
        <p class="text-xs font-semibold">لا توجد صور في معرض الواقع حالياً. اضغط على "إضافة صورة للمعرض" لإضافة أول صورة.</p>
      </div>
    `;
    return;
  }

  const deviceTagMap = {
    laptop: 'لابتوب',
    bottle: 'زجاجة مياه',
    book: 'كتاب / رواية',
    notebook: 'كشكول ملاحظات',
    phone: 'موبايل',
    other: 'أخرى'
  };

  container.innerHTML = items.map((item, index) => {
    const isSvgData = item.image && item.image.startsWith('data:image/svg+xml');
    const tagName = deviceTagMap[item.deviceTag] || item.deviceTag || 'أخرى';
    const isActive = item.active !== false;

    return `
      <div class="showcase-admin-row p-4 flex items-center justify-between gap-4 flex-wrap hover:bg-zinc-50/80 transition" data-id="${escapeHtml(item.id)}">
        <div class="flex items-center gap-3.5 min-w-[260px]">
          <div class="w-16 h-12 rounded-xl bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
            ${isSvgData
              ? `<img src="${item.image}" alt="" class="w-full h-full object-cover">`
              : `<img src="${escapeHtml(item.image)}" alt="" class="w-full h-full object-cover">`
            }
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-zinc-900">${escapeHtml(item.captionAr || 'بدون وصف عربي')}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'}">
                ${isActive ? 'معروض' : 'معطل'}
              </span>
            </div>
            <div class="flex items-center gap-2 mt-1 text-[11px] text-zinc-400 font-mono">
              <span class="text-zinc-500">${escapeHtml(item.captionEn || '')}</span>
              <span>•</span>
              <span class="bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold">${escapeHtml(tagName)}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Reorder buttons -->
          <button onclick="moveShowcaseItem('${escapeHtml(item.id)}', -1)" class="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition" title="تحريك لأعلى" ${index === 0 ? 'disabled opacity-30' : ''}>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>
          </button>
          <button onclick="moveShowcaseItem('${escapeHtml(item.id)}', 1)" class="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition" title="تحريك لأسفل" ${index === items.length - 1 ? 'disabled opacity-30' : ''}>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
          </button>

          <!-- Toggle active -->
          <button onclick="toggleShowcaseActive('${escapeHtml(item.id)}')" class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${isActive ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}">
            ${isActive ? 'تعطيل' : 'تفعيل'}
          </button>

          <!-- Edit button -->
          <button onclick="openEditShowcaseModal('${escapeHtml(item.id)}')" class="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition">
            تعديل
          </button>

          <!-- Delete button -->
          <button onclick="deleteShowcaseItem('${escapeHtml(item.id)}')" class="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition" title="حذف الصورة">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function openAddShowcaseModal() {
  const modal = document.getElementById('showcase-item-modal');
  if (!modal) return;

  document.getElementById('showcase-modal-title').textContent = 'إضافة صورة لمعرض الواقع';
  document.getElementById('showcase-item-id').value = '';
  document.getElementById('showcase-caption-ar').value = '';
  document.getElementById('showcase-caption-en').value = '';
  document.getElementById('showcase-device-tag').value = 'laptop';
  document.getElementById('showcase-image-data').value = '';

  const previewBox = document.getElementById('showcase-preview-box');
  if (previewBox) previewBox.innerHTML = '<span class="text-xs text-zinc-400">معاينة الصورة</span>';

  // Populate products dropdown
  const prodSelect = document.getElementById('showcase-product-id');
  if (prodSelect) {
    prodSelect.innerHTML = '<option value="">-- بدون ربط --</option>' + (adminState.products || []).map(p => 
      `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nameAr || p.name)} (${escapeHtml(p.sku)})</option>`
    ).join('');
  }

  setupShowcaseFileInput();
  modal.classList.remove('hidden');
}

export function openEditShowcaseModal(id) {
  const item = (adminState.showcase || []).find(x => x.id === id);
  if (!item) return;

  const modal = document.getElementById('showcase-item-modal');
  if (!modal) return;

  document.getElementById('showcase-modal-title').textContent = 'تعديل صورة معرض الواقع';
  document.getElementById('showcase-item-id').value = item.id;
  document.getElementById('showcase-caption-ar').value = item.captionAr || '';
  document.getElementById('showcase-caption-en').value = item.captionEn || '';
  document.getElementById('showcase-device-tag').value = item.deviceTag || 'laptop';
  document.getElementById('showcase-image-data').value = item.image || '';

  const previewBox = document.getElementById('showcase-preview-box');
  if (previewBox && item.image) {
    previewBox.innerHTML = `<img src="${item.image}" alt="" class="w-full h-full object-cover">`;
  }

  // Populate products dropdown
  const prodSelect = document.getElementById('showcase-product-id');
  if (prodSelect) {
    prodSelect.innerHTML = '<option value="">-- بدون ربط --</option>' + (adminState.products || []).map(p => 
      `<option value="${escapeHtml(p.id)}" ${p.id === item.productId ? 'selected' : ''}>${escapeHtml(p.nameAr || p.name)} (${escapeHtml(p.sku)})</option>`
    ).join('');
  }

  setupShowcaseFileInput();
  modal.classList.remove('hidden');
}

export function closeShowcaseModal() {
  const modal = document.getElementById('showcase-item-modal');
  if (modal) modal.classList.add('hidden');
}

function setupShowcaseFileInput() {
  const fileInput = document.getElementById('showcase-file-input');
  if (!fileInput || fileInput.dataset.listenerAttached) return;
  fileInput.dataset.listenerAttached = 'true';

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = await validateFile(file, UPLOAD_POLICIES.showcasePhoto, 'ar');
    if (!check.valid) {
      showAdminToast(check.reason, 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1400;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/webp', 0.85);
        document.getElementById('showcase-image-data').value = compressedDataUrl;
        const previewBox = document.getElementById('showcase-preview-box');
        if (previewBox) {
          previewBox.innerHTML = `<img src="${compressedDataUrl}" alt="" class="w-full h-full object-cover">`;
        }
      };
      img.src = loadEvt.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function saveShowcaseItemFromForm() {
  const id = document.getElementById('showcase-item-id')?.value;
  const captionAr = stripEmoji(document.getElementById('showcase-caption-ar')?.value?.trim() || '');
  const captionEn = stripEmoji(document.getElementById('showcase-caption-en')?.value?.trim() || '');
  const deviceTag = document.getElementById('showcase-device-tag')?.value || 'other';
  const productId = document.getElementById('showcase-product-id')?.value || '';
  const imageData = document.getElementById('showcase-image-data')?.value;

  if (!captionAr && !captionEn) {
    showAdminToast('يرجى إدخال وصف للصورة', 'error');
    return;
  }

  const existing = id ? (adminState.showcase || []).find(x => x.id === id) : null;
  const finalImage = imageData || (existing ? existing.image : '');

  if (!finalImage) {
    showAdminToast('يرجى اختيار أو رفع صورة للمعرض', 'error');
    return;
  }

  const itemObj = {
    id: id || ('sc-' + Date.now()),
    image: finalImage,
    captionAr: captionAr || captionEn,
    captionEn: captionEn || captionAr,
    deviceTag,
    productId,
    active: existing ? existing.active : true,
    order: existing ? existing.order : (adminState.showcase.length + 1)
  };

  await storage.saveShowcaseItem(itemObj);
  adminState.showcase = await storage.getShowcase();
  renderAdminShowcase();
  updateBadges();
  closeShowcaseModal();
  showAdminToast('تم حفظ صورة المعرض بنجاح');
}

export async function toggleShowcaseActive(id) {
  const item = (adminState.showcase || []).find(x => x.id === id);
  if (!item) return;
  item.active = !item.active;
  await storage.saveShowcase(adminState.showcase);
  renderAdminShowcase();
  showAdminToast(`تم ${item.active ? 'تفعيل' : 'تعطيل'} ظهور الصورة في المعرض`);
}

export async function moveShowcaseItem(id, direction) {
  const items = [...adminState.showcase];
  const idx = items.findIndex(x => x.id === id);
  if (idx === -1) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= items.length) return;

  const temp = items[idx];
  items[idx] = items[targetIdx];
  items[targetIdx] = temp;

  items.forEach((it, i) => { it.order = i + 1; });
  adminState.showcase = items;
  await storage.saveShowcase(items);
  renderAdminShowcase();
}

export async function deleteShowcaseItem(id) {
  if (!confirm('هل أنت متأكد من حذف هذه الصورة من المعرض؟')) return;
  await storage.deleteShowcaseItem(id);
  adminState.showcase = await storage.getShowcase();
  renderAdminShowcase();
  updateBadges();
  showAdminToast('تم حذف الصورة من المعرض');
}

// ==========================================
// SETTINGS & BACKUP CONTROLLER
// ==========================================
export async function renderSettings() {
  const settings = adminState.settings || await storage.getSettings();
  adminState.settings = settings;

  const waInput = document.getElementById('setting-whatsapp-number');
  const threshInput = document.getElementById('setting-free-shipping-threshold');
  const defShipInput = document.getElementById('setting-default-shipping');

  if (waInput) waInput.value = settings.whatsappNumber || CONFIG.WHATSAPP_NUMBER;
  if (threshInput) threshInput.value = settings.freeShippingThreshold !== undefined ? settings.freeShippingThreshold : CONFIG.FREE_SHIPPING_THRESHOLD;
  if (defShipInput) defShipInput.value = settings.defaultShipping !== undefined ? settings.defaultShipping : CONFIG.DEFAULT_SHIPPING;

  // Render 27 Governorates Grid
  const grid = document.getElementById('gov-rates-grid');
  if (grid) {
    const currentRates = settings.shippingRates || CONFIG.SHIPPING_RATES;
    const govs = settings.governorates || CONFIG.GOVERNORATES;

    grid.innerHTML = govs.map((gov, idx) => {
      const rate = currentRates[gov.nameAr] !== undefined ? currentRates[gov.nameAr] : gov.rate;
      return `
        <div class="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 flex items-center justify-between gap-2">
          <span class="font-bold text-xs text-zinc-800 truncate">${escapeHtml(gov.nameAr)}</span>
          <div class="flex items-center gap-1 flex-shrink-0">
            <input type="number" id="gov-rate-${idx}" data-gov-name="${escapeHtml(gov.nameAr)}" value="${rate}" min="0" class="w-16 text-center font-mono font-bold text-xs bg-white border border-zinc-200 rounded-lg px-1.5 py-1 text-zinc-900 focus:outline-none focus:border-[#FF5000]">
            <span class="text-[10px] text-zinc-400 font-bold">${CONFIG.CURRENCY}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Populate Custom Print Upload Settings (R14)
  const cu = settings.customUpload || DEFAULT_CUSTOM_UPLOAD_POLICY;
  const maxMbEl = document.getElementById('setting-custom-max-mb');
  const maxFilesEl = document.getElementById('setting-custom-max-files');
  const extsEl = document.getElementById('setting-custom-exts');
  if (maxMbEl) maxMbEl.value = cu.maxFileSizeMb || DEFAULT_CUSTOM_UPLOAD_POLICY.maxFileSizeMb;
  if (maxFilesEl) maxFilesEl.value = cu.maxFiles || DEFAULT_CUSTOM_UPLOAD_POLICY.maxFiles;
  if (extsEl) extsEl.value = (cu.allowedExtensions || DEFAULT_CUSTOM_UPLOAD_POLICY.allowedExtensions).join(',');

  // Populate Payment Accounts (R12)
  const payAccounts = settings.paymentAccounts || CONFIG.PAYMENT_ACCOUNTS || [];
  const instapayAcc = payAccounts.find(a => a.type === 'instapay');
  if (instapayAcc) {
    const activeEl = document.getElementById('pay-acc-instapay-active');
    const handleEl = document.getElementById('pay-acc-instapay-handle');
    const holderEl = document.getElementById('pay-acc-instapay-holder');
    if (activeEl) activeEl.checked = Boolean(instapayAcc.active);
    if (handleEl) handleEl.value = instapayAcc.handle || '';
    if (holderEl) holderEl.value = instapayAcc.holder || '';
  }

  const vodafoneAcc = payAccounts.find(a => a.type === 'vodafone_cash');
  if (vodafoneAcc) {
    const activeEl = document.getElementById('pay-acc-vodafone-active');
    const numberEl = document.getElementById('pay-acc-vodafone-number');
    const holderEl = document.getElementById('pay-acc-vodafone-holder');
    if (activeEl) activeEl.checked = Boolean(vodafoneAcc.active);
    if (numberEl) numberEl.value = vodafoneAcc.number || '';
    if (holderEl) holderEl.value = vodafoneAcc.holder || '';
  }

  const bankAcc = payAccounts.find(a => a.type === 'bank');
  if (bankAcc) {
    const activeEl = document.getElementById('pay-acc-bank-active');
    const ibanEl = document.getElementById('pay-acc-bank-iban');
    const holderEl = document.getElementById('pay-acc-bank-holder');
    if (activeEl) activeEl.checked = Boolean(bankAcc.active);
    if (ibanEl) ibanEl.value = bankAcc.iban || '';
    if (holderEl) holderEl.value = bankAcc.holder || '';
  }

  // Populate WhatsApp Templates (A7)
  const templates = settings.whatsappTemplates || CONFIG.WHATSAPP_TEMPLATES || {};
  const readyTpl = document.getElementById('wa-template-ready');
  const shippedTpl = document.getElementById('wa-template-shipped');
  if (readyTpl) readyTpl.value = templates.ready || CONFIG.WHATSAPP_TEMPLATES.ready;
  if (shippedTpl) shippedTpl.value = templates.shipped || CONFIG.WHATSAPP_TEMPLATES.shipped;

  // Populate Policies & FAQ (A11)
  const policies = settings.policies || DEFAULT_POLICIES;
  const shipAr = document.getElementById('policy-edit-shipping-ar');
  const shipEn = document.getElementById('policy-edit-shipping-en');
  const retAr = document.getElementById('policy-edit-returns-ar');
  const retEn = document.getElementById('policy-edit-returns-en');
  const specAr = document.getElementById('policy-edit-specs-ar');
  const specEn = document.getElementById('policy-edit-specs-en');
  const privAr = document.getElementById('policy-edit-privacy-ar');
  const privEn = document.getElementById('policy-edit-privacy-en');

  if (shipAr) shipAr.value = policies.shipping?.contentAr || '';
  if (shipEn) shipEn.value = policies.shipping?.contentEn || '';
  if (retAr) retAr.value = policies.returns?.contentAr || '';
  if (retEn) retEn.value = policies.returns?.contentEn || '';
  if (specAr) specAr.value = policies.about?.contentAr || '';
  if (specEn) specEn.value = policies.about?.contentEn || '';
  if (privAr) privAr.value = policies.privacy?.contentAr || '';
  if (privEn) privEn.value = policies.privacy?.contentEn || '';
}

export async function savePoliciesSettings() {
  const current = adminState.settings || await storage.getSettings();
  const currentPolicies = current.policies || DEFAULT_POLICIES;
  const updatedPolicies = {
    ...currentPolicies,
    shipping: {
      titleAr: currentPolicies.shipping?.titleAr || 'الشحن والتوصيل',
      titleEn: currentPolicies.shipping?.titleEn || 'Shipping & Delivery',
      contentAr: stripEmoji(document.getElementById('policy-edit-shipping-ar')?.value || ''),
      contentEn: stripEmoji(document.getElementById('policy-edit-shipping-en')?.value || '')
    },
    returns: {
      titleAr: currentPolicies.returns?.titleAr || 'الاستبدال والاسترجاع',
      titleEn: currentPolicies.returns?.titleEn || 'Returns & Exchanges',
      contentAr: stripEmoji(document.getElementById('policy-edit-returns-ar')?.value || ''),
      contentEn: stripEmoji(document.getElementById('policy-edit-returns-en')?.value || '')
    },
    about: {
      titleAr: currentPolicies.about?.titleAr || 'قصة STICKIFY 21',
      titleEn: currentPolicies.about?.titleEn || 'About STICKIFY 21',
      contentAr: stripEmoji(document.getElementById('policy-edit-specs-ar')?.value || ''),
      contentEn: stripEmoji(document.getElementById('policy-edit-specs-en')?.value || '')
    },
    privacy: {
      titleAr: currentPolicies.privacy?.titleAr || 'الخصوصية وأمان البيانات',
      titleEn: currentPolicies.privacy?.titleEn || 'Privacy & Data Security',
      contentAr: stripEmoji(document.getElementById('policy-edit-privacy-ar')?.value || ''),
      contentEn: stripEmoji(document.getElementById('policy-edit-privacy-en')?.value || '')
    }
  };

  const updatedSettings = {
    ...current,
    policies: updatedPolicies
  };

  await storage.saveSettings(updatedSettings);
  adminState.settings = updatedSettings;
  showAdminToast('تم حفظ سياسات المتجر بنجاح');
}
window.savePoliciesSettings = savePoliciesSettings;

export async function savePaymentAccountsSettings() {
  const current = adminState.settings || await storage.getSettings();
  const accounts = [
    {
      id: 'acc-instapay-1',
      type: 'instapay',
      nameAr: 'إنستاباي الرسمي (InstaPay)',
      active: Boolean(document.getElementById('pay-acc-instapay-active')?.checked),
      handle: document.getElementById('pay-acc-instapay-handle')?.value.trim() || 'stickify21@instapay',
      holder: document.getElementById('pay-acc-instapay-holder')?.value.trim() || 'STICKIFY 21',
      order: 1
    },
    {
      id: 'acc-vodafone-1',
      type: 'vodafone_cash',
      nameAr: 'فودافون كاش كاشير (Vodafone Cash)',
      active: Boolean(document.getElementById('pay-acc-vodafone-active')?.checked),
      number: document.getElementById('pay-acc-vodafone-number')?.value.trim() || '01043546503',
      holder: document.getElementById('pay-acc-vodafone-holder')?.value.trim() || 'أحمد STICKIFY',
      order: 2
    },
    {
      id: 'acc-bank-1',
      type: 'bank',
      nameAr: 'البنك التجاري الدولي CIB',
      active: Boolean(document.getElementById('pay-acc-bank-active')?.checked),
      iban: document.getElementById('pay-acc-bank-iban')?.value.trim() || '',
      holder: document.getElementById('pay-acc-bank-holder')?.value.trim() || '',
      order: 3
    }
  ];

  const updated = {
    ...current,
    paymentAccounts: accounts
  };
  await storage.saveSettings(updated);
  adminState.settings = updated;
  showAdminToast('تم حفظ وتحديث حسابات الدفع بنجاح!');
}

export async function saveWhatsAppTemplatesSettings() {
  const current = adminState.settings || await storage.getSettings();
  const readyVal = document.getElementById('wa-template-ready')?.value.trim() || CONFIG.WHATSAPP_TEMPLATES.ready;
  const shippedVal = document.getElementById('wa-template-shipped')?.value.trim() || CONFIG.WHATSAPP_TEMPLATES.shipped;

  const updated = {
    ...current,
    whatsappTemplates: {
      ...(current.whatsappTemplates || {}),
      ready: readyVal,
      shipped: shippedVal
    }
  };
  await storage.saveSettings(updated);
  adminState.settings = updated;
  showAdminToast('تم حفظ وتحديث قوالب رسائل واتساب بنجاح!');
}

export function resetWhatsAppTemplates() {
  const readyTpl = document.getElementById('wa-template-ready');
  const shippedTpl = document.getElementById('wa-template-shipped');
  if (readyTpl) readyTpl.value = CONFIG.WHATSAPP_TEMPLATES.ready;
  if (shippedTpl) shippedTpl.value = CONFIG.WHATSAPP_TEMPLATES.shipped;
  showAdminToast('تمت استعادة قوالب الواتساب الافتراضية');
}

export async function handleSaveStoreSettings(e) {
  if (e) e.preventDefault();

  const wa = document.getElementById('setting-whatsapp-number')?.value.trim() || CONFIG.WHATSAPP_NUMBER;
  const thresh = parseInt(document.getElementById('setting-free-shipping-threshold')?.value, 10) || 200;
  const defShip = parseInt(document.getElementById('setting-default-shipping')?.value, 10) || 35;

  const current = adminState.settings || await storage.getSettings();
  const updated = {
    ...current,
    whatsappNumber: wa,
    freeShippingThreshold: thresh,
    defaultShipping: defShip
  };

  await storage.saveSettings(updated);
  adminState.settings = updated;
  showAdminToast('تم حفظ إعدادات المتجر العامة بنجاح!');
}

export async function saveGovernoratesShippingRates() {
  const current = adminState.settings || await storage.getSettings();
  const updatedRates = { ...(current.shippingRates || CONFIG.SHIPPING_RATES) };

  document.querySelectorAll('#gov-rates-grid input[data-gov-name]').forEach(input => {
    const govName = input.dataset.govName;
    const val = parseInt(input.value, 10);
    if (govName && !isNaN(val)) {
      updatedRates[govName] = val;
    }
  });

  const updatedSettings = {
    ...current,
    shippingRates: updatedRates
  };

  await storage.saveSettings(updatedSettings);
  adminState.settings = updatedSettings;
  showAdminToast('تم تحديث وحفظ أسعار شحن المحافظات الـ 27 فوراً!');
}

// Safe Toast
export function showAdminToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-red-600' : (type === 'warning' ? 'bg-amber-600' : 'bg-zinc-900');
  toast.className = `px-4 py-3 rounded-xl text-xs font-bold text-white shadow-xl flex items-center gap-2 transform transition-all duration-200 translate-y-3 opacity-0 ${bg}`;
  
  const icon = document.createElement('span');
  icon.textContent = '';
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
window.handleOrderStatusChange = handleOrderStatusChange;
window.promptCancelOrder = promptCancelOrder;
window.deleteOrder = deleteOrder;
window.clearAllOrders = clearAllOrders;
window.handleOrderFilterChange = handleOrderFilterChange;
window.resetOrderFilters = resetOrderFilters;
window.toggleOrderSelect = toggleOrderSelect;
window.toggleSelectAllOrders = toggleSelectAllOrders;
window.exportOrdersCsv = exportOrdersCsv;
window.exportSelectedOrdersCsv = exportSelectedOrdersCsv;
window.bulkUpdateOrderStatus = bulkUpdateOrderStatus;
window.batchPrintSelectedSlips = batchPrintSelectedSlips;
window.openOrderDetailModal = openOrderDetailModal;
window.closeOrderDetailModal = closeOrderDetailModal;
window.handleModalStatusChange = handleModalStatusChange;
window.promptCancelCurrentOrder = promptCancelCurrentOrder;
window.openWhatsAppImportModal = openWhatsAppImportModal;
window.closeWhatsAppImportModal = closeWhatsAppImportModal;
window.submitWhatsAppImport = submitWhatsAppImport;
window.exportAllDataJson = exportAllDataJson;
window.importDataJson = importDataJson;
window.handleResetDemoData = handleResetDemoData;
window.handleResetDemoDataWithPrompt = handleResetDemoDataWithPrompt;
window.editCategory = editCategory;
window.cancelEditCategory = cancelEditCategory;
window.deleteCategory = deleteCategory;
window.reorderCategory = reorderCategory;
window.handleCategoryFileUpload = handleCategoryFileUpload;
window.updateCategoryPreview = updateCategoryPreview;
window.handleSaveCategory = handleSaveCategory;
window.handleAdminProductSearch = handleAdminProductSearch;
window.handleAdminProductCategoryFilter = handleAdminProductCategoryFilter;
window.toggleProductInStock = toggleProductInStock;
window.suggestSkuForCurrentCategory = suggestSkuForCurrentCategory;
window.handleProductTypeChange = handleProductTypeChange;
window.quickUpdatePrice = quickUpdatePrice;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.handleProductFileUpload = handleProductFileUpload;
window.updateProductPreview = updateProductPreview;
window.handleSaveProduct = handleSaveProduct;
window.deleteProduct = deleteProduct;
window.toggleCouponValueLabel = toggleCouponValueLabel;
window.renderCoupons = renderCoupons;
window.toggleCouponActive = toggleCouponActive;
window.handleCreateCoupon = handleCreateCoupon;
window.deleteCoupon = deleteCoupon;
window.renderSettings = renderSettings;
window.handleSaveStoreSettings = handleSaveStoreSettings;
window.saveGovernoratesShippingRates = saveGovernoratesShippingRates;
window.getNextLogicalStep = getNextLogicalStep;
window.handleQuickNextStep = handleQuickNextStep;
window.handleUndoStatusChange = handleUndoStatusChange;
window.dismissStatusUndoToast = dismissStatusUndoToast;
window.openShippingDispatchModal = openShippingDispatchModal;
window.closeShippingDispatchModal = closeShippingDispatchModal;
window.toggleCustomCourierInput = toggleCustomCourierInput;
window.confirmShippingDispatch = confirmShippingDispatch;
window.toggleOrderPacksExpand = toggleOrderPacksExpand;
window.handleChangePasscode = handleChangePasscode;
window.setOrdersQuickFilter = setOrdersQuickFilter;
window.verifyCurrentOrderPayment = verifyCurrentOrderPayment;
window.handleModalPaymentStatusChange = handleModalPaymentStatusChange;
window.openFullProofImageModal = openFullProofImageModal;
window.savePaymentAccountsSettings = savePaymentAccountsSettings;
window.saveWhatsAppTemplatesSettings = saveWhatsAppTemplatesSettings;
window.resetWhatsAppTemplates = resetWhatsAppTemplates;
window.openAddShowcaseModal = openAddShowcaseModal;
window.openEditShowcaseModal = openEditShowcaseModal;
window.closeShowcaseModal = closeShowcaseModal;
window.saveShowcaseItemFromForm = saveShowcaseItemFromForm;
window.toggleShowcaseActive = toggleShowcaseActive;
window.moveShowcaseItem = moveShowcaseItem;
window.deleteShowcaseItem = deleteShowcaseItem;
window.checkBackupReminder = checkBackupReminder;
window.downloadFullBackupNow = downloadFullBackupNow;
window.duplicateProduct = duplicateProduct;
window.toggleProductSelect = toggleProductSelect;
window.toggleSelectAllProducts = toggleSelectAllProducts;
window.updateProductBulkBar = updateProductBulkBar;
window.applyBulkToggleActive = applyBulkToggleActive;
window.applyBulkPricePercent = applyBulkPricePercent;
window.applyBulkCategoryMove = applyBulkCategoryMove;
window.handleBulkUndo = handleBulkUndo;
window.dismissBulkUndoToast = dismissBulkUndoToast;
window.renderDashboardAnalytics = renderDashboardAnalytics;
window.renderStockAlerts = renderStockAlerts;
window.renderStorageUsageMeter = renderStorageUsageMeter;
window.openProductionSummaryModal = openProductionSummaryModal;
window.closeProductionSummaryModal = closeProductionSummaryModal;
// ==========================================
// R14: CUSTOM PRINT REQUESTS & UPLOAD POLICY SETTINGS
// ==========================================
export function renderCustomRequests() {
  const listEl = document.getElementById('admin-custom-requests-list');
  const badgeEl = document.getElementById('custom-requests-count-badge');
  const reqs = adminState.customRequests || [];
  if (badgeEl) badgeEl.textContent = String(reqs.length);
  if (!listEl) return;

  if (reqs.length === 0) {
    listEl.innerHTML = `<div class="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-center text-xs text-zinc-400 font-semibold">لا توجد طلبات طباعة مخصصة مسجلة محلياً حتى الآن.</div>`;
    return;
  }

  listEl.innerHTML = reqs.map(req => {
    const filesHtml = (req.files || []).map(f => {
      const sizeKb = Math.max(1, Math.round((f.size || 0) / 1024));
      const dims = f.dimensions ? `${f.dimensions.width}×${f.dimensions.height}px` : '';
      const dpiBadge = f.dpi ? `<span class="px-1.5 py-0.5 rounded font-mono text-[10px] ${f.isLowRes ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${f.dpi} DPI</span>` : '';
      return `
        <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-50 border border-zinc-200 text-[11px]">
          <div class="flex items-center gap-2 min-w-0">
            <span class="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-mono text-[10px] uppercase">${escapeHtml(f.kind || 'FILE')}</span>
            <span class="font-bold text-zinc-900 truncate">${escapeHtml(f.name || 'file')}</span>
            <span class="text-zinc-500 font-mono">${sizeKb} KB ${dims ? `• ${dims}` : ''}</span>
            ${dpiBadge}
          </div>
          ${f.assetId ? `<button type="button" onclick="downloadCustomRequestAsset('${escapeHtml(f.assetId)}', '${escapeHtml(f.name || 'file')}')" class="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-black text-white font-bold text-[10px] whitespace-nowrap">تحميل الأصلي</button>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="p-4 rounded-2xl bg-white border border-zinc-200 space-y-2.5 text-xs">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="font-mono font-black text-[#FF5000]">#${escapeHtml(req.id)}</span>
            <span class="font-bold text-zinc-900">${escapeHtml(req.name || '')}</span>
            <span class="font-mono text-zinc-500">${escapeHtml(req.phone || '')}</span>
          </div>
          <label class="flex items-center gap-2 cursor-pointer select-none px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-[11px]">
            <input type="checkbox" ${req.receivedOnWhatsApp ? 'checked' : ''} onchange="toggleCustomRequestWhatsAppReceived('${escapeHtml(req.id)}', this.checked)" class="rounded text-emerald-600">
            <span>تم الاستلام على واتساب</span>
          </label>
        </div>
        <div class="text-[11px] text-zinc-600 flex flex-wrap gap-3 font-mono">
          <span>الكمية: <strong>${req.quantity || 10}</strong></span>
          <span>المقاس: <strong>${escapeHtml(req.sizeLabel || req.size || '8 سم')}</strong></span>
          <span>الإجمالي التقديري: <strong class="text-[#FF5000]">${req.total || 0} ${CONFIG.CURRENCY}</strong></span>
        </div>
        ${filesHtml ? `<div class="space-y-1.5 pt-1">${filesHtml}</div>` : ''}
      </div>
    `;
  }).join('');
}

export async function toggleCustomRequestWhatsAppReceived(reqId, checked) {
  await storage.updateCustomPrintRequest(reqId, { receivedOnWhatsApp: Boolean(checked) });
  adminState.customRequests = await storage.getCustomPrintRequests();
  showAdminToast(checked ? 'تم تأكيد استلام ملف الطباعة على واتساب' : 'تم إلغاء علامة الاستلام');
}

export async function downloadCustomRequestAsset(assetId, filename) {
  const blob = await storage.getAssetBlob(assetId);
  if (!blob) {
    showAdminToast('الملف غير موجود في التخزين المحلي لهذا المتصفح.', 'warning');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'custom-design';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveCustomUploadSettings() {
  const maxMb = Math.max(1, Math.min(50, parseInt(document.getElementById('setting-custom-max-mb')?.value || '15', 10) || 15));
  const maxFiles = Math.max(1, Math.min(20, parseInt(document.getElementById('setting-custom-max-files')?.value || '5', 10) || 5));
  const rawExts = (document.getElementById('setting-custom-exts')?.value || '').split(',').map(s => s.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
  const allowedExtensions = rawExts.length > 0 ? rawExts : DEFAULT_CUSTOM_UPLOAD_POLICY.allowedExtensions;

  const settings = adminState.settings || await storage.getSettings();
  settings.customUpload = {
    allowedExtensions,
    maxFileSizeMb: maxMb,
    maxFiles,
    maxTotalSizeMb: Math.max(maxMb, maxMb * 3)
  };
  await storage.saveSettings(settings);
  adminState.settings = settings;
  showAdminToast('تم حفظ حدود وصيغ ملفات الطباعة المخصصة بنجاح!');
}

window.confirmOpaqueProductPng = confirmOpaqueProductPng;
window.cancelOpaqueProductPng = cancelOpaqueProductPng;
window.toggleCustomRequestWhatsAppReceived = toggleCustomRequestWhatsAppReceived;
window.downloadCustomRequestAsset = downloadCustomRequestAsset;
window.saveCustomUploadSettings = saveCustomUploadSettings;
window.toggleAdminTheme = toggleAdminTheme;

document.addEventListener('DOMContentLoaded', initAdmin);
