/**
 * STICKIFY 21 - Shared Safe File Validation, Magic-Byte Inspection & Media Processing (P0-4 / R14 / R12.3)
 * Validates actual file bytes (magic numbers), enforces upload policies, preserves PNG alpha,
 * sanitizes SVGs against XSS, and checks 300 DPI print resolution.
 */

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'dll', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'vbe', 'js', 'jse', 'mjs', 'cjs',
  'ws', 'wsf', 'wsc', 'wsh', 'ps1', 'psm1', 'sh', 'bash', 'zsh', 'html', 'htm', 'xhtml', 'mhtml',
  'php', 'phtml', 'asp', 'aspx', 'jsp', 'py', 'rb', 'pl', 'jar', 'zip', 'rar', '7z', 'tar', 'gz', 'iso', 'dmg', 'apk', 'app'
]);

export const DEFAULT_CUSTOM_UPLOAD_POLICY = {
  allowedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'tiff', 'tif', 'heic', 'svg', 'pdf', 'ai', 'eps', 'psd', 'cdr'],
  maxFileSizeMb: 15,
  maxFiles: 5,
  maxTotalSizeMb: 40
};

export const UPLOAD_POLICIES = {
  productPng: {
    name: 'product_png',
    allowedKinds: ['png'],
    allowedExtensions: ['png'],
    maxBytes: 10 * 1024 * 1024,
    requireImageDecode: true,
    errorAr: 'ارفع الصورة بصيغة PNG بخلفية شفافة',
    errorEn: 'Please upload a valid transparent PNG image.'
  },
  paymentProof: {
    name: 'payment_proof',
    allowedKinds: ['png', 'jpg', 'webp'],
    allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
    maxBytes: 5 * 1024 * 1024,
    requireImageDecode: true,
    errorAr: 'يرجى رفع صورة صالحة (PNG أو JPG أو WebP) بحد أقصى 5 ميجابايت.',
    errorEn: 'Please upload a valid image (PNG, JPG, or WebP) up to 5 MB.'
  },
  showcasePhoto: {
    name: 'showcase_photo',
    allowedKinds: ['png', 'jpg', 'webp'],
    allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
    maxBytes: 10 * 1024 * 1024,
    requireImageDecode: true,
    errorAr: 'يرجى رفع صورة صالحة لمعرض الأعمال (PNG / JPG / WebP).',
    errorEn: 'Please upload a valid showcase photo (PNG, JPG, or WebP).'
  }
};

/**
 * Sanitize filename for safe display and storage
 */
