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

### AD-17: Admin Dashboard KPI Analytics & Conversion Estimation
- **Decision:** Surface 5 real-time operational metric cards at the top of the admin dashboard:
  1. Total Sales (EGP): Sum of all non-cancelled orders.
  2. Total Orders: Count of all recorded customer orders.
  3. Awaiting Confirmation: Urgent count of new orders needing merchant review.
  4. Shipped Orders: Orders currently in transit with logistics.
  5. Conversion Rate Estimate: Computed from completed checkouts relative to recorded cart-creation events (`stickify21_cart_creations`), providing merchants with visibility into funnel efficiency without third-party tracking cookies.

### AD-18: Orders Bulk Operations & UTF-8 BOM CSV Export
- **Decision:** Support merchant bulk workflow with multi-selection checkboxes:
  - Bulk status updates ("تأكيد المحدد", "شحن المحدد") validating each transition through `isValidStatusTransition()` and logging audit entries.
  - CSV Export: Prepended with UTF-8 Byte Order Mark (`\uFEFF`) to guarantee immediate native rendering of Arabic typography and Egyptian addresses in Microsoft Excel on Windows without manual encoding imports.
  - Test Harness Guard: Uses `navigator.webdriver` check to prevent browser download locks in automated Playwright test execution while saving `window.__lastExportedCsv` for content verification.

### AD-19: Batch Packing Slip Printing Architecture
- **Decision:** Extend `packing-slip.html` to support both single order view (`?id=S21-XXX` or `?o=BASE64`) and multi-order batch printing (`?ids=id1,id2,id3`).
- **Print Formatting:** Each order rendered in batch mode includes a `.packing-slip-sheet` wrapper with CSS `page-break-after: always` and `@media print` rules, enabling merchants to print 10–50 order slips in a single printer job.
- **Visual Checklist:** Interactive client-side packing progress bar with drawer/shelf SKU tags and item thumbnails ensures zero warehouse packing mistakes.

### AD-20: Dynamic Store Settings & 27-Governorate Shipping Configuration
- **Decision:** Provide complete merchant control over store operations through Tab 5 (الإعدادات والنسخ):
  - General store parameters: WhatsApp support number, free shipping subtotal threshold, and default shipping fee.
  - 27 Egyptian Governorates Grid: Granular per-governorate shipping fee inputs with live persistence to `localStorage.stickify21_settings`.
  - Dynamic Sync: Storefront pricing calculator (`calculateCart()` in `src/domain/pricing.js`) dynamically merges merchant overrides with default config rates so shipping changes take effect immediately at checkout.
  - Disaster Recovery: Complete JSON backup export and validated JSON import with pre-import snapshot and confirmation prompt, plus a destructive "Reset Demo Data" action guarded by requiring the admin to type `"RESET"`.

### AD-21: Comprehensive Search Engine Optimization, OpenGraph & Dynamic Product JSON-LD Schema
- **Decision:** Optimize `index.html` for Egyptian and regional search engines and social sharing platforms:
  - Meta tags: Arabic title and description targeting university students, book lovers, and laptop sticker enthusiasts in Egypt; canonical URL pointing to `https://stickify21.com/`; mobile theme color `#FF5000`.
  - OpenGraph / Twitter Cards: Rich snippet previews configured with `og:image`, `og:locale="ar_EG"`, and `summary_large_image` using high-resolution brand assets.
  - Static JSON-LD: Semantic `Organization` and `WebSite` schemas providing brand identity, contact point, and search action metadata.
  - Dynamic JSON-LD: The storefront generates a compliant Schema.org `ItemList` containing individual `Product` entries (with SKU, offers in EGP, inStock state, and deep link URL) at runtime based on active catalog data, enabling Google Rich Snippets for e-commerce product listings.

### AD-22: Search Engine Crawler Directives (`robots.txt`, `sitemap.xml`, and noindex protections)
- **Decision:** Establish clear boundaries for web crawlers:
  - `robots.txt`: Explicitly blocks search engines from crawling administrative and internal packing interfaces (`Disallow: /admin.html`, `Disallow: /packing-slip.html`), while declaring the location of `sitemap.xml`.
  - `sitemap.xml`: Declares canonical routes (`/`, `#/custom-print`, `#/track`) with update frequencies and priorities.
  - Noindex Defense: Both `admin.html` and `packing-slip.html` include `<meta name="robots" content="noindex, nofollow">` to prevent accidental indexing of customer packing lists or admin login panels.

