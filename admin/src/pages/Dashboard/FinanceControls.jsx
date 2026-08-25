import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  FiActivity,
  FiAlertCircle,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiRefreshCw,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { localizeRuntimeValue } from '../../utils/runtimeLocalization';
import { useStateContext } from '../../contexts/ContextProvider';

// ======================================================
// Helpers
// ======================================================

const messageFrom = (error, fallback) => (
  error?.response?.data?.error
  || error?.response?.data?.detail
  || error?.response?.data?.code
  || fallback
);

const inputClass = `
  w-full
  rounded-xl
  border
  border-slate-200
  bg-white
  px-3.5
  py-2.5
  text-sm
  font-semibold
  text-slate-900
  outline-none
  transition-all
  duration-200
  focus:border-slate-300
  focus:ring-4
  focus:ring-slate-100
  disabled:cursor-not-allowed
  disabled:opacity-60
  dark:border-slate-700
  dark:bg-slate-900
  dark:text-white
  dark:focus:ring-slate-800
`;

const FINANCE_METRIC_ALIASES = {
  deposit: 'deposits',
  withdrawal: 'withdrawals',
  withdraw: 'withdrawals',
  purchase: 'purchases',
  provider_costs: 'provider_cost',
  gross_profits: 'gross_profit',
  net_profits: 'net_profit',
};

const FINANCE_STATUS_ALIASES = {
  complete: 'completed',
  success: 'completed',
  successful: 'completed',
  canceled: 'cancelled',
  processing: 'in_progress',
};

// ======================================================
// Currency Amounts
// ======================================================