export function sanitizeFilename(rawName = 'file') {
  const base = String(rawName)
    .replace(/\\/g, '/')
    .split('/')
    .pop() || 'file';
  const cleaned = base
    .replace(/[\u0000-\u001F\u007F<>:"|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 120) || 'file';
}

/**
 * Inspect file extension(s), rejecting dangerous & double extensions (e.g., x.png.exe)
 */
export function inspectFilenameExtension(filename) {
  const clean = sanitizeFilename(filename);
  const parts = clean.toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) {
    return { ext: '', hasDangerousDoubleExt: false, isDangerous: false };
  }
  const finalExt = parts[parts.length - 1];
  const isDangerous = DANGEROUS_EXTENSIONS.has(finalExt);
  // Check any trailing or embedded dangerous extension (e.g. file.png.exe, file.html.png)
  const hasDangerousDoubleExt = parts.slice(1).some(p => DANGEROUS_EXTENSIONS.has(p));
  return { ext: finalExt, hasDangerousDoubleExt, isDangerous };
}

/**
 * Detect actual file kind from magic bytes (ArrayBuffer / Uint8Array)
 */
export function detectMagicKind(bytes, extHint = '') {
  if (!bytes || bytes.length === 0) return 'empty';
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ext = String(extHint || '').toLowerCase();

  // Hard-reject executables & archives
  if (b.length >= 2 && b[0] === 0x4D && b[1] === 0x5A) return 'executable_mz'; // MZ (.exe/.dll)
  if (b.length >= 4 && b[0] === 0x7F && b[1] === 0x45 && b[2] === 0x4C && b[3] === 0x46) return 'executable_elf';
  if (b.length >= 2 && b[0] === 0x23 && b[1] === 0x21) return 'script_shebang'; // #!
  if (b.length >= 4 && (
    (b[0] === 0xFE && b[1] === 0xED && b[2] === 0xFA && (b[3] === 0xCE || b[3] === 0xCF)) ||
    (b[0] === 0xCF && b[1] === 0xFA && b[2] === 0xED && b[3] === 0xFE)
  )) return 'executable_macho';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
      b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) {
    return 'jpg';
  }

  // RIFF container: WEBP or CDR
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
    const fourcc = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (fourcc === 'WEBP') return 'webp';
    if (fourcc.startsWith('CDR')) return 'cdr';
  }

  // GIF: GIF87a or GIF89a
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) {
    return 'gif';
  }

  // BMP: BM
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4D) {
    return 'bmp';
  }

  // TIFF: II*\0 or MM\0*
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2A && b[3] === 0x00) || (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x00 && b[3] === 0x2A))) {
    return 'tiff';
  }

  // PSD: 8BPS
  if (b.length >= 4 && b[0] === 0x38 && b[1] === 0x42 && b[2] === 0x50 && b[3] === 0x53) {
    return 'psd';
  }

  // ISO BMFF (AVIF / HEIC): offset 4 === 'ftyp'
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1' || brand === 'hevc') return 'heic';
  }

  // PDF: %PDF- (modern .ai files also start with %PDF-)
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2D) {
    return ext === 'ai' ? 'ai' : 'pdf';
  }

  // PostScript / EPS / AI: %!PS-Adobe or binary DOS EPS C5 D0 D3 C6
  if (b.length >= 4 && b[0] === 0xC5 && b[1] === 0xD0 && b[2] === 0xD3 && b[3] === 0xC6) {
    return ext === 'ai' ? 'ai' : 'eps';
  }

  // Text-based inspection for HTML / SVG / PS
  const headText = new TextDecoder('utf-8', { fatal: false }).decode(b.slice(0, 512)).trimStart();
  const lowerHead = headText.toLowerCase();

  if (lowerHead.startsWith('<!doctype html') || lowerHead.startsWith('<html') || lowerHead.startsWith('<script')) {
    return 'html';
  }
  if (headText.startsWith('%!PS-Adobe') || headText.startsWith('%!PS')) {
    return ext === 'ai' ? 'ai' : 'eps';
  }
  if (lowerHead.includes('<svg') && (lowerHead.startsWith('<svg') || lowerHead.startsWith('<?xml') || lowerHead.startsWith('<!--'))) {
    return 'svg';
  }

  // ZIP container: reject unless explicitly .cdr (CorelDRAW X4+ uses ZIP container)
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04) {
    return ext === 'cdr' ? 'cdr' : 'zip';
  }

  return 'unknown';
}

/**
 * Read File bytes as ArrayBuffer
 */
export function readFileAsArrayBuffer(file) {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Compute SHA-256 hex digest of an ArrayBuffer/Uint8Array
 */
export async function sha256Hex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback fingerprint if subtle crypto unavailable
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return ('fallback-' + (h >>> 0).toString(16).padStart(8, '0'));
}

/**
 * Sanitize an uploaded SVG string against XSS (strips scripts, event handlers, foreignObject, unsafe URLs)
 */
export function sanitizeUploadedSvg(rawSvg) {
  if (!rawSvg || typeof rawSvg !== 'string') return '';
  let clean = rawSvg
    // Remove script, foreignObject, iframe, object, embed, link, meta, style with javascript
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(iframe|object|embed|applet|meta|link|base)[\s\S]*?(\/>|<\/\1>)/gi, '')
    // Remove inline on* event handlers (double, single, or unquoted)
    .replace(/\s+on[a-z0-9_-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript:, vbscript:, data:text/html in href/xlink:href/src
    .replace(/(href|xlink:href|src)\s*=\s*["']\s*(javascript:|vbscript:|data:text\/html)[^"']*["']/gi, '$1=""')
    // Remove external http(s) <use> references
    .replace(/<use[^>]+(?:href|xlink:href)\s*=\s*["']https?:\/\/[^"']*["'][^>]*\/?>/gi, '');

  // If DOMParser is available in browser, do a strict second-pass DOM walk
  if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) return '';
      const forbiddenTags = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'applet']);
      const allEls = Array.from(svgEl.querySelectorAll('*'));
      for (const el of allEls) {
        if (forbiddenTags.has(el.tagName.toLowerCase())) {
          el.remove();
          continue;
        }
        for (const attr of Array.from(el.attributes)) {
          const n = attr.name.toLowerCase();
          const v = (attr.value || '').trim().toLowerCase();
          if (n.startsWith('on')) {
            el.removeAttribute(attr.name);
          } else if ((n === 'href' || n === 'xlink:href' || n === 'src') && (v.startsWith('javascript:') || v.startsWith('vbscript:') || v.startsWith('data:text/html') || (el.tagName.toLowerCase() === 'use' && /^https?:\/\//.test(v)))) {
            el.removeAttribute(attr.name);
          }
        }
      }
      // Also strip on* on root <svg>
      for (const attr of Array.from(svgEl.attributes)) {
        if (attr.name.toLowerCase().startsWith('on')) {
          svgEl.removeAttribute(attr.name);
        }
      }
      clean = new XMLSerializer().serializeToString(svgEl);
    } catch (e) {
      // keep regex-sanitized string
    }
  }
  return clean;
}

