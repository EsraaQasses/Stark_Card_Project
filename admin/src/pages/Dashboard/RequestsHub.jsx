import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFilter,
  FiInbox,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiX,
} from 'react-icons/fi';

import RequestReviewModal from '../../components/RequestReviewModal';
import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

const PAGE_SIZE = 12;

const normalizeList = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const getApiError = (error, fallback) => (
  error?.response?.data?.error
  || error?.response?.data?.detail
  || error?.response?.data?.message
  || fallback
);

const getInitials = (name) => {
  const value = String(name || '').trim();

  if (!value) {
    return 'U';
  }

  const parts = value
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`
    .toUpperCase();
};

const RequestsHub = () => {
  const {
    t,
    i18n,
  } = useTranslation([
    'requests',
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
    category: isArabic
      ? 'إدارة الطلبات'
      : 'Requests Management',

    title: isArabic
      ? 'مركز الطلبات'
      : 'Requests Center',

    subtitle: isArabic
      ? 'راجع جميع الطلبات وفلترها وافتح تفاصيل كل طلب للمعالجة.'
      : 'Review, filter, and process all requests from one place.',

    refresh: isArabic
      ? 'تحديث البيانات'
      : 'Refresh',

    total: isArabic
      ? 'إجمالي الطلبات'
      : 'Total requests',

    pending: isArabic
      ? 'المعلقة'
      : 'Pending',

    inProgress: isArabic
      ? 'قيد التنفيذ'
      : 'In progress',

    rejected: isArabic
      ? 'المرفوضة'
      : 'Rejected',

    searchPlaceholder: isArabic
      ? 'ابحث برقم الطلب أو اسم العميل أو البريد...'
      : 'Search by request ID, customer name, or email...',

    allStatuses: isArabic
      ? 'كل الحالات'
      : 'All statuses',

    allTypes: isArabic
      ? 'كل الأنواع'
      : 'All types',

    clear: isArabic
      ? 'مسح الفلاتر'
      : 'Clear filters',

    noResults: isArabic
      ? 'لا توجد طلبات مطابقة للفلاتر.'
      : 'No requests match the selected filters.',

    loading: isArabic
      ? 'جاري تحميل الطلبات...'
      : 'Loading requests...',

    loadFailed: isArabic
      ? 'تعذر تحميل مركز الطلبات.'
      : 'Failed to load requests center.',

    review: isArabic
      ? 'مراجعة الطلب'
      : 'Review request',

    amount: isArabic
      ? 'المبلغ'
      : 'Amount',

    submitted: isArabic
      ? 'تاريخ الإرسال'
      : 'Submitted',

    type: isArabic
      ? 'النوع'
      : 'Type',

    status: isArabic
      ? 'الحالة'
      : 'Status',

    page: isArabic
      ? 'صفحة'
      : 'Page',

    of: isArabic
      ? 'من'
      : 'of',

    unknownUser: isArabic
      ? 'مستخدم غير معروف'
      : 'Unknown user',

    noEmail: isArabic
      ? 'لا يوجد بريد'
      : 'No email',

    commentFailed: isArabic
      ? 'تعذر إضافة التعليق.'
      : 'Failed to add comment.',

    updateFailed: isArabic
      ? 'تعذر تحديث حالة الطلب.'
      : 'Failed to update request status.',
  }), [isArabic]);

  const [requestsData, setRequestsData] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    shipping: 0,
    in_progress: 0,
    objection: 0,
    completed: 0,
    rejected: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const computeStats = useCallback((rows) => ({
    total: rows.length,
    pending: rows.filter(
      (request) => request.status === 'pending',
    ).length,
    shipping: rows.filter(
      (request) => request.status === 'shipping',
    ).length,
    in_progress: rows.filter(
      (request) => request.status === 'in_progress',
    ).length,
    objection: rows.filter(
      (request) => request.status === 'objection',
    ).length,
    completed: rows.filter(
      (request) => request.status === 'completed',
    ).length,
    rejected: rows.filter(
      (request) => request.status === 'rejected',
    ).length,
  }), []);

  const fetchRequests = useCallback(
    async ({ background = false } = {}) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const [
        requestsResult,
        statsResult,
      ] = await Promise.allSettled([
        axiosInstance.get(
          '/all_requests/admin/requests/',
        ),
        axiosInstance.get(
          '/all_requests/admin/requests/stats/',
        ),
      ]);

      try {
        if (requestsResult.status === 'rejected') {
          throw requestsResult.reason;
        }

        const rows = normalizeList(
          requestsResult.value.data,
        );

        setRequestsData(rows);

        if (statsResult.status === 'fulfilled') {
          setStats({
            ...computeStats(rows),
            ...statsResult.value.data,
          });
        } else {
          setStats(
            computeStats(rows),
          );
        }
      } catch (loadError) {
        console.error(
          'Error fetching requests:',
          loadError,
        );

        setRequestsData([]);

        setStats(
          computeStats([]),
        );

        setError(
          getApiError(
            loadError,
            labels.loadFailed,
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      computeStats,
      labels.loadFailed,
    ],
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    setPage(1);
  }, [
    filterStatus,
    filterType,
    searchQuery,
  ]);

  const filteredRequests = useMemo(() => {
    const query = searchQuery
      .trim()
      .toLowerCase();

    return requestsData
      .filter((request) => (
        filterStatus === 'All'
        || request.status === filterStatus
      ))
      .filter((request) => (
        filterType === 'All'
        || request.request_type === filterType
      ))
      .filter((request) => {
        if (!query) {
          return true;
        }

        const values = [
          request.id,
          request.title,
          request.user_name,
          request.user_email,
          request.user,
        ];

        return values.some((value) => (
          value !== null
          && value !== undefined
          && String(value)
            .toLowerCase()
            .includes(query)
        ));
      })
      .sort((a, b) => (
        new Date(b.created_at)
        - new Date(a.created_at)
      ));
  }, [
    filterStatus,
    filterType,
    requestsData,
    searchQuery,
  ]);

  const statusOptions = useMemo(() => (
    [
      'pending',
      'shipping',
      'in_progress',
      'objection',
      'completed',
      'rejected',
    ]
  ), []);

  const typeOptions = useMemo(() => (
    [
      ...new Set(
        requestsData
          .map((request) => request.request_type)
          .filter(Boolean),
      ),
    ]
  ), [requestsData]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRequests.length / PAGE_SIZE,
    ),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const visibleRequests = useMemo(() => {
    const start = (
      currentPage - 1
    ) * PAGE_SIZE;

    return filteredRequests.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [
    currentPage,
    filteredRequests,
  ]);

  const formatDate = useCallback(
    (value) => {
      if (!value) {
        return '—';
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return date.toLocaleString(locale);
    },
    [locale],
  );

  const formatAmount = useCallback(
    (request) => {
      if (
        request.amount === null
        || request.amount === undefined
        || request.amount === ''
      ) {
        return '—';
      }

      const amount = Number(request.amount);

      if (!Number.isFinite(amount)) {
        return String(request.amount);
      }

      const formatted = amount.toLocaleString(
        locale,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      );

      return `${formatted} ${request.currency || ''}`.trim();
    },
    [locale],
  );

  const statusLabel = useCallback(
    (status) => {
      const fallbacks = {
        pending: isArabic ? 'معلق' : 'Pending',
        shipping: isArabic ? 'شحن' : 'Shipping',
        in_progress: isArabic ? 'قيد التنفيذ' : 'In progress',
        objection: isArabic ? 'اعتراض' : 'Objection',
        completed: isArabic ? 'مكتمل' : 'Completed',
        rejected: isArabic ? 'مرفوض' : 'Rejected',
      };

      return t(
        `status.${status}`,
        {
          defaultValue:
            fallbacks[status]
            || status
            || '—',
        },
      );
    },
    [
      isArabic,
      t,
    ],
  );

  const typeLabel = useCallback(
    (type) => {
      const fallbacks = {
        payment: isArabic ? 'دفع' : 'Payment',
        support: isArabic ? 'دعم' : 'Support',
        refund: isArabic ? 'استرجاع' : 'Refund',
        other: isArabic ? 'أخرى' : 'Other',
      };

      return t(
        `type.${type}`,
        {
          defaultValue:
            fallbacks[type]
            || type
            || '—',
        },
      );
    },
    [
      isArabic,
      t,
    ],
  );

  const statusStyle = useCallback(
    (status) => {
      if (status === 'rejected') {
        return {
          className:
            'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300',
        };
      }

      if (status === 'pending') {
        return {
          className:
            'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300',
        };
      }

      if (status === 'completed') {
        return {
          style: {
            backgroundColor: `${accentColor}12`,
            borderColor: `${accentColor}28`,
            color: accentColor,
          },
        };
      }

      return {
        className:
          'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
    },
    [accentColor],
  );

  const handleCloseModal = () => {
    setSelectedRequest(null);

    fetchRequests({
      background: true,
    });
  };

  const handleUpdateStatus = async (
    requestId,
    newStatus,
    adminNotes = '',
    rejectionReason = '',
  ) => {
    try {
      await axiosInstance.post(
        `/all_requests/admin/requests/${requestId}/update_status/`,
        {
          status: newStatus,
          admin_notes: adminNotes,
          rejection_reason: rejectionReason,
        },
      );

      await fetchRequests({
        background: true,
      });

      return true;
    } catch (updateError) {
      console.error(
        'Error updating request status:',
        updateError,
      );

      setError(
        getApiError(
          updateError,
          labels.updateFailed,
        ),
      );

      return false;
    }
  };

  const handleAddComment = async (
    requestId,
    comment,
    isAdminNote = false,
  ) => {
    try {
      await axiosInstance.post(
        `/all_requests/admin/requests/${requestId}/add_comment/`,
        {
          comment,
          is_admin_note: isAdminNote,
        },
      );

      await fetchRequests({
        background: true,
      });

      return true;
    } catch (commentError) {
      console.error(
        'Error adding comment:',
        commentError,
      );

      setError(
        getApiError(
          commentError,
          labels.commentFailed,
        ),
      );

      return false;
    }
  };

  const clearFilters = () => {
    setFilterStatus('All');
    setFilterType('All');
    setSearchQuery('');
  };

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
          space-y-5
        "
      >
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
              backgroundColor: accentColor,
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
            <div className="max-w-2xl text-start">
              <div
                className="
                  mb-3
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
                    backgroundColor: accentColor,
                  }}
                />

                <span
                  className="
                    text-sm
                    font-extrabold
                  "
                  style={{
                    color: accentColor,
                  }}
                >
                  {labels.category}
                </span>
              </div>

              <h1
                className="
                  text-3xl
                  font-black
                  tracking-tight
                  text-slate-950
                  dark:text-white
                  md:text-4xl
                "
              >
                {labels.title}
              </h1>

              <p
                className="
                  mt-2
                  max-w-xl
                  text-sm
                  font-medium
                  leading-7
                  text-slate-500
                  dark:text-slate-400
                "
              >
                {labels.subtitle}
              </p>
            </div>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => (
                fetchRequests({
                  background: true,
                })
              )}
              className="
                flex
                items-center
                justify-center
                gap-2
                rounded-xl
                px-5
                py-3
                text-sm
                font-black
                text-white
                shadow-sm
                transition
                hover:opacity-90
                disabled:opacity-50
              "
              style={{
                backgroundColor: accentColor,
              }}
            >
              <FiRefreshCw
                className={
                  refreshing
                    ? 'animate-spin'
                    : ''
                }
              />

              {labels.refresh}
            </button>
          </div>
        </section>

        <section
          className="
            grid
            gap-3
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          {[
            {
              label: labels.total,
              value: stats.total,
            },
            {
              label: labels.pending,
              value: stats.pending,
            },
            {
              label: labels.inProgress,
              value: stats.in_progress,
            },
            {
              label: labels.rejected,
              value: stats.rejected,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="
                flex
                items-center
                gap-4
                rounded-2xl
                border
                border-slate-100
                bg-white
                p-4
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
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
                  backgroundColor: `${accentColor}14`,
                  color: accentColor,
                }}
              >
                <FiInbox />
              </div>

              <div className="text-start">
                <p className="text-xs font-bold text-slate-400">
                  {item.label}
                </p>

                <p
                  className="
                    mt-0.5
                    text-2xl
                    font-black
                    text-slate-900
                    dark:text-white
                  "
                >
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </section>

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
              py-3
              text-sm
              font-bold
              text-red-700
              dark:border-red-900/40
              dark:bg-red-950/30
              dark:text-red-300
            "
          >
            <FiAlertCircle className="mt-0.5 shrink-0" />

            <span className="flex-1">
              {error}
            </span>

            <button
              type="button"
              onClick={() => setError('')}
            >
              <FiX />
            </button>
          </div>
        )}

        <section
          className="
            rounded-3xl
            border
            border-slate-100
            bg-white
            p-4
            shadow-sm
            dark:border-slate-800
            dark:bg-secondary-dark-bg
            sm:p-5
          "
        >
          <div
            className="
              mb-4
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
                backgroundColor: `${accentColor}14`,
                color: accentColor,
              }}
            >
              <FiFilter />
            </div>

            <div className="text-start">
              <h2 className="font-black text-slate-900 dark:text-white">
                {isArabic ? 'تصفية الطلبات' : 'Filter requests'}
              </h2>

              <p className="mt-0.5 text-xs font-semibold text-slate-400">
                {filteredRequests.length} / {requestsData.length}
              </p>
            </div>
          </div>

          <div
            className="
              grid
              gap-3
              md:grid-cols-2
              xl:grid-cols-4
            "
          >
            <div className="relative xl:col-span-2">
              <FiSearch
                className="
                  pointer-events-none
                  absolute
                  start-4
                  top-1/2
                  -translate-y-1/2
                  text-slate-400
                "
              />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) => (
                  setSearchQuery(event.target.value)
                )}
                placeholder={labels.searchPlaceholder}
                className="
                  h-11
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  ps-11
                  pe-4
                  text-sm
                  font-semibold
                  text-slate-900
                  outline-none
                  dark:border-slate-700
                  dark:bg-slate-900
                  dark:text-white
                "
              />
            </div>

            <select
              value={filterStatus}
              onChange={(event) => (
                setFilterStatus(event.target.value)
              )}
              className="
                h-11
                rounded-xl
                border
                border-slate-200
                bg-white
                px-3
                text-sm
                font-semibold
                text-slate-700
                outline-none
                dark:border-slate-700
                dark:bg-slate-900
                dark:text-slate-200
              "
            >
              <option value="All">
                {labels.allStatuses}
              </option>

              {statusOptions.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {statusLabel(status)}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(event) => (
                setFilterType(event.target.value)
              )}
              className="
                h-11
                rounded-xl
                border
                border-slate-200
                bg-white
                px-3
                text-sm
                font-semibold
                text-slate-700
                outline-none
                dark:border-slate-700
                dark:bg-slate-900
                dark:text-slate-200
              "
            >
              <option value="All">
                {labels.allTypes}
              </option>

              {typeOptions.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {typeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="
                flex
                items-center
                gap-2
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
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
              <FiX />
              {labels.clear}
            </button>
          </div>
        </section>

        <section>
          {loading ? (
            <div
              className="
                flex
                min-h-[360px]
                flex-col
                items-center
                justify-center
                gap-3
                rounded-3xl
                border
                border-slate-100
                bg-white
                text-slate-400
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
              "
            >
              <FiRefreshCw className="animate-spin text-3xl" />
              <p className="text-sm font-bold">
                {labels.loading}
              </p>
            </div>
          ) : visibleRequests.length === 0 ? (
            <div
              className="
                flex
                min-h-[320px]
                flex-col
                items-center
                justify-center
                gap-4
                rounded-3xl
                border
                border-slate-100
                bg-white
                text-center
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
              "
            >
              <div
                className="
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                "
                style={{
                  backgroundColor: `${accentColor}12`,
                  color: accentColor,
                }}
              >
                <FiInbox className="text-2xl" />
              </div>

              <p className="text-sm font-bold text-slate-400">
                {labels.noResults}
              </p>
            </div>
          ) : (
            <div
              className="
                grid
                gap-4
                xl:grid-cols-2
              "
            >
              {visibleRequests.map((request) => {
                const userName = (
                  request.user_name
                  || labels.unknownUser
                );

                const meta = statusStyle(request.status);

                return (
                  <article
                    key={request.id}
                    className="
                      rounded-3xl
                      border
                      border-slate-100
                      bg-white
                      p-5
                      shadow-sm
                      transition
                      hover:border-slate-200
                      hover:shadow-md
                      dark:border-slate-800
                      dark:bg-secondary-dark-bg
                      dark:hover:border-slate-700
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        justify-between
                        gap-4
                      "
                    >
                      <div
                        className="
                          flex
                          min-w-0
                          items-center
                          gap-3
                        "
                      >
                        <div
                          className="
                            flex
                            h-12
                            w-12
                            shrink-0
                            items-center
                            justify-center
                            rounded-2xl
                            text-sm
                            font-black
                            text-white
                          "
                          style={{
                            backgroundColor: accentColor,
                          }}
                        >
                          {getInitials(userName)}
                        </div>

                        <div className="min-w-0 text-start">
                          <p
                            className="
                              truncate
                              font-black
                              text-slate-900
                              dark:text-white
                            "
                          >
                            {userName}
                          </p>

                          <p
                            className="
                              mt-1
                              truncate
                              text-xs
                              font-semibold
                              text-slate-400
                            "
                          >
                            {request.user_email || labels.noEmail}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`
                          shrink-0
                          rounded-full
                          border
                          px-2.5
                          py-1
                          text-xs
                          font-black
                          ${meta.className || ''}
                        `}
                        style={meta.style}
                      >
                        {statusLabel(request.status)}
                      </span>
                    </div>

                    <div
                      className="
                        mt-4
                        rounded-2xl
                        bg-slate-50
                        p-4
                        text-start
                        dark:bg-slate-900/50
                      "
                    >
                      <div
                        className="
                          flex
                          flex-wrap
                          items-center
                          gap-2
                        "
                      >
                        <span
                          className="
                            rounded-lg
                            bg-white
                            px-2
                            py-1
                            text-xs
                            font-black
                            text-slate-500
                            dark:bg-slate-800
                            dark:text-slate-300
                          "
                          dir="ltr"
                        >
                          #{request.id}
                        </span>

                        <span
                          className="
                            rounded-lg
                            border
                            px-2
                            py-1
                            text-xs
                            font-black
                          "
                          style={{
                            backgroundColor: `${accentColor}10`,
                            borderColor: `${accentColor}24`,
                            color: accentColor,
                          }}
                        >
                          {typeLabel(request.request_type)}
                        </span>
                      </div>

                      <h3
                        className="
                          mt-3
                          text-base
                          font-black
                          text-slate-900
                          dark:text-white
                        "
                      >
                        {request.title || '—'}
                      </h3>

                      {request.description && (
                        <p
                          className="
                            mt-2
                            line-clamp-2
                            text-sm
                            font-medium
                            leading-6
                            text-slate-500
                            dark:text-slate-400
                          "
                        >
                          {request.description}
                        </p>
                      )}
                    </div>

                    <div
                      className="
                        mt-4
                        grid
                        gap-3
                        sm:grid-cols-2
                      "
                    >
                      <div
                        className="
                          rounded-xl
                          border
                          border-slate-100
                          p-3
                          dark:border-slate-700
                        "
                      >
                        <p className="text-[11px] font-bold text-slate-400">
                          {labels.amount}
                        </p>

                        <p
                          className="
                            mt-1
                            text-sm
                            font-black
                            text-slate-900
                            dark:text-white
                          "
                        >
                          {formatAmount(request)}
                        </p>
                      </div>

                      <div
                        className="
                          rounded-xl
                          border
                          border-slate-100
                          p-3
                          dark:border-slate-700
                        "
                      >
                        <p className="text-[11px] font-bold text-slate-400">
                          {labels.submitted}
                        </p>

                        <p
                          className="
                            mt-1
                            text-xs
                            font-black
                            text-slate-900
                            dark:text-white
                          "
                        >
                          {formatDate(request.created_at)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="
                        mt-4
                        flex
                        justify-end
                        border-t
                        border-slate-100
                        pt-4
                        dark:border-slate-800
                      "
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedRequest(request)}
                        className="
                          flex
                          items-center
                          gap-2
                          rounded-xl
                          px-4
                          py-2.5
                          text-xs
                          font-black
                          text-white
                          transition
                          hover:opacity-90
                        "
                        style={{
                          backgroundColor: accentColor,
                        }}
                      >
                        <FiUser />
                        {labels.review}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {!loading
          && filteredRequests.length > 0
          && totalPages > 1 && (
          <section
            className="
              flex
              flex-col
              gap-3
              rounded-2xl
              border
              border-slate-100
              bg-white
              px-4
              py-3
              shadow-sm
              dark:border-slate-800
              dark:bg-secondary-dark-bg
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <p
              className="
                text-sm
                font-bold
                text-slate-500
                dark:text-slate-400
              "
            >
              {labels.page}{' '}
              <span className="font-black text-slate-900 dark:text-white">
                {currentPage}
              </span>{' '}
              {labels.of}{' '}
              <span className="font-black text-slate-900 dark:text-white">
                {totalPages}
              </span>
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => (
                  setPage(
                    (previous) => Math.max(
                      1,
                      previous - 1,
                    ),
                  )
                )}
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  disabled:opacity-30
                  dark:border-slate-700
                  dark:bg-slate-900
                  dark:text-slate-300
                "
              >
                {isArabic
                  ? <FiChevronRight />
                  : <FiChevronLeft />}
              </button>

              <div
                className="
                  min-w-[88px]
                  rounded-xl
                  px-3
                  py-2
                  text-center
                  text-sm
                  font-black
                  text-white
                "
                style={{
                  backgroundColor: accentColor,
                }}
              >
                {currentPage} / {totalPages}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => (
                  setPage(
                    (previous) => Math.min(
                      totalPages,
                      previous + 1,
                    ),
                  )
                )}
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  disabled:opacity-30
                  dark:border-slate-700
                  dark:bg-slate-900
                  dark:text-slate-300
                "
              >
                {isArabic
                  ? <FiChevronLeft />
                  : <FiChevronRight />}
              </button>
            </div>
          </section>
        )}
      </div>

      {selectedRequest && (
        <RequestReviewModal
          request={selectedRequest}
          onClose={handleCloseModal}
          onUpdateStatus={handleUpdateStatus}
          onAddComment={handleAddComment}
        />
      )}
    </div>
  );
};

export default RequestsHub;