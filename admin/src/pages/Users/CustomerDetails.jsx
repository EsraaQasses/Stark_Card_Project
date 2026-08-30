import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import { useTranslation } from 'react-i18next';

import {
  FiActivity,
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiClipboard,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiHash,
  FiKey,
  FiLayers,
  FiMail,
  FiMinus,
  FiPhone,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiShoppingBag,
  FiTruck,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

const adjustmentCurrencies = new Set(['USD', 'SYP']);

const getApiError = (error, fallback) => {
  const data = error?.response?.data;

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (data?.error) {
    return String(data.error);
  }

  if (data?.detail) {
    return String(data.detail);
  }

  if (
    Array.isArray(data?.non_field_errors)
    && data.non_field_errors.length
  ) {
    return data.non_field_errors.join(' ');
  }

  return fallback;
};

const createIdempotencyKey = (customerId) => {
  if (
    typeof window !== 'undefined'
    && window.crypto
    && typeof window.crypto.randomUUID === 'function'
  ) {
    return window.crypto.randomUUID();
  }

  return [
    'customer-adjustment',
    customerId,
    Date.now(),
    Math.random().toString(36).slice(2),
  ].join('-');
};

const statusClassName = (status) => {
  const normalized = String(status || '').toLowerCase();

  if (
    [
      'approved',
      'completed',
      'complete',
      'success',
      'succeeded',
      'paid',
      'active',
      'delivered',
    ].includes(normalized)
  ) {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50';
  }

  if (
    [
      'pending',
      'processing',
      'requested',
      'created',
      'in_progress',
      'in progress',
    ].includes(normalized)
  ) {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50';
  }

  if (
    [
      'rejected',
      'failed',
      'cancelled',
      'canceled',
      'inactive',
      'banned',
    ].includes(normalized)
  ) {
    return 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/50';
  }

  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
};

const StatusBadge = ({ value }) => (
  <span
    className={`
      inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold
      ${statusClassName(value)}
    `}
  >
    {value || '—'}
  </span>
);

const Panel = ({
  title,
  subtitle,
  icon,
  accentColor,
  actions = null,
  children,
  className = '',
}) => (
  <section
    className={`
      overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm
      dark:border-slate-800 dark:bg-secondary-dark-bg ${className}
    `}
  >
    <div
      className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between md:px-6"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg"
          style={{
            backgroundColor: `${accentColor}14`,
            color: accentColor,
          }}
        >
          {icon}
        </div>

        <div className="min-w-0 text-start">
          <h2 className="text-base font-black text-slate-900 dark:text-white md:text-lg">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-0.5 text-xs font-medium text-slate-400 md:text-sm">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions}
    </div>

    <div className="p-5 md:p-6">
      {children}
    </div>
  </section>
);

const EmptyState = ({ text, icon = <FiClipboard /> }) => (
  <div className="flex min-h-[170px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center dark:border-slate-700 dark:bg-slate-900/30">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl text-slate-400 shadow-sm dark:bg-slate-800">
      {icon}
    </div>
    <p className="text-sm font-bold text-slate-400">
      {text}
    </p>
  </div>
);

const InfoCard = ({
  label,
  value,
  icon,
  accentColor,
  dir,
}) => (
  <div className="group rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-900">
    <div className="mb-3 flex items-center gap-2">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-xl text-sm"
        style={{
          backgroundColor: `${accentColor}12`,
          color: accentColor,
        }}
      >
        {icon}
      </span>

      <span className="text-xs font-extrabold text-slate-400">
        {label}
      </span>
    </div>

    <p
      dir={dir}
      className="break-words text-sm font-black text-slate-900 dark:text-white md:text-base"
    >
      {value === null || value === undefined || value === ''
        ? '—'
        : String(value)}
    </p>
  </div>
);

const MiniStat = ({
  label,
  value,
  icon,
  accentColor,
}) => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
      style={{
        backgroundColor: `${accentColor}12`,
        color: accentColor,
      }}
    >
      {icon}
    </div>

    <div className="min-w-0 text-start">
      <p className="text-xs font-bold text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-base font-black text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  </div>
);

