import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiFolder,
  FiImage,
  FiInfo,
  FiRefreshCw,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

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

const AddSection = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { currentColor } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    eyebrow: isArabic ? 'إدارة المتجر' : 'Store Management',
    title: isArabic ? 'إضافة قسم جديد' : 'Add New Section',
    subtitle: isArabic
      ? 'أنشئ قسماً رئيسياً أو فرعياً ونظم محتوى المتجر.'
      : 'Create a main or child section to organize store content.',
    back: isArabic ? 'العودة للأقسام' : 'Back to sections',
    basic: isArabic ? 'المعلومات الأساسية' : 'Basic Information',
    nameAr: isArabic ? 'الاسم بالعربية' : 'Arabic name',
    nameEn: isArabic ? 'الاسم بالإنجليزية' : 'English name',
    description: isArabic ? 'الوصف' : 'Description',
    active: isArabic ? 'نشط ويظهر للعملاء في المتجر' : 'Active and visible in store',
    hierarchy: isArabic ? 'التصنيف الهرمي' : 'Hierarchy',
    parent: isArabic ? 'القسم الأب' : 'Parent section',
    mainSection: isArabic ? 'قسم رئيسي - بدون أب' : 'Main section - no parent',
    hierarchyHint: isArabic
      ? 'إذا اخترت قسماً أباً سيُنشأ هذا القسم كقسم فرعي تحته.'
      : 'Choosing a parent creates this as a child section.',
    image: isArabic ? 'صورة القسم' : 'Section Image',
    imageHint: isArabic
      ? 'PNG / JPG / JPEG / WEBP وبحد أقصى 5MB'
      : 'PNG / JPG / JPEG / WEBP up to 5MB',
    dropImage: isArabic
      ? 'اسحب وأسقط صورة القسم هنا أو اضغط لاختيار ملف'
      : 'Drag & drop section image here or click to browse',
    removeImage: isArabic ? 'إزالة الصورة' : 'Remove image',
    save: isArabic ? 'حفظ القسم' : 'Save section',
    saving: isArabic ? 'جاري الحفظ...' : 'Saving...',
    loadingParents: isArabic ? 'جاري تحميل الأقسام الرئيسية...' : 'Loading parent sections...',
    loadFailed: isArabic ? 'تعذر تحميل الأقسام الرئيسية.' : 'Failed to load parent sections.',
    saveFailed: isArabic ? 'تعذر حفظ القسم.' : 'Failed to save section.',
    saveSuccess: isArabic ? 'تم حفظ القسم بنجاح.' : 'Section saved successfully.',
    nameRequired: isArabic ? 'الاسم العربي والإنجليزي مطلوبان.' : 'Arabic and English names are required.',
    imageType: isArabic ? 'الملف المختار ليس صورة.' : 'Selected file is not an image.',
    imageSize: isArabic ? 'حجم الصورة يجب أن يكون أقل من 5MB.' : 'Image must be smaller than 5MB.',
  }), [isArabic]);

  const [sections, setSections] = useState([]);
  const [parentsLoading, setParentsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const [newSection, setNewSection] = useState({
    name_en: '',
    name_ar: '',
    description: '',
    image: null,
    father_section: '',
    is_active: true,
  });

  useEffect(() => {
    let active = true;

    const fetchSections = async () => {
      setParentsLoading(true);

      try {
        const response = await axiosInstance.get('store/admin/sections/');

        if (active) {
          setSections(normalizeList(response.data));
        }
      } catch (error) {
        if (active) {
          setNotice({
            type: 'error',
            message: getApiError(error, labels.loadFailed),
          });
        }
      } finally {
        if (active) {
          setParentsLoading(false);
        }
      }
    };

    fetchSections();

    return () => {
      active = false;
    };
  }, [labels.loadFailed]);

  useEffect(() => () => {
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  const updateSection = (field, value) => {
    setNewSection((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleImageFile = (file) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setNotice({
        type: 'error',
        message: labels.imageType,
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice({
        type: 'error',
        message: labels.imageSize,
      });
      return;
    }

    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview(URL.createObjectURL(file));
    updateSection('image', file);
  };

  const removeImage = () => {
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview('');
    updateSection('image', null);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (
      !newSection.name_ar.trim()
      || !newSection.name_en.trim()
    ) {
      setNotice({
        type: 'error',
        message: labels.nameRequired,
      });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const formData = new FormData();

      formData.append('name_en', newSection.name_en);
      formData.append('name_ar', newSection.name_ar);
      formData.append('description', newSection.description);
      formData.append('is_active', String(newSection.is_active));

      if (newSection.father_section) {
        formData.append('father_section', newSection.father_section);
      }

      if (newSection.image instanceof File) {
        formData.append('image', newSection.image);
      }

      await axiosInstance.post(
        'store/admin/sections/',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          transformRequest: (data) => data,
        },
      );

      setNotice({
        type: 'success',
        message: labels.saveSuccess,
      });

      window.setTimeout(() => {
        navigate('/sections');
      }, 500);
    } catch (saveError) {
      setNotice({
        type: 'error',
        message: getApiError(saveError, labels.saveFailed),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const mainSections = useMemo(() => (
    sections.filter((section) => !section.father_section)
  ), [sections]);

  const inputClass = `
    w-full rounded-xl border border-slate-200 bg-white px-4 py-3
    text-sm font-bold text-slate-800 outline-none transition
    focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950
    dark:text-white dark:focus:border-slate-500
  `;

  const cardClass = `
    rounded-3xl border border-slate-100 bg-white p-5 shadow-sm
    dark:border-slate-800 dark:bg-secondary-dark-bg md:p-6
  `;

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="mt-20 px-3 py-4 sm:px-5 md:mt-4 md:px-8 md:py-6"
    >
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg md:p-7">
          <div
            className="pointer-events-none absolute -end-24 -top-24 h-60 w-60 rounded-full opacity-[0.08]"
            style={{ backgroundColor: accentColor }}
          />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl text-white"
                style={{ backgroundColor: accentColor }}
              >
                <FiFolder />
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

            <button
              type="button"
              onClick={() => navigate('/sections')}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <FiArrowLeft className={isArabic ? 'rotate-180' : ''} />
              {labels.back}
            </button>
          </div>
        </section>

        {notice && (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
              notice.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'
                : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            {notice.type === 'error'
              ? <FiAlertCircle className="mt-0.5 shrink-0" />
              : <FiCheck className="mt-0.5 shrink-0" style={{ color: accentColor }} />}
            <span className="flex-1 text-start">
              {notice.message}
            </span>
            <button type="button" onClick={() => setNotice(null)}>
              <FiX />
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <section className={cardClass}>
                <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${accentColor}14`,
                      color: accentColor,
                    }}
                  >
                    <FiFolder />
                  </div>

                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {labels.basic}
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.nameAr} *
                    </span>
                    <input
                      type="text"
                      dir="rtl"
                      value={newSection.name_ar}
                      onChange={(event) => updateSection('name_ar', event.target.value)}
                      className={inputClass}
                      placeholder="مثال: ألعاب الموبايل"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.nameEn} *
                    </span>
                    <input
                      type="text"
                      dir="ltr"
                      value={newSection.name_en}
                      onChange={(event) => updateSection('name_en', event.target.value)}
                      className={inputClass}
                      placeholder="Example: Mobile Gaming"
                    />
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.description}
                  </span>
                  <textarea
                    rows="5"
                    value={newSection.description}
                    onChange={(event) => updateSection('description', event.target.value)}
                    className={`${inputClass} resize-none`}
                    placeholder={
                      isArabic
                        ? 'وصف تفصيلي للقسم...'
                        : 'Detailed section description...'
                    }
                  />
                </label>

                <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {labels.active}
                  </span>

                  <input
                    type="checkbox"
                    checked={newSection.is_active}
                    onChange={(event) => updateSection(
                      'is_active',
                      event.target.checked,
                    )}
                    className="h-5 w-5"
                  />
                </label>
              </section>

              <section className={cardClass}>
                <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${accentColor}14`,
                      color: accentColor,
                    }}
                  >
                    <FiInfo />
                  </div>

                  <div className="text-start">
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">
                      {labels.hierarchy}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {labels.hierarchyHint}
                    </p>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.parent}
                  </span>

                  <select
                    value={newSection.father_section}
                    onChange={(event) => updateSection(
                      'father_section',
                      event.target.value,
                    )}
                    disabled={parentsLoading}
                    className={`${inputClass} disabled:opacity-50`}
                  >
                    <option value="">
                      {parentsLoading
                        ? labels.loadingParents
                        : labels.mainSection}
                    </option>

                    {mainSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {isArabic
                          ? (section.name_ar || section.name_en)
                          : (section.name_en || section.name_ar)}
                      </option>
                    ))}
                  </select>
                </label>

                {parentsLoading && (
                  <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <FiRefreshCw className="animate-spin" />
                    {labels.loadingParents}
                  </p>
                )}
              </section>
            </div>

            <aside>
              <section className={cardClass}>
                <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${accentColor}14`,
                      color: accentColor,
                    }}
                  >
                    <FiImage />
                  </div>

                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {labels.image}
                  </h2>
                </div>

                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    handleImageFile(event.dataTransfer.files?.[0]);
                  }}
                  className="block cursor-pointer"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageFile(event.target.files?.[0])}
                    className="hidden"
                  />

                  <div
                    className={`flex min-h-[260px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center transition ${
                      isDragging
                        ? 'border-slate-500 bg-slate-100 dark:bg-slate-800'
                        : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40'
                    }`}
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Section preview"
                        className="max-h-[235px] w-full rounded-xl object-contain"
                      />
                    ) : (
                      <>
                        <FiUploadCloud className="text-5xl text-slate-300" />
                        <p className="mt-4 text-sm font-black text-slate-700 dark:text-slate-200">
                          {labels.dropImage}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-slate-400">
                          {labels.imageHint}
                        </p>
                      </>
                    )}
                  </div>
                </label>

                {imagePreview && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                  >
                    <FiTrash2 />
                    {labels.removeImage}
                  </button>
                )}
              </section>
            </aside>
          </div>

          <section className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => navigate('/sections')}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                {labels.back}
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {submitting
                  ? <FiRefreshCw className="animate-spin" />
                  : <FiCheck />}
                {submitting ? labels.saving : labels.save}
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
};

export default AddSection;