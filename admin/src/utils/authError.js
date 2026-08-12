const localizedMessage = (value, locale) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(String).join('\n');
  if (value && typeof value === 'object') {
    return value[locale] || value.en || value.ar || null;
  }
  return null;
};

export const getAuthErrorMessage = (error, fallback, locale = 'en') => {
  const data = error?.response?.data;
  const normalized = data?.error && typeof data.error === 'object' ? data.error : null;
  const legacy = normalized?.details?.legacy_error;

  return localizedMessage(legacy, locale)
    || localizedMessage(normalized?.message, locale)
    || localizedMessage(data?.detail, locale)
    || localizedMessage(data?.error, locale)
    || localizedMessage(data?.message, locale)
    || error?.message
    || fallback;
};

export default getAuthErrorMessage;
