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

const InProgress = () => {
  const { t, i18n } = useTranslation(['requests', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [inProgressData, setInProgressData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    usdTotal: 0,
    sypTotal: 0,
    underReview: 0,
  });
  const toolbarOptions = ['Search'];

  useEffect(() => {
    fetchInProgressRequests();
  }, []);

  const fetchInProgressRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/all_requests/admin/requests/?status=in_progress');
      const requests = response.data;
      setInProgressData(requests);
      calculateStats(requests);
    } catch (err) {
      setError(t('requestsPages.inProgress.error'));
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (requests) => {
    const usdRequests = requests.filter((item) => item.currency === 'usd');
    const sypRequests = requests.filter((item) => item.currency === 'syp');

    const newStats = {
      total: requests.length,
      usdTotal: usdRequests.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0),
      sypTotal: sypRequests.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0),
      underReview: requests.filter((item) => item.status === 'in_progress' || item.description?.toLowerCase().includes('review')).length,
    };
    setStats(newStats);
  };

  const handleApprovePayment = async (requestId, customerName, amount, currency) => {
    if (window.confirm(t('requestsPages.inProgress.alerts.approveConfirm', { amount, currency: currency?.toUpperCase(), customer: customerName }))) {
      try {
        await axiosInstance.post(`/all_requests/admin/requests/${requestId}/update_status/`, {
          status: 'completed',
          admin_notes: 'Payment approved and processed',
        });

        alert(t('requestsPages.inProgress.alerts.approveSuccess', { id: requestId }));
        fetchInProgressRequests();
      } catch (err) {
        const errorMessage = err.response?.data?.message || t('requestsPages.inProgress.alerts.approveFailed');
        alert(`${t('requestsPages.inProgress.alerts.error')}: ${errorMessage}`);
      }
    }
  };

  const handleRejectPayment = async (requestId, customerName) => {
    const reason = prompt(t('requestsPages.inProgress.alerts.rejectPrompt', { customer: customerName }));
    if (!reason) return;

    try {
      await axiosInstance.post(`/all_requests/admin/requests/${requestId}/update_status/`, {
        status: 'rejected',
        admin_notes: reason,
        rejection_reason: reason,
      });

      alert(t('requestsPages.inProgress.alerts.rejectSuccess', { id: requestId, reason }));
      fetchInProgressRequests();
    } catch (err) {
      const errorMessage = err.response?.data?.message || t('requestsPages.inProgress.alerts.rejectFailed');
      alert(`${t('requestsPages.inProgress.alerts.error')}: ${errorMessage}`);
    }
  };

  const handleViewDetails = async (requestId) => {
    try {
      const response = await axiosInstance.get(`/all_requests/admin/requests/${requestId}/`);
      const requestDetails = response.data;

      const details = t('requestsPages.inProgress.alerts.detailsTitle', {
        id: requestId,
        customer: requestDetails.user_name,
        title: requestDetails.title,
        description: requestDetails.description,
        amount: requestDetails.amount || 'N/A',
        currency: requestDetails.currency?.toUpperCase() || '',
        status: t(`status.${requestDetails.status}`),
        date: new Date(requestDetails.created_at).toLocaleDateString(i18n.resolvedLanguage),
        notes: requestDetails.admin_notes || 'N/A'
      });

      alert(details);
    } catch (err) {
      alert(`${t('common:error', 'Error')} #${requestId}`);
    }
  };

  const handleEscalate = async (requestId, customerName) => {
    if (window.confirm(t('requestsPages.inProgress.alerts.escalateConfirm', { defaultValue: 'Escalate request #{{id}} from {{customer}} to supervisor?', id: requestId, customer: customerName }))) {
      try {
        await axiosInstance.post(`/all_requests/admin/requests/${requestId}/add_comment/`, {
          comment: 'ESCALATED: Request escalated to supervisor for further review.',
          is_admin_note: true,
        });

        alert(t('requestsPages.inProgress.alerts.escalateSuccess', { defaultValue: 'Request #{{id}} escalated to supervisor!', id: requestId }));
        fetchInProgressRequests();
      } catch (err) {
        alert(t('requestsPages.inProgress.alerts.escalateFailed', { defaultValue: 'Error escalating request #{{id}}', id: requestId }));
      }
    }
  };

  const customerTemplate = (props) => {
    const request = props;
    return (
      <div className="flex items-center gap-3 text-start">
        <img
          className="rounded-full w-10 h-10 object-cover"
          src={request.user?.avatar || 'https://via.placeholder.com/40x40/cccccc/666666?text=User'}
          alt={request.user_name}
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/40x40/cccccc/666666?text=User';
          }}
        />
        <div>
          <p className="font-semibold text-sm text-gray-800 dark:text-white">{request.user_name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{request.user_email}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{request.user_phone}</p>
        </div>
      </div>
    );
  };

  const getStatusConfig = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-500', icon: '⏳', label: t('status.pending'), progress: 25 },
      in_progress: { color: 'bg-blue-500', icon: '⚙️', label: t('status.in_progress'), progress: 50 },
      objection: { color: 'bg-orange-500', icon: '🔍', label: t('status.objection'), progress: 75 },
      shipping: { color: 'bg-purple-500', icon: '💰', label: t('status.shipping'), progress: 40 },
      completed: { color: 'bg-green-500', icon: '✅', label: t('status.completed'), progress: 100 },
    };
    return statusConfig[status] || { color: 'bg-gray-500', icon: '❓', label: t(`status.${status}`, status), progress: 0 };
  };

  const statusTemplate = (props) => {
    const request = props;
    const config = getStatusConfig(request.status);

    return (
      <div className="text-center">
        <span className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${config.color} mb-1 inline-block`}>
          {config.icon} {config.label}
        </span>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${config.color}`}
            style={{ width: `${config.progress}%` }}
          />
        </div>
      </div>
    );
  };

  const amountTemplate = (props) => {
    const request = props;
    if (!request.amount) return <span className="text-gray-400">-</span>;

    const isUSD = request.currency === 'usd';
    const amountColor = isUSD ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400';

    return (
      <div className="text-center">
        <p className={`text-sm font-bold ${amountColor}`}>
          {parseFloat(request.amount).toLocaleString(i18n.resolvedLanguage)} {t(`currency.${request.currency?.toLowerCase()}`, request.currency?.toUpperCase())}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t(`currency.${request.currency?.toLowerCase()}`, request.currency?.toUpperCase())} {request.request_type === 'payment' ? t('type.payment') : t('type.other')}
        </p>
      </div>
    );
  };

  const agentTemplate = (props) => {
    const request = props;
    const agent = request.user?.agent;

    if (!agent) {
      return (
        <div className="text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('requestsPages.inProgress.table.noAgent', 'No Agent')}</p>
        </div>
      );
    }

    return (
      <div className="text-center">
        <p className="text-sm font-medium text-gray-800 dark:text-white">{agent.full_name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">ID: {agent.agent_code}</p>
      </div>
    );
  };

  const getRequestTypeConfig = (requestType) => {
    const typeConfig = {
      payment: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: t('type.payment') },
      support: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: t('type.support') },
      refund: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', label: t('type.refund') },
      other: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', label: t('type.other') },
    };
    return typeConfig[requestType] || { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', label: requestType };
  };

  const requestTypeTemplate = (props) => {
    const request = props;
    const config = getRequestTypeConfig(request.request_type);

    return (
      <div className="text-center">
        <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
        {request.payment_method_title && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{request.payment_method_title}</p>
        )}
      </div>
    );
  };

  const actionTemplate = (props) => {
    const request = props;
    const canApprove = request.status === 'pending' || request.status === 'in_progress';
    const canEscalate = request.amount > 500;

    return (
      <div className="flex flex-col gap-2 justify-center">
        {canApprove && (
          <button
            type="button"
            className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-xs font-medium"
            onClick={() => handleApprovePayment(request.id, request.user_name, request.amount, request.currency)}
          >
            ✓ {t('requestsPages.inProgress.table.buttons.approve')}
          </button>
        )}

        <button
          type="button"
          className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-xs font-medium"
          onClick={() => handleViewDetails(request.id)}
        >
          👁️ {t('requestsPages.inProgress.table.buttons.viewDetails')}
        </button>

        {canEscalate && (
          <button
            type="button"
            className="px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-xs font-medium"
            onClick={() => handleEscalate(request.id, request.user_name)}
          >
            ⚠️ {t('requestsPages.inProgress.table.buttons.escalate', 'Escalate')}
          </button>
        )}

        <button
          type="button"
          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-xs font-medium"
          onClick={() => handleRejectPayment(request.id, request.user_name)}
        >
          ✗ {t('requestsPages.inProgress.table.buttons.reject')}
        </button>
      </div>
    );
  };

  const dateTemplate = (props) => {
    const date = new Date(props.created_at);
    return (
      <span className="text-sm text-gray-800 dark:text-white">
        {date.toLocaleDateString(i18n.resolvedLanguage, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    );
  };

  if (loading && inProgressData.length === 0) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('catalog.category')} title={t('requestsPages.inProgress.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-gray-700 dark:text-gray-300">{t('requestsPages.inProgress.loading')}</div>
        </div>
      </div>
    );
  }

  if (error && inProgressData.length === 0) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('catalog.category')} title={t('requestsPages.inProgress.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-red-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl text-start">
      <Header
        category={t('catalog.category')}
        title={t('requestsPages.inProgress.title')}
      />

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={fetchInProgressRequests}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm flex items-center gap-2"
          disabled={loading}
        >
          {loading ? t('common:common.buttons.updating', 'Refreshing...') : t('catalog.buttons.refreshData', 'Refresh Data')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800">
          <p className="text-blue-800 dark:text-blue-300 font-semibold">{t('requestsPages.inProgress.stats.total')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-800">
          <p className="text-green-800 dark:text-green-300 font-semibold">{t('requestsPages.inProgress.stats.usdTotal')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${stats.usdTotal.toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 dark:bg-purple-900/20 dark:border-purple-800">
          <p className="text-purple-800 dark:text-purple-300 font-semibold">{t('requestsPages.inProgress.stats.sypTotal')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {t('currency.syp')} {stats.sypTotal.toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 dark:bg-orange-900/20 dark:border-orange-800">
          <p className="text-orange-800 dark:text-orange-300 font-semibold">{t('requestsPages.inProgress.stats.underReview')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.underReview}</p>
        </div>
      </div>

      <GridComponent
        dataSource={inProgressData}
        allowPaging
        allowSorting
        allowFiltering
        toolbar={toolbarOptions}
        pageSettings={{ pageSize: 10 }}
        height={400}
        enableHover={false}
        enableRtl={isArabic}
        locale={isArabic ? 'ar' : 'en-US'}
      >
        <ColumnsDirective>
          <ColumnDirective
            field="id"
            headerText={t('requestsPages.inProgress.table.headers.id')}
            width="80"
            textAlign="Center"
            isPrimaryKey
          />

          <ColumnDirective
            headerText={t('requestsPages.inProgress.table.headers.customer')}
            width="220"
            textAlign={isArabic ? 'Right' : 'Left'}
            template={customerTemplate}
          />

          <ColumnDirective
            headerText={t('requestsPages.inProgress.table.headers.agent', 'Agent')}
            width="150"
            textAlign="Center"
            template={agentTemplate}
          />

          <ColumnDirective
            headerText={t('catalog.table.headers.type')}
            width="120"
            textAlign="Center"
            template={requestTypeTemplate}
          />

          <ColumnDirective
            headerText={t('requestsPages.inProgress.table.headers.amount')}
            width="140"
            textAlign="Center"
            template={amountTemplate}
          />

          <ColumnDirective
            field="title"
            headerText={t('requestsPages.inProgress.table.headers.description')}
            width="160"
            textAlign="Center"
          />

          <ColumnDirective
            headerText={t('catalog.table.headers.status')}
            width="150"
            textAlign="Center"
            template={statusTemplate}
          />

          <ColumnDirective
            field="created_at"
            headerText={t('requestsPages.inProgress.table.headers.requestDate')}
            width="120"
            textAlign="Center"
            template={dateTemplate}
          />

          <ColumnDirective
            headerText={t('catalog.table.headers.actions')}
            width="180"
            textAlign="Center"
            template={actionTemplate}
          />
        </ColumnsDirective>
        <Inject services={[Page, Toolbar, Sort, Filter]} />
      </GridComponent>
    </div>
  );
};

export default InProgress;