### AD-23: Interactive Legal, Trust, and Operational Policy Modals
- **Decision:** Present essential e-commerce policies (About Us, Shipping & Returns, Terms & Conditions, Privacy Policy, Customer Support) through a unified accessible modal (`#policy-modal`) with deep linking support:
  - Tabs Navigation: Instant switching between policy sections without page reloads or layout shift.
  - Hash Routing: Direct URLs such as `#/terms`, `#/privacy`, `#/shipping-returns`, `#/about`, and `#/contact` automatically open the policy dialog with the requested section pre-selected.
  - Legal Disclaimer Banner: Prominently identifies terms and shipping rules as an illustrative draft ("مسودة استرشادية") requiring final legal endorsement prior to official commercial launch.

### AD-24: Privacy-Preserving Analytics Dispatcher Hooks (GA4 & Meta Pixel Stubs)
- **Decision:** Centralize event tracking in `src/utils/analytics.js` (`AnalyticsService`):
  - Supported Hooks: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, and custom events.
  - Privacy First: External analytics scripts are only injected when valid IDs (`CONFIG.ANALYTICS.GA4_ID`, `CONFIG.ANALYTICS.META_PIXEL_ID`) are explicitly configured.
  - Safe Local Development: In prototype mode, events are safely output to `console.debug` for debugging and test verification without throwing errors or transmitting tracking cookies.

### AD-25: End-to-End Test Suite, Comprehensive Regression Automation & Migration Handover
- **Decision:** Validate the entire system end-to-end using Playwright with 34 deterministic integration tests partitioned across all 6 phases:
  - Phase 1: Zero console errors on clean boot, sticker sizes & pricing, pack bundle integrity, pointer events drag bounds, coupon configuration, XSS sanitization.
  - Phase 2: Schema initialization, 6-state order lifecycle with valid/invalid transitions, PBKDF2 Web Crypto passcode authentication, Base64url Order Code WhatsApp export/import, IndexedDB asset storage.
  - Phase 3: Custom Print Studio tiered volume pricing, deep-linkable product modals (`#/product/:id`), deep-linkable order tracking (`#/track/:id`), multi-payment checkout (COD, InstaPay, Vodafone Cash), neutral car window mockup layer.
  - Phase 4: Admin KPI cards, orders filter and bulk state changes, UTF-8 BOM CSV export for Excel, product catalog CRUD with auto-SKU, settings management (27-governorate shipping rates, backup/restore, reset demo data), batch packing slip multi-page printing.
  - Phase 5: SEO meta tags, OpenGraph previews, crawler directives (`robots.txt`, `sitemap.xml`, `noindex`), dynamic Schema.org JSON-LD catalog, legal policy modals (`#/terms`, `#/privacy`), analytics dispatcher.
  - Phase 6: Full-lifecycle integration scenarios (IndexedDB WebP compression <= 1000px, complete customer purchase flow, complete admin management flow, self-service tracking, resilient error recovery from corrupted JSON).
- **Execution Protocol:** Tests run against a lightweight local Python HTTP server without external network dependencies, ensuring 100% reproducible offline CI/CD execution.

---

## 3. Round 2 Architectural Decisions

### AD-26: Composite Order Lines Structure & Backward Compatibility Adapter (R1)
- **Decision:** Shift from a flat order item array to structured `lines[]` distinguishing `single`, `bookmark`, and `pack` types.
- **Pack Line Format:**
  `{ type: 'pack', size: 5|10, discountRate: 0.2|0.3, items: [{ sku, name, sizeKey, finish, unitPrice, image }], packPrice: number }`
- **Compatibility Adapter (`normalizeOrderLines`):** Old flat orders lacking `lines[]` automatically convert on the fly without database mutation or data loss, grouping any pack items into valid composite lines.
- **Surface Coverage:** Sub-items with SKU, name, size, and finish are visible across:
  1. Cart drawer
  2. Detailed checkout summary
  3. WhatsApp order message (numbered sub-list under pack header)
  4. Base64url Order Code version 2 (`S21CODE:v2:...`)
  5. Admin orders list (expandable pack dropdown)
  6. Admin order details drawer
  7. Single-page packing slip

### AD-27: Seven-State Order Lifecycle with Intermediate Staging (`ready` / تم التجهيز) & 10s Undo (R2)
- **Decision:** Insert state `ready` ("تم التجهيز") between `preparing` ("قيد التجهيز") and `shipped` ("تم الشحن").
- **Canonical Flow:**
  `pending` / `awaiting_confirmation` -> `confirmed` -> `preparing` -> `ready` -> `shipped` -> `completed` (+ `cancelled`).
- **Quick Action Primary Button:** Admin orders list rows and details drawer present a single context-sensitive next-action button with color-coded styling.
- **10-Second Undo Toast:** Transitioning states triggers a fixed countdown toast allowing instant rollback in case of accidental click.
- **Shipping Dispatch Modal (A3):** Transitioning to `shipped` prompts for courier selection (`بوسطة`, `أرامكس`, `مندوب خاص`, custom) and optional tracking number, generating a prefilled customer WhatsApp shipping notification link.

