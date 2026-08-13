import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiSearch,
  FiPlus,
  FiTrash2,
  FiEdit,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiInbox
} from 'react-icons/fi';
import { Header } from '../../components';
import axiosInstance from '../../utils/axiosConfig';

export default function ProductsPage() {
  const { t, i18n } = useTranslation(['products', 'common']);
  const navigate = useNavigate();
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [products, setProducts] = useState([]);
  const [sections, setSections] = useState([]);
  const [apis, setApis] = useState([]);
  const [externalProducts, setExternalProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    section: 'All',
    status: 'All',
    currency: 'All',
    product_type: 'All',
  });

  const [selectedApi, setSelectedApi] = useState('');
  const [apiProducts, setApiProducts] = useState([]);
  const [loadingApiProducts, setLoadingApiProducts] = useState(false);
  const [showApiProductsModal, setShowApiProductsModal] = useState(false);
  const [selectedApiProduct, setSelectedApiProduct] = useState(null);

  // Modern UI Search, Sort and Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const [newRequirement, setNewRequirement] = useState({
    field_name: '',
    field_type: 'text',
    is_required: true,
    placeholder: '',
    order: 0,
  });

  const toolbarOptions = ['Search'];

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const productsResponse = await axiosInstance.get('store/admin/products/');
      setProducts(Array.isArray(productsResponse.data) ? productsResponse.data : []);

      const sectionsResponse = await axiosInstance.get('store/admin/sections/');
      setSections(Array.isArray(sectionsResponse.data) ? sectionsResponse.data : []);

      try {
        const apisResponse = await axiosInstance.get('third_party_apis/apis/');
        setApis(apisResponse.data?.results || apisResponse.data || []);
      } catch (apiError) {
        setApis([]);
      }

      try {
        const externalResponse = await axiosInstance.get('store/admin/external-products/');
        setExternalProducts(externalResponse.data?.results || externalResponse.data || []);
      } catch (externalError) {
        setExternalProducts([]);
      }
    } catch (error) {
      alert(t('catalog.alerts.loadFailed', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchApiProducts = async (apiId) => {
    if (!apiId) {
      setApiProducts([]);
      return;
    }

    try {
      setLoadingApiProducts(true);

      try {
        await axiosInstance.post(`third_party_apis/apis/${apiId}/sync_products/`);
      } catch (syncError) {}

      const response = await axiosInstance.get('store/admin/external-products/', {
        params: { api_id: apiId },
      });

      const productsData = response.data?.results || response.data || [];
      setApiProducts(productsData);
    } catch (error) {
      alert(t('catalog.alerts.loadApiFailed', 'Failed to load API products'));
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

    setShowApiProductsModal(false);
    alert(t('catalog.alerts.apiSelected', { name: apiProduct.name }));
  };

  const closeApiProductsModal = () => {
    setShowApiProductsModal(false);
    setSelectedApiProduct(null);
  };

  const handleClearApiSelection = () => {
    setSelectedApi('');
    setSelectedApiProduct(null);
    setApiProducts([]);
    setNewProduct((prev) => ({
      ...prev,
      api_config: '',
      external_product: '',
    }));
  };

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchQuery, pageSize]);

  // Client-side filtering
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (filters.section !== 'All' && product.section !== parseInt(filters.section)) return false;
      if (filters.status !== 'All' && product.is_active !== (filters.status === 'Active')) return false;
      if (filters.currency !== 'All' && product.currency !== filters.currency) return false;
      if (filters.product_type !== 'All' && product.product_type !== filters.product_type) return false;

      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const nameEn = (product.name_en || '').toLowerCase();
        const nameAr = (product.name_ar || '').toLowerCase();
        const descEn = (product.description_en || '').toLowerCase();
        const descAr = (product.description_ar || '').toLowerCase();
        const id = String(product.id);

        if (!nameEn.includes(query) && !nameAr.includes(query) && !descEn.includes(query) && !descAr.includes(query) && !id.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [products, filters, searchQuery]);

  // Client-side sorting
  const sortedProducts = useMemo(() => {
    const temp = [...filteredProducts];
    temp.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'name') {
        valA = isArabic ? (a.name_ar || a.name_en) : (a.name_en || a.name_ar);
        valB = isArabic ? (b.name_ar || b.name_en) : (b.name_en || b.name_ar);
      }

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return temp;
  }, [filteredProducts, sortBy, sortOrder, isArabic]);

  // Client-side pagination
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedProducts.slice(startIndex, startIndex + pageSize);
  }, [sortedProducts, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedProducts.length / pageSize) || 1;

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p.is_active).length;
    const usdProducts = products.filter((p) => p.currency === 'USD').length;
    const sypProducts = products.filter((p) => p.currency === 'SYP').length;
    const amountBased = products.filter((p) => p.product_type === 'amount_based').length;
    const customizationBased = products.filter((p) => p.product_type === 'customization_based').length;

    return { totalProducts, activeProducts, usdProducts, sypProducts, amountBased, customizationBased };
  }, [products]);

  const getImageUrl = (image) => {
    if (!image) return null;
    if (image.startsWith('http')) return image;
    return `/media${image}`;
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setNewProduct({
      name_en: product.name_en || '',
      name_ar: product.name_ar || '',
      description_en: product.description_en || '',
      description_ar: product.description_ar || '',
      section: product.section || '',
      api_config: product.api_config || '',
      external_product: product.external_product || '',
      product_type: product.product_type || 'amount_based',
      currency: product.currency || 'USD',
      base_price: parseFloat(product.base_price) || 0,
      min_amount: parseFloat(product.min_amount) || 0,
      max_amount: parseFloat(product.max_amount) || 0,
      min_amount_price: parseFloat(product.min_amount_price) || 0,
      customization_options: product.customization_options || '',
      customization_prices: product.customization_prices || '',
      image: null,
      is_active: product.is_active !== undefined ? product.is_active : true,
      requirements: product.requirements || [],
    });
    setShowModal(true);
  };

  const handleRequirements = (productId) => {
    alert(t('catalog.alerts.openingRequirements', { id: productId }));
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await axiosInstance.patch(`store/admin/products/${id}/`, {
        is_active: !currentStatus,
      });

      setProducts((prev) => prev.map((product) => (product.id === id ? { ...product, is_active: !currentStatus } : product)));

      const statusText = !currentStatus ? t('catalog.alerts.statusActivated', 'activated') : t('catalog.alerts.statusDeactivated', 'deactivated');
      alert(t('catalog.alerts.statusUpdated', 'Product {{status}} successfully', { status: statusText }));
    } catch (error) {
      alert(t('catalog.alerts.statusUpdateFailed', 'Failed to update product status'));
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(t('catalog.alerts.deleteConfirm', 'Are you sure you want to delete "{{name}}"?', { name }))) {
      try {
        await axiosInstance.delete(`store/admin/products/${id}/`);
        setProducts((prev) => prev.filter((p) => p.id !== id));
        alert(t('catalog.alerts.deleteSuccess', 'Product deleted successfully'));
      } catch (error) {
        alert(t('catalog.alerts.deleteFailed', 'Failed to delete product'));
      }
    }
  };

  const handleAddRequirement = () => {
    if (!newRequirement.field_name.trim()) {
      alert(t('catalog.alerts.reqNameRequired', 'Field name is required'));
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
  };

  const handleRemoveRequirement = (index) => {
    setNewProduct((prev) => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index),
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(t('catalog.alerts.imageTypeErr', 'Please select an image file (JPEG, PNG, etc.)'));
        e.target.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert(t('catalog.alerts.imageSizeErr', 'Image size should be less than 5MB'));
        e.target.value = '';
        return;
      }

      setNewProduct({ ...newProduct, image: file });
    } else {
      setNewProduct({ ...newProduct, image: null });
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();

    try {
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

      let response;
      if (editingProduct) {
        response = await axiosInstance.put(
          `store/admin/products/${editingProduct.id}/`,
          formData,
          config,
        );
      } else {
        response = await axiosInstance.post(
          'store/admin/products/',
          formData,
          config,
        );
      }

      alert(t('catalog.alerts.saveSuccess', 'Product saved successfully!'));
      closeModal();
      fetchData();
    } catch (error) {
      const errorMessage = error.response?.data || t('catalog.alerts.saveFailed', 'Failed to save product');
      alert(t('catalog.alerts.saveError', 'Error: {{message}}', { message: typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage }));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setNewProduct({
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
    setNewRequirement({
      field_name: '',
      field_type: 'text',
      is_required: true,
      placeholder: '',
      order: 0,
    });
    setSelectedApi('');
    setApiProducts([]);
    setSelectedApiProduct(null);
  };

  const clearFilters = () => {
    setFilters({
      section: 'All',
      status: 'All',
      currency: 'All',
      product_type: 'All',
    });
    setSearchQuery('');
    setSortBy('id');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  // Rendering Helpers
  const getProductSectionName = (sectionId) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return t('catalog.table.unknown', 'Unknown');
    return isArabic ? (sec.name_ar || sec.name_en) : (sec.name_en || sec.name_ar);
  };

  const getProductApiName = (apiId) => {
    const api = apis.find((a) => a.id === apiId);
    if (!api) return null;
    return `${api.name} (${api.provider})`;
  };

  const getPaginationText = (start, end, total) => {
    if (isArabic) {
      return `عرض ${start} إلى ${end} من أصل ${total} عنصر`;
    }
    return `Showing ${start} to ${end} of ${total} entries`;
  };

  // Actions cell renderer (Desktop buttons with text)
  const actionsTemplate = (props) => (
    <div className="flex flex-col gap-1.5 justify-center">
      <div className="flex gap-1.5 justify-center">
        <button
          type="button"
          onClick={() => handleEdit(props)}
          className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-xs font-semibold flex items-center gap-1 focus:outline-none"
        >
          ✏️ {t('catalog.actions.edit', 'Edit')}
        </button>
        <button
          type="button"
          onClick={() => handleRequirements(props.id)}
          className="px-2.5 py-1.5 bg-purple-500 hover:bg-purple-650 text-white rounded-lg transition text-xs font-semibold flex items-center gap-1 focus:outline-none"
        >
          📋 {t('catalog.actions.requirements', 'Requirements')}
        </button>
      </div>
      <div className="flex gap-1.5 justify-center">
        <button
          type="button"
          className={`px-2.5 py-1.5 rounded-lg transition text-xs font-semibold flex items-center gap-1 focus:outline-none ${
            props.is_active
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
          onClick={() => toggleStatus(props.id, props.is_active)}
        >
          {props.is_active ? `⏸️ ${t('catalog.actions.hide', 'Hide')}` : `▶️ ${t('catalog.actions.show', 'Show')}`}
        </button>
        <button
          type="button"
          onClick={() => handleDelete(props.id, props.name_en)}
          className="px-2.5 py-1.5 bg-red-500 hover:bg-red-650 text-white rounded-lg transition text-xs font-semibold flex items-center gap-1 focus:outline-none"
        >
          🗑️ {t('catalog.actions.delete', 'Delete')}
        </button>
      </div>
    </div>
  );

  // Skeleton Row template
  const SkeletonRow = () => (
    <tr className="animate-pulse border-b border-gray-200 dark:border-gray-700">
      <td className="px-4 py-4"><div className="w-6 h-4 bg-gray-205 dark:bg-gray-700 rounded" /></td>
      <td className="px-4 py-4"><div className="w-12 h-12 bg-gray-205 dark:bg-gray-700 rounded-lg mx-auto" /></td>
      <td className="px-4 py-4">
        <div className="space-y-2">
          <div className="w-32 h-4 bg-gray-205 dark:bg-gray-700 rounded" />
          <div className="w-20 h-3 bg-gray-205 dark:bg-gray-700 rounded" />
        </div>
      </td>
      <td className="px-4 py-4"><div className="w-16 h-4 bg-gray-205 dark:bg-gray-700 rounded" /></td>
      <td className="px-4 py-4"><div className="w-24 h-4 bg-gray-205 dark:bg-gray-700 rounded" /></td>
      <td className="px-4 py-4"><div className="w-16 h-4 bg-gray-205 dark:bg-gray-700 rounded" /></td>
      <td className="px-4 py-4"><div className="w-20 h-4 bg-gray-205 dark:bg-gray-700 rounded" /></td>
      <td className="px-4 py-4"><div className="w-20 h-5 bg-gray-205 dark:bg-gray-700 rounded-full" /></td>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-1 items-center">
          <div className="w-20 h-6 bg-gray-205 dark:bg-gray-700 rounded" />
          <div className="w-20 h-6 bg-gray-205 dark:bg-gray-700 rounded" />
        </div>
      </td>
    </tr>
  );

  return (
    <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl transition-all">
      
      {/* Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 mb-3 text-start">
        <span className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">{t('common:navigation.store', 'Store')}</span>
        <span>/</span>
        <span>{t('catalog.category')}</span>
        <span>/</span>
        <span className="text-gray-600 dark:text-gray-300 font-semibold">{t('catalog.title')}</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 text-start">
        <Header category={t('catalog.category', 'Store Management')} title={t('catalog.title', 'Products Catalog')} />
        <div className="flex gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition focus:outline-none"
          >
            <FiRefreshCw className="text-sm" />
            <span>{t('common:common.buttons.refresh', 'Refresh')}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/product/add')}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-medium flex items-center gap-2 focus:outline-none shadow-sm"
          >
            <FiPlus className="text-sm" />
            {t('catalog.buttons.addProduct', 'Add Product')}
          </button>
        </div>
      </div>

      {/* Colorful Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-4 text-start">
          <p className="text-blue-800 dark:text-blue-200 font-semibold text-sm">{t('catalog.stats.total', 'Total Products')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.totalProducts}</p>
        </div>
        <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg p-4 text-start">
          <p className="text-green-800 dark:text-green-200 font-semibold text-sm">{t('catalog.stats.active', 'Active Products')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.activeProducts}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg p-4 text-start">
          <p className="text-purple-800 dark:text-purple-200 font-semibold text-sm">{t('catalog.stats.usd', 'USD Products')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.usdProducts}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 rounded-lg p-4 text-start">
          <p className="text-orange-800 dark:text-orange-200 font-semibold text-sm">{t('catalog.stats.syp', 'SYP Products')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{stats.sypProducts}</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800 rounded-lg p-4 text-start">
          <p className="text-indigo-800 dark:text-indigo-200 font-semibold text-sm">{t('catalog.stats.amountBased', 'Amount Based')}</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{stats.amountBased}</p>
        </div>
        <div className="bg-pink-50 border border-pink-200 dark:bg-pink-900/20 dark:border-pink-800 rounded-lg p-4 text-start">
          <p className="text-pink-800 dark:text-pink-200 font-semibold text-sm">{t('catalog.stats.customization', 'Customization')}</p>
          <p className="text-2xl font-bold text-pink-600 dark:text-pink-400 mt-1">{stats.customizationBased}</p>
        </div>
      </div>

      {/* Toolbar & Filter Panel */}
      <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 rounded-xl p-4 mb-6">
        
        {/* Search Input and reset */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-4">
          <div className="relative flex-1 max-w-lg">
            <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-gray-400">
              <FiSearch className="text-base" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-10 pe-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600 focus:outline-none"
              placeholder={t('common:common.search', 'Search')}
            />
          </div>
          
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            🗑️ {t('catalog.filters.clear', 'Clear Filters')}
          </button>
        </div>

        {/* Filters Select Grids */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-start pt-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('catalog.filters.section', 'Section')}</label>
            <select
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
              value={filters.section}
              onChange={(e) => setFilters({ ...filters, section: e.target.value })}
            >
              <option value="All">{t('catalog.filters.allSections', 'All Sections')}</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {isArabic ? (section.name_ar || section.name_en) : (section.name_en || section.name_ar)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('catalog.filters.status', 'Status')}</label>
            <select
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="All">{t('catalog.filters.allStatus', 'All Status')}</option>
              <option value="Active">{t('catalog.filters.active', 'Active')}</option>
              <option value="Inactive">{t('catalog.filters.inactive', 'Inactive')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('catalog.filters.currency', 'Currency')}</label>
            <select
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
              value={filters.currency}
              onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
            >
              <option value="All">{t('catalog.filters.allCurrencies', 'All Currencies')}</option>
              <option value="USD">USD</option>
              <option value="SYP">SYP</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('catalog.filters.type', 'Product Type')}</label>
            <select
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
              value={filters.product_type}
              onChange={(e) => setFilters({ ...filters, product_type: e.target.value })}
            >
              <option value="All">{t('catalog.filters.allTypes', 'All Types')}</option>
              <option value="amount_based">{t('catalog.filters.amountBased', 'Amount Based')}</option>
              <option value="customization_based">{t('catalog.filters.customizationBased', 'Customization Based')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table / Grid Loader */}
      {loading ? (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-750 rounded-xl">
          <table className="min-w-full bg-white dark:bg-secondary-dark-bg">
            <thead className="bg-gray-50 dark:bg-[#33373E]">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.id')}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.image')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.name')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.section')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.price')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.type')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.api')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.status')}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </tbody>
          </table>
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-transparent">
          <div className="text-gray-400 dark:text-gray-500 mb-3"><FiInbox className="text-4xl mx-auto" /></div>
          <p className="font-bold text-sm text-gray-800 dark:text-white">{t('catalog.table.empty')}</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition"
          >
            {t('catalog.filters.clear', 'Clear Filters')}
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto border border-gray-200 dark:border-gray-700/80 rounded-xl shadow-sm">
            <table className="min-w-full bg-white dark:bg-secondary-dark-bg">
              <thead className="bg-gray-50 dark:bg-[#33373E] sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.id')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.image')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.name')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.section')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.price')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.type')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.api')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.status')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-gray-700/80">
                {paginatedProducts.map((product) => {
                  const primaryName = isArabic ? (product.name_ar || product.name_en) : (product.name_en || product.name_ar);
                  const secondaryName = isArabic ? product.name_en : product.name_ar;
                  const priceSymbol = product.currency === 'USD' ? '$' : 'SYP ';
                  const formattedPrice = product.currency === 'USD'
                    ? parseFloat(product.base_price || 0).toFixed(2)
                    : parseFloat(product.base_price || 0).toLocaleString();
                  const imageUrl = getImageUrl(product.image);

                  return (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition duration-150 h-[80px]">
                      <td className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">{product.id}</td>
                      <td className="px-4 py-3 text-center">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.name_en}
                            className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700 bg-gray-100 p-1 mx-auto"
                            onError={(e) => {
                              e.target.src = 'https://cdn-icons-png.flaticon.com/512/1170/1170679.png';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-xs mx-auto">
                            {t('catalog.table.noImage', 'No Image')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-start">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{primaryName}</p>
                        {secondaryName && secondaryName !== primaryName && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{secondaryName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-start">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                          {getProductSectionName(product.section)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-start">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{priceSymbol}{formattedPrice}</p>
                      </td>
                      <td className="px-4 py-3 text-start text-xs text-gray-605 dark:text-gray-400 capitalize">
                        {product.product_type === 'amount_based' ? t('catalog.filters.amountBased', 'Amount Based') : t('catalog.filters.customizationBased', 'Customization Based')}
                      </td>
                      <td className="px-4 py-3 text-start text-xs text-gray-550 dark:text-gray-400">
                        {getProductApiName(product.api_config) || <span className="text-gray-400 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 text-start">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          product.is_active
                            ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900/50'
                            : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50'
                        }`}>
                          {product.is_active ? `🟢 ${t('catalog.table.active')}` : `🔴 ${t('catalog.table.inactive')}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {actionsTemplate(product)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (< 768px) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedProducts.map((product) => {
              const primaryName = isArabic ? (product.name_ar || product.name_en) : (product.name_en || product.name_ar);
              const secondaryName = isArabic ? product.name_en : product.name_ar;
              const priceSymbol = product.currency === 'USD' ? '$' : 'SYP ';
              const formattedPrice = product.currency === 'USD'
                ? parseFloat(product.base_price || 0).toFixed(2)
                : parseFloat(product.base_price || 0).toLocaleString();
              const imageUrl = getImageUrl(product.image);

              return (
                <div key={product.id} className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-700/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-start">
                  <div className="flex gap-3 mb-3 items-start">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.name_en}
                        className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700 bg-gray-100 p-1 flex-shrink-0"
                        onError={(e) => {
                          e.target.src = 'https://cdn-icons-png.flaticon.com/512/1170/1170679.png';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-xs flex-shrink-0">
                        {t('catalog.table.noImage')}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs text-gray-400">#{product.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          product.is_active
                            ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-300'
                            : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-300'
                        }`}>
                          {product.is_active ? t('catalog.table.active') : t('catalog.table.inactive')}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">{primaryName}</h4>
                      {secondaryName && secondaryName !== primaryName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{secondaryName}</p>
                      )}

                      <div className="mt-2">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-[10px] font-medium border dark:border-gray-700">
                          {getProductSectionName(product.section)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-800 mt-2 text-xs">
                    <div>
                      <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">{t('catalog.table.price')}</p>
                      <p className="font-extrabold text-sm text-gray-950 dark:text-white mt-0.5">{priceSymbol}{formattedPrice}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-550 text-[10px] font-bold uppercase tracking-wider">{t('catalog.table.type')}</p>
                      <p className="text-gray-700 dark:text-gray-300 font-semibold mt-0.5 capitalize">
                        {product.product_type === 'amount_based' ? t('catalog.filters.amountBased') : t('catalog.filters.customizationBased')}
                      </p>
                    </div>
                  </div>

                  {/* Mobile Actions Bottom buttons */}
                  <div className="flex flex-col gap-1.5 pt-3 border-t border-gray-100 dark:border-gray-850 mt-1">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(product)}
                        className="flex-1 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 focus:outline-none"
                      >
                        ✏️ {t('catalog.actions.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequirements(product.id)}
                        className="flex-1 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 focus:outline-none"
                      >
                        📋 {t('catalog.actions.requirements')}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleStatus(product.id, product.is_active)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 focus:outline-none ${
                          product.is_active ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {product.is_active ? `⏸️ ${t('catalog.actions.hide')}` : `▶️ ${t('catalog.actions.show')}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id, product.name_en)}
                        className="flex-1 py-1.5 bg-red-500 hover:bg-red-605 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 focus:outline-none"
                      >
                        🗑️ {t('catalog.actions.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Client Pagination Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            {/* Sizing dropdown */}
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 order-3 sm:order-1">
              <span>{isArabic ? 'عرض' : 'Show'}</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value))}
                className="border border-gray-300 dark:border-gray-600 rounded-lg p-1 bg-white dark:bg-secondary-dark-bg focus:outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>{isArabic ? 'عنصر بالصفحة' : 'entries per page'}</span>
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-1.5 order-1 sm:order-2">
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 border border-gray-300 dark:border-gray-600 text-gray-500 rounded-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-40"
              >
                {isArabic ? <FiChevronRight /> : <FiChevronLeft />}
              </button>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 px-3">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 border border-gray-300 dark:border-gray-600 text-gray-500 rounded-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-40"
              >
                {isArabic ? <FiChevronLeft /> : <FiChevronRight />}
              </button>
            </div>

            {/* Results count text */}
            <div className="text-xs text-gray-505 dark:text-gray-400 order-2 sm:order-3">
              {getPaginationText(
                (currentPage - 1) * pageSize + 1,
                Math.min(currentPage * pageSize, sortedProducts.length),
                sortedProducts.length
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit/Add Modals (unmodified logic and original Stark layout inputs) */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-secondary-dark-bg dark:text-white">
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold">
                {editingProduct ? t('catalog.modal.editTitle', 'Edit Product') : t('catalog.modal.addTitle', 'Add New Product')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 text-lg dark:text-gray-300 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-start">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('catalog.modal.fields.nameEn', 'English Name *')}
                  </label>
                  <input
                    type="text"
                    value={newProduct.name_en}
                    onChange={(e) => setNewProduct({ ...newProduct, name_en: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                    required
                    placeholder={t('catalog.modal.fields.placeholders.nameEn')}
                  />
                </div>

                <div className="text-start">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('catalog.modal.fields.nameAr', 'Arabic Name *')}
                  </label>
                  <input
                    type="text"
                    value={newProduct.name_ar}
                    onChange={(e) => setNewProduct({ ...newProduct, name_ar: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                    required
                    placeholder={t('catalog.modal.fields.placeholders.nameAr')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-start">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('catalog.modal.fields.descEn', 'English Description')}
                  </label>
                  <textarea
                    value={newProduct.description_en}
                    onChange={(e) => setNewProduct({ ...newProduct, description_en: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                    rows="2"
                    placeholder={t('catalog.modal.fields.placeholders.descEn')}
                  />
                </div>

                <div className="text-start">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('catalog.modal.fields.descAr', 'Arabic Description')}
                  </label>
                  <textarea
                    value={newProduct.description_ar}
                    onChange={(e) => setNewProduct({ ...newProduct, description_ar: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                    rows="2"
                    placeholder={t('catalog.modal.fields.placeholders.descAr')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-start">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('catalog.modal.fields.section', 'Section *')}
                  </label>
                  <select
                    value={newProduct.section}
                    onChange={(e) => setNewProduct({ ...newProduct, section: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                    required
                  >
                    <option value="">{t('catalog.modal.fields.selectSectionPlaceholder', 'Select a section')}</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {isArabic ? `${section.name_ar} / ${section.name_en}` : `${section.name_en} / ${section.name_ar}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-start">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('catalog.modal.fields.apiConfig', 'API Configuration')}
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={newProduct.api_config}
                        onChange={(e) => handleApiChange(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                      >
                        <option value="">{t('catalog.modal.fields.noApiOption', 'No API')}</option>
                        {apis.map((api) => (
                          <option key={api.id} value={api.id}>
                            {api.name} ({api.provider})
                          </option>
                        ))}
                      </select>
                      {newProduct.api_config && (
                        <button
                          type="button"
                          onClick={handleClearApiSelection}
                          className="px-3 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {selectedApiProduct && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800 text-start">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-800 dark:text-green-300">
                              {t('catalog.modal.fields.connectedTo', 'Connected to: {{name}}', { name: selectedApiProduct.name })}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400">
                              {t('catalog.modal.fields.connectedInfo', { price: selectedApiProduct.base_price, provider: selectedApiProduct.provider, id: selectedApiProduct.external_id })}
                            </p>
                            {selectedApiProduct.required_fields_json?.length > 0 && (
                              <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
                                {t('catalog.modal.fields.autoAddedFields', { count: selectedApiProduct.required_fields_json.length })}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowApiProductsModal(true)}
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                          >
                            {t('catalog.modal.fields.changeApi', 'Change')}
                          </button>
                        </div>
                      </div>
                    )}

                    {newProduct.api_config && !selectedApiProduct && (
                      <button
                        type="button"
                        onClick={() => setShowApiProductsModal(true)}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium flex items-center justify-center gap-2"
                      >
                        🔗 {t('catalog.modal.fields.selectApi', 'Select API Product')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-start">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('catalog.modal.fields.productType', 'Product Type *')}
                  </label>
                  <select
                    value={newProduct.product_type}
                    onChange={(e) => setNewProduct({ ...newProduct, product_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                    required
                  >
                    <option value="amount_based">{t('catalog.filters.amountBased', 'Amount Based')}</option>
                    <option value="customization_based">{t('catalog.filters.customizationBased', 'Customization Based')}</option>
                  </select>
                </div>

                <div className="text-start">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('catalog.modal.fields.currency', 'Currency *')}
                  </label>
                  <select
                    value={newProduct.currency}
                    onChange={(e) => setNewProduct({ ...newProduct, currency: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                    required
                  >
                    <option value="USD">USD ($)</option>
                    <option value="SYP">{t('catalog.modal.fields.sypOption', 'Syrian Pound (SYP)')}</option>
                  </select>
                </div>
              </div>

              {newProduct.product_type === 'amount_based' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-start">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('catalog.modal.fields.minAmount', 'Min Amount *')}
                    </label>
                    <input
                      type="number"
                      value={newProduct.min_amount}
                      onChange={(e) => setNewProduct({ ...newProduct, min_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="text-start">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('catalog.modal.fields.maxAmount', 'Max Amount *')}
                    </label>
                    <input
                      type="number"
                      value={newProduct.max_amount}
                      onChange={(e) => setNewProduct({ ...newProduct, max_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="text-start">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('catalog.modal.fields.minAmountPrice', 'Min Amount Price *')}
                    </label>
                    <input
                      type="number"
                      value={newProduct.min_amount_price}
                      onChange={(e) => setNewProduct({ ...newProduct, min_amount_price: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
              )}

              {newProduct.product_type === 'customization_based' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-start">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('catalog.modal.fields.customOptions', 'Customization Options *')}
                    </label>
                    <textarea
                      value={newProduct.customization_options}
                      onChange={(e) => setNewProduct({ ...newProduct, customization_options: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                      rows="3"
                      placeholder={t('catalog.modal.fields.placeholders.customOptions')}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('catalog.modal.fields.optionHint', 'Comma-separated options')}</p>
                  </div>
                  <div className="text-start">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('catalog.modal.fields.customPrices', 'Customization Prices *')}
                    </label>
                    <textarea
                      value={newProduct.customization_prices}
                      onChange={(e) => setNewProduct({ ...newProduct, customization_prices: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                      rows="3"
                      placeholder={t('catalog.modal.fields.placeholders.customPrices')}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('catalog.modal.fields.priceHint', 'Comma-separated prices matching the options')}</p>
                  </div>
                </div>
              )}

              <div className="text-start">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('catalog.modal.fields.basePrice', 'Base Price *')}
                </label>
                <input
                  type="number"
                  value={newProduct.base_price}
                  onChange={(e) => setNewProduct({ ...newProduct, base_price: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="text-start">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('catalog.modal.fields.image', 'Product Image')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {newProduct.image ? t('catalog.modal.fields.selected', 'Selected: {{name}}', { name: newProduct.image.name }) : t('catalog.modal.fields.noFile', 'No file selected')}
                </p>

                {newProduct.image instanceof File && (
                  <div className="mt-2">
                    <p className="text-xs text-green-600 mb-1">{t('catalog.modal.fields.preview', 'Preview:')}</p>
                    <img
                      src={URL.createObjectURL(newProduct.image)}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded border"
                    />
                  </div>
                )}

                {editingProduct && editingProduct.image && !newProduct.image && (
                  <div className="mt-2">
                    <p className="text-xs text-blue-600 mb-1">{t('catalog.modal.fields.currentImage', 'Current Image:')}</p>
                    <img
                      src={getImageUrl(editingProduct.image)}
                      alt="Current"
                      className="w-16 h-16 object-cover rounded border"
                      onError={(e) => {
                        e.target.src = 'https://cdn-icons-png.flaticon.com/512/1170/1170679.png';
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 dark:bg-[#33373E] dark:border dark:border-gray-700 rounded-lg text-start">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">{t('catalog.modal.fields.requirements', 'Product Requirements')}</h3>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
                  <input
                    type="text"
                    value={newRequirement.field_name}
                    onChange={(e) => setNewRequirement({ ...newRequirement, field_name: e.target.value })}
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-[#20232A] dark:text-white dark:border-gray-650"
                    placeholder={t('catalog.modal.fields.fieldName', 'Field name')}
                  />
                  <select
                    value={newRequirement.field_type}
                    onChange={(e) => setNewRequirement({ ...newRequirement, field_type: e.target.value })}
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-[#20232A] dark:text-white dark:border-gray-650"
                  >
                    <option value="text">{t('catalog.modal.types.text', 'Text')}</option>
                    <option value="number">{t('catalog.modal.types.number', 'Number')}</option>
                    <option value="email">{t('catalog.modal.types.email', 'Email')}</option>
                    <option value="phone">{t('catalog.modal.types.phone', 'Phone')}</option>
                    <option value="id">{t('catalog.modal.types.id', 'ID')}</option>
                  </select>
                  <input
                    type="text"
                    value={newRequirement.placeholder}
                    onChange={(e) => setNewRequirement({ ...newRequirement, placeholder: e.target.value })}
                    className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-[#20232A] dark:text-white dark:border-gray-650"
                    placeholder={t('catalog.modal.fields.placeholder', 'Placeholder')}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_required"
                      checked={newRequirement.is_required}
                      onChange={(e) => setNewRequirement({ ...newRequirement, is_required: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_required" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      {t('catalog.modal.fields.required', 'Required')}
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRequirement}
                    className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-xs font-medium"
                  >
                    {t('catalog.modal.fields.addRequirement', 'Add')}
                  </button>
                </div>

                {newProduct.requirements.length > 0 && (
                  <div className="space-y-2">
                    {newProduct.requirements.map((req, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-secondary-dark-bg rounded border dark:border-gray-750">
                        <div>
                          <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{req.field_name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ms-2">({t('catalog.modal.types.' + req.field_type, req.field_type)})</span>
                          {req.placeholder && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 ms-2">{t('catalog.modal.fields.placeholder', 'Placeholder')}: {req.placeholder}</span>
                          )}
                          <span className={`text-xs ms-2 ${req.is_required ? 'text-red-500' : 'text-gray-400'}`}>
                            {req.is_required ? t('catalog.modal.fields.required', 'Required') : t('catalog.modal.fields.optional', 'Optional')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRequirement(index)}
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs"
                        >
                          {t('catalog.modal.fields.removeRequirement', 'Remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-[#33373E] dark:border dark:border-gray-700 rounded-lg text-start">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={newProduct.is_active}
                  onChange={(e) => setNewProduct({ ...newProduct, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-305 cursor-pointer">
                  {t('catalog.modal.fields.isActive', 'Active (Available for purchase)')}
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-medium focus:outline-none"
                >
                  {t('catalog.modal.fields.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium focus:outline-none"
                >
                  {editingProduct ? t('catalog.modal.fields.updateProduct', 'Update Product') : t('catalog.modal.fields.createProduct', 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sync API Products Modal (unmodified logic) */}
      {showApiProductsModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto dark:bg-secondary-dark-bg dark:text-white shadow-xl">
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold">
                {t('catalog.modal.apiTitle', 'Select API Product')}
              </h2>
              <button
                type="button"
                onClick={closeApiProductsModal}
                className="text-gray-500 hover:text-gray-700 text-lg dark:text-gray-300 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 text-start">
              <p className="text-sm text-gray-650 dark:text-gray-400">
                {t('catalog.modal.apiSubtitle', 'Choose a product from the API to auto-fill the product details and requirements.')}
              </p>
            </div>

            {loadingApiProducts ? (
              <div className="flex justify-center items-center h-32">
                <div className="text-lg">{t('catalog.alerts.loadingApiProducts', 'Loading API products...')}</div>
              </div>
            ) : apiProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apiProducts.map((apiProduct) => (
                  <div
                    key={apiProduct.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all text-start flex flex-col justify-between ${
                      selectedApiProduct?.id === apiProduct.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-25 dark:border-gray-750 dark:hover:border-blue-500'
                    }`}
                    onClick={() => handleSelectApiProduct(apiProduct)}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{apiProduct.name}</h3>
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          ${apiProduct.base_price}
                        </span>
                      </div>

                      {apiProduct.description && (
                        <p className="text-sm text-gray-605 dark:text-gray-400 mb-3 line-clamp-2">
                          {apiProduct.description}
                        </p>
                      )}

                      {apiProduct.required_fields_json && apiProduct.required_fields_json.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('catalog.modal.fields.reqListHeader', 'Required Fields:')}</p>
                          <div className="space-y-1">
                            {apiProduct.required_fields_json.slice(0, 3).map((field, index) => {
                              const fieldData = typeof field === 'object' ? field : { name: field, type: 'text', required: true };
                              return (
                                <div key={index} className="flex items-center text-xs text-gray-605 dark:text-gray-400">
                                  <span className="w-2 h-2 bg-gray-400 rounded-full me-2" />
                                  {fieldData.name} ({t('catalog.modal.types.' + fieldData.type, fieldData.type)})
                                  {fieldData.required && (
                                    <span className="ms-1 text-red-500">*</span>
                                  )}
                                </div>
                              );
                            })}
                            {apiProduct.required_fields_json.length > 3 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {t('catalog.modal.fields.moreFields', '+{{count}} more fields', { count: apiProduct.required_fields_json.length - 3 })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex justify-between items-center pt-2 border-t dark:border-gray-750">
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {apiProduct.category || t('catalog.modal.fields.uncategorized', 'Uncategorized')}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectApiProduct(apiProduct);
                        }}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-650"
                      >
                        {t('catalog.modal.fields.select', 'Select')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {t('catalog.alerts.noApiProducts', 'No products found for this API. Make sure the API is properly configured and has available products.')}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t mt-4 dark:border-gray-700">
              <button
                type="button"
                onClick={closeApiProductsModal}
                className="px-6 py-2.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-medium"
              >
                {t('catalog.modal.fields.cancel', 'Cancel')}
              </button>
              {apiProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (apiProducts.length > 0) {
                      handleSelectApiProduct(apiProducts[0]);
                    }
                  }}
                  className="px-6 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
                >
                  {t('catalog.modal.fields.selectFirst', 'Select First Product')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
