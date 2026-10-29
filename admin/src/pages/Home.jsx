import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { GoPrimitiveDot } from "react-icons/go";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useStateContext } from "../contexts/ContextProvider";
import { earningData } from "../data/earningData";
import axiosInstance from "../utils/axiosConfig";

const ALL_TIME_START = "1970-01-01";
const CHART_MONTHS = 7;

// The backend uses Asia/Damascus. Derive reporting dates from that zone,
// rather than each administrator's browser time zone.
const REPORT_TIME_ZONE = "Asia/Damascus";

const datePartsInReportZone = (instant = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return { year: Number(part("year")), month: Number(part("month")), day: Number(part("day")) };
};

const pad2 = (number) => String(number).padStart(2, "0");
const toApiDate = ({ year, month, day }) =>
  `${year}-${pad2(month)}-${pad2(day)}`;

const buildMonthAnchors = (count = CHART_MONTHS, today = datePartsInReportZone()) =>
  Array.from({ length: count }, (_, index) => {
    const month = new Date(Date.UTC(today.year, today.month - count + index, 1, 12));
    return {
      year: month.getUTCFullYear(),
      month: month.getUTCMonth() + 1,
      day: 1,
      labelDate: month,
    };
  });

const moneyValue = (
  report,
  metric,
  currency,
) => {
  const value = Number(
    report?.totals?.[metric]?.[currency]
    ?? 0,
  );

  return Number.isFinite(value)
    ? value
    : 0;
};

const compactNumber = (
  value,
  maximumFractionDigits = 2,
) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString(
    undefined,
    {
      maximumFractionDigits,
    },
  );
};

// A missing/invalid API count is not the same as zero requests.
const getResponseCount = (response) => {
  const data = response?.data;
  const rawCount = data?.count ?? (
    Array.isArray(data) ? data.length : null
  );
  const count = Number(rawCount);
  return rawCount !== null
    && rawCount !== undefined
    && Number.isSafeInteger(count)
    && count >= 0
      ? count
      : null;
};

const validCount = (value) => (
  value !== null
  && value !== undefined
  && value !== ''
  && Number.isSafeInteger(Number(value))
  && Number(value) >= 0
);

const allRequestStatsValid = (data) => (
  data && ['pending', 'in_progress', 'objection', 'completed']
    .every((key) => validCount(data[key]))
);

