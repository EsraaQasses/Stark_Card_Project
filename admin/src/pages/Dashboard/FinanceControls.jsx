import React, {
  useCallback,
  useEffect,
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
  text-slate-900
  outline-none
  transition-all
  duration-200
  focus:border-cyan-400
  focus:ring-2
  focus:ring-cyan-100
  disabled:cursor-not-allowed
  disabled:opacity-60
  dark:border-slate-700
  dark:bg-slate-900
  dark:text-white
  dark:focus:ring-cyan-900/30
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
  const entries = Object.entries(values || {});

  if (!entries.length) {
    return (
      <span className="text-slate-400">
        —
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      {entries.map(([currency, amount]) => (
        <div
          key={currency}
          className="flex items-center gap-2"
        >
          <span className="font-bold text-slate-800 dark:text-white">
            {Number(amount || 0).toLocaleString(
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
      ))}
    </div>
  );
};

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

  const [tab, setTab] = useState('rates');

  const [currentQuote, setCurrentQuote] = useState(null);

  const [history, setHistory] = useState([]);

  const [report, setReport] = useState(null);

  const [rateForm, setRateForm] = useState({
    rate: '',
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
  // Load Exchange Rates
  // ====================================================

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const historyResponse = await axiosInstance.get(
        '/wallets/exchange-rates/history/',
      );

      const quotes = Array.isArray(historyResponse.data)
        ? historyResponse.data
        : historyResponse.data?.results || [];

      setHistory(quotes);

      try {
        const currentResponse = await axiosInstance.get(
          '/wallets/exchange-rates/current/',
        );

        setCurrentQuote(currentResponse.data);

        setRateForm((previous) => ({
          ...previous,
          rate: previous.rate
            || String(
              currentResponse.data?.platform_buy_usd_rate_syp
              || currentResponse.data?.usd_to_syp
              || '',
            ),
        }));
      } catch (currentError) {
        if (currentError?.response?.status !== 503) {
          throw currentError;
        }

        setCurrentQuote(null);
      }
    } catch (loadError) {
      setError(
        messageFrom(
          loadError,
          t('financeControls.errors.loadRates'),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  // ====================================================
  // Load Financial Report
  // ====================================================

  const loadReport = useCallback(async (params) => {
    const selectedParams = params || reportForm;

    setLoading(true);
    setError('');

    try {
      const requestParams = {
        period: selectedParams.period,
      };

      if (selectedParams.period === 'custom') {
        requestParams.start_date = selectedParams.start_date;
        requestParams.end_date = selectedParams.end_date;
      } else if (selectedParams.date) {
        requestParams.date = selectedParams.date;
      }

      const response = await axiosInstance.get(
        '/finance/reports/financial/',
        {
          params: requestParams,
        },
      );

      setReport(response.data);
    } catch (loadError) {
      setError(
        messageFrom(
          loadError,
          t('financeControls.errors.loadReport'),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [
    reportForm,
    t,
  ]);

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
    tab,
    loadRates,
    loadReport,
  ]);

  // ====================================================
  // Activate Quote
  // ====================================================

  const activateQuote = async (event) => {
    event.preventDefault();

    if (mutating) {
      return;
    }

    const rate = Number(rateForm.rate);

    if (
      !Number.isFinite(rate)
      || rate <= 0
      || !rateForm.activation_note.trim()
    ) {
      setError(
        t('financeControls.validation.quote'),
      );

      return;
    }

    if (
      !window.confirm(
        t(
          'financeControls.confirm',
          {
            rate,
          },
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
          platform_buy_usd_rate_syp: rate,
          platform_sell_usd_rate_syp: rate,
          activation_note: rateForm.activation_note.trim(),
          expected_current_quote_id:
            currentQuote?.quote_id ?? null,
        },
      );

      setNotice(
        t('financeControls.notices.activated'),
      );

      setRateForm((previous) => ({
        ...previous,
        activation_note: '',
      }));

      await loadRates();
    } catch (saveError) {
      const fallback = saveError?.response?.status === 409
        ? t('financeControls.errors.quoteChanged')
        : t('financeControls.errors.activate');

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
        ),
      );

      return;
    }

    loadReport(reportForm);
  };

  // ====================================================
  // Formatting
  // ====================================================

  const locale = (
    i18n.resolvedLanguage
    || i18n.language
  );

  const money = (value) => (
    Number(value || 0).toLocaleString(
      locale,
      {
        maximumFractionDigits: 6,
      },
    )
  );

  const formatDate = (value) => {
    if (!value) {
      return '—';
    }

    return new Date(value).toLocaleString(
      locale,
    );
  };

  const historyHeaders = [
    'version',
    'rate',
    'status',
    'note',
    'created',
    'superseded',
  ];

  const metricLabel = (key) => (
    localizeRuntimeValue({
      t,
      i18n,
      value: key,
      namespace: 'currencies',
      prefix: 'financeControls.metrics',
      aliases: FINANCE_METRIC_ALIASES,
      fallback: () => (
        t('financeControls.metrics.other')
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
        t('financeControls.status.unknown')
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
        t('financeControls.periods.unknown')
      ),
    })
  );

  const handleRefresh = () => {
    setNotice('');

    if (tab === 'rates') {
      loadRates();
    } else {
      loadReport(reportForm);
    }
  };

  // ====================================================
  // Render
  // ====================================================

  return (
    <div
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
            rounded-2xl
            border
            border-slate-100
            bg-white
            px-5
            py-5
            shadow-sm
            dark:border-slate-800
            dark:bg-secondary-dark-bg
            md:px-7
            md:py-6
          "
        >
          {/* Decoration */}
          <div
            className="
              pointer-events-none
              absolute
              -start-16
              -top-20
              h-52
              w-52
              rounded-full
              opacity-[0.07]
            "
            style={{
              backgroundColor: currentColor,
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
            {/* Title */}
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
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="
                    text-sm
                    font-bold
                    md:text-base
                  "
                  style={{
                    color: currentColor,
                  }}
                >
                  {t(
                    'financeControls.category',
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
                )}
              </p>

              <div
                className="
                  mt-4
                  flex
                  items-center
                  gap-1.5
                "
              >
                <span
                  className="h-1 w-14 rounded-full"
                  style={{
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="
                    h-1
                    w-6
                    rounded-full
                    opacity-60
                  "
                  style={{
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="
                    h-1
                    w-2
                    rounded-full
                    opacity-30
                  "
                  style={{
                    backgroundColor: currentColor,
                  }}
                />
              </div>
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              style={{
                backgroundColor: currentColor,
              }}
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
                shadow-md
                transition-all
                duration-200
                hover:opacity-90
                hover:shadow-lg
                active:scale-95
                disabled:cursor-not-allowed
                disabled:opacity-60
                sm:w-auto
              "
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
              )}
            </button>
          </div>
        </section>

        {/* =============================================
            TABS
        ============================================= */}

        <div
          className="
            flex
            justify-start
          "
        >
          <div
            className="
              inline-flex
              items-center
              gap-1
              rounded-xl
              border
              border-slate-200
              bg-slate-100
              p-1
              dark:border-slate-700
              dark:bg-slate-800
            "
          >
            {[
              'rates',
              'reports',
            ].map((value) => {
              const active = tab === value;

              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => {
                    setTab(value);
                    setError('');
                    setNotice('');
                  }}
                  style={
                    active
                      ? {
                          backgroundColor: currentColor,
                        }
                      : undefined
                  }
                  className={`
                    rounded-lg
                    px-4
                    py-2
                    text-sm
                    font-bold
                    transition-all
                    duration-200

                    ${
                      active
                        ? 'text-white shadow-sm'
                        : `
                          text-slate-500
                          hover:bg-white
                          hover:text-slate-800
                          dark:text-slate-400
                          dark:hover:bg-slate-700
                          dark:hover:text-white
                        `
                    }
                  `}
                >
                  {t(
                    `financeControls.tabs.${value}`,
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* =============================================
            NOTICE
        ============================================= */}

        {notice && (
          <div
            className="
              relative
              flex
              items-start
              gap-3
              rounded-xl
              border
              border-emerald-200
              bg-emerald-50
              px-4
              py-3.5
              text-sm
              text-emerald-800
              dark:border-emerald-900
              dark:bg-emerald-950/30
              dark:text-emerald-300
            "
          >
            <FiCheckCircle
              className="
                mt-0.5
                flex-shrink-0
                text-lg
              "
            />

            <span className="flex-1">
              {notice}
            </span>

            <button
              type="button"
              onClick={() => setNotice('')}
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-lg
                transition
                hover:bg-emerald-100
                dark:hover:bg-emerald-900/50
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
              relative
              flex
              items-start
              gap-3
              rounded-xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3.5
              text-sm
              text-red-700
              dark:border-red-900
              dark:bg-red-950/30
              dark:text-red-300
            "
          >
            <FiAlertCircle
              className="
                mt-0.5
                flex-shrink-0
                text-lg
              "
            />

            <span className="flex-1">
              {error}
            </span>

            <button
              type="button"
              onClick={() => setError('')}
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
          <div
            className="
              grid
              gap-6
              xl:grid-cols-[380px_minmax(0,1fr)]
            "
          >
            {/* =========================================
                RATE SIDE
            ========================================= */}

            <div className="space-y-6">
              {/* Current Rate */}
              <section
                className="
                  overflow-hidden
                  rounded-2xl
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
                        h-10
                        w-10
                        items-center
                        justify-center
                        rounded-xl
                      "
                      style={{
                        color: currentColor,
                        backgroundColor: `${currentColor}15`,
                      }}
                    >
                      <FiDollarSign />
                    </div>

                    <div>
                      <p
                        className="
                          text-sm
                          font-bold
                          text-slate-900
                          dark:text-white
                        "
                      >
                        {t(
                          'financeControls.current.title',
                        )}
                      </p>

                      <p
                        className="
                          text-xs
                          text-slate-400
                        "
                      >
                        Live
                      </p>
                    </div>
                  </div>

                  {currentQuote && (
                    <span
                      className="
                        inline-flex
                        items-center
                        gap-1.5
                        rounded-full
                        bg-emerald-50
                        px-2.5
                        py-1
                        text-[11px]
                        font-bold
                        text-emerald-700
                        dark:bg-emerald-950/40
                        dark:text-emerald-300
                      "
                    >
                      <span
                        className="
                          h-1.5
                          w-1.5
                          rounded-full
                          bg-emerald-500
                        "
                      />

                      {statusLabel(
                        'active',
                      )}
                    </span>
                  )}
                </div>

                <div className="p-5">
                  {loading ? (
                    <div
                      className="
                        flex
                        min-h-[120px]
                        items-center
                        justify-center
                      "
                    >
                      <FiRefreshCw
                        className="
                          animate-spin
                          text-2xl
                          text-slate-400
                        "
                      />
                    </div>
                  ) : currentQuote ? (
                    <div>
                      <p
                        className="
                          text-xs
                          font-semibold
                          text-slate-400
                        "
                      >
                        {t(
                          'financeControls.activate.rate',
                        )}
                      </p>

                      <div
                        className="
                          mt-2
                          flex
                          items-baseline
                          gap-2
                        "
                        dir="ltr"
                      >
                        <span
                          className="
                            text-3xl
                            font-black
                            tracking-tight
                            text-slate-900
                            dark:text-white
                          "
                        >
                          {money(
                            currentQuote.platform_buy_usd_rate_syp
                            || currentQuote.usd_to_syp,
                          )}
                        </span>

                        <span
                          className="
                            text-sm
                            font-bold
                            text-slate-400
                          "
                        >
                          SYP
                        </span>
                      </div>

                      <div
                        className="
                          mt-5
                          space-y-2
                          border-t
                          border-slate-100
                          pt-4
                          text-xs
                          text-slate-500
                          dark:border-slate-800
                          dark:text-slate-400
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

                          <span>
                            {t(
                              'financeControls.current.version',
                              {
                                version: currentQuote.version,
                                id: currentQuote.quote_id,
                              },
                            )}
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
                            {t(
                              'financeControls.current.activated',
                              {
                                date: formatDate(
                                  currentQuote.effective_at,
                                ),
                              },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="
                        flex
                        min-h-[120px]
                        flex-col
                        items-center
                        justify-center
                        text-center
                      "
                    >
                      <FiAlertCircle
                        className="
                          mb-2
                          text-2xl
                          text-amber-500
                        "
                      />

                      <p
                        className="
                          text-sm
                          font-bold
                          text-amber-600
                          dark:text-amber-400
                        "
                      >
                        {t(
                          'financeControls.current.empty',
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Activate Rate */}
              <form
                onSubmit={activateQuote}
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
                    mb-5
                    flex
                    items-start
                    gap-3
                  "
                >
                  <div
                    className="
                      flex
                      h-10
                      w-10
                      flex-shrink-0
                      items-center
                      justify-center
                      rounded-xl
                    "
                    style={{
                      color: currentColor,
                      backgroundColor: `${currentColor}15`,
                    }}
                  >
                    <FiTrendingUp />
                  </div>

                  <div>
                    <h2
                      className="
                        font-extrabold
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {t(
                        'financeControls.activate.title',
                      )}
                    </h2>

                    <p
                      className="
                        mt-1
                        text-xs
                        leading-5
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      {t(
                        'financeControls.activate.hint',
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <label
                    className="
                      block
                      text-sm
                      font-bold
                      text-slate-700
                      dark:text-slate-200
                    "
                  >
                    {t(
                      'financeControls.activate.rate',
                    )}

                    <div className="relative mt-2">
                      <input
                        className={inputClass}
                        dir="ltr"
                        type="number"
                        min="0.000001"
                        step="0.000001"
                        value={rateForm.rate}
                        onChange={(event) => (
                          setRateForm({
                            ...rateForm,
                            rate: event.target.value,
                          })
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
                          font-bold
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
                      font-bold
                      text-slate-700
                      dark:text-slate-200
                    "
                  >
                    {t(
                      'financeControls.activate.note',
                    )}

                    <textarea
                      className={`${inputClass} mt-2 resize-none`}
                      rows="4"
                      value={rateForm.activation_note}
                      onChange={(event) => (
                        setRateForm({
                          ...rateForm,
                          activation_note: event.target.value,
                        })
                      )}
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={mutating}
                    style={{
                      backgroundColor: currentColor,
                    }}
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
                      font-bold
                      text-white
                      shadow-sm
                      transition-all
                      duration-200
                      hover:opacity-90
                      hover:shadow-md
                      active:scale-[0.99]
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    {mutating && (
                      <FiRefreshCw
                        className="animate-spin"
                      />
                    )}

                    {mutating
                      ? t(
                          'financeControls.activate.activating',
                        )
                      : t(
                          'financeControls.activate.button',
                        )}
                  </button>
                </div>
              </form>
            </div>

            {/* =========================================
                HISTORY
            ========================================= */}

            <section
              className="
                min-w-0
                overflow-hidden
                rounded-2xl
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
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-xl
                    "
                    style={{
                      color: currentColor,
                      backgroundColor: `${currentColor}15`,
                    }}
                  >
                    <FiClock />
                  </div>

                  <div>
                    <h2
                      className="
                        font-extrabold
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {t(
                        'financeControls.history.title',
                      )}
                    </h2>

                    <p
                      className="
                        mt-0.5
                        text-xs
                        text-slate-400
                      "
                    >
                      {history.length}
                    </p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div
                  className="
                    flex
                    min-h-[320px]
                    items-center
                    justify-center
                  "
                >
                  <div
                    className="
                      flex
                      flex-col
                      items-center
                      gap-3
                      text-slate-400
                    "
                  >
                    <FiRefreshCw
                      className="
                        animate-spin
                        text-2xl
                      "
                    />

                    <span className="text-sm">
                      {t(
                        'financeControls.history.loading',
                      )}
                    </span>
                  </div>
                </div>
              ) : history.length === 0 ? (
                <div
                  className="
                    flex
                    min-h-[320px]
                    flex-col
                    items-center
                    justify-center
                    px-5
                    text-center
                  "
                >
                  <div
                    className="
                      mb-3
                      flex
                      h-14
                      w-14
                      items-center
                      justify-center
                      rounded-2xl
                      bg-slate-100
                      text-2xl
                      text-slate-400
                      dark:bg-slate-800
                    "
                  >
                    <FiClock />
                  </div>

                  <p
                    className="
                      text-sm
                      font-semibold
                      text-slate-500
                      dark:text-slate-400
                    "
                  >
                    {t(
                      'financeControls.history.empty',
                    )}
                  </p>
                </div>
              ) : (
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
                        {historyHeaders.map((heading) => (
                          <th
                            key={heading}
                            className="
                              whitespace-nowrap
                              px-4
                              py-3.5
                              text-start
                              text-xs
                              font-bold
                              text-slate-500
                              dark:text-slate-400
                            "
                          >
                            {t(
                              `financeControls.history.headers.${heading}`,
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody
                      className="
                        divide-y
                        divide-slate-100
                        dark:divide-slate-800
                      "
                    >
                      {history.map((quote) => (
                        <tr
                          key={quote.quote_id}
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
                              font-bold
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
                              font-semibold
                              text-slate-700
                              dark:text-slate-200
                            "
                          >
                            <bdi>
                              {money(
                                quote.platform_buy_usd_rate_syp,
                              )}{' '}
                              SYP
                            </bdi>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`
                                inline-flex
                                rounded-full
                                px-2.5
                                py-1
                                text-xs
                                font-bold

                                ${
                                  quote.status === 'active'
                                    ? `
                                      bg-emerald-50
                                      text-emerald-700
                                      dark:bg-emerald-950/40
                                      dark:text-emerald-300
                                    `
                                    : `
                                      bg-slate-100
                                      text-slate-500
                                      dark:bg-slate-800
                                      dark:text-slate-400
                                    `
                                }
                              `}
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
                            {quote.activation_note || '—'}
                          </td>

                          <td
                            className="
                              whitespace-nowrap
                              px-4
                              py-4
                              text-xs
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
                              text-slate-500
                              dark:text-slate-400
                            "
                          >
                            {formatDate(
                              quote.superseded_at,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
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
                  mb-5
                  flex
                  items-center
                  gap-3
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
                    color: currentColor,
                    backgroundColor: `${currentColor}15`,
                  }}
                >
                  <FiBarChart2 />
                </div>

                <div>
                  <h2
                    className="
                      font-extrabold
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {t(
                      'financeControls.tabs.reports',
                    )}
                  </h2>

                  <p
                    className="
                      mt-0.5
                      text-xs
                      text-slate-400
                    "
                  >
                    {t(
                      'financeControls.subtitle',
                    )}
                  </p>
                </div>
              </div>

              <form
                onSubmit={submitReport}
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
                    font-bold
                    text-slate-700
                    dark:text-slate-200
                  "
                >
                  {t(
                    'financeControls.report.period',
                  )}

                  <select
                    className={`${inputClass} mt-2`}
                    value={reportForm.period}
                    onChange={(event) => (
                      setReportForm({
                        ...reportForm,
                        period: event.target.value,
                      })
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
                        )}
                      </option>
                    ))}
                  </select>
                </label>

                {reportForm.period === 'custom' ? (
                  <>
                    <label
                      className="
                        text-sm
                        font-bold
                        text-slate-700
                        dark:text-slate-200
                      "
                    >
                      {t(
                        'financeControls.report.startDate',
                      )}

                      <input
                        className={`${inputClass} mt-2`}
                        type="date"
                        value={reportForm.start_date}
                        onChange={(event) => (
                          setReportForm({
                            ...reportForm,
                            start_date: event.target.value,
                          })
                        )}
                        required
                      />
                    </label>

                    <label
                      className="
                        text-sm
                        font-bold
                        text-slate-700
                        dark:text-slate-200
                      "
                    >
                      {t(
                        'financeControls.report.endDate',
                      )}

                      <input
                        className={`${inputClass} mt-2`}
                        type="date"
                        value={reportForm.end_date}
                        onChange={(event) => (
                          setReportForm({
                            ...reportForm,
                            end_date: event.target.value,
                          })
                        )}
                        required
                      />
                    </label>
                  </>
                ) : (
                  <label
                    className="
                      text-sm
                      font-bold
                      text-slate-700
                      dark:text-slate-200
                    "
                  >
                    {t(
                      'financeControls.report.anchorDate',
                    )}

                    <input
                      className={`${inputClass} mt-2`}
                      type="date"
                      value={reportForm.date}
                      onChange={(event) => (
                        setReportForm({
                          ...reportForm,
                          date: event.target.value,
                        })
                      )}
                    />
                  </label>
                )}

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      backgroundColor: currentColor,
                    }}
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
                      font-bold
                      text-white
                      shadow-sm
                      transition-all
                      hover:opacity-90
                      hover:shadow-md
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    {loading && (
                      <FiRefreshCw
                        className="animate-spin"
                      />
                    )}

                    {loading
                      ? t(
                          'financeControls.report.loading',
                        )
                      : t(
                          'financeControls.report.run',
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
                  rounded-2xl
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
                    items-center
                    gap-3
                    text-slate-400
                  "
                >
                  <FiRefreshCw
                    className="
                      animate-spin
                      text-3xl
                    "
                  />

                  <span className="text-sm">
                    {t(
                      'financeControls.report.loading',
                    )}
                  </span>
                </div>
              </section>
            )}

            {/* Empty */}
            {!loading && !report && (
              <section
                className="
                  flex
                  min-h-[300px]
                  flex-col
                  items-center
                  justify-center
                  rounded-2xl
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
                <div
                  className="
                    mb-3
                    flex
                    h-16
                    w-16
                    items-center
                    justify-center
                    rounded-2xl
                    bg-slate-100
                    text-2xl
                    text-slate-400
                    dark:bg-slate-800
                  "
                >
                  <FiBarChart2 />
                </div>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  {t(
                    'financeControls.report.empty',
                  )}
                </p>
              </section>
            )}

            {/* Report */}
            {!loading && report && (
              <div className="space-y-6">
                {/* Stats */}
                <div
                  className="
                    grid
                    gap-4
                    sm:grid-cols-2
                    xl:grid-cols-3
                  "
                >
                  {/* Operations */}
                  <div
                    className="
                      rounded-2xl
                      border
                      border-blue-100
                      bg-blue-50
                      p-5
                      dark:border-blue-900/40
                      dark:bg-blue-950/20
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        justify-between
                      "
                    >
                      <div>
                        <p
                          className="
                            text-xs
                            font-bold
                            text-blue-600
                            dark:text-blue-300
                          "
                        >
                          {t(
                            'financeControls.report.operations',
                          )}
                        </p>

                        <p
                          className="
                            mt-2
                            text-3xl
                            font-black
                            text-blue-900
                            dark:text-blue-100
                          "
                        >
                          {report.operation_count ?? 0}
                        </p>
                      </div>

                      <FiActivity
                        className="
                          text-2xl
                          text-blue-500
                        "
                      />
                    </div>
                  </div>

                  {/* Period */}
                  <div
                    className="
                      rounded-2xl
                      border
                      border-emerald-100
                      bg-emerald-50
                      p-5
                      dark:border-emerald-900/40
                      dark:bg-emerald-950/20
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        justify-between
                      "
                    >
                      <div>
                        <p
                          className="
                            text-xs
                            font-bold
                            text-emerald-600
                            dark:text-emerald-300
                          "
                        >
                          {t(
                            'financeControls.report.period',
                          )}
                        </p>

                        <p
                          className="
                            mt-2
                            text-xl
                            font-black
                            text-emerald-900
                            dark:text-emerald-100
                          "
                        >
                          {periodLabel(
                            report.period,
                          )}
                        </p>
                      </div>

                      <FiClock
                        className="
                          text-2xl
                          text-emerald-500
                        "
                      />
                    </div>
                  </div>

                  {/* Boundary */}
                  <div
                    className="
                      rounded-2xl
                      border
                      border-violet-100
                      bg-violet-50
                      p-5
                      dark:border-violet-900/40
                      dark:bg-violet-950/20
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
                      <div>
                        <p
                          className="
                            text-xs
                            font-bold
                            text-violet-600
                            dark:text-violet-300
                          "
                        >
                          {t(
                            'financeControls.report.boundary',
                          )}
                        </p>

                        <p
                          className="
                            mt-2
                            text-xs
                            font-bold
                            text-violet-900
                            dark:text-violet-100
                          "
                        >
                          {formatDate(
                            report.boundary?.start_inclusive,
                          )}
                        </p>

                        <p
                          className="
                            mt-1
                            text-xs
                            text-violet-600
                            dark:text-violet-300
                          "
                        >
                          {t(
                            'financeControls.report.to',
                            {
                              date: formatDate(
                                report.boundary?.end_exclusive,
                              ),
                            },
                          )}
                        </p>
                      </div>

                      <FiBarChart2
                        className="
                          flex-shrink-0
                          text-2xl
                          text-violet-500
                        "
                      />
                    </div>
                  </div>
                </div>

                {/* Accounting Totals */}
                <section
                  className="
                    overflow-hidden
                    rounded-2xl
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
                        color: currentColor,
                        backgroundColor: `${currentColor}15`,
                      }}
                    >
                      <FiDollarSign />
                    </div>

                    <h2
                      className="
                        font-extrabold
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {t(
                        'financeControls.report.accountingTotals',
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
                              font-bold
                              text-slate-500
                              dark:text-slate-400
                            "
                          >
                            {t(
                              'financeControls.report.metric',
                            )}
                          </th>

                          <th
                            className="
                              px-5
                              py-3.5
                              text-start
                              text-xs
                              font-bold
                              text-slate-500
                              dark:text-slate-400
                            "
                          >
                            {t(
                              'financeControls.report.amounts',
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
                        ).map(([key, values]) => (
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
                                font-bold
                                text-slate-900
                                dark:text-white
                              "
                            >
                              {metricLabel(key)}
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
                                values={values}
                                locale={locale}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Status Totals */}
                <section
                  className="
                    overflow-hidden
                    rounded-2xl
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
                        color: currentColor,
                        backgroundColor: `${currentColor}15`,
                      }}
                    >
                      <FiCheckCircle />
                    </div>

                    <h2
                      className="
                        font-extrabold
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {t(
                        'financeControls.report.statusTotals',
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
                    ).map(([key, values]) => (
                      <div
                        key={key}
                        className="
                          rounded-xl
                          border
                          border-slate-100
                          bg-slate-50
                          p-4
                          dark:border-slate-700
                          dark:bg-slate-800/50
                        "
                      >
                        <p
                          className="
                            mb-3
                            font-bold
                            text-slate-900
                            dark:text-white
                          "
                        >
                          {statusLabel(key)}
                        </p>

                        <CurrencyAmounts
                          values={values}
                          locale={locale}
                        />
                      </div>
                    ))}
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