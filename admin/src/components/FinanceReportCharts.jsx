import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CORE_METRICS = [
  'revenue',
  'provider_cost',
  'gross_profit',
  'agent_commission',
  'net_profit',
];

const STATUS_ORDER = [
  'completed',
  'pending',
  'failed_rejected',
];

const currencyOrder = {
  USD: 0,
  SYP: 1,
};

const toNumber = (value) => {
  const number = Number(value ?? 0);

  return Number.isFinite(number)
    ? number
    : 0;
};

const FinanceReportCharts = ({
  report,
  locale,
  accentColor,
  isArabic,
  metricLabel,
  statusLabel,
}) => {
  const currencies = useMemo(() => {
    const values = new Set();

    Object.values(
      report?.totals || {},
    ).forEach((amounts) => {
      Object.keys(
        amounts || {},
      ).forEach((currency) => {
        values.add(currency);
      });
    });

    Object.values(
      report?.status_totals || {},
    ).forEach((amounts) => {
      Object.keys(
        amounts || {},
      ).forEach((currency) => {
        values.add(currency);
      });
    });

    const sorted = [...values].sort(
      (a, b) => (
        (currencyOrder[a] ?? 99)
        - (currencyOrder[b] ?? 99)
        || a.localeCompare(b)
      ),
    );

    return sorted.length
      ? sorted
      : ['USD', 'SYP'];
  }, [report]);

  const preferredCurrency = useMemo(() => {
    if (!currencies.length) {
      return '';
    }

    const scoreFor = (currency) => {
      const totalsScore = Object.values(
        report?.totals || {},
      ).reduce(
        (sum, amounts) => (
          sum
          + Math.abs(
            toNumber(
              amounts?.[currency],
            ),
          )
        ),
        0,
      );

      const statusScore = Object.values(
        report?.status_totals || {},
      ).reduce(
        (sum, amounts) => (
          sum
          + Math.abs(
            toNumber(
              amounts?.[currency],
            ),
          )
        ),
        0,
      );

      return totalsScore + statusScore;
    };

    return [...currencies].sort(
      (a, b) => (
        scoreFor(b)
        - scoreFor(a)
      ),
    )[0];
  }, [
    currencies,
    report,
  ]);

  const [
    selectedCurrency,
    setSelectedCurrency,
  ] = useState('');

  useEffect(() => {
    if (!currencies.length) {
      setSelectedCurrency('');
      return;
    }

    if (
      !selectedCurrency
      || !currencies.includes(
        selectedCurrency,
      )
    ) {
      setSelectedCurrency(
        preferredCurrency
        || currencies[0],
      );
    }
  }, [
    currencies,
    preferredCurrency,
    selectedCurrency,
  ]);

  const formatAmount = (
    value,
    maximumFractionDigits = 6,
  ) => (
    toNumber(value).toLocaleString(
      locale,
      {
        maximumFractionDigits,
      },
    )
  );

  const compactAmount = (value) => {
    const number = toNumber(value);

    try {
      return new Intl.NumberFormat(
        locale,
        {
          notation: 'compact',
          maximumFractionDigits: 1,
        },
      ).format(number);
    } catch {
      return formatAmount(
        number,
        1,
      );
    }
  };

  const metricValue = (key) => (
    toNumber(
      report
        ?.totals
        ?.[key]
        ?.[selectedCurrency],
    )
  );

  const statusValue = (key) => (
    toNumber(
      report
        ?.status_totals
        ?.[key]
        ?.[selectedCurrency],
    )
  );

  const metricCards = useMemo(
    () => ([
      {
        key: 'revenue',
        label:
          typeof metricLabel === 'function'
            ? metricLabel('revenue')
            : 'Revenue',
        helper: isArabic
          ? 'إجمالي قيمة المبيعات'
          : 'Total sales value',
      },
      {
        key: 'provider_cost',
        label:
          typeof metricLabel === 'function'
            ? metricLabel('provider_cost')
            : 'Provider cost',
        helper: isArabic
          ? 'تكلفة الخدمات من المزود'
          : 'Service cost from provider',
      },
      {
        key: 'gross_profit',
        label:
          typeof metricLabel === 'function'
            ? metricLabel('gross_profit')
            : 'Gross profit',
        helper: isArabic
          ? 'الإيرادات ناقص تكلفة المزود'
          : 'Revenue minus provider cost',
      },
      {
        key: 'net_profit',
        label:
          typeof metricLabel === 'function'
            ? metricLabel('net_profit')
            : 'Net profit',
        helper: isArabic
          ? 'الربح النهائي بعد الخصومات'
          : 'Final profit after deductions',
      },
    ]),
    [
      isArabic,
      metricLabel,
    ],
  );

  const barData = useMemo(
    () => (
      CORE_METRICS.map((key) => ({
        key,
        name:
          typeof metricLabel === 'function'
            ? metricLabel(key)
            : key,
        value:
          toNumber(
            report
              ?.totals
              ?.[key]
              ?.[selectedCurrency],
          ),
      }))
    ),
    [
      metricLabel,
      report,
      selectedCurrency,
    ],
  );

  const statusData = useMemo(() => {
    const source =
      report?.status_totals || {};

    const keys = [
      ...STATUS_ORDER.filter(
        (key) => Object.prototype.hasOwnProperty.call(
          source,
          key,
        ),
      ),
      ...Object.keys(source).filter(
        (key) => (
          !STATUS_ORDER.includes(key)
        ),
      ),
    ];

    return keys.map((key) => ({
      key,
      name:
        typeof statusLabel === 'function'
          ? statusLabel(key)
          : key,
      value:
        toNumber(
          source
            ?.[key]
            ?.[selectedCurrency],
        ),
    }));
  }, [
    report,
    selectedCurrency,
    statusLabel,
  ]);

  const revenue =
    metricValue('revenue');

  const grossProfit =
    metricValue('gross_profit');

  const netProfit =
    metricValue('net_profit');

  const grossMargin = (
    revenue !== 0
      ? (
          grossProfit
          / revenue
        ) * 100
      : null
  );

  const netMargin = (
    revenue !== 0
      ? (
          netProfit
          / revenue
        ) * 100
      : null
  );

  const hasChartData = barData.some(
    (item) => item.value !== 0,
  );

  const hasStatusData = statusData.some(
    (item) => item.value !== 0,
  );

  if (!report) {
    return null;
  }

  return (
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
        <div className="text-start">
          <h2
            className="
              text-lg
              font-black
              text-slate-900
              dark:text-white
            "
          >
            {isArabic
              ? 'ملخص التقرير بصرياً'
              : 'Visual report summary'}
          </h2>

          <p
            className="
              mt-1
              text-xs
              font-semibold
              text-slate-400
            "
          >
            {isArabic
              ? 'أهم الأرقام المالية بشكل أبسط وأسهل للمقارنة.'
              : 'Key financial figures in a simpler comparison view.'}
          </p>
        </div>

        <div
          className="
            flex
            flex-wrap
            items-center
            gap-2
          "
        >
          {currencies.map(
            (currency) => {
              const active = (
                selectedCurrency
                === currency
              );

              return (
                <button
                  key={currency}
                  type="button"
                  onClick={() => (
                    setSelectedCurrency(
                      currency,
                    )
                  )}
                  className={`
                    rounded-xl
                    border
                    px-4
                    py-2
                    text-xs
                    font-black
                    transition
                    ${
                      active
                        ? 'text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }
                  `}
                  style={
                    active
                      ? {
                          backgroundColor:
                            accentColor,
                          borderColor:
                            accentColor,
                        }
                      : undefined
                  }
                >
                  {currency}
                </button>
              );
            },
          )}
        </div>
      </div>

      <div className="p-5">
        <div
          className="
            grid
            gap-3
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          {metricCards.map(
            (item) => {
              const value =
                metricValue(
                  item.key,
                );

              const negative =
                value < 0;

              return (
                <div
                  key={item.key}
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
                      text-xs
                      font-black
                      text-slate-400
                    "
                  >
                    {item.label}
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
                      className={`
                        text-2xl
                        font-black
                        tracking-tight
                        ${
                          negative
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-950 dark:text-white'
                        }
                      `}
                    >
                      {formatAmount(
                        value,
                      )}
                    </span>

                    <span
                      className="
                        text-[11px]
                        font-black
                        text-slate-400
                      "
                    >
                      {selectedCurrency}
                    </span>
                  </div>

                  <p
                    className="
                      mt-2
                      text-[11px]
                      font-semibold
                      leading-5
                      text-slate-400
                    "
                  >
                    {item.helper}
                  </p>
                </div>
              );
            },
          )}
        </div>

        <div
          className="
            mt-5
            grid
            gap-5
            xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.65fr)]
          "
        >
          <div
            className="
              min-w-0
              rounded-2xl
              border
              border-slate-100
              bg-slate-50/60
              p-4
              dark:border-slate-700
              dark:bg-slate-900/40
            "
          >
            <div
              className="
                flex
                flex-col
                justify-between
                gap-3
                sm:flex-row
                sm:items-start
              "
            >
              <div className="text-start">
                <h3
                  className="
                    text-sm
                    font-black
                    text-slate-900
                    dark:text-white
                  "
                >
                  {isArabic
                    ? 'مقارنة الإيرادات والتكاليف والأرباح'
                    : 'Revenue, cost and profit comparison'}
                </h3>

                <p
                  className="
                    mt-1
                    text-xs
                    font-semibold
                    text-slate-400
                  "
                >
                  {isArabic
                    ? 'الأعمدة تحت خط الصفر تعني خسارة أو قيمة سالبة.'
                    : 'Bars below zero represent a loss or negative amount.'}
                </p>
              </div>

              <div
                className="
                  flex
                  flex-wrap
                  gap-2
                "
              >
                {grossMargin !== null && (
                  <span
                    className="
                      rounded-lg
                      bg-white
                      px-2.5
                      py-1.5
                      text-[11px]
                      font-black
                      text-slate-500
                      shadow-sm
                      dark:bg-slate-800
                      dark:text-slate-300
                    "
                  >
                    {isArabic
                      ? 'هامش الإجمالي'
                      : 'Gross margin'}
                    {' '}
                    {formatAmount(
                      grossMargin,
                      2,
                    )}%
                  </span>
                )}

                {netMargin !== null && (
                  <span
                    className="
                      rounded-lg
                      bg-white
                      px-2.5
                      py-1.5
                      text-[11px]
                      font-black
                      text-slate-500
                      shadow-sm
                      dark:bg-slate-800
                      dark:text-slate-300
                    "
                  >
                    {isArabic
                      ? 'هامش الصافي'
                      : 'Net margin'}
                    {' '}
                    {formatAmount(
                      netMargin,
                      2,
                    )}%
                  </span>
                )}
              </div>
            </div>

            {hasChartData ? (
              <div className="mt-3 h-[330px] w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={barData}
                    margin={{
                      top: 12,
                      right: 10,
                      left: 0,
                      bottom: 26,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />

                    <ReferenceLine
                      y={0}
                      stroke="#94a3b8"
                      strokeWidth={1.25}
                    />

                    <XAxis
                      dataKey="name"
                      interval={0}
                      tick={{
                        fontSize: 11,
                        fill: '#64748b',
                      }}
                      tickLine={false}
                      axisLine={false}
                      height={62}
                    />

                    <YAxis
                      tickFormatter={
                        compactAmount
                      }
                      tick={{
                        fontSize: 11,
                        fill: '#94a3b8',
                      }}
                      tickLine={false}
                      axisLine={false}
                      width={62}
                    />

                    <Tooltip
                      cursor={{
                        fill: `${accentColor}08`,
                      }}
                      formatter={(value) => [
                        `${formatAmount(
                          value,
                        )} ${selectedCurrency}`,
                        isArabic
                          ? 'القيمة'
                          : 'Amount',
                      ]}
                    />

                    <Bar
                      dataKey="value"
                      radius={[
                        8,
                        8,
                        8,
                        8,
                      ]}
                      maxBarSize={72}
                    >
                      {barData.map(
                        (item) => (
                          <Cell
                            key={item.key}
                            fill={
                              item.value < 0
                                ? '#ef4444'
                                : (
                                  item.key === 'net_profit'
                                    ? '#16a34a'
                                    : accentColor
                                )
                            }
                          />
                        ),
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                className="
                  flex
                  min-h-[330px]
                  flex-col
                  items-center
                  justify-center
                  gap-2
                  text-center
                "
              >
                <div className="text-4xl opacity-50">
                  📊
                </div>

                <p
                  className="
                    text-sm
                    font-black
                    text-slate-500
                    dark:text-slate-300
                  "
                >
                  {isArabic
                    ? 'لا توجد حركة مالية بهذه العملة'
                    : 'No financial activity in this currency'}
                </p>
              </div>
            )}
          </div>

          <div
            className="
              min-w-0
              rounded-2xl
              border
              border-slate-100
              bg-slate-50/60
              p-4
              dark:border-slate-700
              dark:bg-slate-900/40
            "
          >
            <div className="text-start">
              <h3
                className="
                  text-sm
                  font-black
                  text-slate-900
                  dark:text-white
                "
              >
                {isArabic
                  ? 'حالة العمليات'
                  : 'Operation status'}
              </h3>

              <p
                className="
                  mt-1
                  text-xs
                  font-semibold
                  text-slate-400
                "
              >
                {isArabic
                  ? 'المبالغ المعلقة والمكتملة والفاشلة.'
                  : 'Pending, completed, and failed amounts.'}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {statusData.map(
                (item) => {
                  const value =
                    statusValue(
                      item.key,
                    );

                  const isCompleted =
                    item.key === 'completed';

                  const isFailed = (
                    item.key === 'failed_rejected'
                  );

                  return (
                    <div
                      key={item.key}
                      className="
                        rounded-xl
                        border
                        border-slate-100
                        bg-white
                        p-3.5
                        dark:border-slate-700
                        dark:bg-slate-800/60
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
                        <span
                          className="
                            text-xs
                            font-black
                            text-slate-600
                            dark:text-slate-300
                          "
                        >
                          {item.name}
                        </span>

                        <span
                          className={`
                            text-sm
                            font-black
                            ${
                              isFailed
                                ? 'text-red-600 dark:text-red-400'
                                : (
                                  isCompleted
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                )
                            }
                          `}
                          dir="ltr"
                        >
                          {formatAmount(
                            value,
                          )}
                          {' '}
                          {selectedCurrency}
                        </span>
                      </div>
                    </div>
                  );
                },
              )}
            </div>

            {!hasStatusData && (
              <p
                className="
                  mt-4
                  rounded-xl
                  border
                  border-dashed
                  border-slate-200
                  px-3
                  py-4
                  text-center
                  text-xs
                  font-bold
                  text-slate-400
                  dark:border-slate-700
                "
              >
                {isArabic
                  ? 'لا توجد مبالغ موزعة حسب الحالة ضمن هذه الفترة.'
                  : 'No status amounts are available for this period.'}
              </p>
            )}

            <div
              className="
                mt-4
                rounded-xl
                border
                border-slate-100
                bg-white
                p-3.5
                dark:border-slate-700
                dark:bg-slate-800/60
              "
            >
              <p
                className="
                  text-[11px]
                  font-black
                  text-slate-400
                "
              >
                {isArabic
                  ? 'عمولة الوكيل'
                  : 'Agent commission'}
              </p>

              <p
                className="
                  mt-1
                  text-lg
                  font-black
                  text-slate-900
                  dark:text-white
                "
                dir="ltr"
              >
                {formatAmount(
                  metricValue(
                    'agent_commission',
                  ),
                )}
                {' '}
                {selectedCurrency}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinanceReportCharts;
