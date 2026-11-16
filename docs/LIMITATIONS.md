# STICKIFY 21 — Prototype Limitations & Production Roadmap

This document outlines the operational boundaries and technical constraints of the current local prototype.

---

## 1. Local Storage Isolation Boundary

> [!IMPORTANT]
> **Client-Side Storage is Strictly Device- & Browser-Specific:**
> - Data saved in `localStorage` or `IndexedDB` exists solely within the browser and profile of the device accessing the site.
> - **Catalog Edits:** When an administrator adds or edits a product or category in `admin.html`, those modifications reside only in that administrator's browser. Customers opening the store on other phones, tablets, or computers **cannot** see those updates unless they are synchronized via a real backend database or imported via JSON.
> - **Order Submissions:** When a customer completes checkout on their phone, the order record is stored inside that customer's local browser. The store owner receives the order details **exclusively through the generated WhatsApp message and compact Order Code**. The order will not appear in the owner's admin dashboard unless imported via the "استيراد طلب من واتساب" (Import WhatsApp Order Code) tool or synced to a live server.

---

## 2. Security Boundaries (Local Prototype)

1. **Client-Side Passcode:**
   - The passcode mechanism protecting `admin.html` runs locally in client-side JavaScript.
   - It is intended for demo workflows and basic privacy during local presentations. It does **not** replace server-side authentication, session tokens, or secure HTTP-only cookies.
2. **Client-Side Pricing & Coupon Enforcement:**
   - While the client performs strict validation, in a production e-commerce store, all prices, discounts, stock availability, and shipping fees **must** be re-validated on a secure server before order confirmation and payment processing.
3. **WhatsApp Order Codes:**
   - WhatsApp Order Codes utilize compact Base64URL JSON encoding to transport order details without requiring a server. This is an encoding and transport convention, **not** an encrypted signature.

---

## 3. Production Deployment Checklist Prerequisites
Before public launch on a live domain, the following steps are required:
- Connect an operational backend service (e.g., Supabase, Firebase, or a Node.js/Python REST API).
- Implement server-side authentication and role-based access control.
- Enforce server-side order validation, stock decrements, and payment webhooks.
- Replace local file storage with a CDN/object storage bucket (e.g., Cloudflare R2, AWS S3) with automated virus/malware scanning.
- Integrate production rate limiting and bot protection on the checkout endpoints.
