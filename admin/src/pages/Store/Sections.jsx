import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FiSearch,
  FiPlus,
  FiTrash2,
  FiEdit,
  FiEye,
  FiEyeOff,
  FiFolder,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiInbox
} from 'react-icons/fi';
import { Header } from '../../components';
import axiosInstance from '../../utils/axiosConfig';

const StoreSections = () => {
  const { t, i18n } = useTranslation(['sections', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [filters, setFilters] = useState({
    status: 'All',
  });

  // Search, Sort and Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [newSection, setNewSection] = useState({
    name_en: '',
    name_ar: '',
    description: '',
    image: null,
    father_section: '',
    is_active: true,
  });

  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('store/admin/sections/');
      if (Array.isArray(response.data)) {
        setData(response.data);
        setSections(response.data);
      } else {
        setData([]);
      }
    } catch (error) {
      alert(t('catalog.alerts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchQuery, pageSize]);

  // Client-side filtering
  const filteredData = useMemo(() => {
    return data.filter((section) => {
      if (filters.status !== 'All' && section.is_active !== (filters.status === 'Active')) return false;

      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const nameEn = (section.name_en || '').toLowerCase();
        const nameAr = (section.name_ar || '').toLowerCase();
        const desc = (section.description || '').toLowerCase();
        const id = String(section.id);

        if (!nameEn.includes(query) && !nameAr.includes(query) && !desc.includes(query) && !id.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [data, filters, searchQuery]);

  // Client-side pagination
  const paginatedSections = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;

  const stats = useMemo(() => {
    const totalSections = data.length;
    const activeSections = data.filter((s) => s.is_active).length;
    const totalProducts = data.reduce((sum, section) => sum + (section.products_count || 0), 0);
    const mainSections = data.filter((s) => !s.father_section).length;
    const subsections = data.filter((s) => s.father_section).length;

    return { totalSections, activeSections, totalProducts, mainSections, subsections };
  }, [data]);

  const getImageUrl = (image) => {
    if (!image) return null;
    if (image.startsWith('http')) return image;
    return `/media${image}`;
  };

  const handleEdit = (section) => {
    setEditingSection(section);
    setNewSection({
      name_en: section.name_en,
      name_ar: section.name_ar,
      description: section.description || '',
      image: null,
      father_section: section.father_section || '',
      is_active: section.is_active,
    });
    setIsModalOpen(true);
  };

  const handleViewProducts = (sectionId) => {
    alert(t('catalog.alerts.navProducts', { id: sectionId }));
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await axiosInstance.patch(`store/admin/sections/${id}/`, {
        is_active: !currentStatus,
      });

      setData((prev) => prev.map((section) => (section.id === id ? { ...section, is_active: !currentStatus } : section)));

      const statusText = !currentStatus
        ? t('catalog.alerts.statusActivated')
        : t('catalog.alerts.statusDeactivated');
      alert(t('catalog.alerts.statusUpdated', { status: statusText }));
    } catch (error) {
      alert(t('catalog.alerts.statusUpdateFailed'));
    }
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(t('catalog.alerts.deleteConfirm', { title }))) {
      try {
        await axiosInstance.delete(`store/admin/sections/${id}/`);
        setData((prev) => prev.filter((s) => s.id !== id));
        alert(t('catalog.alerts.deleteSuccess'));
      } catch (error) {
        alert(t('catalog.alerts.deleteFailed'));
      }
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(t('catalog.alerts.imageTypeErr'));
        e.target.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert(t('catalog.alerts.imageSizeErr'));
        e.target.value = '';
        return;
      }

      setNewSection({ ...newSection, image: file });
    } else {
      setNewSection({ ...newSection, image: null });
    }
  };

  const handleSaveSection = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();

      formData.append('name_en', newSection.name_en);
      formData.append('name_ar', newSection.name_ar);
      formData.append('description', newSection.description);
      formData.append('is_active', newSection.is_active.toString());

      if (newSection.father_section) {
        formData.append('father_section', newSection.father_section);
      }

      if (newSection.image instanceof File) {
        formData.append('image', newSection.image);
      }

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        transformRequest: (data) => data,
      };

      let response;
      if (editingSection) {
        response = await axiosInstance.patch(
          `store/admin/sections/${editingSection.id}/`,
          formData,
          config,
        );
      } else {
        response = await axiosInstance.post(
          'store/admin/sections/',
          formData,
          config,
        );
      }

      if (editingSection) {
        setData((prev) => prev.map((section) => (section.id === editingSection.id ? response.data : section)));
      } else {
        setData((prev) => [...prev, response.data]);
      }

      alert(t('catalog.alerts.saveSuccess'));
      closeModal();
      fetchSections();
    } catch (error) {
      const errorMessage = error.response?.data || 'Failed to save section';
      const displayMsg = typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage;
      alert(t('catalog.alerts.saveError', { message: displayMsg }));
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSection(null);
    setNewSection({
      name_en: '',
      name_ar: '',
      description: '',
      image: null,
      father_section: '',
      is_active: true,
    });
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
          ✏️ {t('catalog.actions.edit')}
        </button>
        <button
          type="button"
          onClick={() => handleViewProducts(props.id)}
          className="px-2.5 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition text-xs font-semibold flex items-center gap-1 focus:outline-none"
        >
          📦 {t('catalog.actions.products')}
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
          {props.is_active ? `⏸️ ${t('catalog.actions.hide')}` : `▶️ ${t('catalog.actions.show')}`}
        </button>
        <button
          type="button"
          onClick={() => handleDelete(props.id, isArabic ? (props.name_ar || props.name_en) : (props.name_en || props.name_ar))}
          className="px-2.5 py-1.5 bg-red-500 hover:bg-red-650 text-white rounded-lg transition text-xs font-semibold flex items-center gap-1 focus:outline-none"
        >
          🗑️ {t('catalog.actions.delete')}
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
      <td className="px-4 py-4"><div className="w-10 h-4 bg-gray-205 dark:bg-gray-700 rounded mx-auto" /></td>
      <td className="px-4 py-4"><div className="w-16 h-5 bg-gray-205 dark:bg-gray-700 rounded mx-auto" /></td>
      <td className="px-4 py-4"><div className="w-20 h-4 bg-gray-205 dark:bg-gray-700 rounded" /></td>
      <td className="px-4 py-4"><div className="w-20 h-5 bg-gray-205 dark:bg-gray-700 rounded-full mx-auto" /></td>
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
        <Header category={t('catalog.category')} title={t('catalog.title')} />
        <div className="flex gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={fetchSections}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition focus:outline-none"
          >
            <FiRefreshCw className="text-sm" />
            <span>{t('common:common.buttons.refresh', 'Refresh')}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/section/add')}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-medium flex items-center gap-2 focus:outline-none shadow-sm"
          >
            <FiPlus className="text-sm" />
            {t('catalog.buttons.addSection', 'Add Section')}
          </button>
        </div>
      </div>

      {/* Colorful Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-4 text-start">
          <p className="text-blue-800 dark:text-blue-200 font-semibold text-sm">{t('catalog.stats.total')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.totalSections}</p>
        </div>
        <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg p-4 text-start">
          <p className="text-green-800 dark:text-green-200 font-semibold text-sm">{t('catalog.stats.active')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.activeSections}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg p-4 text-start">
          <p className="text-purple-800 dark:text-purple-200 font-semibold text-sm">{t('catalog.stats.products')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.totalProducts}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 rounded-lg p-4 text-start">
          <p className="text-orange-800 dark:text-orange-200 font-semibold text-sm">{t('catalog.stats.main')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{stats.mainSections}</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800 rounded-lg p-4 text-start">
          <p className="text-indigo-800 dark:text-indigo-200 font-semibold text-sm">{t('catalog.stats.sub')}</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{stats.subsections}</p>
        </div>
      </div>

      {/* Toolbar & Filter Panel */}
      <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
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

        <div className="flex gap-3 text-start items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{t('catalog.filters.status')}:</span>
            <select
              className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-[#20232A] dark:text-white dark:border-gray-600 text-xs"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="All">{t('catalog.filters.allStatus')}</option>
              <option value="Active">{t('catalog.filters.activeOnly')}</option>
              <option value="Inactive">{t('catalog.filters.inactiveOnly')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table / Grid Loader */}
      {loading ? (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-750 rounded-xl">
          <table className="min-w-full bg-white dark:bg-secondary-dark-bg">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Image</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Section Details</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Products Count</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
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
      ) : filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-transparent">
          <div className="text-gray-400 dark:text-gray-500 mb-3"><FiInbox className="text-4xl mx-auto" /></div>
          <p className="font-bold text-sm text-gray-800 dark:text-white">{t('catalog.table.emptyState')}</p>
          <button
            type="button"
            onClick={() => navigate('/section/add')}
            className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
          >
            <FiPlus /> {t('catalog.buttons.addSection')}
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto border border-gray-200 dark:border-gray-700/80 rounded-xl shadow-sm">
            <table className="min-w-full bg-white dark:bg-secondary-dark-bg">
              <thead className="bg-gray-50 dark:bg-[#33373E] sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.id')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.image')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.details')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.products')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.type')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.created')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.status')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('catalog.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-gray-700/80">
                {paginatedSections.map((section) => {
                  const primaryName = isArabic ? (section.name_ar || section.name_en) : (section.name_en || section.name_ar);
                  const secondaryName = isArabic ? section.name_en : section.name_ar;
                  const imageUrl = getImageUrl(section.image);

                  return (
                    <tr key={section.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition duration-150 h-[80px]">
                      <td className="px-4 py-3 text-xs font-medium text-gray-505 dark:text-gray-400">{section.id}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={primaryName}
                              className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700 bg-gray-100 p-1 mx-auto"
                              onError={(e) => {
                                e.target.src = 'https://cdn-icons-png.flaticon.com/512/1170/1170679.png';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-xs mx-auto">
                              {t('catalog.table.noImage')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-start">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{primaryName}</p>
                        {secondaryName && secondaryName !== primaryName && (
                          <p className="text-xs text-gray-500 dark:text-gray-405 mt-0.5">{secondaryName}</p>
                        )}
                        {section.description && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1 mt-0.5">{section.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-gray-800 dark:text-white">
                        {section.products_count || 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 border text-xs font-semibold rounded ${
                          !section.father_section
                            ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-305 dark:border-purple-900/50'
                            : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50'
                        }`}>
                          {!section.father_section ? t('catalog.table.mainType') : t('catalog.table.subType')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-start text-xs text-gray-500 dark:text-gray-400">
                        {new Date(section.created_at).toLocaleDateString(i18n.resolvedLanguage)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          section.is_active
                            ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900/50'
                            : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50'
                        }`}>
                          {section.is_active ? `🟢 ${t('catalog.table.active')}` : `🔴 ${t('catalog.table.inactive')}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {actionsTemplate(section)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (< 768px) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedSections.map((section) => {
              const primaryName = isArabic ? (section.name_ar || section.name_en) : (section.name_en || section.name_ar);
              const secondaryName = isArabic ? section.name_en : section.name_ar;
              const imageUrl = getImageUrl(section.image);

              return (
                <div key={section.id} className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-700/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-start">
                  <div className="flex gap-3 mb-3 items-start">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={primaryName}
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
                        <span className="text-xs text-gray-400">#{section.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          section.is_active
                            ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-300'
                            : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-305'
                        }`}>
                          {section.is_active ? t('catalog.table.active') : t('catalog.table.inactive')}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">{primaryName}</h4>
                      {secondaryName && secondaryName !== primaryName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{secondaryName}</p>
                      )}

                      <div className="mt-2">
                        <span className={`px-2 py-0.5 border text-[10px] font-semibold rounded ${
                          !section.father_section
                            ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/20 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300'
                        }`}>
                          {!section.father_section ? t('catalog.table.mainType') : t('catalog.table.subType')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-800 mt-2 text-xs">
                    <div>
                      <p className="text-gray-400 dark:text-gray-550 text-[10px] font-bold uppercase tracking-wider">{t('catalog.table.products')}</p>
                      <p className="font-extrabold text-sm text-gray-950 dark:text-white mt-0.5">{section.products_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-550 text-[10px] font-bold uppercase tracking-wider">{t('catalog.table.created')}</p>
                      <p className="text-gray-755 dark:text-gray-300 font-semibold mt-0.5">
                        {new Date(section.created_at).toLocaleDateString(i18n.resolvedLanguage)}
                      </p>
                    </div>
                  </div>

                  {/* Mobile Actions Bottom buttons */}
                  <div className="flex flex-col gap-1.5 pt-3 border-t border-gray-100 dark:border-gray-850 mt-1">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(section)}
                        className="flex-1 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 focus:outline-none"
                      >
                        ✏️ {t('catalog.actions.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewProducts(section.id)}
                        className="flex-1 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 focus:outline-none"
                      >
                        📦 {t('catalog.actions.products')}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleStatus(section.id, section.is_active)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 focus:outline-none ${
                          section.is_active ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {section.is_active ? `⏸️ ${t('catalog.actions.hide')}` : `▶️ ${t('catalog.actions.show')}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(section.id, primaryName)}
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
            <div className="flex items-center gap-2 text-xs text-gray-505 dark:text-gray-400 order-3 sm:order-1">
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
              <span className="text-xs font-bold text-gray-700 dark:text-gray-350 px-3">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 border border-gray-300 dark:border-gray-600 text-gray-505 rounded-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-40"
              >
                {isArabic ? <FiChevronLeft /> : <FiChevronRight />}
              </button>
            </div>

            {/* Results count text */}
            <div className="text-xs text-gray-505 dark:text-gray-400 order-2 sm:order-3">
              {getPaginationText(
                (currentPage - 1) * pageSize + 1,
                Math.min(currentPage * pageSize, filteredData.length),
                filteredData.length
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit Section Modal (unmodified logic) */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-secondary-dark-bg dark:text-white shadow-xl">
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-gray-750">
              <h2 className="text-xl font-semibold">
                {editingSection ? t('catalog.modal.editTitle') : t('catalog.modal.addTitle')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 text-lg dark:text-gray-300 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-start">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('catalog.modal.fields.nameEn')}
                  </label>
                  <input
                    type="text"
                    value={newSection.name_en}
                    onChange={(e) => setNewSection({ ...newSection, name_en: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                    required
                    placeholder={t('catalog.modal.fields.nameEnPlaceholder')}
                  />
                </div>

                <div className="text-start">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('catalog.modal.fields.nameAr')}
                  </label>
                  <input
                    type="text"
                    value={newSection.name_ar}
                    onChange={(e) => setNewSection({ ...newSection, name_ar: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                    required
                    placeholder={t('catalog.modal.fields.nameArPlaceholder')}
                  />
                </div>
              </div>

              <div className="text-start">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('catalog.modal.fields.desc')}
                </label>
                <textarea
                  value={newSection.description}
                  onChange={(e) => setNewSection({
                    ...newSection,
                    description: e.target.value,
                  })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                  rows="3"
                  placeholder={t('catalog.modal.fields.descPlaceholder')}
                />
              </div>

              <div className="text-start">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('catalog.modal.fields.image')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {newSection.image
                    ? t('catalog.modal.fields.selected', { name: newSection.image.name })
                    : editingSection?.image ? t('catalog.modal.fields.currentKept') : t('catalog.modal.fields.noFile')}
                </p>

                {newSection.image instanceof File && (
                  <div className="mt-2 text-start">
                    <p className="text-xs text-green-600 mb-1 font-bold">{t('catalog.modal.fields.preview')}</p>
                    <img
                      src={URL.createObjectURL(newSection.image)}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded border"
                    />
                  </div>
                )}

                {editingSection && editingSection.image && !newSection.image && (
                  <div className="mt-2 text-start">
                    <p className="text-xs text-blue-600 mb-1 font-bold">{t('catalog.modal.fields.currentImage')}</p>
                    <img
                      src={getImageUrl(editingSection.image)}
                      alt="Current"
                      className="w-16 h-16 object-cover rounded border"
                      onError={(e) => {
                        e.target.src = 'https://cdn-icons-png.flaticon.com/512/1170/1170679.png';
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="text-start">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('catalog.modal.fields.parent')}
                </label>
                <select
                  value={newSection.father_section}
                  onChange={(e) => setNewSection({ ...newSection, father_section: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-secondary-dark-bg dark:text-white dark:border-gray-600"
                >
                  <option value="">{t('catalog.modal.fields.noParentOption')}</option>
                  {sections
                    .filter((sect) => !sect.father_section && sect.id !== editingSection?.id)
                    .map((sect) => {
                      const displayName = isArabic
                        ? `${sect.name_ar || sect.name_en}${sect.name_ar && sect.name_en ? ` (${sect.name_en})` : ''}`
                        : `${sect.name_en || sect.name_ar}${sect.name_en && sect.name_ar ? ` (${sect.name_ar})` : ''}`;
                      return (
                        <option key={sect.id} value={sect.id}>
                          {displayName}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-[#33373E] dark:border dark:border-gray-700 rounded-lg text-start">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={newSection.is_active}
                  onChange={(e) => setNewSection({ ...newSection, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                  {t('catalog.modal.fields.isActive')}
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-medium focus:outline-none"
                >
                  {t('catalog.modal.fields.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium focus:outline-none"
                >
                  {editingSection ? t('catalog.modal.fields.updateSection') : t('catalog.modal.fields.createSection')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StoreSections;