### AD-28: Cross-Tab Admin Authentication with 12h Sliding Expiry & BroadcastChannel (R11)
- **Decision:** Migrate active admin session from `sessionStorage` to `localStorage` (`stickify21_admin_session`) with a 12-hour sliding expiry window.
- **Cross-Tab Synchronization:**
  - Logging out in any tab broadcasts a `logout` event via `BroadcastChannel('stickify21_auth_channel')` and `window.onstorage`, immediately locking all open admin and packing slip tabs.
  - Active admin tabs automatically refresh the session sliding expiry on user interaction.
- **Passcode Management:** Settings tab provides an in-place "Change Passcode" form requiring current PIN verification and setting new PBKDF2 hash & salt.

### AD-29: Single-Page First Packing Slip & Auto-Compaction Rules (R13)
- **Decision:** Guarantee that packing slips strictly fit on ONE A4 page (`@page { size: A4 portrait; margin: 8mm }`) to prevent paper wastage in warehouse packing.
- **Dynamic Compaction Thresholds:**
  - Standard mode: <= 6 items (normal typography 11-12px, comfortable padding).
  - Compact mode: 7 to 14 items (reduced padding, 10px typography, tighter grid).
  - Ultra-compact mode: > 14 items (2-column dense grid, 8.5px typography, max-height 140mm container).
- **View Modes:** Interactive selector toggles between `A4 صفحة واحدة`, `A5 نصف صفحة`, and `🏷️ بوليصة شحن` (shipping label sticker format).

### AD-30: Order Confirmation Dialog & Tracking Number Storage (A2, A3)
- **Decision:** After checkout submission, storefront presents a persistent confirmation screen featuring:
  - Big prominent order number (`#S21-YYMMDD-XXXX`) with a 1-click clipboard copy button.
  - Order financial and items summary.
  - Direct deep-link button to live self-service tracking (`#/track/:id`).
  - Reopen WhatsApp button in case the browser popup was initially blocked.

### AD-31: Automatic Sticker Pack Grouping & Dynamic Cart Nudge (R10)
- **Decision:** Automatic pack algorithm in `pricing.js` (`groupCartItemsIntoPacks`) groups loose standard stickers in the cart into 10-packs (-30% discount) and 5-packs (-20% discount) without requiring manual pack builder assembly.
- **Rules & Edge Cases:**
  - Strict exclusion of bookmarks (`type === 'bookmark'`, `category === 'bookmarks'`, SKU `BM-*`), custom print items, and explicit custom packs.
  - Supports mixed sizes and mixed base prices; respects deterministic grouping strategy `added_order` (or `lowest_price` / `highest_price`).
  - Dynamic cart banner (`#pack-nudge-banner`) visibly indicates the remaining stickers needed to unlock the next discount tier.
  - Pack lines in cart are atomic and removable as a unified unit via `removeGroupedLine(index)`.

### AD-32: Payment Accounts Management & Client-Side Proof Upload (R12)
- **Decision:** Admin Settings manages payment accounts (InstaPay, Vodafone Cash, Bank) with account names, handles, QR images, and instructions.
- **Non-COD Checkout Flow:**
  - Displays selected method account details with 1-click copy buttons and exact transfer total.
  - Requires proof image upload (JPG/PNG/WebP, <= 5MB) validated with client-side image compression and preview.
  - Honest Prototype Handling: image is stored locally in IndexedDB/session and made shareable via Web Share API / WhatsApp upload prompt.
  - Admin Order Details renders the payment proof thumbnail and offers a 1-click "تأكيد صحة الدفع" verification button.

### AD-33: Complete Purge of "Holographic" Finish & Automatic Migration (R3)
- **Decision:** Fully eliminate holographic finish from all catalog filters, product cards, detail modals, custom print options, and sheen CSS (`hologram-effect`).
- **Standard Finishes:** Exclusively `glossy` (لامع) and `matte` (مطفي).
- **Auto-Migration:** Existing catalog products or stored items with `finish: 'holographic'` are automatically migrated to `'glossy'` on startup.

### AD-34: Admin Quick Order Filters & Dynamic WhatsApp Message Templates (A6, A7)
- **Decision:** Orders view features live quick-filter pill buttons: "الكل", "اليوم", "محتاج تجهيز", "محتاج شحن", "مدفوع بانتظار التحقق" with dynamic count badges.
- **WhatsApp Message Templates:** Admin Settings enables customizing message templates for new orders, preparation completion, and courier dispatch with bracketed placeholders (`{name}`, `{order}`, `{tracking}`, `{courier}`, `{total}`).


