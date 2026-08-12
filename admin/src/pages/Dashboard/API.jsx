import {
  AccumulationChartComponent,
  AccumulationDataLabel,
  AccumulationLegend,
  AccumulationSeriesCollectionDirective,
  AccumulationSeriesDirective,
  AccumulationTooltip,
  Inject as ChartInject,
  PieSeries,
} from '@syncfusion/ej2-react-charts';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Header } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import axiosInstance from '../../utils/axiosConfig';

const ApiTable = ({ data, onTestConnection, onSyncProducts, onViewTransactions, testingConnection, syncingProducts }) => {
  const { t, i18n } = useTranslation(['api', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';
  const [showApiKey, setShowApiKey] = useState({});

  const toggleApiKeyVisibility = (apiId) => {
    setShowApiKey(prev => ({
      ...prev,
      [apiId]: !prev[apiId],
    }));
  };

  const StatusBadge = ({ isActive }) => {
    const statusConfig = {
      true: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: '🟢', text: t('table.status.active') },
      false: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: '🔴', text: t('table.status.inactive') }
    };

    const config = statusConfig[isActive.toString()] || statusConfig.false;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color} flex items-center gap-1 justify-center`}>
        {config.icon} {config.text}
      </span>
    );
  };

  const ProviderBadge = ({ provider }) => {
    const providerConfig = {
      daily: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: '🌐', text: t('provider.daily') },
      alfaour: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: '💳', text: t('provider.alfaour') },
      alaaeddin: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: '🛒', text: t('provider.alaaeddin') }
    };

    const config = providerConfig[provider] || { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: '🔧', text: provider };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        {config.icon} {config.text}
      </span>
    );
  };

  const ApiKeyDisplay = ({ api }) => {
    const hasApiKey = api.encrypted_api_key && api.is_connected;
    const isVisible = showApiKey[api.id];

    return (
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="font-mono text-sm dark:text-white">
            {hasApiKey ? (isVisible ? '••••••••' : '••••••••') : t('table.status.notSet')}
          </span>
          {hasApiKey && (
            <button
              onClick={() => toggleApiKeyVisibility(api.id)}
              className="text-blue-500 hover:text-blue-700 text-xs p-1"
              title={isVisible ? t('table.tooltips.hideKey') : t('table.tooltips.showKey')}
              type="button"
              aria-label={isVisible ? t('table.tooltips.hideKey') : t('table.tooltips.showKey')}
            >
              {isVisible ? '👁️' : '👁️‍🗨️'}
            </button>
          )}
        </div>
        <div className={`text-xs mt-1 ${api.is_connected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {api.is_connected ? t('table.status.connected') : t('table.status.notConnected')}
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {t('table.noApis')}
      </div>
    );
  }

  const thClass = `px-4 py-3 ${isArabic ? 'text-right' : 'text-left'} text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-700">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className={thClass}>{t('table.headers.id')}</th>
            <th className={thClass}>{t('table.headers.name')}</th>
            <th className={thClass}>{t('table.headers.provider')}</th>
            <th className={thClass}>{t('table.headers.baseUrl')}</th>
            <th className={thClass}>{t('table.headers.description')}</th>
            <th className={thClass}>{t('table.headers.priority')}</th>
            <th className={thClass}>{t('table.headers.dailyLimit')}</th>
            <th className={thClass}>{t('table.headers.status')}</th>
            <th className={thClass}>{t('table.headers.apiKey')}</th>
            <th className={thClass}>{t('table.headers.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((api) => (
            <tr key={api.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{api.id}</td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{api.name}</td>
              <td className="px-4 py-3 text-sm">
                <ProviderBadge provider={api.provider} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">
                <div className="max-w-xs truncate text-start" title={api.base_url}>
                  {api.base_url}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">
                <div className="max-w-xs truncate text-start" title={api.description}>
                  {api.description || '-'}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 text-center">{api.priority}</td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 text-center">
                {api.max_daily_limit || t('common:limit.noLimit', 'No limit')}
              </td>
              <td className="px-4 py-3 text-sm">
                <StatusBadge isActive={api.is_active} />
              </td>
              <td className="px-4 py-3 text-sm">
                <ApiKeyDisplay api={api} />
              </td>
              <td className="px-4 py-3 text-sm">
                <div className="flex flex-col gap-2">
                  <button
                    className={`px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-xs font-medium flex items-center justify-center gap-1 ${
                      testingConnection === api.id ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    onClick={() => onTestConnection(api.id, api.name)}
                    disabled={testingConnection === api.id}
                    type="button"
                  >
                    {testingConnection === api.id ? '⏳' : '🔌'}
                    {testingConnection === api.id ? t('table.buttons.testing') : t('table.buttons.test')}
                  </button>
                  <button
                    className={`px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition text-xs font-medium flex items-center justify-center gap-1 ${
                      syncingProducts === api.id ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    onClick={() => onSyncProducts(api.id, api.name)}
                    disabled={syncingProducts === api.id}
                    type="button"
                  >
                    {syncingProducts === api.id ? '⏳' : '🔄'}
                    {syncingProducts === api.id ? t('table.buttons.syncing') : t('table.buttons.sync')}
                  </button>
                  <button
                    className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition text-xs font-medium flex items-center justify-center gap-1"
                    onClick={() => onViewTransactions(api.id, api.name)}
                    type="button"
                  >
                    📊 {t('table.buttons.logs')}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callApi = useCallback(async (apiCall, successMessage = null) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();
      if (successMessage) {
        console.log(successMessage, result);
      }
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message 
      || 'Operation failed';
      setError(errorMessage);
      console.error('API Error:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, callApi, setError };
};

const AddApiModal = ({ isOpen, onClose, onSave, loading }) => {
  const { t, i18n } = useTranslation(['api', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [formData, setFormData] = useState({
    name: '',
    provider: 'daily',
    base_url: '',
    description: '',
    api_key: '',
    priority: 1,
    max_daily_limit: '',
    is_active: true,
  });

  const [errors, setErrors] = useState({});
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleChange = (field, value) => {
    if (!isMounted.current) return;

    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('modal.validation.nameRequired');
    }

    if (!formData.base_url.trim()) {
      newErrors.base_url = t('modal.validation.urlRequired');
    } else if (!isValidUrl(formData.base_url)) {
      newErrors.base_url = t('modal.validation.urlInvalid');
    }

    if (!formData.api_key.trim()) {
      newErrors.api_key = t('modal.validation.keyRequired');
    }

    if (formData.priority < 1 || formData.priority > 10) {
      newErrors.priority = t('modal.validation.priorityRange');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const success = await onSave(formData);
    if (success && isMounted.current) {
      setFormData({
        name: '',
        provider: 'daily',
        base_url: '',
        description: '',
        api_key: '',
        priority: 1,
        max_daily_limit: '',
        is_active: true,
      });
      setErrors({});
    }
  };

  const handleClose = () => {
    if (!isMounted.current) return;

    setFormData({
      name: '',
      provider: 'daily',
      base_url: '',
      description: '',
      api_key: '',
      priority: 1,
      max_daily_limit: '',
      is_active: true
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-secondary-dark-bg rounded-lg p-6 w-full max-w-md mx-4 text-start`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-850 dark:text-white">{t('modal.titleAdd')}</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
            type="button"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-750 dark:text-gray-300 mb-1">
              {t('modal.labels.name')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-650 dark:text-white ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('modal.placeholders.name')}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-755 dark:text-gray-300 mb-1">
              {t('modal.labels.provider')}
            </label>
            <select
              value={formData.provider}
              onChange={(e) => handleChange('provider', e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-650 dark:bg-gray-700 dark:text-white rounded"
            >
              <option value="daily">{t('provider.daily')}</option>
              <option value="alfaour">{t('provider.alfaour')}</option>
              <option value="alaaeddin">{t('provider.alaaeddin')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-755 dark:text-gray-300 mb-1">
              {t('modal.labels.baseUrl')}
            </label>
            <input
              type="url"
              value={formData.base_url}
              onChange={(e) => handleChange('base_url', e.target.value)}
              className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-650 dark:text-white ${
                errors.base_url ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('modal.placeholders.baseUrl')}
            />
            {errors.base_url && (
              <p className="text-red-500 text-xs mt-1">{errors.base_url}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-755 dark:text-gray-300 mb-1">
              {t('modal.labels.apiKey')}
            </label>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => handleChange('api_key', e.target.value)}
              className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-650 dark:text-white ${
                errors.api_key ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('modal.placeholders.apiKey')}
            />
            {errors.api_key && (
              <p className="text-red-500 text-xs mt-1">{errors.api_key}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-755 dark:text-gray-300 mb-1">
              {t('modal.labels.description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-650 dark:bg-gray-700 dark:text-white rounded"
              rows="3"
              placeholder={t('modal.placeholders.description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-755 dark:text-gray-300 mb-1">
                {t('modal.labels.priority')}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => handleChange('priority', parseInt(e.target.value))}
                className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-650 dark:text-white ${
                  errors.priority ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.priority && (
                <p className="text-red-500 text-xs mt-1">{errors.priority}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-755 dark:text-gray-300 mb-1">
                {t('modal.labels.dailyLimit')}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.max_daily_limit}
                onChange={(e) => handleChange('max_daily_limit', e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-650 dark:bg-gray-700 dark:text-white rounded"
                placeholder={t('modal.placeholders.dailyLimit')}
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              className={isArabic ? 'ml-2' : 'mr-2'}
            />
            <label htmlFor="is_active" className="text-sm text-gray-755 dark:text-gray-300">
              {t('modal.labels.activate')}
            </label>
          </div>

          <div className={`flex justify-end pt-4 ${isArabic ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {t('modal.buttons.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? t('modal.buttons.adding') : t('modal.buttons.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Api = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['api', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [apis, setApis] = useState([]);
  const [testingConnection, setTestingConnection] = useState(null);
  const [syncingProducts, setSyncingProducts] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { user } = useAuth();

  const isMounted = useRef(true);
  const { loading, error, callApi, setError } = useApi();

  const [stats, setStats] = useState({
    totalApis: 0,
    activeApis: 0,
    dailyApis: 0,
    alfaourApis: 0,
    alaaeddinApis: 0,
    totalProducts: 0,
  });

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      fetchApis();
    }
  }, []);

  const fetchApis = useCallback(async () => {
    const { success, data } = await callApi(
      () => axiosInstance.get('third_party_apis/apis/'),
      'APIs fetched successfully',
    );

    if (success && isMounted.current) {
      try {
        let apisData = [];
        if (Array.isArray(data)) {
          apisData = data;
        } else if (data && typeof data === 'object') {
          apisData = data.results || data.data || Object.values(data).filter(item => typeof item === 'object') || [];
        }

        apisData = Array.isArray(apisData) ? apisData : [];

        console.log('Processed APIs data:', apisData);
        setApis(apisData);
        calculateStats(apisData);
      } catch (err) {
        console.error('Error processing API data:', err);
        setApis([]);
        calculateStats([]);
      }
    }
  }, [callApi]);

  const calculateStats = useCallback((apisData) => {
    if (!isMounted.current) return;

    const totalApis = apisData.length;
    const activeApis = apisData.filter(api => api.is_active).length;
    const dailyApis = apisData.filter(api => api.provider === 'daily').length;
    const alfaourApis = apisData.filter(api => api.provider === 'alfaour').length;
    const alaaeddinApis = apisData.filter(api => api.provider === 'alaaeddin').length;

    const totalProducts = apisData.reduce((total, api) => {
      return total + (api.products_count || 0);
    }, 0);

    setStats({
      totalApis,
      activeApis,
      dailyApis,
      alfaourApis,
      alaaeddinApis,
      totalProducts,
    });
  }, []);

  const generatePieChartData = useCallback(() => {
    const providerCounts = {
      [t('provider.daily', 'Daily')]: apis.filter(api => api.provider === 'daily').length,
      [t('provider.alfaour', 'Alfaour')]: apis.filter(api => api.provider === 'alfaour').length,
      [t('provider.alaaeddin', 'Alaaeddin')]: apis.filter(api => api.provider === 'alaaeddin').length
    };

    return {
      providerData: Object.entries(providerCounts)
        .filter(([_, count]) => count > 0)
        .map(([provider, count]) => ({
          x: provider,
          y: count,
          text: t('distribution.count', { count }),
        })),
    };
  }, [apis, t]);

  const pieChartData = generatePieChartData();

  const handleAddApi = async (formData) => {
    const { success } = await callApi(
      () => axiosInstance.post('third_party_apis/apis/', {
        name: formData.name,
        provider: formData.provider,
        base_url: formData.base_url,
        description: formData.description,
        api_key: formData.api_key,
        priority: formData.priority,
        max_daily_limit: formData.max_daily_limit || null,
        is_active: formData.is_active,
      }),
      'API added successfully',
    );

    if (success && isMounted.current) {
      fetchApis();
      setShowAddModal(false);
      showNotification('success', t('modal.titleAdd'), t('alerts.addSuccess'));
      return true;
    }
    return false;
  };

  const handleTestConnection = async (apiId, apiName) => {
    if (!isMounted.current) return;

    try {
      setTestingConnection(apiId);

      const response = await axiosInstance.post(`third_party_apis/apis/${apiId}/test_connection/`);

      if (!isMounted.current) return;

      if (response.data.connected || response.data.success) {
        const result = response.data;
        let message = `✅ ${t('alerts.testSuccess')}\n\n${t('table.headers.name')}: ${apiName}\n${t('table.headers.provider')}: ${result.provider || apiName}\n`;

        if (result.balance_test && result.balance_test.success) {
          message += `${t('currencies:currency.balance', 'Balance')}: ${result.balance_test.balance || 'N/A'}\n`;
        }

        if (result.products_test) {
          message += `${t('table.headers.status', 'Products')}: ${result.products_test.products_count || 0}\n`;
        }

        if (result.details) {
          message += `${t('common:details', 'Details')}: ${result.details}`;
        }

        showNotification('success', t('alerts.connectionTitle'), message);
        fetchApis();
      } else {
        showNotification('error', t('alerts.testFailed'),
          `API: ${apiName}\nError: ${response.data.error || 'Unknown error'}`
        );
      }
    } catch (err) {
      console.error('Connection test error:', err);
      if (!isMounted.current) return;

      const errorMessage = err.response?.data?.error
      || err.response?.data?.detail
      || t('alerts.testFailed');
      showNotification('error', t('alerts.testFailed'),
        `API: ${apiName}\nError: ${errorMessage}`);
    } finally {
      if (isMounted.current) {
        setTestingConnection(null);
      }
    }
  };

  const handleSyncProducts = async (apiId, apiName) => {
    if (!isMounted.current) return;

    try {
      setSyncingProducts(apiId);

      const response = await axiosInstance.post(`third_party_apis/apis/${apiId}/sync_products/`);

      if (!isMounted.current) return;

      if (response.data.success) {
        showNotification('success', t('alerts.syncSuccess'),
          `API: ${apiName}\nNew: ${response.data.synced_count}\nUpdated: ${response.data.updated_count}\nActive: ${response.data.active_products}/${response.data.total_products}`);

        fetchApis();
      } else {
        showNotification('error', t('alerts.syncFailed'),
          `API: ${apiName}\nError: ${response.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Product sync error:', err);
      if (!isMounted.current) return;

      const errorMessage = err.response?.data?.error
      || err.response?.data?.detail
      || t('alerts.syncFailed');
      showNotification('error', t('alerts.syncFailed'),
        `API: ${apiName}\nError: ${errorMessage}`);
    } finally {
      if (isMounted.current) {
        setSyncingProducts(null);
      }
    }
  };

  const handleViewTransactions = (apiId, apiName) => {
    navigate(`/api-transactions?api=${apiId}&name=${encodeURIComponent(apiName)}`);
  };

  const showNotification = (type, title, message) => {
    const styles = {
      success: { bg: 'bg-green-100 border-green-400 text-green-800' },
      error: { bg: 'bg-red-100 border-red-400 text-red-800' },
      warning: { bg: 'bg-yellow-100 border-yellow-400 text-yellow-800' },
      info: { bg: 'bg-blue-100 border-blue-400 text-blue-800' },
    };

    const style = styles[type] || styles.info;

    const notification = document.createElement('div');
    const positionClass = isArabic ? 'left-4' : 'right-4';
    notification.className = `fixed top-4 ${positionClass} p-4 rounded-lg border ${style.bg} ${style.text} shadow-lg z-50 max-w-md ${isArabic ? 'text-right' : 'text-left'}`;
    notification.innerHTML = `
      <div class="font-semibold">${title}</div>
      <div class="text-sm mt-1 whitespace-pre-line">${message}</div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 5000);
  };

  const tableData = React.useMemo(() => {
    try {
      return apis.map(api => ({
        id: api.id || 0,
        name: api.name || 'Unnamed API',
        provider: api.provider || 'unknown',
        base_url: api.base_url || '',
        description: api.description || '',
        priority: api.priority || 1,
        max_daily_limit: api.max_daily_limit ? `$${parseFloat(api.max_daily_limit).toFixed(2)}` : t('common:limit.noLimit', 'No limit'),
        is_active: Boolean(api.is_active),
        is_connected: Boolean(api.is_connected),
        encrypted_api_key: api.encrypted_api_key || null,
        created_at: api.created_at ? new Date(api.created_at).toLocaleDateString(i18n.resolvedLanguage) : 'N/A',
        updated_at: api.updated_at ? new Date(api.updated_at).toLocaleDateString(i18n.resolvedLanguage) : 'N/A',
      }));
    } catch (oerror) {
      console.error('Error processing table data:', oerror);
      return [];
    }
  }, [apis, i18n.resolvedLanguage, t]);

  if (loading && apis.length === 0) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('category')} title={t('title')} />
        <div className="flex justify-center items-center h-64">
          <div className="text-xl text-gray-700 dark:text-gray-300">{t('loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl text-start`}>
      <Header
        category={t('category')}
        title={t('title')}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded dark:bg-red-900/30 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-300">
            <strong>{t('common:error', 'Error')}:</strong> {error}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-8">
        <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 text-center">{t('distribution.title')}</h3>
          {pieChartData.providerData.length > 0 ? (
            <AccumulationChartComponent
              id="api-providers-chart"
              legendSettings={{
                visible: true,
                position: 'Bottom',
                textStyle: { size: '12px', color: i18n.resolvedLanguage === 'ar' ? '#FFFFFF' : '#484B52' },
              }}
              height="300px"
              tooltip={{ enable: true, format: `\${point.x} : <b>\${point.y} ${isArabic ? t('distribution.count', { count: '' }).trim() : 'APIs'}</b>` }}
              enableRtl={isArabic}
            >
              <ChartInject services={[AccumulationLegend, PieSeries, AccumulationDataLabel, AccumulationTooltip]} />
              <AccumulationSeriesCollectionDirective>
                <AccumulationSeriesDirective
                  name="APIs"
                  dataSource={pieChartData.providerData}
                  xName="x"
                  yName="y"
                  innerRadius="0%"
                  startAngle={0}
                  endAngle={360}
                  radius="70%"
                  dataLabel={{
                    visible: true,
                    name: 'text',
                    position: 'Outside',
                    font: {
                      fontWeight: '600',
                    },
                  }}
                />
              </AccumulationSeriesCollectionDirective>
            </AccumulationChartComponent>
          ) : (
            <div className="flex justify-center items-center h-32 text-gray-500 dark:text-gray-400">
              {t('distribution.noData')}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800">
          <p className="text-blue-800 dark:text-blue-300 font-semibold text-sm">{t('stats.total')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalApis}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{t('stats.activeCount', { count: stats.activeApis })}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-800">
          <p className="text-green-800 dark:text-green-300 font-semibold text-sm">{t('stats.active')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.activeApis}</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('stats.ready')}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 dark:bg-purple-900/20 dark:border-purple-800">
          <p className="text-purple-800 dark:text-purple-300 font-semibold text-sm">{t('stats.daily')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.dailyApis}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{t('stats.dailyDesc')}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 dark:bg-orange-900/20 dark:border-orange-800">
          <p className="text-orange-800 dark:text-orange-300 font-semibold text-sm">{t('stats.alfaour')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.alfaourApis}</p>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">{t('stats.alfaourDesc')}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-300 font-semibold text-sm">{t('stats.alaaeddin')}</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.alaaeddinApis}</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t('stats.alaaeddinDesc')}</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 dark:bg-indigo-900/20 dark:border-indigo-800">
          <p className="text-indigo-800 dark:text-indigo-300 font-semibold text-sm">{t('stats.totalProducts')}</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.totalProducts}</p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">{t('stats.availableProducts')}</p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-secondary-dark-bg rounded-lg p-4 mb-6 border dark:border-gray-700">
        <h3 className="font-semibold mb-2 text-gray-800 dark:text-white">{t('quickActions.title')}</h3>
        <div className="flex flex-wrap gap-2">
          <button
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm flex items-center gap-2"
            onClick={() => setShowAddModal(true)}
            type="button"
          >
            <span>+</span> {t('quickActions.addBtn')}
          </button>
          <button
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm flex items-center gap-2"
            onClick={fetchApis}
            disabled={loading}
            type="button"
          >
            {loading ? '⏳' : '🔄'} {loading ? t('quickActions.refreshing') : t('quickActions.refreshBtn')}
          </button>
          <button
            className="px-4 py-2 bg-purple-50 hover:bg-purple-600 text-white rounded text-sm flex items-center gap-2"
            onClick={() => {
              apis.filter(api => api.is_active).forEach(api => {
                handleSyncProducts(api.id, api.name);
              });
            }}
            type="button"
          >
            🔄 {t('quickActions.syncAllBtn')}
          </button>
        </div>
      </div>

      <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <ApiTable
          data={tableData}
          onTestConnection={handleTestConnection}
          onSyncProducts={handleSyncProducts}
          onViewTransactions={handleViewTransactions}
          testingConnection={testingConnection}
          syncingProducts={syncingProducts}
        />
      </div>

      <AddApiModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddApi}
        loading={loading}
      />

      {apis.length === 0 && !loading && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">🚀 {t('gettingStarted.title')}</h4>
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
            {t('gettingStarted.desc')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-2">{t('gettingStarted.stepsTitle')}</h5>
              <ol className="text-sm text-blue-700 dark:text-blue-400 list-decimal list-inside space-y-1">
                <li>{t('gettingStarted.steps.1')}</li>
                <li>{t('gettingStarted.steps.2')}</li>
                <li>{t('gettingStarted.steps.3')}</li>
                <li>{t('gettingStarted.steps.4')}</li>
                <li>{t('gettingStarted.steps.5')}</li>
              </ol>
            </div>
            <div>
              <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-2">{t('gettingStarted.infoTitle')}</h5>
              <ul className="text-sm text-blue-700 dark:text-blue-400 list-disc list-inside space-y-1">
                <li><strong>{t('gettingStarted.info.name')}</strong></li>
                <li><strong>{t('gettingStarted.info.provider')}</strong></li>
                <li><strong>{t('gettingStarted.info.url')}</strong></li>
                <li><strong>{t('gettingStarted.info.key')}</strong></li>
                <li><strong>{t('gettingStarted.info.priority')}</strong></li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Api;
