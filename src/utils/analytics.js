/**
 * STICKIFY 21 — Analytics Dispatcher Hooks
 * Supports Google Analytics 4 (GA4) and Meta Pixel (Facebook Pixel).
 * In prototype/dev mode, events are safely logged to console.debug when IDs are not set.
 */

import { CONFIG } from '../config/config.js';

export class AnalyticsService {
  constructor() {
    this.ga4Id = CONFIG.ANALYTICS?.GA4_ID || null;
    this.metaPixelId = CONFIG.ANALYTICS?.META_PIXEL_ID || null;
    this.debug = CONFIG.ANALYTICS?.DEBUG !== false;
    this.initialized = false;
    this.init();
  }

  init() {
    if (this.initialized) return;

    // Only inject real scripts if valid IDs are configured
    if (this.ga4Id && typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.ga4Id}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', this.ga4Id, { send_page_view: true });
    }

    if (this.metaPixelId && typeof window !== 'undefined') {
      /* Standard Meta Pixel snippet if pixel id is provided */
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', this.metaPixelId);
      window.fbq('track', 'PageView');
    }

    this.initialized = true;
  }

  track(eventName, params = {}) {
    if (this.debug) {
      console.debug(`[STICKIFY Analytics Hook] ${eventName}:`, params);
    }

    // GA4 Dispatch
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }

    // Meta Pixel Dispatch
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      const metaEventMap = {
        view_item: 'ViewContent',
        add_to_cart: 'AddToCart',
        begin_checkout: 'InitiateCheckout',
        purchase: 'Purchase'
      };
      const metaEvent = metaEventMap[eventName] || 'Custom';
      window.fbq('track', metaEvent, params);
    }
  }

  trackViewItem(product) {
    if (!product) return;
    this.track('view_item', {
      currency: 'EGP',
      value: product.price || 0,
      items: [{
        item_id: product.sku || product.id,
        item_name: product.nameAr || product.name,
        item_category: product.category,
        price: product.price || 0
      }]
    });
  }

  trackAddToCart(item) {
    if (!item) return;
    this.track('add_to_cart', {
      currency: 'EGP',
      value: (item.price || 0) * (item.quantity || 1),
      items: [{
        item_id: item.sku || item.productId,
        item_name: item.nameAr || item.name,
        price: item.price || 0,
        quantity: item.quantity || 1
      }]
    });
  }

  trackBeginCheckout(cart, total) {
    if (!cart || cart.length === 0) return;
    this.track('begin_checkout', {
      currency: 'EGP',
      value: total || 0,
      items: cart.map(item => ({
        item_id: item.sku || item.productId,
        item_name: item.nameAr || item.name,
        price: item.price || 0,
        quantity: item.quantity || 1
      }))
    });
  }

  trackPurchase(order) {
    if (!order) return;
    this.track('purchase', {
      transaction_id: order.id,
      currency: 'EGP',
      value: order.total || 0,
      shipping: order.shipping || 0,
      coupon: order.couponCode || null,
      items: (order.items || []).map(item => ({
        item_id: item.sku,
        item_name: item.nameAr || item.name,
        price: item.price || 0,
        quantity: item.qty || item.quantity || 1
      }))
    });
  }
}

export const analytics = new AnalyticsService();
