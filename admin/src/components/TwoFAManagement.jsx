import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../utils/axiosConfig';
import TwoFASetup from './TwoFASetup';

const TwoFAManagement = () => {
  const { t, i18n } = useTranslation(['security', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSetup, setShowSetup] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(
        '/api/users/2fa/status/',
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );
      setStatus(response.data);
    } catch (err) {
      setError(t('twoFactor.alerts.loadStatusFailed'));
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!window.confirm(t('twoFactor.alerts.disableConfirm'))) {
      return;
    }

    try {
      setLoading(true);
      await axiosInstance.post(
        '/api/users/2fa/disable/',
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );
      await loadStatus();
    } catch (err) {
      setError(t('twoFactor.alerts.disableFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  if (showSetup) {
    return (
      <TwoFASetup
        onSetupComplete={() => {
          setShowSetup(false);
          loadStatus();
        }}
        onCancel={() => setShowSetup(false)}
      />
    );
  }

  if (loading && !status) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${isArabic ? 'text-right' : 'text-left'}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('twoFactor.title')}
        </h2>
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            status?.is_2fa_enabled
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
          }`}
        >
          {status?.is_2fa_enabled ? t('twoFactor.status.enabled') : t('twoFactor.status.notSetup')}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {status?.is_2fa_enabled ? (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
            <div className="flex items-center">
              <svg
                className={`w-5 h-5 text-green-600 dark:text-green-400 ${isArabic ? 'ml-2' : 'mr-2'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-green-700 dark:text-green-300">
                {t('twoFactor.status.protected')}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('twoFactor.devices.title')}</h3>
            {status.devices?.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="text-start">
                  <p className="font-medium text-gray-800 dark:text-white">{device.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('twoFactor.devices.added', { date: new Date(device.created_at).toLocaleDateString(i18n.resolvedLanguage) })}
                  </p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full dark:bg-green-900/30 dark:text-green-300">
                  {t('twoFactor.devices.active')}
                </span>
              </div>
            ))}
          </div>

          {status.has_backup_codes && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                {t('twoFactor.backupCodes.count', { count: status.backup_codes_count })}
              </p>
            </div>
          )}

          <button
            onClick={disable2FA}
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
            type="button"
          >
            {loading ? t('twoFactor.buttons.disabling') : t('twoFactor.buttons.disable')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
              {t('twoFactor.howItWorks.title')}
            </h3>
            <p className="text-yellow-700 dark:text-yellow-400 text-sm">
              {t('twoFactor.howItWorks.desc')}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-white">{t('twoFactor.howItWorks.listTitle')}</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center">
                <svg
                  className={`w-4 h-4 text-green-600 dark:text-green-400 ${isArabic ? 'ml-2' : 'mr-2'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t('twoFactor.howItWorks.step1')}
              </li>
              <li className="flex items-center">
                <svg
                  className={`w-4 h-4 text-green-600 dark:text-green-400 ${isArabic ? 'ml-2' : 'mr-2'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t('twoFactor.howItWorks.step2')}
              </li>
              <li className="flex items-center">
                <svg
                  className={`w-4 h-4 text-green-600 dark:text-green-400 ${isArabic ? 'ml-2' : 'mr-2'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t('twoFactor.howItWorks.step3')}
              </li>
            </ul>
          </div>

          <button
            onClick={() => setShowSetup(true)}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition"
            type="button"
          >
            {t('twoFactor.buttons.setup')}
          </button>
        </div>
      )}
    </div>
  );
};

export default TwoFAManagement;
