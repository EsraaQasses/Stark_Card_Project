import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  FiAlertCircle,
  FiBox,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiFilter,
  FiImage,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const initialProduct = {
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
};

const initialRequirement = {
  field_name: '',
  field_type: 'text',
  is_required: true,
  placeholder: '',
  order: 0,
};

const getApiError = (error, fallback) => (
  error?.response?.data?.detail
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const ProductsPage = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentColor } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    eyebrow: isArabic ? 'إدارة المتجر' : 'Store Management',
    title: isArabic ? 'قائمة المنتجات' : 'Products List',
    subtitle: isArabic
      ? 'إدارة المنتجات، الأسعار، الربط مع مزودي API، وحالة الظهور.'
      : 'Manage products, pricing, API integrations, and visibility.',
    refresh: isArabic ? 'تحديث البيانات' : 'Refresh data',
    add: isArabic ? 'إضافة منتج' : 'Add product',
    total: isArabic ? 'إجمالي المنتجات' : 'Total products',
    active: isArabic ? 'المنتجات النشطة' : 'Active products',
    usd: isArabic ? 'منتجات الدولار' : 'USD products',
    syp: isArabic ? 'منتجات الليرة' : 'SYP products',
    amountBased: isArabic ? 'حسب الكمية' : 'Amount based',
    customization: isArabic ? 'حسب التخصيص' : 'Customization based',
    search: isArabic
      ? 'ابحث بالاسم أو الوصف أو المعرف...'
      : 'Search by name, description, or ID...',
    allSections: isArabic ? 'جميع الأقسام' : 'All sections',
    allStatuses: isArabic ? 'جميع الحالات' : 'All statuses',
    allCurrencies: isArabic ? 'جميع العملات' : 'All currencies',
    allTypes: isArabic ? 'جميع الأنواع' : 'All types',
    activeLabel: isArabic ? 'نشط' : 'Active',
    inactiveLabel: isArabic ? 'غير نشط' : 'Inactive',
    clear: isArabic ? 'مسح الفلاتر' : 'Clear filters',
    image: isArabic ? 'الصورة' : 'Image',
    name: isArabic ? 'اسم المنتج' : 'Product name',
    section: isArabic ? 'القسم' : 'Section',
    price: isArabic ? 'السعر' : 'Price',
    type: isArabic ? 'النوع' : 'Type',
    api: 'API',
    status: isArabic ? 'الحالة' : 'Status',
    actions: isArabic ? 'الإجراءات' : 'Actions',
    edit: isArabic ? 'تعديل' : 'Edit',
    requirements: isArabic ? 'المتطلبات' : 'Requirements',
    show: isArabic ? 'إظهار' : 'Show',
    hide: isArabic ? 'إخفاء' : 'Hide',
    delete: isArabic ? 'حذف' : 'Delete',
    empty: isArabic
      ? 'لا توجد منتجات مطابقة للفلاتر الحالية.'
      : 'No products match the current filters.',
    pageSize: isArabic ? 'عدد العناصر' : 'Page size',
    modalAdd: isArabic ? 'إضافة منتج جديد' : 'Add product',
    modalEdit: isArabic ? 'تعديل المنتج' : 'Edit product',
    basicInfo: isArabic ? 'البيانات الأساسية' : 'Basic information',
    pricing: isArabic ? 'التسعير' : 'Pricing',
    integration: isArabic ? 'ربط مزود API' : 'API integration',
    productRequirements: isArabic ? 'متطلبات المنتج' : 'Product requirements',
    nameEn: isArabic ? 'الاسم بالإنجليزية' : 'English name',
    nameAr: isArabic ? 'الاسم بالعربية' : 'Arabic name',
    descEn: isArabic ? 'الوصف بالإنجليزية' : 'English description',
    descAr: isArabic ? 'الوصف بالعربية' : 'Arabic description',
    productType: isArabic ? 'نوع المنتج' : 'Product type',
    currency: isArabic ? 'العملة' : 'Currency',
    basePrice: isArabic ? 'السعر الأساسي' : 'Base price',
    minAmount: isArabic ? 'الحد الأدنى للكمية' : 'Minimum amount',
    maxAmount: isArabic ? 'الحد الأعلى للكمية' : 'Maximum amount',
    minAmountPrice: isArabic ? 'سعر الحد الأدنى' : 'Minimum amount price',
    customizationOptions: isArabic ? 'خيارات التخصيص' : 'Customization options',
    customizationPrices: isArabic ? 'أسعار التخصيص' : 'Customization prices',
    imageFile: isArabic ? 'صورة المنتج' : 'Product image',
    provider: isArabic ? 'مزود API' : 'API provider',
    externalProduct: isArabic ? 'المنتج الخارجي' : 'External product',
    noProvider: isArabic ? 'بدون مزود' : 'No provider',
    selectExternal: isArabic ? 'اختر المنتج الخارجي' : 'Select external product',
    syncingProvider: isArabic ? 'جاري جلب منتجات المزود...' : 'Loading provider products...',
    activeProduct: isArabic ? 'المنتج مفعّل' : 'Product is active',
    fieldName: isArabic ? 'اسم الحقل' : 'Field name',
    fieldType: isArabic ? 'نوع الحقل' : 'Field type',
    placeholder: isArabic ? 'النص التوضيحي' : 'Placeholder',
    required: isArabic ? 'مطلوب' : 'Required',
    addRequirement: isArabic ? 'إضافة متطلب' : 'Add requirement',
    noRequirements: isArabic ? 'لا توجد متطلبات.' : 'No requirements.',
    remove: isArabic ? 'إزالة' : 'Remove',
    cancel: isArabic ? 'إلغاء' : 'Cancel',
    save: isArabic ? 'حفظ' : 'Save',
    saving: isArabic ? 'جاري الحفظ...' : 'Saving...',
    loadFailed: isArabic ? 'تعذر تحميل بيانات المنتجات.' : 'Failed to load products.',
    saveFailed: isArabic ? 'تعذر حفظ المنتج.' : 'Failed to save product.',
    saveSuccess: isArabic ? 'تم حفظ المنتج بنجاح.' : 'Product saved successfully.',
    deleteFailed: isArabic ? 'تعذر حذف المنتج.' : 'Failed to delete product.',
    deleteSuccess: isArabic ? 'تم حذف المنتج.' : 'Product deleted.',
    statusFailed: isArabic ? 'تعذر تحديث حالة المنتج.' : 'Failed to update product status.',
    deleteConfirm: isArabic ? 'هل تريد حذف هذا المنتج نهائياً؟' : 'Delete this product permanently?',
    imageError: isArabic ? 'يجب اختيار صورة بحجم أقل من 5MB.' : 'Choose an image smaller than 5MB.',
  }), [isArabic]);

  const [products, setProducts] = useState([]);
  const [sections, setSections] = useState([]);
  const [apis, setApis] = useState([]);
  const [apiProducts, setApiProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingApiProducts, setLoadingApiProducts] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState(initialProduct);
  const [newRequirement, setNewRequirement] = useState(initialRequirement);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    section: searchParams.get('section') || 'All',
    status: 'All',
    currency: 'All',
    product_type: 'All',
  });
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = useCallback(async ({
    background = false,
  } = {}) => {
    if (!background) {
      setLoading(true);
    }

    setError('');

    /*
    * الأقسام والـ APIs بيانات مساعدة.
    * ما لازم نوقف ظهور صفحة المنتجات عليهم.
    */
    Promise.allSettled([
      axiosInstance.get(
        'store/admin/sections/',
      ),

      axiosInstance.get(
        'third_party_apis/apis/',
      ),
    ]).then(([
      sectionsResult,
      apisResult,
    ]) => {
      if (
        sectionsResult.status
        === 'fulfilled'
      ) {
        setSections(
          normalizeList(
            sectionsResult.value.data,
          ),
        );
      }

      if (
        apisResult.status
        === 'fulfilled'
      ) {
        setApis(
          normalizeList(
            apisResult.value.data,
          ),
        );
      }
    });

    /*
    * هاد الطلب الوحيد اللي مننتظره
    * حتى نظهر جدول المنتجات.
    */
    try {
      const response = await axiosInstance.get(
        'store/admin/products/',
      );

      setProducts(
        normalizeList(response.data),
      );
    } catch (fetchError) {
      setProducts([]);

      setError(
        getApiError(
          fetchError,
          labels.loadFailed,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [labels.loadFailed]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize, searchQuery]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter((item) => item.is_active).length,
    usd: products.filter((item) => item.currency === 'USD').length,
    syp: products.filter((item) => item.currency === 'SYP').length,
    amountBased: products.filter(
      (item) => item.product_type === 'amount_based',
    ).length,
    customization: products.filter(
      (item) => item.product_type === 'customization_based',
    ).length,
  }), [products]);

  const filteredProducts = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      if (
        filters.section !== 'All'
        && Number(product.section) !== Number(filters.section)
      ) {
        return false;
      }

      if (
        filters.status !== 'All'
        && product.is_active !== (filters.status === 'Active')
      ) {
        return false;
      }

      if (
        filters.currency !== 'All'
        && product.currency !== filters.currency
      ) {
        return false;
      }

      if (
        filters.product_type !== 'All'
        && product.product_type !== filters.product_type
      ) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        product.id,
        product.name_en,
        product.name_ar,
        product.description_en,
        product.description_ar,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [filters, products, searchQuery]);

  const sortedProducts = useMemo(() => {
    const copy = [...filteredProducts];

    copy.sort((first, second) => {
      let firstValue = first[sortBy];
      let secondValue = second[sortBy];

      if (sortBy === 'name') {
        firstValue = isArabic
          ? (first.name_ar || first.name_en || '')
          : (first.name_en || first.name_ar || '');
        secondValue = isArabic
          ? (second.name_ar || second.name_en || '')
          : (second.name_en || second.name_ar || '');
      }

      if (typeof firstValue === 'string') {
        const comparison = firstValue.localeCompare(String(secondValue || ''));
        return sortOrder === 'asc' ? comparison : -comparison;
      }

      const firstNumber = Number(firstValue || 0);
      const secondNumber = Number(secondValue || 0);

      return sortOrder === 'asc'
        ? firstNumber - secondNumber
        : secondNumber - firstNumber;
    });

    return copy;
  }, [filteredProducts, isArabic, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedProducts]);

  const getImageUrl = (image) => {
    if (!image) {
      return null;
    }

    if (String(image).startsWith('http')) {
      return image;
    }

    return `/media${image}`;
  };

  const getSectionName = (sectionId) => {
    const section = sections.find(
      (item) => Number(item.id) === Number(sectionId),
    );

    if (!section) {
      return '—';
    }

    return isArabic
      ? (section.name_ar || section.name_en || '—')
      : (section.name_en || section.name_ar || '—');
  };

  const getApiName = (apiId) => {
    if (!apiId) {
      return '—';
    }

    const api = apis.find((item) => Number(item.id) === Number(apiId));
    return api ? `${api.name} (${api.provider})` : `#${apiId}`;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      section: 'All',
      status: 'All',
      currency: 'All',
      product_type: 'All',
    });
    setCurrentPage(1);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setApiProducts([]);
    setNewProduct({
      ...initialProduct,
      name_en: product.name_en || '',
      name_ar: product.name_ar || '',
      description_en: product.description_en || '',
      description_ar: product.description_ar || '',
      section: product.section || '',
      api_config: product.api_config || '',
      external_product: product.external_product || '',
      product_type: product.product_type || 'amount_based',
      currency: product.currency || 'USD',
      base_price: Number(product.base_price || 0),
      min_amount: Number(product.min_amount || 0),
      max_amount: Number(product.max_amount || 0),
      min_amount_price: Number(product.min_amount_price || 0),
      customization_options: product.customization_options || '',
      customization_prices: product.customization_prices || '',
      is_active: product.is_active !== false,
      requirements: Array.isArray(product.requirements)
        ? product.requirements
        : [],
    });
    setShowModal(true);

    if (product.api_config) {
      fetchApiProducts(product.api_config);
    }
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingProduct(null);
    setNewProduct(initialProduct);
    setNewRequirement(initialRequirement);
    setApiProducts([]);
  };

  const fetchApiProducts = async (apiId) => {
    if (!apiId) {
      setApiProducts([]);
      return;
    }

    setLoadingApiProducts(true);

    try {
      try {
        await axiosInstance.post(
          `third_party_apis/apis/${apiId}/sync_products/`,
        );
      } catch (syncError) {
        console.warn('API product sync failed:', syncError);
      }

      const response = await axiosInstance.get(
        'store/admin/external-products/',
        { params: { api_id: apiId } },
      );

      setApiProducts(normalizeList(response.data));
    } catch (fetchError) {
      setApiProducts([]);
      setNotice({
        type: 'error',
        message: getApiError(
          fetchError,
          isArabic
            ? 'تعذر جلب منتجات المزود.'
            : 'Failed to load provider products.',
        ),
      });
    } finally {
      setLoadingApiProducts(false);
    }
  };

  const handleApiChange = (apiId) => {
    setNewProduct((previous) => ({
      ...previous,
      api_config: apiId,
      external_product: '',
    }));

    fetchApiProducts(apiId);
  };

  const mapApiFieldType = (apiType) => {
    const map = {
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

    return map[String(apiType || '').toLowerCase()] || 'text';
  };

  const handleExternalProductChange = (externalId) => {
    const externalProduct = apiProducts.find(
      (item) => Number(item.id) === Number(externalId),
    );

    if (!externalProduct) {
      setNewProduct((previous) => ({
        ...previous,
        external_product: externalId,
      }));
      return;
    }

    const mappedRequirements = Array.isArray(
      externalProduct.required_fields_json,
    )
      ? externalProduct.required_fields_json.map((field, index) => {
        const data = typeof field === 'object'
          ? field
          : {
            name: field,
            type: 'text',
            required: true,
          };

        return {
          field_name: data.name || `field_${index}`,
          field_type: mapApiFieldType(data.type),
          is_required: data.required !== false,
          placeholder: data.placeholder || '',
          order: index,
        };
      })
      : [];

    setNewProduct((previous) => ({
      ...previous,
      external_product: externalProduct.id,
      name_en: externalProduct.name || previous.name_en,
      name_ar: externalProduct.name || previous.name_ar,
      description_en: externalProduct.description || previous.description_en,
      description_ar: externalProduct.description || previous.description_ar,
      base_price: Number(externalProduct.base_price || previous.base_price || 0),
      requirements: mappedRequirements.length
        ? mappedRequirements
        : previous.requirements,
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setNewProduct((previous) => ({
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

    setNewProduct((previous) => ({
      ...previous,
      image: file,
    }));
  };

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

    setNewRequirement(initialRequirement);
  };

  const removeRequirement = (index) => {
    setNewProduct((previous) => ({
      ...previous,
      requirements: previous.requirements.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  };

  const handleSaveProduct = async (event) => {
    event.preventDefault();
    setSaving(true);
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
        formData.append('min_amount_price', String(newProduct.min_amount_price));
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

      formData.append(
        'requirements',
        JSON.stringify(newProduct.requirements || []),
      );

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };

      if (editingProduct) {
        await axiosInstance.put(
          `store/admin/products/${editingProduct.id}/`,
          formData,
          config,
        );
      } else {
        await axiosInstance.post(
          'store/admin/products/',
          formData,
          config,
        );
      }

      setShowModal(false);
      setEditingProduct(null);
      setNewProduct(initialProduct);
      setApiProducts([]);
      setNotice({
        type: 'success',
        message: labels.saveSuccess,
      });
      await fetchData({ background: true });
    } catch (saveError) {
      setNotice({
        type: 'error',
        message: getApiError(saveError, labels.saveFailed),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (product) => {
    try {
      await axiosInstance.patch(
        `store/admin/products/${product.id}/`,
        { is_active: !product.is_active },
      );

      setProducts((previous) => previous.map((item) => (
        item.id === product.id
          ? { ...item, is_active: !product.is_active }
          : item
      )));
    } catch (statusError) {
      setNotice({
        type: 'error',
        message: getApiError(statusError, labels.statusFailed),
      });
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(labels.deleteConfirm)) {
      return;
    }

    try {
      await axiosInstance.delete(`store/admin/products/${product.id}/`);
      setProducts((previous) => previous.filter(
        (item) => item.id !== product.id,
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

  const formatPrice = (product) => {
    const amount = Number(product.base_price || 0);

    if (product.currency === 'USD') {
      return `$${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    return `${amount.toLocaleString(isArabic ? 'ar-SY' : 'en-US')} SYP`;
  };

  const StatCard = ({
    icon,
    label,
    value,
    helper,
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
          {helper && (
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {helper}
            </p>
          )}
        </div>

        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg"
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

  if (loading && !products.length) {
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

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => fetchData({ background: true })}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                  {labels.refresh}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/product/add')}
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

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard
              icon={<FiPackage />}
              label={labels.total}
              value={stats.total}
            />
            <StatCard
              icon={<FiCheck />}
              label={labels.active}
              value={stats.active}
            />
            <StatCard
              icon={<span className="font-black">$</span>}
              label={labels.usd}
              value={stats.usd}
            />
            <StatCard
              icon={<span className="text-xs font-black">SYP</span>}
              label={labels.syp}
              value={stats.syp}
            />
            <StatCard
              icon={<FiBox />}
              label={labels.amountBased}
              value={stats.amountBased}
            />
            <StatCard
              icon={<FiFileText />}
              label={labels.customization}
              value={stats.customization}
            />
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-start">
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {labels.title}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    {isArabic
                      ? 'فلترة سريعة مع فرز وترقيم صفحات.'
                      : 'Quick filters, sorting, and pagination.'}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
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

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    <FiFilter />
                    {labels.clear}
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                <select
                  value={filters.section}
                  onChange={(event) => setFilters((previous) => ({
                    ...previous,
                    section: event.target.value,
                  }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="All">{labels.allSections}</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {isArabic
                        ? (section.name_ar || section.name_en)
                        : (section.name_en || section.name_ar)}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.status}
                  onChange={(event) => setFilters((previous) => ({
                    ...previous,
                    status: event.target.value,
                  }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="All">{labels.allStatuses}</option>
                  <option value="Active">{labels.activeLabel}</option>
                  <option value="Inactive">{labels.inactiveLabel}</option>
                </select>

                <select
                  value={filters.currency}
                  onChange={(event) => setFilters((previous) => ({
                    ...previous,
                    currency: event.target.value,
                  }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="All">{labels.allCurrencies}</option>
                  <option value="USD">USD</option>
                  <option value="SYP">SYP</option>
                </select>

                <select
                  value={filters.product_type}
                  onChange={(event) => setFilters((previous) => ({
                    ...previous,
                    product_type: event.target.value,
                  }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="All">{labels.allTypes}</option>
                  <option value="amount_based">{labels.amountBased}</option>
                  <option value="customization_based">
                    {labels.customization}
                  </option>
                </select>

                <select
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(event) => {
                    const [field, order] = event.target.value.split(':');
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="id:desc">
                    {isArabic ? 'الأحدث أولاً' : 'Newest first'}
                  </option>
                  <option value="id:asc">
                    {isArabic ? 'الأقدم أولاً' : 'Oldest first'}
                  </option>
                  <option value="name:asc">
                    {isArabic ? 'الاسم أ-ي' : 'Name A-Z'}
                  </option>
                  <option value="name:desc">
                    {isArabic ? 'الاسم ي-أ' : 'Name Z-A'}
                  </option>
                  <option value="base_price:asc">
                    {isArabic ? 'السعر الأقل' : 'Lowest price'}
                  </option>
                  <option value="base_price:desc">
                    {isArabic ? 'السعر الأعلى' : 'Highest price'}
                  </option>
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
          </section>

          {!sortedProducts.length ? (
            <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-black text-slate-400 dark:border-slate-700 dark:bg-secondary-dark-bg">
              {labels.empty}
            </section>
          ) : (
            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
              <div className="overflow-x-auto">
                <table className="min-w-[1040px] w-full">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/60">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">#</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.image}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.name}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.section}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.price}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.type}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.api}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.status}</th>
                      <th className="px-4 py-3 text-center text-xs font-black text-slate-400">{labels.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedProducts.map((product) => {
                      const primaryName = isArabic
                        ? (product.name_ar || product.name_en || '—')
                        : (product.name_en || product.name_ar || '—');
                      const secondaryName = isArabic
                        ? product.name_en
                        : product.name_ar;
                      const imageUrl = getImageUrl(product.image);

                      return (
                        <tr
                          key={product.id}
                          className="transition hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
                        >
                          <td className="px-4 py-4 text-sm font-black text-slate-400">
                            {product.id}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={primaryName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <FiImage className="text-slate-300" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-start">
                            <p className="max-w-[220px] truncate text-sm font-black text-slate-900 dark:text-white">
                              {primaryName}
                            </p>
                            {secondaryName && secondaryName !== primaryName && (
                              <p className="mt-1 max-w-[220px] truncate text-xs font-semibold text-slate-400">
                                {secondaryName}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                            {getSectionName(product.section)}
                          </td>
                          <td className="px-4 py-4 text-sm font-black text-slate-900 dark:text-white">
                            {formatPrice(product)}
                          </td>
                          <td className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                            {product.product_type === 'customization_based'
                              ? labels.customization
                              : labels.amountBased}
                          </td>
                          <td className="px-4 py-4 text-sm font-bold text-slate-500 dark:text-slate-400">
                            {getApiName(product.api_config)}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                                product.is_active
                                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                  : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                              }`}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{
                                  backgroundColor: product.is_active
                                    ? accentColor
                                    : '#ef4444',
                                }}
                              />
                              {product.is_active
                                ? labels.activeLabel
                                : labels.inactiveLabel}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEdit(product)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition hover:opacity-90"
                                style={{ backgroundColor: accentColor }}
                                title={labels.edit}
                              >
                                <FiEdit2 />
                              </button>
                              <button
                                type="button"
                                onClick={() => window.alert(
                                  `${labels.requirements}: ${Array.isArray(product.requirements) ? product.requirements.length : 0}`,
                                )}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                title={labels.requirements}
                              >
                                <FiFileText />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleStatus(product)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                title={product.is_active ? labels.hide : labels.show}
                              >
                                {product.is_active ? <FiEyeOff /> : <FiEye />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(product)}
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
                    ? `عرض ${(currentPage - 1) * pageSize + 1} إلى ${Math.min(currentPage * pageSize, sortedProducts.length)} من ${sortedProducts.length}`
                    : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, sortedProducts.length)} of ${sortedProducts.length}`}
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

      {showModal && (
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:p-6">
              <div className="text-start">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">
                  {editingProduct ? labels.modalEdit : labels.modalAdd}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {isArabic
                    ? 'عدّل بيانات المنتج ثم احفظ التغييرات.'
                    : 'Update product details, then save changes.'}
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

            <form onSubmit={handleSaveProduct} className="space-y-5 p-5 md:p-6">
              <section className="rounded-3xl border border-slate-100 p-4 dark:border-slate-800">
                <h3 className="mb-4 font-black text-slate-900 dark:text-white">
                  {labels.basicInfo}
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.nameEn}
                    </span>
                    <input
                      type="text"
                      required
                      value={newProduct.name_en}
                      onChange={(event) => setNewProduct((previous) => ({
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
                      value={newProduct.name_ar}
                      onChange={(event) => setNewProduct((previous) => ({
                        ...previous,
                        name_ar: event.target.value,
                      }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.descAr}
                    </span>
                    <textarea
                      rows="2"
                      value={newProduct.description_ar}
                      onChange={(event) => setNewProduct((previous) => ({
                        ...previous,
                        description_ar: event.target.value,
                      }))}
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.descEn}
                    </span>
                    <textarea
                      rows="2"
                      value={newProduct.description_en}
                      onChange={(event) => setNewProduct((previous) => ({
                        ...previous,
                        description_en: event.target.value,
                      }))}
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.section}
                    </span>
                    <select
                      required
                      value={newProduct.section}
                      onChange={(event) => setNewProduct((previous) => ({
                        ...previous,
                        section: event.target.value,
                      }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">{labels.allSections}</option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {isArabic
                            ? (section.name_ar || section.name_en)
                            : (section.name_en || section.name_ar)}
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
              </section>

              <section className="rounded-3xl border border-slate-100 p-4 dark:border-slate-800">
                <h3 className="mb-4 font-black text-slate-900 dark:text-white">
                  {labels.pricing}
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.productType}
                    </span>
                    <select
                      value={newProduct.product_type}
                      onChange={(event) => setNewProduct((previous) => ({
                        ...previous,
                        product_type: event.target.value,
                      }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="amount_based">{labels.amountBased}</option>
                      <option value="customization_based">
                        {labels.customization}
                      </option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.currency}
                    </span>
                    <select
                      value={newProduct.currency}
                      onChange={(event) => setNewProduct((previous) => ({
                        ...previous,
                        currency: event.target.value,
                      }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="USD">USD</option>
                      <option value="SYP">SYP</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.basePrice}
                    </span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={newProduct.base_price}
                      onChange={(event) => setNewProduct((previous) => ({
                        ...previous,
                        base_price: event.target.value,
                      }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                        min="0"
                        step="0.0001"
                        value={newProduct.min_amount}
                        onChange={(event) => setNewProduct((previous) => ({
                          ...previous,
                          min_amount: event.target.value,
                        }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.maxAmount}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={newProduct.max_amount}
                        onChange={(event) => setNewProduct((previous) => ({
                          ...previous,
                          max_amount: event.target.value,
                        }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.minAmountPrice}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={newProduct.min_amount_price}
                        onChange={(event) => setNewProduct((previous) => ({
                          ...previous,
                          min_amount_price: event.target.value,
                        }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </label>
                  </div>
                )}

                {newProduct.product_type === 'customization_based' && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.customizationOptions}
                      </span>
                      <textarea
                        rows="3"
                        value={newProduct.customization_options}
                        onChange={(event) => setNewProduct((previous) => ({
                          ...previous,
                          customization_options: event.target.value,
                        }))}
                        className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                        {labels.customizationPrices}
                      </span>
                      <textarea
                        rows="3"
                        value={newProduct.customization_prices}
                        onChange={(event) => setNewProduct((previous) => ({
                          ...previous,
                          customization_prices: event.target.value,
                        }))}
                        className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </label>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-100 p-4 dark:border-slate-800">
                <h3 className="mb-4 font-black text-slate-900 dark:text-white">
                  {labels.integration}
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.provider}
                    </span>
                    <select
                      value={newProduct.api_config}
                      onChange={(event) => handleApiChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">{labels.noProvider}</option>
                      {apis.map((api) => (
                        <option key={api.id} value={api.id}>
                          {api.name} ({api.provider})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                      {labels.externalProduct}
                    </span>
                    <select
                      value={newProduct.external_product}
                      disabled={!newProduct.api_config || loadingApiProducts}
                      onChange={(event) => handleExternalProductChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">
                        {loadingApiProducts
                          ? labels.syncingProvider
                          : labels.selectExternal}
                      </option>
                      {apiProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name || `#${product.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-100 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-start">
                    <h3 className="font-black text-slate-900 dark:text-white">
                      {labels.productRequirements}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {isArabic
                        ? 'حقول إضافية يعبئها المستخدم عند الطلب.'
                        : 'Extra fields the user completes during purchase.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <input
                    type="text"
                    value={newRequirement.field_name}
                    onChange={(event) => setNewRequirement((previous) => ({
                      ...previous,
                      field_name: event.target.value,
                    }))}
                    placeholder={labels.fieldName}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <select
                    value={newRequirement.field_type}
                    onChange={(event) => setNewRequirement((previous) => ({
                      ...previous,
                      field_type: event.target.value,
                    }))}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                    placeholder={labels.placeholder}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addRequirement}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <FiPlus />
                    {labels.addRequirement}
                  </button>
                </div>

                <label className="mt-3 flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={newRequirement.is_required}
                    onChange={(event) => setNewRequirement((previous) => ({
                      ...previous,
                      is_required: event.target.checked,
                    }))}
                  />
                  {labels.required}
                </label>

                {!newProduct.requirements.length ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
                    {labels.noRequirements}
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {newProduct.requirements.map((requirement, index) => (
                      <div
                        key={`${requirement.field_name}-${index}`}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="text-start">
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                            {requirement.field_name}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {requirement.field_type}
                            {requirement.is_required ? ` • ${labels.required}` : ''}
                            {requirement.placeholder ? ` • ${requirement.placeholder}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRequirement(index)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                        >
                          <FiTrash2 />
                          {labels.remove}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <input
                  type="checkbox"
                  checked={newProduct.is_active}
                  onChange={(event) => setNewProduct((previous) => ({
                    ...previous,
                    is_active: event.target.checked,
                  }))}
                />
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {labels.activeProduct}
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

export default ProductsPage;