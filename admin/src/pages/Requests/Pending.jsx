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
  FiUser,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.detail
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const parseUserInputData = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const Pending = () => {
  const { i18n } = useTranslation(['requests', 'common']);
  const { currentColor } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const locale = (
    i18n.resolvedLanguage
    || i18n.language
    || 'ar'
  );

  const accentColor = currentColor || '#2196F3';

  const labels = useMemo(() => ({
    pageTag: isArabic ? 'إدارة الطلبات' : 'Requests Management',
    title: isArabic ? 'الطلبات قيد الانتظار' : 'Pending Requests',
    subtitle: isArabic
      ? 'راجع الطلبات الجديدة، افتح التفاصيل، ثم وافق أو ارفض بدون نوافذ المتصفح القديمة.'
      : 'Review new requests, inspect details, then approve or reject them.',
    refresh: isArabic ? 'تحديث البيانات' : 'Refresh data',

    total: isArabic ? 'إجمالي قيد الانتظار' : 'Total pending',
    payment: isArabic ? 'الدفع والشحن' : 'Payment & shipping',
    support: isArabic ? 'الدعم والتحقق' : 'Support & verification',
    refund: isArabic ? 'استرداد الأموال' : 'Refunds',
    other: isArabic ? 'أخرى' : 'Other',

    search: isArabic
      ? 'ابحث بالعميل أو رقم الطلب أو الوصف...'
      : 'Search by customer, request ID, or description...',

    customer: isArabic ? 'العميل' : 'Customer',
    type: isArabic ? 'نوع الطلب' : 'Type',
    description: isArabic ? 'الوصف' : 'Description',
    amount: isArabic ? 'المبلغ' : 'Amount',
    date: isArabic ? 'تاريخ الطلب' : 'Request date',
    status: isArabic ? 'الحالة' : 'Status',
    actions: isArabic ? 'الإجراءات' : 'Actions',

    pending: isArabic ? 'قيد الانتظار' : 'Pending',
    approve: isArabic ? 'موافقة' : 'Approve',
    reject: isArabic ? 'رفض' : 'Reject',
    details: isArabic ? 'عرض التفاصيل' : 'View details',

    loading: isArabic ? 'جاري تحميل الطلبات...' : 'Loading requests...',
    empty: isArabic ? 'لا توجد طلبات قيد الانتظار.' : 'No pending requests.',
    noResults: isArabic ? 'لا توجد نتائج مطابقة للبحث.' : 'No matching results.',
    loadFailed: isArabic ? 'تعذر تحميل الطلبات.' : 'Failed to load requests.',

    detailsTitle: isArabic ? 'تفاصيل الطلب' : 'Request details',
    customerInfo: isArabic ? 'بيانات العميل' : 'Customer information',
    requestInfo: isArabic ? 'بيانات الطلب' : 'Request information',
    requestId: isArabic ? 'رقم الطلب' : 'Request ID',
    paymentMethod: isArabic ? 'طريقة الدفع' : 'Payment method',
    userInput: isArabic ? 'بيانات إضافية' : 'Additional data',
    adminNotes: isArabic ? 'ملاحظات الإدارة' : 'Admin notes',
    close: isArabic ? 'إغلاق' : 'Close',

    approveTitle: isArabic ? 'تأكيد الموافقة' : 'Approve request',
    approveMessage: isArabic
      ? 'هل تريد الموافقة على هذا الطلب واعتباره مكتملاً؟'
      : 'Do you want to approve this request and mark it completed?',
    confirmApprove: isArabic ? 'نعم، موافقة' : 'Yes, approve',

    rejectTitle: isArabic ? 'رفض الطلب' : 'Reject request',
    rejectHint: isArabic
      ? 'اكتب سبب الرفض ليُحفظ ضمن سجل الطلب.'
      : 'Enter a rejection reason to store it with the request.',
    rejectPlaceholder: isArabic ? 'سبب الرفض...' : 'Rejection reason...',
    confirmReject: isArabic ? 'تأكيد الرفض' : 'Confirm rejection',
    cancel: isArabic ? 'إلغاء' : 'Cancel',

    approveSuccess: isArabic ? 'تمت الموافقة على الطلب.' : 'Request approved.',
    rejectSuccess: isArabic ? 'تم رفض الطلب.' : 'Request rejected.',
    actionFailed: isArabic ? 'تعذر تنفيذ الإجراء.' : 'Action failed.',
    reasonRequired: isArabic ? 'اكتب سبب الرفض أولاً.' : 'Enter a rejection reason first.',
  }), [isArabic]);

  const [rows, setRows] = useState([]);
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

  const showToast = (type, message) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  };

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axiosInstance.get(
        '/all_requests/admin/requests/',
        {
          params: {
            status: 'pending',
            page_size: 100,
          },
        },
      );

      const nextRows = normalizeRows(response.data);

      setRows(nextRows);
      setTotalCount(
        Number(response.data?.count ?? nextRows.length)
        || nextRows.length,
      );
    } catch (fetchError) {
      setRows([]);
      setTotalCount(0);
      setError(getErrorMessage(fetchError, labels.loadFailed));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const stats = useMemo(() => ({
    total: totalCount,
    payment: rows.filter((item) => item.request_type === 'payment').length,
    support: rows.filter((item) => item.request_type === 'support').length,
    refund: rows.filter((item) => item.request_type === 'refund').length,
    other: rows.filter(
      (item) => !['payment', 'support', 'refund'].includes(item.request_type),
    ).length,
  }), [rows, totalCount]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((request) => [
      request.id,
      request.user_name,
      request.user_email,
      request.user_phone,
      request.title,
      request.description,
      request.request_type,
      request.amount,
      request.currency,
    ].some((value) => (
      String(value ?? '').toLowerCase().includes(query)
    )));
  }, [rows, search]);

  const formatDate = (value) => {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMoney = (amount, currency) => {
    const numeric = Number(amount);

    if (!Number.isFinite(numeric)) return '—';

    return `${numeric.toLocaleString(locale, {
      maximumFractionDigits: 2,
    })} ${String(currency || '').toUpperCase()}`.trim();
  };

  const typeLabel = (type) => {
    const map = {
      payment: isArabic ? 'دفع' : 'Payment',
      support: isArabic ? 'دعم' : 'Support',
      refund: isArabic ? 'استرداد' : 'Refund',
      cashout: isArabic ? 'سحب' : 'Cashout',
      other: isArabic ? 'أخرى' : 'Other',
    };

    return map[type] || type || '—';
  };

  const handleApprove = async () => {
    if (!approveRequest || actionLoading) return;

    const requestId = approveRequest.id;

    try {
      setActionLoading(requestId);

      await axiosInstance.post(
        `/all_requests/admin/requests/${requestId}/update_status/`,
        {
          status: 'completed',
          admin_notes: 'Request approved',
        },
      );

      setApproveRequest(null);
      showToast('success', labels.approveSuccess);
      await fetchPendingRequests();
    } catch (actionError) {
      showToast(
        'error',
        getErrorMessage(actionError, labels.actionFailed),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectRequest || actionLoading) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      showToast('error', labels.reasonRequired);
      return;
    }

    const requestId = rejectRequest.id;

    try {
      setActionLoading(requestId);

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
      showToast('success', labels.rejectSuccess);
      await fetchPendingRequests();
    } catch (actionError) {
      showToast(
        'error',
        getErrorMessage(actionError, labels.actionFailed),
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="mt-20 px-3 py-4 sm:px-5 md:mt-4 md:px-8 md:py-6"
    >
      <Toast toast={toast} />

      <PageHero
        tag={labels.pageTag}
        title={labels.title}
        subtitle={labels.subtitle}
        refreshLabel={labels.refresh}
        loading={loading}
        accentColor={accentColor}
        onRefresh={fetchPendingRequests}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={labels.total}
          value={stats.total}
          icon={<FiFileText />}
          accentColor={accentColor}
        />

        <StatCard
          label={labels.payment}
          value={stats.payment}
          icon={<FiDollarSign />}
          accentColor="#3b82f6"
        />

        <StatCard
          label={labels.support}
          value={stats.support}
          icon={<FiUser />}
          accentColor="#8b5cf6"
        />

        <StatCard
          label={labels.refund}
          value={stats.refund}
          icon={<FiRefreshCw />}
          accentColor="#f97316"
        />

        <StatCard
          label={labels.other}
          value={stats.other}
          icon={<FiFileText />}
          accentColor="#64748b"
        />
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg md:p-5">
        <SectionToolbar
          title={labels.title}
          search={search}
          setSearch={setSearch}
          placeholder={labels.search}
          count={filteredRows.length}
          total={stats.total}
        />

        {error && (
          <ErrorBanner message={error} />
        )}

        {loading ? (
          <LoadingState label={labels.loading} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            label={search ? labels.noResults : labels.empty}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1050px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-xs font-black text-slate-400">
                    <TableHead>{labels.customer}</TableHead>
                    <TableHead center>{labels.type}</TableHead>
                    <TableHead>{labels.description}</TableHead>
                    <TableHead center>{labels.amount}</TableHead>
                    <TableHead center>{labels.date}</TableHead>
                    <TableHead center>{labels.status}</TableHead>
                    <TableHead center>{labels.actions}</TableHead>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((request) => (
                    <tr key={request.id}>
                      <BodyCell>
                        <CustomerCell request={request} />
                      </BodyCell>

                      <BodyCell center>
                        <TypeBadge label={typeLabel(request.request_type)} />
                      </BodyCell>

                      <BodyCell>
                        <div className="max-w-sm text-start">
                          <p className="line-clamp-2 text-sm font-black text-slate-700 dark:text-slate-200">
                            {request.title || request.description || '—'}
                          </p>

                          {!!request.description && (
                            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">
                              {request.description}
                            </p>
                          )}
                        </div>
                      </BodyCell>

                      <BodyCell center>
                        <span className="font-black text-slate-800 dark:text-white">
                          {request.amount
                            ? formatMoney(request.amount, request.currency)
                            : '—'}
                        </span>
                      </BodyCell>

                      <BodyCell center>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {formatDate(request.created_at)}
                        </span>
                      </BodyCell>

                      <BodyCell center>
                        <StatusBadge label={labels.pending} tone="amber" />
                      </BodyCell>

                      <BodyCell center>
                        <ActionButtons
                          labels={labels}
                          disabled={Boolean(actionLoading)}
                          accentColor={accentColor}
                          onDetails={() => setDetailsRequest(request)}
                          onApprove={() => setApproveRequest(request)}
                          onReject={() => {
                            setRejectRequest(request);
                            setRejectionReason('');
                          }}
                        />
                      </BodyCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 lg:hidden">
              {filteredRows.map((request) => (
                <MobileRequestCard
                  key={request.id}
                  request={request}
                  labels={labels}
                  typeLabel={typeLabel(request.request_type)}
                  amount={
                    request.amount
                      ? formatMoney(request.amount, request.currency)
                      : '—'
                  }
                  date={formatDate(request.created_at)}
                  accentColor={accentColor}
                  disabled={Boolean(actionLoading)}
                  onDetails={() => setDetailsRequest(request)}
                  onApprove={() => setApproveRequest(request)}
                  onReject={() => {
                    setRejectRequest(request);
                    setRejectionReason('');
                  }}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {detailsRequest && (
        <RequestDetailsModal
          request={detailsRequest}
          labels={labels}
          typeLabel={typeLabel}
          formatDate={formatDate}
          formatMoney={formatMoney}
          accentColor={accentColor}
          onClose={() => setDetailsRequest(null)}
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
          loading={actionLoading === approveRequest.id}
          onCancel={() => setApproveRequest(null)}
          onConfirm={handleApprove}
        />
      )}

      {rejectRequest && (
        <RejectModal
          labels={labels}
          reason={rejectionReason}
          setReason={setRejectionReason}
          loading={actionLoading === rejectRequest.id}
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

const PageHero = ({
  tag,
  title,
  subtitle,
  refreshLabel,
  loading,
  accentColor,
  onRefresh,
}) => (
  <section className="relative mb-6 overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg md:p-7">
    <div
      className="pointer-events-none absolute -end-20 -top-20 h-56 w-56 rounded-full opacity-[0.07]"
      style={{ backgroundColor: accentColor }}
    />

    <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-center">
      <div className="text-start">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: accentColor }}
          />

          <span
            className="text-sm font-black"
            style={{ color: accentColor }}
          >
            {tag}
          </span>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">
          {title}
        </h1>

        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 md:w-auto"
        style={{ backgroundColor: accentColor }}
      >
        <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        {refreshLabel}
      </button>
    </div>
  </section>
);

const StatCard = ({
  label,
  value,
  icon,
  accentColor,
}) => (
  <article className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
      style={{
        color: accentColor,
        backgroundColor: `${accentColor}12`,
      }}
    >
      {icon}
    </div>

    <div className="min-w-0 text-start">
      <p className="text-xs font-bold text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  </article>
);

const SectionToolbar = ({
  title,
  search,
  setSearch,
  placeholder,
  count,
  total,
}) => (
  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div className="text-start">
      <h2 className="text-lg font-black text-slate-900 dark:text-white">
        {title}
      </h2>

      <p className="mt-1 text-xs font-semibold text-slate-400">
        {count} / {total}
      </p>
    </div>

    <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 md:max-w-md">
      <FiSearch className="shrink-0 text-slate-400" />

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
      />
    </label>
  </div>
);

const TableHead = ({ children, center = false }) => (
  <th
    className={`border-b border-slate-100 px-3 py-3 dark:border-slate-800 ${
      center ? 'text-center' : 'text-start'
    }`}
  >
    {children}
  </th>
);

const BodyCell = ({
  children,
  center = false,
}) => (
  <td
    className={`border-t border-slate-100 px-3 py-4 dark:border-slate-800 ${
      center ? 'text-center' : ''
    }`}
  >
    {children}
  </td>
);

const CustomerCell = ({ request }) => {
  const name = request.user_name || request.user_email || '—';
  const initial = String(name).trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
        {initial}
      </div>

      <div className="min-w-0 text-start">
        <p className="truncate text-sm font-black text-slate-800 dark:text-white">
          {name}
        </p>

        <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
          {request.user_email || request.user_phone || '—'}
        </p>
      </div>
    </div>
  );
};

const TypeBadge = ({ label }) => (
  <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
    {label}
  </span>
);

const StatusBadge = ({ label, tone }) => {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${
        tones[tone] || tones.blue
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
};

const ActionButtons = ({
  labels,
  disabled,
  accentColor,
  onDetails,
  onApprove,
  onReject,
  mobile = false,
}) => (
  <div className={`flex items-center justify-center gap-2 ${mobile ? 'flex-wrap' : ''}`}>
    <button
      type="button"
      onClick={onDetails}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
      style={{ color: accentColor }}
    >
      <FiEye />
      {labels.details}
    </button>

    <button
      type="button"
      onClick={onApprove}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-600 disabled:opacity-50"
    >
      <FiCheck />
      {labels.approve}
    </button>

    <button
      type="button"
      onClick={onReject}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-black text-white transition hover:bg-red-600 disabled:opacity-50"
    >
      <FiX />
      {labels.reject}
    </button>
  </div>
);

const MobileRequestCard = ({
  request,
  labels,
  typeLabel,
  amount,
  date,
  accentColor,
  disabled,
  onDetails,
  onApprove,
  onReject,
}) => (
  <article className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
    <div className="flex items-start justify-between gap-3">
      <CustomerCell request={request} />
      <StatusBadge label={labels.pending} tone="amber" />
    </div>

    <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />

    <p className="text-sm font-black text-slate-700 dark:text-slate-200">
      {request.title || request.description || '—'}
    </p>

    {!!request.description && (
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
        {request.description}
      </p>
    )}

    <div className="mt-4 grid grid-cols-2 gap-2">
      <MiniInfo label={labels.type} value={<TypeBadge label={typeLabel} />} node />
      <MiniInfo label={labels.amount} value={amount} />
      <MiniInfo label={labels.date} value={date} />
      <MiniInfo label={labels.requestId} value={`#${request.id}`} />
    </div>

    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
      <ActionButtons
        labels={labels}
        disabled={disabled}
        accentColor={accentColor}
        mobile
        onDetails={onDetails}
        onApprove={onApprove}
        onReject={onReject}
      />
    </div>
  </article>
);

const MiniInfo = ({ label, value, node = false }) => (
  <div className="rounded-xl bg-slate-50 p-3 text-start dark:bg-slate-900/60">
    <p className="text-[10px] font-bold text-slate-400">
      {label}
    </p>

    {node ? (
      <div className="mt-1">{value}</div>
    ) : (
      <p className="mt-1 break-words text-xs font-black text-slate-700 dark:text-slate-200">
        {value}
      </p>
    )}
  </div>
);

const RequestDetailsModal = ({
  request,
  labels,
  typeLabel,
  formatDate,
  formatMoney,
  accentColor,
  onClose,
}) => {
  const userInput = parseUserInputData(request.user_input_data);

  const extraEntries = Object.entries(userInput)
    .filter(([, value]) => (
      value != null
      && typeof value !== 'object'
      && String(value).trim() !== ''
    ))
    .slice(0, 12);

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-3xl">
      <ModalHeader
        title={labels.detailsTitle}
        subtitle={`#${request.id}`}
        accentColor={accentColor}
        onClose={onClose}
      />

      <div className="space-y-5 p-5">
        <ModalSection
          title={labels.customerInfo}
          icon={<FiUser />}
          accentColor={accentColor}
        >
          <InfoGrid>
            <InfoRow icon={<FiUser />} label={labels.customer} value={request.user_name || '—'} />
            <InfoRow icon={<FiMail />} label="Email" value={request.user_email || '—'} ltr />
            <InfoRow icon={<FiPhone />} label="Phone" value={request.user_phone || '—'} ltr />
          </InfoGrid>
        </ModalSection>

        <ModalSection
          title={labels.requestInfo}
          icon={<FiFileText />}
          accentColor="#f59e0b"
        >
          <InfoGrid>
            <InfoRow icon={<FiFileText />} label={labels.requestId} value={`#${request.id}`} ltr />
            <InfoRow icon={<FiFileText />} label={labels.type} value={typeLabel(request.request_type)} />
            <InfoRow
              icon={<FiDollarSign />}
              label={labels.amount}
              value={
                request.amount
                  ? formatMoney(request.amount, request.currency)
                  : '—'
              }
              ltr
            />
            <InfoRow icon={<FiClock />} label={labels.date} value={formatDate(request.created_at)} />
            <InfoRow icon={<FiFileText />} label={labels.paymentMethod} value={request.payment_method_title || '—'} />
            <InfoRow icon={<FiClock />} label={labels.status} value={labels.pending} />
          </InfoGrid>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs font-black text-slate-400">
              {labels.description}
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-7 text-slate-700 dark:text-slate-200">
              {request.description || request.title || '—'}
            </p>
          </div>
        </ModalSection>

        {extraEntries.length > 0 && (
          <ModalSection
            title={labels.userInput}
            icon={<FiFileText />}
            accentColor="#8b5cf6"
          >
            <div className="grid gap-2 md:grid-cols-2">
              {extraEntries.map(([key, value]) => (
                <InfoRow
                  key={key}
                  icon={<FiFileText />}
                  label={key.replace(/_/g, ' ')}
                  value={String(value)}
                  ltr
                />
              ))}
            </div>
          </ModalSection>
        )}

        {!!request.admin_notes && (
          <ModalSection
            title={labels.adminNotes}
            icon={<FiFileText />}
            accentColor="#64748b"
          >
            <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {request.admin_notes}
            </p>
          </ModalSection>
        )}
      </div>

      <ModalFooter label={labels.close} accentColor={accentColor} onClose={onClose} />
    </ModalShell>
  );
};

const ModalShell = ({ children, onClose, maxWidth }) => (
  <div
    className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}
  >
    <div className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-secondary-dark-bg ${maxWidth}`}>
      {children}
    </div>
  </div>
);

const ModalHeader = ({
  title,
  subtitle,
  accentColor,
  onClose,
}) => (
  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-secondary-dark-bg">
    <div className="text-start">
      <p className="text-xs font-black" style={{ color: accentColor }}>
        {subtitle}
      </p>

      <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
        {title}
      </h3>
    </div>

    <button
      type="button"
      onClick={onClose}
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
    >
      <FiX />
    </button>
  </div>
);

const ModalFooter = ({ label, accentColor, onClose }) => (
  <div className="sticky bottom-0 flex justify-end border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-secondary-dark-bg">
    <button
      type="button"
      onClick={onClose}
      className="rounded-xl px-5 py-2.5 text-sm font-black text-white"
      style={{ backgroundColor: accentColor }}
    >
      {label}
    </button>
  </div>
);

const ModalSection = ({
  title,
  icon,
  accentColor,
  children,
}) => (
  <section className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
    <div className="mb-4 flex items-center gap-2">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          color: accentColor,
          backgroundColor: `${accentColor}12`,
        }}
      >
        {icon}
      </span>

      <h4 className="text-sm font-black text-slate-900 dark:text-white">
        {title}
      </h4>
    </div>

    {children}
  </section>
);

const InfoGrid = ({ children }) => (
  <div className="grid gap-2 md:grid-cols-2">
    {children}
  </div>
);

const InfoRow = ({
  icon,
  label,
  value,
  ltr = false,
}) => (
  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
    <span className="mt-0.5 shrink-0 text-slate-400">
      {icon}
    </span>

    <div className="min-w-0 text-start">
      <p className="text-[10px] font-bold text-slate-400">
        {label}
      </p>

      <p
        dir={ltr ? 'ltr' : undefined}
        className="mt-1 break-words text-sm font-black text-slate-700 dark:text-slate-200"
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
  <ModalShell onClose={onCancel} maxWidth="max-w-md">
    <div className="p-5">
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
        style={{
          color: accentColor,
          backgroundColor: `${accentColor}14`,
        }}
      >
        {icon}
      </div>

      <h3 className="mt-4 text-center text-xl font-black text-slate-950 dark:text-white">
        {title}
      </h3>

      <p className="mt-2 text-center text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
        {message}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
        >
          {cancelLabel}
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-b-white" />
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
  <ModalShell onClose={onCancel} maxWidth="max-w-md">
    <div className="p-5">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-500 dark:bg-red-950/30">
        <FiX />
      </div>

      <h3 className="mt-4 text-center text-xl font-black text-slate-950 dark:text-white">
        {labels.rejectTitle}
      </h3>

      <p className="mt-2 text-center text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
        {labels.rejectHint}
      </p>

      <textarea
        rows="4"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={labels.rejectPlaceholder}
        className="mt-5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      />

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
        >
          {labels.cancel}
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-b-white" />
          )}
          {labels.confirmReject}
        </button>
      </div>
    </div>
  </ModalShell>
);

const Toast = ({ toast }) => {
  if (!toast) return null;

  return (
    <div
      className={`fixed end-5 top-24 z-[5000] flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black shadow-xl ${
        toast.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
      }`}
    >
      {toast.type === 'success'
        ? <FiCheck />
        : <FiAlertTriangle />}
      <span>{toast.message}</span>
    </div>
  );
};

const ErrorBanner = ({ message }) => (
  <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
    <FiAlertTriangle />
    <span>{message}</span>
  </div>
);

const LoadingState = ({ label }) => (
  <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-slate-400">
    <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-b-blue-500" />
    <p className="text-sm font-bold">{label}</p>
  </div>
);

const EmptyState = ({ label }) => (
  <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400 dark:bg-slate-800">
      <FiFileText />
    </div>

    <p className="font-black text-slate-600 dark:text-slate-300">
      {label}
    </p>
  </div>
);

export default Pending;
