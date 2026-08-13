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
  Group
} from '@syncfusion/ej2-react-grids';
import { Header } from '.';
import { useAuth } from '../contexts/AuthContext';
import axiosInstance from '../utils/axiosConfig';

const FullPayments = () => {
  const { t, i18n } = useTranslation(['payments', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const { user } = useAuth();

  const [filters, setFilters] = useState({
    status: 'All',
    currency: 'All',
    dateRange: 'All',
    startDate: '',
    endDate: '',
    searchQuery: ''
  });

  const [stats, setStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    successPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    averageAmount: 0
  });

  const toolbarOptions = ['Search', 'Print', 'ExcelExport'];

  useEffect(() => {
    fetchAllPayments();
  }, []);

  const fetchAllPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get('payment/payment/');
      const paymentsData = Array.isArray(response.data?.results)
        ? response.data.results
        : Array.isArray(response.data)
          ? response.data
          : [];
      setPayments(paymentsData);
      calculateStats(paymentsData);
    } catch (fetchError) {
      const errorMessage = fetchError.response?.data?.detail
        || fetchError.response?.data?.error
        || t('history.error', { defaultValue: 'Failed to fetch payments' });
      setError(errorMessage);
      console.error('Error fetching payments:', fetchError);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (paymentsData) => {
    const totalPayments = paymentsData.length;
    const successPayments = paymentsData.filter((p) => p.status === 'success').length;
    const pendingPayments = paymentsData.filter((p) => p.status === 'pending' || p.status === 'processing').length;
    const failedPayments = paymentsData.filter((p) => p.status === 'failed' || p.status === 'cancelled').length;

    const totalAmount = paymentsData
      .filter((p) => p.status === 'success')
      .reduce((sum, p) => sum + (Number(p.final_price) || 0), 0);

    const averageAmount = successPayments > 0 ? totalAmount / successPayments : 0;

    setStats({
      totalPayments,
      totalAmount,
      successPayments,
      pendingPayments,
      failedPayments,
      averageAmount
    });
  };

  const filteredData = useMemo(() => {
    let filtered = payments;

    if (filters.status !== 'All') {
      filtered = filtered.filter((payment) => payment.status === filters.status);
    }

    if (filters.currency !== 'All') {
      filtered = filtered.filter((payment) => payment.currency === filters.currency);
    }

    if (filters.startDate) {
      filtered = filtered.filter((payment) => new Date(payment.created_at) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      filtered = filtered.filter((payment) => new Date(payment.created_at) <= new Date(`${filters.endDate}T23:59:59`));
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter((payment) => 
        payment.user_name?.toLowerCase().includes(query)
        || payment.store_product_name?.toLowerCase().includes(query)
        || payment.external_transaction_id?.toLowerCase().includes(query)
        || payment.id.toString().includes(query)
      );
    }

    return filtered.map((payment) => ({
      id: payment.id,
      PaymentID: `PAY-${payment.id.toString().padStart(6, '0')}`,
      UserName: payment.user_name || t('history.table.userName', { id: payment.user }),
      ProductName: payment.store_product_name || t('history.table.productName'),
      BasePrice: Number(payment.base_price) || 0,
      FinalPrice: Number(payment.final_price) || 0,
      ProfitPercentage: Number(payment.profit_percentage) || 0,
      ProfitAmount: Number(payment.profit_amount) || 0,
      Currency: payment.currency,
      Status: payment.status,
      ExternalID: payment.external_transaction_id,
      CreatedAt: payment.created_at,
      ProcessedAt: payment.processed_at,
      UserInputs: payment.user_inputs,
      ErrorMessage: payment.error_message,
      IsRefundable: Boolean(payment.is_refundable)
    }));
  }, [payments, filters, t]);

  const statusTemplate = (props) => {
    const statusConfig = {
      success: { color: 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800', icon: '✅', text: t('status.success') },
      pending: { color: 'bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800', icon: '⏳', text: t('status.pending') },
      processing: { color: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800', icon: '⚙️', text: t('status.processing') },
      failed: { color: 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800', icon: '❌', text: t('status.failed') },
      cancelled: { color: 'bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600', icon: '🚫', text: t('status.cancelled') }
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
    const symbol = isUSD ? '$' : '';
    const finalAmount = isUSD ? props.FinalPrice.toFixed(2) : props.FinalPrice.toLocaleString(i18n.resolvedLanguage);
    const baseAmount = isUSD ? props.BasePrice.toFixed(2) : props.BasePrice.toLocaleString(i18n.resolvedLanguage);
    const currencySuffix = isUSD ? '' : ` ${t(`currency.${props.Currency?.toLowerCase()}`, { defaultValue: props.Currency })}`;

    return (
      <div className={isArabic ? 'text-left' : 'text-right'}>
        <div className="font-semibold text-gray-800 dark:text-gray-200">
          {symbol}{finalAmount}{currencySuffix}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {t('history.table.baseAmount', { symbol, amount: baseAmount + currencySuffix })}
        </div>
        {props.ProfitPercentage > 0 && (
          <div className="text-xs text-green-600 dark:text-green-400">
            {t('history.table.profitPercent', { percent: props.ProfitPercentage })}
          </div>
        )}
      </div>
    );
  };

  const profitTemplate = (props) => {
    const isUSD = props.Currency === 'USD';
    const symbol = isUSD ? '$' : '';
    const profitAmount = isUSD ? props.ProfitAmount.toFixed(2) : props.ProfitAmount.toLocaleString(i18n.resolvedLanguage);
    const currencySuffix = isUSD ? '' : ` ${t(`currency.${props.Currency?.toLowerCase()}`, { defaultValue: props.Currency })}`;

    return (
      <div className={isArabic ? 'text-left' : 'text-right'}>
        <div className={`font-semibold ${props.ProfitAmount > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {symbol}{profitAmount}{currencySuffix}
        </div>
        <div className="text-xs text-gray-500">
          {props.ProfitPercentage}%
        </div>
      </div>
    );
  };

  const dateTemplate = (props) => {
    const date = new Date(props.CreatedAt);
    return (
      <div className="text-center">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {date.toLocaleDateString(i18n.resolvedLanguage)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {date.toLocaleTimeString(i18n.resolvedLanguage, { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  };

  const userTemplate = (props) => {
    const initials = props.UserName?.split(' ').map((n) => n[0]).join('').substring(0, 2) || 'US';
    
    return (
      <div className="flex items-center gap-2 text-start">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
          {initials}
        </div>
        <div>
          <div className="text-sm font-medium truncate max-w-[120px] text-gray-900 dark:text-gray-100">
            {props.UserName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            ID: {props.id}
          </div>
        </div>
      </div>
    );
  };

  const actionsTemplate = (props) => (
    <div className="flex gap-2 justify-center">
      <button
        type="button"
        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-xs font-medium flex items-center gap-1"
        onClick={() => handleViewDetails(props)}
        title={t('history.table.tooltips.details')}
      >
        👁️ {t('history.table.buttons.details')}
      </button>
      {(props.Status === 'pending' || props.Status === 'processing') && user?.role === 'admin' && (
        <button
        type="button"
        disabled={Boolean(actionLoading)}
        className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-xs font-medium flex items-center gap-1 disabled:opacity-50"
          onClick={() => handleProcessPayment(props.id, props.Status)}
          title={t('history.table.tooltips.process')}
        >
          ⚙️ {t('history.table.buttons.process')}
        </button>
      )}
      {props.Status === 'success' && props.IsRefundable && user?.role === 'admin' && (
        <button
        type="button"
        disabled={Boolean(actionLoading)}
        className="px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-xs font-medium disabled:opacity-50"
          onClick={() => handleRefundPayment(props.id)}
        >
          {t('history.table.buttons.refund', { defaultValue: 'Refund' })}
        </button>
      )}
    </div>
  );

  const handleViewDetails = (payment) => {
    const amountDisplay = payment.Currency === 'USD' 
      ? `$${payment.FinalPrice.toFixed(2)}` 
      : `${payment.FinalPrice.toLocaleString()} ${t(`currency.${payment.Currency?.toLowerCase()}`, { defaultValue: payment.Currency })}`;
    
    alert(t('history.alerts.detailsMessage', {
      id: payment.PaymentID,
      user: payment.UserName,
      product: payment.ProductName,
      amount: amountDisplay,
      status: t(`status.${payment.Status}`)
    }));
  };

  const handleProcessPayment = async (paymentId, currentStatus) => {
    if (actionLoading) return;
    const nextStatus = currentStatus === 'pending' ? 'processing' : 'success';
    if (!window.confirm(t('history.alerts.statusConfirm', {
      id: paymentId,
      current: t(`status.${currentStatus}`, { defaultValue: currentStatus }),
      next: t(`status.${nextStatus}`, { defaultValue: nextStatus }),
    }))) return;
    try {
      setActionLoading({ paymentId, action: 'status' });
      await axiosInstance.post(`payment/payment/${paymentId}/update_status/`, { status: nextStatus });
      await fetchAllPayments();
      alert(t('history.alerts.statusSuccess', { defaultValue: 'Payment status updated.' }));
    } catch (updateError) {
      alert(updateError.response?.data?.error || t('history.error', { defaultValue: 'Failed to update payment' }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefundPayment = async (paymentId) => {
    if (actionLoading) return;
    if (!window.confirm(t('history.alerts.refundConfirm', { defaultValue: 'Refund this payment?' }))) return;
    try {
      setActionLoading({ paymentId, action: 'refund' });
      await axiosInstance.post(`payment/payment/${paymentId}/refund/`, {});
      await fetchAllPayments();
      alert(t('history.alerts.refundSuccess', { defaultValue: 'Payment refunded successfully.' }));
    } catch (refundError) {
      alert(refundError.response?.data?.error || t('history.error', { defaultValue: 'Failed to refund payment' }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = () => {
    const headers = [
      t('history.table.headers.id'),
      t('history.table.headers.user'),
      t('history.table.headers.product'),
      `${t('history.table.headers.amount')} (Base)`,
      `${t('history.table.headers.amount')} (Final)`,
      `${t('history.table.headers.profit')} (%)`,
      t('history.table.headers.currency'),
      t('history.table.headers.status'),
      t('history.table.headers.date')
    ];
    
    const csvData = filteredData.map((payment) => [
      payment.PaymentID,
      payment.UserName,
      payment.ProductName,
      payment.BasePrice,
      payment.FinalPrice,
      payment.ProfitPercentage,
      payment.Currency,
      t(`status.${payment.Status}`),
      new Date(payment.CreatedAt).toLocaleString(i18n.resolvedLanguage)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map((row) => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilters({
      status: 'All',
      currency: 'All',
      dateRange: 'All',
      startDate: '',
      endDate: '',
      searchQuery: ''
    });
  };

  const refreshData = () => {
    fetchAllPayments();
  };

  if (loading) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('history.category')} title={t('history.title')} />
        <div className="flex justify-center items-center h-64">
          <div className="text-xl text-gray-700 dark:text-gray-300">{t('common:loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
        <Header category={t('history.category')} title={t('history.title')} />
        <div className="flex flex-col justify-center items-center h-64">
          <div className="text-red-500 text-xl mb-4">{t('common:error')}: {error}</div>
          <button
            type="button"
            onClick={refreshData}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            {t('common:tryAgain', 'Try Again')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="m-2 md:m-10 mt-24 p-2 md:p-10 bg-white dark:bg-secondary-dark-bg rounded-3xl">
      <Header
        category={t('history.category')}
        title={t('history.title')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-start">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 font-semibold text-sm">{t('history.stats.total')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalPayments}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {t('history.stats.totalDesc', { count: stats.successPayments })}
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200 font-semibold text-sm">{t('history.stats.revenue')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${stats.totalAmount.toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('history.stats.revenueDesc')}</p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 font-semibold text-sm">{t('history.stats.pending')}</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pendingPayments}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">{t('history.stats.pendingDesc')}</p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-purple-800 dark:text-purple-200 font-semibold text-sm">{t('history.stats.average')}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            ${stats.averageAmount.toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{t('history.stats.averageDesc')}</p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 text-start">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">{t('history.filterSection.title')}</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-medium flex items-center gap-2"
            >
              📊 {t('history.filterSection.buttons.export')}
            </button>
            <button
              type="button"
              onClick={refreshData}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium flex items-center gap-2"
            >
              🔄 {t('history.filterSection.buttons.refresh')}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition text-sm font-medium flex items-center gap-2"
            >
              🗑️ {t('history.filterSection.buttons.clear')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('history.filterSection.labels.status')}</label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="All">{t('history.filterSection.options.allStatuses')}</option>
              <option value="success">{t('status.success')}</option>
              <option value="pending">{t('status.pending')}</option>
              <option value="processing">{t('status.processing')}</option>
              <option value="failed">{t('status.failed')}</option>
              <option value="cancelled">{t('status.cancelled')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('history.filterSection.labels.currency')}</label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={filters.currency}
              onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
            >
              <option value="All">{t('history.filterSection.options.allCurrencies')}</option>
              <option value="USD">{t('currency.usd')}</option>
              <option value="SYP">{t('currency.syp')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('history.filterSection.labels.fromDate')}</label>
            <input
              type="date"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('history.filterSection.labels.toDate')}</label>
            <input
              type="date"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('history.filterSection.labels.search')}</label>
          <input
            type="text"
            placeholder={t('history.filterSection.placeholders.search')}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-secondary-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            value={filters.searchQuery}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.status !== 'All' && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full">
              {t('history.filterSection.badges.status', { status: t(`status.${filters.status}`) })}
            </span>
          )}
          {filters.currency !== 'All' && (
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full">
              {t('history.filterSection.badges.currency', { currency: t(`currency.${filters.currency?.toLowerCase()}`) })}
            </span>
          )}
          {filters.startDate && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-xs rounded-full">
              {t('history.filterSection.badges.from', { date: filters.startDate })}
            </span>
          )}
          {filters.endDate && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 text-xs rounded-full">
              {t('history.filterSection.badges.to', { date: filters.endDate })}
            </span>
          )}
          {filters.searchQuery && (
            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full">
              {t('history.filterSection.badges.search', { query: filters.searchQuery })}
            </span>
          )}
          <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs rounded-full">
            {t('history.filterSection.badges.showing', { count: filteredData.length })}
          </span>
        </div>
      </div>

      <GridComponent
        dataSource={filteredData}
        allowPaging
        allowSorting
        allowFiltering
        allowGrouping
        toolbar={toolbarOptions}
        pageSettings={{ pageSize: 20 }}
        height={600}
        enableHover
        enableRtl={isArabic}
        locale={isArabic ? 'ar' : 'en-US'}
      >
        <ColumnsDirective>
          <ColumnDirective
            field="PaymentID"
            headerText={t('history.table.headers.id')}
            width="120"
            textAlign="Center"
          />
          <ColumnDirective
            headerText={t('history.table.headers.user')}
            width="180"
            template={userTemplate}
            textAlign={isArabic ? 'Right' : 'Left'}
          />
          <ColumnDirective
            field="ProductName"
            headerText={t('history.table.headers.product')}
            width="200"
            textAlign={isArabic ? 'Right' : 'Left'}
          />
          <ColumnDirective
            headerText={t('history.table.headers.amount')}
            width="150"
            template={amountTemplate}
            textAlign={isArabic ? 'Left' : 'Right'}
          />
          <ColumnDirective
            headerText={t('history.table.headers.profit')}
            width="120"
            template={profitTemplate}
            textAlign={isArabic ? 'Left' : 'Right'}
          />
          <ColumnDirective
            field="Currency"
            headerText={t('history.table.headers.currency')}
            width="100"
            textAlign="Center"
          />
          <ColumnDirective
            headerText={t('history.table.headers.status')}
            width="140"
            textAlign="Center"
            template={statusTemplate}
          />
          <ColumnDirective
            headerText={t('history.table.headers.date')}
            width="140"
            textAlign="Center"
            template={dateTemplate}
          />
          <ColumnDirective
            field="ExternalID"
            headerText={t('history.table.headers.externalId')}
            width="160"
            textAlign={isArabic ? 'Right' : 'Left'}
          />
          <ColumnDirective
            headerText={t('history.table.headers.actions')}
            width="150"
            textAlign="Center"
            template={actionsTemplate}
          />
        </ColumnsDirective>
        <Inject services={[Page, Toolbar, Sort, Filter, Group]} />
      </GridComponent>
    </div>
  );
};

export default FullPayments;
