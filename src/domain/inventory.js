/**
 * STICKIFY 21 - Inventory & Stock Domain
 */

/**
 * Check if a product is in stock and can fulfill the requested quantity
 * @param {Object} product
 * @param {number} requestedQty
 * @returns {Object} { available: boolean, reason?: string, currentStock?: number }
 */
export function checkProductStock(product, requestedQty = 1) {
  if (!product) {
    return { available: false, reason: 'المنتج غير موجود' };
  }

  // Explicit out of stock flag
  if (product.inStock === false) {
    return { available: false, reason: 'نفد من المخزون', currentStock: 0 };
  }

  // Numerical stock tracking
  if (typeof product.stockQuantity === 'number') {
    if (product.stockQuantity <= 0) {
      return { available: false, reason: 'نفد من المخزون', currentStock: 0 };
    }
    if (product.stockQuantity < requestedQty) {
      return { 
        available: false, 
        reason: `الكمية المتوفرة حالياً (${product.stockQuantity}) أقل من المطلوب (${requestedQty})`, 
        currentStock: product.stockQuantity 
      };
    }
    return { available: true, currentStock: product.stockQuantity };
  }

  // Default: available
  return { available: true };
}

/**
 * Deduct inventory for items in an order
 * @param {Array<Object>} orderItems
 * @param {Array<Object>} productsList
 * @returns {Array<Object>} Updated products
 */
export function deductOrderStock(orderItems, productsList) {
  const updatedProducts = [...productsList];

  orderItems.forEach(item => {
    // Single item or constituent pack items
    const itemsToDeduct = item.type === 'pack' && Array.isArray(item.items) ? item.items : [item];

    itemsToDeduct.forEach(it => {
      const pIdx = updatedProducts.findIndex(p => p.id === (it.id || it.productId));
      if (pIdx !== -1) {
        const prod = { ...updatedProducts[pIdx] };
        if (typeof prod.stockQuantity === 'number') {
          const qtyToDeduct = item.type === 'pack' ? (item.quantity || 1) : (it.quantity || it.qty || 1);
          prod.stockQuantity = Math.max(0, prod.stockQuantity - qtyToDeduct);
          if (prod.stockQuantity === 0) {
            prod.inStock = false;
          }
          updatedProducts[pIdx] = prod;
        }
      }
    });
  });

  return updatedProducts;
}

/**
 * Restore inventory when an order is cancelled
 * @param {Array<Object>} orderItems
 * @param {Array<Object>} productsList
 * @returns {Array<Object>} Updated products
 */
export function restoreOrderStock(orderItems, productsList) {
  const updatedProducts = [...productsList];

  orderItems.forEach(item => {
    const itemsToRestore = item.type === 'pack' && Array.isArray(item.items) ? item.items : [item];

    itemsToRestore.forEach(it => {
      const pIdx = updatedProducts.findIndex(p => p.id === (it.id || it.productId));
      if (pIdx !== -1) {
        const prod = { ...updatedProducts[pIdx] };
        if (typeof prod.stockQuantity === 'number') {
          const qty = item.type === 'pack' ? (item.quantity || 1) : (it.quantity || it.qty || 1);
          prod.stockQuantity = prod.stockQuantity + qty;
          if (prod.stockQuantity > 0) {
            prod.inStock = true;
          }
          updatedProducts[pIdx] = prod;
        }
      }
    });
  });

  return updatedProducts;
}
