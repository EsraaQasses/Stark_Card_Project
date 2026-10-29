/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users must be able to focus and scroll the rates table region. */
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext as NavigationContext, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiAlertCircle, FiCheck, FiChevronLeft, FiChevronRight, FiRefreshCw, FiSave, FiSearch, FiX } from 'react-icons/fi';
import axiosInstance from '../utils/axiosConfig';
import { apiErrorMessage } from '../utils/apiError';
import { registerProfitMatrixNavigationGuard } from '../utils/profitMatrixNavigationGuard';

const endpoint = '/store/admin/profit-matrix/';
const controlClass = 'min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const buttonClass = 'inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

// Decimal strings remain strings throughout editing and transport. No prices are calculated here.
export const normalizedProfit = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) return undefined;
  const [whole, fraction = ''] = text.split('.');
  const digits = fraction.replace(/0+$/, '');
  return `${whole.replace(/^0+(?=\d)/, '')}${digits ? `.${digits}` : ''}`;
};

const rateFor = (product, categoryId) => (
  (product.rates || []).find((rate) => String(rate.category_id) === String(categoryId))
  || { category_id: categoryId, profit_percentage: null, revision: 0 }
);

export default function ProductProfitMatrix({ sections = [], providers = [], accentColor = '#06b6d4', onClose, onDirtyChange, onBusyChange, refreshToken = 0 }) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const { navigator } = useContext(NavigationContext);
  const isArabic = (i18n.resolvedLanguage || i18n.language || '').startsWith('ar');
  const text = useCallback((ar, en) => (isArabic ? ar : en), [isArabic]);
  const [query, setQuery] = useState({ search: '', section_id: '', api_id: '', currency: '', is_active: '', page_size: 25, page: 1 });
  const [response, setResponse] = useState({ count: 0, categories: [], results: [] });
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const requestRef = useRef(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const navigationGuardRef = useRef(null);
  const mountedRef = useRef(true);
  const dirtyCount = Object.keys(drafts).length;
  dirtyRef.current = dirtyCount > 0;
  savingRef.current = saving;

  const leaveMessage = text('توجد نسب غير محفوظة. هل تريد المغادرة والتخلي عن هذه التعديلات؟', 'You have unsaved rates. Leave and discard these changes?');
  const leaveMessageRef = useRef(leaveMessage);
  leaveMessageRef.current = leaveMessage;

  useEffect(() => { onDirtyChange?.(dirtyCount > 0); }, [dirtyCount, onDirtyChange]);
  useEffect(() => { onBusyChange?.(saving); }, [saving, onBusyChange]);
  useEffect(() => () => { onDirtyChange?.(false); onBusyChange?.(false); }, [onDirtyChange, onBusyChange]);
  useEffect(() => {
    navigationGuardRef.current?.sync();
  }, [location]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirtyRef.current && !savingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    // React Router navigation can originate from buttons and clickable profile
    // panels as well as links. Guard the shared history boundary, not only anchors.
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;
    const allowNavigation = () => !savingRef.current && (!dirtyRef.current || window.confirm(leaveMessageRef.current));
    const guardedPush = (...args) => {
      if (allowNavigation()) return originalPush.apply(navigator, args);
      return undefined;
    };
    const guardedReplace = (...args) => {
      if (allowNavigation()) return originalReplace.apply(navigator, args);
      return undefined;
    };
    navigator.push = guardedPush;
    navigator.replace = guardedReplace;
    const popGuard = registerProfitMatrixNavigationGuard({
      shouldBlock: () => dirtyRef.current || savingRef.current,
      confirmLeave: () => !savingRef.current && window.confirm(leaveMessageRef.current),
    });
    navigationGuardRef.current = popGuard;
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      popGuard.unregister();
      if (navigationGuardRef.current === popGuard) navigationGuardRef.current = null;
      if (navigator.push === guardedPush) navigator.push = originalPush;
      if (navigator.replace === guardedReplace) navigator.replace = originalReplace;
    };
  }, [navigator]);

  const load = useCallback(async (currentQuery = query) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(currentQuery).filter(([, value]) => value !== ''));
      const [matrixResponse, categoryResponse] = await Promise.all([
        axiosInstance.get(endpoint, { params, signal: controller.signal }),
        axiosInstance.get('/users/categories/active_categories/', { signal: controller.signal }),
      ]);
      const { data } = matrixResponse;
      const activeCategories = Array.isArray(categoryResponse.data) ? categoryResponse.data : categoryResponse.data?.results;
      if (!Array.isArray(data?.results) || !Array.isArray(activeCategories) || !Number.isInteger(data.count)) throw new Error('Invalid profit matrix or category response');
      if (!controller.signal.aborted) setResponse({ ...data, categories: activeCategories.filter((category) => category.is_active !== false) });
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setLoadFailed(true);
        setError(apiErrorMessage(loadError, text('تعذر تحميل جدول الأرباح أو فئات العملاء. أعد المحاولة.', 'Could not load profit rates or customer categories. Try again.'), isArabic ? 'ar' : 'en'));
      }
    } finally {
      if (!controller.signal.aborted && mountedRef.current) setLoading(false);
    }
  }, [query, text, isArabic]);

  useEffect(() => {
    mountedRef.current = true;
    const timer = window.setTimeout(() => load(), query.search ? 250 : 0);
    return () => { window.clearTimeout(timer); requestRef.current?.abort(); };
  }, [load, query.search, refreshToken]);
  useEffect(() => () => { mountedRef.current = false; requestRef.current?.abort(); }, []);

  const updateQuery = (key, value) => setQuery((previous) => ({ ...previous, [key]: value, page: key === 'page' ? value : 1 }));
  const editCell = (product, category, value) => {
    const key = `${product.id}:${category.id}`;
    const original = rateFor(product, category.id);
    setNotice('');
    setDrafts((previous) => {
      const next = { ...previous };
      if (normalizedProfit(value) !== undefined && normalizedProfit(value) === normalizedProfit(original.profit_percentage)) delete next[key];
      else next[key] = { ...(previous[key] || { product_id: product.id, category_id: category.id, expected_revision: original.revision, product_name: product.name_ar || product.name_en, category_name: category.display_name || category.name }), value };
      return next;
    });
  };
  const discard = (productId) => {
    setDrafts((previous) => Object.fromEntries(Object.entries(previous).filter(([, draft]) => productId !== undefined && draft.product_id !== productId)));
    setNotice('');
  };
  const reloadAndDiscard = () => {
    if (dirtyRef.current && !window.confirm(text('إعادة التحميل ستلغي جميع التعديلات غير المحفوظة، بما فيها الصفحات الأخرى. هل تريد المتابعة؟', 'Reloading discards all unsaved changes, including other pages. Continue?'))) return;
    setDrafts({});
    setConflict(false);
    setNotice('');
    load();
  };
  const close = () => {
    if (saving || (dirtyCount && !window.confirm(leaveMessage))) return;
    onClose?.();
  };
  const save = async (productId) => {
    if (saving || conflict) return;
    const submitted = Object.entries(drafts).filter(([, draft]) => productId === undefined || draft.product_id === productId);
    if (!submitted.length) return;
    if (submitted.some(([, draft]) => normalizedProfit(draft.value) === undefined)) {
      setError(text('أدخل نسبة من 0 إلى 999.99 بمنزلتين عشريتين كحد أقصى. اترك الخلية فارغة لإزالة النسبة المخصصة.', 'Enter a percentage from 0 to 999.99 with at most two decimal places. Blank removes the configured rate.'));
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const changes = submitted.map(([, draft]) => ({ product_id: draft.product_id, category_id: draft.category_id, expected_revision: draft.expected_revision, profit_percentage: normalizedProfit(draft.value) }));
      const { data } = await axiosInstance.patch(endpoint, { changes });
      if (data?.saved_count !== changes.length || !Array.isArray(data.updated) || data.updated.length !== changes.length) {
        setConflict(true);
        throw new Error(text('استجابة الحفظ غير مؤكدة. أعد التحميل للتحقق من القيم المحفوظة.', 'Save response is uncertain. Reload to verify the stored values.'));
      }
      setResponse((previous) => ({ ...previous,
        results: previous.results.map((product) => ({ ...product,
          rates: [
            ...(product.rates || []).filter((rate) => !data.updated.some((updated) => updated.product_id === product.id && updated.category_id === rate.category_id)),
            ...data.updated.filter((updated) => updated.product_id === product.id),
          ] })) }));
      setDrafts((previous) => {
        const next = { ...previous };
        submitted.forEach(([key, draft]) => { if (next[key]?.value === draft.value) delete next[key]; });
        return next;
      });
      await load();
      setNotice(text(`تم حفظ ${changes.length} نسبة كإعدادات إدارية. لم تتغير أسعار البيع.`, `${changes.length} rates saved as administrative configuration. Selling prices are unchanged.`));
    } catch (saveError) {
      if (saveError.response?.status === 409 || !saveError.response) setConflict(true);
      setError(apiErrorMessage(saveError, text('لم يكتمل الحفظ. التعديلات غير المحفوظة محفوظة في الجدول.', 'Save failed. Your unsaved edits remain in the table.'), isArabic ? 'ar' : 'en'));
    } finally { if (mountedRef.current) setSaving(false); }
  };

  const { categories } = response;
  const pageCount = Math.max(1, Math.ceil(response.count / query.page_size));
  return (
    <section aria-label={text('إدارة نسب الأرباح', 'Manage profit rates')} className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-secondary-dark-bg">
      <fieldset disabled={saving} className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">{text('إدارة نسب الأرباح', 'Manage profit rates')}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">{text('نسبة مستقلة لكل منتج وفئة عميل', 'Independent rates for each product and customer category')}</p>
          </div>
          <button type="button" onClick={close} className={buttonClass}><FiX />{text('العودة إلى قائمة المنتجات', 'Back to product list')}</button>
        </div>
        <div role="note" className="m-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <FiAlertCircle className="mt-1 shrink-0" />
          <div><p className="font-black">{text('إعدادات محفوظة — غير مفعّلة على أسعار البيع', 'Stored configuration — not applied to selling prices')}</p>
            <p>{text('تحتاج طريقة دمج النسبة الخاصة مع ربح الفئة والمنتج إلى اعتماد تجاري. الحفظ هنا لا يغيّر التسعير الحالي أو العمليات التاريخية.', 'How these rates combine with category and product profit requires a business decision. Saving here changes neither current pricing nor historical transactions.')}</p>
            <p className="mt-1">{text('الخانة الفارغة تعني عدم تخصيص نسبة، والصفر نسبة مخصصة صحيحة.', 'Blank means no configured rate; zero is an explicit rate.')}</p>
          </div>
        </div>
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 sm:col-span-2 xl:col-span-2">{text('البحث بالاسم أو المعرّف', 'Search by name or ID')}<div className="relative mt-2"><FiSearch className="pointer-events-none absolute start-3 top-3.5" /><input type="search" value={query.search} onChange={(event) => updateQuery('search', event.target.value)} className={`${controlClass} ps-9`} /></div></label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{text('القسم', 'Section')}<select value={query.section_id} onChange={(event) => updateQuery('section_id', event.target.value)} className={`${controlClass} mt-2`}><option value="">{text('جميع الأقسام', 'All sections')}</option>{sections.map((section) => <option key={section.id} value={section.id}>{isArabic ? section.name_ar || section.name_en : section.name_en || section.name_ar}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{text('المزوّد', 'Provider')}<select value={query.api_id} onChange={(event) => updateQuery('api_id', event.target.value)} className={`${controlClass} mt-2`}><option value="">{text('جميع المزوّدين', 'All providers')}</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}{provider.is_active === false ? text(' (معطّل)', ' (disabled)') : ''}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{text('العملة', 'Currency')}<select value={query.currency} onChange={(event) => updateQuery('currency', event.target.value)} className={`${controlClass} mt-2`}><option value="">{text('كل العملات', 'All currencies')}</option><option value="USD">USD</option><option value="SYP">SYP</option></select></label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{text('حالة المنتج', 'Product status')}<select value={query.is_active} onChange={(event) => updateQuery('is_active', event.target.value)} className={`${controlClass} mt-2`}><option value="">{text('جميع الحالات', 'All statuses')}</option><option value="true">{text('نشط', 'Active')}</option><option value="false">{text('معطّل', 'Inactive')}</option></select></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <p aria-live="polite" className="text-sm font-bold text-slate-700 dark:text-slate-200">{dirtyCount ? text(`${dirtyCount} خلية غير محفوظة، بما فيها الصفحات الأخرى`, `${dirtyCount} unsaved cells, including other pages`) : text('كل التعديلات محفوظة', 'All changes saved')}</p>
          <div
            className="flex flex-wrap gap-2"
          >
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className={buttonClass}
            >
              <FiRefreshCw
                className={loading ? 'animate-spin' : ''}
              />{text('تحديث الفئات والبيانات', 'Refresh categories and data')}
            </button>
            <button
              type="button"
              disabled={!dirtyCount}
              onClick={() => discard()}
              className={buttonClass}
            >{text('إلغاء كل التعديلات', 'Cancel all edits')}
            </button>
            <button
              type="button"
              disabled={!dirtyCount || conflict || loadFailed}
              onClick={() => save()}
              className={`${buttonClass} text-white`}
              style={{ backgroundColor: accentColor, borderColor: accentColor }}
            >
              <FiSave />{saving ? text('جارٍ الحفظ…', 'Saving…') : text('حفظ التعديلات', 'Save changes')}
            </button>
          </div>
        </div>
        {error && <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
        {conflict && (
        <div
          className="mx-5 mb-5 rounded-xl border border-amber-200 p-4 text-sm text-amber-900 dark:text-amber-100"
        >
          <p>{text('قد تكون البيانات تغيّرت أو حُفظت بعض القيم عند انقطاع الاتصال. تحقق من القيم الحالية قبل المحاولة مجدداً.', 'The data may have changed, or a disconnected save may have completed. Verify current values before retrying.')}
          </p>
          <button
            type="button"
            onClick={reloadAndDiscard}
            className={`${buttonClass} mt-3`}
          >{text('إعادة التحميل وإلغاء التعديلات المحلية', 'Reload and discard local edits')}
          </button>
        </div>
        )}
        {notice && <p role="status" className="m-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><FiCheck />{notice}</p>}
        {loading && <p role="status" className="flex items-center gap-2 px-5 py-4 text-sm text-slate-600 dark:text-slate-300"><FiRefreshCw className="animate-spin" />{text('تحميل جدول الأرباح…', 'Loading profit rates…')}</p>}
        {!categories.length && !loading && !loadFailed ? <div className="p-10 text-center"><h3 className="font-black text-slate-900 dark:text-white">{text('لا توجد فئات عملاء نشطة', 'No active customer categories')}</h3><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{text('أضف فئة أو فعّلها من إدارة فئات العملاء، ثم حدّث هذا الجدول. لن تُنشأ نسب افتراضية.', 'Add or activate a customer category in category management, then refresh this table. No default rates are created.')}</p></div> : (
          <div className="max-w-full overflow-x-auto" aria-busy={loading} tabIndex={0} role="region" aria-label={text('جدول نسب الأرباح القابل للتمرير أفقياً', 'Horizontally scrollable profit rates table')}>
            <table className="w-full border-collapse text-start text-sm">
              <caption className="sr-only">{text('نسب الأرباح المحفوظة حسب المنتج وفئة العميل، غير مفعّلة على التسعير.', 'Stored profit rates by product and customer category, not applied to pricing.')}</caption>
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th scope="col" className="sticky start-0 z-20 min-w-[220px] border-b border-slate-200 bg-slate-50 px-5 py-4 text-start font-black text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">{text('المنتج', 'Product')}</th>
                  {[text('القسم', 'Section'), text('العملة', 'Currency'), text('التكلفة', 'Cost'), text('الربح العام الفعّال', 'Current general profit')].map((label) => <th key={label} scope="col" className="min-w-[130px] border-b border-slate-200 px-4 py-4 text-start font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">{label}</th>)}
                  {categories.map((category) => <th key={category.id} scope="col" className="min-w-[165px] border-b border-slate-200 px-4 py-4 text-start dark:border-slate-700"><p className="font-black text-slate-900 dark:text-white">{category.display_name || category.name}</p><p className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-300">{text('نسبة الفئة الحالية', 'Current category rate')}: <span dir="ltr">{category.profit_percentage}%</span></p></th>)}
                  <th scope="col" className="min-w-[180px] border-b border-slate-200 px-4 py-4 text-start text-slate-700 dark:border-slate-700 dark:text-slate-200">{text('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {response.results.map((product) => {
                  const productName = isArabic ? product.name_ar || product.name_en : product.name_en || product.name_ar;
                  const rowDirty = Object.values(drafts).some((draft) => draft.product_id === product.id);
                  return (
                    <tr key={product.id} className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <th
                        scope="row"
                        className="sticky start-0 z-10 border-e border-slate-100 bg-white px-5 py-4 text-start dark:border-slate-800 dark:bg-secondary-dark-bg"
                      >
                        <p
                          className="max-w-[220px] break-words font-black text-slate-900 dark:text-white"
                        >{productName}
                        </p>
                        <p
                          className="mt-1 text-xs font-normal text-slate-500"
                        >#{product.id} · {product.provider_name || text('بدون مزوّد', 'No provider')}
                        </p>
                        <p
                          className={`mt-2 text-xs font-bold ${product.is_active ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
                        >{product.is_active ? text('منتج نشط', 'Active product') : text('منتج معطّل', 'Inactive product')}
                        </p>{(product.provider_active === false || product.external_active === false) && (
                        <p
                          className="mt-1 text-xs font-semibold text-amber-800 dark:text-amber-200"
                        >{text('المزوّد أو المنتج الخارجي معطّل', 'Provider or external product disabled')}
                        </p>
                        )}
                      </th>
                      <td
                        className="px-4 py-4 text-slate-600 dark:text-slate-300"
                      >{isArabic ? product.section_name_ar || product.section_name_en : product.section_name_en || product.section_name_ar}
                      </td>
                      <td
                        className="px-4 py-4 font-bold text-slate-800 dark:text-slate-100"
                        dir="ltr"
                      >{product.currency}
                      </td>
                      <td
                        className="px-4 py-4 text-slate-500 dark:text-slate-300"
                      >{product.cost === null || product.cost === undefined ? text('غير متوفرة', 'Unavailable') : (
                        <span
                          dir="ltr"
                        >{product.cost} {product.currency}
                        </span>
                      )}
                      </td>
                      <td
                        className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200"
                        dir="ltr"
                      >{product.product_profit_percentage}%
                      </td>
                      {categories.map((category) => {
                        const key = `${product.id}:${category.id}`;
                        const draft = drafts[key];
                        const value = draft ? draft.value : rateFor(product, category.id).profit_percentage ?? '';
                        const invalid = draft && normalizedProfit(value) === undefined;
                        return (
                          <td
                            key={category.id}
                            className={`px-4 py-3 ${draft ? 'bg-amber-50/80 dark:bg-amber-950/20' : ''}`}
                          >
                            <div
                              className="relative"
                            >
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max="999.99"
                                step="0.01"
                                dir="ltr"
                                value={value}
                                aria-label={`${productName} — ${category.display_name || category.name} (%)`}
                                aria-invalid={invalid || undefined}
                                disabled={loading || loadFailed}
                                onChange={(event) => editCell(product, category, event.target.value)}
                                placeholder="—"
                                className={`${controlClass} pe-8 tabular-nums ${draft ? 'border-amber-400 dark:border-amber-600' : ''}`}
                              />
                              <span
                                className="pointer-events-none absolute end-3 top-3 text-xs text-slate-500"
                              >%
                              </span>
                            </div>{draft && (
                            <p
                              className={`mt-1 text-[11px] font-bold ${invalid ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-200'}`}
                            >{invalid ? text('نسبة غير صالحة', 'Invalid rate') : text('غير محفوظة', 'Unsaved')}
                            </p>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3"><div className="flex gap-2"><button type="button" disabled={!rowDirty || conflict || loadFailed} onClick={() => save(product.id)} className={buttonClass}>{text('حفظ', 'Save')}</button><button type="button" disabled={!rowDirty} onClick={() => discard(product.id)} className={buttonClass}>{text('إلغاء', 'Cancel')}</button></div></td>
                    </tr>
                  );
                })}
                {!response.results.length && !loading && <tr><td colSpan={categories.length + 6} className="p-10 text-center text-slate-600 dark:text-slate-300">{text('لا توجد منتجات مطابقة للفلاتر.', 'No products match these filters.')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-5 dark:border-slate-800"
        >
          <p
            className="text-sm font-semibold text-slate-600 dark:text-slate-300"
          >{text('إجمالي المنتجات', 'Total products')}: {response.count} · {text('الفئات النشطة', 'Active categories')}: {categories.length}
          </p>
          <div
            className="flex flex-wrap items-center gap-3"
          >
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              {text('حجم الصفحة', 'Page size')}
              <select
                value={query.page_size}
                onChange={(event) => updateQuery('page_size', Number(event.target.value))}
                className={controlClass}
              >
                {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button
              type="button"
              aria-label={text('الصفحة السابقة', 'Previous page')}
              disabled={loading || query.page <= 1}
              onClick={() => updateQuery('page', query.page - 1)}
              className={buttonClass}
            >{isArabic ? <FiChevronRight /> : <FiChevronLeft />}
            </button>
            <span
              className="text-sm font-bold text-slate-700 dark:text-slate-200"
            >{query.page} / {pageCount}
            </span>
            <button
              type="button"
              aria-label={text('الصفحة التالية', 'Next page')}
              disabled={loading || query.page >= pageCount}
              onClick={() => updateQuery('page', query.page + 1)}
              className={buttonClass}
            >{isArabic ? <FiChevronLeft /> : <FiChevronRight />}
            </button>
          </div>
        </div>
      </fieldset>
    </section>
  );
}
