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

const Pending = () => {
  const { t, i18n } = useTranslation(['requests', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [pendingData, setPendingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    shipping: 0,
    verification: 0,
    refund: 0,
    other: 0,
  });
  const toolbarOptions = ['Search'];

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/all_requests/admin/requests/?status=pending');
      const requests = response.data;
      setPendingData(requests);
      calculateStats(requests);
    } catch (err) {
      setError(t('requestsPages.pending.error'));
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (requests) => {
    const newStats = {
      total: requests.length,
      shipping: requests.filter((item) => item.request_type === 'payment').length,
      verification: requests.filter((item) => item.request_type === 'support').length,
      refund: requests.filter((item) => item.request_type === 'refund').length,
      other: requests.filter((item) => item.request_type === 'other').length,
    };
    setStats(newStats);
  };

  const handleApprove = async (requestId, customerName) => {
    if (window.confirm(t('requestsPages.pending.alerts.approveConfirm', { id: requestId, customer: customerName }))) {
      try {
        await axiosInstance.post(`/all_requests/admin/requests/${requestId}/update_status/`, {
          status: 'completed',
          admin_notes: 'Request approved',
        });

        alert(t('requestsPages.pending.alerts.approveSuccess', { id: requestId, customer: customerName }));
        fetchPendingRequests();
      } catch (err) {
        const errorMessage = err.response?.data?.message || t('requestsPages.pending.alerts.approveFailed');
        alert(`${t('requestsPages.pending.alerts.error')}: ${errorMessage}`);
      }
    }
  };

  const handleReject = async (requestId, customerName) => {
    const reason = prompt(t('requestsPages.pending.alerts.rejectPrompt', { customer: customerName }));
    if (!reason) return;

    try {
      await axiosInstance.post(`/all_requests/admin/requests/${requestId}/update_status/`, {
        status: 'rejected',
        admin_notes: reason,
        rejection_reason: reason,
      });

      alert(t('requestsPages.pending.alerts.rejectSuccess', { id: requestId, reason }));
      fetchPendingRequests();
    } catch (err) {
      const errorMessage = err.response?.data?.message || t('requestsPages.pending.alerts.rejectFailed');
      alert(`${t('requestsPages.pending.alerts.error')}: ${errorMessage}`);
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

  const statusTemplate = () => (
    <span className="px-3 py-1 rounded-full text-white text-xs font-semibold bg-yellow-500 animate-pulse flex items-center justify-center gap-1">
      ⏳ {t('status.pending')}
    </span>
  );

  const actionTemplate = (props) => {
    const request = props;
    return (
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-xs font-medium"
          onClick={() => handleApprove(request.id, request.user_name)}
        >
          ✓ {t('requestsPages.pending.table.buttons.approve')}
        </button>
        <button
          type="button"
          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-xs font-medium"
          onClick={() => handleReject(request.id, request.user_name)}
        >
          ✗ {t('requestsPages.pending.table.buttons.reject')}
        </button>
      </div>
    );
  };

  const getRequestTypeConfig = (requestType) => {
    const requestTypeMap = {
      payment: { label: t('type.payment'), color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      support: { label: t('type.support'), color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
      refund: { label: t('type.refund'), color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
      other: { label: t('type.other'), color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    };
    return requestTypeMap[requestType] || { label: requestType, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
  };

  const requestTypeTemplate = (props) => {
    const request = props;
    const typeInfo = getRequestTypeConfig(request.request_type);

    return (
      <div className="text-center">
        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${typeInfo.color}`}>
          {typeInfo.label}
        </span>
        {request.title && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate max-w-[120px] mx-auto">
            {request.title}
          </p>
        )}
      </div>
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
        {request.payment_method_title && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{request.payment_method_title}</p>
        )}
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

  const descriptionTemplate = (props) => {
    const request = props;
    return (
      <div className="text-center">
        <p className="text-sm font-medium text-gray-800 dark:text-white truncate max-w-[150px] mx-auto" title={request.title}>
          {request.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px] mx-auto" title={request.description}>
          {request.description}
        </p>
      </div>
    );
  };

  if (loading && pendingData.length === 0) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('catalog.category')} title={t('requestsPages.pending.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-gray-700 dark:text-gray-300">{t('requestsPages.pending.loading')}</div>
        </div>
      </div>
    );
  }

  if (error && pendingData.length === 0) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('catalog.category')} title={t('requestsPages.pending.title')} />
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
        title={t('requestsPages.pending.title')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
          <p className="text-yellow-800 dark:text-yellow-300 font-semibold">{t('requestsPages.pending.stats.total')}</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.total}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800">
          <p className="text-blue-800 dark:text-blue-300 font-semibold">{t('requestsPages.pending.stats.shipping')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.shipping}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 dark:bg-purple-900/20 dark:border-purple-800">
          <p className="text-purple-800 dark:text-purple-300 font-semibold">{t('requestsPages.pending.stats.verification')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.verification}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 dark:bg-orange-900/20 dark:border-orange-800">
          <p className="text-orange-800 dark:text-orange-300 font-semibold">{t('requestsPages.pending.stats.refund')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.refund}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 dark:bg-gray-800 dark:border-gray-700">
          <p className="text-gray-800 dark:text-gray-300 font-semibold">{t('requestsPages.pending.stats.other')}</p>
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.other}</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={fetchPendingRequests}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm flex items-center gap-2"
          disabled={loading}
        >
          {loading ? t('common:common.buttons.updating', 'Refreshing...') : t('catalog.buttons.refreshData', 'Refresh Data')}
        </button>
      </div>

      <GridComponent
        dataSource={pendingData}
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
            headerText={t('requestsPages.pending.table.headers.id')}
            width="80"
            textAlign="Center"
            isPrimaryKey
          />

          <ColumnDirective
            headerText={t('requestsPages.pending.table.headers.customer')}
            width="220"
            textAlign={isArabic ? 'Right' : 'Left'}
            template={customerTemplate}
          />

          <ColumnDirective
            headerText={t('catalog.table.headers.type')}
            width="140"
            textAlign="Center"
            template={requestTypeTemplate}
          />

          <ColumnDirective
            headerText={t('requestsPages.pending.table.headers.description')}
            width="180"
            textAlign="Center"
            template={descriptionTemplate}
          />

          <ColumnDirective
            headerText={t('requestsPages.pending.table.headers.amount')}
            width="120"
            textAlign="Center"
            template={amountTemplate}
          />

          <ColumnDirective
            field="created_at"
            headerText={t('requestsPages.pending.table.headers.requestDate')}
            width="130"
            textAlign="Center"
            template={dateTemplate}
          />

          <ColumnDirective
            headerText={t('catalog.table.headers.status')}
            width="100"
            textAlign="Center"
            template={statusTemplate}
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

export default Pending;
