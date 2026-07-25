import { normalizeImageUrl } from "../../../api/store";

const IMAGE_FIELDS = [
  "image",
  "image_url",
  "thumbnail",
  "thumb",
  "photo",
  "logo",
  "cover",
  "banner",
];

function pickImageValue(source) {
  if (!source || typeof source !== "object") return null;

  for (const field of IMAGE_FIELDS) {
    const value = source[field];
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object") {
      const nested = value.url || value.path;
      if (typeof nested === "string" && nested.trim()) return nested;
    }
  }

  return null;
}

function getObjectImage(source) {
  const direct = pickImageValue(source);
  if (direct) return normalizeImageUrl(direct);

  const raw = source?._raw;
  const rawImage = pickImageValue(raw);
  return rawImage ? normalizeImageUrl(rawImage) : null;
}

export function getSectionImage(section) {
  return getObjectImage(section);
}

export function getProductImage(product) {
  return getObjectImage(product);
}

export function getProductDisplayImage(product, section) {
  return (
    getProductImage(product) ||
    getSectionImage(product?.section) ||
    getSectionImage(product?._raw?.section) ||
    getSectionImage(section) ||
    null
  );
}