const CurrencyAmounts = ({
  values,
  locale,
}) => {
  const entries = Object.entries(
    values || {},
  );

  if (!entries.length) {
    return (
      <span className="text-slate-400">
        —
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      {entries.map(
        ([currency, amount]) => (
          <div
            key={currency}
            className="
              flex
              items-center
              gap-2
            "
          >
            <span
              className="
                font-bold
                text-slate-800
                dark:text-white
              "
            >
              {Number(
                amount || 0,
              ).toLocaleString(
                locale,
                {
                  maximumFractionDigits: 6,
                },
              )}
            </span>

            <span
              className="
                rounded-md
                bg-slate-100
                px-1.5
                py-0.5
                text-[10px]
                font-bold
                text-slate-500
                dark:bg-slate-800
                dark:text-slate-400
              "
              dir="ltr"
            >
              {currency}
            </span>
          </div>
        ),
      )}
    </div>
  );
};

// ======================================================
// Rate Card
// ======================================================

const RateCard = ({
  label,
  helper,
  value,
  suffix = 'SYP',
  accentColor,
  icon,
}) => (
  <div
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
        items-start
        justify-between
        gap-3
      "
    >
      <div className="min-w-0 text-start">
        <p
          className="
            text-xs
            font-extrabold
            text-slate-500
            dark:text-slate-400
          "
        >
          {label}
        </p>

        <div
          className="
            mt-2
            flex
            flex-wrap
            items-baseline
            gap-2
          "
          dir="ltr"
        >
          <span
            className="
              text-2xl
              font-black
              tracking-tight
              text-slate-950
              dark:text-white
              md:text-3xl
            "
          >
            {value}
          </span>

          {suffix && (
            <span
              className="
                text-xs
                font-black
                text-slate-400
              "
            >
              {suffix}
            </span>
          )}
        </div>

        {helper && (
          <p
            className="
              mt-2
              text-xs
              font-semibold
              leading-5
              text-slate-400
            "
          >
            {helper}
          </p>
        )}
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
        "
        style={{
          backgroundColor: `${accentColor}14`,
          color: accentColor,
        }}
      >
        {icon}
      </div>
    </div>
  </div>
);

// ======================================================
// Finance Controls
// ======================================================

const FinanceControls = () => {
  const {
    t,
    i18n,
  } = useTranslation([
    'currencies',
    'common',
  ]);

  const {
    currentColor,
  } = useStateContext();

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
    buyRate: isArabic
      ? 'سعر شراء الدولار'
      : 'USD buy rate',

    sellRate: isArabic
      ? 'سعر بيع الدولار'
      : 'USD sell rate',

    buyHelper: isArabic
      ? 'السعر الذي تشتري به المنصة 1 USD.'
      : 'The rate at which the platform buys 1 USD.',

    sellHelper: isArabic
      ? 'السعر الذي تبيع به المنصة 1 USD.'
      : 'The rate at which the platform sells 1 USD.',

    spread: isArabic
      ? 'فرق السعر'
      : 'Spread',

    spreadPercent: isArabic
      ? 'نسبة الفرق'
      : 'Spread percentage',

    currentQuote: isArabic
      ? 'سعر الصرف الحالي'
      : 'Current exchange quote',

    currentQuoteSubtitle: isArabic
      ? 'سعر شراء وسعر بيع الدولار مقابل الليرة السورية.'
      : 'USD buy and sell rates against SYP.',

    activateTitle: isArabic
      ? 'تفعيل سعر صرف جديد'
      : 'Activate new exchange quote',

    activateHint: isArabic
      ? 'حدد سعر الشراء وسعر البيع بشكل منفصل. يجب أن يكون سعر البيع أكبر من أو يساوي سعر الشراء.'
      : 'Set buy and sell rates separately. Sell rate must be greater than or equal to buy rate.',

    note: isArabic
      ? 'ملاحظة التفعيل'
      : 'Activation note',

    notePlaceholder: isArabic
      ? 'مثال: تحديث سعر الصرف حسب السوق...'
      : 'Example: Market exchange-rate update...',

    preview: isArabic
      ? 'معاينة قبل التفعيل'
      : 'Preview before activation',

    invalidRates: isArabic
      ? 'أدخل سعر شراء وسعر بيع صحيحين وأكبر من صفر.'
      : 'Enter valid buy and sell rates greater than zero.',

    sellBelowBuy: isArabic
      ? 'سعر البيع لا يمكن أن يكون أقل من سعر الشراء.'
      : 'Sell rate cannot be below buy rate.',

    noteRequired: isArabic
      ? 'ملاحظة التفعيل مطلوبة.'
      : 'Activation note is required.',

    confirm: (buy, sell, spread, percent) => (
      isArabic
        ? `تأكيد تفعيل السعر الجديد؟\nشراء: ${buy} SYP\nبيع: ${sell} SYP\nالفرق: ${spread} SYP (${percent}%)`
        : `Activate the new quote?\nBuy: ${buy} SYP\nSell: ${sell} SYP\nSpread: ${spread} SYP (${percent}%)`
    ),

    activated: isArabic
      ? 'تم تفعيل سعر الصرف الجديد بنجاح.'
      : 'The new exchange quote was activated successfully.',

    active: isArabic
      ? 'نشط'
      : 'Active',

    noCurrent: isArabic
      ? 'لا يوجد سعر صرف نشط حالياً.'
      : 'There is no active exchange quote.',

    history: isArabic
      ? 'سجل أسعار الصرف'
      : 'Exchange-rate history',

    historySubtitle: isArabic
      ? 'كل نسخة محفوظة مع سعر الشراء والبيع والفرق.'
      : 'Every quote version with buy rate, sell rate, and spread.',

    version: isArabic
      ? 'النسخة'
      : 'Version',

    status: isArabic
      ? 'الحالة'
      : 'Status',

    created: isArabic
      ? 'تاريخ الإنشاء'
      : 'Created',

    superseded: isArabic
      ? 'تاريخ الاستبدال'
      : 'Superseded',

    activate: isArabic
      ? 'تفعيل السعر'
      : 'Activate quote',

    activating: isArabic
      ? 'جاري التفعيل...'
      : 'Activating...',

    live: isArabic
      ? 'السعر الفعّال حالياً'
      : 'Currently active quote',

    oneUsd: isArabic
      ? 'لكل 1 USD'
      : 'per 1 USD',

    noHistory: isArabic
      ? 'لا يوجد سجل أسعار صرف بعد.'
      : 'No exchange-rate history yet.',

    reports: isArabic
      ? 'التقارير المالية'
      : 'Financial reports',

    rates: isArabic
      ? 'أسعار الصرف'
      : 'Exchange rates',
  }), [isArabic]);

  const [tab, setTab] = useState('rates');

  const [currentQuote, setCurrentQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const [report, setReport] = useState(null);

  const [rateForm, setRateForm] = useState({
    buy_rate: '',
    sell_rate: '',
    activation_note: '',
  });

  const [reportForm, setReportForm] = useState({
    period: 'daily',
    date: '',
    start_date: '',
    end_date: '',
  });

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ====================================================
  // Formatting
  // ====================================================

  const money = useCallback(
    (value) => (
      Number(
        value || 0,
      ).toLocaleString(
        locale,
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: 6,
        },
      )
    ),
    [locale],
  );

  const formatDate = useCallback(
    (value) => {
      if (!value) {
        return '—';
      }

      const date = new Date(
        value,
      );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return String(value);
      }

      return date.toLocaleString(
        locale,
      );
    },
    [locale],
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

      const percentage = (
        amount / buy
      ) * 100;

      return {
        valid: sell >= buy,
        amount,
        percentage,
      };
    },
    [],
  );

  // ====================================================
  // Load Exchange Rates
  // ====================================================

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const historyResponse = await axiosInstance.get(
        '/wallets/exchange-rates/history/',
      );

      const quotes = Array.isArray(
        historyResponse.data,
      )
        ? historyResponse.data
        : historyResponse.data?.results || [];

      setHistory(quotes);

      try {
        const currentResponse = await axiosInstance.get(
          '/wallets/exchange-rates/current/',
        );

        const quote = currentResponse.data;

        setCurrentQuote(quote);

        setRateForm((previous) => ({
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
        }));
      } catch (currentError) {
        if (
          currentError?.response?.status
          !== 503
        ) {
          throw currentError;
        }

        setCurrentQuote(null);
      }
    } catch (loadError) {
      setError(
        messageFrom(
          loadError,
          t(
            'financeControls.errors.loadRates',
            {
              defaultValue: isArabic
                ? 'تعذر تحميل أسعار الصرف.'
                : 'Failed to load exchange rates.',
            },
          ),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [
    isArabic,
    t,
  ]);

  // ====================================================
  // Load Financial Report
  // ====================================================

  const loadReport = useCallback(
    async (params) => {
      const selectedParams = (
        params || reportForm
      );

      setLoading(true);
      setError('');

      try {
        const requestParams = {
          period: selectedParams.period,
        };

        if (
          selectedParams.period
          === 'custom'
        ) {
          requestParams.start_date =
            selectedParams.start_date;

          requestParams.end_date =
            selectedParams.end_date;
        } else if (
          selectedParams.date
        ) {
          requestParams.date =
            selectedParams.date;
        }

        const response = await axiosInstance.get(
          '/finance/reports/financial/',
          {
            params: requestParams,
          },
        );

        setReport(
          response.data,
        );
      } catch (loadError) {
        setError(
          messageFrom(
            loadError,
            t(
              'financeControls.errors.loadReport',
              {
                defaultValue: isArabic
                  ? 'تعذر تحميل التقرير المالي.'
                  : 'Failed to load the financial report.',
              },
            ),
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [
      isArabic,
      reportForm,
      t,
    ],
  );

  // ====================================================
  // Initial / Tab Loading
  // ====================================================

  useEffect(() => {
    if (tab === 'rates') {
      loadRates();
    } else {
      loadReport();
    }
  }, [
    loadRates,
    loadReport,
    tab,
  ]);

  // ====================================================
  // Activate Quote
  // ====================================================

  const activateQuote = async (event) => {
    event.preventDefault();

    if (mutating) {
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
      setError(
        labels.invalidRates,
      );

      return;
    }

    if (
      sellRate < buyRate
    ) {
      setError(
        labels.sellBelowBuy,
      );

      return;
    }

    if (!note) {
      setError(
        labels.noteRequired,
      );

      return;
    }

    const spread = calculateSpread(
      buyRate,
      sellRate,
    );

    if (
      !window.confirm(
        labels.confirm(
          money(buyRate),
          money(sellRate),
          money(spread.amount),
          money(spread.percentage),
        ),
      )
    ) {
      return;
    }

    setMutating(true);
    setError('');
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
            currentQuote?.quote_id ?? null,
        },
      );

      setNotice(
        labels.activated,
      );

      setRateForm((previous) => ({
        ...previous,
        activation_note: '',
      }));

      await loadRates();
    } catch (saveError) {
      const fallback = (
        saveError?.response?.status
        === 409
      )
        ? t(
            'financeControls.errors.quoteChanged',
            {
              defaultValue: isArabic
                ? 'تم تغيير السعر الحالي من مدير آخر. حدث الصفحة وحاول مجدداً.'
                : 'The active quote changed. Refresh and try again.',
            },
          )
        : t(
            'financeControls.errors.activate',
            {
              defaultValue: isArabic
                ? 'تعذر تفعيل سعر الصرف.'
                : 'Failed to activate the exchange quote.',
            },
          );

      setError(
        messageFrom(
          saveError,
          fallback,
        ),
      );
    } finally {
      setMutating(false);
    }
  };

  // ====================================================
  // Submit Report
  // ====================================================

  const submitReport = (event) => {
    event.preventDefault();

    if (
      reportForm.period === 'custom'
      && (
        !reportForm.start_date
        || !reportForm.end_date
      )
    ) {
      setError(
        t(
          'financeControls.validation.customDates',
          {
            defaultValue: isArabic
              ? 'حدد تاريخ البداية والنهاية.'
              : 'Select both start and end dates.',
          },
        ),
      );

      return;
    }

    loadReport(
      reportForm,
    );
  };

  // ====================================================
  // Runtime labels
  // ====================================================

  const metricLabel = (key) => (
    localizeRuntimeValue({
      t,
      i18n,
      value: key,
      namespace: 'currencies',
      prefix: 'financeControls.metrics',
      aliases: FINANCE_METRIC_ALIASES,
      fallback: () => (
        t(
          'financeControls.metrics.other',
          {
            defaultValue: key,
          },
        )
      ),
    })
  );

  const statusLabel = (status) => (
    localizeRuntimeValue({
      t,
      i18n,
      value: status,
      namespace: 'currencies',
      prefix: 'financeControls.status',
      aliases: FINANCE_STATUS_ALIASES,
      fallback: () => (
        t(
          'financeControls.status.unknown',
          {
            defaultValue:
              status || '—',
          },
        )
      ),
    })
  );

  const periodLabel = (period) => (
    localizeRuntimeValue({
      t,
      i18n,
      value: period,
      namespace: 'currencies',
      prefix: 'financeControls.periods',
      fallback: () => (
        t(
          'financeControls.periods.unknown',
          {
            defaultValue:
              period || '—',
          },
        )
      ),
    })
  );

  // ====================================================
  // Derived rate values
  // ====================================================

  const currentBuyRate = Number(
    currentQuote?.platform_buy_usd_rate_syp
    || currentQuote?.usd_to_syp
    || 0,
  );

  const currentSellRate = Number(
    currentQuote?.platform_sell_usd_rate_syp
    || currentQuote?.platform_buy_usd_rate_syp
    || currentQuote?.usd_to_syp
    || 0,
  );

  const currentSpread = (
    currentQuote
      ? {
          amount: Number(
            currentQuote.spread_amount
            ?? (
              currentSellRate
              - currentBuyRate
            ),
          ),

          percentage: Number(
            currentQuote.spread_percentage
            ?? (
              currentBuyRate > 0
                ? (
                    (
                      currentSellRate
                      - currentBuyRate
                    )
                    / currentBuyRate
                  ) * 100
                : 0
            ),
          ),
        }
      : {
          amount: 0,
          percentage: 0,
        }
  );

  const previewSpread = calculateSpread(
    rateForm.buy_rate,
    rateForm.sell_rate,
  );

  const hasPreviewRates = Boolean(
    rateForm.buy_rate
    && rateForm.sell_rate
  );

  const previewInvalid = (
    hasPreviewRates
    && !previewSpread.valid
  );

  const handleRefresh = () => {
    setNotice('');

    if (tab === 'rates') {
      loadRates();
    } else {
      loadReport(
        reportForm,
      );
    }
  };

  // ====================================================
  // Render
  // ====================================================

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="
        mt-20
        px-3
        py-4
        sm:px-5
        md:mt-4
        md:px-8
        md:py-6
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-7xl
          space-y-6
        "
      >
        {/* =============================================
            PAGE HEADER
        ============================================= */}

        <section
          className="
            relative
            overflow-hidden
            rounded-3xl
            border
            border-slate-100
            bg-white
            px-5
            py-6
            shadow-sm
            dark:border-slate-800
            dark:bg-secondary-dark-bg
            md:px-7
            md:py-7
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              -start-24
              -top-28
              h-64
              w-64
              rounded-full
              opacity-[0.08]
            "
            style={{
              backgroundColor:
                accentColor,
            }}
          />

          <div
            className="
              pointer-events-none
              absolute
              -bottom-24
              end-10
              h-48
              w-48
              rounded-full
              opacity-[0.04]
            "
            style={{
              backgroundColor:
                accentColor,
            }}
          />

          <div
            className="
              relative
              z-10
              flex
              flex-col
              justify-between
              gap-5
              sm:flex-row
              sm:items-center
            "
          >
            <div className="text-start">
              <div
                className="
                  mb-2
                  flex
                  items-center
                  gap-2
                "
              >
                <span
                  className="
                    h-2.5
                    w-2.5
                    rounded-full
                  "
                  style={{
                    backgroundColor:
                      accentColor,
                  }}
                />

                <span
                  className="
                    text-sm
                    font-bold
                    md:text-base
                  "
                  style={{
                    color:
                      accentColor,
                  }}
                >
                  {t(
                    'financeControls.category',
                    {
                      defaultValue:
                        isArabic
                          ? 'الإدارة المالية'
                          : 'Finance Management',
                    },
                  )}
                </span>
              </div>

              <h1
                className="
                  text-2xl
                  font-extrabold
                  tracking-tight
                  text-slate-900
                  dark:text-white
                  md:text-3xl
                  lg:text-4xl
                "
              >
                {t(
                  'financeControls.title',
                  {
                    defaultValue:
                      isArabic
                        ? 'التحكم المالي'
                        : 'Finance Controls',
                  },
                )}
              </h1>

              <p
                className="
                  mt-2
                  max-w-2xl
                  text-sm
                  leading-6
                  text-slate-500
                  dark:text-slate-400
                "
              >
                {t(
                  'financeControls.subtitle',
                  {
                    defaultValue:
                      isArabic
                        ? 'إدارة أسعار الصرف والتقارير المالية من مكان واحد.'
                        : 'Manage exchange rates and financial reports from one place.',
                  },
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                px-5
                py-2.5
                text-sm
                font-bold
                text-white
                shadow-sm
                transition
                hover:opacity-90
                disabled:cursor-not-allowed
                disabled:opacity-60
                sm:w-auto
              "
              style={{
                backgroundColor:
                  accentColor,
              }}
            >
              <FiRefreshCw
                className={
                  loading
                    ? 'animate-spin'
                    : ''
                }
              />

              {t(
                'financeControls.refresh',
                {
                  defaultValue:
                    isArabic
                      ? 'تحديث البيانات'
                      : 'Refresh',
                },
              )}
            </button>
          </div>
        </section>

        {/* =============================================
            TABS
        ============================================= */}

        <section
          className="
            rounded-2xl
            border
            border-slate-100
            bg-white
            p-2
            shadow-sm
            dark:border-slate-800
            dark:bg-secondary-dark-bg
          "
        >
          <div
            className="
              grid
              gap-2
              sm:grid-cols-2
            "
          >
            {[
              {
                id: 'rates',
                label: labels.rates,
                icon: <FiDollarSign />,
              },
              {
                id: 'reports',
                label: labels.reports,
                icon: <FiBarChart2 />,
              },
            ].map((item) => {
              const active = (
                tab === item.id
              );

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(
                      item.id,
                    );

                    setError('');
                    setNotice('');
                  }}
                  className={`
                    flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    px-4
                    py-3
                    text-sm
                    font-black
                    transition
                    ${
                      active
                        ? 'text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                    }
                  `}
                  style={
                    active
                      ? {
                          backgroundColor:
                            accentColor,
                        }
                      : undefined
                  }
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* =============================================
            NOTICE
        ============================================= */}

        {notice && (
          <div
            className="
              flex
              items-start
              gap-3
              rounded-2xl
              border
              border-slate-200
              bg-white
              px-4
              py-3.5
              text-sm
              font-bold
              text-slate-700
              shadow-sm
              dark:border-slate-700
              dark:bg-slate-900
              dark:text-slate-200
            "
          >
            <FiCheckCircle
              className="
                mt-0.5
                shrink-0
                text-lg
              "
              style={{
                color:
                  accentColor,
              }}
            />

            <span className="flex-1">
              {notice}
            </span>

            <button
              type="button"
              onClick={() => (
                setNotice('')
              )}
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-lg
                text-slate-400
                transition
                hover:bg-slate-100
                dark:hover:bg-slate-800
              "
            >
              <FiX />
            </button>
          </div>
        )}

        {/* =============================================
            ERROR
        ============================================= */}

        {error && (
          <div
            className="
              flex
              items-start
              gap-3
              rounded-2xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3.5
              text-sm
              font-bold
              text-red-700
              dark:border-red-900/40
              dark:bg-red-950/30
              dark:text-red-300
            "
          >
            <FiAlertCircle
              className="
                mt-0.5
                shrink-0
                text-lg
              "
            />

            <span className="flex-1">
              {error}
            </span>

            <button
              type="button"
              onClick={() => (
                setError('')
              )}
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-lg
                transition
                hover:bg-red-100
                dark:hover:bg-red-900/50
              "
            >
              <FiX />
            </button>
          </div>
        )}

        {/* =============================================
            EXCHANGE RATES
        ============================================= */}

        {tab === 'rates' && (
          <div className="space-y-6">
            {/* Current Quote */}

            <section
              className="
                overflow-hidden
                rounded-3xl
                border
                border-slate-100
                bg-white
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
              "
            >
              <div
                className="
                  flex
                  flex-col
                  justify-between
                  gap-4
                  border-b
                  border-slate-100
                  px-5
                  py-4
                  dark:border-slate-800
                  sm:flex-row
                  sm:items-center
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-3
                  "
                >
                  <div
                    className="
                      flex
                      h-11
                      w-11
                      items-center
                      justify-center
                      rounded-xl
                    "
                    style={{
                      color:
                        accentColor,

                      backgroundColor:
                        `${accentColor}14`,
                    }}
                  >
                    <FiDollarSign />
                  </div>

                  <div className="text-start">
                    <h2
                      className="
                        font-black
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {labels.currentQuote}
                    </h2>

                    <p
                      className="
                        mt-0.5
                        text-xs
                        font-semibold
                        text-slate-400
                      "
                    >
                      {labels.currentQuoteSubtitle}
                    </p>
                  </div>
                </div>

                {currentQuote && (
                  <span
                    className="
                      inline-flex
                      w-fit
                      items-center
                      gap-2
                      rounded-full
                      border
                      px-3
                      py-1.5
                      text-xs
                      font-black
                    "
                    style={{
                      color:
                        accentColor,

                      backgroundColor:
                        `${accentColor}10`,

                      borderColor:
                        `${accentColor}28`,
                    }}
                  >
                    <span
                      className="
                        h-2
                        w-2
                        rounded-full
                      "
                      style={{
                        backgroundColor:
                          accentColor,
                      }}
                    />

                    {labels.active}
                  </span>
                )}
              </div>

              <div className="p-5">
                {loading ? (
                  <div
                    className="
                      flex
                      min-h-[180px]
                      items-center
                      justify-center
                    "
                  >
                    <FiRefreshCw
                      className="
                        animate-spin
                        text-3xl
                        text-slate-400
                      "
                    />
                  </div>
                ) : currentQuote ? (
                  <>
                    <div
                      className="
                        grid
                        gap-3
                        md:grid-cols-3
                      "
                    >
                      <RateCard
                        label={
                          labels.buyRate
                        }
                        helper={
                          labels.buyHelper
                        }
                        value={
                          money(
                            currentBuyRate,
                          )
                        }
                        accentColor={
                          accentColor
                        }
                        icon={
                          <FiDollarSign />
                        }
                      />

                      <RateCard
                        label={
                          labels.sellRate
                        }
                        helper={
                          labels.sellHelper
                        }
                        value={
                          money(
                            currentSellRate,
                          )
                        }
                        accentColor={
                          accentColor
                        }
                        icon={
                          <FiTrendingUp />
                        }
                      />

                      <RateCard
                        label={
                          labels.spread
                        }
                        helper={`${labels.spreadPercent}: ${money(
                          currentSpread.percentage,
                        )}%`}
                        value={
                          money(
                            currentSpread.amount,
                          )
                        }
                        accentColor={
                          accentColor
                        }
                        icon={
                          <FiActivity />
                        }
                      />
                    </div>

                    <div
                      className="
                        mt-4
                        grid
                        gap-3
                        rounded-2xl
                        border
                        border-slate-100
                        bg-slate-50/70
                        p-4
                        text-xs
                        font-semibold
                        text-slate-500
                        dark:border-slate-700
                        dark:bg-slate-900/40
                        dark:text-slate-400
                        md:grid-cols-3
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <FiActivity />

                        <span dir="ltr">
                          v{currentQuote.version}
                          {' · '}
                          #{currentQuote.quote_id}
                        </span>
                      </div>

                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <FiClock />

                        <span>
                          {formatDate(
                            currentQuote.effective_at,
                          )}
                        </span>
                      </div>

                      <div
                        className="
                          truncate
                          text-start
                        "
                        title={
                          currentQuote.activation_note
                          || ''
                        }
                      >
                        {currentQuote.activation_note
                        || '—'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    className="
                      flex
                      min-h-[180px]
                      flex-col
                      items-center
                      justify-center
                      gap-3
                      text-center
                    "
                  >
                    <FiAlertCircle
                      className="
                        text-3xl
                        text-amber-500
                      "
                    />

                    <p
                      className="
                        text-sm
                        font-bold
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      {labels.noCurrent}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <div
              className="
                grid
                gap-6
                xl:grid-cols-[420px_minmax(0,1fr)]
              "
            >
              {/* Activate Quote */}

              <form
                onSubmit={
                  activateQuote
                }
                className="
                  h-fit
                  rounded-3xl
                  border
                  border-slate-100
                  bg-white
                  p-5
                  shadow-sm
                  dark:border-slate-800
                  dark:bg-secondary-dark-bg
                "
              >
                <div
                  className="
                    mb-5
                    flex
                    items-start
                    gap-3
                  "
                >
                  <div
                    className="
                      flex
                      h-11
                      w-11
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                    "
                    style={{
                      color:
                        accentColor,

                      backgroundColor:
                        `${accentColor}14`,
                    }}
                  >
                    <FiTrendingUp />
                  </div>

                  <div className="text-start">
                    <h2
                      className="
                        font-black
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {labels.activateTitle}
                    </h2>

                    <p
                      className="
                        mt-1
                        text-xs
                        font-semibold
                        leading-5
                        text-slate-400
                      "
                    >
                      {labels.activateHint}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <label
                    className="
                      block
                      text-sm
                      font-black
                      text-slate-700
                      dark:text-slate-200
                    "
                  >
                    {labels.buyRate}

                    <div
                      className="
                        relative
                        mt-2
                      "
                    >
                      <input
                        className={inputClass}
                        dir="ltr"
                        type="number"
                        min="0.000001"
                        step="0.000001"
                        value={
                          rateForm.buy_rate
                        }
                        onChange={(event) => (
                          setRateForm(
                            (previous) => ({
                              ...previous,

                              buy_rate:
                                event.target.value,
                            }),
                          )
                        )}
                        required
                      />

                      <span
                        className="
                          pointer-events-none
                          absolute
                          end-3
                          top-1/2
                          -translate-y-1/2
                          text-xs
                          font-black
                          text-slate-400
                        "
                      >
                        SYP
                      </span>
                    </div>
                  </label>

                  <label
                    className="
                      block
                      text-sm
                      font-black
                      text-slate-700
                      dark:text-slate-200
                    "
                  >
                    {labels.sellRate}

                    <div
                      className="
                        relative
                        mt-2
                      "
                    >
                      <input
                        className={inputClass}
                        dir="ltr"
                        type="number"
                        min="0.000001"
                        step="0.000001"
                        value={
                          rateForm.sell_rate
                        }
                        onChange={(event) => (
                          setRateForm(
                            (previous) => ({
                              ...previous,

                              sell_rate:
                                event.target.value,
                            }),
                          )
                        )}
                        required
                      />

                      <span
                        className="
                          pointer-events-none
                          absolute
                          end-3
                          top-1/2
                          -translate-y-1/2
                          text-xs
                          font-black
                          text-slate-400
                        "
                      >
                        SYP
                      </span>
                    </div>
                  </label>

                  <div
                    className={`
                      rounded-2xl
                      border
                      p-4
                      ${
                        previewInvalid
                          ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
                          : 'border-slate-100 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/40'
                      }
                    `}
                  >
                    <p
                      className="
                        text-xs
                        font-black
                        text-slate-400
                      "
                    >
                      {labels.preview}
                    </p>

                    <div
                      className="
                        mt-3
                        grid
                        grid-cols-2
                        gap-3
                      "
                    >
                      <div>
                        <p
                          className="
                            text-[11px]
                            font-bold
                            text-slate-400
                          "
                        >
                          {labels.spread}
                        </p>

                        <p
                          className="
                            mt-1
                            font-black
                            text-slate-900
                            dark:text-white
                          "
                          dir="ltr"
                        >
                          {money(
                            previewSpread.amount,
                          )} SYP
                        </p>
                      </div>

                      <div>
                        <p
                          className="
                            text-[11px]
                            font-bold
                            text-slate-400
                          "
                        >
                          {labels.spreadPercent}
                        </p>

                        <p
                          className="
                            mt-1
                            font-black
                            text-slate-900
                            dark:text-white
                          "
                          dir="ltr"
                        >
                          {money(
                            previewSpread.percentage,
                          )}%
                        </p>
                      </div>
                    </div>

                    {previewInvalid && (
                      <p
                        className="
                          mt-3
                          text-xs
                          font-bold
                          text-red-600
                          dark:text-red-300
                        "
                      >
                        {labels.sellBelowBuy}
                      </p>
                    )}
                  </div>

                  <label
                    className="
                      block
                      text-sm
                      font-black
                      text-slate-700
                      dark:text-slate-200
                    "
                  >
                    {labels.note}

                    <textarea
                      className={`
                        ${inputClass}
                        mt-2
                        min-h-[110px]
                        resize-none
                      `}
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
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={
                      mutating
                      || (
                        previewInvalid
                      )
                    }
                    className="
                      flex
                      w-full
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      px-4
                      py-3
                      text-sm
                      font-black
                      text-white
                      shadow-sm
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
                    {mutating && (
                      <FiRefreshCw
                        className="animate-spin"
                      />
                    )}

                    {mutating
                      ? labels.activating
                      : labels.activate}
                  </button>
                </div>
              </form>

              {/* History */}

              <section
                className="
                  min-w-0
                  overflow-hidden
                  rounded-3xl
                  border
                  border-slate-100
                  bg-white
                  shadow-sm
                  dark:border-slate-800
                  dark:bg-secondary-dark-bg
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                    border-b
                    border-slate-100
                    px-5
                    py-4
                    dark:border-slate-800
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-3
                    "
                  >
                    <div
                      className="
                        flex
                        h-11
                        w-11
                        items-center
                        justify-center
                        rounded-xl
                      "
                      style={{
                        color:
                          accentColor,

                        backgroundColor:
                          `${accentColor}14`,
                      }}
                    >
                      <FiClock />
                    </div>

                    <div className="text-start">
                      <h2
                        className="
                          font-black
                          text-slate-900
                          dark:text-white
                        "
                      >
                        {labels.history}
                      </h2>

                      <p
                        className="
                          mt-0.5
                          text-xs
                          font-semibold
                          text-slate-400
                        "
                      >
                        {labels.historySubtitle}
                      </p>
                    </div>
                  </div>

                  <span
                    className="
                      rounded-xl
                      px-3
                      py-1.5
                      text-xs
                      font-black
                    "
                    style={{
                      color:
                        accentColor,

                      backgroundColor:
                        `${accentColor}12`,
                    }}
                  >
                    {history.length}
                  </span>
                </div>

                {loading ? (
                  <div
                    className="
                      flex
                      min-h-[380px]
                      items-center
                      justify-center
                    "
                  >
                    <FiRefreshCw
                      className="
                        animate-spin
                        text-3xl
                        text-slate-400
                      "
                    />
                  </div>
                ) : history.length === 0 ? (
                  <div
                    className="
                      flex
                      min-h-[380px]
                      flex-col
                      items-center
                      justify-center
                      gap-3
                      p-5
                      text-center
                    "
                  >
                    <FiClock
                      className="
                        text-3xl
                        text-slate-300
                      "
                    />

                    <p
                      className="
                        text-sm
                        font-bold
                        text-slate-400
                      "
                    >
                      {labels.noHistory}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table
                      className="
                        min-w-[1050px]
                        divide-y
                        divide-slate-100
                        text-sm
                        dark:divide-slate-800
                      "
                    >
                      <thead
                        className="
                          bg-slate-50
                          dark:bg-slate-900/60
                        "
                      >
                        <tr>
                          {[
                            labels.version,
                            labels.buyRate,
                            labels.sellRate,
                            labels.spread,
                            labels.status,
                            labels.note,
                            labels.created,
                            labels.superseded,
                          ].map(
                            (heading) => (
                              <th
                                key={heading}
                                className="
                                  whitespace-nowrap
                                  px-4
                                  py-3.5
                                  text-start
                                  text-xs
                                  font-black
                                  text-slate-500
                                  dark:text-slate-400
                                "
                              >
                                {heading}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>

                      <tbody
                        className="
                          divide-y
                          divide-slate-100
                          dark:divide-slate-800
                        "
                      >
                        {history.map((quote) => {
                          const buy = Number(
                            quote.platform_buy_usd_rate_syp
                            || quote.usd_to_syp
                            || 0,
                          );

                          const sell = Number(
                            quote.platform_sell_usd_rate_syp
                            || quote.platform_buy_usd_rate_syp
                            || quote.usd_to_syp
                            || 0,
                          );

                          const spreadAmount = Number(
                            quote.spread_amount
                            ?? (
                              sell - buy
                            ),
                          );

                          const spreadPercentage = Number(
                            quote.spread_percentage
                            ?? (
                              buy > 0
                                ? (
                                    (
                                      sell - buy
                                    )
                                    / buy
                                  ) * 100
                                : 0
                            ),
                          );

                          const active = (
                            quote.status
                            === 'active'
                          );

                          return (
                            <tr
                              key={
                                quote.quote_id
                              }
                              className="
                                transition-colors
                                hover:bg-slate-50/70
                                dark:hover:bg-slate-800/40
                              "
                            >
                              <td
                                className="
                                  whitespace-nowrap
                                  px-4
                                  py-4
                                  font-black
                                  text-slate-900
                                  dark:text-white
                                "
                                dir="ltr"
                              >
                                v{quote.version}
                              </td>

                              <td
                                className="
                                  whitespace-nowrap
                                  px-4
                                  py-4
                                  font-bold
                                  text-slate-700
                                  dark:text-slate-200
                                "
                                dir="ltr"
                              >
                                {money(buy)} SYP
                              </td>

                              <td
                                className="
                                  whitespace-nowrap
                                  px-4
                                  py-4
                                  font-bold
                                  text-slate-700
                                  dark:text-slate-200
                                "
                                dir="ltr"
                              >
                                {money(sell)} SYP
                              </td>

                              <td
                                className="
                                  whitespace-nowrap
                                  px-4
                                  py-4
                                "
                                dir="ltr"
                              >
                                <div
                                  className="
                                    font-black
                                    text-slate-900
                                    dark:text-white
                                  "
                                >
                                  {money(
                                    spreadAmount,
                                  )} SYP
                                </div>

                                <div
                                  className="
                                    mt-0.5
                                    text-[11px]
                                    font-bold
                                    text-slate-400
                                  "
                                >
                                  {money(
                                    spreadPercentage,
                                  )}%
                                </div>
                              </td>

                              <td className="px-4 py-4">
                                <span
                                  className="
                                    inline-flex
                                    rounded-full
                                    border
                                    px-2.5
                                    py-1
                                    text-xs
                                    font-black
                                  "
                                  style={
                                    active
                                      ? {
                                          color:
                                            accentColor,

                                          backgroundColor:
                                            `${accentColor}10`,

                                          borderColor:
                                            `${accentColor}28`,
                                        }
                                      : undefined
                                  }
                                >
                                  {statusLabel(
                                    quote.status,
                                  )}
                                </span>
                              </td>

                              <td
                                className="
                                  max-w-xs
                                  px-4
                                  py-4
                                  text-slate-600
                                  dark:text-slate-300
                                "
                              >
                                <p
                                  className="
                                    line-clamp-2
                                    min-w-[180px]
                                  "
                                  title={
                                    quote.activation_note
                                    || ''
                                  }
                                >
                                  {quote.activation_note
                                  || '—'}
                                </p>
                              </td>

                              <td
                                className="
                                  whitespace-nowrap
                                  px-4
                                  py-4
                                  text-xs
                                  font-semibold
                                  text-slate-500
                                  dark:text-slate-400
                                "
                              >
                                {formatDate(
                                  quote.created_at,
                                )}
                              </td>

                              <td
                                className="
                                  whitespace-nowrap
                                  px-4
                                  py-4
                                  text-xs
                                  font-semibold
                                  text-slate-500
                                  dark:text-slate-400
                                "
                              >
                                {formatDate(
                                  quote.superseded_at,
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* =============================================
            FINANCIAL REPORTS
        ============================================= */}

        {tab === 'reports' && (
          <div className="space-y-6">
            {/* Report Filters */}

            <section
              className="
                rounded-3xl
                border
                border-slate-100
                bg-white
                p-5
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
              "
            >
              <div
                className="
                  mb-5
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-11
                    w-11
                    items-center
                    justify-center
                    rounded-xl
                  "
                  style={{
                    color:
                      accentColor,

                    backgroundColor:
                      `${accentColor}14`,
                  }}
                >
                  <FiBarChart2 />
                </div>

                <div className="text-start">
                  <h2
                    className="
                      font-black
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {labels.reports}
                  </h2>

                  <p
                    className="
                      mt-0.5
                      text-xs
                      font-semibold
                      text-slate-400
                    "
                  >
                    {t(
                      'financeControls.subtitle',
                      {
                        defaultValue:
                          isArabic
                            ? 'اختر الفترة المطلوبة لعرض التقرير.'
                            : 'Choose the period to run the report.',
                      },
                    )}
                  </p>
                </div>
              </div>

              <form
                onSubmit={
                  submitReport
                }
                className="
                  grid
                  gap-4
                  md:grid-cols-2
                  xl:grid-cols-4
                "
              >
                <label
                  className="
                    text-sm
                    font-black
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {t(
                    'financeControls.report.period',
                    {
                      defaultValue:
                        isArabic
                          ? 'الفترة'
                          : 'Period',
                    },
                  )}

                  <select
                    className={`
                      ${inputClass}
                      mt-2
                    `}
                    value={
                      reportForm.period
                    }
                    onChange={(event) => (
                      setReportForm(
                        (previous) => ({
                          ...previous,

                          period:
                            event.target.value,
                        }),
                      )
                    )}
                  >
                    {[
                      'daily',
                      'weekly',
                      'monthly',
                      'custom',
                    ].map((period) => (
                      <option
                        key={period}
                        value={period}
                      >
                        {t(
                          `financeControls.periods.${period}`,
                          {
                            defaultValue:
                              period,
                          },
                        )}
                      </option>
                    ))}
                  </select>
                </label>

                {reportForm.period
                === 'custom' ? (
                  <>
                    <label
                      className="
                        text-sm
                        font-black
                        text-slate-700
                        dark:text-slate-200
                      "
                    >
                      {t(
                        'financeControls.report.startDate',
                        {
                          defaultValue:
                            isArabic
                              ? 'من تاريخ'
                              : 'Start date',
                        },
                      )}

                      <input
                        className={`
                          ${inputClass}
                          mt-2
                        `}
                        type="date"
                        value={
                          reportForm.start_date
                        }
                        onChange={(event) => (
                          setReportForm(
                            (previous) => ({
                              ...previous,

                              start_date:
                                event.target.value,
                            }),
                          )
                        )}
                        required
                      />
                    </label>

                    <label
                      className="
                        text-sm
                        font-black
                        text-slate-700
                        dark:text-slate-200
                      "
                    >
                      {t(
                        'financeControls.report.endDate',
                        {
                          defaultValue:
                            isArabic
                              ? 'إلى تاريخ'
                              : 'End date',
                        },
                      )}

                      <input
                        className={`
                          ${inputClass}
                          mt-2
                        `}
                        type="date"
                        value={
                          reportForm.end_date
                        }
                        onChange={(event) => (
                          setReportForm(
                            (previous) => ({
                              ...previous,

                              end_date:
                                event.target.value,
                            }),
                          )
                        )}
                        required
                      />
                    </label>
                  </>
                ) : (
                  <label
                    className="
                      text-sm
                      font-black
                      text-slate-700
                      dark:text-slate-200
                    "
                  >
                    {t(
                      'financeControls.report.anchorDate',
                      {
                        defaultValue:
                          isArabic
                            ? 'التاريخ'
                            : 'Date',
                      },
                    )}

                    <input
                      className={`
                        ${inputClass}
                        mt-2
                      `}
                      type="date"
                      value={
                        reportForm.date
                      }
                      onChange={(event) => (
                        setReportForm(
                          (previous) => ({
                            ...previous,

                            date:
                              event.target.value,
                          }),
                        )
                      )}
                    />
                  </label>
                )}

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="
                      flex
                      w-full
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      px-4
                      py-2.5
                      text-sm
                      font-black
                      text-white
                      shadow-sm
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
                    {loading && (
                      <FiRefreshCw
                        className="animate-spin"
                      />
                    )}

                    {loading
                      ? t(
                          'financeControls.report.loading',
                          {
                            defaultValue:
                              isArabic
                                ? 'جاري التحميل...'
                                : 'Loading...',
                          },
                        )
                      : t(
                          'financeControls.report.run',
                          {
                            defaultValue:
                              isArabic
                                ? 'عرض التقرير'
                                : 'Run report',
                          },
                        )}
                  </button>
                </div>
              </form>
            </section>

            {/* Report Loading */}

            {loading && (
              <section
                className="
                  flex
                  min-h-[300px]
                  items-center
                  justify-center
                  rounded-3xl
                  border
                  border-slate-100
                  bg-white
                  shadow-sm
                  dark:border-slate-800
                  dark:bg-secondary-dark-bg
                "
              >
                <FiRefreshCw
                  className="
                    animate-spin
                    text-3xl
                    text-slate-400
                  "
                />
              </section>
            )}

            {/* Empty */}

            {!loading
              && !report && (
              <section
                className="
                  flex
                  min-h-[300px]
                  flex-col
                  items-center
                  justify-center
                  rounded-3xl
                  border
                  border-slate-100
                  bg-white
                  p-10
                  text-center
                  shadow-sm
                  dark:border-slate-800
                  dark:bg-secondary-dark-bg
                "
              >
                <FiBarChart2
                  className="
                    mb-3
                    text-3xl
                    text-slate-300
                  "
                />

                <p
                  className="
                    text-sm
                    font-bold
                    text-slate-400
                  "
                >
                  {t(
                    'financeControls.report.empty',
                    {
                      defaultValue:
                        isArabic
                          ? 'لا توجد بيانات تقرير لعرضها.'
                          : 'No report data to display.',
                    },
                  )}
                </p>
              </section>
            )}

            {/* Report */}

            {!loading
              && report && (
              <div className="space-y-6">
                <div
                  className="
                    grid
                    gap-4
                    sm:grid-cols-2
                    xl:grid-cols-3
                  "
                >
                  {[
                    {
                      label: t(
                        'financeControls.report.operations',
                        {
                          defaultValue:
                            isArabic
                              ? 'عدد العمليات'
                              : 'Operations',
                        },
                      ),

                      value:
                        report.operation_count
                        ?? 0,

                      icon:
                        <FiActivity />,
                    },
                    {
                      label: t(
                        'financeControls.report.period',
                        {
                          defaultValue:
                            isArabic
                              ? 'الفترة'
                              : 'Period',
                        },
                      ),

                      value:
                        periodLabel(
                          report.period,
                        ),

                      icon:
                        <FiClock />,
                    },
                    {
                      label: t(
                        'financeControls.report.boundary',
                        {
                          defaultValue:
                            isArabic
                              ? 'نطاق التقرير'
                              : 'Report range',
                        },
                      ),

                      value:
                        `${formatDate(
                          report.boundary?.start_inclusive,
                        )} → ${formatDate(
                          report.boundary?.end_exclusive,
                        )}`,

                      icon:
                        <FiBarChart2 />,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="
                        rounded-2xl
                        border
                        border-slate-100
                        bg-white
                        p-5
                        shadow-sm
                        dark:border-slate-800
                        dark:bg-secondary-dark-bg
                      "
                    >
                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-3
                        "
                      >
                        <div className="min-w-0 text-start">
                          <p
                            className="
                              text-xs
                              font-black
                              text-slate-400
                            "
                          >
                            {item.label}
                          </p>

                          <p
                            className="
                              mt-2
                              break-words
                              text-xl
                              font-black
                              text-slate-900
                              dark:text-white
                            "
                          >
                            {item.value}
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
                          "
                          style={{
                            color:
                              accentColor,

                            backgroundColor:
                              `${accentColor}14`,
                          }}
                        >
                          {item.icon}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Accounting Totals */}

                <section
                  className="
                    overflow-hidden
                    rounded-3xl
                    border
                    border-slate-100
                    bg-white
                    shadow-sm
                    dark:border-slate-800
                    dark:bg-secondary-dark-bg
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-3
                      border-b
                      border-slate-100
                      px-5
                      py-4
                      dark:border-slate-800
                    "
                  >
                    <div
                      className="
                        flex
                        h-10
                        w-10
                        items-center
                        justify-center
                        rounded-xl
                      "
                      style={{
                        color:
                          accentColor,

                        backgroundColor:
                          `${accentColor}14`,
                      }}
                    >
                      <FiDollarSign />
                    </div>

                    <h2
                      className="
                        font-black
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {t(
                        'financeControls.report.accountingTotals',
                        {
                          defaultValue:
                            isArabic
                              ? 'الإجماليات المحاسبية'
                              : 'Accounting totals',
                        },
                      )}
                    </h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table
                      className="
                        min-w-full
                        divide-y
                        divide-slate-100
                        text-sm
                        dark:divide-slate-800
                      "
                    >
                      <thead
                        className="
                          bg-slate-50
                          dark:bg-slate-900/60
                        "
                      >
                        <tr>
                          <th
                            className="
                              px-5
                              py-3.5
                              text-start
                              text-xs
                              font-black
                              text-slate-500
                              dark:text-slate-400
                            "
                          >
                            {t(
                              'financeControls.report.metric',
                              {
                                defaultValue:
                                  isArabic
                                    ? 'البند'
                                    : 'Metric',
                              },
                            )}
                          </th>

                          <th
                            className="
                              px-5
                              py-3.5
                              text-start
                              text-xs
                              font-black
                              text-slate-500
                              dark:text-slate-400
                            "
                          >
                            {t(
                              'financeControls.report.amounts',
                              {
                                defaultValue:
                                  isArabic
                                    ? 'القيم'
                                    : 'Amounts',
                              },
                            )}
                          </th>
                        </tr>
                      </thead>

                      <tbody
                        className="
                          divide-y
                          divide-slate-100
                          dark:divide-slate-800
                        "
                      >
                        {Object.entries(
                          report.totals || {},
                        ).map(
                          ([key, values]) => (
                            <tr
                              key={key}
                              className="
                                hover:bg-slate-50/70
                                dark:hover:bg-slate-800/40
                              "
                            >
                              <td
                                className="
                                  px-5
                                  py-4
                                  font-black
                                  text-slate-900
                                  dark:text-white
                                "
                              >
                                {metricLabel(
                                  key,
                                )}
                              </td>

                              <td
                                className="
                                  px-5
                                  py-4
                                  text-slate-700
                                  dark:text-slate-200
                                "
                              >
                                <CurrencyAmounts
                                  values={
                                    values
                                  }
                                  locale={
                                    locale
                                  }
                                />
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Status Totals */}

                <section
                  className="
                    overflow-hidden
                    rounded-3xl
                    border
                    border-slate-100
                    bg-white
                    shadow-sm
                    dark:border-slate-800
                    dark:bg-secondary-dark-bg
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-3
                      border-b
                      border-slate-100
                      px-5
                      py-4
                      dark:border-slate-800
                    "
                  >
                    <div
                      className="
                        flex
                        h-10
                        w-10
                        items-center
                        justify-center
                        rounded-xl
                      "
                      style={{
                        color:
                          accentColor,

                        backgroundColor:
                          `${accentColor}14`,
                      }}
                    >
                      <FiCheckCircle />
                    </div>

                    <h2
                      className="
                        font-black
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {t(
                        'financeControls.report.statusTotals',
                        {
                          defaultValue:
                            isArabic
                              ? 'الإجماليات حسب الحالة'
                              : 'Totals by status',
                        },
                      )}
                    </h2>
                  </div>

                  <div
                    className="
                      grid
                      gap-4
                      p-5
                      md:grid-cols-2
                      xl:grid-cols-3
                    "
                  >
                    {Object.entries(
                      report.status_totals || {},
                    ).map(
                      ([key, values]) => (
                        <div
                          key={key}
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
                          <p
                            className="
                              mb-3
                              font-black
                              text-slate-900
                              dark:text-white
                            "
                          >
                            {statusLabel(
                              key,
                            )}
                          </p>

                          <CurrencyAmounts
                            values={
                              values
                            }
                            locale={
                              locale
                            }
                          />
                        </div>
                      ),
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceControls;