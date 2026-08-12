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

const ObjectionRequest = () => {
  const { t, i18n } = useTranslation(['requests', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [objectionData, setObjectionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    highPriority: 0,
    underReview: 0,
    resolved: 0,
  });
  const toolbarOptions = ['Search'];

  useEffect(() => {
    fetchObjectionRequests();
  }, []);

  const fetchObjectionRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/all_requests/admin/requests/?status=objection');
      const requests = response.data;
      setObjectionData(requests);
      calculateStats(requests);
    } catch (err) {
      setError(t('requestsPages.objection.error'));
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (requests) => {
    const newStats = {
      total: requests.length,
      highPriority: requests.filter((item) => item.description?.toLowerCase().includes('urgent')
      || item.title?.toLowerCase().includes('urgent')
        || item.amount > 500).length,
      underReview: requests.filter((item) => item.status === 'objection').length,
      resolved: requests.filter((item) => item.status === 'completed' && item.request_type === 'support').length,
    };
    setStats(newStats);
  };

  const handleApproveObjection = async (requestId, customerName, reason) => {
    if (actionLoading) return;
    if (window.confirm(t('requestsPages.objection.alerts.approveConfirm', { customer: customerName, reason }))) {
      setActionLoading(requestId);
      try {
        await axiosInstance.post(`/all_requests/admin/requests/${requestId}/update_status/`, {
          status: 'completed',
          admin_notes: 'Objection approved and resolved',
        });

        alert(t('requestsPages.objection.alerts.approveSuccess', { id: requestId }));
        await fetchObjectionRequests();
      } catch (err) {
        const errorMessage = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || t('requestsPages.objection.alerts.approveFailed');
        alert(`${t('requestsPages.objection.alerts.error')}: ${errorMessage}`);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleRejectObjection = async (requestId, customerName, reason) => {
    if (actionLoading) return;
    const rejectionReason = prompt(t('requestsPages.objection.alerts.rejectPrompt', { customer: customerName, reason }));
    if (!rejectionReason) return;

    setActionLoading(requestId);
    try {
      await axiosInstance.post(`/all_requests/admin/requests/${requestId}/update_status/`, {
        status: 'rejected',
        admin_notes: rejectionReason,
        rejection_reason: rejectionReason,
      });

      alert(t('requestsPages.objection.alerts.rejectSuccess', { id: requestId, rejectionReason }));
      await fetchObjectionRequests();
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || err.response?.data?.message || t('requestsPages.objection.alerts.rejectFailed');
      alert(`${t('requestsPages.objection.alerts.error')}: ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = async (requestId, customerName) => {
    try {
      const response = await axiosInstance.get(`/all_requests/admin/requests/${requestId}/`);
      const requestDetails = response.data;

      const details = t('requestsPages.objection.alerts.detailsTitle', {
        customer: customerName,
        reason: requestDetails.description,
        amount: requestDetails.amount || 'N/A',
        currency: requestDetails.currency || '',
        status: t(`status.${requestDetails.status}`),
        date: new Date(requestDetails.created_at).toLocaleDateString(i18n.resolvedLanguage),
        title: requestDetails.title,
        type: t(`type.${requestDetails.request_type}`, requestDetails.request_type)
      });

      alert(details);
    } catch (err) {
      alert(`${t('common:error', 'Error')} #${requestId}`);
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
      objection: { color: 'bg-orange-500', icon: '🔍', label: t('status.objection') },
      in_progress: { color: 'bg-yellow-500', icon: '🕵️', label: t('status.in_progress') },
      completed: { color: 'bg-green-500', icon: '✅', label: t('status.completed') },
      rejected: { color: 'bg-red-500', icon: '❌', label: t('status.rejected') },
      pending: { color: 'bg-purple-500', icon: '📈', label: t('status.pending') },
    };
    return statusConfig[status] || { color: 'bg-gray-500', icon: '❓', label: t(`status.${status}`, status) };
  };

  const statusTemplate = (props) => {
    const request = props;
    const config = getStatusConfig(request.status);

    return (
      <span className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${config.color} flex items-center justify-center gap-1`}>
        {config.icon} {config.label}
      </span>
    );
  };

  const getObjectionType = (req) => {
    const desc = (req.description || '').toLowerCase();
    const title = (req.title || '').toLowerCase();

    if (desc.includes('product') || title.includes('product')) return t('requestsPages.objection.types.product', 'Product Issue');
    if (desc.includes('payment') || title.includes('payment')) return t('requestsPages.objection.types.payment', 'Payment Issue');
    if (desc.includes('delivery') || desc.includes('shipping')) return t('requestsPages.objection.types.delivery', 'Delivery Issue');
    if (desc.includes('refund')) return t('requestsPages.objection.types.refund', 'Refund Request');
    return t('requestsPages.objection.types.general', 'General Issue');
  };

  const reasonTemplate = (props) => {
    const request = props;
    const reason = request.description || request.title;
    const maxLength = 60;
    const objectionType = getObjectionType(request);

    const getTypeClass = (type) => {
      const typeLower = type?.toLowerCase() || '';
      if (typeLower.includes('product') || typeLower.includes('منتج')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      if (typeLower.includes('payment') || typeLower.includes('دفع')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      if (typeLower.includes('delivery') || typeLower.includes('توصيل') || typeLower.includes('shipping') || typeLower.includes('شحن')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      if (typeLower.includes('refund') || typeLower.includes('استرداد')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    };

    return (
      <div
        className="text-start cursor-help"
        title={reason.length > maxLength ? reason : ''}
      >
        <p className="text-sm text-gray-800 dark:text-white">
          {reason.length > maxLength ? `${reason.substring(0, maxLength)}...` : reason}
        </p>
        <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 font-medium ${getTypeClass(objectionType)}`}>
          {objectionType}
        </span>
      </div>
    );
  };

  const getPriority = (req) => {
    if (req.amount > 500) return 'High';
    if ((req.description || '').toLowerCase().includes('urgent')) return 'High';
    if (req.amount > 100) return 'Medium';
    return 'Low';
  };

  const priorityTemplate = (props) => {
    const request = props;
    const priority = getPriority(request);

    const getPriorityConfig = (priorityLevel) => {
      if (priorityLevel === 'High') return { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: '🔴' };
      if (priorityLevel === 'Medium') return { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: '🟡' };
      return { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: '🟢' };
    };

    const config = getPriorityConfig(priority);

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon} {t(`priority.${priority.toLowerCase()}`, priority)}
      </span>
    );
  };

  const actionTemplate = (props) => {
    const request = props;
    const isResolved = request.status === 'completed' || request.status === 'rejected';
    const isMutating = actionLoading === request.id;

    if (isResolved) {
      return (
        <span className="text-gray-400 text-sm capitalize">{t(`status.${request.status}`, request.status)}</span>
      );
    }

    return (
      <div className="flex flex-col gap-2 justify-center">
        <button
          type="button"
          disabled={Boolean(actionLoading)}
          className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => handleApproveObjection(request.id, request.user_name, request.description)}
        >
          {isMutating ? t('common:loading', 'Loading...') : `✓ ${t('requestsPages.objection.table.buttons.approve')}`}
        </button>
        <button
          type="button"
          disabled={Boolean(actionLoading)}
          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => handleRejectObjection(request.id, request.user_name, request.description)}
        >
          ✗ {t('requestsPages.objection.table.buttons.reject')}
        </button>
        <button
          type="button"
          disabled={isMutating}
          className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-xs font-medium"
          onClick={() => handleViewDetails(request.id, request.user_name)}
        >
          👁️ {t('requestsPages.objection.table.buttons.viewDetails')}
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

  const amountTemplate = (props) => {
    const request = props;
    if (!request.amount) return <span className="text-gray-400">-</span>;

    return (
      <div className="text-center">
        <p className="font-semibold text-sm text-gray-800 dark:text-white">
          {parseFloat(request.amount).toLocaleString(i18n.resolvedLanguage)} {t(`currency.${request.currency?.toLowerCase()}`, request.currency?.toUpperCase())}
        </p>
      </div>
    );
  };

  if (loading && objectionData.length === 0) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('catalog.category')} title={t('requestsPages.objection.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-gray-700 dark:text-gray-300">{t('requestsPages.objection.loading')}</div>
        </div>
      </div>
    );
  }

  if (error && objectionData.length === 0) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('catalog.category')} title={t('requestsPages.objection.title')} />
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
        title={t('requestsPages.objection.title')}
      />

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={fetchObjectionRequests}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm flex items-center gap-2"
          disabled={loading}
        >
          {loading ? t('common:common.buttons.updating', 'Refreshing...') : t('catalog.buttons.refreshData', 'Refresh Data')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 dark:bg-orange-900/20 dark:border-orange-800">
          <p className="text-orange-800 dark:text-orange-300 font-semibold">{t('requestsPages.objection.stats.total')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.total}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-800 dark:text-red-300 font-semibold">{t('requestsPages.objection.stats.highPriority')}</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.highPriority}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
          <p className="text-yellow-800 dark:text-yellow-300 font-semibold">{t('requestsPages.objection.stats.underReview')}</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.underReview}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-800">
          <p className="text-green-800 dark:text-green-300 font-semibold">{t('requestsPages.objection.stats.resolved')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
        </div>
      </div>

      <GridComponent
        dataSource={objectionData}
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
            headerText={t('requestsPages.objection.table.headers.id')}
            width="80"
            textAlign="Center"
            isPrimaryKey
          />

          <ColumnDirective
            headerText={t('requestsPages.objection.table.headers.customer')}
            width="220"
            textAlign={isArabic ? 'Right' : 'Left'}
            template={customerTemplate}
          />

          <ColumnDirective
            field="title"
            headerText={t('catalog.table.headers.title')}
            width="150"
            textAlign="Center"
          />

          <ColumnDirective
            headerText={t('requestsPages.objection.table.headers.reason')}
            width="200"
            textAlign={isArabic ? 'Right' : 'Left'}
            template={reasonTemplate}
          />

          <ColumnDirective
            headerText={t('requestsPages.objection.table.headers.amount')}
            width="100"
            textAlign="Center"
            template={amountTemplate}
          />

          <ColumnDirective
            headerText={t('catalog.table.headers.priority', 'Priority')}
            width="100"
            textAlign="Center"
            template={priorityTemplate}
          />

          <ColumnDirective
            field="created_at"
            headerText={t('requestsPages.objection.table.headers.requestDate')}
            width="120"
            textAlign="Center"
            template={dateTemplate}
          />

          <ColumnDirective
            headerText={t('catalog.table.headers.status')}
            width="130"
            textAlign="Center"
            template={statusTemplate}
          />

          <ColumnDirective
            headerText={t('catalog.table.headers.actions')}
            width="150"
            textAlign="Center"
            template={actionTemplate}
          />
        </ColumnsDirective>
        <Inject services={[Page, Toolbar, Sort, Filter]} />
      </GridComponent>
    </div>
  );
};

export default ObjectionRequest;