/**
 * Decode an image Blob/File to verify it's a valid browser-decodable image and obtain width/height
 */
export function decodeImageDimensions(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const dims = { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
      URL.revokeObjectURL(url);
      if (dims.width > 0 && dims.height > 0) resolve(dims);
      else reject(new Error('Image has zero dimensions'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode failed'));
    };
    img.src = url;
  });
}

/**
 * Check whether a PNG has any transparent pixels (alpha < 250)
 */
export function detectPngAlpha(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      // Sample on max 512px canvas for fast alpha detection
      const scale = Math.min(1, 512 / Math.max(w, h, 1));
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      const data = ctx.getImageData(0, 0, cw, ch).data;
      let hasAlpha = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 250) {
          hasAlpha = true;
          break;
        }
      }
      resolve({ hasAlpha, width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PNG decode failed'));
    };
    img.src = url;
  });
}

/**
 * Resize PNG keeping alpha transparency intact, outputting lossless image/png + 256px image/png thumbnail
 */
export function resizePngKeepingAlpha(file, maxDimension = 1200, thumbDimension = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      const renderToPng = (maxDim) => new Promise((res, rej) => {
        let w = origW;
        let h = origH;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.max(1, Math.round((h * maxDim) / w));
            w = maxDim;
          } else {
            w = Math.max(1, Math.round((w * maxDim) / h));
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png');
        canvas.toBlob((blob) => {
          if (blob) res({ blob, dataUrl, width: w, height: h });
          else rej(new Error('PNG canvas export failed'));
        }, 'image/png');
      });

      Promise.all([renderToPng(maxDimension), renderToPng(thumbDimension)])
        .then(([main, thumb]) => resolve({ main, thumb, origWidth: origW, origHeight: origH }))
        .catch(reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PNG image load failed'));
    };
    img.src = url;
  });
}

/**
 * Check print resolution against 300 DPI for a given sticker size in cm
 */
export function checkPrintDpi(widthPx, heightPx, sizeKey = '8cm') {
  const cmMap = { '6cm': 6, '8cm': 8, '10cm': 10, 'custom': 8 };
  const cm = cmMap[sizeKey] || 8;
  const inches = cm / 2.54;
  const minRequiredPx = Math.round(inches * 300); // ~945px for 8cm
  const maxSide = Math.max(widthPx || 0, heightPx || 0);
  const dpi = Math.round(maxSide / inches);
  return {
    cm,
    dpi,
    minRequiredPx,
    isLowRes: maxSide > 0 && maxSide < minRequiredPx
  };
}

/**
 * Shared File Validation Engine
 * @param {File} file
 * @param {Object} policy - { allowedKinds?, allowedExtensions?, maxBytes, requireImageDecode?, errorAr?, errorEn? }
 * @param {string} lang - 'ar' | 'en'
 */
