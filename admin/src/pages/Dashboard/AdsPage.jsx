import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  FiAlertCircle,
  FiCheck,
  FiEdit2,
  FiExternalLink,
  FiImage,
  FiLayers,
  FiLink,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiType,
  FiX,
} from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

import { useStateContext } from '../../contexts/ContextProvider';
import axiosInstance from '../../utils/axiosConfig';

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.results)) {
    return value.results;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  return [];
};

const getApiError = (error, fallback) => (
  error?.response?.data?.detail
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const initialForm = {
  section: '',
  product: '',
  text: '',
  background_color: '#FFFFFF',
  font_size: 14,
  text_color: 'black',
  image: null,
  link: '',
};

const AdsPage = () => {
  const { i18n } = useTranslation();
  const { currentColor } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    eyebrow: isArabic ? 'الإدارة' : 'Management',
    title: isArabic ? 'الإعلانات' : 'Advertisements',
    subtitle: isArabic
      ? 'إدارة إعلانات المتجر وربطها بالأقسام والمنتجات مع معاينة مباشرة.'
      : 'Manage store advertisements and link them to sections and products with live preview.',
    refresh: isArabic ? 'تحديث البيانات' : 'Refresh data',
    add: isArabic ? 'إضافة إعلان' : 'Add advertisement',
    total: isArabic ? 'إجمالي الإعلانات' : 'Total ads',
    withImage: isArabic ? 'إعلانات مع صورة' : 'Ads with image',
    withLink: isArabic ? 'إعلانات مع رابط' : 'Ads with link',
    sections: isArabic ? 'أقسام مستخدمة' : 'Used sections',
    search: isArabic
      ? 'ابحث بالنص أو القسم أو المنتج...'
      : 'Search by text, section, or product...',
    allSections: isArabic ? 'كل الأقسام' : 'All sections',
    empty: isArabic ? 'لا توجد إعلانات حالياً.' : 'No ads are available.',
    noResults: isArabic ? 'لا توجد نتائج مطابقة.' : 'No matching ads.',
    section: isArabic ? 'القسم' : 'Section',
    product: isArabic ? 'المنتج' : 'Product',
    text: isArabic ? 'نص الإعلان' : 'Ad text',
    background: isArabic ? 'الخلفية' : 'Background',
    fontSize: isArabic ? 'حجم الخط' : 'Font size',
    textColor: isArabic ? 'لون النص' : 'Text color',
    image: isArabic ? 'الصورة' : 'Image',
    link: isArabic ? 'الرابط' : 'Link',
    created: isArabic ? 'تاريخ الإنشاء' : 'Created at',
    edit: isArabic ? 'تعديل' : 'Edit',
    delete: isArabic ? 'حذف' : 'Delete',
    deleteSelected: isArabic ? 'حذف المحدد' : 'Delete selected',
    modalAdd: isArabic ? 'إضافة إعلان جديد' : 'Add advertisement',
    modalEdit: isArabic ? 'تعديل الإعلان' : 'Edit advertisement',
    preview: isArabic ? 'معاينة الإعلان' : 'Ad preview',
    chooseSection: isArabic ? 'اختر القسم' : 'Choose section',
    chooseProduct: isArabic ? 'اختر المنتج' : 'Choose product',
    uploadImage: isArabic ? 'اختر صورة' : 'Choose image',
    cancel: isArabic ? 'إلغاء' : 'Cancel',
    save: isArabic ? 'حفظ الإعلان' : 'Save ad',
    saving: isArabic ? 'جاري الحفظ...' : 'Saving...',
    loadFailed: isArabic ? 'تعذر تحميل الإعلانات.' : 'Failed to load ads.',
    saveFailed: isArabic ? 'تعذر حفظ الإعلان.' : 'Failed to save ad.',
    deleteFailed: isArabic ? 'تعذر حذف الإعلان.' : 'Failed to delete ad.',
    saveSuccess: isArabic ? 'تم حفظ الإعلان.' : 'Advertisement saved.',
    deleteSuccess: isArabic ? 'تم حذف الإعلان.' : 'Advertisement deleted.',
    deleteConfirm: isArabic
      ? 'هل تريد حذف الإعلان المحدد؟'
      : 'Delete the selected advertisement?',
    deleteManyConfirm: isArabic
      ? 'هل تريد حذف كل الإعلانات المحددة؟'
      : 'Delete all selected advertisements?',
    black: isArabic ? 'أسود' : 'Black',
    white: isArabic ? 'أبيض' : 'White',
  }), [isArabic]);

  const [adsData, setAdsData] = useState([]);
  const [sections, setSections] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [selectedAd, setSelectedAd] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [imagePreview, setImagePreview] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);

  const fetchAds = useCallback(async ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
    }

    setError('');

    try {
      const response = await axiosInstance.get('/system/ads/');
      setAdsData(normalizeList(response.data));
    } catch (fetchError) {
      setAdsData([]);
      setError(getApiError(fetchError, labels.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [labels.loadFailed]);

  const fetchDropdownData = useCallback(async () => {
    try {
      const [sectionsResponse, productsResponse] = await Promise.all([
        axiosInstance.get('/store/admin/sections/'),
        axiosInstance.get('/store/admin/products/'),
      ]);

      setSections(normalizeList(sectionsResponse.data));
      setProducts(normalizeList(productsResponse.data));
    } catch (dropdownError) {
      console.error('Error fetching dropdown data:', dropdownError);
    }
  }, []);

  useEffect(() => {
    fetchAds();
    fetchDropdownData();
  }, [fetchAds, fetchDropdownData]);

  const stats = useMemo(() => ({
    total: adsData.length,
    withImage: adsData.filter((item) => Boolean(item.image)).length,
    withLink: adsData.filter((item) => Boolean(item.link)).length,
    sections: new Set(
      adsData
        .map((item) => item.section || item.section_name)
        .filter(Boolean),
    ).size,
  }), [adsData]);

  const filteredAds = useMemo(() => {
    const needle = searchText.trim().toLowerCase();

    return adsData.filter((item) => {
      const matchesSection = (
        sectionFilter === 'all'
        || String(item.section) === sectionFilter
        || String(item.section_name) === sectionFilter
      );

      const matchesSearch = !needle || [
        item.text,
        item.section_name,
        item.product_name,
        item.link,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));

      return matchesSection && matchesSearch;
    });
  }, [adsData, searchText, sectionFilter]);

  const resetForm = () => {
    setFormData(initialForm);
    setImagePreview(null);
    setSelectedAd(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (ad) => {
    setSelectedAd(ad);
    setFormData({
      section: ad.section ?? '',
      product: ad.product ?? '',
      text: ad.text || '',
      background_color: ad.background_color || '#FFFFFF',
      font_size: ad.font_size || 14,
      text_color: ad.text_color || 'black',
      image: null,
      link: ad.link || '',
    });
    setImagePreview(ad.image || null);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);
    resetForm();
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      image: file,
    }));

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      setImagePreview(loadEvent.target?.result || null);
    };

    reader.readAsDataURL(file);
  };

  const buildSubmitData = () => {
    const submitData = new FormData();

    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== '') {
        submitData.append(key, value);
      }
    });

    return submitData;
  };

  const handleSaveAd = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const submitData = buildSubmitData();

      if (selectedAd) {
        await axiosInstance.put(
          `/system/ads/${selectedAd.id}/`,
          submitData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          },
        );
      } else {
        await axiosInstance.post(
          '/system/ads/',
          submitData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          },
        );
      }

      setNotice({
        type: 'success',
        message: labels.saveSuccess,
      });

      setShowModal(false);
      resetForm();
      await fetchAds({ background: true });
    } catch (saveError) {
      setNotice({
        type: 'error',
        message: getApiError(saveError, labels.saveFailed),
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteOne = async (ad) => {
    if (!window.confirm(labels.deleteConfirm)) {
      return;
    }

    try {
      await axiosInstance.delete(`/system/ads/${ad.id}/`);

      setNotice({
        type: 'success',
        message: labels.deleteSuccess,
      });

      setSelectedIds((previous) => (
        previous.filter((id) => id !== ad.id)
      ));

      await fetchAds({ background: true });
    } catch (deleteError) {
      setNotice({
        type: 'error',
        message: getApiError(deleteError, labels.deleteFailed),
      });
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) {
      return;
    }

    if (!window.confirm(labels.deleteManyConfirm)) {
      return;
    }

    try {
      await Promise.all(
        selectedIds.map((id) => axiosInstance.delete(`/system/ads/${id}/`)),
      );

      setSelectedIds([]);
      setNotice({
        type: 'success',
        message: labels.deleteSuccess,
      });

      await fetchAds({ background: true });
    } catch (deleteError) {
      setNotice({
        type: 'error',
        message: getApiError(deleteError, labels.deleteFailed),
      });
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds((previous) => (
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    ));
  };

  const formatDate = (value) => {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString(i18n.resolvedLanguage);
  };

  const StatCard = ({
    icon,
    label,
    value,
  }) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
      <div className="flex items-start justify-between gap-3">
        <div className="text-start">
          <p className="text-xs font-extrabold text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
            {value}
          </p>
        </div>

        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: `${accentColor}14`,
            color: accentColor,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );

  if (loading && !adsData.length) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <FiRefreshCw className="animate-spin text-3xl text-slate-400" />
      </div>
    );
  }

  return (
    <>
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        className="mt-20 px-3 py-4 sm:px-5 md:mt-4 md:px-8 md:py-6"
      >
        <div className="mx-auto w-full max-w-7xl space-y-5">
          <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg md:p-7">
            <div
              className="pointer-events-none absolute -end-20 -top-24 h-56 w-56 rounded-full opacity-[0.08]"
              style={{ backgroundColor: accentColor }}
            />

            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <FiLayers />
                </div>

                <div className="text-start">
                  <p
                    className="text-xs font-black uppercase tracking-[0.16em]"
                    style={{ color: accentColor }}
                  >
                    {labels.eyebrow}
                  </p>
                  <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
                    {labels.title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {labels.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => fetchAds({ background: true })}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                  {labels.refresh}
                </button>

                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: accentColor }}
                >
                  <FiPlus />
                  {labels.add}
                </button>
              </div>
            </div>
          </section>

          {notice && (
            <div
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
                notice.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              {notice.type === 'error'
                ? <FiAlertCircle className="mt-0.5" />
                : <FiCheck className="mt-0.5" style={{ color: accentColor }} />}
              <span className="flex-1 text-start">
                {notice.message}
              </span>
              <button type="button" onClick={() => setNotice(null)}>
                <FiX />
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <FiAlertCircle />
              <span className="flex-1 text-start">
                {error}
              </span>
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<FiLayers />}
              label={labels.total}
              value={stats.total}
            />
            <StatCard
              icon={<FiImage />}
              label={labels.withImage}
              value={stats.withImage}
            />
            <StatCard
              icon={<FiLink />}
              label={labels.withLink}
              value={stats.withLink}
            />
            <StatCard
              icon={<FiType />}
              label={labels.sections}
              value={stats.sections}
            />
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-start">
                <h2 className="text-lg font-black text-slate-950 dark:text-white">
                  {isArabic ? 'قائمة الإعلانات' : 'Advertisements list'}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {isArabic
                    ? 'ابحث أو فلتر حسب القسم ثم عدّل الإعلان مباشرة.'
                    : 'Search or filter by section, then edit an ad directly.'}
                </p>
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto">
                <div className="relative min-w-[260px]">
                  <FiSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder={labels.search}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white ps-10 pe-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>

                <select
                  value={sectionFilter}
                  onChange={(event) => setSectionFilter(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="all">
                    {labels.allSections}
                  </option>
                  {sections.map((section) => (
                    <option
                      key={section.id}
                      value={String(section.id)}
                    >
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20">
                <span className="text-sm font-black text-red-600 dark:text-red-300">
                  {isArabic
                    ? `${selectedIds.length} إعلان محدد`
                    : `${selectedIds.length} selected`}
                </span>

                <button
                  type="button"
                  onClick={deleteSelected}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white transition hover:bg-red-700"
                >
                  <FiTrash2 />
                  {labels.deleteSelected}
                </button>
              </div>
            )}
          </section>

          {!adsData.length ? (
            <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-secondary-dark-bg">
              <FiLayers className="mx-auto text-4xl text-slate-300" />
              <p className="mt-3 text-sm font-black text-slate-500 dark:text-slate-300">
                {labels.empty}
              </p>
            </section>
          ) : !filteredAds.length ? (
            <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-black text-slate-400 dark:border-slate-700 dark:bg-secondary-dark-bg">
              {labels.noResults}
            </section>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredAds.map((ad) => {
                const selected = selectedIds.includes(ad.id);

                return (
                  <article
                    key={ad.id}
                    className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition dark:bg-secondary-dark-bg ${
                      selected
                        ? 'border-red-300 dark:border-red-800'
                        : 'border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div
                      className="relative min-h-[150px] overflow-hidden p-5"
                      style={{
                        backgroundColor: ad.background_color || '#FFFFFF',
                        color: ad.text_color || 'black',
                      }}
                    >
                      {ad.image && (
                        <div
                          className="absolute inset-0 bg-cover bg-center opacity-20"
                          style={{ backgroundImage: `url(${ad.image})` }}
                        />
                      )}

                      <div className="relative z-10 flex min-h-[110px] flex-col justify-between gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/80 dark:text-slate-200">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleSelection(ad.id)}
                            />
                            #{ad.id}
                          </label>

                          <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/80 dark:text-slate-200">
                            {ad.font_size || 14}px
                          </div>
                        </div>

                        <p
                          className="max-w-2xl break-words font-black"
                          style={{ fontSize: `${ad.font_size || 14}px` }}
                        >
                          {ad.text || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.section}
                          </p>
                          <p className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">
                            {ad.section_name || ad.section || '—'}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.product}
                          </p>
                          <p className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">
                            {ad.product_name || ad.product || '—'}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.created}
                          </p>
                          <p className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">
                            {formatDate(ad.created_at)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.link}
                          </p>
                          {ad.link ? (
                            <a
                              href={ad.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex max-w-full items-center gap-2 text-sm font-black"
                              style={{ color: accentColor }}
                            >
                              <span className="truncate">
                                {ad.link}
                              </span>
                              <FiExternalLink className="shrink-0" />
                            </a>
                          ) : (
                            <p className="mt-2 text-sm font-black text-slate-400">
                              —
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => openEditModal(ad)}
                          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition hover:opacity-90"
                          style={{ backgroundColor: accentColor }}
                        >
                          <FiEdit2 />
                          {labels.edit}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteOne(ad)}
                          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-600 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                        >
                          <FiTrash2 />
                          {labels.delete}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:p-6">
              <div className="text-start">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">
                  {selectedAd ? labels.modalEdit : labels.modalAdd}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {isArabic
                    ? 'عدّل بيانات الإعلان وشاهد النتيجة قبل الحفظ.'
                    : 'Configure the ad and preview it before saving.'}
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSaveAd} className="space-y-5 p-5 md:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.section}
                  </span>
                  <select
                    name="section"
                    value={formData.section}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">
                      {labels.chooseSection}
                    </option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.product}
                  </span>
                  <select
                    name="product"
                    value={formData.product}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">
                      {labels.chooseProduct}
                    </option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                  {labels.text}
                </span>
                <textarea
                  name="text"
                  rows="3"
                  required
                  value={formData.text}
                  onChange={handleInputChange}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.background}
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="background_color"
                      value={formData.background_color}
                      onChange={handleInputChange}
                      className="h-11 w-12 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <input
                      type="text"
                      name="background_color"
                      dir="ltr"
                      value={formData.background_color}
                      onChange={handleInputChange}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.fontSize}
                  </span>
                  <input
                    type="number"
                    name="font_size"
                    min="8"
                    max="72"
                    value={formData.font_size}
                    onChange={handleInputChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.textColor}
                  </span>
                  <select
                    name="text_color"
                    value={formData.text_color}
                    onChange={handleInputChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="black">
                      {labels.black}
                    </option>
                    <option value="white">
                      {labels.white}
                    </option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                  {labels.image}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="mt-3 h-24 max-w-full rounded-2xl border border-slate-200 object-cover dark:border-slate-700"
                  />
                )}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                  {labels.link}
                </span>
                <input
                  type="url"
                  name="link"
                  dir="ltr"
                  value={formData.link}
                  onChange={handleInputChange}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <section className="rounded-3xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="mb-3 text-sm font-black text-slate-700 dark:text-slate-200">
                  {labels.preview}
                </p>
                <div
                  className="relative min-h-[140px] overflow-hidden rounded-2xl border border-slate-200 p-5 dark:border-slate-700"
                  style={{
                    backgroundColor: formData.background_color,
                    color: formData.text_color,
                  }}
                >
                  {imagePreview && (
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-20"
                      style={{ backgroundImage: `url(${imagePreview})` }}
                    />
                  )}
                  <p
                    className="relative z-10 font-black"
                    style={{ fontSize: `${formData.font_size || 14}px` }}
                  >
                    {formData.text || (isArabic ? 'نص الإعلان سيظهر هنا' : 'Ad text will appear here')}
                  </p>
                </div>
              </section>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                >
                  {labels.cancel}
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {saving ? <FiRefreshCw className="animate-spin" /> : <FiCheck />}
                  {saving ? labels.saving : labels.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdsPage;