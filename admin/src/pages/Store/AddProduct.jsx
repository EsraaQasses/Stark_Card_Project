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
  FiDollarSign,
  FiImage,
  FiLink,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
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

const mapApiFieldType = (apiType) => {
  const typeMap = {
    text: 'text',
    string: 'text',
    number: 'number',
    integer: 'number',
    email: 'email',
    phone: 'phone',
    tel: 'phone',
    id: 'id',
    identifier: 'id',
  };

  return typeMap[String(apiType || '').toLowerCase()] || 'text';
};

const getApiError = (error, fallback) => (
  error?.response?.data?.detail
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const AddProduct = () => {
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
    title: isArabic ? 'إضافة منتج جديد' : 'Add New Product',
    subtitle: isArabic
      ? 'أنشئ المنتج، اربطه بالقسم والمزود، وحدد التسعير والمتطلبات.'
      : 'Create the product, connect it to a section/provider, and configure pricing and requirements.',
    back: isArabic ? 'العودة للمنتجات' : 'Back to products',
    loadingMetadata: isArabic ? 'جاري تحميل بيانات المتجر...' : 'Loading store metadata...',
    basic: isArabic ? 'المعلومات الأساسية' : 'Basic Information',
    section: isArabic ? 'القسم' : 'Section',
    selectSection: isArabic ? 'اختر القسم الرئيسي للمنتج' : 'Select product section',
    nameAr: isArabic ? 'الاسم بالعربي' : 'Arabic name',
    nameEn: isArabic ? 'الاسم بالإنجليزي' : 'English name',
    descAr: isArabic ? 'الوصف بالعربي' : 'Arabic description',
    descEn: isArabic ? 'الوصف بالإنجليزي' : 'English description',
    active: isArabic ? 'نشط ومتاح للشراء' : 'Active and available for purchase',
    image: isArabic ? 'صورة المنتج' : 'Product Image',
    imageHint: isArabic
      ? 'PNG / JPG / JPEG / WEBP وبحد أقصى 5MB'
      : 'PNG / JPG / JPEG / WEBP up to 5MB',
    dropImage: isArabic
      ? 'اسحب وأسقط صورة المنتج هنا أو اضغط لاختيار ملف'
      : 'Drag & drop product image here or click to browse',
    removeImage: isArabic ? 'إزالة الصورة' : 'Remove image',
    pricing: isArabic ? 'التسعير والعملة' : 'Pricing & Currency',
    currency: isArabic ? 'العملة' : 'Currency',
    productType: isArabic ? 'نوع التسعير' : 'Pricing type',
    amountBased: isArabic ? 'حسب الكمية' : 'Amount based',
    customizationBased: isArabic ? 'حسب التخصيص' : 'Customization based',
    basePrice: isArabic ? 'سعر البيع' : 'Base selling price',
    minAmount: isArabic ? 'الحد الأدنى للكمية' : 'Minimum amount',
    maxAmount: isArabic ? 'الحد الأعلى للكمية' : 'Maximum amount',
    minAmountPrice: isArabic ? 'سعر الحد الأدنى' : 'Minimum amount price',
    customOptions: isArabic ? 'خيارات التخصيص' : 'Customization options',
    customPrices: isArabic ? 'أسعار التخصيص' : 'Customization prices',
    integration: isArabic ? 'ربط مزود API' : 'API Provider Integration',
    provider: isArabic ? 'المزود' : 'Provider',
    noProvider: isArabic ? 'بدون مزود API' : 'No API provider',
    providerProduct: isArabic ? 'منتج المزود' : 'Provider product',
    selectProviderProduct: isArabic ? 'اختر منتج المزود' : 'Select provider product',
    loadProviderProducts: isArabic ? 'تحميل منتجات المزود' : 'Load provider products',
    syncProviderProducts: isArabic ? 'مزامنة ثم تحديث' : 'Sync & refresh',
    providerSearch: isArabic ? 'ابحث ضمن منتجات المزود...' : 'Search provider products...',
    providerEmpty: isArabic
      ? 'لا توجد منتجات محملة لهذا المزود.'
      : 'No provider products loaded.',
    providerHint: isArabic
      ? 'لتسريع الصفحة لا تتم المزامنة تلقائياً عند اختيار المزود. اضغط "مزامنة ثم تحديث" فقط عند الحاجة.'
      : 'For faster loading, provider sync is not automatic. Use “Sync & refresh” only when needed.',
    requirements: isArabic ? 'متطلبات المنتج' : 'Product Requirements',
    requirementsHint: isArabic
      ? 'حقول يطلبها المنتج من المستخدم مثل المعرف أو رقم الهاتف.'
      : 'Fields required from the user, such as an ID or phone number.',
    reqName: isArabic ? 'اسم الحقل' : 'Field name',
    reqType: isArabic ? 'نوع الحقل' : 'Field type',
    reqPlaceholder: isArabic ? 'النص التوضيحي' : 'Placeholder',
    reqRequired: isArabic ? 'مطلوب' : 'Required',
    addRequirement: isArabic ? 'إضافة متطلب' : 'Add requirement',
    noRequirements: isArabic ? 'لا توجد متطلبات مضافة.' : 'No requirements added.',
    save: isArabic ? 'حفظ المنتج' : 'Save product',
    saving: isArabic ? 'جاري الحفظ...' : 'Saving...',
    loadFailed: isArabic ? 'تعذر تحميل بيانات الأقسام أو المزودين.' : 'Failed to load store metadata.',
    providerLoadFailed: isArabic ? 'تعذر تحميل منتجات المزود.' : 'Failed to load provider products.',
    syncFailed: isArabic ? 'فشلت مزامنة منتجات المزود.' : 'Provider product sync failed.',
    saveFailed: isArabic ? 'تعذر حفظ المنتج.' : 'Failed to save product.',
    saveSuccess: isArabic ? 'تم حفظ المنتج بنجاح.' : 'Product saved successfully.',
    imageType: isArabic ? 'الملف المختار ليس صورة.' : 'Selected file is not an image.',
    imageSize: isArabic ? 'حجم الصورة يجب أن يكون أقل من 5MB.' : 'Image must be smaller than 5MB.',
    requiredName: isArabic ? 'الاسم العربي والإنجليزي مطلوبان.' : 'Arabic and English names are required.',
    requiredSection: isArabic ? 'اختر قسم المنتج.' : 'Select a product section.',
    invalidPrice: isArabic ? 'سعر البيع يجب أن يكون صفراً أو أكبر.' : 'Base price must be zero or greater.',
  }), [isArabic]);

  const [sections, setSections] = useState([]);
  const [apis, setApis] = useState([]);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);

  const [apiProducts, setApiProducts] = useState([]);
  const [apiProductsLoading, setApiProductsLoading] = useState(false);
  const [apiProductsSyncing, setApiProductsSyncing] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const [newRequirement, setNewRequirement] = useState({
    field_name: '',
    field_type: 'text',
    is_required: true,
    placeholder: '',
    order: 0,
  });

  const [newProduct, setNewProduct] = useState({
    name_en: '',
    name_ar: '',
    description_en: '',
    description_ar: '',
    section: '',
    api_config: '',
    external_product: '',
    product_type: 'amount_based',
    currency: 'USD',
    base_price: 0,
    min_amount: 0,
    max_amount: 0,
    min_amount_price: 0,
    customization_options: '',
    customization_prices: '',
    image: null,
    is_active: true,
    requirements: [],
  });

  useEffect(() => {
    let active = true;

    const fetchMetadata = async () => {
      setMetadataLoading(true);

      const [sectionsResult, apisResult] = await Promise.allSettled([
        axiosInstance.get('store/admin/sections/'),
        axiosInstance.get('third_party_apis/apis/'),
      ]);

      if (!active) {
        return;
      }

      if (sectionsResult.status === 'fulfilled') {
        setSections(normalizeList(sectionsResult.value.data));
      }

      if (apisResult.status === 'fulfilled') {
        setApis(normalizeList(apisResult.value.data));
      }

      if (
        sectionsResult.status === 'rejected'
        && apisResult.status === 'rejected'
      ) {
        setError(labels.loadFailed);
      }

      setMetadataLoading(false);
    };

    fetchMetadata();

    return () => {
      active = false;
    };
  }, [labels.loadFailed]);

  useEffect(() => () => {
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  const updateProduct = (field, value) => {
    setNewProduct((previous) => ({
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

    setNewProduct((previous) => ({
      ...previous,
      image: file,
    }));
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview('');
    setNewProduct((previous) => ({
      ...previous,
      image: null,
    }));
  };

  const loadProviderProducts = async (apiId, { sync = false } = {}) => {
    if (!apiId) {
      setApiProducts([]);
      return;
    }

    setNotice(null);

    if (sync) {
      setApiProductsSyncing(true);
    } else {
      setApiProductsLoading(true);
    }

    try {
      if (sync) {
        await axiosInstance.post(
          `third_party_apis/apis/${apiId}/sync_products/`,
        );
      }

      const response = await axiosInstance.get(
        'store/admin/external-products/',
        {
          params: {
            api_id: apiId,
          },
        },
      );

      setApiProducts(normalizeList(response.data));
    } catch (providerError) {
      setApiProducts([]);
      setNotice({
        type: 'error',
        message: getApiError(
          providerError,
          sync ? labels.syncFailed : labels.providerLoadFailed,
        ),
      });
    } finally {
      setApiProductsLoading(false);
      setApiProductsSyncing(false);
    }
  };

  const handleApiChange = (apiId) => {
    setProviderSearch('');
    setApiProducts([]);

    setNewProduct((previous) => ({
      ...previous,
      api_config: apiId,
      external_product: '',
    }));

    if (apiId) {
      loadProviderProducts(apiId);
    }
  };

  const handleProviderProduct = (externalId) => {
    const selected = apiProducts.find(
      (item) => Number(item.id) === Number(externalId),
    );

    if (!selected) {
      updateProduct('external_product', externalId);
      return;
    }

    const requirements = Array.isArray(selected.required_fields_json)
      ? selected.required_fields_json.map((field, index) => {
        const fieldData = typeof field === 'object'
          ? field
          : {
            name: field,
            type: 'text',
            required: true,
          };

        return {
          field_name: fieldData.name || `field_${index}`,
          field_type: mapApiFieldType(fieldData.type),
          is_required: fieldData.required !== false,
          placeholder: fieldData.placeholder || '',
          order: index,
        };
      })
      : [];

    setNewProduct((previous) => ({
      ...previous,
      external_product: selected.id,
      name_en: selected.name || previous.name_en,
      name_ar: selected.name || previous.name_ar,
      description_en: selected.description || previous.description_en,
      description_ar: selected.description || previous.description_ar,
      base_price: Number(selected.base_price || previous.base_price || 0),
      requirements: requirements.length
        ? requirements
        : previous.requirements,
    }));
  };

  const filteredApiProducts = useMemo(() => {
    const needle = providerSearch.trim().toLowerCase();

    if (!needle) {
      return apiProducts;
    }

    return apiProducts.filter((product) => [
      product.name,
      product.name_ar,
      product.name_en,
      product.external_id,
      product.sku,
    ]
      .filter((value) => value !== null && value !== undefined)
      .some((value) => String(value).toLowerCase().includes(needle)));
  }, [apiProducts, providerSearch]);

  const addRequirement = () => {
    if (!newRequirement.field_name.trim()) {
      return;
    }

    setNewProduct((previous) => ({
      ...previous,
      requirements: [
        ...previous.requirements,
        {
          ...newRequirement,
          order: previous.requirements.length,
        },
      ],
    }));

    setNewRequirement({
      field_name: '',
      field_type: 'text',
      is_required: true,
      placeholder: '',
      order: 0,
    });
  };

  const removeRequirement = (index) => {
    setNewProduct((previous) => ({
      ...previous,
      requirements: previous.requirements.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  };

  const validate = () => {
    if (
      !newProduct.name_ar.trim()
      || !newProduct.name_en.trim()
    ) {
      setNotice({
        type: 'error',
        message: labels.requiredName,
      });
      return false;
    }

    if (!newProduct.section) {
      setNotice({
        type: 'error',
        message: labels.requiredSection,
      });
      return false;
    }

    if (
      Number.isNaN(Number(newProduct.base_price))
      || Number(newProduct.base_price) < 0
    ) {
      setNotice({
        type: 'error',
        message: labels.invalidPrice,
      });
      return false;
    }

    return true;
  };

  const handleSaveProduct = async (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const formData = new FormData();

      formData.append('name_en', newProduct.name_en);
      formData.append('name_ar', newProduct.name_ar);
      formData.append('description_en', newProduct.description_en);
      formData.append('description_ar', newProduct.description_ar);
      formData.append('section', newProduct.section);
      formData.append('product_type', newProduct.product_type);
      formData.append('currency', newProduct.currency);
      formData.append('base_price', String(newProduct.base_price));
      formData.append('is_active', String(newProduct.is_active));

      if (newProduct.api_config) {
        formData.append('api_config', newProduct.api_config);
      }

      if (newProduct.external_product) {
        formData.append('external_product', newProduct.external_product);
      }

      if (newProduct.product_type === 'amount_based') {
        formData.append('min_amount', String(newProduct.min_amount));
        formData.append('max_amount', String(newProduct.max_amount));
        formData.append(
          'min_amount_price',
          String(newProduct.min_amount_price),
        );
      }

      if (newProduct.product_type === 'customization_based') {
        formData.append(
          'customization_options',
          newProduct.customization_options,
        );
        formData.append(
          'customization_prices',
          newProduct.customization_prices,
        );
      }

      if (newProduct.image instanceof File) {
        formData.append('image', newProduct.image);
      }

      if (newProduct.requirements.length) {
        formData.append(
          'requirements',
          JSON.stringify(newProduct.requirements),
        );
      }

      await axiosInstance.post(
        'store/admin/products/',
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
        navigate('/products');
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
      <div className="mx-auto w-full max-w-7xl space-y-5">
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
                <FiPackage />
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
              onClick={() => navigate('/products')}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <FiArrowLeft className={isArabic ? 'rotate-180' : ''} />
              {labels.back}
            </button>
          </div>
        </section>

        {metadataLoading && (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-secondary-dark-bg dark:text-slate-300">
            <FiRefreshCw className="animate-spin" style={{ color: accentColor }} />
            {labels.loadingMetadata}
          </div>
        )}

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

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSaveProduct} className="space-y-5">
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
                    <FiPackage />
                  </div>
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {labels.basic}
                  </h2>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.section} *
                    </span>
                    <select
                      value={newProduct.section}
                      onChange={(event) => updateProduct('section', event.target.value)}
                      className={inputClass}
                    >
                      <option value="">
                        {labels.selectSection}
                      </option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {isArabic
                            ? (section.name_ar || section.name_en)
                            : (section.name_en || section.name_ar)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.nameAr} *
                      </span>
                      <input
                        type="text"
                        dir="rtl"
                        value={newProduct.name_ar}
                        onChange={(event) => updateProduct('name_ar', event.target.value)}
                        className={inputClass}
                        placeholder="مثال: ببجي موبايل 600 UC"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.nameEn} *
                      </span>
                      <input
                        type="text"
                        dir="ltr"
                        value={newProduct.name_en}
                        onChange={(event) => updateProduct('name_en', event.target.value)}
                        className={inputClass}
                        placeholder="Example: PUBG Mobile 600 UC"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.descAr}
                      </span>
                      <textarea
                        rows="4"
                        dir="rtl"
                        value={newProduct.description_ar}
                        onChange={(event) => updateProduct('description_ar', event.target.value)}
                        className={`${inputClass} resize-none`}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.descEn}
                      </span>
                      <textarea
                        rows="4"
                        dir="ltr"
                        value={newProduct.description_en}
                        onChange={(event) => updateProduct('description_en', event.target.value)}
                        className={`${inputClass} resize-none`}
                      />
                    </label>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="text-start">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                        {labels.active}
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={newProduct.is_active}
                      onChange={(event) => updateProduct('is_active', event.target.checked)}
                      className="h-5 w-5"
                    />
                  </label>
                </div>
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
                    <FiDollarSign />
                  </div>
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {labels.pricing}
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.currency} *
                    </span>
                    <select
                      value={newProduct.currency}
                      onChange={(event) => updateProduct('currency', event.target.value)}
                      className={inputClass}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="SYP">SYP</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.productType} *
                    </span>
                    <select
                      value={newProduct.product_type}
                      onChange={(event) => updateProduct('product_type', event.target.value)}
                      className={inputClass}
                    >
                      <option value="amount_based">
                        {labels.amountBased}
                      </option>
                      <option value="customization_based">
                        {labels.customizationBased}
                      </option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.basePrice} *
                    </span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={newProduct.base_price}
                      onChange={(event) => updateProduct('base_price', event.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>

                {newProduct.product_type === 'amount_based' && (
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.minAmount}
                      </span>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={newProduct.min_amount}
                        onChange={(event) => updateProduct('min_amount', event.target.value)}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.maxAmount}
                      </span>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={newProduct.max_amount}
                        onChange={(event) => updateProduct('max_amount', event.target.value)}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.minAmountPrice}
                      </span>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={newProduct.min_amount_price}
                        onChange={(event) => updateProduct('min_amount_price', event.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </div>
                )}

                {newProduct.product_type === 'customization_based' && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.customOptions}
                      </span>
                      <textarea
                        rows="4"
                        value={newProduct.customization_options}
                        onChange={(event) => updateProduct('customization_options', event.target.value)}
                        className={`${inputClass} resize-none`}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.customPrices}
                      </span>
                      <textarea
                        rows="4"
                        value={newProduct.customization_prices}
                        onChange={(event) => updateProduct('customization_prices', event.target.value)}
                        className={`${inputClass} resize-none`}
                      />
                    </label>
                  </div>
                )}
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
                    <FiLink />
                  </div>
                  <div className="text-start">
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">
                      {labels.integration}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {labels.providerHint}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.provider}
                    </span>
                    <select
                      value={newProduct.api_config}
                      onChange={(event) => handleApiChange(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">
                        {labels.noProvider}
                      </option>
                      {apis.map((api) => (
                        <option key={api.id} value={api.id}>
                          {api.name} ({api.provider})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      disabled={!newProduct.api_config || apiProductsLoading}
                      onClick={() => loadProviderProducts(newProduct.api_config)}
                      className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <FiRefreshCw className={apiProductsLoading ? 'animate-spin' : ''} />
                      {labels.loadProviderProducts}
                    </button>

                    <button
                      type="button"
                      disabled={!newProduct.api_config || apiProductsSyncing}
                      onClick={() => loadProviderProducts(
                        newProduct.api_config,
                        { sync: true },
                      )}
                      className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-40"
                      style={{ backgroundColor: accentColor }}
                    >
                      <FiRefreshCw className={apiProductsSyncing ? 'animate-spin' : ''} />
                      {labels.syncProviderProducts}
                    </button>
                  </div>
                </div>

                {newProduct.api_config && (
                  <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                    <div className="relative">
                      <FiSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="search"
                        value={providerSearch}
                        onChange={(event) => setProviderSearch(event.target.value)}
                        placeholder={labels.providerSearch}
                        className={`${inputClass} ps-10`}
                      />
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.providerProduct}
                      </span>
                      <select
                        value={newProduct.external_product}
                        onChange={(event) => handleProviderProduct(event.target.value)}
                        disabled={apiProductsLoading || apiProductsSyncing}
                        className={`${inputClass} disabled:opacity-50`}
                      >
                        <option value="">
                          {labels.selectProviderProduct}
                        </option>
                        {filteredApiProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name || product.name_en || `#${product.id}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    {!apiProducts.length && !apiProductsLoading && (
                      <p className="text-xs font-semibold text-slate-400">
                        {labels.providerEmpty}
                      </p>
                    )}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-5">
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
                    className={`flex min-h-[210px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center transition ${
                      isDragging
                        ? 'border-slate-500 bg-slate-100 dark:bg-slate-800'
                        : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40'
                    }`}
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Product preview"
                        className="max-h-[190px] w-full rounded-xl object-contain"
                      />
                    ) : (
                      <>
                        <FiUploadCloud className="text-4xl text-slate-300" />
                        <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-200">
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

              <section className={cardClass}>
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div className="text-start">
                    <h2 className="text-lg font-black text-slate-950 dark:text-white">
                      {labels.requirements}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {labels.requirementsHint}
                    </p>
                  </div>
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${accentColor}14`,
                      color: accentColor,
                    }}
                  >
                    <FiPlus />
                  </div>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={newRequirement.field_name}
                    onChange={(event) => setNewRequirement((previous) => ({
                      ...previous,
                      field_name: event.target.value,
                    }))}
                    placeholder={labels.reqName}
                    className={inputClass}
                  />

                  <select
                    value={newRequirement.field_type}
                    onChange={(event) => setNewRequirement((previous) => ({
                      ...previous,
                      field_type: event.target.value,
                    }))}
                    className={inputClass}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="id">ID</option>
                  </select>

                  <input
                    type="text"
                    value={newRequirement.placeholder}
                    onChange={(event) => setNewRequirement((previous) => ({
                      ...previous,
                      placeholder: event.target.value,
                    }))}
                    placeholder={labels.reqPlaceholder}
                    className={inputClass}
                  />

                  <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={newRequirement.is_required}
                      onChange={(event) => setNewRequirement((previous) => ({
                        ...previous,
                        is_required: event.target.checked,
                      }))}
                    />
                    {labels.reqRequired}
                  </label>

                  <button
                    type="button"
                    onClick={addRequirement}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <FiPlus />
                    {labels.addRequirement}
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {!newProduct.requirements.length ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-xs font-bold text-slate-400 dark:border-slate-700">
                      {labels.noRequirements}
                    </div>
                  ) : (
                    newProduct.requirements.map((requirement, index) => (
                      <div
                        key={`${requirement.field_name}-${index}`}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40"
                      >
                        <div className="min-w-0 text-start">
                          <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
                            {requirement.field_name}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {requirement.field_type}
                            {requirement.is_required ? ` • ${labels.reqRequired}` : ''}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRequirement(index)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </aside>
          </div>

          <section className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => navigate('/products')}
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

export default AddProduct;