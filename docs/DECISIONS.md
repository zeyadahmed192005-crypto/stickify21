# STICKIFY 21 — Architecture & Technical Decisions

This document records all architectural decisions, ground-truth constraints, and implementation assumptions for the STICKIFY 21 e-commerce prototype.

---

## 1. Context & Constraints
- **Brand Identity:** STICKIFY 21 (`STICK YOUR VIBE`).
- **Core Product Lines:**
  1. Die-cut vinyl stickers (6cm Small, 8cm Medium, 10cm Large) with finishes (Holographic, Glossy, Matte).
  2. Premium cardstock bookmarks (15 × 5 cm, 350gsm, matte lamination).
  3. Custom printing orders (minimum 10 pieces, WhatsApp assisted).
- **Target Audience:** Egyptian university students, tech enthusiasts, anime fans, and book readers.
- **Language / Direction:** Egyptian Arabic, RTL (`dir="rtl"`), fonts `Readex Pro` and `Space Grotesk`.
- **Colors:** Brand Orange `#FF5000` (Hover `#E04600`), Deep Black `#0E0E10`, Base `#FAFAFA`, WhatsApp Green `#25D366`.
- **WhatsApp Contact:** `201043546503` (01043546503).

---

## 2. Architectural Decisions

### AD-01: Modular Vanilla JavaScript Architecture
- **Decision:** Do NOT migrate to heavy SPA frameworks (React/Vue/Angular). Keep lightweight, standards-compliant Vanilla JavaScript ES modules (`type="module"`).
- **Rationale:** Ensures minimal footprint, instant load times, zero runtime framework overhead, and maximum readability for future backend migration.

### AD-02: Tailwind CLI Precompiled CSS (`dist/styles.css`)
- **Decision:** Replace the runtime Tailwind CDN (`https://cdn.tailwindcss.com`) with precompiled Tailwind CSS built via Tailwind CLI to `dist/styles.css`.
- **Rationale:** Runtime CDN triggers browser console warnings, slows initial layout rendering, and cannot be used in production. Committing `dist/styles.css` ensures the repository runs locally without requiring Node.js to be installed.

### AD-03: Unified Pricing Domain (`src/domain/pricing.js`)
- **Decision:** Centralize all monetary and mathematical calculations into a single deterministic module (`pricing.js`).
- **Rules:**
  - Standard base prices: Bookmarks 25 EGP, Stickers (Small: 25 EGP, Medium: 35 EGP, Large: 50 EGP).
  - Pack discounts: 5-sticker pack = 20% discount; 10-sticker pack = 30% discount.
  - Free shipping threshold applies **after** discount (default 200 EGP).
  - All currency calculations round to the nearest whole Egyptian Pound (EGP) using standard bankers rounding / integer rounding to prevent fractional piastres.

### AD-04: Strict XSS & Safe Rendering Policy
- **Decision:** Never pass unescaped user input or raw catalog strings to `innerHTML`.
- **Implementation:**
  - `escapeHtml(string)` utility for all interpolated strings.
  - Dedicated `sanitizeSvg(svgStr)` that strips scripts, external URLs, event handlers, and malicious elements (`<script>`, `<foreignObject>`, `on*`).
  - URL validator allowing only `data:image/*`, same-origin paths, and explicit HTTPS protocol.

### AD-05: Pack Bundle Integrity as a Single Cart Line
- **Decision:** A custom sticker pack is treated in the cart as a single composite item (`type: 'pack'`) containing its constituent sticker items, selected size, total discounted pack price, and savings.
- **Rationale:** Prevents the customer from deleting individual items from a 5-pack to unfairly retain the 20% discount on loose stickers.

### AD-06: Pointer Events for Mockup Drag & Drop
- **Decision:** Replace disparate `mousedown`/`mousemove` and `touchstart`/`touchmove` with the W3C Pointer Events API (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`).
- **Performance:** Decouple DOM manipulation from the move event by batching style updates inside `requestAnimationFrame`, binding pointer capture (`setPointerCapture`), and constraining movement within the device boundaries.

### AD-07: Double-Click / `file://` Protocol Guard
- **Decision:** Include a clean fallback overlay in `index.html` that detects `window.location.protocol === 'file:'` and guides the user in Arabic and English on running `python -m http.server` or `npx serve .`.
