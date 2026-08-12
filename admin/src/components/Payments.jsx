import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineCancel } from 'react-icons/md';
import { useStateContext } from '../contexts/ContextProvider';
import axiosInstance from '../utils/axiosConfig';

const Payments = ({ onClose }) => {
  const { currentColor, setIsClicked, initialState } = useStateContext();
  const handleClose = onClose || (() => setIsClicked(initialState));
  const { t, i18n } = useTranslation(['payments', 'common']);
  const isRtl = i18n.resolvedLanguage === 'ar';
  
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    fetchRecentPayments();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        if (!event.target.closest('[data-prevent-outside-close="true"]')) {
          handleClose();
        }
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose]);

  const fetchRecentPayments = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('payment/payment/recent/');
      setPayments(Array.isArray(response.data) ? response.data.slice(0, 5) : []);
    } catch (err) {
      const errorMessage = err.response?.data?.detail
        || err.response?.data?.error
        || t('history.error', { defaultValue: 'Failed to fetch payments' });
      setError(errorMessage);
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      success: { color: '#10B981', text: t('status.success', 'Success') },
      pending: { color: '#F59E0B', text: t('status.pending', 'Pending') },
      processing: { color: '#3B82F6', text: t('status.processing', 'Processing') },
      failed: { color: '#EF4444', text: t('status.failed', 'Failed') },
      cancelled: { color: '#6B7280', text: t('status.cancelled', 'Cancelled') },
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span
        style={{ background: config.color, color: 'white' }}
        className="text-[10px] rounded-full px-2 py-0.5 font-medium"
      >
        {config.text}
      </span>
    );
  };

  const getCurrencySymbol = (currency) => {
    const symbols = {
      USD: '$',
      SYP: t('currency.syp_symbol', 'ل.س'),
      EUR: '€',
    };
    return symbols[currency?.toUpperCase()] || currency;
  };

  const getCurrencyColor = (currency) => {
    const colors = {
      USD: { bg: 'bg-blue-105 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
      SYP: { bg: 'bg-green-105 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
      EUR: { bg: 'bg-purple-105 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
    };
    return colors[currency?.toUpperCase()] || { bg: 'bg-gray-105 dark:bg-gray-800/40', text: 'text-gray-500 dark:text-gray-400' };
  };

  const formatAmount = (amount, currency) => {
    const normalizedCurrency = currency?.toUpperCase();
    const formattedVal = parseFloat(amount).toLocaleString(i18n.resolvedLanguage, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    if (normalizedCurrency === 'USD') {
      return `$${formattedVal}`;
    } if (normalizedCurrency === 'SYP') {
      return `${formattedVal} ${t('currency.syp', 'SYP')}`;
    }
    return `${formattedVal} ${t(`currency.${currency?.toLowerCase()}`, { defaultValue: currency })}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `${t('common:today', 'Today')}, ${date.toLocaleTimeString(i18n.resolvedLanguage, { hour: '2-digit', minute: '2-digit' })}`;
    } if (diffDays === 1) {
      return `${t('common:yesterday', 'Yesterday')}, ${date.toLocaleTimeString(i18n.resolvedLanguage, { hour: '2-digit', minute: '2-digit' })}`;
    } if (diffDays < 7) {
      return t('recent.daysAgo', { count: diffDays, defaultValue: `${diffDays} days ago` });
    }
    return date.toLocaleDateString(i18n.resolvedLanguage);
  };

  const handleViewAllPayments = () => {
    window.location.href = '/payments';
  };

  const handleRefresh = () => {
    fetchRecentPayments();
  };

  const layoutClasses = `nav-item fixed bottom-4 left-2 right-2 z-[9999] bg-white dark:bg-[#42464D] p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[80vh] w-[calc(100vw-16px)] mx-auto
    md:absolute md:bottom-auto md:top-full md:mt-2 md:left-1/2 md:-translate-x-1/2 md:inset-x-auto md:w-[400px] md:max-h-[70vh] ${
      isRtl ? 'text-right' : 'text-left'
    }`;

  if (loading) {
    return (
      <div ref={panelRef} className={layoutClasses}>
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
          <p className="font-bold text-base dark:text-gray-200">{t('recent.title', 'Recent Payments')}</p>
          <button
            type="button"
            onClick={handleClose}
            className="text-2xl p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 focus:outline-none transition-colors"
          >
            <MdOutlineCancel />
          </button>
        </div>
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={panelRef} className={layoutClasses}>
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
          <p className="font-bold text-base dark:text-gray-200">{t('recent.title', 'Recent Payments')}</p>
          <button
            type="button"
            onClick={handleClose}
            className="text-2xl p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 focus:outline-none transition-colors"
          >
            <MdOutlineCancel />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <div className="text-red-500 text-sm text-center px-4">{error}</div>
          <button
            type="button"
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-xs font-semibold"
          >
            {t('recent.buttons.retry', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className={layoutClasses}>
      <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex gap-2 items-center">
          <p className="font-bold text-base dark:text-gray-200">{t('recent.title', 'Recent Payments')}</p>
          {payments.length > 0 && (
            <span className="text-white text-[10px] font-bold rounded px-1.5 py-0.5 bg-orange-500">
              {payments.filter((p) => p.status === 'pending' || p.status === 'processing').length} {t('recent.activeBadge', { count: payments.filter((p) => p.status === 'pending' || p.status === 'processing').length, defaultValue: 'Active' })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-2xl p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 focus:outline-none transition-colors"
          aria-label={t('common.close', 'Close')}
        >
          <MdOutlineCancel />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mt-3 pr-1 pl-1 -mr-1 -ml-1">
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <div className="text-sm font-semibold mb-1">{t('recent.emptyTitle', 'No payments found')}</div>
            <div className="text-xs text-center">{t('recent.emptyDesc', 'Payments will appear here once they are processed')}</div>
          </div>
        ) : (
          <>
            {payments?.map((payment) => {
              const currencyColor = getCurrencyColor(payment.currency);

              return (
                <div
                  key={payment.id}
                  className={`flex items-start gap-3 border-b border-gray-100 dark:border-gray-750/50 p-2.5 hover:bg-gray-50 dark:hover:bg-[#4A4E55] rounded-xl transition-all ${isRtl ? 'text-right' : 'text-left'}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currencyColor.bg}`}>
                      <span className={`font-bold text-sm ${currencyColor.text}`}>
                        {getCurrencySymbol(payment.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <p className="font-semibold dark:text-gray-200 text-sm truncate">
                        {payment.user_name || `${t('common:user', 'User')} #${payment.user}`}
                      </p>
                      <p className="font-bold dark:text-white text-sm flex-shrink-0">
                        {formatAmount(payment.final_price, payment.currency)}
                      </p>
                    </div>

                    <p className="text-gray-400 dark:text-gray-500 text-[11px] truncate mt-0.5">
                      {payment.store_product_name || t('recent.productPurchase', 'Product Purchase')} • #{payment.id}
                    </p>

                    <div className="flex justify-between items-center mt-1">
                      <p className="text-gray-400 dark:text-gray-550 text-[11px]">
                        {t('recent.base', { symbol: '', amount: formatAmount(payment.base_price, payment.currency) })}
                      </p>
                      {getStatusBadge(payment.status)}
                    </div>

                    <div className="flex justify-between items-center mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                      <span>{formatDate(payment.created_at)}</span>
                      {payment.profit_percentage > 0 && (
                        <span className="text-green-500 font-medium">
                          {t('recent.profit', { percent: payment.profit_percentage, defaultValue: `+${payment.profit_percentage}% profit` })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {payments.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleViewAllPayments}
            className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm transition"
            style={{ backgroundColor: currentColor }}
          >
            {t('recent.buttons.viewAll', 'View All Payments')}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="w-full py-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {t('recent.buttons.refresh', 'Refresh')}
          </button>
        </div>
      )}
    </div>
  );
};

export default Payments;
