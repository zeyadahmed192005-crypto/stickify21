/**
 * STICKIFY 21 - Admin Portal Controller
 * Powered by unified StorageService & PBKDF2 Web Crypto Authentication
 */

import { CONFIG } from './src/config/config.js';
import { escapeHtml, sanitizeUrl, sanitizeSvg } from './src/utils/escape.js';
import { parseOrderCode } from './src/utils/ids.js';
import { ORDER_STATUSES, isValidStatusTransition } from './src/domain/orders.js';
import { 
  verifyAdminPasscode, 
  isAdminAuthenticated, 
  adminLogout, 
  getRateLimitStatus 
} from './src/domain/auth.js';
import { storage } from './src/data/storage.js';

// Admin State
let adminState = {
  authenticated: false,
  currentTab: 'orders',
  orders: [],
  products: [],
  categories: [],
  coupons: [],
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
  activeDetailOrderId: null
};

// ==========================================
// INITIALIZATION & AUTH
// ==========================================
export async function initAdmin() {
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

  renderAll();
}

function renderAll() {
  renderOrders();
  renderProducts();
  renderCategories();
  renderCoupons();
  renderSettings();
  updateBadges();
}

// Tab Switching
export function switchTab(tabName) {
  adminState.currentTab = tabName;
  ['orders', 'products', 'categories', 'coupons', 'settings'].forEach(t => {
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
  const couponsActiveCount = document.getElementById('coupons-active-count');
  
  if (oBadge) oBadge.innerText = adminState.orders.length;
  if (pBadge) pBadge.innerText = adminState.products.length;
  if (catBadge) catBadge.innerText = adminState.categories.length;
  if (cBadge) cBadge.innerText = adminState.coupons.length;
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

  // 2. Populate Governorate Filter dropdown if needed
  populateGovernorateFilter();

  // 3. Filter orders based on active filters
  let filtered = [...orders];

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
        <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-zinc-100 flex items-center justify-center text-3xl">📭</div>
        <h3 class="text-sm font-bold text-zinc-800">لا توجد طلبات تطابق معايير البحث والفلترة</h3>
        <p class="text-xs text-zinc-400 mt-1">جرب تغيير الفلاتر أو إعادة ضبط البحث للوصول لجميع الطلبات.</p>
      </div>
    `;
    return;
  }

  // Canonical status keys and display mapping
  const statuses = [
    { key: 'pending', label: 'جديد' },
    { key: 'awaiting_confirmation', label: 'بانتظار التأكيد' },
    { key: 'confirmed', label: 'مؤكد' },
    { key: 'preparing', label: 'قيد التجهيز' },
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
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}">
                ${escapeHtml(statusObj.labelAr)}
              </span>
              ${order.source === 'whatsapp_import' ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">WHATSAPP CODE</span>' : ''}
            </div>

            <div class="flex items-center gap-2 text-xs font-bold text-zinc-900 flex-wrap">
              <span>👤 ${escapeHtml(order.customer?.name || 'عميل')}</span>
              <span class="text-zinc-300">•</span>
              <span class="font-mono text-zinc-600" dir="ltr">📱 ${escapeHtml(order.customer?.phone || '')}</span>
              <span class="text-zinc-300">•</span>
              <span class="text-zinc-500">📍 ${escapeHtml(order.customer?.governorate || order.customer?.city || '')}</span>
              <span class="text-zinc-300">•</span>
              <span class="text-zinc-500 text-[11px] font-normal truncate max-w-xs">🏠 ${escapeHtml(order.customer?.address || '')}</span>
            </div>

            <div class="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
              <span>عدد العناصر: <strong class="text-zinc-900 font-mono">${order.items?.length || 0}</strong></span>
              <span>•</span>
              <span>طريقة الدفع: <strong class="text-zinc-900">${escapeHtml(order.payment || 'عند الاستلام')}</strong></span>
              <span>•</span>
              <span>الإجمالي: <strong class="text-[#FF5000] font-mono text-sm">${order.total} ${CONFIG.CURRENCY}</strong></span>
              ${order.couponCode ? `<span>•</span><span class="text-emerald-600 font-mono font-bold">كوبون: ${escapeHtml(order.couponCode)}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-zinc-200 flex-shrink-0">
          <button onclick="openOrderDetailModal('${escapeHtml(order.id)}')" class="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition flex items-center gap-1">
            <span>👁️ عرض التفاصيل</span>
          </button>

          <a href="${packingSlipUrl}" target="_blank" class="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1 shadow-sm">
            <span>🖼️ تجهيز بالصور</span>
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
            🚫
          </button>

          <button onclick="deleteOrder('${escapeHtml(order.id)}')" class="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="حذف الطلب">
            🗑️
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
      formatCsvCell(o.payment || 'عند الاستلام'),
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
  showAdminToast(`تم تصدير ${orders.length} طلب إلى ملف CSV (UTF-8 BOM) بنجاح 📊`);
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
    showAdminToast(`تم تحديث حالة الطلب #${orderId} إلى "${ORDER_STATUSES[targetKey]?.labelAr}" بنجاح! ✓`);
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

  // Items
  const itemsContainer = document.getElementById('modal-items-container');
  const items = order.items || [];
  document.getElementById('modal-items-count').innerText = items.length;

  itemsContainer.innerHTML = items.map(item => {
    const safeImg = sanitizeUrl(item.image);
    const safeSvg = item.svg ? sanitizeSvg(item.svg) : `<div class="font-mono font-bold text-xs text-zinc-400">#${escapeHtml(item.sku || '')}</div>`;
    const qty = parseInt(item.qty || item.quantity, 10) || 1;
    const price = parseInt(item.price, 10) || 0;

    return `
      <div class="bg-white p-3 rounded-xl border border-zinc-200 flex items-center justify-between gap-3 shadow-xs">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center overflow-hidden flex-shrink-0 p-1">
            ${safeImg ? `<img src="${safeImg}" class="w-full h-full object-contain">` : safeSvg}
          </div>
          <div class="min-w-0">
            <h5 class="font-bold text-xs text-zinc-900 truncate">${escapeHtml(item.nameAr || item.name || 'منتج')}</h5>
            <div class="text-[11px] text-zinc-500 font-mono flex items-center gap-2">
              <span class="bg-zinc-100 px-1.5 py-0.2 rounded font-bold text-zinc-700">#${escapeHtml(item.sku || '')}</span>
              <span>${escapeHtml(item.size || '')}</span>
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
  const subtotal = items.reduce((sum, it) => sum + ((it.price || 0) * (it.qty || it.quantity || 1)), 0);
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
    const stObj = ORDER_STATUSES[h.status] || ORDER_STATUSES.pending;
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
    showAdminToast(`تم استيراد الطلب [${importedOrder.id}] بنجاح! 🎉`);
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
    URL.revokeObjectURL(url);
    showAdminToast('تم تصدير ملف النسخة الاحتياطية بنجاح 💾');
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
      showAdminToast('تم استيراد وترقية البيانات بنجاح! 🎉');
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
    showAdminToast('تمت استعادة بيانات المصنع والديمو بنجاح! 🔄');
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
          <!-- Reorder buttons -->
          <div class="flex flex-col gap-0.5">
            <button onclick="reorderCategory(${index}, -1)" ${index === 0 ? 'disabled class="opacity-30"' : ''} class="p-1 rounded hover:bg-zinc-200 text-[10px]" title="تحريك لأعلى">▲</button>
            <button onclick="reorderCategory(${index}, 1)" ${index === adminState.categories.length - 1 ? 'disabled class="opacity-30"' : ''} class="p-1 rounded hover:bg-zinc-200 text-[10px]" title="تحريك لأسفل">▼</button>
          </div>

          <button onclick="editCategory(${index})" class="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs transition flex items-center gap-1" title="تعديل">
            <span>✏️</span>
            <span>تعديل</span>
          </button>
          <button onclick="deleteCategory(${index})" class="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="حذف">
            ✕
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

export async function handleSaveCategory(e) {
  e.preventDefault();

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

  const catObj = {
    id: id,
    nameAr: nameAr,
    nameEn: nameEn,
    icon: icon,
    image: sanitizeUrl(image) || null,
    badge: badge || null
  };

  await storage.saveCategory(catObj);
  showAdminToast(`تم حفظ قسم "${nameAr}" بنجاح! ✓`);

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

export function renderProducts() {
  const container = document.getElementById('admin-products-table');
  if (!container) return;

  // Populate Category Filter dropdown
  const catFilterSelect = document.getElementById('admin-product-category-filter');
  if (catFilterSelect && catFilterSelect.children.length <= 1) {
    adminState.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.icon || '🏷️'} ${c.nameAr}`;
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

  // Category filter
  if (adminState.productCategoryFilter && adminState.productCategoryFilter !== 'all') {
    list = list.filter(p => p.category === adminState.productCategoryFilter);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-zinc-400 bg-white rounded-2xl border border-zinc-200">
        <div class="text-2xl mb-1">🔍</div>
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
              ${inStock ? '✓ متوفر للطلب' : '✕ غير متوفر'}
            </button>
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

      </div>
    `;
  }).join('');
}

export async function toggleProductInStock(productId) {
  const prod = adminState.products.find(p => p.id === productId);
  if (!prod) return;
  prod.inStock = prod.inStock === false ? true : false;
  await storage.saveProduct(prod);
  renderProducts();
  showAdminToast(`تم تحديث توفر [${prod.sku}] إلى: ${prod.inStock ? 'متوفر ✓' : 'غير متوفر ✕'}`);
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

export async function handleProductFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    showAdminToast('جارٍ ضغط الصورة بصيغة WebP وحفظها في IndexedDB...', 'warning');
    const asset = await storage.uploadImage(file);
    const input = document.getElementById('prod-image');
    if (input) input.value = asset.previewUrl;
    updateProductPreview();
    showAdminToast('تم حفظ وضغط الصورة بنجاح! 📸');
  } catch (err) {
    console.warn('Fallback to DataURL:', err);
    const reader = new FileReader();
    reader.onload = function(evt) {
      const input = document.getElementById('prod-image');
      if (input) input.value = evt.target.result;
      updateProductPreview();
      showAdminToast('تم تحميل صورة المنتج بنجاح! 📸');
    };
    reader.readAsDataURL(file);
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
  const nameAr = document.getElementById('prod-name-ar').value.trim();
  const nameEn = document.getElementById('prod-name-en').value.trim() || nameAr;
  const price = parseInt(document.getElementById('prod-price').value, 10) || 35;
  const category = document.getElementById('prod-category').value;
  const finish = document.getElementById('prod-finish').value;
  const badge = document.getElementById('prod-badge').value.trim() || (type === 'bookmark' ? 'بوك مارك 🔖' : 'استيكر');
  const image = document.getElementById('prod-image').value.trim();
  const svgInput = document.getElementById('prod-svg-input').value.trim();
  const desc = document.getElementById('prod-desc').value.trim() || 'استيكر عالي الجودة ومقاوم لعوامل الجو من STICKIFY 21.';
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
    badge: badge,
    desc: desc,
    inStock: inStock,
    stockQuantity: stockQty,
    image: sanitizeUrl(image) || null,
    svg: svgInput ? sanitizeSvg(svgInput) : (!image ? `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="15" y="15" width="130" height="130" rx="26" fill="#0E0E10" stroke="#FF5000" stroke-width="4"/><text x="80" y="90" font-family="'Space Grotesk'" font-weight="800" font-size="20" fill="#FF5000" text-anchor="middle">${escapeHtml(sku)}</text></svg>` : null),
    dateAdded: Date.now()
  };

  await storage.saveProduct(productObj);
  showAdminToast(`تم حفظ المنتج [${sku}] بنجاح! ✓`);

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
            ${active ? '✓ نشط' : '✕ معطل'}
          </button>
          <button onclick="deleteCoupon(${index})" class="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="حذف الكود">
            🗑️
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
  showAdminToast(`تم تفعيل كود الخصم "${code}" بنجاح! 🎉`);
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
  if (!grid) return;

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
  showAdminToast('تم حفظ إعدادات المتجر العامة بنجاح! ✓');
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
  showAdminToast('تم تحديث وحفظ أسعار شحن المحافظات الـ 27 فوراً! ✓');
}

// Safe Toast
export function showAdminToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-red-600' : (type === 'warning' ? 'bg-amber-600' : 'bg-zinc-900');
  toast.className = `px-4 py-3 rounded-xl text-xs font-bold text-white shadow-xl flex items-center gap-2 transform transition-all duration-200 translate-y-3 opacity-0 ${bg}`;
  
  const icon = document.createElement('span');
  icon.textContent = type === 'error' ? '✕' : (type === 'warning' ? '⚠️' : '✓');
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

document.addEventListener('DOMContentLoaded', initAdmin);