export async function validateFile(file, policy, lang = 'ar') {
  const isAr = lang === 'ar';
  if (!file) {
    return { valid: false, reason: isAr ? 'لم يتم اختيار أي ملف' : 'No file selected' };
  }

  const cleanName = sanitizeFilename(file.name);
  const { ext, hasDangerousDoubleExt, isDangerous } = inspectFilenameExtension(cleanName);

  // 1. Reject dangerous extensions / double extensions immediately
  if (isDangerous || hasDangerousDoubleExt) {
    return {
      valid: false,
      reason: isAr
        ? `نوع الملف "${cleanName}" غير مسموح لأسباب أمنية.`
        : `File "${cleanName}" is blocked for security reasons.`
    };
  }

  // 2. Reject 0-byte files
  if (file.size === 0) {
    return {
      valid: false,
      reason: isAr
        ? `الملف "${cleanName}" فارغ (0 بايت).`
        : `File "${cleanName}" is empty (0 bytes).`
    };
  }

  // 3. Enforce max file size
  const maxBytes = policy.maxBytes || (15 * 1024 * 1024);
  if (file.size > maxBytes) {
    const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    return {
      valid: false,
      reason: isAr
        ? `حجم الملف "${cleanName}" يتجاوز الحد المسموح (${maxMb} ميجابايت).`
        : `File "${cleanName}" exceeds the maximum allowed size (${maxMb} MB).`
    };
  }

  // 4. Enforce extension allowlist if provided
  if (Array.isArray(policy.allowedExtensions) && policy.allowedExtensions.length > 0) {
    if (!ext || !policy.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        reason: isAr
          ? (policy.errorAr || `امتداد الملف (.${ext || '?'}) غير مدعوم.`)
          : (policy.errorEn || `File extension (.${ext || '?'}) is not supported.`)
      };
    }
  }

  // 5. Inspect magic bytes
  const buffer = await readFileAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  const detectedKind = detectMagicKind(bytes, ext);

  // Hard reject disguised executables / scripts / HTML / ZIP
  if (['empty', 'executable_mz', 'executable_elf', 'executable_macho', 'script_shebang', 'html', 'zip', 'unknown'].includes(detectedKind)) {
    return {
      valid: false,
      reason: isAr
        ? (policy.errorAr || `محتوى الملف "${cleanName}" غير صالح أو لا يطابق صيغة مدعومة.`)
        : (policy.errorEn || `File "${cleanName}" has invalid or unsupported file content.`)
    };
  }

  // Normalize jpeg -> jpg for matching
  const normalizedExt = ext === 'jpeg' ? 'jpg' : (ext === 'tif' ? 'tiff' : ext);
  const allowedKinds = policy.allowedKinds || (policy.allowedExtensions || []).map(e => (e === 'jpeg' ? 'jpg' : (e === 'tif' ? 'tiff' : e)));

  if (!allowedKinds.includes(detectedKind)) {
    return {
      valid: false,
      reason: isAr
        ? (policy.errorAr || `صيغة الملف الفعلية (${detectedKind.toUpperCase()}) غير مسموحة.`)
        : (policy.errorEn || `Actual file format (${detectedKind.toUpperCase()}) is not permitted.`)
    };
  }

  // Strict PNG-only mismatch check
  if (policy.name === 'product_png' && detectedKind !== 'png') {
    return {
      valid: false,
      reason: isAr ? policy.errorAr : policy.errorEn
    };
  }

  // For raster web images, verify real decode if required
  let dimensions = null;
  const webRasterKinds = new Set(['png', 'jpg', 'webp', 'gif', 'bmp']);
  if (policy.requireImageDecode && webRasterKinds.has(detectedKind)) {
    try {
      dimensions = await decodeImageDimensions(file);
    } catch (err) {
      return {
        valid: false,
        reason: isAr
          ? (policy.errorAr || `تعذر قراءة الصورة "${cleanName}" — الملف تالف أو غير صالح.`)
          : (policy.errorEn || `Could not decode image "${cleanName}" — file may be corrupted.`)
      };
    }
  } else if (webRasterKinds.has(detectedKind)) {
    try {
      dimensions = await decodeImageDimensions(file);
    } catch (e) {
      dimensions = null;
    }
  }

  // Check SVG sanitization
  let sanitizedSvgText = null;
  if (detectedKind === 'svg') {
    const rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    sanitizedSvgText = sanitizeUploadedSvg(rawText);
    if (!sanitizedSvgText || !sanitizedSvgText.toLowerCase().includes('<svg')) {
      return {
        valid: false,
        reason: isAr ? 'ملف SVG غير صالح أو فارغ بعد التنظيف الأمني.' : 'SVG file is invalid or empty after sanitization.'
      };
    }
  }

  const sha256 = await sha256Hex(buffer);

  return {
    valid: true,
    cleanName,
    ext: normalizedExt,
    kind: detectedKind,
    size: file.size,
    dimensions,
    sha256,
    buffer,
    sanitizedSvgText
  };
}
