export const normalizeRuntimeKey = (value) => String(value ?? '')
  .trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toLowerCase();

export const localizeRuntimeValue = ({
  t,
  i18n,
  value,
  namespace,
  prefix,
  aliases = {},
  fallback,
}) => {
  const normalized = normalizeRuntimeKey(value);
  const canonical = aliases[normalized] || normalized;

  if (!canonical) {
    return typeof fallback === 'function' ? fallback(value) : (fallback ?? String(value ?? ''));
  }

  const translationKey = namespace ? `${namespace}:${prefix}.${canonical}` : `${prefix}.${canonical}`;
  const translated = t(translationKey);
  const keyWithoutNs = `${prefix}.${canonical}`;

  if (translated && translated !== translationKey && translated !== keyWithoutNs && translated !== canonical) {
    return translated;
  }

  return typeof fallback === 'function' ? fallback(value) : (fallback ?? String(value ?? ''));
};
