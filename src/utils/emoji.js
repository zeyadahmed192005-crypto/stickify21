/**
 * STICKIFY 21 - Emoji & Decorative Glyphs Sanitizer
 * Strips all Unicode emojis, decorative pictographs, and AI-like sparkles.
 */

// Regex covering ALL Unicode Extended Pictographics, variation selectors, ZWJ, flags & emoji blocks
export const EMOJI_REGEX = /(?:\p{Extended_Pictographic}|[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}])/gu;

// Decorative symbols often pasted as emojis (stars, sparkles, arrows used decoratively)
export const DECORATIVE_GLYPHS_REGEX = /[✨★☆✦✧✓✕✖]/g;

/**
 * Strips all emojis and decorative symbols from a string.
 * Cleans up double spaces left behind by stripped characters.
 * @param {string} str
 * @returns {string}
 */
export function stripEmoji(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(EMOJI_REGEX, '')
    .replace(DECORATIVE_GLYPHS_REGEX, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Attach globally for window access
if (typeof window !== 'undefined') {
  window.stripEmoji = stripEmoji;
}
