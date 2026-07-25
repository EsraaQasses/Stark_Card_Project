import { useEffect, useState } from "react";

import { getCache, setCache, cacheKey } from "../../../utils/cache";
import {
  getProductsBySectionNormalized,
  getSectionsNormalized,
} from "../api/storeApi";
import { normalizeProductsForStore } from "../model/productNormalization";

// Owns Products.js data loading while preserving existing cache keys, TTLs, and fetch order.
export function useProductsData({ initialSectionId, mode }) {
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(initialSectionId);
  const [directProducts, setDirectProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cached = await getCache(cacheKey("sections", "list"), 1000 * 60 * 60 * 6);
        if (cached && Array.isArray(cached)) {
          setSections(cached);
        }
        const result = await getSectionsNormalized();
        if (!result.ok) throw result.error;
        const data = result.data;
        if (!alive) return;
        const list = Array.isArray(data) ? data : data?.results || [];
        setSections(list);
        await setCache(cacheKey("sections", "list"), list);
      } finally {
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!initialSectionId && sections.length > 0 && !activeSection) {
      setActiveSection(sections[0].id);
    }
  }, [sections, initialSectionId, activeSection]);

  useEffect(() => {
    if (!activeSection || mode !== "products") return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const cached = await getCache(cacheKey("products", activeSection), 1000 * 60 * 10);
        if (cached && Array.isArray(cached)) {
          setDirectProducts(cached);
        }
        const result = await getProductsBySectionNormalized(activeSection, { directOnly: true });
        if (!result.ok) throw result.error;
        const data = result.data;
        if (!alive) return;
        const list = Array.isArray(data) ? data : data?.results || [];
        const normalized = normalizeProductsForStore(list);

        setDirectProducts(normalized);
        await setCache(cacheKey("products", activeSection), normalized);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeSection, mode]);

  return {
    activeSection,
    directProducts,
    loading,
    sections,
    setActiveSection,
  };
}
