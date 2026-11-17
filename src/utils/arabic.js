// STICKIFY 21 - Arabic Text Normalization Utility
// Handles Arabic orthographic variants (alef variants, teh marbuta, alef maqsura) and strips diacritics/tashkeel

export function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic tashkeel / harakat / dagger alef
    .replace(/[أإآ]/g, 'ا')               // normalize alef with hamza to bare alef
    .replace(/ة/g, 'ه')                   // normalize teh marbuta to heh for fuzzy search
    .replace(/ى/g, 'ي')                   // normalize alef maqsura to yeh
    .replace(/ؤ/g, 'و')                   // normalize waw with hamza
    .replace(/ئ/g, 'ي')                   // normalize yeh with hamza
    .toLowerCase()
    .trim();
}
