import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiUser, FiMail, FiPhone, FiMapPin, FiEdit2, FiSave, FiX, 
  FiLock, FiShield, FiEye, FiEyeOff, FiKey,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import axiosInstance from '../utils/axiosConfig';
import TwoFAManagement from './TwoFAManagement';

const Profile = () => {
  const { t, i18n } = useTranslation(['profile', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showSecondPasswordFields, setShowSecondPasswordFields] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    name: '',
    email: '',
    phone: '',
    country: '',
    optional_phone: '',
    currency_preference: 'USD',
  });

  const [securityForm, setSecurityForm] = useState({
    current_password: '',
    new_password: '',
    current_second_password: '',
    new_second_password: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current_password: false,
    new_password: false,
    current_second_password: false,
    new_second_password: false,
  });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/users/me/');
      setProfileData(response.data);
      setProfileForm({
        full_name: response.data.full_name || '',
        name: response.data.name || '',
        email: response.data.email || '',
        phone: response.data.phone || '',
        country: response.data.country || '',
        optional_phone: response.data.optional_phone || '',
        currency_preference: response.data.currency_preference || 'USD',
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(t('alerts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleProfileInputChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSecurityInputChange = (e) => {
    const { name, value } = e.target;
    setSecurityForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await axiosInstance.patch('/users/me/', profileForm);

      setProfileData(response.data);
      setEditing(false);
      setSuccess(t('alerts.profileUpdated'));

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      const errorMessage = err.response?.data?.message
        || Object.values(err.response?.data || {}).flat().join(', ')
        || t('alerts.profileUpdateFailed');
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = Object.fromEntries(
        Object.entries(securityForm).filter(([_, value]) => value.trim() !== '')
      );

      const response = await axiosInstance.patch('/users/admin/profile/', payload);

      setSuccess(response.data.message || t('security:alerts.updateSuccess'));

      setSecurityForm({
        current_password: '',
        new_password: '',
        current_second_password: '',
        new_second_password: '',
      });

      setShowPasswordFields(false);
      setShowSecondPasswordFields(false);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating security settings:', err);
      const errorMessage = err.response?.data?.message
        || Object.values(err.response?.data || {}).flat().join(', ')
        || t('security:alerts.updateFailed');
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setProfileForm({
      full_name: profileData.full_name || '',
      name: profileData.name || '',
      email: profileData.email || '',
      phone: profileData.phone || '',
      country: profileData.country || '',
      optional_phone: profileData.optional_phone || '',
      currency_preference: profileData.currency_preference || 'USD',
    });
    setSecurityForm({
      current_password: '',
      new_password: '',
      current_second_password: '',
      new_second_password: '',
    });
    setEditing(false);
    setShowPasswordFields(false);
    setShowSecondPasswordFields(false);
    setError(null);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      admin: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: t('common:roles.admin', 'Administrator') },
      agent: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: t('common:roles.agent', 'Agent') },
      user: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: t('common:roles.user', 'User') },
    };

    const config = roleConfig[role] || { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', label: role };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-secondary-dark-bg rounded-2xl p-8 shadow-lg">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
          <div className="flex items-center space-x-4 mb-8">
            <div className="rounded-full bg-gray-200 h-24 w-24" />
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 bg-gray-200 rounded w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-secondary-dark-bg rounded-2xl p-8 shadow-lg ${isArabic ? 'text-right' : 'text-left'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('subtitle')}
          </p>
        </div>

        {activeTab === 'profile' && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            <FiEdit2 className="text-sm" />
            {t('buttons.editProfile')}
          </button>
        ) : activeTab === 'profile' && editing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
              disabled={saving}
            >
              <FiX className="text-sm" />
              {t('buttons.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              disabled={saving}
            >
              <FiSave className="text-sm" />
              {saving ? t('buttons.saving') : t('buttons.saveChanges')}
            </button>
          </div>
        ) : null}
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
          <p className="text-green-700 dark:text-green-300">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="mb-8 border-b border-gray-200 dark:border-gray-700">
        <div className={`flex ${isArabic ? 'space-x-reverse space-x-8' : 'space-x-8'}`}>
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            type="button"
          >
            <FiUser />
            {t('tabs.profile')}
          </button>
          {user?.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('security')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'security'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                type="button"
              >
                <FiShield />
                {t('tabs.security')}
              </button>
              <button
                onClick={() => setActiveTab('2fa')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === '2fa'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                type="button"
              >
                <FiKey />
                {t('tabs.twoFactor')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center">
            <div className="relative inline-block">
              <div className="w-32 h-32 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl mb-4 mx-auto">
                {getInitials(profileData?.full_name || user?.name)}
              </div>
              <div className={`absolute bottom-2 ${isArabic ? 'left-2' : 'right-2'} w-6 h-6 bg-green-500 border-4 border-white dark:border-gray-800 rounded-full`} />
            </div>

            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              {profileData?.full_name || user?.name}
            </h2>
            <div className="mb-4">
              {getRoleBadge(profileData?.role || user?.role)}
            </div>

            <div className={`space-y-3 ${isArabic ? 'text-right' : 'text-left'}`}>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">{t('info.memberSince')}</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {profileData?.date_joined ? new Date(profileData.date_joined).toLocaleDateString(i18n.resolvedLanguage) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">{t('info.status')}</span>
                <span className={`font-medium ${profileData?.is_active ? 'text-green-600' : 'text-red-600'}`}>
                  {profileData?.is_active ? t('info.active') : t('info.inactive')}
                </span>
              </div>
              {profileData?.is_banned && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">{t('info.accountStatus')}</span>
                  <span className="font-medium text-red-600">{t('info.banned')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {activeTab === 'profile' ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-6">
                {t('personal.title')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('personal.fullName')}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      name="full_name"
                      value={profileForm.full_name}
                      onChange={handleProfileInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder={t('personal.fullNamePlaceholder')}
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-2">
                      <FiUser className="text-gray-400" />
                      <span className="text-gray-800 dark:text-white">
                        {profileData?.full_name || t('personal.notSet')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('personal.username')}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      name="name"
                      value={profileForm.name}
                      onChange={handleProfileInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder={t('personal.usernamePlaceholder')}
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-2">
                      <FiUser className="text-gray-400" />
                      <span className="text-gray-800 dark:text-white">
                        {profileData?.name || t('personal.notSet')}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('personal.email')}
                  </label>
                  {editing ? (
                    <input
                      type="email"
                      name="email"
                      value={profileForm.email}
                      onChange={handleProfileInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder={t('personal.emailPlaceholder')}
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-2">
                      <FiMail className="text-gray-400" />
                      <span className="text-gray-800 dark:text-white">
                        {profileData?.email || t('personal.notSet')}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('personal.phone')}
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={profileForm.phone}
                      onChange={handleProfileInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder={t('personal.phonePlaceholder')}
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-2">
                      <FiPhone className="text-gray-400" />
                      <span className="text-gray-800 dark:text-white">
                        {profileData?.phone || t('personal.notSet')}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('personal.country')}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      name="country"
                      value={profileForm.country}
                      onChange={handleProfileInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder={t('personal.countryPlaceholder')}
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-2">
                      <FiMapPin className="text-gray-400" />
                      <span className="text-gray-800 dark:text-white">
                        {profileData?.country || t('personal.notSet')}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('personal.optionalPhone')}
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      name="optional_phone"
                      value={profileForm.optional_phone}
                      onChange={handleProfileInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder={t('personal.optionalPhonePlaceholder')}
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-2">
                      <FiPhone className="text-gray-400" />
                      <span className="text-gray-800 dark:text-white">
                        {profileData?.optional_phone || t('personal.notSet')}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('personal.currencyPreference')}
                  </label>
                  {editing ? (
                    <select
                      name="currency_preference"
                      value={profileForm.currency_preference}
                      onChange={handleProfileInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="USD">{t('currencies:currency.usd')} (USD)</option>
                      <option value="SYP">{t('currencies:currency.syp')} (SYP)</option>
                    </select>
                  ) : (
                    <div className="p-2">
                      <span className="text-gray-800 dark:text-white">
                        {profileData?.currency_preference === 'SYP' ? `${t('currencies:currency.syp')} (SYP)` : `${t('currencies:currency.usd')} (USD)`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'security' ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-6">
                {t('security:title')}
              </h3>

              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-white flex items-center gap-2">
                    <FiLock />
                    {t('security:password.mainTitle')}
                  </h4>
                  <button
                    onClick={() => setShowPasswordFields(!showPasswordFields)}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    type="button"
                  >
                    {showPasswordFields ? t('security:password.cancelButton') : t('security:password.changeButton')}
                  </button>
                </div>

                {showPasswordFields && (
                  <div className="space-y-4 p-4 bg-white dark:bg-gray-700 rounded-lg border dark:border-gray-600">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('security:password.current')}
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current_password ? "text" : "password"}
                          name="current_password"
                          value={securityForm.current_password}
                          onChange={handleSecurityInputChange}
                          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white ${isArabic ? 'pl-10' : 'pr-10'}`}
                          placeholder={t('security:password.currentPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('current_password')}
                          className={`absolute ${isArabic ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}
                        >
                          {showPasswords.current_password ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('security:password.new')}
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new_password ? "text" : "password"}
                          name="new_password"
                          value={securityForm.new_password}
                          onChange={handleSecurityInputChange}
                          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white ${isArabic ? 'pl-10' : 'pr-10'}`}
                          placeholder={t('security:password.newPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('new_password')}
                          className={`absolute ${isArabic ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}
                        >
                          {showPasswords.new_password ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('security:password.requirement')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-white flex items-center gap-2">
                    <FiShield />
                    {t('security:secondPassword.title')}
                  </h4>
                  <button
                    onClick={() => setShowSecondPasswordFields(!showSecondPasswordFields)}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    type="button"
                  >
                    {showSecondPasswordFields ? t('security:password.cancelButton') : t('security:secondPassword.changeButton')}
                  </button>
                </div>

                {showSecondPasswordFields && (
                  <div className="space-y-4 p-4 bg-white dark:bg-gray-700 rounded-lg border dark:border-gray-600">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('security:secondPassword.current')}
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current_second_password ? "text" : "password"}
                          name="current_second_password"
                          value={securityForm.current_second_password}
                          onChange={handleSecurityInputChange}
                          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white ${isArabic ? 'pl-10' : 'pr-10'}`}
                          placeholder={t('security:secondPassword.currentPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('current_second_password')}
                          className={`absolute ${isArabic ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}
                        >
                          {showPasswords.current_second_password ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('security:secondPassword.new')}
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new_second_password ? "text" : "password"}
                          name="new_second_password"
                          value={securityForm.new_second_password}
                          onChange={handleSecurityInputChange}
                          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white ${isArabic ? 'pl-10' : 'pr-10'}`}
                          placeholder={t('security:secondPassword.newPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility('new_second_password')}
                          className={`absolute ${isArabic ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}
                        >
                          {showPasswords.new_second_password ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('security:secondPassword.requirement')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {(showPasswordFields || showSecondPasswordFields) && (
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordFields(false);
                      setShowSecondPasswordFields(false);
                      setSecurityForm({
                        current_password: '',
                        new_password: '',
                        current_second_password: '',
                        new_second_password: ''
                      });
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                    disabled={saving}
                  >
                    {t('security:buttons.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSecurity}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                    disabled={saving}
                  >
                    {saving ? t('security:buttons.saving') : t('security:buttons.save')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-6">
                {t('security:twoFactor.title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('security:twoFactor.desc')}
              </p>

              <TwoFAManagement />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
