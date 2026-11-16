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

### AD-08: Data Layer Abstraction & Storage Architecture (`src/data/storage.js`)
- **Decision:** Provide a unified asynchronous storage service interface (`StorageService`) backed by `LocalAdapter` with a documented `RemoteAdapter` REST stub for future migration.
- **Rules:**
  - Structured data (catalog, orders, coupons, settings) resides in `localStorage`.
  - Binary image uploads (product images, custom print artwork) reside in `IndexedDB` (`stickify21_db`, store `images`) with client-side WebP compression (max 1000px, quality 0.85).
  - All storage keys carry `schemaVersion: '1.0.0'`. Corrupted JSON is safely backed up to `*_corrupt_<timestamp>` and replaced with a clean fallback.
  - Initial seed data is populated only on first run.

### AD-09: Order Lifecycle & State Machine (`src/domain/orders.js`)
- **Decision:** Enforce a strict state transition matrix with an audit log (`statusHistory`).
- **States:** `pending` (جديد) -> `awaiting_confirmation` (بانتظار التأكيد) -> `confirmed` (مؤكد) -> `preparing` (قيد التجهيز) -> `shipped` (تم الشحن) -> `completed` (مكتمل); plus `cancelled` (ملغي) from non-final states. Invalid jumps (e.g., `pending` directly to `shipped`) are rejected.
- **IDs:** Unique, non-guessable IDs generated via Web Crypto API: `S21-YYMMDD-XXXX`.

### AD-10: WhatsApp Order Bridge & Order Code (`src/utils/ids.js`)
- **Decision:** Bridge the browser-local prototype gap by encoding the order payload into a compact base64url "Order Code" (`S21CODE:<base64url>`) appended to the WhatsApp order message.
- **Admin Import:** The admin dashboard features an "استيراد طلب من واتساب" tool that pastes the message, decodes the Order Code, validates its structure, and saves the order locally.
- **Notice:** Clearly labeled in code and UI as a DEMO bridge; Base64 is encoding, not cryptographic security.

### AD-11: Admin Access Security with Web Crypto PBKDF2 (`src/domain/auth.js`)
- **Decision:** Secure the prototype admin panel with salted PBKDF2 hashing (100,000 iterations of SHA-256) via the native Web Crypto API.
- **Rules:**
  - Default initial PIN is `2121`.
  - Rate limiting: 5 failed attempts trigger a 15-minute lockout.
  - Session management: Inactive sessions timeout automatically after 30 minutes.
  - Reset procedure: Clearing the `stickify21_admin_passcode_hash` key from localStorage restores the default PIN.

### AD-12: Egyptian Commerce Domain Validation (`src/domain/validation.js`)
- **Decision:** Enforce Egyptian market rules for all customer submissions:
  - Phone numbers: Egyptian mobile prefixes (`010`, `011`, `012`, `015`), accepts `+20` and `0020`, normalized to standard 11-digit `01xxxxxxxxx`.
  - Governorates: Validated against the 27 official Egyptian governorates with specific shipping tiers.
  - Coupons: Percentage or fixed discounts, minimum subtotal, expiration date, usage limits, and category restrictions, returning Arabic error messages upon failure.

### AD-13: URL Hash Routing Architecture (`#/product/:id`, `#/track`, `#/track/:id`)
- **Decision:** Implement client-side routing using the URL hash (`window.location.hash`).
- **Supported Routes:**
  - `#/product/:id`: Opens the full product modal with size/finish selection, quantity controls, and related products carousel.
  - `#/track`: Opens the self-service order tracking dialog with an Egyptian order ID / mobile search form.
  - `#/track/:id`: Directly loads and displays the 6-state order progress timeline for the specified order ID.
  - `#/custom-print`: Smoothly scrolls to the interactive Custom Print Studio.
- **Rationale:** Works seamlessly on static local file servers (`python -m http.server`, `npx serve`) without requiring server-side URL rewrite configuration (HTML5 pushState would 404 on page reload).

### AD-14: Custom Print Studio Tiered Volume Pricing (`src/domain/pricing.js`)
- **Decision:** Provide transparent, automated tiered pricing for custom business/club printing:
  - 10–49 pieces: 20 EGP / piece
  - 50–99 pieces: 15 EGP / piece
  - 100+ pieces: 10 EGP / piece
  - Finish surcharges: Holographic adds +5 EGP / piece; Large (10cm) adds +10 EGP / piece.
- **File Handling:** Supports client-side preview of PNG, JPG, and PDF vector artwork with client-side drag-and-drop and size limits (10MB max). Direct WhatsApp order routing formats the complete order specification.

### AD-15: Multi-Payment Options & Egyptian Mobile Wallets
- **Decision:** Offer three standard Egyptian payment methods at checkout:
  1. Cash on Delivery (`cod` - الدفع عند الاستلام)
  2. InstaPay (`instapay` - تحويل فوري عبر إنستاباي إلى المعرّف `stickify21@instapay`)
  3. Vodafone Cash (`vodafone_cash` - تحويل عبر محفظة فودافون كاش إلى الرقم `01043546503`)
- **Implementation:** Detailed payment and transfer instructions display dynamically in `#payment-method-details`. Payment method selection is recorded on the order object and formatted into the WhatsApp order message.

### AD-16: Neutral Photorealistic Mockup Surfaces
- **Decision:** Ensure all Mockup Studio surfaces (Laptop, Phone, Notebook, Water Bottle, Car Window) avoid trademarked logos (e.g. no Apple logo, no ThinkPad logo).
- **Realistic Car Window:** Implemented with realistic automotive weatherstripping, defroster filament lines, tinted glass reflection, and tempered glass stamp (`TEMPERED GLASS • S21`).
