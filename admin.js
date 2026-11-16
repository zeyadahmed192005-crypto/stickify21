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
  productSearch: ''
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
  // Check activity on user interactions
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

  // Periodic timer check every 60 seconds
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

  renderAll();
}

function renderAll() {
  renderOrders();
  renderProducts();
  renderCategories();
  renderCoupons();
  updateBadges();
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
// ORDERS CONTROLLER
// ==========================================
export function renderOrders() {
  const container = document.getElementById('orders-list-container');
  if (!container) return;

  const orders = adminState.orders;
  const totalRev = orders.reduce((sum, o) => sum + (parseInt(o.total, 10) || 0), 0);
  const pendingCount = orders.filter(o => o.status !== 'completed' && o.status !== 'مكتمل' && o.status !== 'cancelled' && o.status !== 'ملغي').length;

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
        <p class="text-xs text-zinc-400 mt-1">أي طلب يرسله الزبون من المتجر أو عبر كود الواتساب سيظهر هنا فوراً.</p>
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

  container.innerHTML = orders.map((order, index) => {
    const packingSlipUrl = `packing-slip.html?id=${encodeURIComponent(order.id || '')}`;
    
    // Normalize status key
    let currentKey = order.status || 'pending';
    if (currentKey === 'جديد') currentKey = 'pending';
    else if (currentKey === 'بانتظار التأكيد') currentKey = 'awaiting_confirmation';
    else if (currentKey === 'مؤكد') currentKey = 'confirmed';
    else if (currentKey === 'قيد التجهيز') currentKey = 'preparing';
    else if (currentKey === 'تم الشحن') currentKey = 'shipped';
    else if (currentKey === 'مكتمل') currentKey = 'completed';
    else if (currentKey === 'ملغي') currentKey = 'cancelled';

    const statusObj = ORDER_STATUSES[currentKey] || ORDER_STATUSES.pending;
    const badgeClass = statusObj.badgeClass || 'bg-zinc-100 text-zinc-800 border-zinc-200';

    return `
      <div class="bg-zinc-50 hover:bg-white rounded-2xl border border-zinc-200 p-5 transition-all duration-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        <div class="space-y-1.5 flex-grow">
          <div class="flex items-center gap-3 flex-wrap">
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

        <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-zinc-200">
          <a href="${packingSlipUrl}" target="_blank" class="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
            <span>🖼️ تجهيز بالصور</span>
            <span>↗</span>
          </a>

          <!-- Order Status Dropdown with Transition Check -->
          <select id="status-select-${escapeHtml(order.id)}" onchange="handleOrderStatusChange('${escapeHtml(order.id)}', this.value)" class="bg-white border border-zinc-200 rounded-xl px-2.5 py-2 text-xs text-zinc-800 font-bold focus:outline-none focus:border-[#FF5000]">
            ${statuses.map(s => `
              <option value="${s.key}" ${currentKey === s.key ? 'selected' : ''}>${s.label}</option>
            `).join('')}
          </select>

          <button onclick="deleteOrder('${escapeHtml(order.id)}')" class="p-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition" title="حذف الطلب">
            🗑️
          </button>
        </div>

      </div>
    `;
  }).join('');
}

/**
 * Handle Order Status change with lifecycle transition enforcement
 */
export async function handleOrderStatusChange(orderId, targetKey) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  // Normalize current key
  let currentKey = order.status || 'pending';
  if (currentKey === 'جديد') currentKey = 'pending';
  else if (currentKey === 'بانتظار التأكيد') currentKey = 'awaiting_confirmation';
  else if (currentKey === 'مؤكد') currentKey = 'confirmed';
  else if (currentKey === 'قيد التجهيز') currentKey = 'preparing';
  else if (currentKey === 'تم الشحن') currentKey = 'shipped';
  else if (currentKey === 'مكتمل') currentKey = 'completed';
  else if (currentKey === 'ملغي') currentKey = 'cancelled';

  // Check valid transition
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
      if (!confirm('تحذير: سيتم استيراد البيانات الجديدة واستبدال البيانات الحالية (مع حفظ لقطة أمان تلقائية للبيانات الحالية). هل تريد المتابعة؟')) {
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
  if (!confirm('تحذير نهائي: هل تريد استعادة بيانات الديمو الأصلية وإفراغ سجل الطلبات؟ (سيتم حفظ لقطة أمان تلقائياً)')) {
    return;
  }
  try {
    await storage.resetDemoData();
    await loadData();
    showAdminToast('تمت استعادة بيانات الديمو الأصلية بنجاح 🔄');
  } catch (err) {
    console.error(err);
    showAdminToast('فشل إعادة ضبط البيانات', 'error');
  }
}

// ==========================================
// CATEGORIES CONTROLLER
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

export async function handleSaveCategory(e) {
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
// PRODUCTS CONTROLLER
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

export async function quickUpdatePrice(index, newPrice) {
  const priceNum = parseInt(newPrice, 10);
  if (!priceNum || priceNum < 1) return;
  const prod = adminState.products[index];
  if (!prod) return;
  prod.price = priceNum;
  await storage.saveProduct(prod);
  showAdminToast(`تم تحديث سعر [${prod.sku}] إلى ${priceNum} ${CONFIG.CURRENCY}`);
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
  const desc = document.getElementById('prod-desc').value.trim() || 'استيكر عالي الجودة ومقاوم لعوامل الجو من STICKIFY 21.';

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
    inStock: true,
    stockQuantity: 50,
    image: sanitizeUrl(image) || null,
    svg: !image ? `<svg viewBox="0 0 160 160" class="w-full h-full"><rect x="15" y="15" width="130" height="130" rx="26" fill="#0E0E10" stroke="#FF5000" stroke-width="4"/><text x="80" y="90" font-family="'Space Grotesk'" font-weight="800" font-size="20" fill="#FF5000" text-anchor="middle">${escapeHtml(sku)}</text></svg>` : null,
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
        <span class="text-xs font-bold text-emerald-600">خصم ${c.discountPercent || c.discountFixed || 10}%</span>
        ${c.minOrder ? `<span class="text-[11px] text-zinc-500 font-mono">حد أدنى: ${c.minOrder} ج.م</span>` : ''}
      </div>
      <button onclick="deleteCoupon(${index})" class="text-xs text-red-500 hover:text-red-700 font-bold p-1">
        حذف
      </button>
    </div>
  `).join('');
}

export async function handleCreateCoupon(e) {
  e.preventDefault();
  const code = document.getElementById('coupon-code-input').value.trim().toUpperCase();
  const percent = parseInt(document.getElementById('coupon-percent-input').value, 10);

  if (!code || isNaN(percent)) return;

  const exists = adminState.coupons.find(c => c.code.toUpperCase() === code);
  if (exists) {
    showAdminToast('هذا الكود موجود بالفعل!', 'error');
    return;
  }

  const newCoupon = {
    code: code,
    type: 'percentage',
    discountPercent: percent,
    minOrder: 0,
    usageLimit: 1000,
    usageCount: 0,
    active: true,
    desc: `خصم ${percent}%`
  };

  await storage.saveCoupon(newCoupon);
  
  document.getElementById('coupon-code-input').value = '';
  document.getElementById('coupon-percent-input').value = '';

  await loadData();
  showAdminToast(`تم تفعيل كود الخصم "${code}" بنسبة ${percent}%`);
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
window.deleteOrder = deleteOrder;
window.clearAllOrders = clearAllOrders;
window.openWhatsAppImportModal = openWhatsAppImportModal;
window.closeWhatsAppImportModal = closeWhatsAppImportModal;
window.submitWhatsAppImport = submitWhatsAppImport;
window.exportAllDataJson = exportAllDataJson;
window.importDataJson = importDataJson;
window.handleResetDemoData = handleResetDemoData;
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
