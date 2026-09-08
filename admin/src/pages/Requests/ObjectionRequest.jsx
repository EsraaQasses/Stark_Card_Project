import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  FiAlertTriangle,
  FiCheck,
  FiClock,
  FiDollarSign,
  FiEye,
  FiFileText,
  FiMail,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUser,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

const parseUserInputData = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    const parsed = JSON.parse(value);

    return (
      parsed
      && typeof parsed === 'object'
        ? parsed
        : {}
    );
  } catch {
    return {};
  }
};

const getErrorMessage = (
  error,
  fallback,
) => (
  error?.response?.data?.detail
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const ObjectionRequest = () => {
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
    || 'ar'
  );

  const accentColor = (
    currentColor
    || '#2196F3'
  );

  const [objectionData, setObjectionData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [detailsRequest, setDetailsRequest] = useState(null);
  const [approveRequest, setApproveRequest] = useState(null);
  const [rejectRequest, setRejectRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [toast, setToast] = useState(null);

  const labels = useMemo(
    () => ({
      pageTag: isArabic
        ? 'إدارة الطلبات'
        : 'Requests Management',

      title: isArabic
        ? 'طلبات الاعتراض'
        : 'Objection Requests',

      subtitle: isArabic
        ? 'راجع اعتراضات العملاء، شاهد تفاصيل العملية الأصلية، واتخذ الإجراء المناسب.'
        : 'Review customer objections, inspect original payment details, and take action.',

      refresh: isArabic
        ? 'تحديث البيانات'
        : 'Refresh data',

      total: isArabic
        ? 'إجمالي الاعتراضات'
        : 'Total objections',

      highPriority: isArabic
        ? 'أولوية مرتفعة'
        : 'High priority',

      underReview: isArabic
        ? 'قيد المراجعة'
        : 'Under review',

      totalAmount: isArabic
        ? 'إجمالي المبالغ'
        : 'Total amount',

      searchPlaceholder: isArabic
        ? 'ابحث بالعميل أو رقم الطلب أو سبب الاعتراض...'
        : 'Search by customer, request ID, or objection reason...',

      customer: isArabic
        ? 'العميل'
        : 'Customer',

      reason: isArabic
        ? 'سبب الاعتراض'
        : 'Objection reason',

      amount: isArabic
        ? 'المبلغ'
        : 'Amount',

      priority: isArabic
        ? 'الأولوية'
        : 'Priority',

      date: isArabic
        ? 'تاريخ الطلب'
        : 'Request date',

      status: isArabic
        ? 'الحالة'
        : 'Status',

      actions: isArabic
        ? 'الإجراءات'
        : 'Actions',

      approve: isArabic
        ? 'موافقة'
        : 'Approve',

      reject: isArabic
        ? 'رفض'
        : 'Reject',

      details: isArabic
        ? 'عرض التفاصيل'
        : 'View details',

      empty: isArabic
        ? 'لا توجد طلبات اعتراض حالياً.'
        : 'There are no objection requests right now.',

      noSearchResults: isArabic
        ? 'لا توجد نتائج مطابقة للبحث.'
        : 'No results match your search.',

      loading: isArabic
        ? 'جاري تحميل طلبات الاعتراض...'
        : 'Loading objection requests...',

      loadFailed: isArabic
        ? 'تعذر تحميل طلبات الاعتراض.'
        : 'Failed to load objection requests.',

      detailsTitle: isArabic
        ? 'تفاصيل الاعتراض'
        : 'Objection details',

      requestNumber: isArabic
        ? 'رقم الطلب'
        : 'Request ID',

      customerInfo: isArabic
        ? 'بيانات العميل'
        : 'Customer information',

      objectionInfo: isArabic
        ? 'بيانات الاعتراض'
        : 'Objection information',

      originalPayment: isArabic
        ? 'تفاصيل العملية الأصلية'
        : 'Original payment details',

      paymentId: isArabic
        ? 'رقم الدفعة'
        : 'Payment ID',

      transactionId: isArabic
        ? 'رقم العملية'
        : 'Transaction ID',

      product: isArabic
        ? 'المنتج'
        : 'Product',

      quantity: isArabic
        ? 'الكمية / الخيار'
        : 'Quantity / option',

      paidAmount: isArabic
        ? 'المبلغ المدفوع'
        : 'Paid amount',

      type: isArabic
        ? 'نوع الطلب'
        : 'Request type',

      adminNotes: isArabic
        ? 'ملاحظات الإدارة'
        : 'Admin notes',

      rejectionReason: isArabic
        ? 'سبب الرفض'
        : 'Rejection reason',

      close: isArabic
        ? 'إغلاق'
        : 'Close',

      approveTitle: isArabic
        ? 'تأكيد الموافقة على الاعتراض'
        : 'Approve objection',

      approveMessage: isArabic
        ? 'هل تريد اعتبار هذا الاعتراض محلولاً والموافقة عليه؟'
        : 'Do you want to mark this objection as resolved and approved?',

      confirmApprove: isArabic
        ? 'نعم، موافقة'
        : 'Yes, approve',

      rejectTitle: isArabic
        ? 'رفض الاعتراض'
        : 'Reject objection',

      rejectHint: isArabic
        ? 'اكتب سبب الرفض ليكون واضحاً في سجل الطلب.'
        : 'Write the rejection reason so it is clear in the request record.',

      rejectPlaceholder: isArabic
        ? 'سبب الرفض...'
        : 'Rejection reason...',

      confirmReject: isArabic
        ? 'تأكيد الرفض'
        : 'Confirm rejection',

      cancel: isArabic
        ? 'إلغاء'
        : 'Cancel',

      approveSuccess: isArabic
        ? 'تمت الموافقة على الاعتراض بنجاح.'
        : 'Objection approved successfully.',

      rejectSuccess: isArabic
        ? 'تم رفض الاعتراض بنجاح.'
        : 'Objection rejected successfully.',

      actionFailed: isArabic
        ? 'تعذر تنفيذ الإجراء.'
        : 'The action could not be completed.',

      requiredReason: isArabic
        ? 'اكتب سبب الرفض أولاً.'
        : 'Enter a rejection reason first.',

      objection: isArabic
        ? 'اعتراض'
        : 'Objection',

      high: isArabic
        ? 'مرتفعة'
        : 'High',

      medium: isArabic
        ? 'متوسطة'
        : 'Medium',

      low: isArabic
        ? 'منخفضة'
        : 'Low',
    }),
    [isArabic],
  );

  const showToast = (
    type,
    message,
  ) => {
    setToast({
      type,
      message,
    });

    window.setTimeout(
      () => setToast(null),
      3500,
    );
  };

  const fetchObjectionRequests = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axiosInstance.get(
        '/all_requests/admin/requests/',
        {
          params: {
            status: 'objection',
            page_size: 100,
          },
        },
      );

      const rows = normalizeRows(
        response.data,
      );

      setObjectionData(rows);

      setTotalCount(
        Number(
          response.data?.count
          ?? rows.length,
        ) || rows.length,
      );
    } catch (fetchError) {
      console.error(
        'Failed to load objection requests:',
        fetchError,
      );

      setObjectionData([]);
      setTotalCount(0);

      setError(
        getErrorMessage(
          fetchError,
          labels.loadFailed,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObjectionRequests();
  }, []);

  const getPriority = (request) => {
    const description = String(
      request?.description || '',
    ).toLowerCase();

    const title = String(
      request?.title || '',
    ).toLowerCase();

    const amount = Number(
      request?.amount || 0,
    );

    if (
      amount > 500
      || description.includes('urgent')
      || title.includes('urgent')
      || description.includes('عاجل')
      || title.includes('عاجل')
    ) {
      return 'high';
    }

    if (
      amount > 100
      || description.includes('important')
      || title.includes('important')
      || description.includes('مهم')
      || title.includes('مهم')
    ) {
      return 'medium';
    }

    return 'low';
  };

  const stats = useMemo(() => {
    const highPriority = (
      objectionData.filter(
        (request) => (
          getPriority(request) === 'high'
        ),
      ).length
    );

    const underReview = (
      objectionData.filter(
        (request) => (
          request.status === 'objection'
        ),
      ).length
    );

    const amountTotals = (
      objectionData.reduce(
        (accumulator, request) => {
          const currency = String(
            request.currency || 'USD',
          ).toUpperCase();

          const amount = Number(
            request.amount || 0,
          );

          if (
            !Number.isFinite(amount)
          ) {
            return accumulator;
          }

          accumulator[currency] = (
            accumulator[currency] || 0
          ) + amount;

          return accumulator;
        },
        {},
      )
    );

    return {
      total: totalCount,
      highPriority,
      underReview,
      amountTotals,
    };
  }, [
    objectionData,
    totalCount,
  ]);

  const filteredRequests = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return objectionData;
    }

    return objectionData.filter(
      (request) => {
        const values = [
          request.id,
          request.user_name,
          request.user_email,
          request.user_phone,
          request.title,
          request.description,
          request.amount,
          request.currency,
          request.request_type,
        ];

        return values.some(
          (value) => (
            String(value ?? '')
              .toLowerCase()
              .includes(query)
          ),
        );
      },
    );
  }, [
    objectionData,
    search,
  ]);

  const formatDate = (
    value,
  ) => {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return '—';
    }

    return date.toLocaleString(
      locale,
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  };

  const formatMoney = (
    amount,
    currency,
  ) => {
    const numericAmount = Number(
      amount || 0,
    );

    if (
      !Number.isFinite(
        numericAmount,
      )
    ) {
      return '—';
    }

    return `${numericAmount.toLocaleString(
      locale,
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      },
    )} ${String(
      currency || '',
    ).toUpperCase()}`.trim();
  };

  const statusBadge = (
    status,
  ) => {
    const map = {
      objection: {
        label: labels.objection,
        className:
          'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900/50',
      },

      completed: {
        label: isArabic
          ? 'مكتمل'
          : 'Completed',
        className:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50',
      },

      rejected: {
        label: isArabic
          ? 'مرفوض'
          : 'Rejected',
        className:
          'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50',
      },
    };

    const config = (
      map[status]
      || {
        label: status || '—',
        className:
          'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      }
    );

    return (
      <span
        className={`
          inline-flex
          items-center
          gap-1.5
          rounded-full
          border
          px-2.5
          py-1
          text-xs
          font-black
          ${config.className}
        `}
      >
        <span
          className="
            h-1.5
            w-1.5
            rounded-full
            bg-current
          "
        />

        {config.label}
      </span>
    );
  };

  const priorityBadge = (
    request,
  ) => {
    const priority = getPriority(
      request,
    );

    const config = {
      high: {
        label: labels.high,
        className:
          'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50',
      },

      medium: {
        label: labels.medium,
        className:
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50',
      },

      low: {
        label: labels.low,
        className:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50',
      },
    }[priority];

    return (
      <span
        className={`
          inline-flex
          items-center
          rounded-full
          border
          px-2.5
          py-1
          text-xs
          font-black
          ${config.className}
        `}
      >
        {config.label}
      </span>
    );
  };

  const handleApprove = async () => {
    if (
      !approveRequest
      || actionLoading
    ) {
      return;
    }

    const requestId = approveRequest.id;

    try {
      setActionLoading(
        requestId,
      );

      await axiosInstance.post(
        `/all_requests/admin/requests/${requestId}/update_status/`,
        {
          status: 'completed',
          admin_notes:
            'Objection approved and resolved',
        },
      );

      setApproveRequest(null);

      showToast(
        'success',
        labels.approveSuccess,
      );

      await fetchObjectionRequests();
    } catch (approveError) {
      showToast(
        'error',
        getErrorMessage(
          approveError,
          labels.actionFailed,
        ),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (
      !rejectRequest
      || actionLoading
    ) {
      return;
    }

    const reason = (
      rejectionReason.trim()
    );

    if (!reason) {
      showToast(
        'error',
        labels.requiredReason,
      );

      return;
    }

    const requestId = rejectRequest.id;

    try {
      setActionLoading(
        requestId,
      );

      await axiosInstance.post(
        `/all_requests/admin/requests/${requestId}/update_status/`,
        {
          status: 'rejected',
          admin_notes: reason,
          rejection_reason: reason,
        },
      );

      setRejectRequest(null);
      setRejectionReason('');

      showToast(
        'success',
        labels.rejectSuccess,
      );

      await fetchObjectionRequests();
    } catch (rejectError) {
      showToast(
        'error',
        getErrorMessage(
          rejectError,
          labels.actionFailed,
        ),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const renderAmountTotals = () => {
    const entries = Object.entries(
      stats.amountTotals,
    );

    if (!entries.length) {
      return '0';
    }

    return entries
      .map(
        ([currency, amount]) => (
          `${Number(amount).toLocaleString(
            locale,
            {
              maximumFractionDigits: 2,
            },
          )} ${currency}`
        ),
      )
      .join(' • ');
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
      {toast && (
        <div
          className={`
            fixed
            end-5
            top-24
            z-[3000]
            flex
            max-w-sm
            items-center
            gap-3
            rounded-2xl
            border
            px-4
            py-3
            text-sm
            font-black
            shadow-xl
            ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
            }
          `}
        >
          {toast.type === 'success'
            ? <FiCheck />
            : <FiAlertTriangle />}

          <span>
            {toast.message}
          </span>
        </div>
      )}

      <section
        className="
          relative
          mb-6
          overflow-hidden
          rounded-3xl
          border
          border-slate-100
          bg-white
          p-5
          shadow-sm
          dark:border-slate-800
          dark:bg-secondary-dark-bg
          md:p-7
        "
      >
        <div
          className="
            pointer-events-none
            absolute
            -end-20
            -top-20
            h-56
            w-56
            rounded-full
            opacity-[0.07]
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
            md:flex-row
            md:items-center
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
                  font-black
                "
                style={{
                  color:
                    accentColor,
                }}
              >
                {labels.pageTag}
              </span>
            </div>

            <h1
              className="
                text-2xl
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
                max-w-2xl
                text-sm
                font-semibold
                leading-6
                text-slate-500
                dark:text-slate-400
              "
            >
              {labels.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={
              fetchObjectionRequests
            }
            disabled={loading}
            className="
              inline-flex
              w-full
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
              disabled:cursor-not-allowed
              disabled:opacity-60
              md:w-auto
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

            {labels.refresh}
          </button>
        </div>
      </section>

      <section
        className="
          mb-6
          grid
          gap-3
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >
        <StatCard
          icon={<FiFileText />}
          label={labels.total}
          value={stats.total}
          accentColor={accentColor}
        />

        <StatCard
          icon={<FiAlertTriangle />}
          label={labels.highPriority}
          value={stats.highPriority}
          accentColor="#ef4444"
        />

        <StatCard
          icon={<FiClock />}
          label={labels.underReview}
          value={stats.underReview}
          accentColor="#f59e0b"
        />

        <StatCard
          icon={<FiDollarSign />}
          label={labels.totalAmount}
          value={renderAmountTotals()}
          accentColor="#10b981"
          compact
        />
      </section>

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
          md:p-5
        "
      >
        <div
          className="
            mb-5
            flex
            flex-col
            gap-3
            md:flex-row
            md:items-center
            md:justify-between
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
              {filteredRequests.length}
              {' / '}
              {stats.total}
            </p>
          </div>

          <label
            className="
              flex
              w-full
              items-center
              gap-2
              rounded-xl
              border
              border-slate-200
              bg-slate-50
              px-3
              py-2.5
              dark:border-slate-700
              dark:bg-slate-900
              md:max-w-md
            "
          >
            <FiSearch
              className="
                shrink-0
                text-slate-400
              "
            />

            <input
              type="search"
              value={search}
              onChange={
                (event) => (
                  setSearch(
                    event.target.value,
                  )
                )
              }
              placeholder={
                labels.searchPlaceholder
              }
              className="
                w-full
                bg-transparent
                text-sm
                font-semibold
                text-slate-800
                outline-none
                placeholder:text-slate-400
                dark:text-white
              "
            />
          </label>
        </div>

        {error && (
          <div
            className="
              mb-4
              flex
              items-center
              gap-2
              rounded-2xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-sm
              font-bold
              text-red-700
              dark:border-red-900/50
              dark:bg-red-950/30
              dark:text-red-300
            "
          >
            <FiAlertTriangle />

            <span>
              {error}
            </span>
          </div>
        )}

        {loading ? (
          <div
            className="
              flex
              min-h-[300px]
              flex-col
              items-center
              justify-center
              gap-3
              text-slate-400
            "
          >
            <div
              className="
                h-9
                w-9
                animate-spin
                rounded-full
                border-2
                border-slate-200
                border-b-blue-500
              "
            />

            <p className="text-sm font-bold">
              {labels.loading}
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div
            className="
              flex
              min-h-[300px]
              flex-col
              items-center
              justify-center
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
                text-xl
                text-slate-400
                dark:bg-slate-800
              "
            >
              <FiShield />
            </div>

            <p
              className="
                font-black
                text-slate-600
                dark:text-slate-300
              "
            >
              {search
                ? labels.noSearchResults
                : labels.empty}
            </p>
          </div>
        ) : (
          <>
            <div
              className="
                hidden
                overflow-x-auto
                lg:block
              "
            >
              <table
                className="
                  w-full
                  min-w-[1050px]
                  border-separate
                  border-spacing-0
                "
              >
                <thead>
                  <tr
                    className="
                      text-xs
                      font-black
                      text-slate-400
                    "
                  >
                    <TableHead>
                      {labels.customer}
                    </TableHead>

                    <TableHead>
                      {labels.reason}
                    </TableHead>

                    <TableHead center>
                      {labels.amount}
                    </TableHead>

                    <TableHead center>
                      {labels.priority}
                    </TableHead>

                    <TableHead center>
                      {labels.date}
                    </TableHead>

                    <TableHead center>
                      {labels.status}
                    </TableHead>

                    <TableHead center>
                      {labels.actions}
                    </TableHead>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map(
                    (request) => (
                      <tr
                        key={request.id}
                        className="
                          border-b
                          border-slate-100
                          text-sm
                          dark:border-slate-800
                        "
                      >
                        <td
                          className="
                            border-t
                            border-slate-100
                            px-3
                            py-4
                            dark:border-slate-800
                          "
                        >
                          <CustomerCell
                            request={request}
                          />
                        </td>

                        <td
                          className="
                            max-w-xs
                            border-t
                            border-slate-100
                            px-3
                            py-4
                            dark:border-slate-800
                          "
                        >
                          <p
                            className="
                              line-clamp-2
                              font-bold
                              leading-6
                              text-slate-700
                              dark:text-slate-200
                            "
                          >
                            {request.description
                              || request.title
                              || '—'}
                          </p>

                          <p
                            className="
                              mt-1
                              text-xs
                              font-semibold
                              text-slate-400
                            "
                          >
                            #{request.id}
                          </p>
                        </td>

                        <td
                          className="
                            border-t
                            border-slate-100
                            px-3
                            py-4
                            text-center
                            font-black
                            text-slate-800
                            dark:border-slate-800
                            dark:text-white
                          "
                        >
                          {request.amount
                            ? formatMoney(
                                request.amount,
                                request.currency,
                              )
                            : '—'}
                        </td>

                        <td
                          className="
                            border-t
                            border-slate-100
                            px-3
                            py-4
                            text-center
                            dark:border-slate-800
                          "
                        >
                          {priorityBadge(
                            request,
                          )}
                        </td>

                        <td
                          className="
                            border-t
                            border-slate-100
                            px-3
                            py-4
                            text-center
                            text-xs
                            font-bold
                            text-slate-500
                            dark:border-slate-800
                            dark:text-slate-400
                          "
                        >
                          {formatDate(
                            request.created_at,
                          )}
                        </td>

                        <td
                          className="
                            border-t
                            border-slate-100
                            px-3
                            py-4
                            text-center
                            dark:border-slate-800
                          "
                        >
                          {statusBadge(
                            request.status,
                          )}
                        </td>

                        <td
                          className="
                            border-t
                            border-slate-100
                            px-3
                            py-4
                            dark:border-slate-800
                          "
                        >
                          <ActionButtons
                            request={request}
                            labels={labels}
                            accentColor={accentColor}
                            disabled={
                              Boolean(
                                actionLoading,
                              )
                            }
                            onDetails={
                              () => (
                                setDetailsRequest(
                                  request,
                                )
                              )
                            }
                            onApprove={
                              () => (
                                setApproveRequest(
                                  request,
                                )
                              )
                            }
                            onReject={
                              () => {
                                setRejectRequest(
                                  request,
                                );
                                setRejectionReason('');
                              }
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div
              className="
                grid
                gap-3
                lg:hidden
              "
            >
              {filteredRequests.map(
                (request) => (
                  <article
                    key={request.id}
                    className="
                      rounded-2xl
                      border
                      border-slate-100
                      p-4
                      dark:border-slate-800
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
                      <CustomerCell
                        request={request}
                      />

                      {statusBadge(
                        request.status,
                      )}
                    </div>

                    <div
                      className="
                        my-4
                        h-px
                        bg-slate-100
                        dark:bg-slate-800
                      "
                    />

                    <p
                      className="
                        text-sm
                        font-bold
                        leading-6
                        text-slate-700
                        dark:text-slate-200
                      "
                    >
                      {request.description
                        || request.title
                        || '—'}
                    </p>

                    <div
                      className="
                        mt-4
                        grid
                        grid-cols-2
                        gap-3
                      "
                    >
                      <MiniInfo
                        label={labels.amount}
                        value={
                          request.amount
                            ? formatMoney(
                                request.amount,
                                request.currency,
                              )
                            : '—'
                        }
                      />

                      <MiniInfo
                        label={labels.priority}
                        value={priorityBadge(
                          request,
                        )}
                        node
                      />

                      <MiniInfo
                        label={labels.date}
                        value={formatDate(
                          request.created_at,
                        )}
                      />

                      <MiniInfo
                        label={labels.requestNumber}
                        value={`#${request.id}`}
                      />
                    </div>

                    <div
                      className="
                        mt-4
                        border-t
                        border-slate-100
                        pt-4
                        dark:border-slate-800
                      "
                    >
                      <ActionButtons
                        request={request}
                        labels={labels}
                        accentColor={accentColor}
                        disabled={
                          Boolean(
                            actionLoading,
                          )
                        }
                        mobile
                        onDetails={
                          () => (
                            setDetailsRequest(
                              request,
                            )
                          )
                        }
                        onApprove={
                          () => (
                            setApproveRequest(
                              request,
                            )
                          )
                        }
                        onReject={
                          () => {
                            setRejectRequest(
                              request,
                            );
                            setRejectionReason('');
                          }
                        }
                      />
                    </div>
                  </article>
                ),
              )}
            </div>
          </>
        )}
      </section>

      {detailsRequest && (
        <DetailsModal
          request={detailsRequest}
          labels={labels}
          locale={locale}
          accentColor={accentColor}
          formatDate={formatDate}
          formatMoney={formatMoney}
          statusBadge={statusBadge}
          onClose={
            () => setDetailsRequest(null)
          }
        />
      )}

      {approveRequest && (
        <ConfirmModal
          icon={<FiCheck />}
          title={labels.approveTitle}
          message={labels.approveMessage}
          confirmLabel={labels.confirmApprove}
          cancelLabel={labels.cancel}
          accentColor="#10b981"
          loading={
            actionLoading
            === approveRequest.id
          }
          onCancel={
            () => setApproveRequest(null)
          }
          onConfirm={handleApprove}
        />
      )}

      {rejectRequest && (
        <RejectModal
          labels={labels}
          reason={rejectionReason}
          setReason={setRejectionReason}
          loading={
            actionLoading
            === rejectRequest.id
          }
          onCancel={() => {
            setRejectRequest(null);
            setRejectionReason('');
          }}
          onConfirm={handleReject}
        />
      )}
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  accentColor,
  compact = false,
}) => (
  <article
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
        h-12
        w-12
        shrink-0
        items-center
        justify-center
        rounded-2xl
        text-xl
      "
      style={{
        color: accentColor,
        backgroundColor:
          `${accentColor}12`,
      }}
    >
      {icon}
    </div>

    <div className="min-w-0 text-start">
      <p
        className="
          text-xs
          font-bold
          text-slate-400
        "
      >
        {label}
      </p>

      <p
        className={`
          mt-1
          font-black
          text-slate-950
          dark:text-white
          ${
            compact
              ? 'truncate text-base'
              : 'text-2xl'
          }
        `}
        title={
          typeof value === 'string'
            ? value
            : undefined
        }
      >
        {value}
      </p>
    </div>
  </article>
);

const TableHead = ({
  children,
  center = false,
}) => (
  <th
    className={`
      border-b
      border-slate-100
      px-3
      py-3
      dark:border-slate-800
      ${
        center
          ? 'text-center'
          : 'text-start'
      }
    `}
  >
    {children}
  </th>
);

const CustomerCell = ({
  request,
}) => {
  const name = (
    request.user_name
    || request.user_email
    || '—'
  );

  const initial = (
    String(name)
      .trim()
      .charAt(0)
      .toUpperCase()
    || '?'
  );

  return (
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
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          rounded-xl
          bg-blue-50
          text-sm
          font-black
          text-blue-600
          dark:bg-blue-950/30
          dark:text-blue-300
        "
      >
        {initial}
      </div>

      <div className="min-w-0 text-start">
        <p
          className="
            truncate
            text-sm
            font-black
            text-slate-800
            dark:text-white
          "
        >
          {name}
        </p>

        <p
          className="
            mt-0.5
            truncate
            text-xs
            font-semibold
            text-slate-400
          "
        >
          {request.user_email
            || request.user_phone
            || '—'}
        </p>
      </div>
    </div>
  );
};

const ActionButtons = ({
  labels,
  accentColor,
  disabled,
  mobile = false,
  onDetails,
  onApprove,
  onReject,
}) => (
  <div
    className={`
      flex
      items-center
      justify-center
      gap-2
      ${
        mobile
          ? 'flex-wrap'
          : ''
      }
    `}
  >
    <button
      type="button"
      disabled={disabled}
      onClick={onDetails}
      className="
        inline-flex
        items-center
        justify-center
        gap-1.5
        rounded-lg
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
      style={{
        color: accentColor,
      }}
    >
      <FiEye />
      {labels.details}
    </button>

    <button
      type="button"
      disabled={disabled}
      onClick={onApprove}
      className="
        inline-flex
        items-center
        justify-center
        gap-1.5
        rounded-lg
        bg-emerald-500
        px-3
        py-2
        text-xs
        font-black
        text-white
        transition
        hover:bg-emerald-600
        disabled:opacity-50
      "
    >
      <FiCheck />
      {labels.approve}
    </button>

    <button
      type="button"
      disabled={disabled}
      onClick={onReject}
      className="
        inline-flex
        items-center
        justify-center
        gap-1.5
        rounded-lg
        bg-red-500
        px-3
        py-2
        text-xs
        font-black
        text-white
        transition
        hover:bg-red-600
        disabled:opacity-50
      "
    >
      <FiX />
      {labels.reject}
    </button>
  </div>
);

const MiniInfo = ({
  label,
  value,
  node = false,
}) => (
  <div
    className="
      rounded-xl
      bg-slate-50
      p-3
      text-start
      dark:bg-slate-900/60
    "
  >
    <p
      className="
        text-[10px]
        font-bold
        text-slate-400
      "
    >
      {label}
    </p>

    {node ? (
      <div className="mt-1">
        {value}
      </div>
    ) : (
      <p
        className="
          mt-1
          text-xs
          font-black
          text-slate-700
          dark:text-slate-200
        "
      >
        {value}
      </p>
    )}
  </div>
);

const ModalShell = ({
  children,
  onClose,
  maxWidth = 'max-w-2xl',
}) => (
  <div
    className="
      fixed
      inset-0
      z-[4000]
      flex
      items-center
      justify-center
      bg-slate-950/55
      p-3
      backdrop-blur-sm
    "
    onMouseDown={(event) => {
      if (
        event.target
        === event.currentTarget
      ) {
        onClose();
      }
    }}
  >
    <div
      className={`
        max-h-[90vh]
        w-full
        overflow-y-auto
        rounded-3xl
        border
        border-slate-200
        bg-white
        shadow-2xl
        dark:border-slate-800
        dark:bg-secondary-dark-bg
        ${maxWidth}
      `}
    >
      {children}
    </div>
  </div>
);

const DetailsModal = ({
  request,
  labels,
  accentColor,
  formatDate,
  formatMoney,
  statusBadge,
  onClose,
}) => {
  const inputData = parseUserInputData(
    request.user_input_data,
  );

  const paymentId = (
    inputData.payment_id
    ?? inputData.original_payment_id
    ?? inputData.paymentId
    ?? '—'
  );

  const transactionId = (
    inputData.transaction_id
    ?? inputData.original_transaction_id
    ?? inputData.external_transaction_id
    ?? inputData.transactionId
    ?? '—'
  );

  const productName = (
    inputData.product_name
    ?? inputData.store_product_name
    ?? inputData.product
    ?? '—'
  );

  const quantity = (
    inputData.quantity
    ?? inputData.selected_option
    ?? inputData.selected_units
    ?? inputData.amount
    ?? '—'
  );

  const paidAmount = (
    inputData.paid_amount
    ?? inputData.final_price
    ?? inputData.final_amount_submitted
    ?? request.amount
  );

  const paidCurrency = (
    inputData.paid_currency
    ?? inputData.wallet_currency
    ?? inputData.currency
    ?? request.currency
  );

  return (
    <ModalShell
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div
        className="
          sticky
          top-0
          z-10
          flex
          items-center
          justify-between
          border-b
          border-slate-100
          bg-white/95
          px-5
          py-4
          backdrop-blur
          dark:border-slate-800
          dark:bg-secondary-dark-bg/95
        "
      >
        <div className="text-start">
          <p
            className="
              text-xs
              font-black
            "
            style={{
              color: accentColor,
            }}
          >
            #{request.id}
          </p>

          <h3
            className="
              mt-1
              text-xl
              font-black
              text-slate-950
              dark:text-white
            "
          >
            {labels.detailsTitle}
          </h3>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            bg-slate-100
            text-slate-500
            transition
            hover:bg-slate-200
            dark:bg-slate-800
            dark:text-slate-300
          "
        >
          <FiX />
        </button>
      </div>

      <div className="space-y-5 p-5">
        <ModalSection
          title={labels.customerInfo}
          icon={<FiUser />}
          accentColor={accentColor}
        >
          <InfoGrid>
            <InfoRow
              icon={<FiUser />}
              label={labels.customer}
              value={request.user_name || '—'}
            />

            <InfoRow
              icon={<FiMail />}
              label="Email"
              value={request.user_email || '—'}
              ltr
            />

            <InfoRow
              icon={<FiPhone />}
              label={labels.customer === 'العميل' ? 'رقم الهاتف' : 'Phone'}
              value={request.user_phone || '—'}
              ltr
            />
          </InfoGrid>
        </ModalSection>

        <ModalSection
          title={labels.objectionInfo}
          icon={<FiAlertTriangle />}
          accentColor="#f59e0b"
        >
          <InfoGrid>
            <InfoRow
              icon={<FiFileText />}
              label={labels.requestNumber}
              value={`#${request.id}`}
              ltr
            />

            <InfoRow
              icon={<FiDollarSign />}
              label={labels.amount}
              value={
                request.amount
                  ? formatMoney(
                      request.amount,
                      request.currency,
                    )
                  : '—'
              }
              ltr
            />

            <InfoRow
              icon={<FiClock />}
              label={labels.date}
              value={formatDate(
                request.created_at,
              )}
            />

            <InfoRow
              icon={<FiShield />}
              label={labels.type}
              value={
                request.request_type
                || '—'
              }
            />
          </InfoGrid>

          <div
            className="
              mt-4
              rounded-2xl
              border
              border-orange-100
              bg-orange-50/70
              p-4
              dark:border-orange-900/40
              dark:bg-orange-950/20
            "
          >
            <div
              className="
                mb-2
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
                  text-orange-700
                  dark:text-orange-300
                "
              >
                {labels.reason}
              </p>

              {statusBadge(
                request.status,
              )}
            </div>

            <p
              className="
                whitespace-pre-wrap
                text-sm
                font-bold
                leading-7
                text-slate-700
                dark:text-slate-200
              "
            >
              {request.description
                || request.title
                || '—'}
            </p>
          </div>
        </ModalSection>

        <ModalSection
          title={labels.originalPayment}
          icon={<FiDollarSign />}
          accentColor="#3b82f6"
        >
          <InfoGrid>
            <InfoRow
              icon={<FiFileText />}
              label={labels.paymentId}
              value={String(paymentId)}
              ltr
            />

            <InfoRow
              icon={<FiFileText />}
              label={labels.transactionId}
              value={String(transactionId)}
              ltr
            />

            <InfoRow
              icon={<FiFileText />}
              label={labels.product}
              value={String(productName)}
            />

            <InfoRow
              icon={<FiFileText />}
              label={labels.quantity}
              value={String(quantity)}
              ltr
            />

            <InfoRow
              icon={<FiDollarSign />}
              label={labels.paidAmount}
              value={
                paidAmount != null
                  ? formatMoney(
                      paidAmount,
                      paidCurrency,
                    )
                  : '—'
              }
              ltr
            />
          </InfoGrid>
        </ModalSection>

        {(request.admin_notes
          || request.rejection_reason) && (
          <ModalSection
            title={labels.adminNotes}
            icon={<FiFileText />}
            accentColor="#64748b"
          >
            {request.admin_notes && (
              <p
                className="
                  rounded-xl
                  bg-slate-50
                  p-3
                  text-sm
                  font-semibold
                  leading-6
                  text-slate-700
                  dark:bg-slate-900
                  dark:text-slate-200
                "
              >
                {request.admin_notes}
              </p>
            )}

            {request.rejection_reason && (
              <p
                className="
                  mt-2
                  rounded-xl
                  bg-red-50
                  p-3
                  text-sm
                  font-semibold
                  leading-6
                  text-red-700
                  dark:bg-red-950/20
                  dark:text-red-300
                "
              >
                {labels.rejectionReason}
                {': '}
                {request.rejection_reason}
              </p>
            )}
          </ModalSection>
        )}
      </div>

      <div
        className="
          sticky
          bottom-0
          flex
          justify-end
          border-t
          border-slate-100
          bg-white/95
          px-5
          py-4
          backdrop-blur
          dark:border-slate-800
          dark:bg-secondary-dark-bg/95
        "
      >
        <button
          type="button"
          onClick={onClose}
          className="
            rounded-xl
            px-5
            py-2.5
            text-sm
            font-black
            text-white
          "
          style={{
            backgroundColor:
              accentColor,
          }}
        >
          {labels.close}
        </button>
      </div>
    </ModalShell>
  );
};

const ModalSection = ({
  title,
  icon,
  accentColor,
  children,
}) => (
  <section
    className="
      rounded-2xl
      border
      border-slate-100
      p-4
      dark:border-slate-800
    "
  >
    <div
      className="
        mb-4
        flex
        items-center
        gap-2
      "
    >
      <span
        className="
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-xl
        "
        style={{
          color: accentColor,
          backgroundColor:
            `${accentColor}12`,
        }}
      >
        {icon}
      </span>

      <h4
        className="
          text-sm
          font-black
          text-slate-900
          dark:text-white
        "
      >
        {title}
      </h4>
    </div>

    {children}
  </section>
);

const InfoGrid = ({
  children,
}) => (
  <div
    className="
      grid
      gap-2
      md:grid-cols-2
    "
  >
    {children}
  </div>
);

const InfoRow = ({
  icon,
  label,
  value,
  ltr = false,
}) => (
  <div
    className="
      flex
      items-start
      gap-3
      rounded-xl
      bg-slate-50
      p-3
      dark:bg-slate-900/60
    "
  >
    <span
      className="
        mt-0.5
        shrink-0
        text-slate-400
      "
    >
      {icon}
    </span>

    <div className="min-w-0 text-start">
      <p
        className="
          text-[10px]
          font-bold
          text-slate-400
        "
      >
        {label}
      </p>

      <p
        dir={
          ltr
            ? 'ltr'
            : undefined
        }
        className="
          mt-1
          break-words
          text-sm
          font-black
          text-slate-700
          dark:text-slate-200
        "
      >
        {value}
      </p>
    </div>
  </div>
);

const ConfirmModal = ({
  icon,
  title,
  message,
  confirmLabel,
  cancelLabel,
  accentColor,
  loading,
  onCancel,
  onConfirm,
}) => (
  <ModalShell
    onClose={onCancel}
    maxWidth="max-w-md"
  >
    <div className="p-5">
      <div
        className="
          mx-auto
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          text-2xl
        "
        style={{
          color: accentColor,
          backgroundColor:
            `${accentColor}14`,
        }}
      >
        {icon}
      </div>

      <h3
        className="
          mt-4
          text-center
          text-xl
          font-black
          text-slate-950
          dark:text-white
        "
      >
        {title}
      </h3>

      <p
        className="
          mt-2
          text-center
          text-sm
          font-semibold
          leading-6
          text-slate-500
          dark:text-slate-400
        "
      >
        {message}
      </p>

      <div
        className="
          mt-6
          grid
          grid-cols-2
          gap-3
        "
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="
            rounded-xl
            border
            border-slate-200
            px-4
            py-2.5
            text-sm
            font-black
            text-slate-600
            disabled:opacity-50
            dark:border-slate-700
            dark:text-slate-300
          "
        >
          {cancelLabel}
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            px-4
            py-2.5
            text-sm
            font-black
            text-white
            disabled:opacity-50
          "
          style={{
            backgroundColor:
              accentColor,
          }}
        >
          {loading && (
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
          )}

          {confirmLabel}
        </button>
      </div>
    </div>
  </ModalShell>
);

const RejectModal = ({
  labels,
  reason,
  setReason,
  loading,
  onCancel,
  onConfirm,
}) => (
  <ModalShell
    onClose={onCancel}
    maxWidth="max-w-md"
  >
    <div className="p-5">
      <div
        className="
          mx-auto
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          bg-red-50
          text-2xl
          text-red-500
          dark:bg-red-950/30
        "
      >
        <FiX />
      </div>

      <h3
        className="
          mt-4
          text-center
          text-xl
          font-black
          text-slate-950
          dark:text-white
        "
      >
        {labels.rejectTitle}
      </h3>

      <p
        className="
          mt-2
          text-center
          text-sm
          font-semibold
          leading-6
          text-slate-500
          dark:text-slate-400
        "
      >
        {labels.rejectHint}
      </p>

      <textarea
        rows="4"
        value={reason}
        onChange={
          (event) => (
            setReason(
              event.target.value,
            )
          )
        }
        placeholder={
          labels.rejectPlaceholder
        }
        className="
          mt-5
          w-full
          resize-none
          rounded-xl
          border
          border-slate-200
          bg-slate-50
          px-4
          py-3
          text-sm
          font-semibold
          text-slate-800
          outline-none
          transition
          focus:border-red-300
          focus:ring-2
          focus:ring-red-100
          dark:border-slate-700
          dark:bg-slate-900
          dark:text-white
        "
      />

      <div
        className="
          mt-5
          grid
          grid-cols-2
          gap-3
        "
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="
            rounded-xl
            border
            border-slate-200
            px-4
            py-2.5
            text-sm
            font-black
            text-slate-600
            disabled:opacity-50
            dark:border-slate-700
            dark:text-slate-300
          "
        >
          {labels.cancel}
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-red-500
            px-4
            py-2.5
            text-sm
            font-black
            text-white
            transition
            hover:bg-red-600
            disabled:opacity-50
          "
        >
          {loading && (
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
          )}

          {labels.confirmReject}
        </button>
      </div>
    </div>
  </ModalShell>
);

export default ObjectionRequest;
