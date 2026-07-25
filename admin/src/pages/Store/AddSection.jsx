import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiArrowLeft,
  FiCheck,
  FiUploadCloud,
  FiX,
  FiAlertCircle,
  FiFolder,
  FiInfo,
  FiImage
} from 'react-icons/fi';
import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

export default function AddSection() {
  const { t, i18n } = useTranslation(['sections', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';
  const navigate = useNavigate();
  const { currentColor } = useStateContext();
  const primaryColor = currentColor || '#4F46E5';

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isDragging, setIsDragging] = useState(false);

  const [newSection, setNewSection] = useState({
    name_en: '',
    name_ar: '',
    description: '',
    image: null,
    father_section: '',
    is_active: true,
  });

  // Fetch sections to populate parent category dropdown
  useEffect(() => {
    const fetchSections = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get('store/admin/sections/');
        if (Array.isArray(response.data)) {
          setSections(response.data);
        }
      } catch (error) {
        alert(t('catalog.alerts.loadFailed', 'Failed to load sections'));
      } finally {
        setLoading(false);
      }
    };
    fetchSections();
  }, [t]);

  // Image upload validation & state
  const handleImageFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('catalog.alerts.imageTypeErr', 'Please select an image file (JPEG, PNG, etc.)'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t('catalog.alerts.imageSizeErr', 'Image size should be less than 5MB'));
      return;
    }

    setNewSection((prev) => ({ ...prev, image: file }));
    setErrors((prev) => ({ ...prev, image: null }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    handleImageFile(file);
  };

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
    handleImageFile(file);
  };

  const handleRemoveImage = () => {
    setNewSection((prev) => ({ ...prev, image: null }));
    const fileInput = document.getElementById('image_upload_input');
    if (fileInput) fileInput.value = '';
  };

  // Form submit handler
  const handleSaveSection = async (e) => {
    e.preventDefault();
    
    // Simple client-side validation check
    const newErrors = {};
    if (!newSection.name_ar.trim()) {
      newErrors.name_ar = t('addSectionPage.validation.nameAr', 'Arabic name is required');
    }
    if (!newSection.name_en.trim()) {
      newErrors.name_en = t('addSectionPage.validation.nameEn', 'English name is required');
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);
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

      await axiosInstance.post('store/admin/sections/', formData, config);
      alert(t('catalog.alerts.saveSuccess', 'Section saved successfully!'));
      navigate('/sections');
    } catch (error) {
      const errorMessage = error.response?.data || 'Failed to save section';
      const displayMsg = typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage;
      alert(t('catalog.alerts.saveError', { message: displayMsg }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-main-bg dark:bg-main-dark-bg p-4 md:p-8 transition-colors duration-200">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
              <span className="cursor-pointer hover:underline" onClick={() => navigate('/sections')}>
                {t('addSectionPage.breadcrumb.sections', 'Sections')}
              </span>
              <span className="rtl:rotate-180">/</span>
              <span className="text-gray-800 dark:text-gray-200 font-semibold">
                {t('addSectionPage.breadcrumb.add', 'Add Section')}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {t('addSectionPage.title', 'Add New Section')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('addSectionPage.subtitle', 'Create a main or sub section to organize your store content')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/sections')}
            className="mt-4 md:mt-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 dark:border-gray-800 dark:bg-secondary-dark-bg text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-all text-sm font-medium shadow-sm"
          >
            <FiArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('addSectionPage.buttons.back', 'Back')}
          </button>
        </div>

        {/* Main Content Form */}
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Column - Information & Hierarchy (ColSpan 2) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card 1: Basic Information */}
              <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg">
                    <FiFolder className="w-5 h-5" />
                  </span>
                  {t('addSectionPage.cards.basicInfo', 'Basic Information')}
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Arabic Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('addSectionPage.fields.nameAr', 'Arabic Name *')}
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={newSection.name_ar}
                        onChange={(e) => {
                          setNewSection({ ...newSection, name_ar: e.target.value });
                          setErrors((prev) => ({ ...prev, name_ar: null }));
                        }}
                        className={`w-full border rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all text-right ${
                          errors.name_ar
                            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                            : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                        placeholder={t('catalog.modal.fields.nameArPlaceholder', 'e.g. ألعاب الموبايل')}
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
                        {t('addSectionPage.fields.nameEn', 'English Name *')}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={newSection.name_en}
                        onChange={(e) => {
                          setNewSection({ ...newSection, name_en: e.target.value });
                          setErrors((prev) => ({ ...prev, name_en: null }));
                        }}
                        className={`w-full border rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 transition-all text-left ${
                          errors.name_en
                            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                            : 'border-gray-300 dark:border-gray-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                        placeholder={t('catalog.modal.fields.nameEnPlaceholder', 'e.g. Mobile Gaming')}
                      />
                      {errors.name_en && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                          <FiAlertCircle className="w-3.5 h-3.5" />
                          {errors.name_en}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('addSectionPage.fields.description', 'Description')}
                    </label>
                    <textarea
                      value={newSection.description}
                      onChange={(e) => setNewSection({ ...newSection, description: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-start"
                      rows="4"
                      placeholder={t('catalog.modal.fields.descPlaceholder', 'Detailed description...')}
                    />
                  </div>

                  {/* Section Status (Active/Inactive Toggle) */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 max-w-md">
                      <span className="text-sm font-medium text-gray-750 dark:text-gray-300">
                        {newSection.is_active
                          ? t('addSectionPage.fields.active', 'Active (Visible to users in the store)')
                          : t('addSectionPage.fields.inactive', 'Inactive (Hidden from the store)')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewSection({ ...newSection, is_active: !newSection.is_active })}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        style={{ backgroundColor: newSection.is_active ? primaryColor : '#E5E7EB' }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            newSection.is_active ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Hierarchy Classification */}
              <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <span className="p-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-lg">
                    <FiInfo className="w-5 h-5" />
                  </span>
                  {t('addSectionPage.cards.hierarchy', 'Hierarchy Classification')}
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('addSectionPage.fields.parent', 'Parent Section (Main)')}
                  </label>
                  <select
                    value={newSection.father_section}
                    onChange={(e) => setNewSection({ ...newSection, father_section: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-xl p-2.5 bg-white dark:bg-secondary-dark-bg dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="">{t('addSectionPage.fields.mainSection', 'Main Section (No Parent)')}</option>
                    {sections
                      .filter((section) => !section.father_section)
                      .map((section) => {
                        const displayName = isArabic
                          ? `${section.name_ar || section.name_en}${section.name_ar && section.name_en ? ` (${section.name_en})` : ''}`
                          : `${section.name_en || section.name_ar}${section.name_en && section.name_ar ? ` (${section.name_ar})` : ''}`;
                        return (
                          <option key={section.id} value={section.id}>
                            {displayName}
                          </option>
                        );
                      })}
                  </select>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 leading-relaxed flex items-start gap-1.5">
                    <FiInfo className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-500" />
                    <span>
                      {newSection.father_section
                        ? t('catalog.table.subLabel', 'Subsection') + ' - ' + t('addSectionPage.fields.subNotice', 'This category will be nested under the selected parent category.')
                        : t('catalog.table.mainLabel', 'Main Section') + ' - ' + t('addSectionPage.fields.mainNotice', 'This will be a top-level category displayed directly on the shop index.')}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Media (ColSpan 1) */}
            <div className="space-y-6">
              
              {/* Card 3: Section Image */}
              <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-md font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <span className="p-1.5 bg-pink-50 dark:bg-pink-900/20 text-pink-500 rounded-lg">
                    <FiImage className="w-4 h-4" />
                  </span>
                  {t('addSectionPage.cards.image', 'Section Image')}
                </h2>

                <div className="space-y-4">
                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('image_upload_input').click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                      isDragging
                        ? 'border-indigo-600 bg-indigo-50/10'
                        : newSection.image
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

                    {newSection.image ? (
                      <div className="relative group">
                        <img
                          src={URL.createObjectURL(newSection.image)}
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
                          {t('addSectionPage.image.dropTitle', 'Drag and drop your image here, or')}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">
                          {t('addSectionPage.image.dropSubtitle', 'click to select a file')}
                        </p>
                      </>
                    )}
                  </div>

                  {newSection.image && (
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                        {newSection.image.name}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="text-xs font-bold text-red-600 hover:text-red-700 transition"
                      >
                        {t('addSectionPage.image.remove', 'Remove')}
                      </button>
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed text-center">
                    {t('addSectionPage.image.allowedFormats', 'Supported formats: JPEG, PNG, WebP (Max 5MB)')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-end gap-3 transition-colors">
            <button
              type="button"
              onClick={() => navigate('/sections')}
              className="w-full md:w-auto px-6 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition font-bold text-sm"
            >
              {t('addSectionPage.buttons.cancel', 'Cancel')}
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
                  {t('addSectionPage.buttons.creating', 'Creating...')}
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4" />
                  {t('addSectionPage.buttons.create', 'Create Section')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
