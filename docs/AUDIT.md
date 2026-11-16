# STICKIFY 21 — Comprehensive Code & Security Audit

**Date:** November 2026  
**Auditor:** Senior Full-Stack Developer & Security Reviewer  
**Scope:** `index.html`, `app.js`, `admin.html`, `admin.js`, `packing-slip.html`, `styles.css`  
**Severity Scale:** Critical | High | Medium | Low  

---

## Executive Summary
The STICKIFY 21 codebase demonstrates strong creative visual design, authentic Egyptian RTL copywriting, and high-value e-commerce concepts (interactive mockup studio, discount pack builder, packing slip with drawer checklist). However, the original prototype suffered from fundamental security vulnerabilities (persistent XSS across cart, admin, and packing slip), broken responsive classes, pack integrity bypasses, and unthrottled DOM re-renders during drag operations.

---

## Detailed Findings

### 1. Security & Data Integrity

| ID | Finding | Severity | File & Location | Description & Remediation |
|---|---|---|---|---|
| **SEC-01** | Cross-Site Scripting (XSS) in Order Intake & Admin Display | **Critical** | `app.js` (lines 1309-1334), `admin.js` (lines 266-280) | Customer input (`name`, `phone`, `city`, `address`, `notes`, `sku`, `nameAr`) is interpolated directly into `innerHTML` without sanitization. An order name like `<img src=x onerror=alert(1)>` executes arbitrary JavaScript in the admin portal. **Remedy:** Pass all data through strict `escapeHtml()` and DOM builders. |
| **SEC-02** | XSS in Packing Slip Checklist | **Critical** | `packing-slip.html` (lines 233-268) | Item details and SVGs parsed from URL parameters or localStorage are inserted into `container.innerHTML` without escaping, exposing warehouse personnel to script execution. **Remedy:** Sanitize SVGs and escape item names/sizes. |
| **SEC-03** | Client-Side Admin Hardcoded PIN Authentication | **High** | `admin.html` (lines 57), `admin.js` (lines 7, 169-178) | Passcode `2121` is hardcoded in client-side script and can be bypassed via browser DevTools or by removing the `.hidden` class from `#admin-dashboard-app`. **Remedy:** Add demo warning, salt & hash passcode using WebCrypto PBKDF2/SHA-256, session timeout, and explicit `AuthAdapter`. |
| **SEC-04** | Hardcoded & Leaked Coupon Codes | **Medium** | `app.js` (lines 22-25), `admin.js` (lines 22-25) | `STICKIFY21` (21% off) is hardcoded into default coupon arrays in plain code, granting unintended discounts. **Remedy:** Remove unadvertised coupons from default bundle and manage strictly via configurable data. |
| **SEC-05** | Unsafe Unhandled `JSON.parse` across Storage Calls | **High** | `app.js` (lines 261, 397, 409, 1318), `admin.js` (lines 114, 120, 133, 146) | Any malformed or truncated JSON in `localStorage` immediately triggers an uncaught `SyntaxError`, producing a permanent white screen on load. **Remedy:** Wrap all storage operations in robust error-handling wrappers with corrupt-data snapshots. |

---

### 2. Functional & Logical Bugs

| ID | Finding | Severity | File & Location | Description & Remediation |
|---|---|---|---|---|
| **BUG-01** | Non-Standard Tailwind Classes for Sticker Sizes | **High** | `app.js` (lines 517, 608) | `w-34 h-34` is not a valid Tailwind CSS utility class. Selecting the "10cm (Large)" size fails to visually expand the sticker in the product card stage. **Remedy:** Replace with valid classes `w-36 h-36` (or explicit pixel scales) so 6cm, 8cm, and 10cm sizes visibly contrast. |
| **BUG-02** | Duplicate Element ID `mockup-stickers-layer` | **Medium** | `index.html` (line 367), `app.js` (line 912) | `#mockup-stickers-layer` is statically present in `index.html` and also recreated dynamically inside `renderMockupDevice()`, creating duplicate IDs in the DOM tree. **Remedy:** Ensure a single authoritative mount point. |
| **BUG-03** | Pack Builder Breakdown & Arbitrary Size Tag | **High** | `app.js` (lines 1240-1253) | Pack builder assigns an arbitrary `size: '7.5cm'` (not among the 6/8/10cm system) and splits the pack into loose cart items. Customers could delete items while keeping discount rates. **Remedy:** Enforce valid sizes and encapsulate the pack as a single atomic cart item (`type: 'pack'`). |
| **BUG-04** | Bookmarks Allowed into Sticker Packs | **Medium** | `app.js` (line 570) | Bookmarks display the "للباقة" (Add to Pack) button despite packs being advertised and calculated exclusively for Die-cut vinyl stickers. **Remedy:** Hide or disable the pack button for bookmark products. |
| **BUG-05** | Inconsistent Free-Shipping Calculation | **Medium** | `app.js` (lines 772, 837) | Free-shipping threshold (200 EGP) was calculated against the pre-discount subtotal rather than the post-discount subtotal, resulting in free shipping even when discounts dropped the order below 200 EGP. **Remedy:** Standardize threshold verification to apply post-discount across the application. |
| **BUG-06** | Inconsistent Price Calculations Across Modules | **High** | `app.js` (lines 248-256, 769-776, 1202-1206) | Pricing logic was fragmented across four different functions, causing discrepancies in rounding and pack savings. **Remedy:** Consolidate all calculations into a single deterministic `src/domain/pricing.js`. |
| **BUG-07** | Inconsistent Cart Item Merge Keys | **Medium** | `app.js` (line 708) | Merge lookups checked `item.id === cartItemId || (item.productId === product.id && item.size === sizeLabel)`. Inconsistent key formats caused duplicates or accidental overwrites. **Remedy:** Adopt a deterministic unique line key (`sticker:${id}:${sizeKey}` and `pack:${size}:${itemsHash}`). |

---

### 3. User Experience & Performance Issues

| ID | Finding | Severity | File & Location | Description & Remediation |
|---|---|---|---|---|
| **UX-01** | Mockup Dragging Causes Full DOM Re-render on Every Frame | **High** | `app.js` (lines 1075-1082, 1103-1110) | Mouse and touch move listeners called `renderPlacedStickers()`, destroying and recreating all sticker elements and listeners on every pixel of movement. Causes severe stutter and lost touch capture. **Remedy:** Use unified Pointer Events, pointer capture, and direct transform updates via `requestAnimationFrame`. |
| **UX-02** | Product Preview Button Hidden on Touch Devices | **Medium** | `app.js` (line 521) | "معاينة" (Preview) button used `opacity-0 group-hover:opacity-100`, making it invisible and inaccessible on mobile and tablet touchscreens. **Remedy:** Always display preview action on touch devices. |
| **UX-03** | Tailwind CDN Dependency in Production | **Medium** | `index.html` (line 14), `admin.html` (line 12), `packing-slip.html` (line 12) | Script injection of Tailwind CSS CDN slows execution and triggers runtime console warnings. **Remedy:** Precompile via Tailwind CLI to `dist/styles.css`. |
| **UX-04** | Double-Click `file://` Silent Failure | **Medium** | `index.html` | When opened locally via double-click, ES Modules silently fail due to browser CORS security restrictions. **Remedy:** Add friendly dual-language diagnostic prompt. |
