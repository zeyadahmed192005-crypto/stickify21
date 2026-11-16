/**
 * STICKIFY 21 - Order Lifecycle & Transitions Domain
 */
import { CONFIG } from '../config/config.js';

export const ORDER_STATUSES = CONFIG.ORDER_STATUSES;
export const ORDER_TRANSITIONS = CONFIG.ORDER_TRANSITIONS;

/**
 * Check if a status transition is valid
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {boolean}
 */
export function isValidStatusTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) return true;
  const allowed = ORDER_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(targetStatus);
}

/**
 * Apply a status transition to an order
 * @param {Object} order
 * @param {string} targetStatus
 * @param {string} note - Optional reason or note
 * @returns {Object} Updated order
 * @throws {Error} If transition is invalid
 */
export function applyStatusTransition(order, targetStatus, note = '') {
  if (!order || !order.status) {
    throw new Error('طلب غير صالح لتحديث الحالة');
  }

  const current = order.status;
  if (!isValidStatusTransition(current, targetStatus)) {
    const fromLabel = ORDER_STATUSES[current]?.labelAr || current;
    const toLabel = ORDER_STATUSES[targetStatus]?.labelAr || targetStatus;
    throw new Error(`لا يمكن تغيير حالة الطلب من [${fromLabel}] إلى [${toLabel}] مباشرة.`);
  }

  const history = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
  history.push({
    status: targetStatus,
    timestamp: new Date().toISOString(),
    note: note || `تحديث الحالة إلى ${ORDER_STATUSES[targetStatus]?.labelAr || targetStatus}`
  });

  return {
    ...order,
    status: targetStatus,
    statusHistory: history,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Format order details into Egyptian WhatsApp message with appended Order Code
 * @param {Object} order
 * @param {string} orderCode - Base64url order code
 * @returns {string} Text ready for WhatsApp URL encoding
 */
export function formatOrderWhatsAppMessage(order, orderCode) {
  const c = order.customer;
  const itemsText = (order.items || []).map((it, idx) => {
    if (it.type === 'pack') {
      const subItemsNames = (it.items || []).map(p => `#${p.sku || p.id}`).join(', ');
      return `${idx + 1}. *${it.nameAr || 'باقة استيكرات'}* (الكمية: ${it.quantity}) - ${it.price * it.quantity} ج.م\n   المحتويات: [${subItemsNames}]`;
    }
    return `${idx + 1}. *${it.nameAr || it.name}* (مقاس: ${it.size || '8 سم'}, الكمية: ${it.quantity}) - ${it.price * it.quantity} ج.م`;
  }).join('\n');

  let couponLine = '';
  if (order.couponCode) {
    couponLine = `\n🎟 *كود الخصم:* ${order.couponCode} (تم الخصم)`;
  }

  const govName = c.governorate || c.city || 'القاهرة';
  const shippingLine = order.shippingCost === 0 ? 'مجاني 🎉' : `${order.shippingCost} ج.م`;

  let paymentText = 'الدفع عند الاستلام (COD)';
  if (order.paymentMethod === 'instapay' || order.payment === 'instapay') {
    paymentText = 'انستاباي (InstaPay - stickify21@instapay)';
  } else if (order.paymentMethod === 'vodafone_cash' || order.payment === 'vodafone_cash') {
    paymentText = 'فودافون كاش (Vodafone Cash - 01043546503)';
  } else if (order.payment) {
    paymentText = order.payment;
  }

  return `*طلب جديد من موقع STICKIFY 21* 🚀
--------------------------------
*رقم الطلب:* ${order.id}
*التاريخ:* ${new Date(order.date || Date.now()).toLocaleDateString('ar-EG')}

*بيانات العميل:*
👤 *الاسم:* ${c.name}
📱 *الهاتف:* ${c.phone}
📍 *المحافظة:* ${govName}
🏠 *العنوان:* ${c.address}
${c.notes ? `📝 *ملاحظات:* ${c.notes}\n` : ''}
*المنتجات المطلوبة:*
${itemsText}
${couponLine}
--------------------------------
💵 *المجموع الفرعي:* ${order.subtotal} ج.م
🚚 *مصاريف الشحن (${govName}):* ${shippingLine}
💰 *الإجمالي المستحق:* ${order.total} ج.م
💳 *طريقة الدفع:* ${paymentText}
--------------------------------
يرجى تأكيد استلام الطلب وتجهيزه! شكراً STICKIFY 21 ❤️

${orderCode ? orderCode : ''}`;
}

/**
 * Format a custom print order into a WhatsApp message
 * @param {object} customOrder
 * @returns {string} WhatsApp message text
 */
export function formatCustomPrintWhatsAppMessage(customOrder) {
  const finishLabels = {
    glossy: 'لامع (Glossy)',
    matte: 'مطفي (Matte)',
    holographic: 'هولوجرام (Holographic ✨)'
  };
  const finishStr = finishLabels[customOrder.finish] || customOrder.finish;

  return `*طلب طباعة مخصصة من STICKIFY 21* 🎨
--------------------------------
*الاسم:* ${customOrder.name}
📱 *الهاتف:* ${customOrder.phone}
📏 *المقاس:* ${customOrder.sizeLabel || customOrder.size}
✨ *اللمسة النهائية:* ${finishStr}
📦 *الكمية:* ${customOrder.quantity} قطعة (${customOrder.tierLabel})
💵 *الإجمالي التقديري:* ${customOrder.total} ج.م (${customOrder.unitPrice} ج.م للقطعة)
✂️ *نوع القص:* ${customOrder.cutType || 'Die-cut مفرغ حول التصميم'}
${customOrder.notes ? `📝 *ملاحظات إضافية:* ${customOrder.notes}\n` : ''}
📁 *ملف التصميم:* ${customOrder.fileName ? customOrder.fileName : 'سأرفقه هنا في المحادثة'}
--------------------------------
⚠️ *ملاحظة:* يرجى إرسال ملف التصميم بجودة الطباعة (Vector أو PNG بخلفية شفافة) هنا لمراجعته وتأكيد موعد التسليم!`;
}
