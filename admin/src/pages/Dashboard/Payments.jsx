import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GridComponent,
  ColumnsDirective,
  ColumnDirective,
  Page,
  Inject,
  Toolbar,
  Sort,
  Filter,
} from '@syncfusion/ej2-react-grids';
import { Header } from '../../components';
import axiosInstance from '../../utils/axiosConfig';

const PaymentMethods = () => {
  const { t, i18n } = useTranslation(['payments', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [formFields, setFormFields] = useState([]);

  const toolbarOptions = useMemo(() => [
    'Search',
    { text: t('methods.refreshData', 'Refresh'), id: 'Refresh', prefixIcon: 'e-refresh' }
  ], [t]);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/payment-methods/admin/payment-methods/');

      setMethods(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching payment methods:', err);
      setError(t('methods.alerts.loadFailed'));
      setMethods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const filteredMethods = methods.filter((method) => method.title?.toLowerCase().includes(searchText.toLowerCase()) || method.currency?.toLowerCase().includes(searchText.toLowerCase()) || method.account_details?.toLowerCase().includes(searchText.toLowerCase()));

  const iconTemplate = (props) => (
    <div className="flex flex-col items-center">
      <img
        src={props.icon_url || getDefaultIcon(props.currency)}
        alt={props.title}
        className="w-12 h-12 object-contain rounded-lg bg-gray-100 p-1"
        onError={(e) => {
          e.target.src = getDefaultIcon(props.currency);
        }}
      />
      {props.currency && (
        <span className={`text-xs mt-1 px-2 py-0.5 rounded-full ${
          props.currency === 'usd'
            ? 'bg-green-100 text-green-700'
            : 'bg-blue-100 text-blue-700'
        }`}
        >
          {t(`currency.${props.currency?.toLowerCase()}`, { defaultValue: props.currency.toUpperCase() })}
        </span>
      )}
    </div>
  );

  const detailsTemplate = (props) => (
    <div className="max-w-xs text-start">
      <p className="text-sm font-medium text-gray-900 truncate">
        {props?.title || t('methods.table.noTitle')}
      </p>
      <p className="text-xs text-gray-600 mt-1">
        {props?.account_details || t('methods.table.noDetails')}
      </p>
    </div>
  );

  const instructionsTemplate = (props) => (
    <div
      className="max-w-xs cursor-help group relative text-start"
      title={props?.instructions || t('methods.table.noInstructions')}
    >
      <p className="text-sm text-gray-600 truncate">
        {props?.instructions || t('methods.table.noInstructions')}
      </p>
      <div className={`absolute bottom-full mb-2 hidden group-hover:block z-10 ${isArabic ? 'right-0' : 'left-0'}`}>
        <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 max-w-xs break-words">
          {props?.instructions || t('methods.table.noInstructions')}
        </div>
      </div>
    </div>
  );

  const statusTemplate = (props) => (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${
          props?.is_active
            ? 'bg-green-100 text-green-700 border border-green-300'
            : 'bg-red-100 text-red-600 border border-red-300'
        }`}
      >
        {props?.is_active ? `🟢 ${t('methods.table.status.active')}` : `🔴 ${t('methods.table.status.inactive')}`}
      </span>
      <span className="text-xs text-gray-500">
        {props?.created_at ? new Date(props.created_at).toLocaleDateString(i18n.resolvedLanguage) : 'N/A'}
      </span>
    </div>
  );

  const fieldsTemplate = (props) => (
    <div className="text-center">
      <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
        {props.fields?.length || 0}
      </span>
    </div>
  );

  const actionsTemplate = (props) => (
    <div className="flex gap-2 justify-center">
      <button
        type="button"
        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-xs font-medium flex items-center gap-1"
        onClick={() => handleEdit(props)}
        title={t('methods.table.tooltips.edit')}
      >
        ✏️ {t('common:common.buttons.edit')}
      </button>
      <button
        type="button"
        className={`px-3 py-1.5 rounded-lg transition text-xs font-medium flex items-center gap-1 ${
          props.is_active
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        }`}
        onClick={() => toggleStatus(props.id)}
        title={props.is_active ? t('methods.table.tooltips.deactivate') : t('methods.table.tooltips.activate')}
      >
        {props.is_active ? `⏸️ ${t('methods.table.tooltips.deactivate')}` : `▶️ ${t('methods.table.tooltips.activate')}`}
      </button>
      <button
        type="button"
        className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-xs font-medium flex items-center gap-1"
        onClick={() => handleDelete(props.id, props.title)}
        title={t('methods.table.tooltips.delete')}
      >
        🗑️ {t('common:common.buttons.delete')}
      </button>
    </div>
  );

  const getDefaultIcon = (currency) => {
    const icons = {
      usd: 'https://cdn-icons-png.flaticon.com/512/4209/4209382.png',
      syp: 'https://cdn-icons-png.flaticon.com/512/4209/4209382.png',
      default: 'https://cdn-icons-png.flaticon.com/512/3536/3536034.png'
    };
    return icons[currency] || icons.default;
  };

  const handleEdit = (method) => {
    setEditingMethod(method);
    setFormFields(method.fields || []);
    setShowModal(true);
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(t('methods.alerts.deleteConfirm', { title }))) {
      try {
        await axiosInstance.delete(`/payment-methods/admin/payment-methods/${id}/`);
        await fetchPaymentMethods();
        alert(t('methods.alerts.deleteSuccess'));
      } catch (err) {
        console.error('Error deleting payment method:', err);
        alert(t('methods.alerts.deleteFailed'));
      }
    }
  };

  const toggleStatus = async (id) => {
    try {
      const method = methods.find((m) => m.id === id);
      const updatedData = { ...method, is_active: !method.is_active };

      await axiosInstance.put(`/payment-methods/admin/payment-methods/${id}/`, updatedData);
      await fetchPaymentMethods();
    } catch (err) {
      console.error('Error updating payment method status:', err);
      alert(t('methods.alerts.statusFailed'));
    }
  };

  const handleAddMethod = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const methodData = {
      title: formData.get('title'),
      name: formData.get('name'),
      currency: formData.get('currency'),
      icon_url: formData.get('icon_url') || '',
      account_details: formData.get('account_details'),
      instructions: formData.get('instructions'),
      description: formData.get('description') || '',
      note: formData.get('note') || '',
      is_active: formData.get('is_active') === 'on',
      fields: formFields.map((field) => ({
        field_name: field.field_name,
        field_key: field.field_key,
        input_type: field.input_type,
        is_required: field.is_required,
        placeholder: field.placeholder || '',
        order: field.order || 0,
      })),
    };

    try {
      if (editingMethod) {
        await axiosInstance.put(`/payment-methods/admin/payment-methods/${editingMethod.id}/`, methodData);
        alert(t('methods.alerts.updateSuccess'));
      } else {
        await axiosInstance.post('/payment-methods/admin/payment-methods/', methodData);
        alert(t('methods.alerts.createSuccess'));
      }

      setShowModal(false);
      setEditingMethod(null);
      setFormFields([]);

      setTimeout(() => {
        fetchPaymentMethods();
      }, 100);
    } catch (err) {
      console.error('Error saving payment method:', err);

      if (err.response?.data) {
        const errorData = err.response.data;
        let errorMessage = `${t('methods.alerts.saveFailed')}:\n`;

        if (typeof errorData === 'object') {
          Object.keys(errorData).forEach((key) => {
            if (Array.isArray(errorData[key])) {
              errorMessage += `• ${key}: ${errorData[key].join(', ')}\n`;
            } else if (typeof errorData[key] === 'object') {
              Object.keys(errorData[key]).forEach((nestedKey) => {
                errorMessage += `• ${key}.${nestedKey}: ${errorData[key][nestedKey]}\n`;
              });
            } else {
              errorMessage += `• ${key}: ${errorData[key]}\n`;
            }
          });
        } else {
          errorMessage += errorData;
        }

        alert(errorMessage);
      } else if (err.message) {
        alert(t('methods.alerts.errorPrefix', { message: err.message }));
      } else {
        alert(t('methods.alerts.unknownSaveError'));
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMethod(null);
    setFormFields([]);
  };

  const addFormField = () => {
    setFormFields((prev) => [...prev, {
      field_name: '',
      field_key: '',
      input_type: 'text',
      is_required: true,
      placeholder: '',
      order: prev.length,
    }]);
  };

  const updateFormField = (index, field, value) => {
    setFormFields((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'field_name') {
        updated[index].field_key = value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      }

      return updated;
    });
  };

  const removeFormField = (index) => {
    setFormFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToolbarClick = (args) => {
    if (args.item.id.includes('Refresh')) {
      fetchPaymentMethods();
    }
  };

  const activeMethods = methods.filter((m) => m.is_active).length;
  const usdMethods = methods.filter((m) => m.currency === 'usd').length;
  const sypMethods = methods.filter((m) => m.currency === 'syp').length;

  if (loading) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('methods.category')} title={t('methods.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-gray-700 dark:text-gray-200">{t('common:loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('methods.category')} title={t('methods.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-red-500 dark:text-red-400">{error}</div>
          <button
            type="button"
            onClick={fetchPaymentMethods}
            className="ms-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            {t('common:tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
      <Header
        category={t('methods.category')}
        title={t('methods.title')}
      />

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={fetchPaymentMethods}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm flex items-center gap-2"
        >
          {t('methods.refreshData')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 text-start">
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 font-semibold">{t('methods.stats.total')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{methods.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200 font-semibold">{t('methods.stats.active')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeMethods}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg p-4">
          <p className="text-purple-800 dark:text-purple-200 font-semibold">{t('methods.stats.usd')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{usdMethods}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 rounded-lg p-4">
          <p className="text-orange-800 dark:text-orange-200 font-semibold">{t('methods.stats.syp')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{sypMethods}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 max-w-md w-full">
          <div className="relative">
            <input
              type="text"
              placeholder={t('methods.searchPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
        >
          ➕ {t('methods.addNewMethod')}
        </button>
      </div>

      {methods && methods.length > 0 ? (
        <GridComponent
          dataSource={filteredMethods}
          allowPaging
          allowSorting
          allowFiltering
          toolbar={toolbarOptions}
          pageSettings={{ pageSize: 8 }}
          height={400}
          enableHover
          toolbarClick={handleToolbarClick}
          enableRtl={isArabic}
          locale={isArabic ? 'ar' : 'en-US'}
          ref={(grid) => {
            if (grid && grid.dataSource && !Array.isArray(grid.dataSource)) {
              grid.dataSource = [];
            }
          }}
        >
          <ColumnsDirective>
            <ColumnDirective
              field="id"
              headerText={t('methods.table.headers.id')}
              width="80"
              textAlign="Center"
              isPrimaryKey
            />
            <ColumnDirective
              headerText={t('methods.table.headers.iconCurrency')}
              width="120"
              textAlign="Center"
              template={iconTemplate}
            />
            <ColumnDirective
              field="title"
              headerText={t('methods.table.headers.methodTitle')}
              width="200"
              textAlign={isArabic ? 'Right' : 'Left'}
            />
            <ColumnDirective
              headerText={t('methods.table.headers.accountDetails')}
              width="220"
              template={detailsTemplate}
              textAlign={isArabic ? 'Right' : 'Left'}
            />
            <ColumnDirective
              headerText={t('methods.table.headers.instructions')}
              width="200"
              template={instructionsTemplate}
              textAlign={isArabic ? 'Right' : 'Left'}
            />
            <ColumnDirective
              headerText={t('methods.table.headers.fields')}
              width="80"
              textAlign="Center"
              template={fieldsTemplate}
            />
            <ColumnDirective
              headerText={t('methods.table.headers.statusDate')}
              width="140"
              textAlign="Center"
              template={statusTemplate}
            />
            <ColumnDirective
              headerText={t('methods.table.headers.actions')}
              width="280"
              textAlign="Center"
              template={actionsTemplate}
            />
          </ColumnsDirective>
          <Inject services={[Page, Toolbar, Sort, Filter]} />
        </GridComponent>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4">💳</div>
          <p className="text-gray-500 dark:text-gray-300 text-lg">{t('methods.emptyState.title')}</p>
          <p className="text-gray-400 dark:text-gray-400 mt-2">{t('methods.emptyState.description')}</p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {t('methods.emptyState.button')}
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white dark:bg-[#42464D] rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto text-start border dark:border-gray-700">
            <div className="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingMethod ? t('methods.modal.titleEdit') : t('methods.modal.titleAdd')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMethod} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    {t('methods.modal.labels.methodTitle')}
                  </label>
                  <input
                    name="title"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder={t('methods.modal.placeholders.methodTitle')}
                    defaultValue={editingMethod?.title}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    {t('methods.modal.labels.uniqueName')}
                  </label>
                  <input
                    name="name"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder={t('methods.modal.placeholders.uniqueName')}
                    defaultValue={editingMethod?.name}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('methods.modal.helpers.uniqueName')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    {t('methods.modal.labels.currency')}
                  </label>
                  <select
                    name="currency"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    defaultValue={editingMethod?.currency || 'usd'}
                  >
                    <option value="usd">USD ($)</option>
                    <option value="syp">{t('currency.syp')} (SYP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    {t('methods.modal.labels.iconUrl')}
                  </label>
                  <input
                    name="icon_url"
                    className="w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/icon.png"
                    defaultValue={editingMethod?.icon_url}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('methods.modal.labels.accountDetails')}
                </label>
                <textarea
                  name="account_details"
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder={t('methods.modal.placeholders.accountDetails')}
                  defaultValue={editingMethod?.account_details}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('methods.modal.labels.instructions')}
                </label>
                <textarea
                  name="instructions"
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder={t('methods.modal.placeholders.instructions')}
                  defaultValue={editingMethod?.instructions}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    {t('methods.modal.labels.description')}
                  </label>
                  <textarea
                    name="description"
                    className="w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    rows="2"
                    placeholder={t('methods.modal.placeholders.description')}
                    defaultValue={editingMethod?.description}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    {t('methods.modal.labels.note')}
                  </label>
                  <textarea
                    name="note"
                    className="w-full border border-gray-300 dark:border-gray-600 p-2.5 rounded-lg bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    rows="2"
                    placeholder={t('methods.modal.placeholders.note')}
                    defaultValue={editingMethod?.note}
                  />
                </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('methods.modal.labels.formFields')}</h3>
                  <button
                    type="button"
                    onClick={addFormField}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm"
                  >
                    ➕ {t('methods.modal.buttons.addField')}
                  </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('methods.modal.helpers.formFieldsDesc')}
                </p>

                {formFields.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-500 dark:text-gray-400">{t('methods.modal.emptyFields')}</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('methods.modal.emptyFieldsDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formFields.map((field, index) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {t('methods.modal.labels.fieldName')}
                            </label>
                            <input
                              type="text"
                              value={field.field_name}
                              onChange={(e) => updateFormField(index, 'field_name', e.target.value)}
                              className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded text-sm bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white"
                              placeholder={t('methods.modal.placeholders.fieldName')}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {t('methods.modal.labels.fieldKey')}
                            </label>
                            <input
                              type="text"
                              value={field.field_key}
                              onChange={(e) => updateFormField(index, 'field_key', e.target.value)}
                              className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded text-sm bg-gray-100 dark:bg-secondary-dark-bg/50 text-gray-900 dark:text-white"
                              placeholder={t('methods.modal.placeholders.fieldKey')}
                              readOnly
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {t('methods.modal.labels.inputType')}
                            </label>
                            <select
                              value={field.input_type}
                              onChange={(e) => updateFormField(index, 'input_type', e.target.value)}
                              className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded text-sm bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white"
                            >
                              <option value="text">{t('inputType.text')}</option>
                              <option value="number">{t('inputType.number')}</option>
                              <option value="email">{t('inputType.email')}</option>
                              <option value="phone">{t('inputType.phone')}</option>
                              <option value="file">{t('inputType.file')}</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {t('methods.modal.labels.placeholder')}
                            </label>
                            <input
                              type="text"
                              value={field.placeholder}
                              onChange={(e) => updateFormField(index, 'placeholder', e.target.value)}
                              className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded text-sm bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white"
                              placeholder={t('methods.modal.placeholders.placeholder')}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-200">
                            <input
                              type="checkbox"
                              checked={field.is_required}
                              onChange={(e) => updateFormField(index, 'is_required', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            {t('methods.modal.labels.requiredField')}
                          </label>

                          <button
                            type="button"
                            onClick={() => removeFormField(index)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm font-medium"
                          >
                            {t('methods.modal.buttons.remove')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <input
                  type="checkbox"
                  name="is_active"
                  id="is_active"
                  defaultChecked={editingMethod?.is_active ?? true}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('methods.modal.labels.activeStatus')}
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700 pb-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-medium"
                >
                  {t('methods.modal.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
                >
                  {editingMethod ? t('methods.modal.buttons.update') : t('methods.modal.buttons.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentMethods;
