import {
  getProductDescription,
  getProductName,
} from "../utils/productFormatting";

// Keeps root-section filtering behavior unchanged, including the no-section-field fallback.
export function getProductsForActiveSection(products, inRoot, activeSection) {
  if (!inRoot) return products;
  const sectionKey = String(activeSection);
  const safeList = products || [];
  const canFilter = safeList.some(
    (product) =>
      product?.section_id != null ||
      product?.section != null ||
      product?._raw?.section != null
  );
  if (!canFilter) return safeList;
  return safeList.filter((product) => {
    const sid = product?.section_id ?? product?.section ?? product?._raw?.section;
    return String(sid) === sectionKey;
  });
}

export function filterProductsBySearch(products, search, lang) {
  const q = search.trim().toLowerCase();
  if (!q) return products;
  return (products || []).filter((product) =>
    `${getProductName(product, lang)} ${getProductDescription(
      product,
      lang
    )}`
      .toLowerCase()
      .includes(q)
  );
}
