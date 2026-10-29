import React, { useEffect, useState } from 'react';

const ImageField = ({ field, label, existing, value = {}, onChange, isArabic }) => {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!value.file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);
  const source = preview || (!value.remove && existing);
  return (
    <section className="mb-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <label className="mb-3 block font-bold" htmlFor={`payment-${field}`}>{label}</label>
      <input id={`payment-${field}`} type="file" accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            onChange({ ...value, error: isArabic ? 'مسموح PNG/JPG/WEBP حتى 5 MB.' : 'PNG/JPG/WEBP only, up to 5 MB.' });
            event.target.value = '';
            return;
          }
          onChange({ file, remove: false, error: '' });
          event.target.value = '';
        }} />
      {value.error && <p role="alert" className="text-red-600">{value.error}</p>}
      {source && <img src={source} alt={label} className="my-3 max-h-48 object-contain" />}
      {source && <button type="button" className="mt-2 text-red-600"
        onClick={() => onChange({ remove: true, error: '' })}>
        {isArabic ? 'حذف الصورة' : 'Remove image'}
      </button>}
    </section>
  );
};

export const paymentMediaLabels = (isArabic) => ({
  qr_image: isArabic ? 'رمز QR الفعلي للدفع' : 'Payment QR code',
  instruction_image: isArabic ? 'صورة إرشادات مسح QR وإرسال الأموال' : 'QR scanning and transfer instructions image',
});

export default function PaymentMediaFields({ method, media, setMedia, isArabic }) {
  return Object.entries(paymentMediaLabels(isArabic)).map(([field, label]) => (
    <ImageField key={field} field={field} label={label} existing={method?.[field]}
      value={media[field]} isArabic={isArabic}
      onChange={(value) => setMedia((current) => ({ ...current, [field]: value }))} />
  ));
}
