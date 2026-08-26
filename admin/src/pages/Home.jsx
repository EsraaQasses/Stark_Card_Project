import React, { useEffect, useState } from "react";
import { GoPrimitiveDot } from "react-icons/go";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Stacked } from "../components";
import { useStateContext } from "../contexts/ContextProvider";
import { earningData } from "../data/earningData";
import axiosInstance from "../utils/axiosConfig";

const Home = () => {
  const { currentMode, currentColor } = useStateContext();
  const { t } = useTranslation(["dashboard", "common"]);

  const [stats, setStats] = useState({
    shipping: 0,
    pending: 0,
    inProgress: 0,
    objection: 0,
    totalUsers: 0,
    totalRevenue: 0,
  });

  const [chartData, setChartData] = useState({
    salesData: [],
    customersData: [],
    hasEnoughData: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metricErrors, setMetricErrors] = useState({});
  const [
    detailsLoading,
    setDetailsLoading,
  ] = useState(true);
  // ============================================
  // Fetch Dashboard Data
  // ============================================
  const normalizeRows = (response) => {
  const payload = response?.data;

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
};

const buildChartData = (requests) => {
    const monthKeys = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'july',
    ];

    const monthMap = {
      Jan: 'jan',
      Feb: 'feb',
      Mar: 'mar',
      Apr: 'apr',
      May: 'may',
      Jun: 'jun',
      Jul: 'july',
      July: 'july',
    };

    const monthlyStats = {};

    monthKeys.forEach((month) => {
      monthlyStats[month] = {
        sales: 0,
        customers: new Set(),
      };
    });

    let hasData = false;

    requests.forEach((request) => {
      const dateValue = (
        request.created_at
        || request.Timestamp
        || request.created
      );

      if (!dateValue) {
        return;
      }

      const date = new Date(dateValue);

      if (Number.isNaN(date.getTime())) {
        return;
      }

      const monthName = date.toLocaleString(
        'en-US',
        {
          month: 'short',
        },
      );

      const monthKey = monthMap[monthName];

      if (!monthKey || !monthlyStats[monthKey]) {
        return;
      }

      hasData = true;

      monthlyStats[monthKey].sales += (
        parseFloat(request.amount) || 0
      );

      const userId = (
        request.user?.id
        || request.user_id
        || request.SourceEntityID
        || `request-${request.id}`
      );

      monthlyStats[monthKey].customers.add(
        userId,
      );
    });

    let distinctMonthsWithData = 0;

    const salesData = monthKeys.map(
      (month) => {
        const sales = (
          monthlyStats[month].sales
        );

        const customers = (
          monthlyStats[month]
            .customers
            .size
        );

        if (
          sales > 0
          || customers > 0
        ) {
          distinctMonthsWithData += 1;
        }

        return {
          x: (
            month.charAt(0).toUpperCase()
            + month.slice(1)
          ),

          y: Number(
            sales.toFixed(2),
          ),
        };
      },
    );

    const customersData = monthKeys.map(
      (month) => ({
        x: (
          month.charAt(0).toUpperCase()
          + month.slice(1)
        ),

        y: (
          monthlyStats[month]
            .customers
            .size
        ),
      }),
    );

    return {
      salesData,
      customersData,

      hasEnoughData: (
        hasData
        && distinctMonthsWithData >= 3
      ),
    };
  };

const loadRevenueAndChart = async () => {
    setDetailsLoading(true);

    try {
      const results = await Promise.allSettled([
        axiosInstance.get(
          '/all_requests/admin/requests/',
          {
            params: {
              status: 'pending',
              page_size: 100,
            },
          },
        ),

        axiosInstance.get(
          '/all_requests/admin/requests/',
          {
            params: {
              status: 'in_progress',
              page_size: 100,
            },
          },
        ),

        axiosInstance.get(
          '/all_requests/admin/requests/',
          {
            params: {
              status: 'objection',
              page_size: 100,
            },
          },
        ),
      ]);

      const allRequests = results.flatMap(
        (result) => {
          if (result.status !== 'fulfilled') {
            return [];
          }

          return normalizeRows(
            result.value,
          );
        },
      );

      const totalRevenue = allRequests.reduce(
        (sum, request) => (
          sum
          + (
            parseFloat(request.amount)
            || 0
          )
        ),
        0,
      );

      setStats((previous) => ({
        ...previous,
        totalRevenue,
      }));

      setChartData(
        buildChartData(allRequests),
      );

      const allFailed = results.every(
        (result) => (
          result.status === 'rejected'
        ),
      );

      setMetricErrors((previous) => ({
        ...previous,
        totalRevenue: allFailed,
      }));
    } catch (loadError) {
      console.error(
        'Background dashboard data failed:',
        loadError,
      );

      setMetricErrors((previous) => ({
        ...previous,
        totalRevenue: true,
      }));
    } finally {
      setDetailsLoading(false);
    }
  };

const fetchAllStats = async () => {
    setLoading(true);
    setError(null);

    setMetricErrors({});

    try {
      const results = await Promise.allSettled([
        Promise.all([
          axiosInstance.get(
            '/shipping/standard/',
            {
              params: {
                status: 'pending',
                page_size: 1,
              },
            },
          ),

          axiosInstance.get(
            '/shipping/via-agent/',
            {
              params: {
                status: 'pending',
                page_size: 1,
              },
            },
          ),

          axiosInstance.get(
            '/shipping/agent-admin/',
            {
              params: {
                status: 'pending',
                page_size: 1,
              },
            },
          ),
        ]),

        axiosInstance.get(
          '/all_requests/admin/requests/stats/',
        ),

        axiosInstance.get(
          '/users/stats/',
        ),
      ]);

      const [
        shippingResult,
        requestsStatsResult,
        usersResult,
      ] = results;

      let shippingCount = 0;

      if (
        shippingResult.status
        === 'fulfilled'
      ) {
        shippingCount = (
          shippingResult.value.reduce(
            (total, response) => (
              total
              + (
                response.data?.count
                ?? (
                  Array.isArray(response.data)
                    ? response.data.length
                    : 0
                )
              )
            ),
            0,
          )
        );
      }

      const requestStats = (
        requestsStatsResult.status
        === 'fulfilled'
          ? requestsStatsResult.value.data
          : {}
      );

      const userStats = (
        usersResult.status
        === 'fulfilled'
          ? usersResult.value.data
          : {}
      );

      setStats((previous) => ({
        ...previous,

        shipping: shippingCount,

        pending: (
          requestStats.pending
          ?? previous.pending
        ),

        inProgress: (
          requestStats.in_progress
          ?? previous.inProgress
        ),

        objection: (
          requestStats.objection
          ?? previous.objection
        ),

        totalUsers: (
          userStats.total_users
          ?? previous.totalUsers
        ),
      }));

      const failedMetrics = {
        shipping: (
          shippingResult.status
          === 'rejected'
        ),

        pending: (
          requestsStatsResult.status
          === 'rejected'
        ),

        inProgress: (
          requestsStatsResult.status
          === 'rejected'
        ),

        objection: (
          requestsStatsResult.status
          === 'rejected'
        ),

        totalUsers: (
          usersResult.status
          === 'rejected'
        ),

        totalRevenue: false,
      };

      setMetricErrors(failedMetrics);

      const failedLabels = Object.entries(
        failedMetrics,
      )
        .filter(([
          key,
          failed,
        ]) => (
          failed
          && key !== 'totalRevenue'
        ))
        .map(([key]) => key);

      if (failedLabels.length) {
        setError(
          t(
            'overview.status.partialFailure',
            {
              sections:
                failedLabels.join(', '),
            },
          ),
        );
      }
    } catch (loadError) {
      console.error(
        'Error fetching dashboard stats:',
        loadError,
      );

      setError(
        t(
          'overview.status.failedToLoadData',
          'Failed to load dashboard data.',
        ),
      );
    } finally {
      /*
      * هون الصفحة بتظهر فوراً.
      * ما عاد ننتظر بيانات الإيرادات والشارت.
      */
      setLoading(false);

      const loadDetails = () => {
        loadRevenueAndChart();
      };

      if (
        typeof window.requestIdleCallback
        === 'function'
      ) {
        window.requestIdleCallback(
          loadDetails,
          {
            timeout: 800,
          },
        );
      } else {
        window.setTimeout(
          loadDetails,
          150,
        );
      }
    }
  };

  useEffect(() => {
    fetchAllStats();
  }, []);

  // ============================================
  // Prepare Cards Data
  // ============================================
  const updatedEarningData = earningData.map((item) => {
    const titleKey = item.title
      .toLowerCase()
      .replace(/\s+/g, "");

    if (titleKey.includes("shipping")) {
      return {
        ...item,

        amount: loading
          ? "..."
          : metricErrors.shipping
            ? "—"
            : stats.shipping.toString(),

        hasError: Boolean(metricErrors.shipping),

        description: t(
          "overview.cards.shipping-requests.desc",
          {
            count: stats.shipping,
          },
        ),
      };
    }

    if (titleKey.includes("pending")) {
      return {
        ...item,

        amount: loading
          ? "..."
          : metricErrors.pending
            ? "—"
            : stats.pending.toString(),

        hasError: Boolean(metricErrors.pending),

        description: t(
          "overview.cards.pending.desc",
          {
            count: stats.pending,
          },
        ),
      };
    }

    if (titleKey.includes("progress")) {
      return {
        ...item,

        amount: loading
          ? "..."
          : metricErrors.inProgress
            ? "—"
            : stats.inProgress.toString(),

        hasError: Boolean(metricErrors.inProgress),

        description: t(
          "overview.cards.in-progress.desc",
          {
            count: stats.inProgress,
          },
        ),
      };
    }

    if (titleKey.includes("objection")) {
      return {
        ...item,

        amount: loading
          ? "..."
          : metricErrors.objection
            ? "—"
            : stats.objection.toString(),

        hasError: Boolean(metricErrors.objection),

        description: t(
          "overview.cards.objection-requests.desc",
          {
            count: stats.objection,
          },
        ),
      };
    }

    if (
      titleKey.includes("customer")
      || titleKey.includes("user")
    ) {
      return {
        ...item,

        amount: loading
          ? "..."
          : metricErrors.totalUsers
            ? "—"
            : stats.totalUsers.toString(),

        hasError: Boolean(metricErrors.totalUsers),

        description: t(
          "overview.revenue.registeredUsersDesc",
          {
            count: stats.totalUsers,
          },
        ),
      };
    }

    if (
      titleKey.includes("revenue")
      || titleKey.includes("sales")
    ) {
      return {
        ...item,

        amount: loading
          ? "..."
          : metricErrors.totalRevenue
            ? "—"
            : `$${stats.totalRevenue.toLocaleString()}`,

        hasError: Boolean(metricErrors.totalRevenue),

        description: t(
          "overview.revenue.pendingDesc",
          "Total pending revenue",
        ),
      };
    }

    return item;
  });

  // ============================================
  // Helpers
  // ============================================
  const refreshData = () => {
    fetchAllStats();
  };

  const getStatusColor = (count) => {
    if (count === 0) {
      return "bg-green-500";
    }

    if (count < 5) {
      return "bg-yellow-500";
    }

    return "bg-red-500 animate-pulse";
  };

  const getPriorityLevel = (count) => {
    if (count === 0) {
      return "Low";
    }

    if (count < 5) {
      return "Medium";
    }

    return "High";
  };

  const getPriorityClass = (level) => {
    if (level === "High") {
      return "bg-red-100 text-red-800";
    }

    if (level === "Medium") {
      return "bg-yellow-100 text-yellow-800";
    }

    return "bg-green-100 text-green-800";
  };

  const getCountForTitle = (titleKey) => {
    if (titleKey.includes("shipping")) {
      return stats.shipping;
    }

    if (titleKey.includes("pending")) {
      return stats.pending;
    }

    if (titleKey.includes("progress")) {
      return stats.inProgress;
    }

    if (titleKey.includes("objection")) {
      return stats.objection;
    }

    if (
      titleKey.includes("customer")
      || titleKey.includes("user")
    ) {
      return stats.totalUsers;
    }

    return 0;
  };

  const handleErrorClose = () => {
    setError(null);
  };

  // ============================================
  // Render
  // ============================================
  return (
    <div className="mt-20 md:mt-4 px-3 sm:px-5 md:px-8 py-4 md:py-6">

      {/* ============================================
          HEADER
      ============================================ */}
      <div className="mb-7">
        <div
          className="
            relative
            overflow-hidden
            bg-white
            dark:bg-secondary-dark-bg
            border
            border-gray-100
            dark:border-gray-700
            rounded-2xl
            shadow-sm
            px-5
            md:px-7
            py-5
            md:py-6
          "
        >
          {/* Decorative Background */}
          <div
            className="
              absolute
              -top-16
              -end-16
              w-48
              h-48
              rounded-full
              opacity-[0.06]
              pointer-events-none
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
              sm:flex-row
              sm:items-center
              justify-between
              gap-5
            "
          >
            {/* Header Text */}
            <div className="text-start">

              {/* Subtitle */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="
                    w-2.5
                    h-2.5
                    rounded-full
                    shadow-sm
                  "
                  style={{
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="text-sm md:text-base font-bold"
                  style={{
                    color: currentColor,
                  }}
                >
                  {t(
                    "overview.subtitle",
                    "Real-time statistics and monitoring",
                  )}
                </span>
              </div>

              {/* Main Title */}
              <h1
                className="
                  text-2xl
                  md:text-3xl
                  lg:text-4xl
                  font-extrabold
                  tracking-tight
                  leading-tight
                  text-slate-900
                  dark:text-white
                "
              >
                {t(
                  "overview.title",
                  "Dashboard Overview",
                )}
              </h1>

              {/* Accent Line */}
              <div className="flex items-center gap-1.5 mt-4">
                <span
                  className="h-1 w-14 rounded-full"
                  style={{
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="h-1 w-6 rounded-full opacity-60"
                  style={{
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="h-1 w-2 rounded-full opacity-30"
                  style={{
                    backgroundColor: currentColor,
                  }}
                />
              </div>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={refreshData}
              disabled={loading}
              style={{
                backgroundColor: currentColor,
              }}
              className="
                w-full
                sm:w-auto
                px-5
                py-2.5
                md:px-6
                md:py-3
                text-white
                rounded-xl
                text-sm
                font-bold
                flex
                items-center
                justify-center
                gap-2
                shadow-md
                hover:shadow-lg
                hover:opacity-90
                active:scale-95
                disabled:opacity-60
                disabled:cursor-not-allowed
                transition-all
                duration-200
              "
            >
              {loading ? (
                <>
                  <span
                    className="
                      animate-spin
                      rounded-full
                      h-4
                      w-4
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
                  <span className="text-xl leading-none">
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

      {/* ============================================
          ERROR / PARTIAL FAILURE MESSAGE
      ============================================ */}
      {error && (
        <div className="flex justify-center mb-5">
          <div
            className="
              relative
              w-full
              max-w-3xl
              bg-amber-50
              dark:bg-amber-900/20
              border
              border-amber-200
              dark:border-amber-800
              text-amber-800
              dark:text-amber-300
              px-5
              py-4
              rounded-xl
              shadow-sm
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
              onClick={handleErrorClose}
              className="
                absolute
                top-2
                end-2
                w-7
                h-7
                rounded-lg
                flex
                items-center
                justify-center
                hover:bg-amber-100
                dark:hover:bg-amber-800/40
                transition
              "
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ============================================
          DASHBOARD CARDS
      ============================================ */}
      <div className="flex justify-center">
        <div
          className="
            grid
            grid-cols-2
            md:grid-cols-3
            xl:grid-cols-4
            gap-3
            md:gap-5
            w-full
            max-w-7xl
          "
        >
          {updatedEarningData.map((item) => {
            const titleKey = item.title
              .toLowerCase()
              .replace(/\s+/g, "");

            const count = getCountForTitle(titleKey);

            const priorityLevel = getPriorityLevel(count);

            const priorityClass = getPriorityClass(
              priorityLevel,
            );

            const metricFailed = Boolean(
              item.hasError,
            );

            return (
              <Link
                key={item.title}
                to={`/${item.title
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
                className="
                  block
                  relative
                  min-w-0
                  w-full
                  h-full
                  bg-white
                  dark:bg-secondary-dark-bg
                  dark:text-gray-200
                  p-4
                  md:p-6
                  rounded-2xl
                  border
                  border-gray-100
                  dark:border-gray-700
                  shadow-sm
                  hover:shadow-lg
                  hover:-translate-y-1
                  transition-all
                  duration-200
                "
              >
                {!item.title
                  .toLowerCase()
                  .includes("revenue") && (
                  <div
                    className="
                      flex
                      justify-between
                      items-start
                      gap-2
                      mb-4
                    "
                  >
                    <span
                      className={`
                        px-2.5
                        py-1
                        rounded-lg
                        text-[10px]
                        md:text-xs
                        font-semibold
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

                    {!metricFailed && count > 0 && (
                      <span
                        className="
                          bg-red-500
                          text-white
                          text-[10px]
                          md:text-xs
                          font-bold
                          px-2
                          py-1
                          rounded-full
                          flex-shrink-0
                        "
                      >
                        {t(
                          "overview.status.pendingCount",
                          {
                            count,
                          },
                        )}
                      </span>
                    )}
                  </div>
                )}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                    mb-4
                  "
                >
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="
                        text-xl
                        md:text-3xl
                        font-extrabold
                        text-slate-900
                        dark:text-white
                        truncate
                      "
                    >
                      {item.amount}

                      {loading && (
                        <span className="text-xs text-blue-500 ms-2">
                          ⟳
                        </span>
                      )}
                    </p>

                    <p
                      className="
                        text-xs
                        md:text-base
                        text-gray-700
                        dark:text-gray-300
                        mt-1
                        md:mt-2
                        font-bold
                        truncate
                      "
                    >
                      {t(
                        `overview.cards.${item.name}.title`,
                        item.title,
                      )}
                    </p>

                    <p
                      className="
                        text-[10px]
                        md:text-xs
                        text-gray-400
                        dark:text-gray-500
                        mt-1
                        line-clamp-2
                        md:line-clamp-none
                      "
                    >
                      {item.description}
                    </p>
                  </div>

                  {/* Icon */}
                  <div
                    className="
                      flex
                      items-center
                      justify-center
                      w-11
                      h-11
                      md:w-16
                      md:h-16
                      rounded-2xl
                      ms-2
                      md:ms-4
                      flex-shrink-0
                    "
                    style={{
                      backgroundColor: item.iconBg,
                    }}
                  >
                    <span
                      style={{
                        color: item.iconColor,
                      }}
                      className="text-lg md:text-2xl"
                    >
                      {item.icon}
                    </span>
                  </div>
                </div>

                {!item.title
                  .toLowerCase()
                  .includes("revenue") && (
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      border-t
                      border-gray-100
                      dark:border-gray-700
                      pt-3
                      mt-auto
                    "
                  >
                    <div className="flex items-center min-w-0">
                      <div
                        className={`
                          w-2.5
                          h-2.5
                          rounded-full
                          me-1.5
                          flex-shrink-0
                          ${
                            metricFailed
                              ? "bg-red-500"
                              : getStatusColor(count)
                          }
                        `}
                      />

                      <span
                        className="
                          text-[10px]
                          md:text-xs
                          text-gray-500
                          dark:text-gray-400
                          truncate
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
                                },
                              )
                            : t(
                                "overview.status.allCaughtUp",
                              )}
                      </span>
                    </div>

                    <div
                      className="
                        text-[10px]
                        text-gray-400
                        flex-shrink-0
                      "
                    >
                      {loading
                        ? t(
                            "overview.status.updating",
                          )
                        : metricFailed
                          ? t(
                              "overview.status.unavailable",
                              "Unavailable",
                            )
                          : t(
                              "overview.status.live",
                            )}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ============================================
          BOTTOM SECTION
      ============================================ */}
      <div
        className="
          flex
          gap-4
          md:gap-6
          flex-wrap
          xl:flex-nowrap
          justify-center
          mt-8
          max-w-7xl
          mx-auto
          w-full
        "
      >
        {/* ============================================
            REVENUE ANALYTICS
        ============================================ */}
        <div
          className="
            bg-white
            dark:text-gray-200
            dark:bg-secondary-dark-bg
            border
            border-gray-100
            dark:border-gray-700
            shadow-sm
            p-4
            md:p-6
            rounded-2xl
            w-full
            xl:flex-1
            min-w-0
          "
        >
          {/* Revenue Header */}
          <div
            className="
              flex
              justify-between
              items-center
              mb-6
              flex-wrap
              gap-4
            "
          >
            <div className="text-start">
              <p
                className="
                  font-extrabold
                  text-xl
                  text-slate-900
                  dark:text-white
                "
              >
                {t(
                  "overview.revenue.title",
                  "Revenue Analytics",
                )}
              </p>

              <p className="text-gray-500 text-sm mt-1">
                {t(
                  "overview.revenue.subtitle",
                  "Real-time financial overview",
                )}
              </p>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <p
                className="
                  flex
                  items-center
                  gap-2
                  text-gray-600
                  dark:text-gray-300
                "
              >
                <GoPrimitiveDot className="text-blue-500" />

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
                  text-green-500
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
              gap-8
              flex-wrap
              justify-center
            "
          >
            {/* Revenue Stats */}
            <div
              className="
                border-e-0
                md:border-e
                border-gray-200
                dark:border-gray-700
                m-4
                pe-0
                md:pe-8
                text-center
                md:text-start
              "
            >
              <div className="mb-6">
                <p>
                  <span
                    className="
                      text-3xl
                      font-extrabold
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {!metricErrors.totalRevenue && "$"}

                    {metricErrors.totalRevenue
                      ? "—"
                      : stats.totalRevenue.toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                  </span>

                  <span
                    className="
                      p-1.5
                      rounded-full
                      text-white
                      bg-green-400
                      ms-3
                      text-xs
                    "
                  >
                    {t(
                      "overview.revenue.total",
                      "Total",
                    )}
                  </span>
                </p>

                <p className="text-gray-500 mt-1">
                  {t(
                    "overview.revenue.pending",
                    "Pending Revenue",
                  )}
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

                <p className="text-gray-500 mt-1">
                  {t(
                    "overview.revenue.registeredUsers",
                    "Registered Users",
                  )}
                </p>
              </div>
            </div>

            {/* Chart */}
            <div
              className="
                flex-1
                w-full
                max-w-full
                overflow-hidden
                min-h-[300px]
                flex
                items-center
                justify-center
              "
            >
              {loading ? (
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
                      animate-spin
                      rounded-full
                      h-8
                      w-8
                      border-b-2
                      border-blue-500
                      mb-2
                    "
                  />

                  <span className="text-gray-500 text-sm">
                    {t(
                      "overview.status.loading",
                      "Loading chart data...",
                    )}
                  </span>
                </div>
              ) : (
                metricErrors.pending
                && metricErrors.inProgress
                && metricErrors.objection
              ) ? (
                <div className="text-red-500 text-sm text-center">
                  {t(
                    "overview.status.failedToLoadData",
                    "Failed to load chart data",
                  )}
                </div>
              ) : !chartData.hasEnoughData ? (
                <div
                  className="
                    flex
                    flex-col
                    items-center
                    justify-center
                    p-6
                    border-2
                    border-dashed
                    border-gray-200
                    dark:border-gray-700
                    rounded-xl
                    text-center
                    w-full
                  "
                >
                  <span className="text-4xl mb-2">
                    📊
                  </span>

                  <p
                    className="
                      text-gray-600
                      dark:text-gray-400
                      font-semibold
                    "
                  >
                    {t(
                      "overview.revenue.noChartData",
                      "No Sufficient Historical Data",
                    )}
                  </p>

                  <p
                    className="
                      text-xs
                      text-gray-400
                      dark:text-gray-500
                      max-w-[250px]
                      mt-1
                      mx-auto
                    "
                  >
                    {t(
                      "overview.revenue.noChartDataDesc",
                      "At least 3 months of transaction history are required to generate the chart.",
                    )}
                  </p>
                </div>
              ) : (
                <Stacked
                  currentMode={currentMode}
                  width="100%"
                  height="300px"
                  salesData={chartData.salesData}
                  customersData={chartData.customersData}
                />
              )}
            </div>
          </div>
        </div>

        {/* ============================================
            QUICK SUMMARY
        ============================================ */}
        <div
          className="
            bg-white
            dark:text-gray-200
            dark:bg-secondary-dark-bg
            border
            border-gray-100
            dark:border-gray-700
            shadow-sm
            p-4
            md:p-6
            rounded-2xl
            w-full
            xl:w-96
            flex-shrink-0
          "
        >
          <div className="mb-6 text-start">
            <p
              className="
                font-extrabold
                text-xl
                text-slate-900
                dark:text-white
              "
            >
              {t(
                "overview.summary.title",
                "Quick Summary",
              )}
            </p>

            <p className="text-gray-500 text-sm mt-1">
              {t(
                "overview.summary.subtitle",
                "Request overview",
              )}
            </p>
          </div>

          <div className="space-y-4">

            {/* Shipping */}
            <div
              className="
                flex
                justify-between
                items-center
                p-3
                bg-blue-50
                dark:bg-blue-900/20
                rounded-xl
              "
            >
              <span
                className="
                  text-blue-600
                  dark:text-blue-300
                  font-medium
                "
              >
                {t(
                  "overview.summary.shipping",
                  "Shipping Requests",
                )}
              </span>

              <span
                className="
                  bg-blue-100
                  dark:bg-blue-800
                  text-blue-800
                  dark:text-blue-200
                  px-2.5
                  py-1
                  rounded-lg
                  text-sm
                  font-bold
                "
              >
                {metricErrors.shipping
                  ? "—"
                  : stats.shipping}
              </span>
            </div>

            {/* Pending */}
            <div
              className="
                flex
                justify-between
                items-center
                p-3
                bg-yellow-50
                dark:bg-yellow-900/20
                rounded-xl
              "
            >
              <span
                className="
                  text-yellow-600
                  dark:text-yellow-300
                  font-medium
                "
              >
                {t(
                  "overview.summary.pending",
                  "Pending Reviews",
                )}
              </span>

              <span
                className="
                  bg-yellow-100
                  dark:bg-yellow-800
                  text-yellow-800
                  dark:text-yellow-200
                  px-2.5
                  py-1
                  rounded-lg
                  text-sm
                  font-bold
                "
              >
                {metricErrors.pending
                  ? "—"
                  : stats.pending}
              </span>
            </div>

            {/* In Progress */}
            <div
              className="
                flex
                justify-between
                items-center
                p-3
                bg-green-50
                dark:bg-green-900/20
                rounded-xl
              "
            >
              <span
                className="
                  text-green-600
                  dark:text-green-300
                  font-medium
                "
              >
                {t(
                  "overview.summary.inProgress",
                  "In Progress",
                )}
              </span>

              <span
                className="
                  bg-green-100
                  dark:bg-green-800
                  text-green-800
                  dark:text-green-200
                  px-2.5
                  py-1
                  rounded-lg
                  text-sm
                  font-bold
                "
              >
                {metricErrors.inProgress
                  ? "—"
                  : stats.inProgress}
              </span>
            </div>

            {/* Objections */}
            <div
              className="
                flex
                justify-between
                items-center
                p-3
                bg-orange-50
                dark:bg-orange-900/20
                rounded-xl
              "
            >
              <span
                className="
                  text-orange-600
                  dark:text-orange-300
                  font-medium
                "
              >
                {t(
                  "overview.summary.objections",
                  "Objections",
                )}
              </span>

              <span
                className="
                  bg-orange-100
                  dark:bg-orange-800
                  text-orange-800
                  dark:text-orange-200
                  px-2.5
                  py-1
                  rounded-lg
                  text-sm
                  font-bold
                "
              >
                {metricErrors.objection
                  ? "—"
                  : stats.objection}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;