/**
 * STICKIFY 21 - XSS Sanitization & Safe Encoding Utilities
 */

/**
 * Escapes HTML entities to prevent Cross-Site Scripting (XSS).
 * @param {string|number|null|undefined} str
 * @returns {string} Safe HTML string
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes URLs to permit only safe schemes (data:image/*, relative paths, https://).
 * Prevents javascript: or data:text/html vectors.
 * @param {string} url
 * @returns {string} Safe URL or empty string if invalid
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  
  // Safe relative paths or asset names
  if (/^[a-zA-Z0-9_\-\./]+\.(jpg|jpeg|png|webp|svg|gif)$/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed;
  }
  
  // Safe explicit data URIs for images only
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(trimmed)) {
    return trimmed;
  }

  // Safe external HTTPS URLs
  if (/^https:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/i.test(trimmed)) {
    return trimmed;
  }

  return '';
}

/**
 * Sanitizes SVG markup to neutralize inline scripts, event handlers, and foreign objects.
 * @param {string} svgStr
 * @returns {string} Safe SVG string
 */
export function sanitizeSvg(svgStr) {
  if (!svgStr || typeof svgStr !== 'string') return '';
  const trimmed = svgStr.trim();
  if (!trimmed.startsWith('<svg') || !trimmed.endsWith('</svg>')) {
    return escapeHtml(trimmed);
  }

  // Strip dangerous tags and attributes
  let cleaned = trimmed
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<foreignobject\b[^<]*(?:(?!<\/foreignobject>)<[^<]*)*<\/foreignobject>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '') // on* attributes
    .replace(/href\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi, '')
    .replace(/xlink:href\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi, '');

  return cleaned;
}
