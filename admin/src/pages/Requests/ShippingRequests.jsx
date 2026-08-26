import React, { useState, useEffect } from 'react';
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
import useSyncfusionGridLocale from '../../hooks/useSyncfusionGridLocale';

const ShippingRequests = () => {
  const { t, i18n } = useTranslation(['requests', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';
  useSyncfusionGridLocale(
    i18n.resolvedLanguage
    || i18n.language,
  );
  const [shippingData, setShippingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const toolbarOptions = ['Search'];

  useEffect(() => {
    fetchShippingData();
  }, []);

  const fetchShippingData = async () => {
    try {
      setLoading(true);
      setError(null);
      const requestTypes = [
        { type: 'standard', path: '/shipping/standard/' },
        { type: 'via-agent', path: '/shipping/via-agent/' },
        { type: 'agent-admin', path: '/shipping/agent-admin/' },
      ];
      const fetchAllPages = async (path) => {
        const rows = [];
        let next = path;
        let params = { page_size: 100 };
        while (next) {
          const response = await axiosInstance.get(next, { params });
          const pageRows = Array.isArray(response.data?.results)
            ? response.data.results
            : Array.isArray(response.data)
              ? response.data
              : [];
          rows.push(...pageRows);
          next = response.data?.next || null;
          params = undefined;
        }
        return rows;
      };
      const responses = await Promise.all(
        requestTypes.map(async ({ type, path }) => {
          const rows = await fetchAllPages(path);
          return rows.map((row) => ({
            ...row,
            row_id: `${type}-${row.id}`,
            _shipping_type: type,
            user_name: row.user_name || row.agent_name,
            user_email: row.user_email || row.agent_email,
            user_phone: row.user_phone || row.agent_phone,
            request_details: {
              title: type === 'standard'
                ? t('requestsPages.shipping.types.standard', { defaultValue: 'Standard deposit' })
                : type === 'via-agent'
                  ? t('requestsPages.shipping.types.viaAgent', { defaultValue: 'Via agent' })
                  : t('requestsPages.shipping.types.agentAdmin', { defaultValue: 'Agent via admin' }),
              payment_method_title: row.payment_method_title,
              user_phone: row.user_phone || row.agent_phone,
            },
          }));
        })
      );
      setShippingData(responses.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      setError(t('requestsPages.shipping.error'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusPath = (shipping) => `/shipping/${shipping._shipping_type}/${shipping.id}/update_status/`;

  const handleApprove = async (shipping) => {
    if (actionLoading) return;
    const confirmed = window.confirm(
      t('requestsPages.shipping.alerts.approveConfirm', {
        id: shipping.id,
      })
    );
    if (!confirmed) return;

    setActionLoading(shipping.row_id);
    try {
      await axiosInstance.post(getStatusPath(shipping), {
        status: 'approved',
        admin_notes: 'Payment verified and approved',
      });

      alert(t('requestsPages.shipping.alerts.approveSuccess', { id: shipping.id }));
      await fetchShippingData();
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || t('requestsPages.shipping.alerts.approveFailed');
      alert(`${t('requestsPages.shipping.alerts.error')}: ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (shipping) => {
    if (actionLoading) return;
    const reason = prompt(t('requestsPages.shipping.alerts.rejectPrompt'));
    if (!reason) return;

    setActionLoading(shipping.row_id);
    try {
      await axiosInstance.post(getStatusPath(shipping), {
        status: 'rejected',
        admin_notes: reason,
      });

      alert(t('requestsPages.shipping.alerts.rejectSuccess', { id: shipping.id }));
      await fetchShippingData();
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || t('requestsPages.shipping.alerts.rejectFailed');
      alert(`${t('requestsPages.shipping.alerts.error')}: ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  const customerTemplate = (props) => {
    const shipping = props;
    return (
      <div className="flex items-center gap-3 text-start">
        <img
          className="rounded-full w-10 h-10 object-cover"
          src={shipping.user?.profile_image || 'https://via.placeholder.com/40x40/cccccc/666666?text=User'}
          alt={shipping.user_name}
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/40x40/cccccc/666666?text=User';
          }}
        />
        <div>
          <p className="font-semibold text-sm text-gray-800 dark:text-white">{shipping.user_name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{shipping.user_email}</p>
          {shipping.request_details?.user_phone && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{shipping.request_details.user_phone}</p>
          )}
        </div>
      </div>
    );
  };

  const getStatusConfig = (status) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    };

    const statusText = {
      pending: t('status.pending'),
      approved: t('status.completed', 'Approved'),
      rejected: t('status.rejected'),
      processing: t('status.in_progress', 'Processing'),
    };

    return {
      color: statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      text: statusText[status] || status,
    };
  };

  const statusTemplate = (props) => {
    const { status } = props;
    const config = getStatusConfig(status);

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const amountTemplate = (props) => {
    const shipping = props;
    return (
      <div className="text-center">
        <p className="font-semibold text-sm text-gray-800 dark:text-white">
          {parseFloat(shipping.amount).toLocaleString(i18n.resolvedLanguage)} {t(`currency.${shipping.currency?.toLowerCase()}`, shipping.currency?.toUpperCase())}
        </p>
        {shipping.request_details?.payment_method_title && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{shipping.request_details.payment_method_title}</p>
        )}
      </div>
    );
  };

  const actionTemplate = (props) => {
    const shipping = props;
    const isPending = shipping.status === 'pending';
    const isAdminAction = shipping._shipping_type !== 'via-agent';
    const isMutating = actionLoading === shipping.row_id;

    if (!isPending || !isAdminAction) {
      return (
        <span className="text-gray-400 text-sm capitalize">
          {!isAdminAction && isPending
            ? t('requestsPages.shipping.agentActionRequired', { defaultValue: 'Agent action required' })
            : t(`status.${shipping.status}`, shipping.status)}
        </span>
      );
    }

    return (
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          disabled={Boolean(actionLoading)}
          className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-xs disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => handleApprove(shipping)}
        >
          {isMutating ? t('common:loading', 'Loading...') : t('requestsPages.shipping.table.buttons.approve')}
        </button>
        <button
          type="button"
          disabled={Boolean(actionLoading)}
          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-xs disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => handleReject(shipping)}
        >
          {t('requestsPages.shipping.table.buttons.reject')}
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

  if (loading && shippingData.length === 0) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('requestsPages.shipping.category')} title={t('requestsPages.shipping.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-gray-700 dark:text-gray-300">{t('requestsPages.shipping.loading')}</div>
        </div>
      </div>
    );
  }

  if (error && shippingData.length === 0) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('requestsPages.shipping.category')} title={t('requestsPages.shipping.title')} />
        <div className="flex justify-center items-center h-40">
          <div className="text-lg text-red-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl text-start">
      <Header category={t('requestsPages.shipping.category')} title={t('requestsPages.shipping.title')} />

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={fetchShippingData}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm flex items-center gap-2"
          disabled={loading}
        >
          {loading ? t('common:common.buttons.updating', 'Refreshing...') : t('catalog.buttons.refreshData', 'Refresh Data')}
        </button>
      </div>

      <GridComponent
        dataSource={shippingData}
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
            field="row_id"
            headerText={t('requestsPages.shipping.table.headers.id')}
            width="80"
            textAlign="Center"
            isPrimaryKey
          />

          <ColumnDirective
            headerText={t('requestsPages.shipping.table.headers.customer')}
            width="220"
            textAlign={isArabic ? 'Right' : 'Left'}
            template={customerTemplate}
          />

          <ColumnDirective
            headerText={t('requestsPages.shipping.table.headers.amount')}
            width="120"
            textAlign="Center"
            template={amountTemplate}
          />

          <ColumnDirective
            field="request_details.title"
            headerText={t('requestsPages.shipping.table.headers.description')}
            width="180"
            textAlign="Center"
          />

          <ColumnDirective
            field="created_at"
            headerText={t('requestsPages.shipping.table.headers.requestDate')}
            width="130"
            textAlign="Center"
            template={dateTemplate}
          />

          <ColumnDirective
            field="status"
            headerText={t('requestsPages.shipping.table.headers.status')}
            width="110"
            textAlign="Center"
            template={statusTemplate}
          />

          <ColumnDirective
            headerText={t('requestsPages.shipping.table.headers.actions')}
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

export default ShippingRequests;
