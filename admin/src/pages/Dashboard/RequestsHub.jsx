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
import RequestReviewModal from '../../components/RequestReviewModal';
import axiosInstance from '../../utils/axiosConfig';

const RequestsHub = () => {
  const { t, i18n } = useTranslation(['requests', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [requestsData, setRequestsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    shipping: 0,
    in_progress: 0,
    objection: 0,
    completed: 0,
    rejected: 0,
  });

  const toolbarOptions = useMemo(() => [
    'Search',
    { text: t('catalog.buttons.refreshData', 'Refresh'), id: 'Refresh', prefixIcon: 'e-refresh' }
  ], [t]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const requestsResponse = await axiosInstance.get('/all_requests/admin/requests/');
      setRequestsData(requestsResponse.data);

      const statsResponse = await axiosInstance.get('/all_requests/admin/requests/stats/');
      setStats(statsResponse.data);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(t('catalog.alerts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredRequests = requestsData.filter((request) => {
    const statusMatch = filterStatus === 'All' || request.status === filterStatus;
    const typeMatch = filterType === 'All' || request.request_type === filterType;
    return statusMatch && typeMatch;
  });

  const handleReviewDetails = (request) => {
    setSelectedRequest(request);
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
    fetchRequests();
  };

  const handleToolbarClick = (args) => {
    if (args.item.id.includes('Refresh')) {
      fetchRequests();
    }
  };

  const handleUpdateStatus = async (requestId, newStatus, adminNotes = '', rejectionReason = '') => {
    try {
      await axiosInstance.post(`/all_requests/admin/requests/${requestId}/update_status/`, {
        status: newStatus,
        admin_notes: adminNotes,
        rejection_reason: rejectionReason,
      });

      await fetchRequests();
      return true;
    } catch (err) {
      console.error('Error updating request status:', err);
      alert(t('catalog.alerts.updateFailed'));
      return false;
    }
  };

  const handleAddComment = async (requestId, comment, isAdminNote = false) => {
    try {
      await axiosInstance.post(`/all_requests/admin/requests/${requestId}/add_comment/`, {
        comment,
        is_admin_note: isAdminNote,
      });

      await fetchRequests();
      return true;
    } catch (err) {
      console.error('Error adding comment:', err);
      alert(t('catalog.alerts.commentFailed'));
      return false;
    }
  };

  const statusCounts = {
    All: requestsData.length,
    pending: requestsData.filter((r) => r.status === 'pending').length,
    shipping: requestsData.filter((r) => r.status === 'shipping').length,
    in_progress: requestsData.filter((r) => r.status === 'in_progress').length,
    objection: requestsData.filter((r) => r.status === 'objection').length,
    completed: requestsData.filter((r) => r.status === 'completed').length,
    rejected: requestsData.filter((r) => r.status === 'rejected').length,
  };

  const typeCounts = {
    All: requestsData.length,
    payment: requestsData.filter((r) => r.request_type === 'payment').length,
    support: requestsData.filter((r) => r.request_type === 'support').length,
    refund: requestsData.filter((r) => r.request_type === 'refund').length,
    other: requestsData.filter((r) => r.request_type === 'other').length,
  };

  const requestTypeTemplate = (props) => {
    const request = props;
    const typeConfig = {
      payment: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: '💳', label: t('type.payment') },
      support: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: '🛟', label: t('type.support') },
      refund: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: '↩️', label: t('type.refund') },
      other: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: '📋', label: t('type.other') },
    };

    const config = typeConfig[request.request_type] || { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: '📋', label: request.request_type };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color} flex items-center justify-center gap-1 w-fit mx-auto`}>
        {config.icon} {config.label}
      </span>
    );
  };

  const statusTemplate = (props) => {
    const request = props;
    const statusConfig = {
      pending: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: '⏳', label: t('status.pending') },
      shipping: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: '🚚', label: t('status.shipping') },
      in_progress: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: '🔍', label: t('status.in_progress') },
      objection: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: '⚠️', label: t('status.objection') },
      completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: '✅', label: t('status.completed') },
      rejected: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: '❌', label: t('status.rejected') },
    };

    const config = statusConfig[request.status] || { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: '❓', label: request.status };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color} flex items-center justify-center gap-1 w-fit mx-auto`}>
        {config.icon} {config.label}
      </span>
    );
  };

  const userTemplate = (props) => {
    const request = props;
    return (
      <div className="flex items-center gap-3 text-start">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
          {request.user_name ? request.user_name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{request.user_name || t('catalog.table.unknownUser')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{request.user_email || t('catalog.table.noEmail')}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">ID: {request.user}</p>
        </div>
      </div>
    );
  };

  const amountTemplate = (props) => {
    const request = props;
    if (!request.amount) return <span className="text-gray-400">-</span>;

    const formattedAmount = parseFloat(request.amount).toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (
      <span className="font-semibold text-gray-900 dark:text-gray-100">
        {formattedAmount} {t(`currency.${request.currency?.toLowerCase()}`, { defaultValue: request.currency?.toUpperCase() || '' })}
      </span>
    );
  };

  const dateTemplate = (props) => {
    const request = props;
    return (
      <span className="text-sm text-gray-900 dark:text-gray-100">
        {new Date(request.created_at).toLocaleDateString(i18n.resolvedLanguage)}
      </span>
    );
  };

  const actionsTemplate = (props) => {
    const request = props;
    return (
      <button
        type="button"
        onClick={() => handleReviewDetails(request)}
        className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-xs font-medium"
      >
        {t('catalog.table.review')}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('catalog.category')} title={t('catalog.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-gray-700 dark:text-gray-200">{t('catalog.table.loadingText')}</div>
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
            onClick={fetchRequests}
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
      <Header category={t('catalog.category')} title={t('catalog.title')} />

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={fetchRequests}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm flex items-center gap-2"
        >
          {t('catalog.buttons.refreshData')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-4 text-start">
          <p className="text-blue-800 dark:text-blue-200 font-semibold">{t('catalog.stats.total')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 rounded-lg p-4 text-start">
          <p className="text-orange-800 dark:text-orange-200 font-semibold">{t('catalog.stats.pending')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.pending}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 rounded-lg p-4 text-start">
          <p className="text-yellow-800 dark:text-yellow-200 font-semibold">{t('catalog.stats.inProgress')}</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.in_progress}</p>
        </div>
        <div className="bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded-lg p-4 text-start">
          <p className="text-red-800 dark:text-red-200 font-semibold">{t('catalog.stats.rejected')}</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-start">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('catalog.filters.status')}</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white"
          >
            {Object.entries(statusCounts).map(([status, count]) => (
              <option key={status} value={status}>
                {status === 'All' ? t('catalog.filters.allStatus') : t(`status.${status}`)} ({count})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('catalog.filters.type')}</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white"
          >
            {Object.entries(typeCounts).map(([type, count]) => (
              <option key={type} value={type}>
                {type === 'All' ? t('catalog.filters.allTypes') : t(`type.${type}`)} ({count})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => { setFilterStatus('All'); setFilterType('All'); }}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm transition"
          >
            {t('catalog.filters.clear')}
          </button>
        </div>
      </div>

      {filteredRequests.length > 0 ? (
        <GridComponent
          dataSource={filteredRequests}
          allowPaging
          allowSorting
          allowFiltering
          pageSettings={{ pageSize: 10 }}
          toolbar={toolbarOptions}
          height={400}
          enableHover={false}
          toolbarClick={handleToolbarClick}
          enableRtl={isArabic}
          locale={isArabic ? 'ar' : 'en-US'}
        >
          <ColumnsDirective>
            <ColumnDirective
              field="id"
              headerText={t('catalog.table.headers.id')}
              width="120"
              textAlign="Center"
              isPrimaryKey
            />

            <ColumnDirective
              headerText={t('catalog.table.headers.user')}
              width="200"
              textAlign={isArabic ? 'Right' : 'Left'}
              template={userTemplate}
            />

            <ColumnDirective
              headerText={t('catalog.table.headers.type')}
              width="150"
              textAlign="Center"
              template={requestTypeTemplate}
            />

            <ColumnDirective
              headerText={t('catalog.table.headers.status')}
              width="130"
              textAlign="Center"
              template={statusTemplate}
            />

            <ColumnDirective
              headerText={t('catalog.table.headers.title')}
              field="title"
              width="180"
              textAlign={isArabic ? 'Right' : 'Left'}
            />

            <ColumnDirective
              headerText={t('catalog.table.headers.amount')}
              width="120"
              textAlign="Center"
              template={amountTemplate}
            />

            <ColumnDirective
              headerText={t('catalog.table.headers.submitted')}
              width="120"
              textAlign="Center"
              template={dateTemplate}
            />

            <ColumnDirective
              headerText={t('catalog.table.headers.actions')}
              width="100"
              textAlign="Center"
              template={actionsTemplate}
            />
          </ColumnsDirective>
          <Inject services={[Page, Toolbar, Sort, Filter]} />
        </GridComponent>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-gray-500 dark:text-gray-300 text-lg">{t('catalog.table.emptyTitle')}</p>
          <p className="text-gray-400 dark:text-gray-400 mt-2">
            {requestsData.length === 0
              ? t('catalog.table.emptyNoRequests')
              : t('catalog.table.emptyNoMatch')}
          </p>
        </div>
      )}

      {selectedRequest && (
        <RequestReviewModal
          request={selectedRequest}
          onClose={handleCloseModal}
          onUpdateStatus={handleUpdateStatus}
          onAddComment={handleAddComment}
        />
      )}
    </div>
  );
};

export default RequestsHub;
