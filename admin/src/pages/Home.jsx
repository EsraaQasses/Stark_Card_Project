import React, { useEffect, useState } from "react";
import { GoPrimitiveDot } from "react-icons/go";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Stacked } from "../components";
import { useStateContext } from "../contexts/ContextProvider";
import { earningData } from "../data/earningData";
import axiosInstance from "../utils/axiosConfig";

const Home = () => {
  const { currentMode } = useStateContext();
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

  const fetchAllStats = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Starting to fetch dashboard stats...');

      const requests = [
        // Shipping count
        axiosInstance.get("/shipping/count/").then(response => {
          console.log('Shipping count response:', response.data);
          return response;
        }).catch((error) => {
          console.warn("Shipping count failed:", error.response?.status, error.message);
          return { data: { pending_count: 0 } };
        }),
        
        // Pending requests
        axiosInstance.get("/all_requests/admin/requests/?status=pending").then(response => {
          console.log('Pending requests response:', response.data?.results?.length || 0);
          return response;
        }).catch((error) => {
          console.warn("Pending requests failed:", error.response?.status, error.message);
          return { data: { results: [] } };
        }),
        
        // In progress requests
        axiosInstance.get("/all_requests/admin/requests/?status=in_progress").then(response => {
          console.log('In progress response:', response.data?.results?.length || 0);
          return response;
        }).catch((error) => {
          console.warn("In progress requests failed:", error.response?.status, error.message);
          return { data: { results: [] } };
        }),
        
        // Objection requests
        axiosInstance.get("/all_requests/admin/requests/?status=objection").then(response => {
          console.log('Objection response:', response.data?.results?.length || 0);
          return response;
        }).catch((error) => {
          console.warn("Objection requests failed:", error.response?.status, error.message);
          return { data: { results: [] } };
        }),
        
        // User stats
        axiosInstance.get("/users/stats/").then(response => {
          console.log('User stats response:', response.data);
          return response;
        }).catch((error) => {
          console.warn("User stats failed:", error.response?.status, error.message);
          return { data: { total_users: 0 } };
        }),
      ];

      const responses = await Promise.all(requests);
      console.log('All API responses received:', responses.map(r => r.status));

      const [
        shippingResponse,
        pendingResponse,
        inProgressResponse,
        objectionResponse,
        usersResponse,
      ] = responses;

      // Extract data with proper fallbacks
      const shippingCount = shippingResponse.data?.pending_count || shippingResponse.data?.count || 0;
      const pendingData = pendingResponse.data?.results || pendingResponse.data || [];
      const inProgressData = inProgressResponse.data?.results || inProgressResponse.data || [];
      const objectionData = objectionResponse.data?.results || objectionResponse.data || [];
      const userCount = usersResponse.data?.total_users || 0;

      const allRequests = [
        ...(Array.isArray(pendingData) ? pendingData : []),
        ...(Array.isArray(inProgressData) ? inProgressData : []),
        ...(Array.isArray(objectionData) ? objectionData : []),
      ];

      const totalRevenue = allRequests.reduce(
        (sum, request) => sum + (parseFloat(request.amount) || 0),
        0
      );

      // Group allRequests by month
      const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'july'];
      const monthMap = {
        'Jan': 'jan', 'Feb': 'feb', 'Mar': 'mar', 'Apr': 'apr', 'May': 'may', 'Jun': 'jun', 'Jul': 'july', 'July': 'july'
      };

      const monthlyStats = {};
      monthKeys.forEach(m => {
        monthlyStats[m] = { sales: 0, customers: new Set() };
      });

      let hasData = false;

      allRequests.forEach(req => {
        const dateStr = req.created_at || req.Timestamp || req.created;
        if (!dateStr) return;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return;
        
        const monthName = date.toLocaleString('en-US', { month: 'short' });
        const key = monthMap[monthName];
        
        if (key && monthlyStats[key]) {
          hasData = true;
          const amt = parseFloat(req.amount) || 0;
          monthlyStats[key].sales += amt;
          
          const userId = req.user?.id || req.user_id || req.SourceEntityID || Math.random().toString();
          monthlyStats[key].customers.add(userId);
        }
      });

      const salesData = [];
      const customersData = [];
      let distinctMonthsWithData = 0;

      monthKeys.forEach(m => {
        const sales = monthlyStats[m].sales;
        const customers = monthlyStats[m].customers.size;
        
        salesData.push({ x: m.charAt(0).toUpperCase() + m.slice(1), y: parseFloat(sales.toFixed(2)) });
        customersData.push({ x: m.charAt(0).toUpperCase() + m.slice(1), y: customers });

        if (sales > 0 || customers > 0) {
          distinctMonthsWithData++;
        }
      });

      console.log('Processed stats:', {
        shipping: shippingCount,
        pending: pendingData.length,
        inProgress: inProgressData.length,
        objection: objectionData.length,
        totalUsers: userCount,
        totalRevenue
      });

      setStats({
        shipping: shippingCount,
        pending: pendingData.length,
        inProgress: inProgressData.length,
        objection: objectionData.length,
        totalUsers: userCount,
        totalRevenue,
      });

      setChartData({
        salesData,
        customersData,
        hasEnoughData: hasData && distinctMonthsWithData >= 3,
      });

    } catch (error) {
      console.error("Error fetching stats:", error);
      setError(
        t("overview.status.failedToLoadData", "Failed to load dashboard data. Please check your connection and try again.")
      );
      // Set default stats on error
      setStats({
        shipping: 0,
        pending: 0,
        inProgress: 0,
        objection: 0,
        totalUsers: 0,
        totalRevenue: 0,
      });
      setChartData({
        salesData: [],
        customersData: [],
        hasEnoughData: false,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllStats();
  }, []);

  // ... rest of the component remains the same ...
  const updatedEarningData = earningData.map((item) => {
    const titleKey = item.title.toLowerCase().replace(/\s+/g, "");

    if (titleKey.includes("shipping")) {
      return {
        ...item,
        amount: loading ? "..." : stats.shipping.toString(),
        description: t("overview.cards.shipping-requests.desc", { count: stats.shipping }),
      };
    }
    if (titleKey.includes("pending")) {
      return {
        ...item,
        amount: loading ? "..." : stats.pending.toString(),
        description: t("overview.cards.pending.desc", { count: stats.pending }),
      };
    }
    if (titleKey.includes("progress")) {
      return {
        ...item,
        amount: loading ? "..." : stats.inProgress.toString(),
        description: t("overview.cards.in-progress.desc", { count: stats.inProgress }),
      };
    }
    if (titleKey.includes("objection")) {
      return {
        ...item,
        amount: loading ? "..." : stats.objection.toString(),
        description: t("overview.cards.objection-requests.desc", { count: stats.objection }),
      };
    }
    if (titleKey.includes("customer") || titleKey.includes("user")) {
      return {
        ...item,
        amount: loading ? "..." : stats.totalUsers.toString(),
        description: t("overview.revenue.registeredUsersDesc", { count: stats.totalUsers }),
      };
    }
    if (titleKey.includes("revenue") || titleKey.includes("sales")) {
      return {
        ...item,
        amount: loading ? "..." : `$${stats.totalRevenue.toLocaleString()}`,
        description: t("overview.revenue.pendingDesc", "Total pending revenue"),
      };
    }

    return item;
  });

  const refreshData = () => {
    fetchAllStats();
  };

  const getStatusColor = (count) => {
    if (count === 0) return "bg-green-500";
    if (count < 5) return "bg-yellow-500";
    return "bg-red-500 animate-pulse";
  };

  const getPriorityLevel = (count) => {
    if (count === 0) return "Low";
    if (count < 5) return "Medium";
    return "High";
  };

  const getPriorityClass = (level) => {
    if (level === "High") return "bg-red-100 text-red-800";
    if (level === "Medium") return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  const getCountForTitle = (titleKey) => {
    if (titleKey.includes("shipping")) return stats.shipping;
    if (titleKey.includes("pending")) return stats.pending;
    if (titleKey.includes("progress")) return stats.inProgress;
    if (titleKey.includes("objection")) return stats.objection;
    if (titleKey.includes("customer") || titleKey.includes("user"))
      return stats.totalUsers;
    return 0;
  };

  const handleErrorClose = () => {
    setError(null);
  };

  return (
    <div className="mt-24 px-2 sm:px-4 md:px-6 py-4 md:py-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 px-2 md:px-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            {t("overview.title", "Dashboard Overview")}
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
            {t("overview.subtitle", "Real-time statistics and monitoring")}
          </p>
        </div>
        <button
          type="button"
          onClick={refreshData}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm flex items-center justify-center gap-2 font-semibold shadow-sm"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              {t("overview.status.loading", "Loading...")}
            </>
          ) : (
            t("overview.buttons.refresh", "Refresh Data")
          )}
        </button>
      </div>

      {error && (
        <div className="flex justify-center mb-4">
          <div
            className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded relative max-w-2xl mx-3"
            role="alert"
          >
            <strong className="font-bold">{t("overview.status.notice", "Notice: ")}</strong>
            <span className="block sm:inline">{error}</span>
            <button
              type="button"
              onClick={handleErrorClose}
              className="absolute top-0 right-0 px-2 py-1 rtl:left-0 rtl:right-auto"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-center px-2 md:px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 my-3 w-full max-w-6xl">
          {updatedEarningData.map((item) => {
            const titleKey = item.title.toLowerCase().replace(/\s+/g, "");
            const count = getCountForTitle(titleKey);
            const priorityLevel = getPriorityLevel(count);
            const priorityClass = getPriorityClass(priorityLevel);

            return (
              <Link
                key={item.title}
                to={`/${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                className="block bg-white dark:text-gray-200 dark:bg-secondary-dark-bg p-4 md:p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700 hover:scale-[1.03] transform transition-transform duration-200 relative flex flex-col justify-between h-full min-w-0 w-full"
              >
                {!item.title.toLowerCase().includes("revenue") && (
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] md:text-xs font-semibold ${priorityClass}`}>
                      {t("overview.priority." + priorityLevel.toLowerCase(), `${priorityLevel} Priority`)}
                    </span>
                    {count > 0 && (
                      <span className="bg-red-500 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                        {t("overview.status.pendingCount", { count })}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xl md:text-3xl font-bold text-gray-800 dark:text-white truncate">
                      {item.amount}
                      {loading && (
                        <span className="text-xs text-blue-500 ms-2">⟳</span>
                      )}
                    </p>
                    <p className="text-xs md:text-base text-gray-600 dark:text-gray-300 mt-1 md:mt-2 font-semibold truncate">
                      {t("overview.cards." + item.name + ".title", item.title)}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2 md:line-clamp-none">
                      {item.description}
                    </p>
                  </div>
                  <div
                    className="flex items-center justify-center w-10 h-10 md:w-16 md:h-16 rounded-full ms-2 md:ms-4 flex-shrink-0"
                    style={{ backgroundColor: item.iconBg }}
                  >
                    <span style={{ color: item.iconColor }} className="text-lg md:text-2xl">
                      {item.icon}
                    </span>
                  </div>
                </div>

                {!item.title.toLowerCase().includes("revenue") && (
                  <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-850 pt-3 mt-auto">
                    <div className="flex items-center min-w-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full me-1.5 flex-shrink-0 ${getStatusColor(
                          count
                        )}`}
                      />
                      <span className="text-[10px] md:text-xs text-gray-500 truncate">
                        {count > 0
                          ? t("overview.status.needsAttention", { count })
                          : t("overview.status.allCaughtUp")}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 flex-shrink-0">
                      {loading ? t("overview.status.updating") : t("overview.status.live")}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4 md:gap-6 flex-wrap xl:flex-nowrap justify-center mt-8 px-2 md:px-4 max-w-6xl mx-auto w-full">
        <div className="bg-white dark:text-gray-200 dark:bg-secondary-dark-bg p-4 md:p-6 rounded-2xl w-full xl:flex-1 min-w-0">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div>
              <p className="font-semibold text-xl">{t("overview.revenue.title", "Revenue Analytics")}</p>
              <p className="text-gray-500 text-sm">
                {t("overview.revenue.subtitle", "Real-time financial overview")}
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <p className="flex items-center gap-2 text-gray-600 hover:drop-shadow-xl">
                <span>
                  <GoPrimitiveDot className="text-blue-500" />
                </span>
                <span>{t("overview.revenue.usd", "USD Transactions")}</span>
              </p>
              <p className="flex items-center gap-2 text-green-400 hover:drop-shadow-xl">
                <span>
                  <GoPrimitiveDot />
                </span>
                <span>{t("overview.revenue.syp", "SYP Transactions")}</span>
              </p>
            </div>
          </div>
          <div className="mt-6 flex gap-8 flex-wrap justify-center">
            <div className="border-e-0 md:border-e-1 border-color m-4 pe-0 md:pe-8 text-center md:text-start">
              <div className="mb-6">
                <p>
                  <span className="text-3xl font-semibold">
                    $
                    {stats.totalRevenue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="p-1.5 hover:drop-shadow-xl cursor-pointer rounded-full text-white bg-green-400 ms-3 text-xs">
                    {t("overview.revenue.total", "Total")}
                  </span>
                </p>
                <p className="text-gray-500 mt-1">{t("overview.revenue.pending", "Pending Revenue")}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.totalUsers}</p>
                <p className="text-gray-500 mt-1">{t("overview.revenue.registeredUsers", "Registered Users")}</p>
              </div>
            </div>
            <div className="flex-1 w-full max-w-full overflow-hidden min-h-[300px] flex items-center justify-center">
              {loading ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2" />
                  <span className="text-gray-500 text-sm">{t("overview.status.loading", "Loading chart data...")}</span>
                </div>
              ) : error ? (
                <div className="text-red-500 text-sm text-center">
                  {t("overview.status.failedToLoadData", "Failed to load chart data")}
                </div>
              ) : !chartData.hasEnoughData ? (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center w-full">
                  <span className="text-4xl mb-2">📊</span>
                  <p className="text-gray-600 dark:text-gray-400 font-semibold">
                    {t("overview.revenue.noChartData", "No Sufficient Historical Data")}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[250px] mt-1 mx-auto">
                    {t("overview.revenue.noChartDataDesc", "At least 3 months of transaction history are required to generate the chart.")}
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

        <div className="bg-white dark:text-gray-200 dark:bg-secondary-dark-bg p-4 md:p-6 rounded-2xl w-full xl:w-96 flex-shrink-0">
          <div className="mb-6">
            <p className="font-semibold text-xl">{t("overview.summary.title", "Quick Summary")}</p>
            <p className="text-gray-500 text-sm">{t("overview.summary.subtitle", "Request overview")}</p>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-blue-600 dark:text-blue-300 font-medium">
                {t("overview.summary.shipping", "Shipping Requests")}
              </span>
              <span className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm font-bold">
                {stats.shipping}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <span className="text-yellow-600 dark:text-yellow-300 font-medium">
                {t("overview.summary.pending", "Pending Reviews")}
              </span>
              <span className="bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded text-sm font-bold">
                {stats.pending}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-green-600 dark:text-green-300 font-medium">
                {t("overview.summary.inProgress", "In Progress")}
              </span>
              <span className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm font-bold">
                {stats.inProgress}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <span className="text-orange-600 dark:text-orange-300 font-medium">
                {t("overview.summary.objections", "Objections")}
              </span>
              <span className="bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-1 rounded text-sm font-bold">
                {stats.objection}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
