import {
  ColumnDirective,
  ColumnsDirective,
  Filter,
  GridComponent,
  Inject,
  Page,
  Selection,
  Sort,
  Toolbar,
} from '@syncfusion/ej2-react-grids';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '../../components';
import axiosInstance from '../../utils/axiosConfig';

const AdminDetailsModal = ({
  isOpen,
  onClose,
  admin,
  onSetPassword,
  onRemoveAdmin,
}) => {
  const { t, i18n } = useTranslation(['admins', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [activeTab, setActiveTab] = useState('overview');
  const [passwordData, setPasswordData] = useState({
    second_password: '',
    confirm_password: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [loading, setLoading] = useState(false);

  if (!isOpen || !admin) return null;

  const handleSetPassword = async () => {
    const errors = {};
    if (passwordData.second_password.length < 8) {
      errors.second_password = t('alerts.passwordLength');
    }
    if (passwordData.second_password !== passwordData.confirm_password) {
      errors.confirm_password = t('alerts.passwordsDoNotMatch');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/.test(passwordData.second_password)) {
      errors.second_password = t('alerts.passwordPattern');
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const result = await onSetPassword(admin.id, passwordData.second_password);
      if (result.success) {
        setPasswordData({ second_password: '', confirm_password: '' });
        setPasswordErrors({});
        alert(t('alerts.passwordUpdateSuccess'));
      }
    } catch (error) {
      console.error('Password setup failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (window.confirm(t('alerts.removeConfirm', { name: admin.name }))) {
      setLoading(true);
      try {
        const result = await onRemoveAdmin(admin.id);
        if (result.success) {
          onClose();
        }
      } catch (error) {
        console.error('Remove admin failed:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('modal.overview.notSet');
    return new Date(dateString).toLocaleString(i18n.resolvedLanguage);
  };

  const getStatusClass = (isActive) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getSuperUserClass = (isSuperuser) => {
    return isSuperuser ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800';
  };

  const getStaffClass = (isStaff) => {
    return isStaff ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  };

  const getSecurityClass = (hasPassword) => {
    return hasPassword ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-secondary-dark-bg border dark:border-gray-700 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden text-start">
        <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                {t('modal.title', { name: admin.full_name })}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">@{admin.name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-8 px-6">
            {['overview', 'security', 'actions'].map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {t(`modal.tabs.${tab}`)}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white">{t('modal.overview.basicInfo')}</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('modal.overview.username')}</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{admin.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('modal.overview.fullName')}</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{admin.full_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('modal.overview.email')}</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{admin.email || t('modal.overview.notSet')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('modal.overview.phone')}</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{admin.phone || t('modal.overview.notSet')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white">{t('modal.overview.status')}</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('modal.overview.accountStatus')}</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getStatusClass(admin.is_active)}`}>
                      {admin.is_active ? t('table.status.active') : t('table.status.inactive')}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('modal.overview.superAdmin')}</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getSuperUserClass(admin.is_superuser)}`}>
                      {admin.is_superuser ? t('table.status.yes') : t('table.status.no')}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('modal.overview.staffAccess')}</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getStaffClass(admin.is_staff)}`}>
                      {admin.is_staff ? t('table.status.yes') : t('table.status.no')}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('modal.overview.joinedDate')}</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(admin.date_joined)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('modal.overview.lastLogin')}</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(admin.last_login)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{t('modal.security.title')}</h4>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4 border dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-gray-800 dark:text-white">{t('modal.security.subtitle')}</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {admin.security?.has_second_password
                          ? t('modal.security.msgSet')
                          : t('modal.security.msgNotSet')}
                      </p>
                      {admin.security?.second_password_set_at && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t('modal.security.lastUpdated', { date: formatDate(admin.security.second_password_set_at) })}
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSecurityClass(admin.security?.has_second_password)}`}>
                      {admin.security?.has_second_password ? t('modal.security.statusConfigured') : t('modal.security.statusNotConfigured')}
                    </span>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h5 className="font-medium text-gray-800 dark:text-white mb-3">{t('modal.security.formTitle')}</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('modal.security.passwordLabel')}
                      </label>
                      <input
                        type="password"
                        value={passwordData.second_password}
                        onChange={(e) => setPasswordData({ ...passwordData, second_password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#20232A] dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('modal.security.passwordPlaceholder')}
                      />
                      {passwordErrors.second_password && (
                        <p className="text-red-500 text-xs mt-1">{passwordErrors.second_password}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('modal.security.confirmLabel')}
                      </label>
                      <input
                        type="password"
                        value={passwordData.confirm_password}
                        onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-[#20232A] dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('modal.security.confirmPlaceholder')}
                      />
                      {passwordErrors.confirm_password && (
                        <p className="text-red-500 text-xs mt-1">{passwordErrors.confirm_password}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    <p>{t('modal.security.rulesTitle')}</p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>{t('modal.security.rule1')}</li>
                      <li>{t('modal.security.rule2')}</li>
                      <li>{t('modal.security.rule3')}</li>
                      <li>{t('modal.security.rule4')}</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={handleSetPassword}
                    disabled={loading || !passwordData.second_password || !passwordData.confirm_password}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {loading ? t('modal.security.btnUpdating') : t('modal.security.btnUpdate')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{t('modal.actions.title')}</h4>
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-lg p-4">
                  <h5 className="font-medium text-red-800 dark:text-red-300 mb-2">{t('modal.actions.dangerZone')}</h5>
                  <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                    {t('modal.actions.dangerDesc')}
                  </p>
                  <button
                    type="button"
                    onClick={handleRemoveAdmin}
                    disabled={loading}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition"
                  >
                    {loading ? t('modal.actions.btnRemoving') : t('modal.actions.btnRemove')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              {t('modal.buttons.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Admins = () => {
  const { t, i18n } = useTranslation(['admins', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [gridInstance, setGridInstance] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const selectionsettings = { persistSelection: true };
  const editing = { allowDeleting: false, allowEditing: false };

  const toolbarOptions = useMemo(() => [
    { text: t('table.buttons.refresh', 'Refresh'), id: 'Refresh', prefixIcon: 'e-refresh' },
    { text: t('table.buttons.viewDetails', 'View Details'), id: 'View Details', prefixIcon: 'e-description' }
  ], [t]);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/users/admin-users/');
      setAdmins(response.data);
    } catch (err) {
      console.error('Error fetching admins:', err);
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const setAdminSecondPassword = async (adminId, password) => {
    try {
      await axiosInstance.post(`/users/set-admin-password/${adminId}/`, {
        second_password: password,
        confirm_password: password,
      });
      await fetchAdmins();
      return { success: true };
    } catch (err) {
      console.error('Error setting admin password:', err);
      const errorMsg = err.response?.data?.error || 'Failed to set second password';
      alert(`${t('common:error', 'Error')}: ${errorMsg}`);
      return { success: false };
    }
  };

  const removeAdminRole = async (adminId) => {
    try {
      await axiosInstance.post(`/users/remove-admin/${adminId}/`);
      await fetchAdmins();
      alert(t('alerts.removeSuccess'));
      return { success: true };
    } catch (err) {
      console.error('Error removing admin role:', err);
      const errorMsg = err.response?.data?.error || 'Failed to remove admin role';
      alert(`${t('common:error', 'Error')}: ${errorMsg}`);
      return { success: false };
    }
  };

  const toolbarClick = async (args) => {
    if (args.item.id.includes('Refresh')) {
      fetchAdmins();
    }

    if (args.item.id.includes('View Details')) {
      const selected = gridInstance.getSelectedRecords();
      if (selected.length > 0) {
        if (selected.length > 1) {
          alert(t('alerts.selectSingle'));
          return;
        }
        const admin = selected[0];
        setSelectedAdmin(admin);
        setDetailsModalOpen(true);
      } else {
        alert(t('alerts.selectOne'));
      }
    }
  };

  const handleRowClick = () => {};

  const stats = useMemo(() => {
    const totalAdmins = admins.length;
    const activeAdmins = admins.filter((admin) => admin.is_active).length;
    const superAdmins = admins.filter((admin) => admin.is_superuser).length;
    const adminsWithSecondPassword = admins.filter((admin) => admin.has_second_password).length;

    return {
      totalAdmins,
      activeAdmins,
      superAdmins,
      adminsWithSecondPassword,
      inactiveAdmins: totalAdmins - activeAdmins,
      securityPercentage: totalAdmins > 0 ? Math.round((adminsWithSecondPassword / totalAdmins) * 100) : 0,
    };
  }, [admins]);

  const getStatusClass = (isActive) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getSuperUserClass = (isSuperuser) => {
    return isSuperuser ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800';
  };

  const getSecurityClass = (hasPassword) => {
    return hasPassword ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  };

  const adminsGrid = useMemo(() => [
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
      field: 'name',
      headerText: t('table.headers.username'),
      width: '120',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'full_name',
      headerText: t('table.headers.fullName'),
      width: '150',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'email',
      headerText: t('table.headers.email'),
      width: '180',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'phone',
      headerText: t('table.headers.phone'),
      width: '130',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'is_active',
      headerText: t('table.headers.status'),
      width: '100',
      textAlign: 'Center',
      template: (props) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(props.is_active)}`}>
          {props.is_active ? t('table.status.active') : t('table.status.inactive')}
        </span>
      ),
    },
    {
      field: 'is_superuser',
      headerText: t('table.headers.superAdmin'),
      width: '100',
      textAlign: 'Center',
      template: (props) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getSuperUserClass(props.is_superuser)}`}>
          {props.is_superuser ? t('table.status.yes') : t('table.status.no')}
        </span>
      ),
    },
    {
      field: 'has_second_password',
      headerText: t('table.headers.security'),
      width: '100',
      textAlign: 'Center',
      template: (props) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getSecurityClass(props.has_second_password)}`}>
          {props.has_second_password ? t('table.status.secure') : t('table.status.setupNeeded')}
        </span>
      ),
    },
    {
      field: 'date_joined',
      headerText: t('table.headers.joinedDate'),
      width: '120',
      format: 'yMd',
      textAlign: 'Center',
    },
    {
      field: 'last_login',
      headerText: t('table.headers.lastLogin'),
      width: '120',
      format: 'yMd',
      textAlign: 'Center',
      template: (props) => (
        <span>
          {props.last_login ? new Date(props.last_login).toLocaleDateString(i18n.resolvedLanguage) : t('table.never')}
        </span>
      ),
    },
  ], [t, isArabic, i18n.resolvedLanguage]);

  if (loading) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('category')} title={t('title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-gray-700 dark:text-gray-300">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('category')} title={t('title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-red-500">{error}</div>
          <button
            type="button"
            onClick={fetchAdmins}
            className="ms-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {t('tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl text-start">
      <Header category={t('category')} title={t('title')} />

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={fetchAdmins}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm flex items-center gap-2"
        >
          {t('stats.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 font-semibold">{t('stats.total')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalAdmins}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200 font-semibold">{t('stats.active')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.activeAdmins}</p>
          <p className="text-sm text-green-600 dark:text-green-400">
            {t('stats.activeSuffix', { percent: stats.totalAdmins > 0 ? Math.round((stats.activeAdmins / stats.totalAdmins) * 100) : 0 })}
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-purple-800 dark:text-purple-200 font-semibold">{t('stats.super')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.superAdmins}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <p className="text-orange-800 dark:text-orange-200 font-semibold">{t('stats.security')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.adminsWithSecondPassword}</p>
          <p className="text-sm text-orange-600 dark:text-orange-400">
            {t('stats.securedSuffix', { percent: stats.securityPercentage })}
          </p>
        </div>
      </div>

      {stats.securityPercentage < 100 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-yellow-400 dark:text-yellow-300">⚠</span>
            </div>
            <div className="ms-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t('notice.title')}
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>
                  {t('notice.desc', { count: stats.totalAdmins - stats.adminsWithSecondPassword })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {admins.length > 0 ? (
        <GridComponent
          dataSource={admins}
          ref={(g) => setGridInstance(g)}
          enableHover={false}
          allowPaging
          pageSettings={{ pageCount: 5, pageSize: 10 }}
          selectionSettings={selectionsettings}
          toolbar={toolbarOptions}
          editSettings={editing}
          allowSorting
          allowFiltering
          toolbarClick={toolbarClick}
          rowSelected={handleRowClick}
          enableRtl={isArabic}
          locale={isArabic ? 'ar' : 'en-US'}
        >
          <ColumnsDirective>
            {adminsGrid.map((item, index) => (
              <ColumnDirective key={index} {...item} />
            ))}
          </ColumnsDirective>
          <Inject services={[Page, Selection, Toolbar, Sort, Filter]} />
        </GridComponent>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
          <p className="text-gray-500 dark:text-gray-300 text-lg font-medium">{t('emptyState.title')}</p>
          <p className="text-gray-400 dark:text-gray-500 mt-2">
            {t('emptyState.desc')}
          </p>
        </div>
      )}

      <AdminDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedAdmin(null);
        }}
        admin={selectedAdmin}
        onSetPassword={setAdminSecondPassword}
        onRemoveAdmin={removeAdminRole}
      />
    </div>
  );
};

export default Admins;
