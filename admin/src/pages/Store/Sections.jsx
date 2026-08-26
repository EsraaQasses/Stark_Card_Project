import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  FiAlertCircle,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiFolder,
  FiGrid,
  FiImage,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
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

const initialSection = {
  name_en: '',
  name_ar: '',
  description: '',
  image: null,
  father_section: '',
  is_active: true,
};

const getApiError = (error, fallback) => (
  error?.response?.data?.detail
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const SECTIONS_CACHE_KEY = (
  'stark-admin-sections'
);

const readSectionsCache = () => {
  try {
    const cached = sessionStorage.getItem(
      SECTIONS_CACHE_KEY,
    );

    if (!cached) {
      return [];
    }

    const parsed = JSON.parse(cached);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
};

const writeSectionsCache = (sections) => {
  try {
    sessionStorage.setItem(
      SECTIONS_CACHE_KEY,
      JSON.stringify(sections),
    );
  } catch {
    // Ignore cache errors.
  }
};
const StoreSections = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentColor } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    eyebrow: isArabic ? 'إدارة المتجر' : 'Store Management',
    title: isArabic ? 'أقسام المتجر' : 'Store Sections',
    subtitle: isArabic
      ? 'إدارة الأقسام الرئيسية والفرعية وحالة الظهور وعدد المنتجات.'
      : 'Manage main and child sections, visibility, and product counts.',
    refresh: isArabic ? 'تحديث البيانات' : 'Refresh data',
    add: isArabic ? 'إضافة قسم' : 'Add section',
    total: isArabic ? 'إجمالي الأقسام' : 'Total sections',
    active: isArabic ? 'الأقسام النشطة' : 'Active sections',
    products: isArabic ? 'إجمالي المنتجات' : 'Total products',
    main: isArabic ? 'الأقسام الرئيسية' : 'Main sections',
    child: isArabic ? 'الأقسام الفرعية' : 'Child sections',
    search: isArabic
      ? 'ابحث بالاسم أو الوصف أو المعرف...'
      : 'Search by name, description, or ID...',
    allStatuses: isArabic ? 'جميع الحالات' : 'All statuses',
    activeLabel: isArabic ? 'نشط' : 'Active',
    inactiveLabel: isArabic ? 'غير نشط' : 'Inactive',
    clear: isArabic ? 'مسح الفلاتر' : 'Clear filters',
    image: isArabic ? 'الصورة' : 'Image',
    sectionDetails: isArabic ? 'تفاصيل القسم' : 'Section details',
    type: isArabic ? 'النوع' : 'Type',
    created: isArabic ? 'تاريخ الإنشاء' : 'Created at',
    status: isArabic ? 'الحالة' : 'Status',
    actions: isArabic ? 'الإجراءات' : 'Actions',
    mainLabel: isArabic ? 'رئيسي' : 'Main',
    childLabel: isArabic ? 'فرعي' : 'Child',
    edit: isArabic ? 'تعديل' : 'Edit',
    viewProducts: isArabic ? 'المنتجات' : 'Products',
    hide: isArabic ? 'إخفاء' : 'Hide',
    show: isArabic ? 'إظهار' : 'Show',
    delete: isArabic ? 'حذف' : 'Delete',
    empty: isArabic
      ? 'لا توجد أقسام مطابقة للفلاتر الحالية.'
      : 'No sections match the current filters.',
    pageSize: isArabic ? 'عدد العناصر' : 'Page size',
    modalEdit: isArabic ? 'تعديل القسم' : 'Edit section',
    nameEn: isArabic ? 'الاسم بالإنجليزية' : 'English name',
    nameAr: isArabic ? 'الاسم بالعربية' : 'Arabic name',
    description: isArabic ? 'الوصف' : 'Description',
    parent: isArabic ? 'القسم الأب' : 'Parent section',
    noParent: isArabic ? 'قسم رئيسي' : 'Main section',
    imageFile: isArabic ? 'صورة القسم' : 'Section image',
    activeSection: isArabic ? 'القسم مفعّل' : 'Section is active',
    cancel: isArabic ? 'إلغاء' : 'Cancel',
    save: isArabic ? 'حفظ التعديلات' : 'Save changes',
    saving: isArabic ? 'جاري الحفظ...' : 'Saving...',
    loadFailed: isArabic ? 'تعذر تحميل الأقسام.' : 'Failed to load sections.',
    saveFailed: isArabic ? 'تعذر حفظ القسم.' : 'Failed to save section.',
    saveSuccess: isArabic ? 'تم حفظ القسم بنجاح.' : 'Section saved successfully.',
    deleteFailed: isArabic ? 'تعذر حذف القسم.' : 'Failed to delete section.',
    deleteSuccess: isArabic ? 'تم حذف القسم.' : 'Section deleted.',
    statusFailed: isArabic ? 'تعذر تحديث حالة القسم.' : 'Failed to update section status.',
    deleteConfirm: isArabic ? 'هل تريد حذف هذا القسم نهائياً؟' : 'Delete this section permanently?',
    imageError: isArabic ? 'يجب اختيار صورة بحجم أقل من 5MB.' : 'Choose an image smaller than 5MB.',
  }), [isArabic]);

  const [sections, setSections] = useState(
    () => readSectionsCache(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialSection);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchSections = useCallback(async ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
    }

    setError('');

    try {
      const response = await axiosInstance.get('store/admin/sections/');
      const nextSections = normalizeList(
        response.data,
      );

      setSections(nextSections);
      writeSectionsCache(nextSections);
    } catch (fetchError) {
      setSections([]);
      setError(getApiError(fetchError, labels.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [labels.loadFailed]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: sections.length,
    active: sections.filter((item) => item.is_active).length,
    products: sections.reduce(
      (sum, item) => sum + Number(item.products_count || 0),
      0,
    ),
    main: sections.filter((item) => !item.father_section).length,
    child: sections.filter((item) => Boolean(item.father_section)).length,
  }), [sections]);

  const filteredSections = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();

    return sections.filter((section) => {
      if (
        statusFilter !== 'All'
        && section.is_active !== (statusFilter === 'Active')
      ) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        section.id,
        section.name_en,
        section.name_ar,
        section.description,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [searchQuery, sections, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSections.length / pageSize),
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedSections = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSections.slice(start, start + pageSize);
  }, [currentPage, filteredSections, pageSize]);

  const getImageUrl = (image) => {
    if (!image) {
      return null;
    }

    if (String(image).startsWith('http')) {
      return image;
    }

    return `/media${image}`;
  };

  const getSectionName = (section) => (
    isArabic
      ? (section.name_ar || section.name_en || '—')
      : (section.name_en || section.name_ar || '—')
  );

  const getParentName = (parentId) => {
    if (!parentId) {
      return labels.mainLabel;
    }

    const parent = sections.find(
      (item) => Number(item.id) === Number(parentId),
    );

    return parent ? getSectionName(parent) : `#${parentId}`;
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

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setCurrentPage(1);
  };

  const openEdit = (section) => {
    setEditingSection(section);
    setFormData({
      name_en: section.name_en || '',
      name_ar: section.name_ar || '',
      description: section.description || '',
      image: null,
      father_section: section.father_section || '',
      is_active: section.is_active !== false,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingSection(null);
    setFormData(initialSection);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setFormData((previous) => ({
        ...previous,
        image: null,
      }));
      return;
    }

    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      window.alert(labels.imageError);
      event.target.value = '';
      return;
    }

    setFormData((previous) => ({
      ...previous,
      image: file,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!editingSection) {
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const payload = new FormData();

      payload.append('name_en', formData.name_en);
      payload.append('name_ar', formData.name_ar);
      payload.append('description', formData.description);
      payload.append('is_active', String(formData.is_active));

      if (formData.father_section) {
        payload.append('father_section', formData.father_section);
      }

      if (formData.image instanceof File) {
        payload.append('image', formData.image);
      }

      await axiosInstance.patch(
        `store/admin/sections/${editingSection.id}/`,
        payload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      setShowModal(false);
      setEditingSection(null);
      setFormData(initialSection);
      setNotice({
        type: 'success',
        message: labels.saveSuccess,
      });
      await fetchSections({ background: true });
    } catch (saveError) {
      setNotice({
        type: 'error',
        message: getApiError(saveError, labels.saveFailed),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (section) => {
    try {
      await axiosInstance.patch(
        `store/admin/sections/${section.id}/`,
        { is_active: !section.is_active },
      );

      setSections((previous) => previous.map((item) => (
        item.id === section.id
          ? { ...item, is_active: !section.is_active }
          : item
      )));
    } catch (statusError) {
      setNotice({
        type: 'error',
        message: getApiError(statusError, labels.statusFailed),
      });
    }
  };

  const handleDelete = async (section) => {
    if (!window.confirm(labels.deleteConfirm)) {
      return;
    }

    try {
      await axiosInstance.delete(`store/admin/sections/${section.id}/`);
      setSections((previous) => previous.filter(
        (item) => item.id !== section.id,
      ));
      setNotice({
        type: 'success',
        message: labels.deleteSuccess,
      });
    } catch (deleteError) {
      setNotice({
        type: 'error',
        message: getApiError(deleteError, labels.deleteFailed),
      });
    }
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

  if (loading && !sections.length) {
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
              className="pointer-events-none absolute -end-24 -top-24 h-60 w-60 rounded-full opacity-[0.08]"
              style={{ backgroundColor: accentColor }}
            />

            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <FiGrid />
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
                  onClick={() => fetchSections({ background: true })}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                  {labels.refresh}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/section/add')}
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

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              icon={<FiGrid />}
              label={labels.total}
              value={stats.total}
            />
            <StatCard
              icon={<FiCheck />}
              label={labels.active}
              value={stats.active}
            />
            <StatCard
              icon={<FiPackage />}
              label={labels.products}
              value={stats.products}
            />
            <StatCard
              icon={<FiFolder />}
              label={labels.main}
              value={stats.main}
            />
            <StatCard
              icon={<FiFolder />}
              label={labels.child}
              value={stats.child}
            />
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-start">
                <h2 className="text-lg font-black text-slate-950 dark:text-white">
                  {labels.title}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {isArabic
                    ? 'بحث وفلترة سريعة بدون الجدول القديم الثقيل.'
                    : 'Fast search and filtering without the old heavy grid.'}
                </p>
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto">
                <div className="relative min-w-[260px]">
                  <FiSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={labels.search}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white ps-10 pe-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="All">{labels.allStatuses}</option>
                  <option value="Active">{labels.activeLabel}</option>
                  <option value="Inactive">{labels.inactiveLabel}</option>
                </select>

                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value={10}>{labels.pageSize}: 10</option>
                  <option value={20}>{labels.pageSize}: 20</option>
                  <option value={50}>{labels.pageSize}: 50</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                {labels.clear}
              </button>
            </div>
          </section>

          {!filteredSections.length ? (
            <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-black text-slate-400 dark:border-slate-700 dark:bg-secondary-dark-bg">
              {labels.empty}
            </section>
          ) : (
            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/60">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">#</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.image}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.sectionDetails}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.products}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.type}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.created}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.status}</th>
                      <th className="px-4 py-3 text-center text-xs font-black text-slate-400">{labels.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedSections.map((section) => {
                      const imageUrl = getImageUrl(section.image);
                      const name = getSectionName(section);

                      return (
                        <tr
                          key={section.id}
                          className="transition hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
                        >
                          <td className="px-4 py-4 text-sm font-black text-slate-400">
                            {section.id}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <FiImage className="text-slate-300" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-start">
                            <p className="max-w-[240px] truncate text-sm font-black text-slate-900 dark:text-white">
                              {name}
                            </p>
                            <p className="mt-1 max-w-[240px] truncate text-xs font-semibold text-slate-400">
                              {section.description || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-sm font-black text-slate-800 dark:text-slate-100">
                            {section.products_count || 0}
                          </td>
                          <td className="px-4 py-4 text-start">
                            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                              {section.father_section
                                ? labels.childLabel
                                : labels.mainLabel}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              {section.father_section
                                ? getParentName(section.father_section)
                                : '—'}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-sm font-bold text-slate-500 dark:text-slate-400">
                            {formatDate(section.created_at)}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                                section.is_active
                                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                  : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                              }`}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{
                                  backgroundColor: section.is_active
                                    ? accentColor
                                    : '#ef4444',
                                }}
                              />
                              {section.is_active
                                ? labels.activeLabel
                                : labels.inactiveLabel}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEdit(section)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition hover:opacity-90"
                                style={{ backgroundColor: accentColor }}
                                title={labels.edit}
                              >
                                <FiEdit2 />
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/products?section=${section.id}`)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                title={labels.viewProducts}
                              >
                                <FiPackage />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStatus(section)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                title={section.is_active ? labels.hide : labels.show}
                              >
                                {section.is_active ? <FiEyeOff /> : <FiEye />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(section)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                                title={labels.delete}
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-bold text-slate-400">
                  {isArabic
                    ? `عرض ${(currentPage - 1) * pageSize + 1} إلى ${Math.min(currentPage * pageSize, filteredSections.length)} من ${filteredSections.length}`
                    : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, filteredSections.length)} of ${filteredSections.length}`}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                  >
                    {isArabic ? <FiChevronRight /> : <FiChevronLeft />}
                  </button>
                  <span className="min-w-[80px] text-center text-sm font-black text-slate-700 dark:text-slate-200">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                  >
                    {isArabic ? <FiChevronLeft /> : <FiChevronRight />}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {showModal && editingSection && (
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:p-6">
              <div className="text-start">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">
                  {labels.modalEdit}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  #{editingSection.id} • {getSectionName(editingSection)}
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

            <form onSubmit={handleSave} className="space-y-5 p-5 md:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.nameEn}
                  </span>
                  <input
                    type="text"
                    required
                    value={formData.name_en}
                    onChange={(event) => setFormData((previous) => ({
                      ...previous,
                      name_en: event.target.value,
                    }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.nameAr}
                  </span>
                  <input
                    type="text"
                    required
                    value={formData.name_ar}
                    onChange={(event) => setFormData((previous) => ({
                      ...previous,
                      name_ar: event.target.value,
                    }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                  {labels.description}
                </span>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(event) => setFormData((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.parent}
                  </span>
                  <select
                    value={formData.father_section}
                    onChange={(event) => setFormData((previous) => ({
                      ...previous,
                      father_section: event.target.value,
                    }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">{labels.noParent}</option>
                    {sections
                      .filter((item) => item.id !== editingSection.id)
                      .map((section) => (
                        <option key={section.id} value={section.id}>
                          {getSectionName(section)}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.imageFile}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  />
                </label>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(event) => setFormData((previous) => ({
                    ...previous,
                    is_active: event.target.checked,
                  }))}
                />
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {labels.activeSection}
                </span>
              </label>

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

export default StoreSections;