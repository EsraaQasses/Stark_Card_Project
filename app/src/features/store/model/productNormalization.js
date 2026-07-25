// Keeps the Products.js fallback for store_product_id before caching products.
export function normalizeProductsForStore(list) {
  return (list || []).map((product) => ({
    ...product,
    store_product_id:
      product.store_product_id ?? product.store_product?.id ?? product.id,
  }));
}
