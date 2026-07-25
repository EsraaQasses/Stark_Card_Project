const DEFAULT_ASPECT_RATIO = 1.2;

export function clampImageAspectRatio(
  ratio,
  { min = 0.78, max = 1.9, fallback = DEFAULT_ASPECT_RATIO } = {}
) {
  const n = Number(ratio);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function getImageAspectRatioFromLoad(event) {
  const source = event?.nativeEvent?.source;
  const width = Number(source?.width);
  const height = Number(source?.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
}

export function getAdaptiveImageHeight(
  boxWidth,
  ratio,
  { minHeight, maxHeight, fallbackRatio = DEFAULT_ASPECT_RATIO } = {}
) {
  const width = Number(boxWidth);
  if (!Number.isFinite(width) || width <= 0) return minHeight;

  const safeRatio = clampImageAspectRatio(ratio, { fallback: fallbackRatio });
  const rawHeight = width / safeRatio;
  const min = Number.isFinite(minHeight) ? minHeight : rawHeight;
  const max = Number.isFinite(maxHeight) ? maxHeight : rawHeight;

  return Math.min(max, Math.max(min, rawHeight));
}
