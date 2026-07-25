import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GridComponent,
  ColumnsDirective,
  ColumnDirective,
  Page,
  Selection,
  Inject,
  Edit,
  Toolbar,
  Sort,
  Filter,
} from '@syncfusion/ej2-react-grids';
import { Header } from '../../components';
import axiosInstance from '../../utils/axiosConfig';

const AdsPage = () => {
  const { t, i18n } = useTranslation(['ads', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [adsData, setAdsData] = useState([]);
  const [sections, setSections] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState(null);
  const [formData, setFormData] = useState({
    section: '',
    product: '',
    text: '',
    background_color: '#FFFFFF',
    font_size: 14,
    text_color: 'black',
    image: null,
    link: '',
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [gridInstance, setGridInstance] = useState(null);

  const selectionsettings = { persistSelection: true };
  const editing = { allowDeleting: true, allowEditing: false, allowAdding: false };

  const toolbarOptions = useMemo(() => [
    { text: t('buttons.addAd'), id: 'addgrid', prefixIcon: 'e-add' },
    { text: t('common:common.buttons.edit', 'Edit'), id: 'editgrid', prefixIcon: 'e-edit' },
    { text: t('common:common.buttons.delete', 'Delete'), id: 'deletegrid', prefixIcon: 'e-delete' },
    { text: t('common:common.buttons.refresh', 'Refresh'), id: 'Refresh', prefixIcon: 'e-refresh' }
  ], [t]);

  const fetchAds = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/system/ads/');
      setAdsData(response.data);
    } catch (err) {
      setError(t('alerts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [sectionsRes, productsRes] = await Promise.all([
        axiosInstance.get('/store/sections/'),
        axiosInstance.get('/store/products/'),
      ]);
      setSections(sectionsRes.data);
      setProducts(productsRes.data);
    } catch (err) {
      console.error('Error fetching dropdown data:', err);
    }
  };

  useEffect(() => {
    fetchAds();
    fetchDropdownData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file,
      }));

      const reader = new FileReader();
      reader.onload = (en) => {
        setImagePreview(en.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setFormData({
      section: '',
      product: '',
      text: '',
      background_color: '#FFFFFF',
      font_size: 14,
      text_color: 'black',
      image: null,
      link: '',
    });
    setImagePreview(null);
    setSelectedAd(null);
  };

  const handleAddAd = async (e) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });

      await axiosInstance.post('/system/ads/', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setShowAddModal(false);
      resetForm();
      fetchAds();
      alert(t('alerts.addSuccess'));
    } catch (err) {
      alert(t('alerts.addFailed'));
    }
  };

  const handleEditAd = async (e) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });

      await axiosInstance.put(`/system/ads/${selectedAd.id}/`, submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setShowEditModal(false);
      resetForm();
      fetchAds();
      alert(t('alerts.editSuccess'));
    } catch (err) {
      alert(t('alerts.editFailed'));
    }
  };

  const handleDeleteAds = async (selected) => {
    if (window.confirm(t('alerts.deleteConfirm', { count: selected.length }))) {
      try {
        const deletePromises = selected.map((ad) => axiosInstance.delete(`/system/ads/${ad.id}/`));
        await Promise.all(deletePromises);
        await fetchAds();
        alert(t('alerts.deleteSuccess', { count: selected.length }));
      } catch (err) {
        alert(t('alerts.deleteFailed'));
      }
    }
  };

  const toolbarClick = async (args) => {
    if (!gridInstance) return;

    const selected = gridInstance.getSelectedRecords();

    if (args.item.id.includes('addgrid')) {
      setShowAddModal(true);
    }

    if (args.item.id.includes('editgrid')) {
      if (selected.length === 1) {
        const ad = selected[0];
        setSelectedAd(ad);
        setFormData({
          section: ad.section,
          product: ad.product,
          text: ad.text,
          background_color: ad.background_color,
          font_size: ad.font_size,
          text_color: ad.text_color,
          image: null,
          link: ad.link || '',
        });
        setImagePreview(ad.image || null);
        setShowEditModal(true);
      } else {
        alert(t('alerts.selectOne'));
      }
    }

    if (args.item.id.includes('deletegrid')) {
      if (selected.length > 0) {
        await handleDeleteAds(selected);
      } else {
        alert(t('alerts.selectToDelete'));
      }
    }

    if (args.item.id.includes('Refresh')) {
      fetchAds();
    }
  };

  const adsGrid = useMemo(() => [
    {
      type: 'checkbox',
      width: '50',
    },
    {
      field: 'id',
      headerText: t('table.headers.id'),
      width: '80',
      textAlign: 'Center',
      isPrimaryKey: true,
    },
    {
      field: 'section_name',
      headerText: t('table.headers.section'),
      width: '120',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'product_name',
      headerText: t('table.headers.product'),
      width: '150',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'text',
      headerText: t('table.headers.text'),
      width: '200',
      textAlign: isArabic ? 'Right' : 'Left',
      template: (props) => (
        <div className="truncate text-start" title={props.text}>
          {props.text.length > 50 ? `${props.text.substring(0, 50)}...` : props.text}
        </div>
      ),
    },
    {
      field: 'background_color',
      headerText: t('table.headers.background'),
      width: '100',
      textAlign: 'Center',
      template: (props) => (
        <div className="flex items-center gap-2 justify-center">
          <div
            className="w-4 h-4 rounded border dark:border-gray-650"
            style={{ backgroundColor: props.background_color }}
          />
          <span className="dark:text-white">{props.background_color}</span>
        </div>
      ),
    },
    {
      field: 'font_size',
      headerText: t('table.headers.fontSize'),
      width: '80',
      textAlign: 'Center',
      template: (props) => (
        <span className="dark:text-white">{props.font_size}px</span>
      ),
    },
    {
      field: 'text_color',
      headerText: t('table.headers.textColor'),
      width: '100',
      textAlign: 'Center',
      template: (props) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          props.text_color === 'white' ? 'bg-gray-800 text-white dark:bg-gray-700' : 'bg-gray-200 text-black dark:bg-gray-600 dark:text-gray-200'
        }`}
        >
          {props.text_color === 'white' ? t('common:colors.white', 'White') : t('common:colors.black', 'Black')}
        </span>
      ),
    },
    {
      field: 'image',
      headerText: t('table.headers.image'),
      width: '100',
      textAlign: 'Center',
      template: (props) => (
        props.image
          ? (
            <div
              className="w-8 h-8 bg-cover bg-center rounded mx-auto"
              style={{ backgroundImage: `url(${props.image})` }}
            />
          )
          : <span className="text-gray-400 dark:text-gray-500">{t('table.noImage')}</span>
      ),
    },
    {
      field: 'link',
      headerText: t('table.headers.link'),
      width: '150',
      textAlign: isArabic ? 'Right' : 'Left',
      template: (props) => (
        props.link
          ? (
            <a
              href={props.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline truncate block text-start"
            >
              {props.link.length > 20 ? `${props.link.substring(0, 20)}...` : props.link}
            </a>
          )
          : <span className="text-gray-400 dark:text-gray-500">{t('table.noLink')}</span>
      ),
    },
    {
      field: 'created_at',
      headerText: t('table.headers.createdAt'),
      width: '120',
      textAlign: 'Center',
      template: (props) => (
        <span className="dark:text-white">
          {props.created_at ? new Date(props.created_at).toLocaleDateString(i18n.resolvedLanguage) : 'N/A'}
        </span>
      )
    },
  ], [t, isArabic, i18n.resolvedLanguage]);

  const AdModal = ({ isOpen, onClose, onSubmit, isEdit = false }) => (
    isOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-secondary-dark-bg rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto text-start">
          <div className="p-6 border-b dark:border-gray-700">
            <h2 className="text-xl font-semibold dark:text-white">
              {isEdit ? t('modal.editTitle') : t('modal.addTitle')}
            </h2>
          </div>

          <form onSubmit={onSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">{t('modal.labels.section')}</label>
                <select
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">{t('modal.placeholders.section')}</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">{t('modal.labels.product')}</label>
                <select
                  name="product"
                  value={formData.product}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">{t('modal.placeholders.product')}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">{t('modal.labels.text')}</label>
              <textarea
                name="text"
                value={formData.text}
                onChange={handleInputChange}
                required
                rows="3"
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder={t('modal.placeholders.text')}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">{t('modal.labels.background')}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    name="background_color"
                    value={formData.background_color}
                    onChange={handleInputChange}
                    className="w-10 h-10 p-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <input
                    type="text"
                    name="background_color"
                    value={formData.background_color}
                    onChange={handleInputChange}
                    className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white w-24"
                    placeholder={t('modal.placeholders.background')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">{t('modal.labels.fontSize')}</label>
                <input
                  type="number"
                  name="font_size"
                  value={formData.font_size}
                  onChange={handleInputChange}
                  min="8"
                  max="72"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">{t('modal.labels.textColor')}</label>
                <select
                  name="text_color"
                  value={formData.text_color}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="black">{t('common:colors.black', 'Black')}</option>
                  <option value="white">{t('common:colors.white', 'White')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">{t('modal.labels.image')}</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              {imagePreview && (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-20 object-cover rounded border dark:border-gray-600"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">{t('modal.labels.link')}</label>
              <input
                type="url"
                name="link"
                value={formData.link}
                onChange={handleInputChange}
                placeholder={t('modal.placeholders.link')}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div className="p-4 border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">{t('modal.labels.preview')}</label>
              <div
                className="p-4 rounded border dark:border-gray-600"
                style={{
                  backgroundColor: formData.background_color,
                  color: formData.text_color,
                  fontSize: `${formData.font_size}px`,
                }}
              >
                {formData.text || t('modal.placeholders.previewDefault')}
              </div>
            </div>

            <div className={`flex gap-3 pt-4 border-t dark:border-gray-700 ${isArabic ? 'flex-row-reverse' : ''}`}>
              <button
                type="submit"
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition font-medium"
              >
                {isEdit ? t('buttons.updateAd') : t('buttons.addAd')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  resetForm();
                }}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition font-medium"
              >
                {t('buttons.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  );

  if (loading) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('category')} title={t('title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-gray-750 dark:text-gray-300">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('category')} title={t('title')} />
        <div className="flex justify-center items-center h-40 gap-4">
          <div className="text-lg text-red-500">{error}</div>
          <button
            type="button"
            onClick={fetchAds}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {t('buttons.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl text-start`}>
      <Header category={t('category')} title={t('title')} />

      <div className="flex justify-between items-center mb-6">
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-300 font-semibold">{t('stats.activeAds')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{adsData.length}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm flex items-center gap-2"
        >
          + {t('buttons.addAd')}
        </button>
      </div>

      {adsData.length > 0 ? (
        <GridComponent
          dataSource={adsData}
          enableHover={false}
          allowPaging
          pageSettings={{ pageCount: 5, pageSize: 10 }}
          selectionSettings={selectionsettings}
          toolbar={toolbarOptions}
          editSettings={editing}
          allowSorting
          allowFiltering
          toolbarClick={toolbarClick}
          width="auto"
          ref={(g) => setGridInstance(g)}
          enableRtl={isArabic}
          locale={isArabic ? 'ar' : 'en-US'}
        >
          <ColumnsDirective>
            {adsGrid.map((item, index) => (
              <ColumnDirective key={index} {...item} />
            ))}
          </ColumnsDirective>
          <Inject services={[Page, Selection, Toolbar, Edit, Sort, Filter]} />
        </GridComponent>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4">📢</div>
          <p className="text-gray-500 dark:text-gray-300 text-lg">{t('emptyState.title')}</p>
          <p className="text-gray-400 dark:text-gray-550 mt-2">{t('emptyState.desc')}</p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            {t('buttons.createFirst')}
          </button>
        </div>
      )}

      <AdModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddAd}
        isEdit={false}
      />

      <AdModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditAd}
        isEdit
      />
    </div>
  );
};

export default AdsPage;
