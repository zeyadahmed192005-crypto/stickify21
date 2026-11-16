# STICKIFY 21 — Production Launch Checklist

This checklist tracks all prerequisites and technical tasks required before launching STICKIFY 21 publicly with a real domain, hosting, and backend.

---

## 1. Local Prototype vs. Production Differences

| Feature | Local Prototype (Current) | Production Requirement |
| :--- | :--- | :--- |
| **Catalog & Orders Storage** | Browser `localStorage` | Central cloud database (PostgreSQL / Supabase / MongoDB) |
| **Image & Artwork Storage** | Browser `IndexedDB` (max 1000px WebP) | S3-compatible Object Storage (Cloudflare R2, AWS S3) |
| **Admin Authentication** | Web Crypto PBKDF2 in client | Server-side sessions / JWT with HTTP-only Secure cookies |
| **Order Receipt** | WhatsApp message + Order Code import | Real-time database write + admin notifications |
| **Coupon Validation** | Client-side `src/domain/coupons.js` | Authoritative server-side price & coupon verification |
| **Payment Gateway** | Cash on Delivery (COD) / WhatsApp manual | Integrated payment gateway (Paymob, Fawry, Kashier) |

---

## 2. Admin Security & Passcode Reset

- **Default Passcode:** `2121`
- **Passcode Hashing:** PBKDF2 with SHA-256 (100,000 iterations, unique 16-byte salt per install).
- **Brute-Force Protection:** 5 consecutive incorrect attempts trigger a 15-minute lockout.
- **Inactivity Timeout:** Admin session expires after 30 minutes of inactivity.
- **How to Reset Admin Passcode (Local Prototype):**
  If the admin passcode is forgotten or locked during local development:
  1. Open DevTools in the browser (`F12` or `Ctrl+Shift+I`).
  2. Go to the **Application** (or **Storage**) tab -> **Local Storage** -> `http://localhost:8000`.
  3. Delete the key `stickify21_admin_passcode_hash` and `stickify21_admin_passcode_salt` (and `stickify21_admin_lockout` if locked).
  4. Refresh `admin.html`. The passcode will reset to the default: `2121`.

---

## 3. Production Launch Steps

### A. Infrastructure & Hosting
- [ ] Choose hosting platform (Cloudflare Pages, Vercel, Netlify, or VPS).
- [ ] Connect custom Egyptian/international domain (e.g., `stickify21.com` or `stickify21.store`).
- [ ] Enforce HTTPS with TLS 1.3 and HSTS headers.
- [ ] Configure Content Security Policy (CSP) headers to prevent XSS.

### B. Backend Integration
- [ ] Implement the `RemoteAdapter` methods defined in `src/data/storage.js`:
  - `getProducts()`, `getProduct(id)`, `saveProduct(product)`, `deleteProduct(id)`
  - `getCategories()`, `saveCategory(cat)`, `deleteCategory(id)`
  - `getOrders()`, `getOrder(id)`, `createOrder(order)`, `updateOrderStatus(id, status)`
  - `getCoupons()`, `saveCoupon(coupon)`, `deleteCoupon(id)`
  - `getSettings()`, `saveSettings(settings)`
  - `uploadImage(file)`
- [ ] Switch `StorageService` in `src/data/storage.js` from `new LocalAdapter()` to `new RemoteAdapter('/api/v1')`.

### C. WhatsApp Business API / Webhooks
- [ ] Upgrade WhatsApp contact `201043546503` to official WhatsApp Business account.
- [ ] (Optional) Set up automated order confirmation webhooks via WhatsApp Cloud API.

### D. Legal & E-Commerce Compliance (Egypt)
- [ ] Finalize Terms of Service, Privacy Policy, and Shipping/Returns pages with qualified legal counsel.
- [ ] Define Return & Refund Policy compliant with Egyptian Consumer Protection Agency regulations (14-day return window for non-custom items; custom prints exempt unless defective).
- [ ] Display commercial register / tax registration details in the footer if registered.

### E. Server-Side Authoritative Security & Validation
- [ ] Enforce strict server-side recalculation of order totals, discounts, shipping fees, and free-shipping thresholds (client payloads can be forged).
- [ ] Authoritative coupon validation: verify coupon expiration, max global uses, per-customer limits, and minimum subtotals on the server before confirming orders.
- [ ] Real-time inventory deduction with atomic database transactions to prevent overselling popular stickers.
- [ ] Server-enforced order lifecycle state transitions: reject unauthorized jumps (e.g., jumping from `pending` directly to `completed`).
- [ ] Rate limiting & anti-abuse on checkout: enforce rate limits (max 3 checkouts per IP/hour) and integrate Turnstile/reCAPTCHA v3 to prevent WhatsApp spam and bot checkouts.
- [ ] Malware & virus scanning for custom print uploads (ClamAV or cloud object scanning) before files are viewed by staff.

### F. Payment Verification Process & Gateways
- [ ] Formalize payment confirmation protocol:
  - **InstaPay:** Connect to InstaPay Instant Payment Network (IPN) API or establish manual verification procedures matching sender mobile/reference code to order ID before moving to `confirmed`.
  - **Vodafone Cash:** Manual balance audit using registered wallet notifications or integrate with Egyptian payment aggregator (Paymob, Fawry, Kashier).
  - **Cash on Delivery (COD):** Set up courier API integration (Bosta, Mylerz, Aramex Egypt) for automated tracking number generation and cash remittance.

### G. Analytics, SEO Reality Check & Marketing
- [ ] Configure real Google Analytics 4 (GA4) Measurement ID (`G-XXXXXXXXXX`) and Meta Pixel ID (`XXXXXXXXXX`) in `src/config/config.js`.
- [ ] Verify Open Graph and Twitter Card tags with Facebook Sharing Debugger and Twitter Card Validator.
- [ ] Update `sitemap.xml` with production domain URL and submit via Google Search Console.
- [ ] **SEO Reality Check:** Metadata and JSON-LD alone do not guarantee rank. Real SEO success requires:
  - Fast Core Web Vitals (LCP < 2.5s, CLS < 0.1, INP < 200ms).
  - High-quality Arabic content matching Egyptian search intent (e.g., "استيكرات لابتوب مقاومة للمية", "فواصل كتب هاند ميد").
  - Authoritative backlinks from Egyptian book clubs, tech communities, and university groups.
  - Active social proof (Instagram/TikTok sticker unboxing videos and customer showcases).

### H. Production Monitoring & Disaster Recovery
- [ ] Set up client-side and server-side error monitoring with Sentry or LogRocket.
- [ ] Uptime monitoring (Better Uptime or Uptime Kuma) with instant WhatsApp/Telegram alerts.
- [ ] Automated daily database backups with offsite replication and verified recovery testing (RPO < 1 hour, RTO < 4 hours).