const DataTable = ({
  rows,
  columns,
  emptyText,
  emptyIcon,
}) => {
  if (!rows?.length) {
    return (
      <EmptyState
        text={emptyText}
        icon={emptyIcon}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/90 dark:bg-slate-900/60">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="whitespace-nowrap px-4 py-3.5 text-start text-xs font-black uppercase tracking-wide text-slate-400"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, rowIndex) => (
              <tr
                key={row.id ?? `${rowIndex}-${JSON.stringify(row)}`}
                className="bg-white transition hover:bg-slate-50/80 dark:bg-transparent dark:hover:bg-slate-900/40"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="whitespace-nowrap px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {column.render
                      ? column.render(row)
                      : (row[column.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ModalShell = ({
  open,
  title,
  subtitle,
  children,
  onClose,
  busy,
  accentColor,
  icon,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="relative overflow-hidden border-b border-slate-100 px-5 py-5 dark:border-slate-800 md:px-6">
          <div
            className="pointer-events-none absolute -end-14 -top-16 h-36 w-36 rounded-full opacity-[0.08]"
            style={{ backgroundColor: accentColor }}
          />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg"
                style={{
                  backgroundColor: `${accentColor}14`,
                  color: accentColor,
                }}
              >
                {icon}
              </div>

              <div className="min-w-0 text-start">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {title}
                </h3>

                {subtitle && (
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <FiX />
            </button>
          </div>
        </div>

        <div className="p-5 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const CustomerDetails = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { currentColor } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const locale = (
    i18n.resolvedLanguage
    || i18n.language
    || (isArabic ? 'ar' : 'en')
  );

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    category: isArabic ? 'إدارة العملاء' : 'Customer Management',
    title: isArabic ? 'ملف العميل' : 'Customer Profile',
    back: isArabic ? 'العودة للعملاء' : 'Back to customers',
    refresh: isArabic ? 'تحديث البيانات' : 'Refresh data',
    loading: isArabic
      ? 'جاري تحميل ملف العميل...'
      : 'Loading customer profile...',
    notFound: isArabic
      ? 'لم يتم العثور على العميل.'
      : 'Customer not found.',
    loadFailed: isArabic
      ? 'تعذر تحميل بيانات العميل.'
      : 'Failed to load customer details.',
    noData: isArabic ? 'لا توجد بيانات لعرضها.' : 'No data to display.',

    overviewTab: isArabic ? 'نظرة عامة' : 'Overview',
    walletTab: isArabic ? 'المحافظ والرصيد' : 'Wallets & Balance',
    activityTab: isArabic ? 'النشاط والسجل' : 'Activity & History',

    basic: isArabic ? 'المعلومات الشخصية' : 'Personal Information',
    account: isArabic ? 'معلومات الحساب' : 'Account Information',
    security: isArabic ? 'الأمان والجلسات' : 'Security & Sessions',
    balances: isArabic ? 'المحافظ والأرصدة' : 'Wallets & Balances',
    transactions: isArabic ? 'آخر الحركات' : 'Recent Transactions',
    purchases: isArabic ? 'المشتريات' : 'Purchases',
    requests: isArabic ? 'الطلبات' : 'Requests',
    shipping: isArabic ? 'طلبات الشحن' : 'Shipping Requests',
    adjustments: isArabic ? 'سجل تعديلات الرصيد' : 'Balance Adjustment History',
    audit: isArabic ? 'سجل التدقيق' : 'Audit History',

    id: isArabic ? 'رقم العميل' : 'Customer ID',
    username: isArabic ? 'اسم المستخدم' : 'Username',
    fullName: isArabic ? 'الاسم الكامل' : 'Full name',
    email: isArabic ? 'البريد الإلكتروني' : 'Email',
    phone: isArabic ? 'رقم الهاتف' : 'Phone',
    role: isArabic ? 'الدور' : 'Role',
    joined: isArabic ? 'تاريخ التسجيل' : 'Joined date',
    lastLogin: isArabic ? 'آخر تسجيل دخول' : 'Last login',
    status: isArabic ? 'الحالة' : 'Status',
    active: isArabic ? 'نشط' : 'Active',
    banned: isArabic ? 'محظور' : 'Banned',
    inactive: isArabic ? 'غير نشط' : 'Inactive',
    assignedAgent: isArabic ? 'الوكيل المعيّن' : 'Assigned agent',
    customerCategory: isArabic ? 'فئة العميل' : 'Customer category',

    walletCount: isArabic ? 'عدد المحافظ' : 'Wallets',
    transactionCount: isArabic ? 'الحركات الأخيرة' : 'Recent transactions',
    requestCount: isArabic ? 'الطلبات' : 'Requests',

    available: isArabic ? 'الرصيد المتاح' : 'Available balance',
    pending: isArabic ? 'الرصيد المعلّق' : 'Pending balance',
    total: isArabic ? 'إجمالي الرصيد' : 'Total balance',
    addBalance: isArabic ? 'إضافة رصيد' : 'Add balance',
    deductBalance: isArabic ? 'خصم رصيد' : 'Deduct balance',
    walletNumber: isArabic ? 'رقم المحفظة' : 'Wallet ID',
    adjustmentNote: isArabic
      ? 'يتم تطبيق إضافة أو خصم الرصيد مباشرة بعد تأكيد العملية، بدون موافقة Admin ثانية.'
      : 'Balance credits and debits are applied immediately after confirmation, with no second-admin approval.',
    recentAdjustmentNote: isArabic
      ? 'التعديلات المعروضة مستخرجة من سجل التدقيق الخاص بالعميل.'
      : 'Displayed balance adjustments are reconstructed from the customer audit history.',

    amount: isArabic ? 'المبلغ' : 'Amount',
    currency: isArabic ? 'العملة' : 'Currency',
    reason: isArabic ? 'سبب العملية' : 'Reason',
    reasonHint: isArabic
      ? 'السبب إلزامي ويجب أن يكون 10 أحرف على الأقل.'
      : 'Reason is required and must be at least 10 characters.',
    cancel: isArabic ? 'إلغاء' : 'Cancel',
    submitRequest: isArabic ? 'تنفيذ تعديل الرصيد' : 'Apply balance adjustment',
    creating: isArabic ? 'جاري تعديل الرصيد...' : 'Applying adjustment...',
    requestCreated: isArabic
      ? 'تم تعديل الرصيد بنجاح.'
      : 'Balance updated successfully.',
    invalidAmount: isArabic
      ? 'أدخل مبلغاً موجباً صالحاً.'
      : 'Enter a valid positive amount.',
    insufficientBalance: isArabic
      ? 'المبلغ المطلوب خصمه أكبر من الرصيد المتاح.'
      : 'The deduction amount is greater than the available balance.',
    reasonTooShort: isArabic
      ? 'السبب يجب أن يكون 10 أحرف على الأقل.'
      : 'Reason must be at least 10 characters.',
    adjustmentFailed: isArabic
      ? 'تعذر تعديل الرصيد.'
      : 'Failed to update the balance.',
    currentBalance: isArabic ? 'الرصيد الحالي' : 'Current balance',
    balanceAfter: isArabic ? 'الرصيد المتوقع بعد العملية' : 'Estimated balance after',

    decisionReason: isArabic ? 'سبب القرار السابق' : 'Legacy decision reason',

    verified: isArabic ? 'حساب موثّق' : 'Verified account',
    activeSessions: isArabic ? 'الجلسات الفعالة' : 'Active sessions',
    resetChallenges: isArabic ? 'طلبات إعادة التعيين' : 'Reset challenges',
    outstandingTokens: isArabic ? 'التوكنات القائمة' : 'Outstanding tokens',
    authVersion: isArabic ? 'إصدار المصادقة' : 'Auth version',

    transactionId: isArabic ? 'رقم الحركة' : 'Transaction ID',
    type: isArabic ? 'النوع' : 'Type',
    createdAt: isArabic ? 'التاريخ' : 'Created at',
    product: isArabic ? 'المنتج' : 'Product',
    finalPrice: isArabic ? 'السعر النهائي' : 'Final price',
    titleField: isArabic ? 'العنوان' : 'Title',
    source: isArabic ? 'المصدر' : 'Source',
    actor: isArabic ? 'المنفذ' : 'Actor',
    command: isArabic ? 'الإجراء' : 'Command',
    details: isArabic ? 'التفاصيل' : 'Details',
    requestedBy: isArabic ? 'منشئ الطلب' : 'Requested by',
    decidedBy: isArabic ? 'صاحب القرار' : 'Decided by',
    requestId: isArabic ? 'رقم الطلب' : 'Request ID',
    yes: isArabic ? 'نعم' : 'Yes',
    no: isArabic ? 'لا' : 'No',
    profitPercentage: isArabic ? 'نسبة الربح' : 'Profit percentage',
    assignedAt: isArabic ? 'تاريخ التعيين' : 'Assigned at',
    assignedBy: isArabic ? 'تم التعيين بواسطة' : 'Assigned by',
    notes: isArabic ? 'الملاحظات' : 'Notes',
  }), [isArabic]);

  const [aggregate, setAggregate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [adjustmentModal, setAdjustmentModal] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    amount: '',
    reason: '',
  });
  const [adjustmentError, setAdjustmentError] = useState('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

  const customer = aggregate?.profile || null;
  const wallets = aggregate?.wallets || [];
  const recentTransactions = aggregate?.recent_transactions || [];
  const purchases = aggregate?.purchases || [];
  const requests = aggregate?.requests || [];
  const shipping = aggregate?.shipping || [];
  const auditHistory = aggregate?.audit_history || [];
  const security = aggregate?.security || {};
  const agent = aggregate?.agent || null;
  const customerCategory = aggregate?.customer_category || null;

  const loadCustomer = useCallback(
    async ({ background = false } = {}) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const response = await axiosInstance.get(
          `/users/admin/customers/${customerId}/`,
          {
            params: {
              limit: 100,
            },
          },
        );

        if (!response.data?.profile) {
          throw new Error(labels.notFound);
        }

        setAggregate(response.data);
      } catch (loadError) {
        const message = getApiError(
          loadError,
          labels.loadFailed,
        );

        if (!background) {
          setAggregate(null);
          setError(message);
        } else {
          setNotice({
            type: 'error',
            message,
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      customerId,
      labels.loadFailed,
      labels.notFound,
    ],
  );

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

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
    (value) => {
      const numeric = Number(value);

      if (!Number.isFinite(numeric)) {
        return value ?? '—';
      }

      return numeric.toLocaleString(
        locale,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        },
      );
    },
    [locale],
  );

  const displayName = (
    customer?.full_name
    || customer?.name
    || (
      isArabic
        ? `العميل #${customerId}`
        : `Customer #${customerId}`
    )
  );

  const initials = useMemo(() => {
    const source = String(displayName || '').trim();

    if (!source) {
      return '#';
    }

    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }, [displayName]);

  const customerStatus = useMemo(() => {
    if (customer?.is_banned) {
      return {
        text: labels.banned,
        className: statusClassName('banned'),
      };
    }

    if (customer?.is_active === false) {
      return {
        text: labels.inactive,
        className: statusClassName('inactive'),
      };
    }

    return {
      text: labels.active,
      className: statusClassName('active'),
    };
  }, [
    customer?.is_active,
    customer?.is_banned,
    labels.active,
    labels.banned,
    labels.inactive,
  ]);

  const basicFields = useMemo(() => ([
    {
      label: labels.id,
      value: customer?.id,
      icon: <FiHash />,
      dir: 'ltr',
    },
    {
      label: labels.username,
      value: customer?.name,
      icon: <FiUser />,
    },
    {
      label: labels.fullName,
      value: customer?.full_name,
      icon: <FiUsers />,
    },
    {
      label: labels.email,
      value: customer?.email,
      icon: <FiMail />,
      dir: 'ltr',
    },
    {
      label: labels.phone,
      value: customer?.phone,
      icon: <FiPhone />,
      dir: 'ltr',
    },
  ]), [
    customer?.email,
    customer?.full_name,
    customer?.id,
    customer?.name,
    customer?.phone,
    labels.email,
    labels.fullName,
    labels.id,
    labels.phone,
    labels.username,
  ]);

  const accountFields = useMemo(() => ([
    {
      label: labels.role,
      value: customer?.role,
      icon: <FiShield />,
    },
    {
      label: labels.joined,
      value: formatDate(customer?.date_joined),
      icon: <FiCalendar />,
    },
    {
      label: labels.lastLogin,
      value: formatDate(customer?.last_login),
      icon: <FiClock />,
    },
    {
      label: labels.assignedAgent,
      value: agent
        ? (
          agent.full_name
          || agent.name
          || `#${agent.id}`
        )
        : '—',
      icon: <FiUser />,
    },
    {
      label: labels.customerCategory,
      value: customerCategory
        ? (
          customerCategory.display_name
          || customerCategory.name
          || `#${customerCategory.id}`
        )
        : '—',
      icon: <FiLayers />,
    },
  ]), [
    agent,
    customer?.date_joined,
    customer?.last_login,
    customer?.role,
    customerCategory,
    formatDate,
    labels.assignedAgent,
    labels.customerCategory,
    labels.joined,
    labels.lastLogin,
    labels.role,
  ]);

  const securityFields = useMemo(() => ([
    {
      label: labels.verified,
      value: security.is_verified === null
        || security.is_verified === undefined
        ? '—'
        : (security.is_verified ? labels.yes : labels.no),
      icon: <FiShield />,
    },
    {
      label: labels.activeSessions,
      value: security.active_login_sessions,
      icon: <FiActivity />,
    },
    {
      label: labels.resetChallenges,
      value: security.reset_challenges,
      icon: <FiKey />,
    },
    {
      label: labels.outstandingTokens,
      value: security.outstanding_tokens,
      icon: <FiKey />,
    },
    {
      label: labels.authVersion,
      value: security.auth_version,
      icon: <FiHash />,
    },
  ]), [
    labels.activeSessions,
    labels.authVersion,
    labels.no,
    labels.outstandingTokens,
    labels.resetChallenges,
    labels.verified,
    labels.yes,
    security.active_login_sessions,
    security.auth_version,
    security.is_verified,
    security.outstanding_tokens,
    security.reset_challenges,
  ]);

  const balanceAdjustments = useMemo(() => {
    const byId = new Map();

    [...auditHistory]
      .reverse()
      .forEach((entry) => {
        if (entry?.action !== 'BALANCE_ADJUSTMENT') {
          return;
        }

        const details = entry?.details || {};
        const adjustmentId = details.adjustment_id;

        if (!adjustmentId) {
          return;
        }

        const key = String(adjustmentId);

        const existing = byId.get(key) || {
          id: adjustmentId,
          status: details.status || 'pending',
        };

        // Old flow: adjustment request
        if (details.command === 'request') {
          existing.amount = details.amount;
          existing.currency = details.currency;
          existing.reason = details.reason;
          existing.status = details.status || 'pending';
          existing.requestedAt = entry.created_at;
          existing.requestedBy = entry.actor_id;
        }

        // New flow: direct balance adjustment
        if (details.command === 'apply') {
          existing.amount = details.amount;
          existing.currency = details.currency;
          existing.reason = details.reason;
          existing.status = details.status || 'approved';
          existing.transactionId = details.transaction_id;

          existing.requestedAt = entry.created_at;
          existing.requestedBy = entry.actor_id;

          existing.decidedAt = entry.created_at;
          existing.decidedBy = entry.actor_id;
        }

        // Old approval flow - kept only for historical records
        if (details.command === 'approve') {
          existing.amount = details.amount ?? existing.amount;
          existing.currency = details.currency ?? existing.currency;
          existing.status = details.status || 'approved';
          existing.transactionId = details.transaction_id;
          existing.decidedAt = entry.created_at;
          existing.decidedBy = entry.actor_id;
        }

        // Old rejection flow - kept only for historical records
        if (details.command === 'reject') {
          existing.status = 'rejected';
          existing.decisionReason = details.reason;
          existing.decidedAt = entry.created_at;
          existing.decidedBy = entry.actor_id;
        }

        byId.set(key, existing);
      });

    return [...byId.values()]
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [auditHistory]);

  const activeWallet = useMemo(() => {
    if (!adjustmentModal) {
      return null;
    }

    return wallets.find(
      (wallet) => (
        String(wallet.currency || '').toUpperCase()
        === adjustmentModal.currency
      ),
    ) || null;
  }, [adjustmentModal, wallets]);

  const estimatedBalance = useMemo(() => {
    if (!adjustmentModal || !activeWallet) {
      return null;
    }

    const current = Number(activeWallet.available || 0);
    const amount = Number(adjustmentForm.amount || 0);

    if (!Number.isFinite(current) || !Number.isFinite(amount)) {
      return null;
    }

    return adjustmentModal.mode === 'debit'
      ? current - amount
      : current + amount;
  }, [
    activeWallet,
    adjustmentForm.amount,
    adjustmentModal,
  ]);

  const closeAdjustmentModal = () => {
    if (submittingAdjustment) {
      return;
    }

    setAdjustmentModal(null);
    setAdjustmentError('');
    setAdjustmentForm({
      amount: '',
      reason: '',
    });
  };

  const openAdjustmentModal = (mode, currency) => {
    setNotice(null);
    setAdjustmentError('');
    setAdjustmentForm({
      amount: '',
      reason: '',
    });
    setAdjustmentModal({
      mode,
      currency,
    });
  };

  const submitAdjustment = async (event) => {
    event.preventDefault();

    if (!adjustmentModal) {
      return;
    }

    const amount = adjustmentForm.amount.trim();
    const reason = adjustmentForm.reason.trim();
    const numericAmount = Number(amount);

    if (!/^\d+(\.\d+)?$/.test(amount) || numericAmount <= 0) {
      setAdjustmentError(labels.invalidAmount);
      return;
    }

    if (
      adjustmentModal.mode === 'debit'
      && activeWallet
      && numericAmount > Number(activeWallet.available || 0)
    ) {
      setAdjustmentError(labels.insufficientBalance);
      return;
    }

    if (reason.length < 10) {
      setAdjustmentError(labels.reasonTooShort);
      return;
    }

    if (adjustmentModal.mode === 'debit') {
      const availableBalance = Number(
        adjustmentModal.currency === 'USD'
          ? agent?.balance_usd
          : agent?.balance_syp,
      );

      if (
        Number.isFinite(availableBalance)
        && amountNumber > availableBalance
      ) {
        setAdjustmentError(
          isArabic
            ? `الرصيد غير كافٍ. الرصيد المتاح: ${formatMoney(
                availableBalance,
                adjustmentModal.currency,
              )}`
            : `Insufficient balance. Available balance: ${formatMoney(
                availableBalance,
                adjustmentModal.currency,
              )}`,
        );

        return;
      }
    }

    const signedAmount = adjustmentModal.mode === 'debit'
      ? `-${amount}`
      : amount;

    setSubmittingAdjustment(true);
    setAdjustmentError('');
    setNotice(null);

    try {
      await axiosInstance.post(
        `/users/admin/customers/${customerId}/balance-adjustments/`,
        {
          amount: signedAmount,
          currency: adjustmentModal.currency,
          reason,
          idempotency_key: createIdempotencyKey(customerId),
        },
      );

      setAdjustmentModal(null);
      setAdjustmentForm({
        amount: '',
        reason: '',
      });

      setNotice({
        type: 'success',
        message: labels.requestCreated,
      });

      await loadCustomer({
        background: true,
      });
    } catch (submitError) {
      setAdjustmentError(
        getApiError(
          submitError,
          labels.adjustmentFailed,
        ),
      );
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  const transactionColumns = useMemo(() => ([
    {
      key: 'id',
      label: labels.transactionId,
      render: (row) => (
        <span className="font-black text-slate-900 dark:text-white">
          #{row.id}
        </span>
      ),
    },
    {
      key: 'type',
      label: labels.type,
    },
    {
      key: 'status',
      label: labels.status,
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: 'amount',
      label: labels.amount,
      render: (row) => (
        <span dir="ltr" className="font-black">
          {formatAmount(row.amount)} {row.currency || ''}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: labels.createdAt,
      render: (row) => formatDate(row.created_at),
    },
  ]), [
    formatAmount,
    formatDate,
    labels.amount,
    labels.createdAt,
    labels.status,
    labels.transactionId,
    labels.type,
  ]);

  const purchaseColumns = useMemo(() => ([
    {
      key: 'id',
      label: labels.id,
      render: (row) => `#${row.id}`,
    },
    {
      key: 'product',
      label: labels.product,
    },
    {
      key: 'status',
      label: labels.status,
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: 'final_price',
      label: labels.finalPrice,
      render: (row) => (
        <span dir="ltr" className="font-black">
          {formatAmount(row.final_price)} {row.currency || ''}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: labels.createdAt,
      render: (row) => formatDate(row.created_at),
    },
  ]), [
    formatAmount,
    formatDate,
    labels.createdAt,
    labels.finalPrice,
    labels.id,
    labels.product,
    labels.status,
  ]);

  const requestColumns = useMemo(() => ([
    {
      key: 'id',
      label: labels.requestId,
      render: (row) => `#${row.id}`,
    },
    {
      key: 'type',
      label: labels.type,
    },
    {
      key: 'title',
      label: labels.titleField,
    },
    {
      key: 'status',
      label: labels.status,
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: 'amount',
      label: labels.amount,
      render: (row) => (
        row.amount === null || row.amount === undefined
          ? '—'
          : (
            <span dir="ltr" className="font-black">
              {formatAmount(row.amount)} {row.currency || ''}
            </span>
          )
      ),
    },
    {
      key: 'created_at',
      label: labels.createdAt,
      render: (row) => formatDate(row.created_at),
    },
  ]), [
    formatAmount,
    formatDate,
    labels.amount,
    labels.createdAt,
    labels.requestId,
    labels.status,
    labels.titleField,
    labels.type,
  ]);

  const shippingColumns = useMemo(() => ([
    {
      key: 'source',
      label: labels.source,
    },
    {
      key: 'id',
      label: labels.id,
      render: (row) => `#${row.id}`,
    },
    {
      key: 'status',
      label: labels.status,
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: 'amount',
      label: labels.amount,
      render: (row) => (
        <span dir="ltr" className="font-black">
          {formatAmount(row.amount)} {row.currency || ''}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: labels.createdAt,
      render: (row) => formatDate(row.created_at),
    },
  ]), [
    formatAmount,
    formatDate,
    labels.amount,
    labels.createdAt,
    labels.id,
    labels.source,
    labels.status,
  ]);

  const auditColumns = useMemo(() => ([
    {
      key: 'action',
      label: labels.type,
    },
    {
      key: 'actor_id',
      label: labels.actor,
      render: (row) => (
        row.actor_id
          ? `#${row.actor_id}`
          : '—'
      ),
    },
    {
      key: 'command',
      label: labels.command,
      render: (row) => row?.details?.command || '—',
    },
    {
      key: 'created_at',
      label: labels.createdAt,
      render: (row) => formatDate(row.created_at),
    },
    {
      key: 'details',
      label: labels.details,
      render: (row) => (
        <details className="min-w-[220px]">
          <summary
            className="flex cursor-pointer list-none items-center gap-1 text-xs font-black"
            style={{ color: accentColor }}
          >
            {labels.details}
            <FiChevronDown />
          </summary>

          <pre
            dir="ltr"
            className="mt-2 max-w-md whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {JSON.stringify(row.details || {}, null, 2)}
          </pre>
        </details>
      ),
    },
  ]), [
    accentColor,
    formatDate,
    labels.actor,
    labels.command,
    labels.createdAt,
    labels.details,
    labels.type,
  ]);

  const tabs = useMemo(() => ([
    {
      id: 'overview',
      label: labels.overviewTab,
      icon: <FiUser />,
    },
    {
      id: 'wallet',
      label: labels.walletTab,
      icon: <FiCreditCard />,
    },
    {
      id: 'activity',
      label: labels.activityTab,
      icon: <FiActivity />,
    },
  ]), [
    labels.activityTab,
    labels.overviewTab,
    labels.walletTab,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm dark:bg-slate-900">
            <FiRefreshCw
              className="animate-spin text-2xl"
              style={{ color: accentColor }}
            />
          </div>
          <span className="text-sm font-bold">
            {labels.loading}
          </span>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        className="mt-20 px-4 md:mt-4 md:px-8 md:py-6"
      >
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <FiAlertCircle className="mx-auto mb-3 text-4xl" />

          <p className="font-black">
            {error || labels.notFound}
          </p>

          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="mt-5 rounded-xl px-5 py-2.5 text-sm font-black text-white"
            style={{ backgroundColor: accentColor }}
          >
            {labels.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        className="mt-20 px-3 py-4 sm:px-5 md:mt-4 md:px-8 md:py-6"
      >
        <div className="mx-auto w-full max-w-7xl space-y-5">
          <section className="relative overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
            <div
              className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full opacity-[0.08]"
              style={{ backgroundColor: accentColor }}
            />

            <div
              className="pointer-events-none absolute -start-16 bottom-[-90px] h-52 w-52 rounded-full opacity-[0.035]"
              style={{ backgroundColor: accentColor }}
            />

            <div className="relative z-10 p-5 md:p-7">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] text-2xl font-black text-white shadow-lg ring-4 ring-white dark:ring-slate-900 md:h-24 md:w-24 md:text-3xl"
                    style={{ backgroundColor: accentColor }}
                  >
                    {initials}
                  </div>

                  <div className="min-w-0 text-start">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className="text-xs font-black md:text-sm"
                        style={{ color: accentColor }}
                      >
                        {labels.category}
                      </span>

                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${customerStatus.className}`}>
                        {customerStatus.text}
                      </span>

                      {customer.role && (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-900/50">
                          {customer.role}
                        </span>
                      )}
                    </div>

                    <h1 className="truncate text-2xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">
                      {displayName}
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5" dir="ltr">
                        <FiHash />
                        {customer.id}
                      </span>

                      {customer.email && (
                        <span className="inline-flex min-w-0 items-center gap-1.5" dir="ltr">
                          <FiMail className="shrink-0" />
                          <span className="truncate">
                            {customer.email}
                          </span>
                        </span>
                      )}

                      {customer.phone && (
                        <span className="inline-flex items-center gap-1.5" dir="ltr">
                          <FiPhone />
                          {customer.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row xl:shrink-0">
                  <button
                    type="button"
                    disabled={refreshing}
                    onClick={() => loadCustomer({ background: true })}
                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: accentColor }}
                  >
                    <FiRefreshCw
                      className={refreshing ? 'animate-spin' : ''}
                    />
                    {labels.refresh}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/customers')}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {isArabic
                      ? <FiArrowRight />
                      : <FiArrowLeft />}
                    {labels.back}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <MiniStat
                  label={labels.walletCount}
                  value={wallets.length}
                  icon={<FiCreditCard />}
                  accentColor={accentColor}
                />

                <MiniStat
                  label={labels.transactionCount}
                  value={recentTransactions.length}
                  icon={<FiActivity />}
                  accentColor={accentColor}
                />

                <MiniStat
                  label={labels.requestCount}
                  value={requests.length}
                  icon={<FiClipboard />}
                  accentColor={accentColor}
                />
              </div>
            </div>
          </section>

          {notice && (
            <div
              className={`
                flex items-start gap-3 rounded-2xl border p-4 text-sm font-black shadow-sm
                ${
                  notice.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
                }
              `}
            >
              {notice.type === 'success'
                ? <FiCheck className="mt-0.5 shrink-0" />
                : <FiAlertCircle className="mt-0.5 shrink-0" />}

              <span className="flex-1">
                {notice.message}
              </span>

              <button
                type="button"
                onClick={() => setNotice(null)}
                className="shrink-0"
              >
                <FiX />
              </button>
            </div>
          )}

          <div className="sticky top-2 z-20 rounded-2xl border border-slate-100 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
            <div className="grid grid-cols-3 gap-2">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black transition sm:text-sm
                      ${
                        active
                          ? 'text-white shadow-sm'
                          : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                      }
                    `}
                    style={active
                      ? { backgroundColor: accentColor }
                      : undefined}
                  >
                    {tab.icon}
                    <span className="truncate">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-5">
              <Panel
                title={labels.basic}
                subtitle={isArabic
                  ? 'البيانات التعريفية الأساسية للعميل'
                  : 'Primary customer identity information'}
                icon={<FiUser />}
                accentColor={accentColor}
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {basicFields.map((field) => (
                    <InfoCard
                      key={field.label}
                      {...field}
                      accentColor={accentColor}
                    />
                  ))}
                </div>
              </Panel>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel
                  title={labels.account}
                  subtitle={isArabic
                    ? 'الدور، الوكيل، الفئة، ومعلومات التسجيل'
                    : 'Role, agent, category and account dates'}
                  icon={<FiLayers />}
                  accentColor={accentColor}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {accountFields.map((field) => (
                      <InfoCard
                        key={field.label}
                        {...field}
                        accentColor={accentColor}
                      />
                    ))}
                  </div>

                  {customerCategory && (
                    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.profitPercentage}
                          </p>
                          <p className="mt-1 font-black text-slate-900 dark:text-white">
                            {customerCategory.profit_percentage ?? '—'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.assignedAt}
                          </p>
                          <p className="mt-1 font-black text-slate-900 dark:text-white">
                            {formatDate(customerCategory.assigned_at)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.assignedBy}
                          </p>
                          <p className="mt-1 font-black text-slate-900 dark:text-white">
                            {customerCategory.assigned_by
                              ? `#${customerCategory.assigned_by}`
                              : '—'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.notes}
                          </p>
                          <p className="mt-1 break-words font-black text-slate-900 dark:text-white">
                            {customerCategory.notes || '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </Panel>

                <Panel
                  title={labels.security}
                  subtitle={isArabic
                    ? 'ملخص أمان الحساب والجلسات الحالية'
                    : 'Account security and current session summary'}
                  icon={<FiShield />}
                  accentColor={accentColor}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {securityFields.map((field) => (
                      <InfoCard
                        key={field.label}
                        {...field}
                        accentColor={accentColor}
                      />
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-5">
              <Panel
                title={labels.balances}
                subtitle={labels.adjustmentNote}
                icon={<FiDollarSign />}
                accentColor={accentColor}
              >
                {!wallets.length ? (
                  <EmptyState
                    text={labels.noData}
                    icon={<FiCreditCard />}
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {wallets.map((wallet) => {
                      const currency = String(wallet.currency || '').toUpperCase();
                      const canAdjust = adjustmentCurrencies.has(currency);

                      return (
                        <div
                          key={wallet.id}
                          className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-slate-50/80 p-5 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900"
                        >
                          <div
                            className="pointer-events-none absolute -end-8 -top-8 h-28 w-28 rounded-full opacity-[0.07]"
                            style={{ backgroundColor: accentColor }}
                          />

                          <div className="relative z-10">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black"
                                    style={{
                                      backgroundColor: `${accentColor}14`,
                                      color: accentColor,
                                    }}
                                  >
                                    {currency === 'USD' ? '$' : 'SYP'}
                                  </span>

                                  <div>
                                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                                      {currency}
                                    </p>
                                    <p className="mt-0.5 text-xs font-semibold text-slate-400">
                                      {labels.walletNumber} #{wallet.id}
                                    </p>
                                  </div>
                                </div>

                                <p
                                  dir="ltr"
                                  className="mt-5 text-3xl font-black tracking-tight text-slate-950 dark:text-white"
                                >
                                  {formatAmount(wallet.available)}
                                </p>

                                <p className="mt-1 text-xs font-bold text-slate-400">
                                  {labels.available}
                                </p>
                              </div>

                              <div
                                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-sm dark:bg-slate-800"
                                style={{ color: accentColor }}
                              >
                                <FiCreditCard />
                              </div>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3">
                              <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                                <p className="text-xs font-bold text-slate-400">
                                  {labels.pending}
                                </p>
                                <p dir="ltr" className="mt-1 font-black text-slate-900 dark:text-white">
                                  {formatAmount(wallet.pending)}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                                <p className="text-xs font-bold text-slate-400">
                                  {labels.total}
                                </p>
                                <p dir="ltr" className="mt-1 font-black text-slate-900 dark:text-white">
                                  {formatAmount(wallet.total)}
                                </p>
                              </div>
                            </div>

                            {canAdjust && (
                              <div className="mt-5 grid grid-cols-2 gap-3">
                                <button
                                  type="button"
                                  onClick={() => openAdjustmentModal('credit', currency)}
                                  className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black text-white shadow-sm transition hover:opacity-90"
                                  style={{ backgroundColor: accentColor }}
                                >
                                  <FiPlus />
                                  {labels.addBalance}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openAdjustmentModal('debit', currency)}
                                  className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                                >
                                  <FiMinus />
                                  {labels.deductBalance}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel
                title={labels.adjustments}
                subtitle={labels.recentAdjustmentNote}
                icon={<FiActivity />}
                accentColor={accentColor}
              >
                {!balanceAdjustments.length ? (
                  <EmptyState
                    text={labels.noData}
                    icon={<FiActivity />}
                  />
                ) : (
                  <div className="space-y-3">
                    {balanceAdjustments.map((adjustment) => (
                      <div
                        key={adjustment.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                            <div>
                              <p className="text-xs font-extrabold text-slate-400">
                                {labels.requestId}
                              </p>
                              <p className="mt-1 font-black text-slate-900 dark:text-white">
                                #{adjustment.id}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-extrabold text-slate-400">
                                {labels.amount}
                              </p>
                              <p dir="ltr" className="mt-1 font-black text-slate-900 dark:text-white">
                                {adjustment.amount !== undefined
                                  ? `${formatAmount(adjustment.amount)} ${adjustment.currency || ''}`
                                  : '—'}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-extrabold text-slate-400">
                                {labels.status}
                              </p>
                              <div className="mt-1">
                                <StatusBadge value={adjustment.status} />
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-extrabold text-slate-400">
                                {labels.requestedBy}
                              </p>
                              <p className="mt-1 font-black text-slate-900 dark:text-white">
                                {adjustment.requestedBy
                                  ? `#${adjustment.requestedBy}`
                                  : '—'}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-extrabold text-slate-400">
                                {labels.createdAt}
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                                {formatDate(
                                  adjustment.requestedAt
                                  || adjustment.decidedAt,
                                )}
                              </p>
                            </div>
                          </div>

                        </div>

                        {(adjustment.reason
                          || adjustment.decisionReason
                          || adjustment.transactionId
                          || adjustment.decidedBy) && (
                          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-700 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <span className="text-xs font-extrabold text-slate-400">
                                {labels.reason}
                              </span>
                              <p className="mt-1 break-words font-semibold text-slate-700 dark:text-slate-200">
                                {adjustment.reason || '—'}
                              </p>
                            </div>

                            <div>
                              <span className="text-xs font-extrabold text-slate-400">
                                {labels.decisionReason}
                              </span>
                              <p className="mt-1 break-words font-semibold text-slate-700 dark:text-slate-200">
                                {adjustment.decisionReason || '—'}
                              </p>
                            </div>

                            <div>
                              <span className="text-xs font-extrabold text-slate-400">
                                {labels.decidedBy}
                              </span>
                              <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
                                {adjustment.decidedBy
                                  ? `#${adjustment.decidedBy}`
                                  : '—'}
                              </p>
                            </div>

                            <div>
                              <span className="text-xs font-extrabold text-slate-400">
                                {labels.transactionId}
                              </span>
                              <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
                                {adjustment.transactionId
                                  ? `#${adjustment.transactionId}`
                                  : '—'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-5">
              <Panel
                title={labels.transactions}
                subtitle={isArabic
                  ? 'آخر الحركات المالية المسجلة على حساب العميل'
                  : 'Latest financial movements on this customer account'}
                icon={<FiActivity />}
                accentColor={accentColor}
              >
                <DataTable
                  rows={recentTransactions}
                  columns={transactionColumns}
                  emptyText={labels.noData}
                  emptyIcon={<FiActivity />}
                />
              </Panel>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel
                  title={labels.purchases}
                  icon={<FiShoppingBag />}
                  accentColor={accentColor}
                >
                  <DataTable
                    rows={purchases}
                    columns={purchaseColumns}
                    emptyText={labels.noData}
                    emptyIcon={<FiShoppingBag />}
                  />
                </Panel>

                <Panel
                  title={labels.requests}
                  icon={<FiClipboard />}
                  accentColor={accentColor}
                >
                  <DataTable
                    rows={requests}
                    columns={requestColumns}
                    emptyText={labels.noData}
                    emptyIcon={<FiClipboard />}
                  />
                </Panel>
              </div>

              <Panel
                title={labels.shipping}
                icon={<FiTruck />}
                accentColor={accentColor}
              >
                <DataTable
                  rows={shipping}
                  columns={shippingColumns}
                  emptyText={labels.noData}
                  emptyIcon={<FiTruck />}
                />
              </Panel>

              <Panel
                title={labels.audit}
                subtitle={isArabic
                  ? 'سجل العمليات الإدارية والتغييرات المرتبطة بهذا العميل'
                  : 'Administrative actions and changes associated with this customer'}
                icon={<FiShield />}
                accentColor={accentColor}
              >
                <DataTable
                  rows={auditHistory}
                  columns={auditColumns}
                  emptyText={labels.noData}
                  emptyIcon={<FiShield />}
                />
              </Panel>
            </div>
          )}
        </div>
      </div>

      <ModalShell
        open={Boolean(adjustmentModal)}
        busy={submittingAdjustment}
        onClose={closeAdjustmentModal}
        accentColor={adjustmentModal?.mode === 'debit'
          ? '#dc2626'
          : accentColor}
        icon={adjustmentModal?.mode === 'debit'
          ? <FiMinus />
          : <FiPlus />}
        title={adjustmentModal?.mode === 'debit'
          ? labels.deductBalance
          : labels.addBalance}
        subtitle={adjustmentModal
          ? `${adjustmentModal.currency} · ${displayName}`
          : ''}
      >
        <form onSubmit={submitAdjustment}>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-xs font-extrabold text-slate-400">
                {labels.currentBalance}
              </p>
              <p dir="ltr" className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                {formatAmount(activeWallet?.available || 0)} {adjustmentModal?.currency || ''}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-xs font-extrabold text-slate-400">
                {labels.balanceAfter}
              </p>
              <p
                dir="ltr"
                className={`
                  mt-2 text-lg font-black
                  ${
                    estimatedBalance !== null && estimatedBalance < 0
                      ? 'text-red-600 dark:text-red-300'
                      : 'text-slate-900 dark:text-white'
                  }
                `}
              >
                {estimatedBalance === null
                  ? '—'
                  : `${formatAmount(estimatedBalance)} ${adjustmentModal?.currency || ''}`}
              </p>
            </div>
          </div>

          {adjustmentError && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              {adjustmentError}
            </div>
          )}

          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
              {labels.amount}
            </span>

            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={adjustmentForm.amount}
                onChange={(event) => setAdjustmentForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pe-20 font-black text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
                dir="ltr"
                placeholder="0.00"
                required
              />

              <span className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {adjustmentModal?.currency}
              </span>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
              {labels.reason}
            </span>

            <textarea
              rows={4}
              value={adjustmentForm.reason}
              onChange={(event) => setAdjustmentForm((current) => ({
                ...current,
                reason: event.target.value,
              }))}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              required
            />

            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span
                className={`
                  text-xs font-semibold
                  ${
                    adjustmentForm.reason.trim().length > 0
                    && adjustmentForm.reason.trim().length < 10
                      ? 'text-red-500'
                      : 'text-slate-400'
                  }
                `}
              >
                {labels.reasonHint}
              </span>

              <span className="shrink-0 text-xs font-black text-slate-400">
                {adjustmentForm.reason.trim().length}/10+
              </span>
            </div>
          </label>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeAdjustmentModal}
              disabled={submittingAdjustment}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {labels.cancel}
            </button>

            <button
              type="submit"
              disabled={submittingAdjustment}
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor: adjustmentModal?.mode === 'debit'
                  ? '#dc2626'
                  : accentColor,
              }}
            >
              {submittingAdjustment
                ? <FiRefreshCw className="animate-spin" />
                : (
                  adjustmentModal?.mode === 'debit'
                    ? <FiMinus />
                    : <FiPlus />
                )}

              {submittingAdjustment
                ? labels.creating
                : labels.submitRequest}
            </button>
          </div>
        </form>
      </ModalShell>

    </>
  );
};

export default CustomerDetails;