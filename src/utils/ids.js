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
  // Support both composite lines[] (R1) and legacy items[]
  const lines = order.lines || (order.items ? order.items.map(it => {
    if (it.type === 'pack') {
      return {
        type: 'pack',
        size: it.size || (it.items ? it.items.length : 5),
        discountRate: it.discountRate || (it.size === 10 ? 0.3 : 0.2),
        packPrice: it.price || it.packPrice || 0,
        items: (it.items || []).map(p => ({
          sku: p.sku || 'S21',
          name: p.name || p.nameAr || '',
          sizeKey: p.sizeKey || 'medium',
          finish: p.finish || 'matte',
          unitPrice: p.unitPrice || p.price || 35,
          image: p.image || ''
        }))
      };
    }
    return {
      type: it.type === 'bookmark' ? 'bookmark' : 'single',
      sku: it.sku || 'S21',
      name: it.name || it.nameAr || '',
      sizeKey: it.sizeKey || 'medium',
      finish: it.finish || 'matte',
      unitPrice: it.price || 35,
      quantity: it.quantity || 1,
      total: (it.price || 35) * (it.quantity || 1),
      image: it.image || ''
    };
  }) : []);

  const compactLines = lines.map(l => {
    if (l.type === 'pack') {
      return {
        t: 'pack',
        sz: l.size || 5,
        dr: l.discountRate || 0.2,
        pp: l.packPrice || 0,
        it: (l.items || []).map(sub => ({
          s: sub.sku || 'S21',
          n: sub.name || '',
          sk: sub.sizeKey || 'medium',
          f: sub.finish || 'matte',
          up: sub.unitPrice || 35,
          im: sub.image || ''
        }))
      };
    }
    return {
      t: l.type || 'single',
      s: l.sku || 'S21',
      n: l.name || '',
      sk: l.sizeKey || 'medium',
      f: l.finish || 'matte',
      up: l.unitPrice || 35,
      q: l.quantity || 1,
      tot: l.total || (l.unitPrice * (l.quantity || 1)),
      im: l.image || ''
    };
  });

  const compactPayload = {
    v: 2, // schema version 2 (R1 lines composite structure)
    id: order.id,
    dt: order.date || new Date().toISOString(),
    c: {
      n: order.customer.name,
      p: order.customer.phone,
      g: order.customer.city || order.customer.governorate,
      a: order.customer.address,
      nt: order.customer.notes || ''
    },
    ln: compactLines,
    it: (order.items || []).map(item => ({
      i: item.id || item.productId,
      s: item.sku || 'S21',
      n: item.nameAr || item.name,
      t: item.type || 'single',
      sz: item.size || '8 سم',
      q: item.quantity || item.qty || 1,
      p: item.price || 0,
      pi: item.items ? item.items.map(sub => sub.id) : undefined
    })),
    sub: order.subtotal || order.total,
    shp: order.shippingCost || 0,
    tot: order.total,
    cp: order.couponCode || null,
    pm: order.payment || 'عند الاستلام',
    cr: order.courier || null,
    tr: order.trackingNumber || null
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
    const match = afterPrefix.match(/^([A-Za-z0-9_-]+)/);
    if (match) {
      codeStr = match[1];
    }
  } else {
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

  if (!data || !data.id || !data.c || !data.c.p || (!Array.isArray(data.ln) && !Array.isArray(data.it))) {
    throw new Error('بيانات كود الطلب ناقصة أو لا تطابق هيكل الطلبات المعتمد.');
  }

  // Reconstruct lines from ln or fallback to it
  let reconstructedLines = [];
  if (Array.isArray(data.ln)) {
    reconstructedLines = data.ln.map(l => {
      if (l.t === 'pack') {
        return {
          type: 'pack',
          size: l.sz || 5,
          discountRate: l.dr || 0.2,
          packPrice: l.pp || 0,
          items: (l.it || []).map(sub => ({
            sku: sub.s || 'S21',
            name: sub.n || '',
            sizeKey: sub.sk || 'medium',
            finish: sub.f || 'matte',
            unitPrice: sub.up || 35,
            image: sub.im || ''
          }))
        };
      }
      return {
        type: l.t || 'single',
        sku: l.s || 'S21',
        name: l.n || '',
        sizeKey: l.sk || 'medium',
        finish: l.f || 'matte',
        unitPrice: l.up || 35,
        quantity: l.q || 1,
        total: l.tot || (l.up * l.q),
        image: l.im || ''
      };
    });
  } else if (Array.isArray(data.it)) {
    reconstructedLines = data.it.map(item => ({
      type: item.t || 'single',
      sku: item.s || 'S21',
      name: item.n,
      sizeKey: 'medium',
      finish: 'matte',
      unitPrice: item.p,
      quantity: item.q || 1,
      total: (item.p || 0) * (item.q || 1),
      image: ''
    }));
  }

  // Reconstruct flat items for backward compatibility
  const flatItems = (data.it && data.it.length > 0) ? data.it.map(item => ({
    id: item.i,
    sku: item.s,
    nameAr: item.n,
    name: item.n,
    type: item.t,
    size: item.sz,
    quantity: item.q,
    price: item.p,
    items: item.pi ? item.pi.map(id => ({ id })) : undefined
  })) : reconstructedLines.map(l => ({
    sku: l.sku || (l.type === 'pack' ? `PACK-${l.size}` : 'S21'),
    nameAr: l.name || (l.type === 'pack' ? `باقة ${l.size} استيكرات` : 'استيكر'),
    name: l.name,
    type: l.type,
    size: l.sizeKey || '8 سم',
    quantity: l.quantity || 1,
    price: l.packPrice || l.unitPrice,
    items: l.items
  }));

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
    lines: reconstructedLines,
    items: flatItems,
    subtotal: data.sub || data.tot,
    shippingCost: data.shp || 0,
    total: data.tot,
    couponCode: data.cp,
    payment: data.pm || 'عند الاستلام',
    courier: data.cr || null,
    trackingNumber: data.tr || null,
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
