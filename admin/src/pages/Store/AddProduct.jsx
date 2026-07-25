import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiArrowLeft,
  FiPlus,
  FiTrash2,
  FiX,
  FiCheck,
  FiUploadCloud,
  FiAlertCircle,
  FiPackage,
  FiDollarSign,
  FiInfo,
  FiGlobe,
  FiLink,
  FiSettings
} from 'react-icons/fi';
import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

export default function AddProduct() {
  const { t, i18n } = useTranslation('products');
  console.log("DIAGNOSTIC: i18n.hasLoadedNamespace('products'):", i18n.hasLoadedNamespace("products"));
  console.log("DIAGNOSTIC: i18n.language:", i18n.language);
  console.log("DIAGNOSTIC: t('addProductPage.fields.section'):", t("addProductPage.fields.section"));
  const isArabic = i18n.resolvedLanguage === 'ar';
  const navigate = useNavigate();
  const { currentColor } = useStateContext();
  const primaryColor = currentColor || '#4F46E5'; // default to Indigo-600

  // Form State
  const [sections, setSections] = useState([]);
  const [apis, setApis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

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

  // Local UI States
  const [selectedApi, setSelectedApi] = useState('');
  const [apiProducts, setApiProducts] = useState([]);
  const [loadingApiProducts, setLoadingApiProducts] = useState(false);
  const [showApiProductsModal, setShowApiProductsModal] = useState(false);
  const [selectedApiProduct, setSelectedApiProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Requirements Modal States
  const [showReqModal, setShowReqModal] = useState(false);
  const [newRequirement, setNewRequirement] = useState({
    field_name: '',
    field_type: 'text',
    is_required: true,
    placeholder: '',
    order: 0,
  });

  // Drag and Drop Zone State
  const [isDragging, setIsDragging] = useState(false);

  // Escape key listener for modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowReqModal(false);
        setShowApiProductsModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch sections and APIs on load
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        const [sectionsResponse, apisResponse] = await Promise.all([
          axiosInstance.get('store/admin/sections/'),
          axiosInstance.get('third_party_apis/apis/').catch(() => ({ data: [] })),
        ]);
        setSections(Array.isArray(sectionsResponse.data) ? sectionsResponse.data : []);
        setApis(apisResponse.data?.results || apisResponse.data || []);
      } catch (error) {
        alert(t('addProductPage.alerts.loadFailed', 'Failed to load metadata'));
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, [t]);

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
    return typeMap[apiType?.toLowerCase()] || 'text';
  };

  const fetchApiProducts = async (apiId) => {
    if (!apiId) {
      setApiProducts([]);
      return;
    }
    try {
      setLoadingApiProducts(true);
      try {
        await axiosInstance.post(`third_party_apis/apis/${apiId}/sync_products/`);
      } catch (syncError) {
        console.warn('API Sync Failed', syncError);
      }
      const response = await axiosInstance.get('store/admin/external-products/', {
        params: { api_id: apiId },
      });
      const productsData = response.data?.results || response.data || [];
      setApiProducts(productsData);
    } catch (error) {
      alert(t('addProductPage.alerts.loadApiFailed', 'Failed to load API products'));
      setApiProducts([]);
    } finally {
      setLoadingApiProducts(false);
    }
  };

  const handleApiChange = (apiId) => {
    setSelectedApi(apiId);
    setNewProduct((prev) => ({
      ...prev,
      api_config: apiId,
      external_product: '',
    }));
    setSelectedApiProduct(null);
    setSearchQuery('');

    if (apiId) {
      fetchApiProducts(apiId);
      setShowApiProductsModal(true);
    } else {
      setApiProducts([]);
      setShowApiProductsModal(false);
    }
  };

  const handleSelectApiProduct = (apiProduct) => {
    setSelectedApiProduct(apiProduct);
    setNewProduct((prev) => ({
      ...prev,
      name_en: apiProduct.name || prev.name_en,
      name_ar: apiProduct.name || prev.name_ar,
      description_en: apiProduct.description || prev.description_en,
      description_ar: apiProduct.description || prev.description_ar,
      base_price: parseFloat(apiProduct.base_price) || prev.base_price,
      external_product: apiProduct.id,
      requirements: apiProduct.required_fields_json?.map((field, index) => {
        const fieldData = typeof field === 'object' ? field : { name: field, type: 'text', required: true };
        return {
          field_name: fieldData.name || `field_${index}`,
          field_type: mapApiFieldType(fieldData.type) || 'text',
          is_required: fieldData.required !== false,
          placeholder: fieldData.placeholder || '',
          order: index,
        };
      }) || prev.requirements,
    }));
    setErrors((prev) => ({
      ...prev,
      name_en: null,
      name_ar: null,
      base_price: null,
      api_config: null,
    }));
    setShowApiProductsModal(false);
    setSearchQuery('');
    alert(t('addProductPage.alerts.apiSelected', { name: apiProduct.name }));
  };

  const handleClearApiSelection = () => {
    setSelectedApi('');
    setSelectedApiProduct(null);
    setApiProducts([]);
    setSearchQuery('');
    setNewProduct((prev) => ({
      ...prev,
      api_config: '',
      external_product: '',
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(t('addProductPage.alerts.imageTypeErr'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(t('addProductPage.alerts.imageSizeErr'));
        return;
      }
      setNewProduct({ ...newProduct, image: file });
      setErrors((prev) => ({ ...prev, image: null }));
    }
  };

  const handleRemoveImage = () => {
    setNewProduct({ ...newProduct, image: null });
  };

  // Requirements handlers
  const handleAddRequirement = () => {
    if (!newRequirement.field_name.trim()) {
      alert(t('addProductPage.alerts.reqNameRequired', 'Field name is required'));
      return;
    }
    setNewProduct((prev) => ({
      ...prev,
      requirements: [...prev.requirements, {
        ...newRequirement,
        order: prev.requirements.length,
      }],
    }));
    setNewRequirement({
      field_name: '',
      field_type: 'text',
      is_required: true,
      placeholder: '',
      order: 0,
    });
    setShowReqModal(false);
  };

  const handleRemoveRequirement = (index) => {
    setNewProduct((prev) => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index),
    }));
  };

  // Validation
  const validateForm = () => {
    const tempErrors = {};
    if (!newProduct.name_ar.trim() || newProduct.name_ar.trim().length < 3) {
      tempErrors.name_ar = t('addProductPage.validation.nameAr');
    }
    if (!newProduct.name_en.trim() || newProduct.name_en.trim().length < 3) {
      tempErrors.name_en = t('addProductPage.validation.nameEn');
    }
    if (!newProduct.section) {
      tempErrors.section = t('addProductPage.validation.section');
    }
    if (newProduct.base_price === undefined || newProduct.base_price === '' || parseFloat(newProduct.base_price) < 0) {
      tempErrors.base_price = t('addProductPage.validation.basePrice');
    }
    if (newProduct.product_type === 'amount_based') {
      if (!newProduct.min_amount || parseFloat(newProduct.min_amount) <= 0) {
        tempErrors.min_amount = t('addProductPage.validation.minAmount');
      }
      if (!newProduct.max_amount || parseFloat(newProduct.max_amount) < parseFloat(newProduct.min_amount)) {
        tempErrors.max_amount = t('addProductPage.validation.maxAmount');
      }
      if (!newProduct.min_amount_price || parseFloat(newProduct.min_amount_price) <= 0) {
        tempErrors.min_amount_price = t('addProductPage.validation.minAmountPrice');
      }
    } else if (newProduct.product_type === 'customization_based') {
      if (!newProduct.customization_options.trim()) {
        tempErrors.customization_options = t('addProductPage.validation.customOptions');
      }
      if (!newProduct.customization_prices.trim()) {
        tempErrors.customization_prices = t('addProductPage.validation.customPrices');
      }
    }
    if (newProduct.api_config) {
      if (!newProduct.external_product) {
        tempErrors.api_config = t('addProductPage.validation.apiConfig');
      }
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('name_en', newProduct.name_en);
      formData.append('name_ar', newProduct.name_ar);
      formData.append('description_en', newProduct.description_en);
      formData.append('description_ar', newProduct.description_ar);
      formData.append('section', newProduct.section);
      formData.append('product_type', newProduct.product_type);
      formData.append('currency', newProduct.currency);
      formData.append('base_price', newProduct.base_price.toString());
      formData.append('is_active', newProduct.is_active.toString());

      if (newProduct.api_config) {
        formData.append('api_config', newProduct.api_config);
      }
      if (newProduct.external_product) {
        formData.append('external_product', newProduct.external_product);
      }

      if (newProduct.product_type === 'amount_based') {
        formData.append('min_amount', newProduct.min_amount.toString());
        formData.append('max_amount', newProduct.max_amount.toString());
        formData.append('min_amount_price', newProduct.min_amount_price.toString());
      } else if (newProduct.product_type === 'customization_based') {
        formData.append('customization_options', newProduct.customization_options);
        formData.append('customization_prices', newProduct.customization_prices);
      }

      if (newProduct.image instanceof File) {
        formData.append('image', newProduct.image);
      }

      if (newProduct.requirements.length > 0) {
        formData.append('requirements', JSON.stringify(newProduct.requirements));
      }

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        transformRequest: (data) => data,
      };

      await axiosInstance.post('store/admin/products/', formData, config);
      alert(t('addProductPage.messages.success'));
      navigate('/products');
    } catch (error) {
      const errorMessage = error.response?.data || t('addProductPage.alerts.saveFailed');
      alert(t('addProductPage.alerts.saveError', {
        message: typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage
      }));
    } finally {
      setSubmitting(false);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(t('addProductPage.alerts.imageTypeErr'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(t('addProductPage.alerts.imageSizeErr'));
        return;
      }
      setNewProduct({ ...newProduct, image: file });
      setErrors((prev) => ({ ...prev, image: null }));
    }
  };

  // Filter API products locally based on searchQuery
  const filteredApiProducts = apiProducts.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase().trim();
    const name = (p.name || '').toLowerCase();
    const nameAr = (p.name_ar || '').toLowerCase();
    const nameEn = (p.name_en || '').toLowerCase();
    const extId = (p.external_id || '').toString().toLowerCase();
    const sku = (p.sku || '').toLowerCase();

    return name.includes(query) || 
           nameAr.includes(query) || 
           nameEn.includes(query) || 
           extId.includes(query) || 
           sku.includes(query);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full bg-main-bg dark:bg-main-dark-bg transition-colors duration-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">
            {t('addProductPage.alerts.loading', 'Loading products...')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-main-bg dark:bg-main-dark-bg p-4 md:p-8 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
              <span>{t('addProductPage.breadcrumb.products')}</span>
              <span className="rtl:rotate-180">/</span>
              <span className="text-gray-800 dark:text-gray-200 font-semibold">
                {t('addProductPage.breadcrumb.addProduct')}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {t('addProductPage.title')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('addProductPage.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="mt-4 md:mt-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 dark:border-gray-800 dark:bg-secondary-dark-bg text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-all text-sm font-medium shadow-sm"
          >
            <FiArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('addProductPage.backToProducts')}
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSaveProduct} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column (Details) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Basic Info */}
              <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg">
                    <FiPackage className="w-5 h-5" />
                  </span>
                  {t('addProductPage.cards.basicInfo')}
                </h2>

                <div className="space-y-4">
                  {/* Parent Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('addProductPage.fields.section')}
                    </label>
                    <select
                      value={newProduct.section}
                      onChange={(e) => {
                        setNewProduct({ ...newProduct, section: e.target.value });
                        setErrors((prev) => ({ ...prev, section: null }));
                      }}
                      className={`w-full border rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all ${
                        errors.section
                          ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                          : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                      }`}
                    >
                      <option value="">{t('addProductPage.placeholders.selectSection')}</option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {isArabic ? `${section.name_ar} / ${section.name_en}` : `${section.name_en} / ${section.name_ar}`}
                        </option>
                      ))}
                    </select>
                    {errors.section && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                        <FiAlertCircle className="w-3.5 h-3.5" />
                        {errors.section}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Arabic Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('addProductPage.fields.nameAr')}
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={newProduct.name_ar}
                        onChange={(e) => {
                          setNewProduct({ ...newProduct, name_ar: e.target.value });
                          setErrors((prev) => ({ ...prev, name_ar: null }));
                        }}
                        className={`w-full border rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all text-right ${
                          errors.name_ar
                            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                            : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                        placeholder={t('addProductPage.placeholders.nameAr')}
                      />
                      {errors.name_ar && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                          <FiAlertCircle className="w-3.5 h-3.5" />
                          {errors.name_ar}
                        </p>
                      )}
                    </div>

                    {/* English Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('addProductPage.fields.nameEn')}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={newProduct.name_en}
                        onChange={(e) => {
                          setNewProduct({ ...newProduct, name_en: e.target.value });
                          setErrors((prev) => ({ ...prev, name_en: null }));
                        }}
                        className={`w-full border rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all text-left ${
                          errors.name_en
                            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                            : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                        placeholder={t('addProductPage.placeholders.nameEn')}
                      />
                      {errors.name_en && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                          <FiAlertCircle className="w-3.5 h-3.5" />
                          {errors.name_en}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Linked API Product Name */}
                  {selectedApiProduct && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {t('addProductPage.fields.apiName')}
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={selectedApiProduct.name}
                        className="w-full border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 bg-gray-50 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed font-medium"
                      />
                    </div>
                  )}

                  {/* Active State Toggle switch */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 max-w-md">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('addProductPage.fields.isActive')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewProduct({ ...newProduct, is_active: !newProduct.is_active })}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        style={{ backgroundColor: newProduct.is_active ? primaryColor : '#E5E7EB' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            newProduct.is_active ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Pricing and Currency */}
              <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <span className="p-1.5 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-lg">
                    <FiDollarSign className="w-5 h-5" />
                  </span>
                  {t('addProductPage.cards.pricing')}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Currency selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('addProductPage.fields.currency')}
                    </label>
                    <select
                      value={newProduct.currency}
                      onChange={(e) => setNewProduct({ ...newProduct, currency: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="SYP">{t('addProductPage.fields.sypOption')}</option>
                    </select>
                  </div>

                  {/* Sale Price field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('addProductPage.fields.salePrice')}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-gray-500 dark:text-gray-400 text-sm">
                        {newProduct.currency === 'USD' ? '$' : 'SYP'}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newProduct.base_price || ''}
                        onChange={(e) => {
                          setNewProduct({ ...newProduct, base_price: parseFloat(e.target.value) || 0 });
                          setErrors((prev) => ({ ...prev, base_price: null }));
                        }}
                        className={`w-full border rounded-xl p-2.5 ps-12 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all ${
                          errors.base_price
                            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                            : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                    {errors.base_price && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                        <FiAlertCircle className="w-3.5 h-3.5" />
                        {errors.base_price}
                      </p>
                    )}
                  </div>

                  {/* Read-only Cost Price if linked to API */}
                  {selectedApiProduct && (
                    <div className="md:col-span-2 bg-slate-50 dark:bg-gray-800/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-2">
                        ⚠️ {t('addProductPage.fields.pricingPreviewNotice')}
                      </p>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                          {t('addProductPage.fields.costPrice')} (Third Party API):
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          ${parseFloat(selectedApiProduct.base_price || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200 dark:border-gray-800">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                          {t('addProductPage.fields.profitMargin')}
                        </span>
                        <span className={`font-bold ${
                          (newProduct.base_price - selectedApiProduct.base_price) >= 0 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          ${(newProduct.base_price - selectedApiProduct.base_price).toFixed(2)} ({
                            selectedApiProduct.base_price > 0
                              ? (((newProduct.base_price - selectedApiProduct.base_price) / selectedApiProduct.base_price) * 100).toFixed(1)
                              : 0
                          }%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount details price unit preview */}
                {newProduct.product_type === 'amount_based' && newProduct.min_amount > 0 && newProduct.min_amount_price > 0 && (
                  <div className="mt-4 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl flex items-center justify-between text-sm">
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                      {t('addProductPage.fields.unitPrice')}
                    </span>
                    <span className="font-bold text-blue-800 dark:text-blue-200">
                      {newProduct.currency === 'USD' ? '$' : 'SYP '}
                      {(newProduct.min_amount_price / newProduct.min_amount).toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              {/* Card 3: Description */}
              <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <span className="p-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-lg">
                    <FiGlobe className="w-5 h-5" />
                  </span>
                  {t('addProductPage.cards.description')}
                </h2>

                <div className="space-y-4">
                  {/* Arabic Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <span>{t('addProductPage.fields.descriptionAr')}</span>
                      <span className="text-xs text-gray-400 font-normal">(Arabic)</span>
                    </label>
                    <textarea
                      dir="rtl"
                      value={newProduct.description_ar}
                      onChange={(e) => setNewProduct({ ...newProduct, description_ar: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-right"
                      rows="4"
                      placeholder={t('addProductPage.placeholders.descriptionAr')}
                    />
                  </div>

                  {/* English Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <span>{t('addProductPage.fields.descriptionEn')}</span>
                      <span className="text-xs text-gray-400 font-normal">(English)</span>
                    </label>
                    <textarea
                      dir="ltr"
                      value={newProduct.description_en}
                      onChange={(e) => setNewProduct({ ...newProduct, description_en: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-left"
                      rows="4"
                      placeholder={t('addProductPage.placeholders.descriptionEn')}
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: Quantity Type */}
              <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-lg">
                    <FiSettings className="w-5 h-5" />
                  </span>
                  {t('addProductPage.cards.quantityType')}
                </h2>

                <div className="space-y-6">
                  {/* Radio Cards to select Quantity Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      {t('addProductPage.fields.quantityTypeLabel')}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Amount Based */}
                      <label className={`flex p-4 border rounded-xl cursor-pointer transition-all ${
                        newProduct.product_type === 'amount_based'
                          ? 'border-indigo-600 bg-indigo-50/10 dark:bg-indigo-950/20'
                          : 'border-gray-200 dark:border-gray-800 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-gray-800/40'
                      }`}>
                        <input
                          type="radio"
                          name="product_type"
                          value="amount_based"
                          checked={newProduct.product_type === 'amount_based'}
                          onChange={() => setNewProduct({ ...newProduct, product_type: 'amount_based' })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 mt-0.5"
                          style={{ accentColor: primaryColor }}
                        />
                        <div className="ms-3">
                          <span className="block text-sm font-bold text-gray-900 dark:text-white">
                            {t('addProductPage.fields.quantityTypes.amount')}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('addProductPage.fields.quantityTypes.amountDesc')}
                          </span>
                        </div>
                      </label>

                      {/* Custom Options Based */}
                      <label className={`flex p-4 border rounded-xl cursor-pointer transition-all ${
                        newProduct.product_type === 'customization_based'
                          ? 'border-indigo-600 bg-indigo-50/10 dark:bg-indigo-950/20'
                          : 'border-gray-200 dark:border-gray-800 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-gray-800/40'
                      }`}>
                        <input
                          type="radio"
                          name="product_type"
                          value="customization_based"
                          checked={newProduct.product_type === 'customization_based'}
                          onChange={() => setNewProduct({ ...newProduct, product_type: 'customization_based' })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 mt-0.5"
                          style={{ accentColor: primaryColor }}
                        />
                        <div className="ms-3">
                          <span className="block text-sm font-bold text-gray-900 dark:text-white">
                            {t('addProductPage.fields.quantityTypes.custom')}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('addProductPage.fields.quantityTypes.customDesc')}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Dynamic Inputs Based on Choice */}
                  {newProduct.product_type === 'amount_based' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800">
                      {/* Min Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('addProductPage.fields.minAmount')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newProduct.min_amount || ''}
                          onChange={(e) => {
                            setNewProduct({ ...newProduct, min_amount: parseFloat(e.target.value) || 0 });
                            setErrors((prev) => ({ ...prev, min_amount: null }));
                          }}
                          className={`w-full border rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all ${
                            errors.min_amount
                              ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                              : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                          }`}
                          placeholder="e.g. 100"
                        />
                        {errors.min_amount && (
                          <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                            <FiAlertCircle className="w-3.5 h-3.5" />
                            {errors.min_amount}
                          </p>
                        )}
                      </div>

                      {/* Max Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('addProductPage.fields.maxAmount')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newProduct.max_amount || ''}
                          onChange={(e) => {
                            setNewProduct({ ...newProduct, max_amount: parseFloat(e.target.value) || 0 });
                            setErrors((prev) => ({ ...prev, max_amount: null }));
                          }}
                          className={`w-full border rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all ${
                            errors.max_amount
                              ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                              : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                          }`}
                          placeholder="e.g. 10000"
                        />
                        {errors.max_amount && (
                          <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                            <FiAlertCircle className="w-3.5 h-3.5" />
                            {errors.max_amount}
                          </p>
                        )}
                      </div>

                      {/* Min Amount Price */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('addProductPage.fields.minAmountPrice')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newProduct.min_amount_price || ''}
                          onChange={(e) => {
                            setNewProduct({ ...newProduct, min_amount_price: parseFloat(e.target.value) || 0 });
                            setErrors((prev) => ({ ...prev, min_amount_price: null }));
                          }}
                          className={`w-full border rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all ${
                            errors.min_amount_price
                              ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                              : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                          }`}
                          placeholder="e.g. 5.00"
                        />
                        {errors.min_amount_price && (
                          <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                            <FiAlertCircle className="w-3.5 h-3.5" />
                            {errors.min_amount_price}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {newProduct.product_type === 'customization_based' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800">
                      {/* Options */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('addProductPage.fields.customOptions')}
                        </label>
                        <textarea
                          value={newProduct.customization_options}
                          onChange={(e) => {
                            setNewProduct({ ...newProduct, customization_options: e.target.value });
                            setErrors((prev) => ({ ...prev, customization_options: null }));
                          }}
                          className={`w-full border rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all ${
                            errors.customization_options
                              ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                              : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                          }`}
                          rows="3"
                          placeholder={t('addProductPage.placeholders.customOptions')}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          {t('addProductPage.fields.optionHint')}
                        </p>
                        {errors.customization_options && (
                          <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                            <FiAlertCircle className="w-3.5 h-3.5" />
                            {errors.customization_options}
                          </p>
                        )}
                      </div>

                      {/* Prices */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('addProductPage.fields.customPrices')}
                        </label>
                        <textarea
                          value={newProduct.customization_prices}
                          onChange={(e) => {
                            setNewProduct({ ...newProduct, customization_prices: e.target.value });
                            setErrors((prev) => ({ ...prev, customization_prices: null }));
                          }}
                          className={`w-full border rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all ${
                            errors.customization_prices
                              ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                              : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                          }`}
                          rows="3"
                          placeholder={t('addProductPage.placeholders.customPrices')}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          {t('addProductPage.fields.priceHint')}
                        </p>
                        {errors.customization_prices && (
                          <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                            <FiAlertCircle className="w-3.5 h-3.5" />
                            {errors.customization_prices}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 5: API Integration Details */}
              <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <span className="p-1.5 bg-sky-50 dark:bg-sky-900/20 text-sky-500 rounded-lg">
                    <FiGlobe className="w-5 h-5" />
                  </span>
                  {t('addProductPage.cards.apiConfig')}
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* API provider selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('addProductPage.fields.apiProvider')}
                      </label>
                      <select
                        value={newProduct.api_config}
                        onChange={(e) => handleApiChange(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="">{t('addProductPage.fields.noApiOption')}</option>
                        {apis.map((api) => (
                          <option key={api.id} value={api.id}>
                            {api.name} ({api.provider})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* API Action buttons / connection status */}
                    <div className="flex items-end">
                      {newProduct.api_config && (
                        <div className="flex gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => setShowApiProductsModal(true)}
                            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition text-sm font-medium flex items-center justify-center gap-2 shadow-sm"
                          >
                            <FiLink className="w-4 h-4" />
                            {t('addProductPage.fields.selectApi')}
                          </button>
                          <button
                            type="button"
                            onClick={handleClearApiSelection}
                            className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 rounded-xl transition text-sm font-medium"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Show selected API product metadata block */}
                  {selectedApiProduct && (
                    <div className="p-4 bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900 rounded-xl flex items-center justify-between text-sm animate-fade-in">
                      <div>
                        <p className="font-bold text-green-900 dark:text-green-300">
                          {t('addProductPage.fields.connectedTo', { name: selectedApiProduct.name })}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                          {t('addProductPage.fields.connectedInfo', {
                            price: selectedApiProduct.base_price,
                            provider: selectedApiProduct.provider,
                            id: selectedApiProduct.external_id
                          })}
                        </p>
                        {selectedApiProduct.required_fields_json?.length > 0 && (
                          <p className="text-xs text-green-800 dark:text-green-300 font-semibold mt-1 flex items-center gap-1">
                            <FiCheck className="w-3.5 h-3.5" />
                            {t('addProductPage.fields.autoAddedFields', { count: selectedApiProduct.required_fields_json.length })}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowApiProductsModal(true)}
                        className="px-3 py-1.5 bg-white border border-green-300 dark:bg-secondary-dark-bg dark:border-green-900 text-green-800 dark:text-green-300 text-xs font-semibold rounded-lg hover:bg-green-50 dark:hover:bg-green-950/40 transition"
                      >
                        {t('addProductPage.fields.changeApi')}
                      </button>
                    </div>
                  )}

                  {errors.api_config && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                      <FiAlertCircle className="w-3.5 h-3.5" />
                      {errors.api_config}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (Sidebars / Media / Requirements) */}
            <div className="space-y-6">
              {/* Card 7: Product Image */}
              <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-md font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <span className="p-1.5 bg-pink-50 dark:bg-pink-900/20 text-pink-500 rounded-lg">
                    <FiUploadCloud className="w-4 h-4" />
                  </span>
                  {t('addProductPage.cards.image')}
                </h2>

                <div className="space-y-4">
                  {/* Drop zone container */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('image_upload_input').click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                      isDragging
                        ? 'border-indigo-600 bg-indigo-50/10'
                        : newProduct.image
                          ? 'border-green-300 bg-green-50/5'
                          : 'border-gray-200 dark:border-gray-800 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-gray-850/40'
                    }`}
                  >
                    <input
                      id="image_upload_input"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />

                    {newProduct.image ? (
                      <div className="relative group">
                        <img
                          src={URL.createObjectURL(newProduct.image)}
                          alt="Uploaded Preview"
                          className="w-28 h-28 object-cover rounded-xl border border-gray-100 dark:border-gray-850 shadow-sm"
                          onError={(e) => {
                            e.target.src = 'https://cdn-icons-png.flaticon.com/512/1170/1170679.png';
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage();
                          }}
                          className="absolute -top-2 -end-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-md transition"
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <FiUploadCloud className="w-10 h-10 text-gray-400 mb-3" />
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {t('addProductPage.fields.dropzone.title')}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">
                          {t('addProductPage.fields.dropzone.subtitle')}
                        </p>
                      </>
                    )}
                  </div>

                  {newProduct.image && (
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                        {newProduct.image.name}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="text-xs font-bold text-red-600 hover:text-red-700 transition"
                      >
                        {t('addProductPage.fields.requirements.removeRequirement')}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 8: Product Requirements */}
              <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="p-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-lg">
                      <FiArrowLeft className="w-4 h-4 rotate-90" />
                    </span>
                    {t('addProductPage.fields.requirements.title')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowReqModal(true)}
                    className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 hover:dark:bg-indigo-900/40 transition flex items-center gap-1 text-xs font-bold"
                  >
                    <FiPlus className="w-3.5 h-3.5" />
                    {t('addProductPage.fields.requirements.addRequirement')}
                  </button>
                </div>

                {newProduct.requirements.length > 0 ? (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {newProduct.requirements.map((req, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/60 rounded-xl"
                      >
                        <div className="flex-1 truncate me-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {req.field_name}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                            <span className="capitalize">{t('addProductPage.api.types.' + req.field_type, req.field_type)}</span>
                            <span>•</span>
                            <span className={req.is_required ? 'text-red-500 font-bold' : 'text-gray-400'}>
                              {req.is_required ? t('addProductPage.fields.requirements.required') : t('addProductPage.fields.requirements.optional')}
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRequirement(index)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                    <p className="text-xs text-gray-400 dark:text-gray-500 px-4 leading-relaxed">
                      {t('addProductPage.fields.requirements.empty')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-center justify-end gap-3 transition-colors">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="w-full md:w-auto px-6 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition font-bold text-sm"
            >
              {t('addProductPage.fields.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`w-full md:w-auto px-8 py-2.5 text-white rounded-xl font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 ${
                submitting ? 'opacity-55 cursor-not-allowed' : 'hover:drop-shadow-lg'
              }`}
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  {t('addProductPage.messages.saving')}
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4" />
                  {t('addProductPage.fields.createProduct')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL 1: Requirements Modal */}
      {showReqModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReqModal(false);
          }}
          className="fixed inset-0 flex items-center justify-center bg-black/60 z-[200000] p-4 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-secondary-dark-bg border border-gray-150 dark:border-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-md font-bold text-gray-900 dark:text-white">
                {t('addProductPage.fields.requirements.modalTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setShowReqModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Field Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addProductPage.fields.requirements.fieldName')}
                </label>
                <input
                  type="text"
                  value={newRequirement.field_name}
                  onChange={(e) => setNewRequirement({ ...newRequirement, field_name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-755 rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20"
                  placeholder={t('addProductPage.fields.requirements.placeholders.fieldName')}
                />
              </div>

              {/* Field Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addProductPage.fields.requirements.fieldType')}
                </label>
                <select
                  value={newRequirement.field_type}
                  onChange={(e) => setNewRequirement({ ...newRequirement, field_type: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-750 rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="text">{t('addProductPage.api.types.text')}</option>
                  <option value="number">{t('addProductPage.api.types.number')}</option>
                  <option value="email">{t('addProductPage.api.types.email')}</option>
                  <option value="phone">{t('addProductPage.api.types.phone')}</option>
                  <option value="id">{t('addProductPage.api.types.id')}</option>
                </select>
              </div>

              {/* Placeholder text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addProductPage.fields.requirements.placeholder')}
                </label>
                <input
                  type="text"
                  value={newRequirement.placeholder}
                  onChange={(e) => setNewRequirement({ ...newRequirement, placeholder: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-755 rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20"
                  placeholder={t('addProductPage.fields.requirements.placeholders.placeholderText')}
                />
              </div>

              {/* Required Switch checkbox */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800">
                <input
                  type="checkbox"
                  id="is_required_requirement"
                  checked={newRequirement.is_required}
                  onChange={(e) => setNewRequirement({ ...newRequirement, is_required: e.target.checked })}
                  className="w-4 h-4 text-indigo-650 rounded border-gray-300 focus:ring-indigo-500"
                  style={{ accentColor: primaryColor }}
                />
                <label
                  htmlFor="is_required_requirement"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                >
                  {t('addProductPage.fields.requirements.required')}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowReqModal(false)}
                className="px-5 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 transition text-sm font-bold"
              >
                {t('addProductPage.fields.cancel')}
              </button>
              <button
                type="button"
                onClick={handleAddRequirement}
                className="px-6 py-2 text-white rounded-xl font-bold text-sm hover:drop-shadow-md transition"
                style={{ backgroundColor: primaryColor }}
              >
                {t('addProductPage.fields.requirements.addRequirement')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Synced API Products Modal */}
      {showApiProductsModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowApiProductsModal(false);
          }}
          className="fixed inset-0 flex items-center justify-center bg-black/60 z-[200000] p-4 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-secondary-dark-bg border border-gray-150 dark:border-gray-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('addProductPage.api.title')}
              </h2>
              <button
                type="button"
                onClick={() => setShowApiProductsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              {t('addProductPage.api.subtitle')}
            </p>

            {/* Local Search and Filtering Input Block */}
            {!loadingApiProducts && apiProducts.length > 0 && (
              <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('addProductPage.api.searchPlaceholder')}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 pe-10 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                      title={t('addProductPage.api.clearSearch')}
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium bg-slate-50 dark:bg-gray-850 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800 self-stretch sm:self-auto text-center sm:text-left">
                  {t('addProductPage.api.resultsCount', { count: filteredApiProducts.length })}
                </span>
              </div>
            )}

            {loadingApiProducts ? (
              <div className="flex flex-col items-center justify-center h-48">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-650" />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
                  {t('addProductPage.alerts.loadingApiProducts', 'Loading products from API...')}
                </p>
              </div>
            ) : apiProducts.length > 0 ? (
              filteredApiProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredApiProducts.map((apiProduct) => (
                    <div
                      key={apiProduct.id}
                      onClick={() => handleSelectApiProduct(apiProduct)}
                      className={`border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all flex flex-col justify-between ${
                        selectedApiProduct?.id === apiProduct.id
                          ? 'border-indigo-650 bg-indigo-50/10 dark:bg-indigo-950/20'
                          : 'border-gray-250 dark:border-gray-800 hover:border-indigo-400 dark:bg-[#2A2D35]'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-gray-950 dark:text-white text-sm line-clamp-1">
                            {apiProduct.name}
                          </h3>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            ${parseFloat(apiProduct.base_price || 0).toFixed(2)}
                          </span>
                        </div>

                        {apiProduct.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                            {apiProduct.description}
                          </p>
                        )}

                        {apiProduct.required_fields_json?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                              {t('addProductPage.api.reqListHeader')}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {apiProduct.required_fields_json.slice(0, 3).map((field, idx) => {
                                const fieldData = typeof field === 'object' ? field : { name: field, type: 'text' };
                                const typeVal = fieldData.type || '';
                                const displayType = ['text', 'number', 'email', 'phone', 'id'].includes(typeVal)
                                  ? t('addProductPage.api.types.' + typeVal)
                                  : (typeVal ? t('addProductPage.api.unknownType', { type: typeVal }) : t('addProductPage.api.unknownType', { type: 'text' }));
                                return (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-[9px] font-medium"
                                  >
                                    {fieldData.name} ({displayType})
                                  </span>
                                );
                              })}
                              {apiProduct.required_fields_json.length > 3 && (
                                <span className="text-[9px] text-gray-400 dark:text-gray-500 font-bold self-center">
                                  {t('addProductPage.api.moreFields', { count: apiProduct.required_fields_json.length - 3 })}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[100px] capitalize">
                          {apiProduct.category || t('addProductPage.api.uncategorized')}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectApiProduct(apiProduct);
                          }}
                          className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                        >
                          {t('addProductPage.api.select')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-dashed rounded-xl border-gray-250 dark:border-gray-800">
                  <FiAlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium">
                    {t('addProductPage.api.noResults')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 border border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900 rounded-lg text-xs font-semibold transition"
                  >
                    {t('addProductPage.api.clearSearch')}
                  </button>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-dashed rounded-xl border-gray-250 dark:border-gray-800">
                <FiAlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium">
                  {t('addProductPage.alerts.noApiProducts')}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowApiProductsModal(false)}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-secondary-dark-bg text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold border border-gray-300 dark:border-gray-700 transition"
              >
                {t('addProductPage.fields.cancel')}
              </button>
              {apiProducts.length > 0 && filteredApiProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectApiProduct(filteredApiProducts[0])}
                  className="px-6 py-2 text-white rounded-xl text-sm font-bold transition hover:drop-shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  {t('addProductPage.api.selectFirst')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
