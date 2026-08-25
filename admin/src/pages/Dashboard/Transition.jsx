import React, { useState, useMemo, useEffect } from 'react';
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
  Group,
} from '@syncfusion/ej2-react-grids';
import { Header } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import axiosInstance from '../../utils/axiosConfig';
import { localizeRuntimeValue } from '../../utils/runtimeLocalization';

const Transactions = () => {
  const { t, i18n } = useTranslation(['transactions', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, isAuthenticated } = useAuth();

  const [filters, setFilters] = useState({
    currency: 'All',
    status: 'All',
    type: 'All',
    startDate: '',
    endDate: '',
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const toolbarOptions = ['Search', 'Print', 'ExcelExport'];
  const transactionValue = (prefix, value, fallbackKey) => localizeRuntimeValue({
    t,
    i18n,
    value,
    namespace: 'transactions',
    prefix,
    fallback: () => t(fallbackKey),
  });

  const getWalletCurrency = (wallet) => {
    if (typeof wallet === 'object' && wallet !== null) {
      return wallet.currency || 'USD';
    }
    return 'USD';
  };

  const getTransactionDirection = (txn) => {
    if (txn.transaction_type === 'deposit') return 'Inflow';
    if (txn.transaction_type === 'transfer') return 'Outflow';
    if (txn.transaction_type === 'purchase') return 'Outflow';
    return 'Outflow';
  };

  const getSourceEntity = (txn) => {
    if (txn.user && typeof txn.user === 'object') {
      return t('table.sourceEntity.user', { name: txn.user.name || txn.user.full_name || t('table.unknown') });
    }
    if (txn.agent && typeof txn.agent === 'object') {
      return t('table.sourceEntity.agent', { name: txn.agent.name || txn.agent.full_name || t('table.unknown') });
    }
    return t('table.sourceEntity.system');
  };

  const getTargetEntity = (txn) => {
    if (txn.recipient_wallet && typeof txn.recipient_wallet === 'object') {
      const recipientUser = txn.recipient_wallet.user;
      if (recipientUser && typeof recipientUser === 'object') {
        return t('table.targetEntity.user', { name: recipientUser.name || recipientUser.full_name || t('table.unknown') });
      }
      return t('table.targetEntity.recipientWallet');
    }
    if (txn.transaction_type === 'purchase') return t('table.targetEntity.storePurchase');
    if (txn.transaction_type === 'deposit') return t('table.targetEntity.walletDeposit');
    return t('table.targetEntity.system');
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get('transactions/transactions/');
      setTransactions(response.data);
    } catch (err) {
      const errorMessage = err.response?.data?.detail
        || err.response?.data?.error
        || t('alerts.loadFailed');
      setError(errorMessage);
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailsModal(true);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTransactions();
    }
  }, [isAuthenticated]);

  const transformedTransactions = useMemo(() => transactions.map((txn) => ({
    id: txn.id,
    TransactionID: `TXN-${txn.id.toString().padStart(6, '0')}`,
    Timestamp: txn.created_at,
    TransactionType: txn.transaction_type,
    Status: txn.status,
    Amount: parseFloat(txn.amount),
    Currency: getWalletCurrency(txn.wallet),
    Direction: getTransactionDirection(txn),
    user: txn.user,
    agent: txn.agent,
    admin: txn.admin,
    wallet: txn.wallet,
    recipient_wallet: txn.recipient_wallet,
    note: txn.note,
    created_at: txn.created_at,
    updated_at: txn.updated_at,

    SourceEntityID: getSourceEntity(txn),
    TargetEntityID: getTargetEntity(txn),
    FeeAmount: 0,
  })), [transactions, t]);

  const filteredData = useMemo(() => transformedTransactions.filter((txn) => {
    if (filters.currency !== 'All' && txn.Currency !== filters.currency) return false;
    if (filters.status !== 'All' && txn.Status !== filters.status) return false;
    if (filters.type !== 'All' && txn.TransactionType !== filters.type) return false;

    if (filters.startDate && new Date(txn.Timestamp) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(txn.Timestamp) > new Date(`${filters.endDate}T23:59:59`)) return false;

    return true;
  }), [transformedTransactions, filters]);

  const stats = useMemo(() => {
    const totalTransactions = filteredData.length;
    const completedTransactions = filteredData.filter((t) => t.Status === 'approved').length;
    const pendingTransactions = filteredData.filter((t) => t.Status === 'pending').length;
    const rejectedTransactions = filteredData.filter((t) => t.Status === 'rejected').length;

    const inflowUSD = filteredData
      .filter((t) => t.Direction === 'Inflow' && t.Status === 'approved' && t.Currency === 'USD')
      .reduce((sum, t) => sum + t.Amount, 0);

    const outflowUSD = filteredData
      .filter((t) => t.Direction === 'Outflow' && t.Status === 'approved' && t.Currency === 'USD')
      .reduce((sum, t) => sum + t.Amount, 0);

    const inflowSYP = filteredData
      .filter((t) => t.Direction === 'Inflow' && t.Status === 'approved' && t.Currency === 'SYP')
      .reduce((sum, t) => sum + t.Amount, 0);

    const outflowSYP = filteredData
      .filter((t) => t.Direction === 'Outflow' && t.Status === 'approved' && t.Currency === 'SYP')
      .reduce((sum, t) => sum + t.Amount, 0);

    return {
      totalTransactions,
      completedTransactions,
      pendingTransactions,
      rejectedTransactions,
      inflowUSD,
      outflowUSD,
      inflowSYP,
      outflowSYP,
    };
  }, [filteredData]);

  const statusTemplate = (props) => {
    const statusConfig = {
      approved: { color: 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800', icon: '✅', text: t('status.approved') },
      pending: { color: 'bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800', icon: '⏳', text: t('status.pending') },
      rejected: { color: 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800', icon: '❌', text: t('status.rejected') },
    };

    const config = statusConfig[props.Status] || statusConfig.pending;

    return (
      <div className="flex items-center justify-center gap-2">
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${config.color}`}>
          {config.icon} {config.text}
        </span>
      </div>
    );
  };

  const amountTemplate = (props) => {
    const isUSD = props.Currency === 'USD';
    const isInflow = props.Direction === 'Inflow';
    const amountColor = isInflow ? 'text-green-600' : 'text-red-600';
    const symbol = isUSD ? '$' : '';
    const formattedAmount = isUSD ? props.Amount.toFixed(2) : props.Amount.toLocaleString(i18n.resolvedLanguage);
    const currencySuffix = isUSD ? '' : ` ${t(`currency.${props.Currency?.toLowerCase()}`, { defaultValue: props.Currency })}`;

    return (
      <div className={isArabic ? 'text-left' : 'text-right'}>
        <div className={`font-semibold ${amountColor}`}>
          {isInflow ? '+' : '-'}{symbol}{formattedAmount}{currencySuffix}
        </div>
        <div className="text-xs text-gray-500 capitalize">
          {transactionValue('type', props.TransactionType, 'type.other')}
        </div>
      </div>
    );
  };

  const entityTemplate = (props, field) => {
    const entity = props[field];

    let icon = '👤';
    const text = entity || t('table.unknown');

    if (field === 'SourceEntityID') {
      icon = props.agent ? '🤵' : '👤';
    } else if (field === 'TargetEntityID') {
      icon = props.TransactionType === 'purchase' ? '🛒' : '👤';
    }

    return (
      <div className="flex items-center gap-2 text-start">
        <span className="text-sm shrink-0">{icon}</span>
        <div>
          <div className="text-sm font-medium truncate max-w-[150px] text-gray-900 dark:text-gray-100" title={text}>
            {text}
          </div>
          {props.user?.name && (
            <div className="text-xs text-gray-500 dark:text-gray-400">ID: {props.user.id}</div>
          )}
        </div>
      </div>
    );
  };

  const sourceTemplate = (props) => entityTemplate(props, 'SourceEntityID');
  const targetTemplate = (props) => entityTemplate(props, 'TargetEntityID');

  const typeTemplate = (props) => {
    const typeIcons = {
      deposit: '💰',
      transfer: '🔄',
      purchase: '🛒',
    };

    return (
      <div className="flex items-center gap-2 text-start">
        <span className="text-sm shrink-0">{typeIcons[props.TransactionType] || '📊'}</span>
        <span className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">{transactionValue('type', props.TransactionType, 'type.other')}</span>
      </div>
    );
  };

  const handleApproveTransaction = async (transactionId) => {
    if (!window.confirm(t('alerts.approveConfirm'))) return;

    try {
      setActionLoading(transactionId);
      await axiosInstance.post(`transactions/approve/${transactionId}/`, {
        action: 'approve',
      });

      await fetchTransactions();
    } catch (err) {
      const errorMessage = err.response?.data?.detail
        || err.response?.data?.error
        || t('alerts.approveFailed');
      alert(t('alerts.errorPrefix', { message: errorMessage }));
      console.error('Error approving transaction:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectTransaction = async (transactionId) => {
    const reason = prompt(t('alerts.rejectPrompt'));
    if (!reason) return;

    try {
      setActionLoading(transactionId);
      await axiosInstance.post(`transactions/approve/${transactionId}/`, {
        action: 'reject',
        reason,
      });

      await fetchTransactions();
    } catch (err) {
      const errorMessage = err.response?.data?.detail
        || err.response?.data?.error
        || t('alerts.rejectFailed');
      alert(t('alerts.errorPrefix', { message: errorMessage }));
      console.error('Error rejecting transaction:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const actionsTemplate = (props) => (
    <div className="flex gap-2 justify-center">
      <button
        type="button"
        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-xs font-medium flex items-center gap-1 disabled:opacity-50"
        onClick={() => handleViewDetails(props)}
        title={t('table.tooltips.details')}
        disabled={actionLoading}
      >
        👁️ {t('table.buttons.details')}
      </button>
      {props.Status === 'pending' && user?.role === 'admin' && (
        <>
          <button
            type="button"
            className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-xs font-medium flex items-center gap-1 disabled:opacity-50"
            onClick={() => handleApproveTransaction(props.id)}
            title={t('table.tooltips.approve')}
            disabled={actionLoading === props.id}
          >
            {actionLoading === props.id ? '⏳' : '✅'} {t('table.buttons.approve')}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-xs font-medium flex items-center gap-1 disabled:opacity-50"
            onClick={() => handleRejectTransaction(props.id)}
            title={t('table.tooltips.reject')}
            disabled={actionLoading === props.id}
          >
            {actionLoading === props.id ? '⏳' : '❌'} {t('table.buttons.reject')}
          </button>
        </>
      )}
    </div>
  );

  const clearFilters = () => {
    setFilters({
      currency: 'All',
      status: 'All',
      type: 'All',
      startDate: '',
      endDate: '',
    });
  };

  const handleExport = () => {
    const headers = [
      t('table.headers.id'),
      t('table.headers.dateTime'),
      t('table.headers.type'),
      t('table.headers.amount'),
      t('table.headers.currency'),
      t('table.headers.status'),
      t('table.headers.source')
    ];
    const csvData = filteredData.map((txn) => [
      txn.TransactionID,
      new Date(txn.Timestamp).toLocaleString(i18n.resolvedLanguage),
      t(`type.${txn.TransactionType?.toLowerCase()}`),
      txn.Amount,
      txn.Currency,
      t(`status.${txn.Status}`),
      txn.SourceEntityID,
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('category')} title={t('title')} />
        <div className="flex justify-center items-center h-64">
          <div className="text-xl text-gray-700 dark:text-gray-300">{t('common:common.loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('category')} title={t('title')} />
        <div className="flex flex-col justify-center items-center h-64">
          <div className="text-red-500 text-xl mb-4">{t('common:common.error')}: {error}</div>
          <button
            type="button"
            onClick={fetchTransactions}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            {t('common:common.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
      <Header
        category={t('category')}
        title={t('title')}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6 text-start">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 font-semibold text-sm">{t('stats.total')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalTransactions}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {t('stats.totalDesc', { count: stats.completedTransactions })}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200 font-semibold text-sm">{t('stats.inflowUSD')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${stats.inflowUSD.toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('stats.approvedDesc')}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 font-semibold text-sm">{t('stats.outflowUSD')}</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            ${stats.outflowUSD.toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t('stats.approvedDesc')}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-purple-800 dark:text-purple-200 font-semibold text-sm">{t('stats.inflowSYP')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {stats.inflowSYP.toLocaleString(i18n.resolvedLanguage)} {t('currency.syp')}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{t('stats.approvedDesc')}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <p className="text-orange-800 dark:text-orange-200 font-semibold text-sm">{t('stats.outflowSYP')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {stats.outflowSYP.toLocaleString(i18n.resolvedLanguage)} {t('currency.syp')}
          </p>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">{t('stats.approvedDesc')}</p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
          <p className="text-indigo-800 dark:text-indigo-200 font-semibold text-sm">{t('stats.pending')}</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.pendingTransactions}</p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">{t('stats.pendingDesc')}</p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 text-start">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">{t('filterSection.title')}</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-medium flex items-center gap-2"
            >
              📊 {t('filterSection.buttons.export')}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition text-sm font-medium flex items-center gap-2"
            >
              🗑️ {t('filterSection.buttons.clear')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {filters.currency !== 'All' && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full">
              {t('filterSection.badges.currency', { currency: t(`currency.${filters.currency?.toLowerCase()}`) })}
            </span>
          )}
          {filters.status !== 'All' && (
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full">
              {t('filterSection.badges.status', { status: t(`status.${filters.status}`) })}
            </span>
          )}
          {filters.type !== 'All' && (
            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full">
              {t('filterSection.badges.type', { type: t(`type.${filters.type?.toLowerCase()}`) })}
            </span>
          )}
          {filters.startDate && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-xs rounded-full">
              {t('filterSection.badges.from', { date: filters.startDate })}
            </span>
          )}
          {filters.endDate && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-xs rounded-full">
              {t('filterSection.badges.to', { date: filters.endDate })}
            </span>
          )}
        </div>
      </div>

      <GridComponent
        dataSource={filteredData}
        allowPaging
        allowSorting
        allowFiltering
        allowGrouping
        toolbar={toolbarOptions}
        pageSettings={{ pageSize: 15 }}
        height={500}
        enableHover
        enableRtl={isArabic}
        locale={isArabic ? 'ar' : 'en-US'}
      >
        <ColumnsDirective>
          <ColumnDirective
            field="TransactionID"
            headerText={t('table.headers.id')}
            width="120"
            textAlign="Center"
          />
          <ColumnDirective
            field="Timestamp"
            headerText={t('table.headers.dateTime')}
            width="180"
            format={{ type: 'dateTime', format: 'dd/MM/yyyy HH:mm' }}
            textAlign={isArabic ? 'Right' : 'Left'}
          />
          <ColumnDirective
            headerText={t('table.headers.type')}
            width="160"
            template={typeTemplate}
            textAlign={isArabic ? 'Right' : 'Left'}
          />
          <ColumnDirective
            headerText={t('table.headers.source')}
            width="180"
            template={sourceTemplate}
            textAlign={isArabic ? 'Right' : 'Left'}
          />
          <ColumnDirective
            headerText={t('table.headers.destination')}
            width="180"
            template={targetTemplate}
            textAlign={isArabic ? 'Right' : 'Left'}
          />
          <ColumnDirective
            headerText={t('table.headers.amount')}
            width="140"
            template={amountTemplate}
            textAlign={isArabic ? 'Left' : 'Right'}
          />
          <ColumnDirective
            field="Currency"
            headerText={t('table.headers.currency')}
            width="100"
            textAlign="Center"
          />
          <ColumnDirective
            headerText={t('table.headers.status')}
            width="140"
            textAlign="Center"
            template={statusTemplate}
          />
          <ColumnDirective
            headerText={t('table.headers.actions')}
            width="200"
            textAlign="Center"
            template={actionsTemplate}
          />
        </ColumnsDirective>
        <Inject services={[Page, Toolbar, Sort, Filter, Group]} />
      </GridComponent>

      {showDetailsModal && selectedTransaction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white dark:bg-[#42464D] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto text-start border dark:border-gray-700">
            <div className="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('modal.title')}</h2>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('modal.sections.basic')}</h3>
                <div className="space-y-2 text-sm text-gray-950 dark:text-gray-150">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('modal.labels.id')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedTransaction.TransactionID}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('modal.labels.type')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {transactionValue('type', selectedTransaction.TransactionType, 'type.other')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('modal.labels.status')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {transactionValue('status', selectedTransaction.Status, 'status.unknown')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('modal.labels.dateTime')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(selectedTransaction.Timestamp).toLocaleString(i18n.resolvedLanguage)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('modal.sections.financial')}</h3>
                <div className="space-y-2 text-sm text-gray-950 dark:text-gray-150">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('modal.labels.amount')}</span>
                    <span className={`font-bold ${
                      selectedTransaction.Direction === 'Inflow' ? 'text-green-600' : 'text-red-600'
                    }`}
                    >
                      {selectedTransaction.Direction === 'Inflow' ? '+' : '-'}
                      {selectedTransaction.Currency === 'USD' ? '$' : ''}
                      {selectedTransaction.Amount.toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {selectedTransaction.Currency === 'USD' ? '' : ` ${t(`currency.${selectedTransaction.Currency?.toLowerCase()}`)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('modal.labels.currency')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{t(`currency.${selectedTransaction.Currency?.toLowerCase()}`, { defaultValue: selectedTransaction.Currency })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('modal.labels.direction')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {t(`direction.${selectedTransaction.Direction?.toLowerCase()}`, { defaultValue: selectedTransaction.Direction })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-sm text-gray-950 dark:text-gray-150">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('modal.sections.parties')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">{t('modal.sections.source')}</h4>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedTransaction.SourceEntityID}</p>
                  {selectedTransaction.user && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('modal.labels.userId')} {selectedTransaction.user.id}</p>
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">{t('modal.sections.destination')}</h4>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedTransaction.TargetEntityID}</p>
                </div>
              </div>
            </div>

            {selectedTransaction.note && (
              <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg mt-4 border border-yellow-200 dark:border-yellow-900">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">{t('modal.sections.notes')}</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">{selectedTransaction.note}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6 border-t dark:border-gray-700 pt-4">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-medium"
              >
                {t('modal.buttons.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
