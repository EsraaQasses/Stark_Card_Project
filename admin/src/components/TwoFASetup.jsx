import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../utils/axiosConfig';

const TwoFASetup = ({ onSetupComplete, onCancel }) => {
  const { t, i18n } = useTranslation(['security', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);

  const startSetup = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axiosInstance.get('/api/users/2fa/setup/', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.data.is_2fa_enabled) {
        setError(t('twoFactor.alerts.setupAlreadyEnabled'));
        return;
      }

      setSetupData(response.data);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || t('twoFactor.alerts.setupStartFailed'));
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError(t('twoFactor.alerts.invalidCode'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await axiosInstance.post('/api/users/2fa/verify/', {
        token: verificationCode,
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      setBackupCodes(response.data.backup_codes);
      setSuccess(response.data.message);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || t('twoFactor.alerts.verifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startSetup();
  }, []);

  const handleManualEntry = () => {
    navigator.clipboard.writeText(setupData.secret);
    setSuccess(t('twoFactor.alerts.copiedSecret'));
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('twoFactor.setupWizard.step1.title')}</h3>
        <p className="text-gray-600 dark:text-gray-400">{t('twoFactor.setupWizard.step1.desc')}</p>
      </div>

      {setupData?.qr_code && (
        <div className="flex justify-center">
          <img
            src={setupData.qr_code}
            alt="QR Code for 2FA"
            className="w-48 h-48 border rounded-lg dark:border-gray-600"
          />
        </div>
      )}

      <div className="text-center">
        <button
          onClick={handleManualEntry}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
          type="button"
        >
          {t('twoFactor.setupWizard.step1.manual')}
        </button>

        {setupData?.secret && (
          <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('twoFactor.setupWizard.step1.secretKey')}</p>
            <code className="text-sm font-mono bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600 dark:text-white block truncate">
              {setupData.secret}
            </code>
          </div>
        )}
      </div>

      <div className={`flex ${isArabic ? 'space-x-reverse space-x-4' : 'space-x-4'}`}>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white py-2 px-4 rounded-lg transition"
          type="button"
        >
          {t('twoFactor.setupWizard.buttons.cancel')}
        </button>
        <button
          onClick={() => setStep(2)}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
          type="button"
        >
          {t('twoFactor.setupWizard.buttons.scanned')}
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('twoFactor.setupWizard.step2.title')}</h3>
        <p className="text-gray-600 dark:text-gray-400">{t('twoFactor.setupWizard.step2.desc')}</p>
      </div>

      <div>
        <input
          type="text"
          maxLength={6}
          pattern="[0-9]{6}"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-xl tracking-widest dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder={t('twoFactor.setupWizard.step2.placeholder')}
          disabled={loading}
        />
      </div>

      <div className={`flex ${isArabic ? 'space-x-reverse space-x-4' : 'space-x-4'}`}>
        <button
          onClick={() => setStep(1)}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white py-2 px-4 rounded-lg transition"
          type="button"
        >
          {t('twoFactor.setupWizard.buttons.back')}
        </button>
        <button
          onClick={verifyToken}
          disabled={loading || verificationCode.length !== 6}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          type="button"
        >
          {loading ? t('twoFactor.setupWizard.buttons.verifying') : t('twoFactor.setupWizard.buttons.verify')}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('twoFactor.setupWizard.step3.title')}</h3>
        <p className="text-gray-600 dark:text-gray-400">{t('twoFactor.setupWizard.step3.desc')}</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
        <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">⚠️ {t('twoFactor.backupCodes.warningTitle')}</h4>
        <p className="text-yellow-700 dark:text-yellow-400 text-sm mb-3">
          {t('twoFactor.backupCodes.warningDesc')}
        </p>

        <div className="bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-700">
          {backupCodes.map((code) => (
            <div key={code} className="font-mono text-sm text-center py-1 border-b dark:border-gray-700 last:border-b-0 dark:text-white">
              {code}
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            const codesText = backupCodes.join('\n');
            navigator.clipboard.writeText(codesText);
            setSuccess(t('twoFactor.alerts.copiedBackup'));
          }}
          className="w-full mt-3 bg-yellow-100 text-yellow-800 py-2 px-4 rounded hover:bg-yellow-200 transition text-sm dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/55"
          type="button"
        >
          {t('twoFactor.backupCodes.copyButton')}
        </button>
      </div>

      <button
        onClick={onSetupComplete}
        className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition"
        type="button"
      >
        {t('twoFactor.setupWizard.buttons.done')}
      </button>
    </div>
  );

  return (
    <div className={`bg-white dark:bg-secondary-dark-bg rounded-lg shadow-lg p-6 max-w-md mx-auto ${isArabic ? 'text-right' : 'text-left'}`}>
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('twoFactor.setupWizard.title')}</h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
          <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
        </div>
      )}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
};

export default TwoFASetup;
