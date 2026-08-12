import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineArrowDown, AiOutlineArrowUp, AiOutlineClose, AiOutlineSave } from 'react-icons/ai';
import { MdEdit, MdOutlineCancel, MdRefresh, MdSwapVert } from 'react-icons/md';
import { useStateContext } from '../contexts/ContextProvider';
import { useAuth } from '../contexts/AuthContext';
import axiosInstance from '../utils/axiosConfig';

const SkeletonCard = () => (
  <div className="bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700/60 rounded-2xl p-4 animate-pulse space-y-4">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-1.5">
          <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-10 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
    <div className="space-y-1">
      <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="w-32 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-750">
      <div className="space-y-1.5">
        <div className="w-12 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="space-y-1.5">
        <div className="w-12 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  </div>
);

const Currencies = ({ onClose }) => {
  const { t, i18n } = useTranslation(['currencies', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const { setIsClicked, initialState } = useStateContext();
  const { user } = useAuth();
  const handleClose = onClose || (() => setIsClicked(initialState));

  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRate, setEditingRate] = useState(false);
  const [newExchangeRate, setNewExchangeRate] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/wallets/wallet/');
      setWalletData(response.data);
      if (response.data.exchange_rates?.usd_to_syp?.value) {
        setNewExchangeRate(response.data.exchange_rates.usd_to_syp.value.toString());
      }
    } catch (fetchError) {
      console.error('Error fetching wallet data:', fetchError);
      setError(t('alerts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const updateExchangeRate = async () => {
    if (updateLoading) return;
    if (!newExchangeRate || isNaN(parseFloat(newExchangeRate)) || parseFloat(newExchangeRate) <= 0) {
      setUpdateError(t('alerts.invalidRate'));
      return;
    }
    if (!window.confirm(t('alerts.updateConfirm', {
      defaultValue: `Change the live USD/SYP exchange rate to ${newExchangeRate}?`,
    }))) return;

    try {
      setUpdateLoading(true);
      setUpdateError(null);
      setSuccessMessage(null);

      await axiosInstance.put('/wallets/exchange-rate/', {
        usd_to_syp: parseFloat(newExchangeRate),
      });

      setSuccessMessage(t('alerts.updateSuccess'));
      setEditingRate(false);

      setTimeout(() => {
        fetchWalletData();
        setSuccessMessage(null);
      }, 2000);
    } catch (updateoError) {
      console.error('Error updating exchange rate:', updateoError);
      if (updateoError.response?.data?.detail) {
        setUpdateError(updateoError.response.data.detail);
      } else if (updateoError.response?.data?.error) {
        setUpdateError(updateoError.response.data.error);
      } else {
        setUpdateError(t('alerts.updateFailed'));
      }
    } finally {
      setUpdateLoading(false);
    }
  };

  const startEditing = () => {
    setEditingRate(true);
    setUpdateError(null);
    setSuccessMessage(null);
  };

  const cancelEditing = () => {
    setEditingRate(false);
    setUpdateError(null);
    setSuccessMessage(null);
    if (walletData?.exchange_rates?.usd_to_syp?.value) {
      setNewExchangeRate(walletData.exchange_rates.usd_to_syp.value.toString());
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const formatCurrency = (amount, currency) => {
    if (currency === 'SYP') {
      return `${t('currency.syp')} ${parseFloat(amount).toLocaleString(i18n.resolvedLanguage, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return `$${parseFloat(amount).toLocaleString(i18n.resolvedLanguage, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatRate = (rate, decimals = 2) => {
    return parseFloat(rate).toLocaleString(i18n.resolvedLanguage, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const currenciesData = walletData ? [
    {
      name: t('currency.usd'),
      currency: 'USD',
      icon: '$',
      color: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
      textColor: 'text-green-600 dark:text-green-400',
      balance: formatCurrency(walletData.USD?.total || 0, 'USD'),
      available: formatCurrency(walletData.USD?.available || 0, 'USD'),
      pending: formatCurrency(walletData.USD?.pending || 0, 'USD'),
      exchangeRate: `1 USD = ${formatRate(walletData.exchange_rates?.usd_to_syp?.value || 0)} ${t('currency.syp')}`,
    },
    {
      name: t('currency.syp'),
      currency: 'SYP',
      icon: isArabic ? 'ل.س' : 'SYP',
      color: 'bg-orange-50 dark:bg-orange-955/20 text-orange-600 dark:text-orange-400',
      textColor: 'text-orange-600 dark:text-orange-400',
      balance: formatCurrency(walletData.SYP?.total || 0, 'SYP'),
      available: formatCurrency(walletData.SYP?.available || 0, 'SYP'),
      pending: formatCurrency(walletData.SYP?.pending || 0, 'SYP'),
      exchangeRate: `1 ${t('currency.syp')} = ${formatRate(walletData.exchange_rates?.syp_to_usd?.value || 0, 6)} USD`,
    },
  ] : [];

  const exchangeRates = walletData ? [
    {
      from: 'USD',
      to: 'SYP',
      rate: walletData.exchange_rates?.usd_to_syp?.value || 0,
      change: walletData.exchange_rates?.usd_to_syp?.change || 0,
      trend: (walletData.exchange_rates?.usd_to_syp?.change || 0) >= 0 ? 'up' : 'down',
    },
    {
      from: 'SYP',
      to: 'USD',
      rate: walletData.exchange_rates?.syp_to_usd?.value || 0,
      change: walletData.exchange_rates?.syp_to_usd?.change || 0,
      trend: (walletData.exchange_rates?.syp_to_usd?.change || 0) >= 0 ? 'up' : 'down',
    },
  ] : [];

  const layoutContainerClass = `fixed bottom-2 top-2 z-[99999] bg-white dark:bg-[#20232A] shadow-2xl border border-gray-150 dark:border-gray-800 flex flex-col transition-all duration-300 rounded-2xl w-[calc(100vw-16px)] sm:w-[400px] sm:h-screen sm:bottom-0 sm:top-0 sm:rounded-none ${
    isArabic
      ? 'left-2 sm:left-0 sm:border-r text-right'
      : 'right-2 sm:right-0 sm:border-l text-left'
  }`;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      className="bg-black/60 w-full fixed inset-0 z-[99998] backdrop-blur-sm transition-opacity"
    >
      <div
        className={layoutContainerClass}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white dark:bg-[#20232A] z-10 p-4 border-b border-gray-150 dark:border-gray-800 flex items-start justify-between">
          <div className="text-start min-w-0 flex-1 me-4">
            <h2 className="text-base font-bold text-gray-800 dark:text-white truncate">
              {t('title', 'Wallet Balances')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
              {t('subtitle', 'Monitor balances and exchange rates')}
            </p>
            
            {/* Small action buttons under title */}
            <div className="flex gap-2 mt-2.5">
              <button
                type="button"
                onClick={fetchWalletData}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-[10px] font-bold transition"
              >
                <MdRefresh className="text-xs" />
                {t('buttons.refreshData', 'Refresh Data')}
              </button>

            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="text-2xl p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 focus:outline-none transition-colors flex-shrink-0"
            aria-label={t('common.close', 'Close')}
          >
            <MdOutlineCancel />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          
          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs dark:bg-green-950/20 dark:border-green-900 dark:text-green-400">
              {successMessage}
            </div>
          )}
          
          {updateError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs dark:bg-red-950/20 dark:border-red-900 dark:text-red-400">
              {updateError}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="text-red-500 dark:text-red-400 text-sm text-center px-4 font-semibold">{error}</div>
              <button
                type="button"
                onClick={fetchWalletData}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition"
              >
                {t('buttons.tryAgain', 'Try Again')}
              </button>
            </div>
          ) : (
            <>
              {/* Currency Cards List */}
              <div className="space-y-4">
                {currenciesData?.map((currency, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800/40 border border-gray-150 dark:border-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    
                    {/* Top Row: Icon badge + Name & code + Rate tag */}
                    <div className="flex justify-between items-center gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${currency.color}`}>
                          <span className="font-bold text-base">
                            {currency.icon}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-800 dark:text-white truncate">{currency.name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">{currency.currency}</p>
                        </div>
                      </div>
                      <span className="text-[10px] bg-gray-50 dark:bg-gray-800 px-2 py-0.5 border border-gray-100 dark:border-gray-700 rounded-lg text-gray-400 dark:text-gray-500 font-medium">
                        {currency.exchangeRate}
                      </span>
                    </div>

                    {/* Middle Row: Total Balance */}
                    <div className="mb-3.5">
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('exchange.totalBalanceUsd', 'Total Balance')}</p>
                      <p className="font-extrabold text-2xl text-gray-850 dark:text-white mt-0.5 tracking-tight">{currency.balance}</p>
                    </div>

                    {/* Bottom Row: Available & Pending grid */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-750 text-xs">
                      <div>
                        <p className="text-gray-400 dark:text-gray-500 text-[10px] uppercase font-semibold">{t('currency.available')}</p>
                        <p className="font-bold text-green-600 dark:text-green-400 mt-0.5">{currency.available}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500 text-[10px] uppercase font-semibold">{t('currency.pending')}</p>
                        <p className="font-bold text-yellow-600 dark:text-yellow-450 mt-0.5">{currency.pending}</p>
                      </div>
                    </div>

                  </div>
                ))}
              </div>

              {/* Exchange Rates independent card */}
              <div className="bg-white dark:bg-gray-800/40 border border-gray-150 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <MdSwapVert className="text-xl text-indigo-500" />
                  <h3 className="font-bold text-sm text-gray-800 dark:text-white">{t('exchange.title')}</h3>
                </div>

                {isAdmin && editingRate && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-xs text-gray-800 dark:text-gray-200">{t('exchange.updateManually')}</p>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <AiOutlineClose />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <label htmlFor="usd-to-syp-rate" className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                          {t('exchange.usdToSypRate')}
                        </label>
                        <input
                          id="usd-to-syp-rate"
                          type="number"
                          step="0.01"
                          min="0"
                          value={newExchangeRate}
                          onChange={(e) => setNewExchangeRate(e.target.value)}
                          className="w-full p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder={t('exchange.usdToSypPlaceholder')}
                        />
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                          {t('exchange.currentLabel', { rate: formatRate(walletData?.exchange_rates?.usd_to_syp?.value || 0) })}
                        </p>
                      </div>
                      
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={updateExchangeRate}
                          disabled={updateLoading}
                          className="flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition"
                        >
                          <AiOutlineSave className="text-sm" />
                          {updateLoading ? t('buttons.updating') : t('buttons.updateRate')}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-150 dark:hover:bg-gray-700 transition"
                        >
                          {t('buttons.cancel')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Exchange Rates List rows */}
                <div className="space-y-2.5">
                  {exchangeRates?.map((rate, index) => {
                    const changeVal = parseFloat(rate.change) || 0;
                    const isPositive = changeVal > 0;
                    const isNegative = changeVal < 0;
                    
                    const trendColor = isPositive 
                      ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20' 
                      : isNegative 
                        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20' 
                        : 'text-gray-550 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';

                    return (
                      <div key={index} className="flex justify-between items-center p-2.5 bg-gray-50/50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-750 rounded-xl">
                        <div className="text-start">
                          <p className="font-bold text-xs text-gray-750 dark:text-gray-250">{rate.from} → {rate.to}</p>
                          <p className="text-[9px] text-gray-400 dark:text-gray-550 mt-0.5">{t('exchange.currentRate')}</p>
                        </div>
                        <div className="text-end flex items-center gap-2">
                          <p className="font-bold text-sm text-gray-850 dark:text-white">
                            {formatRate(rate.rate, rate.from === 'SYP' ? 6 : 2)}
                          </p>
                          <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${trendColor}`}>
                            {isPositive ? <AiOutlineArrowUp className="text-[7px]" /> : isNegative ? <AiOutlineArrowDown className="text-[7px]" /> : null}
                            {rate.change}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Edit Rate trigger button */}
                {isAdmin && !editingRate && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="w-full mt-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 border border-indigo-150 dark:border-indigo-900 text-indigo-650 dark:text-indigo-400 rounded-xl font-bold text-xs transition"
                  >
                    {t('buttons.changeExchangeRate')}
                  </button>
                )}
              </div>

              {/* Total Balance Summary Panel */}
              <div className="bg-gray-50 dark:bg-gray-800/45 border border-gray-150 dark:border-gray-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">{t('exchange.totalBalanceUsd')}</p>
                  <p className="font-extrabold text-sm text-gray-850 dark:text-white">
                    {walletData?.totals?.usd ? formatCurrency(walletData.totals.usd, 'USD') : '$0.00'}
                  </p>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">{t('exchange.totalBalanceSyp')}</p>
                  <p className="font-extrabold text-sm text-gray-850 dark:text-white">
                    {walletData?.totals?.syp ? formatCurrency(walletData.totals.syp, 'SYP') : `0.00`}
                  </p>
                </div>

                {walletData?.exchange_rates?.last_updated && (
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 text-center pt-2 border-t border-gray-100 dark:border-gray-750">
                    {t('exchange.lastUpdated', { date: new Date(walletData.exchange_rates.last_updated).toLocaleString(i18n.resolvedLanguage) })}
                  </p>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Currencies;
