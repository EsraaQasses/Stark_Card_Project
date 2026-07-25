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
import {
  AccumulationChartComponent,
  AccumulationSeriesCollectionDirective,
  AccumulationSeriesDirective,
  AccumulationLegend,
  PieSeries,
  AccumulationDataLabel,
  Inject as ChartInject,
  AccumulationTooltip,
} from '@syncfusion/ej2-react-charts';

import { Header } from '../../components';
import axiosInstance from '../../utils/axiosConfig';

const AdminPromotionModal = ({
  isOpen,
  onClose,
  user,
  onPromote,
  onSetPassword,
}) => {
  const { t } = useTranslation(['customers', 'common']);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    second_password: '',
    confirm_password: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({});

  if (!isOpen) return null;

  const handlePromote = async () => {
    setLoading(true);
    try {
      const result = await onPromote(user.id);
      if (result.success) {
        if (result.requiresSecondPasswordSetup) {
          setStep(2);
        } else {
          onClose();
        }
      }
    } catch (err) {
      console.error('Promotion failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    const errors = {};
    if (passwordData.second_password.length < 8) {
      errors.second_password = t('catalog.modal.errors.len');
    }
    if (passwordData.second_password !== passwordData.confirm_password) {
      errors.confirm_password = t('catalog.modal.errors.mismatch');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/.test(passwordData.second_password)) {
      errors.second_password = t('catalog.modal.errors.complexity');
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const result = await onSetPassword(user.id, passwordData.second_password);
      if (result.success) {
        onClose();
        setStep(1);
        setPasswordData({ second_password: '', confirm_password: '' });
        setPasswordErrors({});
      }
    } catch (err) {
      console.error('Password setup failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setPasswordData({ second_password: '', confirm_password: '' });
    setPasswordErrors({});
    onClose();
  };

  const handleBack = () => {
    setStep(1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-gray-100 rounded-lg p-6 w-96 max-w-full mx-4 border dark:border-gray-700">
        {step === 1 && (
          <>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 text-start">
              {t('catalog.modal.promoteTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4 text-start">
              {t('catalog.modal.confirmMsg', { name: user?.name })}
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-4 text-start font-medium">
              {t('catalog.modal.warningMsg')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                disabled={loading}
              >
                {t('catalog.modal.buttons.cancel')}
              </button>
              <button
                type="button"
                onClick={handlePromote}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 transition"
                disabled={loading}
              >
                {loading ? t('catalog.modal.buttons.promoting') : t('catalog.modal.buttons.promote')}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 text-start">
              {t('catalog.modal.setPasswordTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4 text-start">
              {t('catalog.modal.setPasswordMsg', { name: user?.name })}
            </p>

            <div className="space-y-4 mb-4 text-start">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('catalog.modal.fields.secondPassword')}
                </label>
                <input
                  type="password"
                  value={passwordData.second_password}
                  onChange={(e) => setPasswordData({ ...passwordData, second_password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('catalog.modal.fields.secondPasswordPlaceholder')}
                />
                {passwordErrors.second_password && (
                  <p className="text-red-500 text-xs mt-1">{passwordErrors.second_password}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('catalog.modal.fields.confirmPassword')}
                </label>
                <input
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('catalog.modal.fields.confirmPasswordPlaceholder')}
                />
                {passwordErrors.confirm_password && (
                  <p className="text-red-500 text-xs mt-1">{passwordErrors.confirm_password}</p>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-start">
              <p className="font-semibold">{t('catalog.modal.criteria.title')}</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>{t('catalog.modal.criteria.len')}</li>
                <li>{t('catalog.modal.criteria.case')}</li>
                <li>{t('catalog.modal.criteria.num')}</li>
                <li>{t('catalog.modal.criteria.spec')}</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                disabled={loading}
              >
                {t('catalog.modal.buttons.back')}
              </button>
              <button
                type="button"
                onClick={handleSetPassword}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 transition"
                disabled={loading}
              >
                {loading ? t('catalog.modal.buttons.settingPassword') : t('catalog.modal.buttons.setPassword')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Customers = () => {
  const { t, i18n } = useTranslation(['customers', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [gridInstance, setGridInstance] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminModal, setAdminModal] = useState({
    isOpen: false,
    user: null,
  });

  const selectionsettings = { persistSelection: true };
  const toolbarOptions = useMemo(() => [
    { text: t('catalog.table.headers.delete', 'Delete'), id: 'deletegrid', prefixIcon: 'e-delete' },
    { text: t('catalog.table.headers.block', 'Block'), id: 'Block' },
    { text: t('catalog.table.headers.unblock', 'Unblock'), id: 'Unblock' },
    { text: t('catalog.table.headers.makeAgent', 'Make Agent'), id: 'Make Agent' },
    { text: t('catalog.table.headers.makeAdmin', 'Make Admin'), id: 'Make Admin' },
    { text: t('catalog.table.headers.refresh', 'Refresh'), id: 'Refresh', prefixIcon: 'e-refresh' }
  ], [t]);

  const editing = { allowDeleting: true, allowEditing: true };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);

      try {
        const response = await axiosInstance.get('/users/users-simple/');
        setCustomers(response.data);
        return;
      } catch (simpleError) {
        console.log('Simple endpoint failed, trying main endpoint:', simpleError);
      }

      const response = await axiosInstance.get('/users/users/');
      setCustomers(response.data);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(t('catalog.alerts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const promoteToAdmin = async (userId) => {
    try {
      const response = await axiosInstance.post(`/users/make-admin/${userId}/`);
      await fetchCustomers();
      return {
        success: true,
        requiresSecondPasswordSetup: response.data.requires_second_password_setup,
      };
    } catch (err) {
      console.error('Error promoting user to admin:', err);
      const errorMsg = err.response?.data?.error || 'Failed to promote user to admin';
      alert(t('catalog.alerts.promoteFailed', { error: errorMsg }));
      return { success: false };
    }
  };

  const setAdminSecondPassword = async (userId, password) => {
    try {
      await axiosInstance.post(`/users/set-admin-password/${userId}/`, {
        second_password: password,
        confirm_password: password,
      });

      await fetchCustomers();
      alert(t('catalog.alerts.setPasswordSuccess'));
      return { success: true };
    } catch (err) {
      console.error('Error setting admin password:', err);
      const errorMsg = err.response?.data?.error || 'Failed to set second password';
      alert(t('catalog.alerts.setPasswordFailed', { error: errorMsg }));
      return { success: false };
    }
  };

  const openAdminPromotionModal = (user) => {
    setAdminModal({
      isOpen: true,
      user,
    });
  };

  const closeAdminPromotionModal = () => {
    setAdminModal({
      isOpen: false,
      user: null,
    });
  };

  const getRoleClass = (role) => {
    if (role === 'admin') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (role === 'agent') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  };

  const userActivityData = useMemo(() => {
    const totalUsers = customers.length;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const active = customers.filter((user) => {
      const lastActive = user.last_login ? new Date(user.last_login) : new Date(user.date_joined);
      return lastActive > thirtyDaysAgo;
    }).length;

    const newUsers = customers.filter((user) => {
      const joinedDate = new Date(user.date_joined);
      return joinedDate > sevenDaysAgo;
    }).length;

    const dormant = totalUsers - active;

    return [
      {
        x: t('catalog.activity.activeLabel'),
        y: active,
        text: `${active}`,
        color: '#10B981',
        description: t('catalog.activity.activeDesc'),
      },
      {
        x: t('catalog.activity.dormantLabel'),
        y: dormant,
        text: `${dormant}`,
        color: '#EF4444',
        description: t('catalog.activity.dormantDesc'),
      },
      {
        x: t('catalog.activity.newLabel'),
        y: newUsers,
        text: `${newUsers}`,
        color: '#F59E0B',
        description: t('catalog.activity.newDesc'),
      },
    ];
  }, [customers, t]);

  const totalUsers = customers.length;
  const activePercentage = totalUsers > 0 ? ((userActivityData[0].y / totalUsers) * 100).toFixed(1) : 0;
  const dormantPercentage = totalUsers > 0 ? ((userActivityData[1].y / totalUsers) * 100).toFixed(1) : 0;
  const newPercentage = totalUsers > 0 ? ((userActivityData[2].y / totalUsers) * 100).toFixed(1) : 0;

  const handleDeleteUsers = async (selected) => {
    if (window.confirm(t('catalog.alerts.deleteConfirm', { count: selected.length }))) {
      try {
        alert(t('catalog.alerts.deleteMarked', { count: selected.length }));
      } catch (err) {
        console.error('Error deleting customers:', err);
        alert(t('catalog.alerts.deleteFailed'));
      }
    }
  };

  const handleBlockUsers = async (selected) => {
    try {
      const banPromises = selected.map((customer) => axiosInstance.post(`/users/ban/${customer.id}/`));
      await Promise.all(banPromises);
      await fetchCustomers();
      alert(t('catalog.alerts.blockSuccess', { count: selected.length }));
    } catch (err) {
      console.error('Error blocking customers:', err);
      alert(t('catalog.alerts.blockFailed'));
    }
  };

  const handleUnblockUsers = async (selected) => {
    try {
      const unbanPromises = selected.map((customer) => axiosInstance.post(`/users/unban/${customer.id}/`));
      await Promise.all(unbanPromises);
      await fetchCustomers();
      alert(t('catalog.alerts.unblockSuccess', { count: selected.length }));
    } catch (err) {
      console.error('Error unblocking customers:', err);
      alert(t('catalog.alerts.unblockFailed'));
    }
  };

  const handleMakeAgent = async (selected) => {
    if (selected.length > 1) {
      alert(t('catalog.alerts.selectOneAgent'));
      return;
    }

    const user = selected[0];

    if (user.role === 'agent') {
      alert(t('catalog.alerts.alreadyAgent', { name: user.name }));
      return;
    }

    if (user.role === 'admin') {
      alert(t('catalog.alerts.adminCannotBeAgent'));
      return;
    }

    if (window.confirm(t('catalog.alerts.makeAgentConfirm', { name: user.name }))) {
      try {
        const response = await axiosInstance.post(`/users/make-agent/${user.id}/`);
        await fetchCustomers();
        alert(t('catalog.alerts.makeAgentSuccess', { name: user.name, code: response.data.agent_code }));
      } catch (err) {
        console.error('Error making user agent:', err);
        const errorMsg = err.response?.data?.error || 'Failed to make user agent';
        alert(t('catalog.alerts.makeAgentFailed', { error: errorMsg }));
      }
    }
  };

  const handleMakeAdmin = (selected) => {
    if (selected.length > 1) {
      alert(t('catalog.alerts.selectOneAdmin'));
      return;
    }

    const user = selected[0];

    if (user.role === 'admin') {
      alert(t('catalog.alerts.alreadyAdmin', { name: user.name }));
      return;
    }

    openAdminPromotionModal(user);
  };

  const toolbarClick = async (args) => {
    if (!gridInstance) return;

    const selected = gridInstance.getSelectedRecords();

    if (args.item.id.includes('deletegrid')) {
      if (selected.length > 0) {
        await handleDeleteUsers(selected);
      } else {
        alert(t('catalog.alerts.selectDelete'));
      }
    }

    if (args.item.id.includes('Block')) {
      if (selected.length > 0) {
        await handleBlockUsers(selected);
      } else {
        alert(t('catalog.alerts.selectBlock'));
      }
    }

    if (args.item.id.includes('Unblock')) {
      if (selected.length > 0) {
        await handleUnblockUsers(selected);
      } else {
        alert(t('catalog.alerts.selectUnblock'));
      }
    }

    if (args.item.id.includes('Make Agent')) {
      if (selected.length > 0) {
        await handleMakeAgent(selected);
      } else {
        alert(t('catalog.alerts.selectAgent'));
      }
    }

    if (args.item.id.includes('Make Admin')) {
      if (selected.length > 0) {
        handleMakeAdmin(selected);
      } else {
        alert(t('catalog.alerts.selectAdmin'));
      }
    }

    if (args.item.id.includes('Refresh')) {
      fetchCustomers();
    }
  };

  const pointRender = (args) => {
    const activityItem = userActivityData.find((item) => item.x === args.point.x);
    if (activityItem) {
      args.fill = activityItem.color;
    }
  };

  const totalBalances = useMemo(() => customers.reduce((acc, customer) => {
    if (customer.balances) {
      Object.entries(customer.balances).forEach(([currency, balance]) => {
        acc[currency] = (acc[currency] || 0) + parseFloat(balance);
      });
    }
    return acc;
  }, {}), [customers]);

  const adminCount = useMemo(() => customers.filter((user) => user.role === 'admin').length, [customers]);

  const customersGrid = useMemo(() => [
    {
      type: 'checkbox',
      width: '50',
    },
    {
      field: 'id',
      headerText: t('catalog.table.headers.id'),
      width: '80',
      textAlign: 'Center',
      isPrimaryKey: true,
    },
    {
      field: 'name',
      headerText: t('catalog.table.headers.username'),
      width: '120',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'full_name',
      headerText: t('catalog.table.headers.fullName'),
      width: '150',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'email',
      headerText: t('catalog.table.headers.email'),
      width: '180',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'phone',
      headerText: t('catalog.table.headers.phone'),
      width: '130',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'country',
      headerText: t('catalog.table.headers.country'),
      width: '100',
      textAlign: isArabic ? 'Right' : 'Left',
    },
    {
      field: 'role',
      headerText: t('catalog.table.headers.role'),
      width: '100',
      template: (props) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleClass(props.role)}`}>
          {t(`role.${props.role}`, props.role)}
        </span>
      ),
    },
    {
      field: 'is_banned',
      headerText: t('catalog.table.headers.status'),
      width: '100',
      template: (props) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          props.is_banned
            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
        }`}
        >
          {props.is_banned ? t('status.banned') : t('status.active')}
        </span>
      ),
    },
    {
      field: 'balances.USD',
      headerText: t('catalog.table.headers.usdBalance'),
      width: '120',
      textAlign: 'Center',
      template: (props) => {
        const formattedBalance = props.balances?.USD
          ? parseFloat(props.balances.USD).toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '0.00';
        return (
          <span className="font-semibold text-green-600 dark:text-green-400">
            {t('catalog.table.usdFormat', { balance: formattedBalance })}
          </span>
        );
      },
    },
    {
      field: 'balances.SYP',
      headerText: t('catalog.table.headers.sypBalance'),
      width: '120',
      textAlign: 'Center',
      template: (props) => {
        const formattedBalance = props.balances?.SYP
          ? parseFloat(props.balances.SYP).toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '0.00';
        return (
          <span className="font-semibold text-orange-600 dark:text-orange-400">
            {t('catalog.table.sypFormat', { balance: formattedBalance })}
          </span>
        );
      },
    },
    {
      field: 'agent_code',
      headerText: t('catalog.table.headers.agentCode'),
      width: '120',
      template: (props) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          props.agent_code ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
        }`}
        >
          {props.agent_code || t('catalog.table.notAvailable')}
        </span>
      ),
    },
    {
      field: 'date_joined',
      headerText: t('catalog.table.headers.joinedDate'),
      width: '120',
      textAlign: 'Center',
      template: (props) => (
        <span>
          {props.date_joined ? new Date(props.date_joined).toLocaleDateString(i18n.resolvedLanguage) : t('catalog.table.neverLogin')}
        </span>
      ),
    },
    {
      field: 'last_login',
      headerText: t('catalog.table.headers.lastLogin'),
      width: '120',
      textAlign: 'Center',
      template: (props) => (
        <span>
          {props.last_login ? new Date(props.last_login).toLocaleDateString(i18n.resolvedLanguage) : t('catalog.table.neverLogin')}
        </span>
      ),
    },
  ], [t, isArabic, i18n.resolvedLanguage]);

  if (loading) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('catalog.category')} title={t('catalog.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-gray-700 dark:text-gray-200">{t('catalog.table.loadingText', 'Loading customers data...')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('catalog.category')} title={t('catalog.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-red-500 dark:text-red-400">{error}</div>
          <button
            type="button"
            onClick={fetchCustomers}
            className="ms-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            {t('common:tryAgain', 'Try Again')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
      <Header category={t('catalog.category')} title={t('catalog.title')} />

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={fetchCustomers}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm flex items-center gap-2"
        >
          {t('catalog.buttons.refreshData')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 text-center">
            {t('catalog.activity.title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">
            {t('catalog.activity.totalUsers', { count: totalUsers })}
          </p>
          {totalUsers > 0 ? (
            <AccumulationChartComponent
              id="user-activity-chart"
              legendSettings={{
                visible: true,
                position: 'Bottom',
                textStyle: { size: '12px', fontWeight: '600', color: isArabic ? '#fff' : undefined },
              }}
              height="300px"
              tooltip={{
                enable: true,
                format: t('catalog.activity.tooltipFormat'),
              }}
              pointRender={pointRender}
              enableRtl={isArabic}
            >
              <ChartInject services={[AccumulationLegend, PieSeries, AccumulationDataLabel, AccumulationTooltip]} />
              <AccumulationSeriesCollectionDirective>
                <AccumulationSeriesDirective
                  name="User Activity"
                  dataSource={userActivityData}
                  xName="x"
                  yName="y"
                  innerRadius="60%"
                  startAngle={0}
                  endAngle={360}
                  radius="70%"
                  dataLabel={{
                    visible: true,
                    name: 'text',
                    position: 'Inside',
                    font: {
                      fontWeight: '600',
                      color: '#fff',
                    },
                  }}
                />
              </AccumulationSeriesCollectionDirective>
            </AccumulationChartComponent>
          ) : (
            <div className="flex justify-center items-center h-40">
              <p className="text-gray-500 dark:text-gray-400">{t('catalog.activity.noData')}</p>
            </div>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-secondary-dark-bg border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm text-start">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{t('catalog.insights.title')}</h3>

          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg text-start">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-green-800 dark:text-green-200">{t('catalog.insights.active')}</h4>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{t('catalog.insights.usersCount', { count: userActivityData[0].y })}</p>
                <p className="text-sm text-green-600 dark:text-green-400">{t('catalog.insights.percentOfTotal', { percent: activePercentage })}</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full" />
            </div>
            <p className="text-xs text-green-700 dark:text-green-300 mt-2">
              {userActivityData[0].description}
            </p>
          </div>

          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-start">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-red-800 dark:text-red-200">{t('catalog.activity.dormantLabel')}</h4>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{t('catalog.insights.usersCount', { count: userActivityData[1].y })}</p>
                <p className="text-sm text-red-600 dark:text-red-400">{t('catalog.insights.percentOfTotal', { percent: dormantPercentage })}</p>
              </div>
              <div className="w-3 h-3 bg-red-500 rounded-full" />
            </div>
            <p className="text-xs text-red-700 dark:text-red-300 mt-2">
              {userActivityData[1].description}
            </p>
          </div>

          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg text-start">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">{t('catalog.activity.newLabel')}</h4>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{t('catalog.insights.usersCount', { count: userActivityData[2].y })}</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">{t('catalog.insights.percentOfTotal', { percent: newPercentage })}</p>
              </div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
              {userActivityData[2].description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-4 text-start">
          <p className="text-blue-800 dark:text-blue-200 font-semibold text-sm">{t('catalog.stats.total')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalUsers}</p>
        </div>
        <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg p-4 text-start">
          <p className="text-green-800 dark:text-green-200 font-semibold text-sm">{t('catalog.stats.active')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{userActivityData[0].y}</p>
        </div>
        <div className="bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded-lg p-4 text-start">
          <p className="text-red-800 dark:text-red-200 font-semibold text-sm">{t('catalog.stats.admins')}</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{adminCount}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg p-4 text-start">
          <p className="text-purple-800 dark:text-purple-200 font-semibold text-sm">{t('catalog.stats.usdBalance')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {t('catalog.table.usdFormat', { balance: totalBalances.USD ? totalBalances.USD.toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00' })}
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 rounded-lg p-4 text-start">
          <p className="text-orange-800 dark:text-orange-200 font-semibold text-sm">{t('catalog.stats.sypBalance')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {t('catalog.table.sypFormat', { balance: totalBalances.SYP ? totalBalances.SYP.toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00' })}
          </p>
        </div>
      </div>

      {customers.length > 0 ? (
        <GridComponent
          dataSource={customers}
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
          enableRtl={isArabic}
          locale={isArabic ? 'ar' : 'en-US'}
        >
          <ColumnsDirective>
            {customersGrid.map((item, index) => (
              <ColumnDirective key={index} {...item} />
            ))}
          </ColumnsDirective>
          <Inject services={[Page, Selection, Toolbar, Edit, Sort, Filter]} />
        </GridComponent>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-300 text-lg">{t('catalog.table.emptyTitle')}</p>
          <p className="text-gray-400 dark:text-gray-400 mt-2">{t('catalog.table.emptySubtitle')}</p>
        </div>
      )}

      <AdminPromotionModal
        isOpen={adminModal.isOpen}
        onClose={closeAdminPromotionModal}
        user={adminModal.user}
        onPromote={promoteToAdmin}
        onSetPassword={setAdminSecondPassword}
      />
    </div>
  );
};

export default Customers;
