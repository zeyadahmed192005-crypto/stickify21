/**
 * STICKIFY 21 - Unified Async Storage Interface
 * All UI and domain operations interact with this interface.
 * UI never touches localStorage or IndexedDB directly.
 */
import { LocalAdapter } from './localAdapter.js';

/**
 * Storage Interface Specification
 * Currently backed by LocalAdapter (localStorage + IndexedDB).
 * Switchable to RemoteAdapter when backend is ready.
 */
class StorageService {
  constructor(adapter = LocalAdapter) {
    this.adapter = adapter;
    this._initialized = false;
  }

  async init() {
    if (!this._initialized) {
      await this.adapter.init();
      this._initialized = true;
    }
  }

  // Products
  async getProducts() {
    await this.init();
    return this.adapter.getProducts();
  }
  async saveProduct(product) {
    await this.init();
    return this.adapter.saveProduct(product);
  }
  async deleteProduct(productId) {
    await this.init();
    return this.adapter.deleteProduct(productId);
  }

  // Orders
  async getOrders() {
    await this.init();
    return this.adapter.getOrders();
  }
  async getOrderById(orderId) {
    await this.init();
    return this.adapter.getOrderById(orderId);
  }
  async createOrder(order) {
    await this.init();
    return this.adapter.createOrder(order);
  }
  async updateOrderStatus(orderId, newStatus, note) {
    await this.init();
    return this.adapter.updateOrderStatus(orderId, newStatus, note);
  }

  // Categories
  async getCategories() {
    await this.init();
    return this.adapter.getCategories();
  }
  async saveCategory(category) {
    await this.init();
    return this.adapter.saveCategory(category);
  }

  // Coupons
  async getCoupons() {
    await this.init();
    return this.adapter.getCoupons();
  }
  async saveCoupon(coupon) {
    await this.init();
    return this.adapter.saveCoupon(coupon);
  }
  async incrementCouponUsage(code) {
    await this.init();
    return this.adapter.incrementCouponUsage(code);
  }

  // Settings
  async getSettings() {
    await this.init();
    return this.adapter.getSettings();
  }
  async saveSettings(settings) {
    await this.init();
    return this.adapter.saveSettings(settings);
  }

  // Backup & Restore
  async exportData() {
    await this.init();
    return this.adapter.exportData();
  }
  async importData(jsonString) {
    await this.init();
    return this.adapter.importData(jsonString);
  }
  async resetDemoData() {
    await this.init();
    return this.adapter.resetDemoData();
  }
}

/**
 * RemoteAdapter (STUB)
 * Documents the REST API shape for future cloud migration.
 */
export class RemoteAdapter {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }
  // GET /api/products
  async getProducts() { throw new Error('RemoteAdapter is a stub: backend not deployed.'); }
  // POST /api/products
  async saveProduct(p) { throw new Error('RemoteAdapter is a stub.'); }
  // DELETE /api/products/:id
  async deleteProduct(id) { throw new Error('RemoteAdapter is a stub.'); }
  // GET /api/orders
  async getOrders() { throw new Error('RemoteAdapter is a stub.'); }
  // POST /api/orders
  async createOrder(o) { throw new Error('RemoteAdapter is a stub.'); }
  // PATCH /api/orders/:id/status
  async updateOrderStatus(id, status, note) { throw new Error('RemoteAdapter is a stub.'); }
  // GET /api/categories
  async getCategories() { throw new Error('RemoteAdapter is a stub.'); }
  // GET /api/coupons
  async getCoupons() { throw new Error('RemoteAdapter is a stub.'); }
  // GET /api/settings
  async getSettings() { throw new Error('RemoteAdapter is a stub.'); }
}

// Export single singleton instance
export const storage = new StorageService(LocalAdapter);
