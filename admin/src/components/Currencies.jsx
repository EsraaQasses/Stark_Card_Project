import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  AiOutlineClose,
  AiOutlineSave,
} from 'react-icons/ai';

import {
  MdOutlineCancel,
  MdRefresh,
  MdSwapVert,
} from 'react-icons/md';

import {
  FiDollarSign,
  FiEdit3,
} from 'react-icons/fi';

import { useStateContext } from '../contexts/ContextProvider';
import { useAuth } from '../contexts/AuthContext';
import axiosInstance from '../utils/axiosConfig';

const Currencies = ({
  onClose,
}) => {
  const {
    t,
    i18n,
  } = useTranslation([
    'currencies',
    'common',
  ]);

  const {
    setIsClicked,
    initialState,
    currentColor,
  } = useStateContext();

  const {
    user,
  } = useAuth();

  const panelRef = useRef(null);

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const locale = (
    i18n.resolvedLanguage
    || i18n.language
    || (isArabic ? 'ar' : 'en')
  );

  const accentColor = (
    currentColor || '#06b6d4'
  );

  const labels = useMemo(() => ({
    title: isArabic
      ? 'أرصدة المحفظة'
      : 'Wallet Balances',

    subtitle: isArabic
      ? 'الأرصدة وأسعار الصرف الحالية'
      : 'Current balances and exchange rates',

    refresh: isArabic
      ? 'تحديث'
      : 'Refresh',

    usd: isArabic
      ? 'الدولار الأمريكي'
      : 'US Dollar',

    syp: isArabic
      ? 'الليرة السورية'
      : 'Syrian Pound',

    total: isArabic
      ? 'الإجمالي'
      : 'Total',

    available: isArabic
      ? 'المتاح'
      : 'Available',

    pending: isArabic
      ? 'المعلق'
      : 'Pending',

    exchangeRates: isArabic
      ? 'أسعار الصرف'
      : 'Exchange Rates',

    buyRate: isArabic
      ? 'سعر شراء الدولار'
      : 'USD Buy Rate',

    sellRate: isArabic
      ? 'سعر بيع الدولار'
      : 'USD Sell Rate',

    spread: isArabic
      ? 'فرق السعر'
      : 'Spread',

    spreadPercent: isArabic
      ? 'نسبة الفرق'
      : 'Spread %',

    edit: isArabic
      ? 'تعديل سعر الصرف'
      : 'Edit Exchange Rate',

    buyHint: isArabic
      ? 'السعر الذي تشتري به المنصة 1 USD.'
      : 'The rate at which the platform buys 1 USD.',

    sellHint: isArabic
      ? 'السعر الذي تبيع به المنصة 1 USD.'
      : 'The rate at which the platform sells 1 USD.',

    note: isArabic
      ? 'ملاحظة التفعيل'
      : 'Activation Note',

    notePlaceholder: isArabic
      ? 'مثال: تحديث السعر حسب السوق...'
      : 'Example: market rate update...',

    save: isArabic
      ? 'حفظ السعر'
      : 'Save Rate',

    saving: isArabic
      ? 'جاري الحفظ...'
      : 'Saving...',

    cancel: isArabic
      ? 'إلغاء'
      : 'Cancel',

    invalidRate: isArabic
      ? 'أدخل سعر شراء وسعر بيع صحيحين وأكبر من صفر.'
      : 'Enter valid buy and sell rates greater than zero.',

    sellBelowBuy: isArabic
      ? 'سعر البيع لا يمكن أن يكون أقل من سعر الشراء.'
      : 'Sell rate cannot be below buy rate.',

    noteRequired: isArabic
      ? 'ملاحظة التفعيل مطلوبة.'
      : 'Activation note is required.',

    success: isArabic
      ? 'تم تحديث سعر الصرف بنجاح.'
      : 'Exchange rate updated successfully.',

    loadFailed: isArabic
      ? 'تعذر تحميل بيانات المحفظة.'
      : 'Failed to load wallet data.',

    updateFailed: isArabic
      ? 'تعذر تحديث سعر الصرف.'
      : 'Failed to update exchange rate.',

    noQuote: isArabic
      ? 'لا يوجد سعر صرف نشط حالياً.'
      : 'No active exchange quote.',

    confirm: (
      buy,
      sell,
      spread,
      percent,
    ) => (
      isArabic
        ? `تأكيد تحديث سعر الصرف؟\nشراء: ${buy} SYP\nبيع: ${sell} SYP\nالفرق: ${spread} SYP (${percent}%)`
        : `Update exchange quote?\nBuy: ${buy} SYP\nSell: ${sell} SYP\nSpread: ${spread} SYP (${percent}%)`
    ),
  }), [isArabic]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }

    setIsClicked(
      initialState,
    );
  }, [
    initialState,
    onClose,
    setIsClicked,
  ]);

  const [walletData, setWalletData] = useState(null);
  const [currentQuote, setCurrentQuote] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [editingRate, setEditingRate] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const [rateForm, setRateForm] = useState({
    buy_rate: '',
    sell_rate: '',
    activation_note: '',
  });

  const isAdmin = (
    user?.role === 'admin'
  );

  const formatNumber = useCallback(
    (
      value,
      decimals = 2,
    ) => {
      const numeric = Number(
        value || 0,
      );

      return numeric.toLocaleString(
        locale,
        {
          minimumFractionDigits:
            decimals,
          maximumFractionDigits:
            decimals,
        },
      );
    },
    [locale],
  );

  const formatCurrency = useCallback(
    (
      value,
      currency,
    ) => {
      const amount = Number(
        value || 0,
      );

      if (currency === 'USD') {
        return `$${formatNumber(
          amount,
          2,
        )}`;
      }

      return `${formatNumber(
        amount,
        2,
      )} ${isArabic ? 'ل.س' : 'SYP'}`;
    },
    [
      formatNumber,
      isArabic,
    ],
  );

  const calculateSpread = useCallback(
    (
      buyValue,
      sellValue,
    ) => {
      const buy = Number(
        buyValue,
      );

      const sell = Number(
        sellValue,
      );

      if (
        !Number.isFinite(buy)
        || !Number.isFinite(sell)
        || buy <= 0
        || sell <= 0
      ) {
        return {
          valid: false,
          amount: 0,
          percentage: 0,
        };
      }

      const amount = (
        sell - buy
      );

      return {
        valid: sell >= buy,
        amount,
        percentage: (
          amount / buy
        ) * 100,
      };
    },
    [],
  );

  const fetchWalletData = useCallback(
    async ({
      background = false,
    } = {}) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const walletResponse =
          await axiosInstance.get(
            '/wallets/wallet/',
          );

        setWalletData(
          walletResponse.data,
        );

        try {
          const quoteResponse =
            await axiosInstance.get(
              '/wallets/exchange-rates/current/',
            );

          const quote = (
            quoteResponse.data
          );

          setCurrentQuote(
            quote,
          );

          setRateForm(
            (previous) => ({
              ...previous,

              buy_rate: String(
                quote?.platform_buy_usd_rate_syp
                || quote?.usd_to_syp
                || '',
              ),

              sell_rate: String(
                quote?.platform_sell_usd_rate_syp
                || quote?.platform_buy_usd_rate_syp
                || quote?.usd_to_syp
                || '',
              ),
            }),
          );
        } catch (quoteError) {
          if (
            quoteError?.response?.status
            !== 503
          ) {
            throw quoteError;
          }

          setCurrentQuote(null);

          const fallbackRate = (
            walletResponse.data
              ?.exchange_rates
              ?.usd_to_syp
              ?.value
          );

          if (fallbackRate) {
            setRateForm(
              (previous) => ({
                ...previous,

                buy_rate:
                  String(fallbackRate),

                sell_rate:
                  String(fallbackRate),
              }),
            );
          }
        }
      } catch (fetchError) {
        console.error(
          'Error fetching wallet data:',
          fetchError,
        );

        setError(
          fetchError?.response?.data?.error
          || fetchError?.response?.data?.detail
          || labels.loadFailed,
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [labels.loadFailed],
  );

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  useEffect(() => {
    const handleOutsideClick = (
      event,
    ) => {
      if (
        panelRef.current
        && !panelRef.current.contains(
          event.target,
        )
        && !event.target.closest(
          '[data-prevent-outside-close="true"]',
        )
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (
      event,
    ) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    );

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      );

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [handleClose]);

  const currentBuyRate = Number(
    currentQuote
      ?.platform_buy_usd_rate_syp
    || walletData
      ?.exchange_rates
      ?.usd_to_syp
      ?.value
    || 0,
  );

  const currentSellRate = Number(
    currentQuote
      ?.platform_sell_usd_rate_syp
    || currentQuote
      ?.platform_buy_usd_rate_syp
    || currentBuyRate
    || 0,
  );

  const currentSpread = (
    calculateSpread(
      currentBuyRate,
      currentSellRate,
    )
  );

  const previewSpread = (
    calculateSpread(
      rateForm.buy_rate,
      rateForm.sell_rate,
    )
  );

  const updateExchangeRate =
    async () => {
      if (updateLoading) {
        return;
      }

      const buyRate = Number(
        rateForm.buy_rate,
      );

      const sellRate = Number(
        rateForm.sell_rate,
      );

      const note = (
        rateForm.activation_note.trim()
      );

      if (
        !Number.isFinite(buyRate)
        || !Number.isFinite(sellRate)
        || buyRate <= 0
        || sellRate <= 0
      ) {
        setUpdateError(
          labels.invalidRate,
        );

        return;
      }

      if (
        sellRate < buyRate
      ) {
        setUpdateError(
          labels.sellBelowBuy,
        );

        return;
      }

      if (!note) {
        setUpdateError(
          labels.noteRequired,
        );

        return;
      }

      const spread = (
        calculateSpread(
          buyRate,
          sellRate,
        )
      );

      if (
        !window.confirm(
          labels.confirm(
            formatNumber(
              buyRate,
              6,
            ),
            formatNumber(
              sellRate,
              6,
            ),
            formatNumber(
              spread.amount,
              6,
            ),
            formatNumber(
              spread.percentage,
              4,
            ),
          ),
        )
      ) {
        return;
      }

      setUpdateLoading(true);
      setUpdateError('');
      setNotice('');

      try {
        await axiosInstance.post(
          '/wallets/exchange-rates/activate/',
          {
            platform_buy_usd_rate_syp:
              buyRate,

            platform_sell_usd_rate_syp:
              sellRate,

            activation_note:
              note,

            expected_current_quote_id:
              currentQuote
                ?.quote_id
                ?? null,
          },
        );

        setNotice(
          labels.success,
        );

        setEditingRate(false);

        setRateForm(
          (previous) => ({
            ...previous,
            activation_note: '',
          }),
        );

        await fetchWalletData({
          background: true,
        });
      } catch (updateApiError) {
        console.error(
          'Error updating exchange rate:',
          updateApiError,
        );

        setUpdateError(
          updateApiError
            ?.response
            ?.data
            ?.error
          || updateApiError
            ?.response
            ?.data
            ?.detail
          || labels.updateFailed,
        );
      } finally {
        setUpdateLoading(false);
      }
    };

  const startEditing = () => {
    setEditingRate(true);
    setUpdateError('');
    setNotice('');

    setRateForm(
      (previous) => ({
        ...previous,

        buy_rate:
          String(
            currentBuyRate || '',
          ),

        sell_rate:
          String(
            currentSellRate || '',
          ),
      }),
    );
  };

  const cancelEditing = () => {
    setEditingRate(false);
    setUpdateError('');

    setRateForm(
      (previous) => ({
        ...previous,

        buy_rate:
          String(
            currentBuyRate || '',
          ),

        sell_rate:
          String(
            currentSellRate || '',
          ),

        activation_note: '',
      }),
    );
  };

  const balances = [
    {
      code: 'USD',
      label: labels.usd,
      total: walletData?.USD?.total,
      available:
        walletData?.USD?.available,
      pending:
        walletData?.USD?.pending,
      symbol: '$',
    },
    {
      code: 'SYP',
      label: labels.syp,
      total: walletData?.SYP?.total,
      available:
        walletData?.SYP?.available,
      pending:
        walletData?.SYP?.pending,
      symbol: isArabic
        ? 'ل.س'
        : 'SYP',
    },
  ];

  return (
    <div
      ref={panelRef}
      dir={isArabic ? 'rtl' : 'ltr'}
      className="
        fixed
        bottom-3
        left-3
        right-3
        z-[1200]
        mx-auto
        flex
        max-h-[82vh]
        w-[calc(100vw-24px)]
        max-w-[430px]
        flex-col
        overflow-hidden
        rounded-3xl
        border
        border-slate-200
        bg-white
        shadow-2xl
        dark:border-slate-700
        dark:bg-secondary-dark-bg

        md:absolute
        md:bottom-auto
        md:left-1/2
        md:right-auto
        md:top-full
        md:mt-3
        md:w-[430px]
        md:-translate-x-1/2
      "
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-4
          border-b
          border-slate-100
          px-4
          py-4
          dark:border-slate-800
        "
      >
        <div className="min-w-0 text-start">
          <h2
            className="
              text-base
              font-black
              text-slate-900
              dark:text-white
            "
          >
            {labels.title}
          </h2>

          <p
            className="
              mt-1
              text-xs
              font-semibold
              text-slate-400
            "
          >
            {labels.subtitle}
          </p>
        </div>

        <div
          className="
            flex
            shrink-0
            items-center
            gap-1
          "
        >
          <button
            type="button"
            disabled={refreshing}
            onClick={() => (
              fetchWalletData({
                background: true,
              })
            )}
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              text-slate-400
              transition
              hover:bg-slate-100
              hover:text-slate-700
              disabled:opacity-50
              dark:hover:bg-slate-800
              dark:hover:text-white
            "
            title={labels.refresh}
          >
            <MdRefresh
              className={
                refreshing
                  ? 'animate-spin'
                  : ''
              }
            />
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              text-slate-400
              transition
              hover:bg-slate-100
              hover:text-slate-700
              dark:hover:bg-slate-800
              dark:hover:text-white
            "
          >
            <MdOutlineCancel />
          </button>
        </div>
      </div>

      <div
        className="
          flex-1
          space-y-4
          overflow-y-auto
          p-4
        "
      >
        {notice && (
          <div
            className="
              rounded-xl
              border
              border-slate-200
              bg-slate-50
              p-3
              text-xs
              font-bold
              text-slate-700
              dark:border-slate-700
              dark:bg-slate-800
              dark:text-slate-200
            "
          >
            <span
              style={{
                color: accentColor,
              }}
            >
              ✓
            </span>{' '}
            {notice}
          </div>
        )}

        {error && (
          <div
            className="
              rounded-xl
              border
              border-red-200
              bg-red-50
              p-3
              text-xs
              font-bold
              text-red-700
              dark:border-red-900/40
              dark:bg-red-950/20
              dark:text-red-300
            "
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="
                  h-28
                  animate-pulse
                  rounded-2xl
                  bg-slate-100
                  dark:bg-slate-800
                "
              />
            ))}
          </div>
        ) : (
          <>
            <div
              className="
                grid
                gap-3
                sm:grid-cols-2
              "
            >
              {balances.map((balance) => (
                <div
                  key={balance.code}
                  className="
                    rounded-2xl
                    border
                    border-slate-100
                    bg-slate-50/70
                    p-4
                    dark:border-slate-700
                    dark:bg-slate-900/40
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                    "
                  >
                    <div className="min-w-0 text-start">
                      <p
                        className="
                          truncate
                          text-xs
                          font-bold
                          text-slate-400
                        "
                      >
                        {balance.label}
                      </p>

                      <p
                        className="
                          mt-1
                          text-xl
                          font-black
                          text-slate-950
                          dark:text-white
                        "
                      >
                        {formatCurrency(
                          balance.total,
                          balance.code,
                        )}
                      </p>
                    </div>

                    <div
                      className="
                        flex
                        h-10
                        w-10
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        text-xs
                        font-black
                      "
                      style={{
                        backgroundColor:
                          `${accentColor}14`,

                        color:
                          accentColor,
                      }}
                    >
                      {balance.symbol}
                    </div>
                  </div>

                  <div
                    className="
                      mt-3
                      grid
                      grid-cols-2
                      gap-2
                      border-t
                      border-slate-100
                      pt-3
                      dark:border-slate-700
                    "
                  >
                    <div className="text-start">
                      <p
                        className="
                          text-[10px]
                          font-bold
                          text-slate-400
                        "
                      >
                        {labels.available}
                      </p>

                      <p
                        className="
                          mt-1
                          truncate
                          text-xs
                          font-black
                          text-slate-700
                          dark:text-slate-200
                        "
                      >
                        {formatCurrency(
                          balance.available,
                          balance.code,
                        )}
                      </p>
                    </div>

                    <div className="text-start">
                      <p
                        className="
                          text-[10px]
                          font-bold
                          text-slate-400
                        "
                      >
                        {labels.pending}
                      </p>

                      <p
                        className="
                          mt-1
                          truncate
                          text-xs
                          font-black
                          text-slate-700
                          dark:text-slate-200
                        "
                      >
                        {formatCurrency(
                          balance.pending,
                          balance.code,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="
                rounded-2xl
                border
                border-slate-100
                bg-white
                p-4
                dark:border-slate-700
                dark:bg-slate-900/30
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-2
                  "
                >
                  <div
                    className="
                      flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-xl
                    "
                    style={{
                      backgroundColor:
                        `${accentColor}14`,

                      color:
                        accentColor,
                    }}
                  >
                    <MdSwapVert />
                  </div>

                  <div className="text-start">
                    <h3
                      className="
                        text-sm
                        font-black
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {labels.exchangeRates}
                    </h3>

                    {currentQuote && (
                      <p
                        className="
                          mt-0.5
                          text-[10px]
                          font-bold
                          text-slate-400
                        "
                        dir="ltr"
                      >
                        v{currentQuote.version}
                      </p>
                    )}
                  </div>
                </div>

                {isAdmin
                  && !editingRate && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="
                      flex
                      items-center
                      gap-1.5
                      rounded-xl
                      border
                      px-3
                      py-2
                      text-[11px]
                      font-black
                      transition
                      hover:opacity-90
                    "
                    style={{
                      backgroundColor:
                        `${accentColor}10`,

                      borderColor:
                        `${accentColor}24`,

                      color:
                        accentColor,
                    }}
                  >
                    <FiEdit3 />
                    {labels.edit}
                  </button>
                )}
              </div>

              {currentQuote ? (
                <div
                  className="
                    mt-4
                    grid
                    gap-2
                    sm:grid-cols-2
                  "
                >
                  <div
                    className="
                      rounded-xl
                      bg-slate-50
                      p-3
                      dark:bg-slate-800/60
                    "
                  >
                    <p
                      className="
                        text-[10px]
                        font-bold
                        text-slate-400
                      "
                    >
                      {labels.buyRate}
                    </p>

                    <p
                      className="
                        mt-1
                        text-base
                        font-black
                        text-slate-900
                        dark:text-white
                      "
                      dir="ltr"
                    >
                      {formatNumber(
                        currentBuyRate,
                        6,
                      )} SYP
                    </p>
                  </div>

                  <div
                    className="
                      rounded-xl
                      bg-slate-50
                      p-3
                      dark:bg-slate-800/60
                    "
                  >
                    <p
                      className="
                        text-[10px]
                        font-bold
                        text-slate-400
                      "
                    >
                      {labels.sellRate}
                    </p>

                    <p
                      className="
                        mt-1
                        text-base
                        font-black
                        text-slate-900
                        dark:text-white
                      "
                      dir="ltr"
                    >
                      {formatNumber(
                        currentSellRate,
                        6,
                      )} SYP
                    </p>
                  </div>

                  <div
                    className="
                      rounded-xl
                      bg-slate-50
                      p-3
                      dark:bg-slate-800/60
                    "
                  >
                    <p
                      className="
                        text-[10px]
                        font-bold
                        text-slate-400
                      "
                    >
                      {labels.spread}
                    </p>

                    <p
                      className="
                        mt-1
                        text-sm
                        font-black
                        text-slate-900
                        dark:text-white
                      "
                      dir="ltr"
                    >
                      {formatNumber(
                        currentSpread.amount,
                        6,
                      )} SYP
                    </p>
                  </div>

                  <div
                    className="
                      rounded-xl
                      bg-slate-50
                      p-3
                      dark:bg-slate-800/60
                    "
                  >
                    <p
                      className="
                        text-[10px]
                        font-bold
                        text-slate-400
                      "
                    >
                      {labels.spreadPercent}
                    </p>

                    <p
                      className="
                        mt-1
                        text-sm
                        font-black
                        text-slate-900
                        dark:text-white
                      "
                      dir="ltr"
                    >
                      {formatNumber(
                        currentSpread.percentage,
                        4,
                      )}%
                    </p>
                  </div>
                </div>
              ) : (
                <p
                  className="
                    mt-4
                    rounded-xl
                    border
                    border-dashed
                    border-slate-200
                    p-3
                    text-center
                    text-xs
                    font-bold
                    text-slate-400
                    dark:border-slate-700
                  "
                >
                  {labels.noQuote}
                </p>
              )}

              {editingRate && (
                <div
                  className="
                    mt-4
                    space-y-3
                    rounded-2xl
                    border
                    border-slate-200
                    bg-slate-50/70
                    p-4
                    dark:border-slate-700
                    dark:bg-slate-800/40
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                    "
                  >
                    <p
                      className="
                        text-xs
                        font-black
                        text-slate-800
                        dark:text-slate-200
                      "
                    >
                      {labels.edit}
                    </p>

                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="
                        text-slate-400
                        hover:text-slate-700
                        dark:hover:text-white
                      "
                    >
                      <AiOutlineClose />
                    </button>
                  </div>

                  <label className="block text-start">
                    <span
                      className="
                        mb-1.5
                        block
                        text-[10px]
                        font-black
                        text-slate-500
                      "
                    >
                      {labels.buyRate}
                    </span>

                    <input
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      dir="ltr"
                      value={rateForm.buy_rate}
                      onChange={(event) => (
                        setRateForm(
                          (previous) => ({
                            ...previous,
                            buy_rate:
                              event.target.value,
                          }),
                        )
                      )}
                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-3
                        py-2.5
                        text-sm
                        font-bold
                        text-slate-900
                        outline-none
                        focus:ring-4
                        focus:ring-slate-100
                        dark:border-slate-700
                        dark:bg-slate-900
                        dark:text-white
                        dark:focus:ring-slate-800
                      "
                    />

                    <p
                      className="
                        mt-1
                        text-[10px]
                        font-semibold
                        text-slate-400
                      "
                    >
                      {labels.buyHint}
                    </p>
                  </label>

                  <label className="block text-start">
                    <span
                      className="
                        mb-1.5
                        block
                        text-[10px]
                        font-black
                        text-slate-500
                      "
                    >
                      {labels.sellRate}
                    </span>

                    <input
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      dir="ltr"
                      value={rateForm.sell_rate}
                      onChange={(event) => (
                        setRateForm(
                          (previous) => ({
                            ...previous,
                            sell_rate:
                              event.target.value,
                          }),
                        )
                      )}
                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-3
                        py-2.5
                        text-sm
                        font-bold
                        text-slate-900
                        outline-none
                        focus:ring-4
                        focus:ring-slate-100
                        dark:border-slate-700
                        dark:bg-slate-900
                        dark:text-white
                        dark:focus:ring-slate-800
                      "
                    />

                    <p
                      className="
                        mt-1
                        text-[10px]
                        font-semibold
                        text-slate-400
                      "
                    >
                      {labels.sellHint}
                    </p>
                  </label>

                  <div
                    className={`
                      grid
                      grid-cols-2
                      gap-2
                      rounded-xl
                      border
                      p-3
                      ${
                        previewSpread.valid
                          ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                          : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
                      }
                    `}
                  >
                    <div className="text-start">
                      <p
                        className="
                          text-[10px]
                          font-bold
                          text-slate-400
                        "
                      >
                        {labels.spread}
                      </p>

                      <p
                        className="
                          mt-1
                          text-xs
                          font-black
                          text-slate-900
                          dark:text-white
                        "
                        dir="ltr"
                      >
                        {formatNumber(
                          previewSpread.amount,
                          6,
                        )} SYP
                      </p>
                    </div>

                    <div className="text-start">
                      <p
                        className="
                          text-[10px]
                          font-bold
                          text-slate-400
                        "
                      >
                        {labels.spreadPercent}
                      </p>

                      <p
                        className="
                          mt-1
                          text-xs
                          font-black
                          text-slate-900
                          dark:text-white
                        "
                        dir="ltr"
                      >
                        {formatNumber(
                          previewSpread.percentage,
                          4,
                        )}%
                      </p>
                    </div>
                  </div>

                  {!previewSpread.valid
                    && rateForm.buy_rate
                    && rateForm.sell_rate && (
                    <p
                      className="
                        text-start
                        text-[10px]
                        font-bold
                        text-red-600
                        dark:text-red-300
                      "
                    >
                      {labels.sellBelowBuy}
                    </p>
                  )}

                  <label className="block text-start">
                    <span
                      className="
                        mb-1.5
                        block
                        text-[10px]
                        font-black
                        text-slate-500
                      "
                    >
                      {labels.note}
                    </span>

                    <textarea
                      rows="3"
                      value={
                        rateForm.activation_note
                      }
                      onChange={(event) => (
                        setRateForm(
                          (previous) => ({
                            ...previous,
                            activation_note:
                              event.target.value,
                          }),
                        )
                      )}
                      placeholder={
                        labels.notePlaceholder
                      }
                      className="
                        w-full
                        resize-none
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-3
                        py-2.5
                        text-xs
                        font-semibold
                        text-slate-900
                        outline-none
                        focus:ring-4
                        focus:ring-slate-100
                        dark:border-slate-700
                        dark:bg-slate-900
                        dark:text-white
                        dark:focus:ring-slate-800
                      "
                    />
                  </label>

                  {updateError && (
                    <p
                      className="
                        rounded-xl
                        border
                        border-red-200
                        bg-red-50
                        p-2.5
                        text-start
                        text-[10px]
                        font-bold
                        text-red-700
                        dark:border-red-900/40
                        dark:bg-red-950/20
                        dark:text-red-300
                      "
                    >
                      {updateError}
                    </p>
                  )}

                  <div
                    className="
                      flex
                      gap-2
                    "
                  >
                    <button
                      type="button"
                      disabled={
                        updateLoading
                        || !previewSpread.valid
                      }
                      onClick={updateExchangeRate}
                      className="
                        flex
                        flex-1
                        items-center
                        justify-center
                        gap-1.5
                        rounded-xl
                        px-3
                        py-2.5
                        text-xs
                        font-black
                        text-white
                        transition
                        hover:opacity-90
                        disabled:cursor-not-allowed
                        disabled:opacity-50
                      "
                      style={{
                        backgroundColor:
                          accentColor,
                      }}
                    >
                      {updateLoading
                        ? (
                          <MdRefresh className="animate-spin" />
                        )
                        : (
                          <AiOutlineSave />
                        )}

                      {updateLoading
                        ? labels.saving
                        : labels.save}
                    </button>

                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-3
                        py-2.5
                        text-xs
                        font-black
                        text-slate-600
                        hover:bg-slate-50
                        dark:border-slate-700
                        dark:bg-slate-900
                        dark:text-slate-300
                      "
                    >
                      {labels.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Currencies;