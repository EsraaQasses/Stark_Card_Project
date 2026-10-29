export const apiErrorMessage = (error, fallback, locale = 'en') => {
  const messages = (value) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(messages);
    if (!value || typeof value !== 'object') return [];
    if (value.en || value.ar) return messages(value[locale] || value.en || value.ar);
    if (value.message) return messages(value.message);
    return Object.entries(value).filter(([key]) => !['code', 'meta', 'request_id'].includes(key))
      .flatMap(([key, item]) => messages(item).map((text) => `${key}: ${text}`));
  };
  const data = error?.response?.data;
  const envelope = data?.error && typeof data.error === 'object' ? data.error : null;
  const details = envelope?.fields || envelope?.details?.legacy_error;
  return messages(details).join(' — ') || messages(envelope?.message).join(' — ')
    || messages(data).join(' — ') || fallback || error?.message || 'Request failed';
};
