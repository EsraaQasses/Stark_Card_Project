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
  FiImage,
  FiMail,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiTruck,
  FiUser,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

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

const normalizeImageUrl = (url) => {
  if (!url) return '';

  const value = String(url).trim();

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return value;
  }

  return `/${value.replace(/^\/+/, '')}`;
};

const ShippingRequests = () => {
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
    pageTag: isArabic ? 'الشحن' : 'Shipping',
    title: isArabic ? 'إدارة طلبات الشحن' : 'Shipping Requests',
    subtitle: isArabic
      ? 'راجع طلبات شحن المحافظ، شاهد الإيصالات والتفاصيل، ثم وافق أو ارفض من نفس الصفحة.'
      : 'Review wallet funding requests, receipts, and details, then approve or reject from the same page.',
    refresh: isArabic ? 'تحديث البيانات' : 'Refresh data',

    total: isArabic ? 'إجمالي الطلبات' : 'Total requests',
    pending: isArabic ? 'قيد الانتظار' : 'Pending',
    approved: isArabic ? 'مكتملة' : 'Approved',
    rejected: isArabic ? 'مرفوضة' : 'Rejected',

    search: isArabic
      ? 'ابحث بالعميل أو رقم الطلب أو طريقة الدفع...'
      : 'Search by customer, request ID, or payment method...',

    customer: isArabic ? 'العميل' : 'Customer',
    source: isArabic ? 'نوع الطلب' : 'Request type',
    amount: isArabic ? 'المبلغ' : 'Amount',
    paymentMethod: isArabic ? 'طريقة الدفع' : 'Payment method',
    date: isArabic ? 'تاريخ الطلب' : 'Request date',
    status: isArabic ? 'الحالة' : 'Status',
    actions: isArabic ? 'الإجراءات' : 'Actions',

    standard: isArabic ? 'شحن عادي' : 'Standard',
    agentAdmin: isArabic ? 'وكيل عبر الإدارة' : 'Agent via admin',

    details: isArabic ? 'عرض التفاصيل' : 'View details',
    approve: isArabic ? 'موافقة' : 'Approve',
    reject: isArabic ? 'رفض' : 'Reject',

    processing: isArabic ? 'قيد المعالجة' : 'Processing',

    loading: isArabic ? 'جاري تحميل طلبات الشحن...' : 'Loading shipping requests...',
    empty: isArabic ? 'لا توجد طلبات شحن حالياً.' : 'No shipping requests.',
    noResults: isArabic ? 'لا توجد نتائج مطابقة للبحث.' : 'No matching results.',
    loadFailed: isArabic ? 'تعذر تحميل طلبات الشحن.' : 'Failed to load shipping requests.',

    detailsTitle: isArabic ? 'تفاصيل طلب الشحن' : 'Shipping request details',
    customerInfo: isArabic ? 'بيانات صاحب الطلب' : 'Requester information',
    requestInfo: isArabic ? 'بيانات الشحن' : 'Shipping information',
    requestId: isArabic ? 'رقم الطلب' : 'Request ID',
    walletCurrency: isArabic ? 'عملة المحفظة' : 'Wallet currency',
    transactionRef: isArabic ? 'مرجع العملية' : 'Transaction reference',
    receipt: isArabic ? 'إيصال الدفع' : 'Payment receipt',
    extraData: isArabic ? 'بيانات إضافية' : 'Additional data',
    adminNotes: isArabic ? 'ملاحظات الإدارة' : 'Admin notes',
    close: isArabic ? 'إغلاق' : 'Close',

    approveTitle: isArabic ? 'تأكيد الموافقة على الشحن' : 'Approve shipping',
    approveMessage: isArabic
      ? 'سيتم اعتماد طلب الشحن وتنفيذ المعالجة المالية المرتبطة به.'
      : 'The shipping request will be approved and its financial processing will run.',
    confirmApprove: isArabic ? 'نعم، موافقة' : 'Yes, approve',

    rejectTitle: isArabic ? 'رفض طلب الشحن' : 'Reject shipping request',
    rejectHint: isArabic
      ? 'اكتب سبب الرفض ليُحفظ في سجل الطلب.'
      : 'Enter a rejection reason to store it with the request.',
    rejectPlaceholder: isArabic ? 'سبب الرفض...' : 'Rejection reason...',
    confirmReject: isArabic ? 'تأكيد الرفض' : 'Confirm rejection',
    cancel: isArabic ? 'إلغاء' : 'Cancel',

    approveSuccess: isArabic ? 'تمت الموافقة على طلب الشحن.' : 'Shipping request approved.',
    rejectSuccess: isArabic ? 'تم رفض طلب الشحن.' : 'Shipping request rejected.',
    actionFailed: isArabic ? 'تعذر تنفيذ الإجراء.' : 'Action failed.',
    reasonRequired: isArabic ? 'اكتب سبب الرفض أولاً.' : 'Enter a rejection reason first.',
  }), [isArabic]);

  const [rows, setRows] = useState([]);
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

  const fetchAllPages = async (path) => {
    const result = [];
    let next = path;
    let params = { page_size: 100 };

    while (next) {
      const response = await axiosInstance.get(next, { params });

      const pageRows = Array.isArray(response.data?.results)
        ? response.data.results
        : Array.isArray(response.data)
          ? response.data
          : [];

      result.push(...pageRows);
      next = response.data?.next || null;
      params = undefined;
    }

    return result;
  };

  const fetchShippingData = async () => {
    try {
      setLoading(true);
      setError('');

      const requestTypes = [
        {
          type: 'standard',
          path: '/shipping/standard/',
        },
        {
          type: 'agent-admin',
          path: '/shipping/agent-admin/',
        },
      ];

      const responses = await Promise.all(
        requestTypes.map(async ({ type, path }) => {
          const data = await fetchAllPages(path);

          return data.map((row) => {
            const isAgentAdmin = type === 'agent-admin';

            return {
              ...row,
              row_id: `${type}-${row.id}`,
              _shipping_type: type,

              user_name: (
                row.user_name
                || row.agent_name
                || ''
              ),

              user_email: (
                row.user_email
                || row.agent_email
                || ''
              ),

              user_phone: (
                row.user_phone
                || row.agent_phone
                || ''
              ),

              _source_label: isAgentAdmin
                ? labels.agentAdmin
                : labels.standard,
            };
          });
        }),
      );

      setRows(
        responses
          .flat()
          .sort(
            (a, b) => (
              new Date(b.created_at).getTime()
              - new Date(a.created_at).getTime()
            ),
          ),
      );
    } catch (fetchError) {
      setRows([]);
      setError(getErrorMessage(fetchError, labels.loadFailed));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShippingData();
  }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((item) => item.status === 'pending').length,
    approved: rows.filter((item) => item.status === 'approved').length,
    rejected: rows.filter((item) => item.status === 'rejected').length,
  }), [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((request) => [
      request.id,
      request.row_id,
      request.user_name,
      request.user_email,
      request.user_phone,
      request.amount,
      request.currency,
      request.wallet_currency,
      request.payment_method_title,
      request.transaction_ref,
      request.status,
      request._source_label,
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
      minimumFractionDigits: String(currency || '').toUpperCase() === 'USD' ? 2 : 0,
      maximumFractionDigits: 2,
    })} ${String(currency || '').toUpperCase()}`.trim();
  };

  const getStatusPath = (shipping) => (
    `/shipping/${shipping._shipping_type}/${shipping.id}/update_status/`
  );

  const handleApprove = async () => {
    if (!approveRequest || actionLoading) return;

    const rowId = approveRequest.row_id;

    try {
      setActionLoading(rowId);

      await axiosInstance.post(
        getStatusPath(approveRequest),
        {
          status: 'approved',
          admin_notes: 'Payment verified and approved',
        },
      );

      setApproveRequest(null);
      showToast('success', labels.approveSuccess);
      await fetchShippingData();
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

    const rowId = rejectRequest.row_id;

    try {
      setActionLoading(rowId);

      await axiosInstance.post(
        getStatusPath(rejectRequest),
        {
          status: 'rejected',
          admin_notes: reason,
        },
      );

      setRejectRequest(null);
      setRejectionReason('');
      showToast('success', labels.rejectSuccess);
      await fetchShippingData();
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
        onRefresh={fetchShippingData}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={labels.total}
          value={stats.total}
          icon={<FiTruck />}
          accentColor={accentColor}
        />

        <StatCard
          label={labels.pending}
          value={stats.pending}
          icon={<FiClock />}
          accentColor="#f59e0b"
        />

        <StatCard
          label={labels.approved}
          value={stats.approved}
          icon={<FiCheck />}
          accentColor="#10b981"
        />

        <StatCard
          label={labels.rejected}
          value={stats.rejected}
          icon={<FiX />}
          accentColor="#ef4444"
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
                    <TableHead center>{labels.source}</TableHead>
                    <TableHead center>{labels.amount}</TableHead>
                    <TableHead>{labels.paymentMethod}</TableHead>
                    <TableHead center>{labels.date}</TableHead>
                    <TableHead center>{labels.status}</TableHead>
                    <TableHead center>{labels.actions}</TableHead>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((request) => (
                    <tr key={request.row_id}>
                      <BodyCell>
                        <CustomerCell request={request} />
                      </BodyCell>

                      <BodyCell center>
                        <SourceBadge label={request._source_label} />
                      </BodyCell>

                      <BodyCell center>
                        <span className="font-black text-slate-800 dark:text-white">
                          {formatMoney(request.amount, request.currency)}
                        </span>

                        {!!request.wallet_currency && (
                          <p className="mt-1 text-[10px] font-bold text-slate-400">
                            Wallet: {String(request.wallet_currency).toUpperCase()}
                          </p>
                        )}
                      </BodyCell>

                      <BodyCell>
                        <p className="max-w-[220px] truncate text-sm font-bold text-slate-700 dark:text-slate-200">
                          {request.payment_method_title || '—'}
                        </p>

                        {!!request.transaction_ref && (
                          <p className="mt-1 max-w-[220px] truncate text-xs font-semibold text-slate-400">
                            {request.transaction_ref}
                          </p>
                        )}
                      </BodyCell>

                      <BodyCell center>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {formatDate(request.created_at)}
                        </span>
                      </BodyCell>

                      <BodyCell center>
                        <StatusBadge
                          status={request.status}
                          labels={labels}
                        />
                      </BodyCell>

                      <BodyCell center>
                        <ShippingActions
                          request={request}
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
                <MobileShippingCard
                  key={request.row_id}
                  request={request}
                  labels={labels}
                  amount={formatMoney(request.amount, request.currency)}
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
        <ShippingDetailsModal
          request={detailsRequest}
          labels={labels}
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
          loading={actionLoading === approveRequest.row_id}
          onCancel={() => setApproveRequest(null)}
          onConfirm={handleApprove}
        />
      )}

      {rejectRequest && (
        <RejectModal
          labels={labels}
          reason={rejectionReason}
          setReason={setRejectionReason}
          loading={actionLoading === rejectRequest.row_id}
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

const SourceBadge = ({ label }) => (
  <span className="inline-flex rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300">
    {label}
  </span>
);

const StatusBadge = ({ status, labels }) => {
  const map = {
    pending: {
      label: labels.pending,
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
    },
    approved: {
      label: labels.approved,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
    },
    rejected: {
      label: labels.rejected,
      className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
    },
    processing: {
      label: labels.processing,
      className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
    },
  };

  const config = map[status] || {
    label: status || '—',
    className: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${config.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
};

const ShippingActions = ({
  request,
  labels,
  disabled,
  accentColor,
  onDetails,
  onApprove,
  onReject,
  mobile = false,
}) => {
  const isPending = request.status === 'pending';

  return (
    <div className={`flex items-center justify-center gap-2 ${mobile ? 'flex-wrap' : 'flex-wrap'}`}>
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

      {isPending && (
        <>
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
        </>
      )}
    </div>
  );
};

const MobileShippingCard = ({
  request,
  labels,
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
      <StatusBadge status={request.status} labels={labels} />
    </div>

    <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />

    <div className="grid grid-cols-2 gap-2">
      <MiniInfo
        label={labels.source}
        value={<SourceBadge label={request._source_label} />}
        node
      />

      <MiniInfo label={labels.amount} value={amount} />

      <MiniInfo
        label={labels.paymentMethod}
        value={request.payment_method_title || '—'}
      />

      <MiniInfo label={labels.date} value={date} />
    </div>

    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
      <ShippingActions
        request={request}
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

const ShippingDetailsModal = ({
  request,
  labels,
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
    .slice(0, 16);

  const receiptUrl = normalizeImageUrl(request.receipt_image);

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
            <InfoRow icon={<FiFileText />} label={labels.source} value={request._source_label || '—'} />
          </InfoGrid>
        </ModalSection>

        <ModalSection
          title={labels.requestInfo}
          icon={<FiTruck />}
          accentColor="#3b82f6"
        >
          <InfoGrid>
            <InfoRow icon={<FiFileText />} label={labels.requestId} value={`#${request.id}`} ltr />
            <InfoRow icon={<FiDollarSign />} label={labels.amount} value={formatMoney(request.amount, request.currency)} ltr />
            <InfoRow icon={<FiDollarSign />} label={labels.walletCurrency} value={String(request.wallet_currency || '—').toUpperCase()} ltr />
            <InfoRow icon={<FiFileText />} label={labels.paymentMethod} value={request.payment_method_title || '—'} />
            <InfoRow icon={<FiClock />} label={labels.date} value={formatDate(request.created_at)} />
            <InfoRow icon={<FiFileText />} label={labels.transactionRef} value={request.transaction_ref || '—'} ltr />
          </InfoGrid>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
            <p className="text-xs font-black text-slate-400">
              {labels.status}
            </p>

            <StatusBadge status={request.status} labels={labels} />
          </div>
        </ModalSection>

        {!!receiptUrl && (
          <ModalSection
            title={labels.receipt}
            icon={<FiImage />}
            accentColor="#8b5cf6"
          >
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            >
              <img
                src={receiptUrl}
                alt={labels.receipt}
                className="max-h-[420px] w-full object-contain"
              />
            </a>
          </ModalSection>
        )}

        {extraEntries.length > 0 && (
          <ModalSection
            title={labels.extraData}
            icon={<FiFileText />}
            accentColor="#f59e0b"
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
      if (event.target === event.currentTarget) onClose();
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
      <FiTruck />
    </div>

    <p className="font-black text-slate-600 dark:text-slate-300">
      {label}
    </p>
  </div>
);

export default ShippingRequests;
