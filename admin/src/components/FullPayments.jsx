import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiEye,
  FiFilter,
  FiRefreshCw,
  FiRotateCcw,
  FiSearch,
  FiUser,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../utils/axiosConfig';
import { useAuth } from '../contexts/AuthContext';
import { useStateContext } from '../contexts/ContextProvider';

const PAGE_SIZE = 12;

const normalizeList = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
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
    return 'US';
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

const FullPayments = () => {
  const {
    t,
    i18n,
  } = useTranslation([
    'payments',
    'common',
  ]);

  const {
    user,
  } = useAuth();

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
      ? 'إدارة المدفوعات'
      : 'Payments Management',

    title: isArabic
      ? 'جميع المدفوعات'
      : 'All Payments',

    subtitle: isArabic
      ? 'راجع كل عمليات الدفع وابحث وفلتر وعالج الحالات من مكان واحد.'
      : 'Review, search, filter, and manage all payment transactions in one place.',

    refresh: isArabic
      ? 'تحديث البيانات'
      : 'Refresh',

    total: isArabic
      ? 'إجمالي المدفوعات'
      : 'Total payments',

    successful: isArabic
      ? 'المدفوعات الناجحة'
      : 'Successful',

    pending: isArabic
      ? 'قيد المعالجة'
      : 'Pending / Processing',

    failed: isArabic
      ? 'فاشلة / ملغاة'
      : 'Failed / Cancelled',

    searchPlaceholder: isArabic
      ? 'ابحث بالمستخدم أو المنتج أو رقم الدفع...'
      : 'Search user, product, or payment ID...',

    allStatuses: isArabic
      ? 'كل الحالات'
      : 'All statuses',

    allCurrencies: isArabic
      ? 'كل العملات'
      : 'All currencies',

    clear: isArabic
      ? 'مسح الفلاتر'
      : 'Clear filters',

    noResults: isArabic
      ? 'لا توجد مدفوعات مطابقة للفلاتر.'
      : 'No payments match the selected filters.',

    loading: isArabic
      ? 'جاري تحميل المدفوعات...'
      : 'Loading payments...',

    loadFailed: isArabic
      ? 'تعذر تحميل المدفوعات.'
      : 'Failed to load payments.',

    payment: isArabic
      ? 'الدفع'
      : 'Payment',

    user: isArabic
      ? 'المستخدم'
      : 'User',

    product: isArabic
      ? 'المنتج'
      : 'Product',

    amount: isArabic
      ? 'المبلغ'
      : 'Amount',

    baseAmount: isArabic
      ? 'المبلغ الأساسي'
      : 'Base amount',

    profit: isArabic
      ? 'الربح'
      : 'Profit',

    date: isArabic
      ? 'التاريخ'
      : 'Date',

    details: isArabic
      ? 'عرض التفاصيل'
      : 'View details',

    process: isArabic
      ? 'معالجة'
      : 'Process',

    refund: isArabic
      ? 'استرجاع'
      : 'Refund',

    page: isArabic
      ? 'صفحة'
      : 'Page',

    of: isArabic
      ? 'من'
      : 'of',

    status: isArabic
      ? 'الحالة'
      : 'Status',

    currency: isArabic
      ? 'العملة'
      : 'Currency',

    externalId: isArabic
      ? 'المعرف الخارجي'
      : 'External ID',

    processedAt: isArabic
      ? 'وقت المعالجة'
      : 'Processed at',

    errorMessage: isArabic
      ? 'رسالة الخطأ'
      : 'Error message',

    close: isArabic
      ? 'إغلاق'
      : 'Close',

    success: isArabic
      ? 'ناجحة'
      : 'Success',

    processing: isArabic
      ? 'قيد المعالجة'
      : 'Processing',

    pendingStatus: isArabic
      ? 'معلقة'
      : 'Pending',

    failedStatus: isArabic
      ? 'فاشلة'
      : 'Failed',

    cancelled: isArabic
      ? 'ملغاة'
      : 'Cancelled',

    updateConfirm: isArabic
      ? 'هل تريد تحديث حالة هذه الدفعة؟'
      : 'Update this payment status?',

    updateSuccess: isArabic
      ? 'تم تحديث حالة الدفعة.'
      : 'Payment status updated.',

    updateFailed: isArabic
      ? 'تعذر تحديث حالة الدفعة.'
      : 'Failed to update payment.',

    refundConfirm: isArabic
      ? 'هل تريد استرجاع هذه الدفعة؟'
      : 'Refund this payment?',

    refundSuccess: isArabic
      ? 'تم استرجاع الدفعة بنجاح.'
      : 'Payment refunded successfully.',

    refundFailed: isArabic
      ? 'تعذر استرجاع الدفعة.'
      : 'Failed to refund payment.',
  }), [isArabic]);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({
    status: 'All',
    currency: 'All',
    startDate: '',
    endDate: '',
    searchQuery: '',
  });

  const fetchAllPayments = useCallback(
    async ({ background = false } = {}) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const response = await axiosInstance.get(
          'payment/payment/',
        );

        setPayments(
          normalizeList(response.data),
        );
      } catch (fetchError) {
        console.error(
          'Error fetching payments:',
          fetchError,
        );

        setError(
          getApiError(
            fetchError,
            labels.loadFailed,
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [labels.loadFailed],
  );

  useEffect(() => {
    fetchAllPayments();
  }, [fetchAllPayments]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const currencies = useMemo(() => (
    [
      ...new Set(
        payments
          .map((payment) => payment.currency)
          .filter(Boolean),
      ),
    ]
  ), [payments]);

  const stats = useMemo(() => {
    const successful = payments.filter(
      (payment) => payment.status === 'success',
    ).length;

    const pending = payments.filter(
      (payment) => (
        payment.status === 'pending'
        || payment.status === 'processing'
      ),
    ).length;

    const failed = payments.filter(
      (payment) => (
        payment.status === 'failed'
        || payment.status === 'cancelled'
      ),
    ).length;

    return {
      total: payments.length,
      successful,
      pending,
      failed,
    };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    let rows = [...payments];

    if (filters.status !== 'All') {
      rows = rows.filter(
        (payment) => payment.status === filters.status,
      );
    }

    if (filters.currency !== 'All') {
      rows = rows.filter(
        (payment) => payment.currency === filters.currency,
      );
    }

    if (filters.startDate) {
      const startDate = new Date(
        `${filters.startDate}T00:00:00`,
      );

      rows = rows.filter(
        (payment) => (
          new Date(payment.created_at) >= startDate
        ),
      );
    }

    if (filters.endDate) {
      const endDate = new Date(
        `${filters.endDate}T23:59:59`,
      );

      rows = rows.filter(
        (payment) => (
          new Date(payment.created_at) <= endDate
        ),
      );
    }

    const query = filters.searchQuery
      .trim()
      .toLowerCase();

    if (query) {
      rows = rows.filter((payment) => {
        const paymentId = (
          `PAY-${String(payment.id).padStart(6, '0')}`
        );

        const values = [
          payment.id,
          paymentId,
          payment.user_name,
          payment.store_product_name,
          payment.external_transaction_id,
        ];

        return values.some((value) => (
          value !== null
          && value !== undefined
          && String(value)
            .toLowerCase()
            .includes(query)
        ));
      });
    }

    return rows.sort((a, b) => (
      new Date(b.created_at)
      - new Date(a.created_at)
    ));
  }, [
    filters,
    payments,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredPayments.length / PAGE_SIZE,
    ),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const visiblePayments = useMemo(() => {
    const start = (
      currentPage - 1
    ) * PAGE_SIZE;

    return filteredPayments.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [
    currentPage,
    filteredPayments,
  ]);

  const formatMoney = useCallback(
    (value, currency) => {
      const amount = Number(value || 0);

      const formatted = amount.toLocaleString(
        locale,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      );

      if (currency === 'USD') {
        return `$${formatted}`;
      }

      return `${formatted} ${currency || ''}`.trim();
    },
    [locale],
  );

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

  const statusMeta = useCallback(
    (status) => {
      switch (status) {
        case 'success':
          return {
            label: labels.success,
            style: {
              backgroundColor: `${accentColor}12`,
              borderColor: `${accentColor}28`,
              color: accentColor,
            },
          };

        case 'pending':
          return {
            label: labels.pendingStatus,
            className:
              'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300',
          };

        case 'processing':
          return {
            label: labels.processing,
            className:
              'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
          };

        case 'failed':
          return {
            label: labels.failedStatus,
            className:
              'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300',
          };

        case 'cancelled':
          return {
            label: labels.cancelled,
            className:
              'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
          };

        default:
          return {
            label: status || '—',
            className:
              'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
          };
      }
    },
    [
      accentColor,
      labels,
    ],
  );

  const handleProcessPayment = async (
    paymentId,
    currentStatus,
  ) => {
    if (actionLoading) {
      return;
    }

    const nextStatus = (
      currentStatus === 'pending'
        ? 'processing'
        : 'success'
    );

    if (!window.confirm(labels.updateConfirm)) {
      return;
    }

    setActionLoading({
      paymentId,
      action: 'status',
    });

    setNotice('');

    try {
      await axiosInstance.post(
        `payment/payment/${paymentId}/update_status/`,
        {
          status: nextStatus,
        },
      );

      setNotice(labels.updateSuccess);

      await fetchAllPayments({
        background: true,
      });
    } catch (updateError) {
      setError(
        getApiError(
          updateError,
          labels.updateFailed,
        ),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefundPayment = async (paymentId) => {
    if (actionLoading) {
      return;
    }

    if (!window.confirm(labels.refundConfirm)) {
      return;
    }

    setActionLoading({
      paymentId,
      action: 'refund',
    });

    setNotice('');

    try {
      await axiosInstance.post(
        `payment/payment/${paymentId}/refund/`,
        {},
      );

      setNotice(labels.refundSuccess);

      await fetchAllPayments({
        background: true,
      });
    } catch (refundError) {
      setError(
        getApiError(
          refundError,
          labels.refundFailed,
        ),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const clearFilters = () => {
    setFilters({
      status: 'All',
      currency: 'All',
      startDate: '',
      endDate: '',
      searchQuery: '',
    });
  };

  const updateFilter = (key, value) => {
    setFilters(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  };

  return (
    <>
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
                  fetchAllPayments({
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
                icon: <FiCreditCard />,
              },
              {
                label: labels.successful,
                value: stats.successful,
                icon: <FiCheckCircle />,
              },
              {
                label: labels.pending,
                value: stats.pending,
                icon: <FiClock />,
              },
              {
                label: labels.failed,
                value: stats.failed,
                icon: <FiAlertCircle />,
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
                  {item.icon}
                </div>

                <div className="text-start">
                  <p
                    className="
                      text-xs
                      font-bold
                      text-slate-400
                    "
                  >
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
                py-3
                text-sm
                font-bold
                text-slate-700
                dark:border-slate-700
                dark:bg-slate-900
                dark:text-slate-200
              "
            >
              <FiCheckCircle
                className="mt-0.5 shrink-0"
                style={{
                  color: accentColor,
                }}
              />

              <span className="flex-1">
                {notice}
              </span>

              <button
                type="button"
                onClick={() => setNotice('')}
              >
                <FiX />
              </button>
            </div>
          )}

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
                <h2
                  className="
                    font-black
                    text-slate-900
                    dark:text-white
                  "
                >
                  {isArabic ? 'تصفية المدفوعات' : 'Filter payments'}
                </h2>

                <p
                  className="
                    mt-0.5
                    text-xs
                    font-semibold
                    text-slate-400
                  "
                >
                  {filteredPayments.length} / {payments.length}
                </p>
              </div>
            </div>

            <div
              className="
                grid
                gap-3
                md:grid-cols-2
                xl:grid-cols-5
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
                  value={filters.searchQuery}
                  onChange={(event) => (
                    updateFilter(
                      'searchQuery',
                      event.target.value,
                    )
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
                value={filters.status}
                onChange={(event) => (
                  updateFilter(
                    'status',
                    event.target.value,
                  )
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
                <option value="success">
                  {labels.success}
                </option>
                <option value="pending">
                  {labels.pendingStatus}
                </option>
                <option value="processing">
                  {labels.processing}
                </option>
                <option value="failed">
                  {labels.failedStatus}
                </option>
                <option value="cancelled">
                  {labels.cancelled}
                </option>
              </select>

              <select
                value={filters.currency}
                onChange={(event) => (
                  updateFilter(
                    'currency',
                    event.target.value,
                  )
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
                  {labels.allCurrencies}
                </option>

                {currencies.map((currency) => (
                  <option
                    key={currency}
                    value={currency}
                  >
                    {currency}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={clearFilters}
                className="
                  flex
                  h-11
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  text-sm
                  font-black
                  text-slate-600
                  transition
                  hover:bg-slate-50
                  dark:border-slate-700
                  dark:bg-slate-900
                  dark:text-slate-300
                "
              >
                <FiX />
                {labels.clear}
              </button>

              <input
                type="date"
                value={filters.startDate}
                onChange={(event) => (
                  updateFilter(
                    'startDate',
                    event.target.value,
                  )
                )}
                className="
                  h-11
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-3
                  text-sm
                  text-slate-700
                  outline-none
                  dark:border-slate-700
                  dark:bg-slate-900
                  dark:text-slate-200
                "
              />

              <input
                type="date"
                value={filters.endDate}
                onChange={(event) => (
                  updateFilter(
                    'endDate',
                    event.target.value,
                  )
                )}
                className="
                  h-11
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-3
                  text-sm
                  text-slate-700
                  outline-none
                  dark:border-slate-700
                  dark:bg-slate-900
                  dark:text-slate-200
                "
              />
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
            ) : visiblePayments.length === 0 ? (
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
                  <FiCreditCard className="text-2xl" />
                </div>

                <p
                  className="
                    text-sm
                    font-bold
                    text-slate-400
                  "
                >
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
                {visiblePayments.map((payment) => {
                  const paymentId = (
                    `PAY-${String(payment.id).padStart(6, '0')}`
                  );

                  const meta = statusMeta(payment.status);

                  const userName = (
                    payment.user_name
                    || `${labels.user} #${payment.user ?? payment.id}`
                  );

                  const busy = (
                    actionLoading?.paymentId === payment.id
                  );

                  return (
                    <article
                      key={payment.id}
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
                                text-xs
                                font-bold
                                text-slate-400
                              "
                              dir="ltr"
                            >
                              {paymentId}
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
                          {meta.label}
                        </span>
                      </div>

                      <div
                        className="
                          mt-5
                          grid
                          gap-3
                          sm:grid-cols-2
                        "
                      >
                        <div
                          className="
                            rounded-2xl
                            bg-slate-50
                            p-3
                            dark:bg-slate-900/50
                          "
                        >
                          <p className="text-[11px] font-bold text-slate-400">
                            {labels.product}
                          </p>

                          <p
                            className="
                              mt-1
                              truncate
                              text-sm
                              font-black
                              text-slate-800
                              dark:text-slate-100
                            "
                          >
                            {payment.store_product_name || '—'}
                          </p>
                        </div>

                        <div
                          className="
                            rounded-2xl
                            bg-slate-50
                            p-3
                            dark:bg-slate-900/50
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
                            dir="ltr"
                          >
                            {formatMoney(
                              payment.final_price,
                              payment.currency,
                            )}
                          </p>
                        </div>

                        <div
                          className="
                            rounded-2xl
                            bg-slate-50
                            p-3
                            dark:bg-slate-900/50
                          "
                        >
                          <p className="text-[11px] font-bold text-slate-400">
                            {labels.profit}
                          </p>

                          <p
                            className="
                              mt-1
                              text-sm
                              font-black
                              text-slate-800
                              dark:text-slate-100
                            "
                            dir="ltr"
                          >
                            {formatMoney(
                              payment.profit_amount,
                              payment.currency,
                            )}
                            {' · '}
                            {Number(
                              payment.profit_percentage || 0,
                            ).toLocaleString(locale)}%
                          </p>
                        </div>

                        <div
                          className="
                            rounded-2xl
                            bg-slate-50
                            p-3
                            dark:bg-slate-900/50
                          "
                        >
                          <p className="text-[11px] font-bold text-slate-400">
                            {labels.date}
                          </p>

                          <p
                            className="
                              mt-1
                              text-xs
                              font-black
                              text-slate-800
                              dark:text-slate-100
                            "
                          >
                            {formatDate(payment.created_at)}
                          </p>
                        </div>
                      </div>

                      <div
                        className="
                          mt-4
                          flex
                          flex-wrap
                          gap-2
                          border-t
                          border-slate-100
                          pt-4
                          dark:border-slate-800
                        "
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedPayment(payment)}
                          className="
                            flex
                            items-center
                            gap-2
                            rounded-xl
                            border
                            border-slate-200
                            bg-white
                            px-3
                            py-2
                            text-xs
                            font-black
                            text-slate-600
                            transition
                            hover:bg-slate-50
                            dark:border-slate-700
                            dark:bg-slate-900
                            dark:text-slate-300
                          "
                        >
                          <FiEye />
                          {labels.details}
                        </button>

                        {(payment.status === 'pending'
                          || payment.status === 'processing')
                          && user?.role === 'admin' && (
                          <button
                            type="button"
                            disabled={Boolean(actionLoading)}
                            onClick={() => (
                              handleProcessPayment(
                                payment.id,
                                payment.status,
                              )
                            )}
                            className="
                              flex
                              items-center
                              gap-2
                              rounded-xl
                              px-3
                              py-2
                              text-xs
                              font-black
                              text-white
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
                                busy
                                  && actionLoading?.action === 'status'
                                  ? 'animate-spin'
                                  : ''
                              }
                            />
                            {labels.process}
                          </button>
                        )}

                        {payment.status === 'success'
                          && payment.is_refundable
                          && user?.role === 'admin' && (
                          <button
                            type="button"
                            disabled={Boolean(actionLoading)}
                            onClick={() => (
                              handleRefundPayment(payment.id)
                            )}
                            className="
                              flex
                              items-center
                              gap-2
                              rounded-xl
                              border
                              border-slate-200
                              bg-white
                              px-3
                              py-2
                              text-xs
                              font-black
                              text-slate-600
                              transition
                              hover:bg-slate-50
                              disabled:opacity-50
                              dark:border-slate-700
                              dark:bg-slate-900
                              dark:text-slate-300
                            "
                          >
                            <FiRotateCcw
                              className={
                                busy
                                  && actionLoading?.action === 'refund'
                                  ? 'animate-spin'
                                  : ''
                              }
                            />
                            {labels.refund}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {!loading
            && filteredPayments.length > 0
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
      </div>

      {selectedPayment && (
        <div
          className="
            fixed
            inset-0
            z-[1400]
            flex
            items-center
            justify-center
            bg-slate-950/60
            p-4
            backdrop-blur-sm
          "
          onClick={() => setSelectedPayment(null)}
        >
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className="
              w-full
              max-w-2xl
              rounded-3xl
              border
              border-slate-200
              bg-white
              shadow-2xl
              dark:border-slate-700
              dark:bg-slate-900
            "
            onClick={(event) => event.stopPropagation()}
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
              <div className="text-start">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {labels.details}
                </h3>

                <p className="mt-1 text-xs font-bold text-slate-400" dir="ltr">
                  PAY-{String(selectedPayment.id).padStart(6, '0')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-xl
                  text-slate-400
                  hover:bg-slate-100
                  dark:hover:bg-slate-800
                "
              >
                <FiX />
              </button>
            </div>

            <div
              className="
                grid
                gap-3
                p-5
                sm:grid-cols-2
              "
            >
              {[
                {
                  label: labels.user,
                  value:
                    selectedPayment.user_name
                    || `#${selectedPayment.user ?? '—'}`,
                  icon: <FiUser />,
                },
                {
                  label: labels.product,
                  value: selectedPayment.store_product_name || '—',
                  icon: <FiCreditCard />,
                },
                {
                  label: labels.amount,
                  value: formatMoney(
                    selectedPayment.final_price,
                    selectedPayment.currency,
                  ),
                  icon: <FiDollarSign />,
                },
                {
                  label: labels.baseAmount,
                  value: formatMoney(
                    selectedPayment.base_price,
                    selectedPayment.currency,
                  ),
                  icon: <FiDollarSign />,
                },
                {
                  label: labels.externalId,
                  value: selectedPayment.external_transaction_id || '—',
                  icon: <FiCreditCard />,
                },
                {
                  label: labels.date,
                  value: formatDate(selectedPayment.created_at),
                  icon: <FiClock />,
                },
                {
                  label: labels.processedAt,
                  value: formatDate(selectedPayment.processed_at),
                  icon: <FiClock />,
                },
                {
                  label: labels.errorMessage,
                  value: selectedPayment.error_message || '—',
                  icon: <FiAlertCircle />,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="
                    rounded-2xl
                    border
                    border-slate-100
                    bg-slate-50/70
                    p-4
                    dark:border-slate-700
                    dark:bg-slate-800/40
                  "
                >
                  <div
                    className="
                      mb-2
                      flex
                      items-center
                      gap-2
                      text-xs
                      font-bold
                      text-slate-400
                    "
                  >
                    <span
                      style={{
                        color: accentColor,
                      }}
                    >
                      {item.icon}
                    </span>

                    {item.label}
                  </div>

                  <p
                    className="
                      break-words
                      text-sm
                      font-black
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="
                flex
                justify-end
                border-t
                border-slate-100
                px-5
                py-4
                dark:border-slate-800
              "
            >
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="
                  rounded-xl
                  px-4
                  py-2.5
                  text-sm
                  font-black
                  text-white
                "
                style={{
                  backgroundColor: accentColor,
                }}
              >
                {labels.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FullPayments;