const RevenueChart = ({
  rows,
  currentColor,
  t,
}) => {
  const maxUsd = Math.max(
    1,
    ...rows.map(
      (item) => item.usd,
    ),
  );

  const maxSyp = Math.max(
    1,
    ...rows.map(
      (item) => item.syp,
    ),
  );

  const hasData = rows.some(
    (item) => (
      item.usd > 0
      || item.syp > 0
    ),
  );

  if (!hasData) {
    return (
      <div
        className="
          flex
          min-h-[285px]
          w-full
          flex-col
          items-center
          justify-center
          rounded-2xl
          border-2
          border-dashed
          border-gray-200
          p-6
          text-center
          dark:border-gray-700
        "
      >
        <span className="mb-2 text-4xl">
          📊
        </span>

        <p
          className="
            font-semibold
            text-gray-600
            dark:text-gray-400
          "
        >
          {t(
            "overview.revenue.noChartData",
            "No financial data available yet",
          )}
        </p>

        <p
          className="
            mx-auto
            mt-1
            max-w-[280px]
            text-xs
            text-gray-400
            dark:text-gray-500
          "
        >
          {t(
            "overview.revenue.noChartDataDesc",
            "The chart will appear automatically when successful purchase transactions are recorded.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      className="
        w-full
        overflow-hidden
        rounded-2xl
        border
        border-slate-100
        bg-white
        p-4
        dark:border-slate-800
        dark:bg-slate-900/30
      "
    >
      <div
        className="
          flex
          h-[235px]
          items-end
          gap-2
          sm:gap-3
        "
      >
        {rows.map((item) => {
          const usdHeight = (
            item.usd > 0
              ? Math.max(
                  5,
                  (item.usd / maxUsd) * 100,
                )
              : 0
          );

          const sypHeight = (
            item.syp > 0
              ? Math.max(
                  5,
                  (item.syp / maxSyp) * 100,
                )
              : 0
          );

          return (
            <div
              key={item.key}
              className="
                flex
                min-w-0
                flex-1
                flex-col
                items-center
              "
            >
              <div
                className="
                  flex
                  h-[200px]
                  w-full
                  items-end
                  justify-center
                  gap-1
                  sm:gap-2
                "
              >
                <div
                  className="
                    group
                    relative
                    w-[38%]
                    max-w-8
                    rounded-t-lg
                    transition-opacity
                    hover:opacity-80
                  "
                  style={{
                    height: `${usdHeight}%`,
                    backgroundColor:
                      currentColor || "#3B82F6",
                  }}
                  title={`USD: ${compactNumber(
                    item.usd,
                    2,
                  )}`}
                />

                <div
                  className="
                    group
                    relative
                    w-[38%]
                    max-w-8
                    rounded-t-lg
                    bg-emerald-400
                    transition-opacity
                    hover:opacity-80
                  "
                  style={{
                    height: `${sypHeight}%`,
                  }}
                  title={`SYP: ${compactNumber(
                    item.syp,
                    2,
                  )}`}
                />
              </div>

              <span
                className="
                  mt-2
                  max-w-full
                  truncate
                  text-[10px]
                  font-bold
                  text-slate-400
                  sm:text-xs
                "
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      <p
        className="
          mt-3
          text-center
          text-[10px]
          font-medium
          leading-5
          text-slate-400
        "
      >
        {t(
          "overview.revenue.chartScaleNote",
          "USD and SYP bars use separate scales so both currencies remain readable.",
        )}
      </p>
    </div>
  );
};

const Home = () => {
  const {
    currentColor,
  } = useStateContext();

  const {
    t,
    i18n,
  } = useTranslation([
    "dashboard",
    "common",
  ]);

  const isArabic = (i18n.resolvedLanguage || i18n.language || "ar").startsWith("ar");

  const locale = (
    i18n.resolvedLanguage
    || i18n.language
    || "ar"
  );

  const [stats, setStats] = useState({
    shipping: 0,
    pending: 0,
    inProgress: 0,
    objection: 0,
    completed: 0,
    todayRequests: 0,
    totalUsers: 0,
    revenueUsd: 0,
    revenueSyp: 0,
    todayRevenueUsd: 0,
    todayRevenueSyp: 0,
  });

  const [
    monthlyRevenue,
    setMonthlyRevenue,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    detailsLoading,
    setDetailsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  const [
    metricErrors,
    setMetricErrors,
  ] = useState({});

  const fetchFinancialData = useCallback(
    async () => {
      setDetailsLoading(true);

      try {
        const today = datePartsInReportZone();
        const monthAnchors = buildMonthAnchors(CHART_MONTHS, today);

        const requests = [
          axiosInstance.get(
            "/transactions/financial/summary/",
            {
              params: {
                period: "custom",
                start_date:
                  ALL_TIME_START,
                end_date:
                  toApiDate(today),
              },
            },
          ),

          axiosInstance.get(
            "/transactions/financial/summary/",
            {
              params: {
                period: "daily",
                date: toApiDate(today),
              },
            },
          ),

          ...monthAnchors.map(
            (anchor) => (
              axiosInstance.get(
                "/transactions/financial/summary/",
                {
                  params: {
                    period: "monthly",
                    date:
                      toApiDate(anchor),
                  },
                },
              )
            ),
          ),
        ];

        const results =
          await Promise.allSettled(
            requests,
          );

        const totalResult =
          results[0];

        if (
          totalResult.status
          === "fulfilled"
        ) {
          const report =
            totalResult.value.data || {};
          if (!report?.totals?.revenue) {
            setMetricErrors((previous) => ({ ...previous, totalRevenue: true }));
          } else {
          setStats(
            (previous) => ({
              ...previous,

              revenueUsd:
                moneyValue(
                  report,
                  "revenue",
                  "USD",
                ),

              revenueSyp:
                moneyValue(
                  report,
                  "revenue",
                  "SYP",
                ),
            }),
          );

          setMetricErrors(
            (previous) => ({
              ...previous,
              totalRevenue: false,
            }),
          );
          }
        } else {
          setMetricErrors(
            (previous) => ({
              ...previous,
              totalRevenue: true,
            }),
          );
        }

        const todayResult = results[1];
        const todayReport = todayResult.status === "fulfilled"
          ? todayResult.value.data
          : null;
        const todayRevenueFailed = !todayReport?.totals?.revenue;
        if (!todayRevenueFailed) {
          setStats((previous) => ({
            ...previous,
            todayRevenueUsd: moneyValue(todayReport, "revenue", "USD"),
            todayRevenueSyp: moneyValue(todayReport, "revenue", "SYP"),
          }));
        }
        setMetricErrors((previous) => ({
          ...previous,
          todayRevenue: todayRevenueFailed,
        }));

        const monthRows =
          monthAnchors.map(
            (anchor, index) => {
              const result =
                results[index + 2];

              const report = (
                result.status
                === "fulfilled"
                  ? result.value.data
                  : null
              );

              const label =
                anchor.labelDate.toLocaleDateString(
                  locale,
                  {
                    month: "short",
                  },
                );

              return {
                key:
                  `${anchor.year}-${anchor.month}`,

                label,

                usd:
                  moneyValue(
                    report,
                    "revenue",
                    "USD",
                  ),

                syp:
                  moneyValue(
                    report,
                    "revenue",
                    "SYP",
                  ),

                failed:
                  result.status
                  === "rejected",
              };
            },
          );

        setMonthlyRevenue(
          monthRows,
        );

        const anyMonthFailed =
          monthRows.some((item) => item.failed);

        setMetricErrors(
          (previous) => ({
            ...previous,

            financialChart:
              anyMonthFailed,
          }),
        );
      } catch (loadError) {
        console.error(
          "Financial dashboard data failed:",
          loadError,
        );

        setMetricErrors(
          (previous) => ({
            ...previous,
            totalRevenue: true,
            financialChart: true,
            todayRevenue: true,
          }),
        );
      } finally {
        setDetailsLoading(false);
      }
    },
    [locale],
  );

  const fetchOperationalStats =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const results =
          await Promise.allSettled([
            Promise.allSettled([
              axiosInstance.get(
                "/shipping/standard/",
                {
                  params: {
                    status: "pending",
                    page_size: 1,
                  },
                },
              ),

              axiosInstance.get(
                "/shipping/agent-admin/",
                {
                  params: {
                    status: "pending",
                    page_size: 1,
                  },
                },
              ),
            ]),

            axiosInstance.get(
              "/all_requests/admin/requests/stats/",
            ),

            axiosInstance.get(
              "/users/stats/",
            ),

            axiosInstance.get(
              "/all_requests/admin/requests/",
              {
                params: {
                  created_from: toApiDate(datePartsInReportZone()),
                  created_to: toApiDate(datePartsInReportZone()),
                  page_size: 1,
                },
              },
            ),
          ]);

        const [
          shippingResult,
          requestsStatsResult,
          usersResult,
          todayRequestsResult,
        ] = results;

        const shippingResponses = (
          shippingResult.status === "fulfilled"
            ? shippingResult.value
            : []
        );
        const shippingCounts = shippingResponses.map(
          (result) => result.status === "fulfilled"
            ? getResponseCount(result.value)
            : null
        );
        const shippingFailed = (
          shippingResponses.length !== 2
          || shippingCounts.some((count) => count === null)
        );
        const shippingCount = shippingFailed
          ? null
          : shippingCounts.reduce((total, count) => total + count, 0);

        const requestStats = (
          requestsStatsResult.status === "fulfilled"
            ? requestsStatsResult.value.data
            : null
        );

        const userStats = (
          usersResult.status === "fulfilled"
            ? usersResult.value.data
            : null
        );
        const requestsFailed = !allRequestStatsValid(requestStats);
        const todayRequestCount = todayRequestsResult.status === "fulfilled"
          ? getResponseCount(todayRequestsResult.value)
          : null;
        const todayRequestsFailed = todayRequestCount === null;
        const usersFailed = !(
          userStats
          && validCount(userStats.regular_users)
          && validCount(userStats.agent_users)
        );

        setStats(
          (previous) => ({
            ...previous,

            shipping:
              shippingCount ?? previous.shipping,

            pending:
              requestsFailed ? previous.pending : Number(requestStats.pending),

            inProgress:
              requestsFailed ? previous.inProgress : Number(requestStats.in_progress),

            objection:
              requestsFailed ? previous.objection : Number(requestStats.objection),

            completed:
              requestsFailed ? previous.completed : Number(requestStats.completed),

            todayRequests:
              todayRequestsFailed ? previous.todayRequests : todayRequestCount,

            totalUsers:
              usersFailed
                ? previous.totalUsers
                : Number(userStats.regular_users) + Number(userStats.agent_users),
          }),
        );

        const failedMetrics = {
          shipping: shippingFailed,
          pending: requestsFailed,
          inProgress: requestsFailed,
          objection: requestsFailed,
          completed: requestsFailed,
          todayRequests: todayRequestsFailed,
          totalUsers: usersFailed,
        };

        setMetricErrors(
          (previous) => ({
            ...previous,
            ...failedMetrics,
          }),
        );

        const failedLabels =
          Object.entries(
            failedMetrics,
          )
            .filter(
              ([
                ,
                failed,
              ]) => failed,
            )
            .map(
              ([key]) => key,
            );

        if (
          failedLabels.length > 0
        ) {
          setError(
            t(
              "overview.status.partialFailure",
              {
                sections:
                  failedLabels.join(
                    ", ",
                  ),

                defaultValue:
                  "Some dashboard statistics could not be loaded.",
              },
            ),
          );
        }
      } catch (loadError) {
        console.error(
          "Error fetching dashboard stats:",
          loadError,
        );

        setError(
          t(
            "overview.status.failedToLoadData",
            "Failed to load dashboard data.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [t]);

  const refreshData =
    useCallback(async () => {
      await Promise.allSettled([
        fetchOperationalStats(),
        fetchFinancialData(),
      ]);
    }, [
      fetchFinancialData,
      fetchOperationalStats,
    ]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const updatedEarningData =
    useMemo(
      () => (
        earningData.filter((item) => !["pending", "in-progress"].includes(item.name)).map(
          (item) => {
            const titleKey =
              item.title
                .toLowerCase()
                .replace(
                  /\s+/g,
                  "",
                );

            if (
              titleKey.includes(
                "shipping",
              )
            ) {
              return {
                ...item,

                amount:
                  loading
                    ? "..."
                    : metricErrors.shipping
                      ? "—"
                      : stats.shipping
                          .toString(),

                hasError:
                  Boolean(
                    metricErrors.shipping,
                  ),

                description:
                  t(
                    "overview.cards.shipping-requests.desc",
                    {
                      count:
                        stats.shipping,

                      defaultValue:
                        `${stats.shipping} pending shipping requests`,
                    },
                  ),
              };
            }

            if (
              titleKey.includes(
                "objection",
              )
            ) {
              return {
                ...item,

                amount:
                  loading
                    ? "..."
                    : metricErrors.objection
                      ? "—"
                      : stats.objection
                          .toString(),

                hasError:
                  Boolean(
                    metricErrors.objection,
                  ),

                description:
                  t(
                    "overview.cards.objection-requests.desc",
                    {
                      count:
                        stats.objection,

                      defaultValue:
                        `${stats.objection} objection requests`,
                    },
                  ),
              };
            }

            return item;
          },
        )
      ),
      [
        loading,
        metricErrors,
        stats,
        t,
      ],
    );

  const getStatusColor = (
    count,
  ) => {
    if (count === 0) {
      return "bg-green-500";
    }

    if (count < 5) {
      return "bg-yellow-500";
    }

    return (
      "bg-red-500 "
      + "animate-pulse"
    );
  };

  const getPriorityLevel = (
    count,
  ) => {
    if (count === 0) {
      return "Low";
    }

    if (count < 5) {
      return "Medium";
    }

    return "High";
  };

  const getPriorityClass = (
    level,
  ) => {
    if (level === "High") {
      return (
        "bg-red-100 "
        + "text-red-800"
      );
    }

    if (level === "Medium") {
      return (
        "bg-yellow-100 "
        + "text-yellow-800"
      );
    }

    return (
      "bg-green-100 "
      + "text-green-800"
    );
  };

  const getCountForTitle = (
    titleKey,
  ) => {
    if (
      titleKey.includes(
        "shipping",
      )
    ) {
      return stats.shipping;
    }

    if (
      titleKey.includes(
        "objection",
      )
    ) {
      return stats.objection;
    }

    return 0;
  };

  const revenueUsdText =
    metricErrors.totalRevenue
      ? "—"
      : `$${stats.revenueUsd
          .toLocaleString(
            locale,
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          )}`;

  const revenueSypText =
    metricErrors.totalRevenue
      ? "—"
      : `${stats.revenueSyp
          .toLocaleString(
            locale,
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          )} SYP`;

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
      <div className="mb-7">
        <div
          className="
            relative
            overflow-hidden
            rounded-2xl
            border
            border-gray-100
            bg-white
            px-5
            py-5
            shadow-sm
            dark:border-gray-700
            dark:bg-secondary-dark-bg
            md:px-7
            md:py-6
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              -end-16
              -top-16
              h-48
              w-48
              rounded-full
              opacity-[0.06]
            "
            style={{
              backgroundColor:
                currentColor,
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
                    shadow-sm
                  "
                  style={{
                    backgroundColor:
                      currentColor,
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
                      currentColor,
                  }}
                >
                  {t(
                    "overview.subtitle",
                    "Real-time statistics and monitoring",
                  )}
                </span>
              </div>

              <h1
                className="
                  text-2xl
                  font-extrabold
                  leading-tight
                  tracking-tight
                  text-slate-900
                  dark:text-white
                  md:text-3xl
                  lg:text-4xl
                "
              >
                {t(
                  "overview.title",
                  "Dashboard Overview",
                )}
              </h1>

              <div
                className="
                  mt-4
                  flex
                  items-center
                  gap-1.5
                "
              >
                <span
                  className="
                    h-1
                    w-14
                    rounded-full
                  "
                  style={{
                    backgroundColor:
                      currentColor,
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
                    backgroundColor:
                      currentColor,
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
                    backgroundColor:
                      currentColor,
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={refreshData}
              disabled={
                loading
                || detailsLoading
              }
              style={{
                backgroundColor:
                  currentColor,
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
                md:px-6
                md:py-3
              "
            >
              {(
                loading
                || detailsLoading
              ) ? (
                <>
                  <span
                    className="
                      h-4
                      w-4
                      animate-spin
                      rounded-full
                      border-2
                      border-white/40
                      border-b-white
                    "
                  />

                  {t(
                    "overview.status.loading",
                    "Loading...",
                  )}
                </>
              ) : (
                <>
                  <span
                    className="
                      text-xl
                      leading-none
                    "
                  >
                    ↻
                  </span>

                  {t(
                    "overview.buttons.refresh",
                    "Refresh Data",
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="
            mb-5
            flex
            justify-center
          "
        >
          <div
            className="
              relative
              w-full
              max-w-3xl
              rounded-xl
              border
              border-amber-200
              bg-amber-50
              px-5
              py-4
              text-amber-800
              shadow-sm
              dark:border-amber-800
              dark:bg-amber-900/20
              dark:text-amber-300
            "
            role="alert"
          >
            <div className="pe-7">
              <strong className="font-bold">
                {t(
                  "overview.status.notice",
                  "Notice: ",
                )}
              </strong>

              <span className="block sm:inline">
                {error}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setError(null)}
              className="
                absolute
                end-2
                top-2
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-lg
                transition
                hover:bg-amber-100
                dark:hover:bg-amber-800/40
              "
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <div
          className="
            grid
            w-full
            max-w-7xl
            grid-cols-2
            gap-3
            md:grid-cols-3
            md:gap-5
            xl:grid-cols-4
          "
        >
          {updatedEarningData.map(
            (item) => {
              const titleKey =
                item.title
                  .toLowerCase()
                  .replace(
                    /\s+/g,
                    "",
                  );

              const count =
                getCountForTitle(
                  titleKey,
                );

              const priorityLevel =
                getPriorityLevel(
                  count,
                );

              const priorityClass =
                getPriorityClass(
                  priorityLevel,
                );

              const metricFailed =
                Boolean(
                  item.hasError,
                );

              return (
                <Link
                  key={item.title}
                  to={`/${item.title
                    .toLowerCase()
                    .replace(
                      /\s+/g,
                      "-",
                    )}`}
                  className="
                    relative
                    block
                    h-full
                    min-w-0
                    w-full
                    rounded-2xl
                    border
                    border-gray-100
                    bg-white
                    p-4
                    shadow-sm
                    transition-all
                    duration-200
                    hover:-translate-y-1
                    hover:shadow-lg
                    dark:border-gray-700
                    dark:bg-secondary-dark-bg
                    dark:text-gray-200
                    md:p-6
                  "
                >
                  <div
                    className="
                      mb-4
                      flex
                      items-start
                      justify-between
                      gap-2
                    "
                  >
                    <span
                      className={`
                        rounded-lg
                        px-2.5
                        py-1
                        text-[10px]
                        font-semibold
                        md:text-xs
                        ${
                          metricFailed
                            ? "bg-red-100 text-red-800"
                            : priorityClass
                        }
                      `}
                    >
                      {metricFailed
                        ? t(
                            "overview.status.unavailable",
                            "Unavailable",
                          )
                        : t(
                            `overview.priority.${priorityLevel.toLowerCase()}`,
                            `${priorityLevel} Priority`,
                          )}
                    </span>

                    {(
                      !metricFailed
                      && count > 0
                    ) && (
                      <span
                        className="
                          flex-shrink-0
                          rounded-full
                          bg-red-500
                          px-2
                          py-1
                          text-[10px]
                          font-bold
                          text-white
                          md:text-xs
                        "
                      >
                        {t(
                          "overview.status.pendingCount",
                          {
                            count,

                            defaultValue:
                              `${count} pending`,
                          },
                        )}
                      </span>
                    )}
                  </div>

                  <div
                    className="
                      mb-4
                      flex
                      items-center
                      justify-between
                      gap-3
                    "
                  >
                    <div
                      className="
                        min-w-0
                        flex-1
                      "
                    >
                      <p
                        className="
                          truncate
                          text-xl
                          font-extrabold
                          text-slate-900
                          dark:text-white
                          md:text-3xl
                        "
                      >
                        {item.amount}
                      </p>

                      <p
                        className="
                          mt-1
                          truncate
                          text-xs
                          font-bold
                          text-gray-700
                          dark:text-gray-300
                          md:mt-2
                          md:text-base
                        "
                      >
                        {t(
                          `overview.cards.${item.name}.title`,
                          item.title,
                        )}
                      </p>

                      <p
                        className="
                          mt-1
                          line-clamp-2
                          text-[10px]
                          text-gray-400
                          dark:text-gray-500
                          md:line-clamp-none
                          md:text-xs
                        "
                      >
                        {item.description}
                      </p>
                    </div>

                    <div
                      className="
                        ms-2
                        flex
                        h-11
                        w-11
                        flex-shrink-0
                        items-center
                        justify-center
                        rounded-2xl
                        md:ms-4
                        md:h-16
                        md:w-16
                      "
                      style={{
                        backgroundColor:
                          item.iconBg,
                      }}
                    >
                      <span
                        className="
                          text-lg
                          md:text-2xl
                        "
                        style={{
                          color:
                            item.iconColor,
                        }}
                      >
                        {item.icon}
                      </span>
                    </div>
                  </div>

                  <div
                    className="
                      mt-auto
                      flex
                      items-center
                      justify-between
                      border-t
                      border-gray-100
                      pt-3
                      dark:border-gray-700
                    "
                  >
                    <div
                      className="
                        flex
                        min-w-0
                        items-center
                      "
                    >
                      <div
                        className={`
                          me-1.5
                          h-2.5
                          w-2.5
                          flex-shrink-0
                          rounded-full
                          ${
                            metricFailed
                              ? "bg-red-500"
                              : getStatusColor(
                                  count,
                                )
                          }
                        `}
                      />

                      <span
                        className="
                          truncate
                          text-[10px]
                          text-gray-500
                          dark:text-gray-400
                          md:text-xs
                        "
                      >
                        {metricFailed
                          ? t(
                              "overview.status.requestFailed",
                              "Request failed",
                            )
                          : count > 0
                            ? t(
                                "overview.status.needsAttention",
                                {
                                  count,

                                  defaultValue:
                                    "Needs attention",
                                },
                              )
                            : t(
                                "overview.status.allCaughtUp",
                                "All caught up",
                              )}
                      </span>
                    </div>

                    <div
                      className="
                        flex-shrink-0
                        text-[10px]
                        text-gray-400
                      "
                    >
                      {loading
                        ? t(
                            "overview.status.updating",
                            "Updating",
                          )
                        : metricFailed
                          ? t(
                              "overview.status.unavailable",
                              "Unavailable",
                            )
                          : t(
                              "overview.status.live",
                              "Live",
                            )}
                    </div>
                  </div>
                </Link>
              );
            },
          )}
          {[
            {
              key: "completed",
              title: t("overview.cards.completed.title", isArabic ? "الطلبات المكتملة" : "Completed Requests"),
              description: t("overview.cards.completed.desc", isArabic ? "الطلبات الإدارية المكتملة منذ بداية النظام" : "Completed administrative requests across all dates"),
              amount: stats.completed,
              failed: metricErrors.completed,
              icon: "✓",
              iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
              iconColor: "text-emerald-600",
            },
            {
              key: "todayRequests",
              title: t("overview.cards.today.title", isArabic ? "طلبات اليوم" : "Today's Requests"),
              description: t("overview.cards.today.desc", isArabic ? "الطلبات الإدارية المنشأة اليوم، وليس عمليات شراء المنتجات" : "Administrative requests created today, not product purchases"),
              amount: stats.todayRequests,
              failed: metricErrors.todayRequests,
              icon: "◷",
              iconBg: "bg-sky-50 dark:bg-sky-950/40",
              iconColor: "text-sky-600",
            },
          ].map((item) => (
            <div
              key={item.key}
              className="relative flex h-full min-w-0 flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-secondary-dark-bg md:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold md:text-xs ${item.failed ? "bg-red-100 text-red-800" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
                  {item.failed
                    ? t("overview.status.unavailable", "Unavailable")
                    : t("overview.status.live", "Live")}
                </span>
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-2xl ${item.iconBg} ${item.iconColor}`}>
                  {item.icon}
                </span>
              </div>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white md:text-3xl">
                {loading ? "..." : item.failed ? "—" : item.amount.toLocaleString(locale)}
              </p>
              <h3 className="mt-2 text-sm font-bold text-gray-700 dark:text-gray-200 md:text-base">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-gray-400 dark:text-gray-500">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="
          mx-auto
          mt-8
          flex
          w-full
          max-w-7xl
          flex-wrap
          justify-center
          gap-4
          md:gap-6
          xl:flex-nowrap
        "
      >
        <div
          className="
            w-full
            min-w-0
            rounded-2xl
            border
            border-gray-100
            bg-white
            p-4
            shadow-sm
            dark:border-gray-700
            dark:bg-secondary-dark-bg
            dark:text-gray-200
            md:p-6
            xl:flex-1
          "
        >
          <div
            className="
              mb-6
              flex
              flex-wrap
              items-center
              justify-between
              gap-4
            "
          >
            <div className="text-start">
              <p
                className="
                  text-xl
                  font-extrabold
                  text-slate-900
                  dark:text-white
                "
              >
                {t(
                  "overview.revenue.title",
                  "Revenue Analytics",
                )}
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  text-gray-500
                "
              >
                {t(
                  "overview.revenue.subtitle",
                  "Actual successful purchase revenue from the financial ledger",
                )}
              </p>
            </div>

            <div
              className="
                flex
                flex-wrap
                items-center
                gap-4
              "
            >
              <p
                className="
                  flex
                  items-center
                  gap-2
                  text-gray-600
                  dark:text-gray-300
                "
              >
                <GoPrimitiveDot
                  style={{
                    color:
                      currentColor,
                  }}
                />

                <span>
                  {t(
                    "overview.revenue.usd",
                    "USD Transactions",
                  )}
                </span>
              </p>

              <p
                className="
                  flex
                  items-center
                  gap-2
                  text-emerald-500
                "
              >
                <GoPrimitiveDot />

                <span>
                  {t(
                    "overview.revenue.syp",
                    "SYP Transactions",
                  )}
                </span>
              </p>
            </div>
          </div>

          <div
            className="
              mt-6
              flex
              flex-wrap
              justify-center
              gap-8
            "
          >
            <div
              className="
                m-4
                border-e-0
                border-gray-200
                pe-0
                text-center
                dark:border-gray-700
                md:border-e
                md:pe-8
                md:text-start
              "
            >
              <div className="mb-6">
                <p
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-wide
                    text-gray-400
                  "
                >
                  {t(
                    "overview.revenue.total",
                    "Total Revenue",
                  )}
                </p>

                <p
                  dir="ltr"
                  className="
                    mt-2
                    text-3xl
                    font-extrabold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {revenueUsdText}
                </p>

                <p
                  dir="ltr"
                  className="
                    mt-2
                    text-lg
                    font-bold
                    text-emerald-500
                  "
                >
                  {revenueSypText}
                </p>

                {metricErrors.totalRevenue && (
                  <p
                    className="
                      mt-2
                      text-xs
                      font-semibold
                      text-red-500
                    "
                  >
                    {t(
                      "overview.revenue.loadFailed",
                      "Financial totals could not be loaded.",
                    )}
                  </p>
                )}
              </div>

              <div className="mb-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                <p className="mb-2 text-xs font-bold text-gray-400">
                  {isArabic ? "إيرادات اليوم (بتوقيت دمشق)" : "Today's Revenue (Damascus time)"}
                </p>
                <p dir="ltr" className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {metricErrors.todayRevenue ? "—" : `$${stats.todayRevenueUsd.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
                <p dir="ltr" className="mt-1 font-bold text-emerald-500">
                  {metricErrors.todayRevenue ? "—" : `${stats.todayRevenueSyp.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SYP`}
                </p>
              </div>

              <div>
                <p
                  className="
                    text-2xl
                    font-bold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {metricErrors.totalUsers
                    ? "—"
                    : stats.totalUsers}
                </p>

                <p
                  className="
                    mt-1
                    text-gray-500
                  "
                >
                  {t(
                    "overview.revenue.registeredUsers",
                    "Registered Users",
                  )}
                </p>
              </div>
            </div>

            <div
              className="
                flex
                min-h-[300px]
                w-full
                max-w-full
                flex-1
                items-center
                justify-center
                overflow-hidden
              "
            >
              {detailsLoading ? (
                <div
                  className="
                    flex
                    flex-col
                    items-center
                    justify-center
                  "
                >
                  <div
                    className="
                      mb-2
                      h-8
                      w-8
                      animate-spin
                      rounded-full
                      border-b-2
                      border-blue-500
                    "
                  />

                  <span
                    className="
                      text-sm
                      text-gray-500
                    "
                  >
                    {t(
                      "overview.status.loading",
                      "Loading chart data...",
                    )}
                  </span>
                </div>
              ) : metricErrors.financialChart ? (
                <div
                  className="
                    text-center
                    text-sm
                    text-red-500
                  "
                >
                  {t(
                    "overview.status.failedToLoadData",
                    "Failed to load financial chart data",
                  )}
                </div>
              ) : (
                <RevenueChart
                  rows={
                    monthlyRevenue
                  }
                  currentColor={
                    currentColor
                  }
                  t={t}
                />
              )}
            </div>
          </div>
        </div>

        <div
          className="
            w-full
            flex-shrink-0
            rounded-2xl
            border
            border-gray-100
            bg-white
            p-4
            shadow-sm
            dark:border-gray-700
            dark:bg-secondary-dark-bg
            dark:text-gray-200
            md:p-6
            xl:w-96
          "
        >
          <div
            className="
              mb-6
              text-start
            "
          >
            <p
              className="
                text-xl
                font-extrabold
                text-slate-900
                dark:text-white
              "
            >
              {t(
                "overview.summary.title",
                "Quick Summary",
              )}
            </p>

            <p
              className="
                mt-1
                text-sm
                text-gray-500
              "
            >
              {t(
                "overview.summary.subtitle",
                "Request overview",
              )}
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                key: "shipping",
                label: t("overview.summary.shipping", "Shipping Requests"),
                value: stats.shipping,
                failed: metricErrors.shipping,
                style: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
              },
              {
                key: "completed",
                label: t("overview.cards.completed.title", isArabic ? "الطلبات المكتملة" : "Completed Requests"),
                value: stats.completed,
                failed: metricErrors.completed,
                style: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
              },
              {
                key: "todayRequests",
                label: t("overview.cards.today.title", isArabic ? "طلبات اليوم" : "Today's Requests"),
                value: stats.todayRequests,
                failed: metricErrors.todayRequests,
                style: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300",
              },
              {
                key: "objection",
                label: t("overview.summary.objections", "Objections"),
                value: stats.objection,
                failed: metricErrors.objection,
                style: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
              },
            ].map((item) => (
              <div
                key={item.key}
                className={`flex items-center justify-between gap-3 rounded-xl p-3 ${item.style}`}
              >
                <span className="font-semibold">{item.label}</span>
                <span className="rounded-lg bg-white/70 px-2.5 py-1 text-sm font-extrabold text-slate-900 dark:bg-slate-800 dark:text-white">
                  {loading ? "..." : item.failed ? "—" : item.value.toLocaleString(locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
