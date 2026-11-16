/**
 * STICKIFY 21 - Identification & Order Code Utilities
 */

/**
 * Generate a unique, non-guessable order ID: S21-YYMMDD-XXXX
 * @param {Array<string>} existingIds - Optional array of existing IDs to prevent collisions
 * @returns {string} e.g. "S21-261116-A8F2"
 */
export function generateOrderId(existingIds = []) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yy}${mm}${dd}`;

  let candidate = '';
  let attempts = 0;
  const maxAttempts = 100;

  do {
    const bytes = new Uint8Array(2);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      bytes[0] = Math.floor(Math.random() * 256);
      bytes[1] = Math.floor(Math.random() * 256);
    }
    const randHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
    candidate = `S21-${datePart}-${randHex}`;
    attempts++;
  } while (existingIds.includes(candidate) && attempts < maxAttempts);

  return candidate;
}

/**
 * Generate an idempotency key for checkout attempts
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idemp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
}

/**
 * Base64URL encoding helper (safe for URL, text & WhatsApp)
 */
export function toBase64Url(str) {
  // UTF-8 safe base64 encoding
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL decoding helper
 */
export function fromBase64Url(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export const ORDER_CODE_PREFIX = 'S21CODE:';
export const ORDER_CODE_SECURITY_NOTE = 'Base64 is encoding, not security; this is a DEMO bridge until a backend exists.';

/**
 * Convert an Order object into a compact base64url Order Code
 * @param {Object} order
 * @returns {string} e.g. "S21CODE:eyJ2IjoxLCJpZCI6...}"
 */
export function generateOrderCode(order) {
  const compactPayload = {
    v: 1, // schema version
    id: order.id,
    dt: order.date || new Date().toISOString(),
    c: {
      n: order.customer.name,
      p: order.customer.phone,
      g: order.customer.city || order.customer.governorate,
      a: order.customer.address,
      nt: order.customer.notes || ''
    },
    it: (order.items || []).map(item => ({
      i: item.id || item.productId,
      s: item.sku || 'S21',
      n: item.nameAr || item.name,
      t: item.type || 'single',
      sz: item.size || '8 سم',
      q: item.quantity || item.qty || 1,
      p: item.price || 0,
      pi: item.items ? item.items.map(sub => sub.id) : undefined // pack item ids
    })),
    sub: order.subtotal || order.total,
    shp: order.shippingCost || 0,
    tot: order.total,
    cp: order.couponCode || null,
    pm: order.payment || 'عند الاستلام'
  };

  const jsonStr = JSON.stringify(compactPayload);
  return `${ORDER_CODE_PREFIX}${toBase64Url(jsonStr)}`;
}

/**
 * Parse an Order Code from raw pasted text (full WhatsApp message or bare code)
 * @param {string} text
 * @returns {Object} Reconstructed Order object
 * @throws {Error} If code is missing, invalid or corrupt
 */
export function parseOrderCode(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('يرجى لصق نص كود الطلب أو رسالة الواتساب بالكامل.');
  }

  // Find the Order Code within text
  let codeStr = '';
  const prefixIdx = text.indexOf(ORDER_CODE_PREFIX);
  if (prefixIdx !== -1) {
    const afterPrefix = text.slice(prefixIdx + ORDER_CODE_PREFIX.length).trim();
    // Match until end of word / whitespace
    const match = afterPrefix.match(/^([A-Za-z0-9_-]+)/);
    if (match) {
      codeStr = match[1];
    }
  } else {
    // Check if entire text is a base64url string
    const cleaned = text.trim();
    if (/^[A-Za-z0-9_-]+$/.test(cleaned)) {
      codeStr = cleaned;
    }
  }

  if (!codeStr) {
    throw new Error('لم يتم العثور على كود الطلب (S21CODE:) داخل النص المدخل.');
  }

  let decodedJson;
  try {
    decodedJson = fromBase64Url(codeStr);
  } catch (err) {
    throw new Error('كود الطلب تالف أو غير صالح للفك (Invalid Base64).');
  }

  let data;
  try {
    data = JSON.parse(decodedJson);
  } catch (err) {
    throw new Error('محتوى كود الطلب ليس بتنسيق JSON سليم.');
  }

  if (!data || !data.id || !data.c || !data.c.p || !Array.isArray(data.it)) {
    throw new Error('بيانات كود الطلب ناقصة أو لا تطابق هيكل الطلبات المعتمد.');
  }

  // Reconstruct the full domain Order object
  return {
    id: data.id,
    date: data.dt || new Date().toISOString(),
    status: 'awaiting_confirmation',
    customer: {
      name: data.c.n,
      phone: data.c.p,
      city: data.c.g,
      governorate: data.c.g,
      address: data.c.a,
      notes: data.c.nt || ''
    },
    items: data.it.map(item => ({
      id: item.i,
      sku: item.s,
      nameAr: item.n,
      type: item.t,
      size: item.sz,
      quantity: item.q,
      price: item.p,
      items: item.pi ? item.pi.map(id => ({ id })) : undefined
    })),
    subtotal: data.sub || data.tot,
    shippingCost: data.shp || 0,
    total: data.tot,
    couponCode: data.cp,
    payment: data.pm || 'عند الاستلام',
    statusHistory: [
      {
        status: 'awaiting_confirmation',
        timestamp: new Date().toISOString(),
        note: 'تم استيراد الطلب من رسالة الواتساب عبر Order Code'
      }
    ],
    source: 'whatsapp_import'
  };
}
