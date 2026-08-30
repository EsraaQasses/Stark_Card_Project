import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { useTranslation } from 'react-i18next';

import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCreditCard,
  FiDollarSign,
  FiEdit3,
  FiHash,
  FiMapPin,
  FiMinus,
  FiPercent,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiShoppingBag,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

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
    return 'AG';
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

const createIdempotencyKey = (agentId) => {
  const randomPart = (
    typeof crypto !== 'undefined'
    && typeof crypto.randomUUID === 'function'
  )
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

  return `agent-balance-${agentId}-${randomPart}`;
};

const ModalShell = ({
  open,
  title,
  children,
  onClose,
  busy,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div
          className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"
        >
          <h3
            className="text-lg font-black text-slate-900 dark:text-white"
          >
            {title}
          </h3>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <FiX />
          </button>
        </div>

        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({
  icon,
  label,
  value,
  accentColor,
  dir,
}) => (
  <div
    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40"
  >
    <div
      className="mb-3 flex items-center gap-2"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `${accentColor}14`,
          color: accentColor,
        }}
      >
        {icon}
      </div>

      <span
        className="text-xs font-bold text-slate-400"
      >
        {label}
      </span>
    </div>

    <p
      dir={dir}
      className="break-words text-base font-black text-slate-900 dark:text-white"
    >
      {value === null
        || value === undefined
        || value === ''
        ? '—'
        : String(value)}
    </p>
  </div>
);

const BalanceCard = ({
  label,
  value,
  accentColor,
  addLabel,
  deductLabel,
  onAdd,
  onDeduct,
  busy,
}) => (
  <div
    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40"
  >
    <div
      className="mb-3 flex items-center gap-2"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `${accentColor}14`,
          color: accentColor,
        }}
      >
        <FiDollarSign />
      </div>

      <span
        className="text-xs font-bold text-slate-400"
      >
        {label}
      </span>
    </div>

    <p
      dir="ltr"
      className="break-words text-base font-black text-slate-900 dark:text-white"
    >
      {value}
    </p>

    <div
      className="mt-4 grid grid-cols-2 gap-2"
    >
      <button
        type="button"
        disabled={busy}
        onClick={onAdd}
        className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          backgroundColor: accentColor,
        }}
      >
        <FiPlus />
        {addLabel}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={onDeduct}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
      >
        <FiMinus />
        {deductLabel}
      </button>
    </div>
  </div>
);

const AgentDetails = () => {
  const {
    agentId,
  } = useParams();

  const location = useLocation();
  const navigate = useNavigate();

  const {
    i18n,
  } = useTranslation();

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

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    category: isArabic
      ? 'إدارة الوكلاء'
      : 'Agent Management',

    back: isArabic
      ? 'العودة للوكلاء'
      : 'Back to agents',

    refresh: isArabic
      ? 'تحديث البيانات'
      : 'Refresh',

    overview: isArabic
      ? 'نظرة عامة'
      : 'Overview',

    financial: isArabic
      ? 'المالية والعمولة'
      : 'Finance & Commission',

    clients: isArabic
      ? 'عملاء الوكيل'
      : 'Agent Customers',

    accountInfo: isArabic
      ? 'معلومات الوكيل'
      : 'Agent Information',

    categoryInfo: isArabic
      ? 'فئة الوكيل'
      : 'Agent Category',

    categorySubtitle: isArabic
      ? 'يمكنك تغيير فئة الوكيل من الفئات الفعالة المتوفرة في النظام.'
      : 'Change the agent category using the active categories available in the system.',

    chooseCategory: isArabic
      ? 'اختر الفئة'
      : 'Choose category',

    defaultCategory: isArabic
      ? 'استخدام الفئة الافتراضية'
      : 'Use default category',

    saveCategory: isArabic
      ? 'حفظ الفئة'
      : 'Save category',

    savingCategory: isArabic
      ? 'جاري حفظ الفئة...'
      : 'Saving category...',

    categoryUpdated: isArabic
      ? 'تم تغيير فئة الوكيل بنجاح.'
      : 'Agent category updated successfully.',

    categoryUpdateFailed: isArabic
      ? 'تعذر تغيير فئة الوكيل.'
      : 'Failed to update agent category.',

    categoriesLoadFailed: isArabic
      ? 'تعذر تحميل الفئات المتوفرة.'
      : 'Failed to load available categories.',

    noAvailableCategories: isArabic
      ? 'لا توجد فئات فعالة متوفرة حالياً.'
      : 'No active categories are currently available.',

    noCategory: isArabic
      ? 'لا توجد فئة مخصصة لهذا الوكيل.'
      : 'No category is assigned to this agent.',

    id: isArabic
      ? 'رقم الوكيل'
      : 'Agent ID',

    username: isArabic
      ? 'اسم المستخدم'
      : 'Username',

    agentCode: isArabic
      ? 'كود الوكيل'
      : 'Agent code',

    region: isArabic
      ? 'المنطقة'
      : 'Region',

    clientsCount: isArabic
      ? 'عدد العملاء'
      : 'Customers',

    productsCount: isArabic
      ? 'المنتجات المخصصة'
      : 'Assigned products',

    commission: isArabic
      ? 'نسبة العمولة'
      : 'Commission rate',

    balanceUsd: isArabic
      ? 'رصيد USD'
      : 'USD balance',

    balanceSyp: isArabic
      ? 'رصيد SYP'
      : 'SYP balance',

    totalBalance: isArabic
      ? 'إجمالي الرصيد'
      : 'Total balance',

    earningsUsd: isArabic
      ? 'إجمالي أرباح USD'
      : 'USD earnings',

    earningsSyp: isArabic
      ? 'إجمالي أرباح SYP'
      : 'SYP earnings',

    coverageUsd: isArabic
      ? 'حد التغطية USD'
      : 'USD credit limit',

    coverageSyp: isArabic
      ? 'حد التغطية SYP'
      : 'SYP credit limit',

    editCommission: isArabic
      ? 'تعديل العمولة'
      : 'Edit commission',

    editLimits: isArabic
      ? 'تعديل حدود التغطية'
      : 'Edit credit limits',

    demote: isArabic
      ? 'تحويل لمستخدم عادي'
      : 'Demote to user',

    demoteConfirm: isArabic
      ? 'هل أنت متأكد من تحويل هذا الوكيل إلى مستخدم عادي؟'
      : 'Are you sure you want to demote this agent to a regular user?',

    demoteSuccess: isArabic
      ? 'تم تحويل الوكيل إلى مستخدم عادي.'
      : 'Agent was demoted to a regular user.',

    demoteFailed: isArabic
      ? 'تعذر تحويل الوكيل إلى مستخدم عادي.'
      : 'Failed to demote the agent.',

    loading: isArabic
      ? 'جاري تحميل بيانات الوكيل...'
      : 'Loading agent details...',

    loadFailed: isArabic
      ? 'تعذر تحميل بيانات الوكيل.'
      : 'Failed to load agent details.',

    notFound: isArabic
      ? 'لم يتم العثور على الوكيل.'
      : 'Agent not found.',

    noClients: isArabic
      ? 'لا يوجد عملاء مرتبطون بهذا الوكيل.'
      : 'No customers are linked to this agent.',

    client: isArabic
      ? 'العميل'
      : 'Customer',

    status: isArabic
      ? 'الحالة'
      : 'Status',

    active: isArabic
      ? 'نشط'
      : 'Active',

    inactive: isArabic
      ? 'غير نشط'
      : 'Inactive',

    banned: isArabic
      ? 'محظور'
      : 'Banned',

    openCustomer: isArabic
      ? 'فتح العميل'
      : 'Open customer',

    commissionModal: isArabic
      ? 'تعديل عمولة الوكيل'
      : 'Edit agent commission',

    commissionHint: isArabic
      ? 'يجب أن تكون النسبة أكبر أو تساوي 0 وأقل من 100.'
      : 'Commission must be greater than or equal to 0 and less than 100.',

    limitsModal: isArabic
      ? 'تعديل حدود التغطية'
      : 'Edit credit limits',

    save: isArabic
      ? 'حفظ التعديلات'
      : 'Save changes',

    saving: isArabic
      ? 'جاري الحفظ...'
      : 'Saving...',

    cancel: isArabic
      ? 'إلغاء'
      : 'Cancel',

    success: isArabic
      ? 'تم حفظ التعديلات بنجاح.'
      : 'Changes saved successfully.',

    saveFailed: isArabic
      ? 'تعذر حفظ التعديلات.'
      : 'Failed to save changes.',

    categoryName: isArabic
      ? 'اسم الفئة'
      : 'Category name',

    profitPercentage: isArabic
      ? 'نسبة الربح'
      : 'Profit percentage',

    description: isArabic
      ? 'الوصف'
      : 'Description',

    addBalance: isArabic
      ? 'إضافة رصيد'
      : 'Add balance',

    deductBalance: isArabic
      ? 'خصم رصيد'
      : 'Deduct balance',

    balanceAdjustment: isArabic
      ? 'تعديل رصيد الوكيل'
      : 'Adjust agent balance',

    adjustmentAmount: isArabic
      ? 'المبلغ'
      : 'Amount',

    adjustmentCurrency: isArabic
      ? 'العملة'
      : 'Currency',

    adjustmentReason: isArabic
      ? 'سبب التعديل'
      : 'Adjustment reason',

    adjustmentReasonHint: isArabic
      ? 'يجب كتابة سبب واضح لا يقل عن 10 أحرف.'
      : 'Enter a clear reason of at least 10 characters.',

    executingAdjustment: isArabic
      ? 'جاري تعديل الرصيد...'
      : 'Applying balance adjustment...',

    adjustmentCreditSuccess: isArabic
      ? 'تمت إضافة الرصيد للوكيل بنجاح.'
      : 'Balance was added to the agent successfully.',

    adjustmentDebitSuccess: isArabic
      ? 'تم خصم الرصيد من الوكيل بنجاح.'
      : 'Balance was deducted from the agent successfully.',

    adjustmentFailed: isArabic
      ? 'تعذر تعديل رصيد الوكيل.'
      : 'Failed to adjust agent balance.',

    invalidAdjustmentAmount: isArabic
      ? 'أدخل مبلغاً أكبر من الصفر.'
      : 'Enter an amount greater than zero.',

    invalidAdjustmentReason: isArabic
      ? 'سبب التعديل يجب أن يكون 10 أحرف على الأقل.'
      : 'Adjustment reason must be at least 10 characters.',

    creditOperation: isArabic
      ? 'إضافة'
      : 'Credit',

    debitOperation: isArabic
      ? 'خصم'
      : 'Debit',

    currentBalance: isArabic
      ? 'الرصيد الحالي'
      : 'Current balance',

    categoryStatus: isArabic
      ? 'حالة الفئة'
      : 'Category status',
  }), [isArabic]);

  const [agent, setAgent] = useState(
    location.state?.agent || null,
  );

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(
    !location.state?.agent,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [commissionOpen, setCommissionOpen] = useState(false);
  const [commissionRate, setCommissionRate] = useState('');
  const [commissionError, setCommissionError] = useState('');
  const [savingCommission, setSavingCommission] = useState(false);

  const [limitsOpen, setLimitsOpen] = useState(false);
  const [coverageUsd, setCoverageUsd] = useState('');
  const [coverageSyp, setCoverageSyp] = useState('');
  const [limitsError, setLimitsError] = useState('');
  const [savingLimits, setSavingLimits] = useState(false);

  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [initialCategoryId, setInitialCategoryId] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const [demoting, setDemoting] = useState(false);

  const [adjustmentModal, setAdjustmentModal] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentError, setAdjustmentError] = useState('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);
  const [
    adjustmentIdempotencyKey,
    setAdjustmentIdempotencyKey,
  ] = useState('');

  const loadAgent = useCallback(
    async ({ background = false } = {}) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const [
          agentsResponse,
          clientsResponse,
          categoriesResponse,
        ] = await Promise.all([
          axiosInstance.get(
            '/agents/agents/',
          ),
          axiosInstance.get(
            `/agents/${agentId}/users/`,
          ),
          axiosInstance.get(
            '/users/categories/active_categories/',
          ),
        ]);

        const agents = normalizeList(
          agentsResponse.data,
        );

        const found = agents.find(
          (item) => (
            String(item.id)
            === String(agentId)
          ),
        );

        if (!found) {
          throw new Error(
            labels.notFound,
          );
        }

        setAgent(found);

        setClients(
          normalizeList(
            clientsResponse.data,
          ),
        );

        const availableCategories = normalizeList(
          categoriesResponse.data,
        );

        const assignedCategory = (
          found?.category_details
          || found?.category
          || null
        );

        const hasAssignedCategory = Boolean(
          found?.has_assigned_category
          && assignedCategory?.id != null,
        );

        const categoryOptions = [...availableCategories];

        // active_categories only returns active categories.
        // Keep the currently assigned category visible even if it is inactive,
        // otherwise a controlled <select> falls back visually to its first option.
        if (
          hasAssignedCategory
          && !categoryOptions.some(
            (item) => String(item.id) === String(assignedCategory.id),
          )
        ) {
          categoryOptions.unshift({
            ...assignedCategory,
            is_current_assignment: true,
          });
        }

        setCategories(categoryOptions);

        const effectiveCategoryId = hasAssignedCategory
          ? String(assignedCategory.id)
          : String(
            availableCategories.find((item) => item.is_default)?.id
            || '',
          );

        setSelectedCategoryId(effectiveCategoryId);
        setInitialCategoryId(effectiveCategoryId);
        setCategoryError('');
      } catch (loadError) {
        console.error(
          'Error loading agent:',
          loadError,
        );

        const message = getApiError(
          loadError,
          loadError?.message
          || labels.loadFailed,
        );

        if (!background) {
          setAgent(null);
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
      agentId,
      labels.loadFailed,
      labels.notFound,
    ],
  );

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  const formatNumber = useCallback(
    (
      value,
      options = {},
    ) => {
      const numeric = Number(value);

      if (!Number.isFinite(numeric)) {
        return '0';
      }

      return numeric.toLocaleString(
        locale,
        options,
      );
    },
    [locale],
  );

  const formatMoney = useCallback(
    (
      value,
      currency,
    ) => {
      const numeric = Number(value);

      if (!Number.isFinite(numeric)) {
        return `0.00 ${currency}`;
      }

      return `${numeric.toLocaleString(
        locale,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      )} ${currency}`;
    },
    [locale],
  );

  const openAdjustment = (
    mode,
    currency,
  ) => {
    setAdjustmentModal({
      mode,
      currency,
    });

    setAdjustmentAmount('');
    setAdjustmentReason('');
    setAdjustmentError('');

    setAdjustmentIdempotencyKey(
      createIdempotencyKey(agentId),
    );
  };

  const closeAdjustment = () => {
    if (submittingAdjustment) {
      return;
    }

    setAdjustmentModal(null);
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setAdjustmentError('');
    setAdjustmentIdempotencyKey('');
  };

  const submitAdjustment = async (event) => {
    event.preventDefault();

    if (!adjustmentModal) {
      return;
    }

    const amountText = String(
      adjustmentAmount,
    ).trim();

    const amountNumber = Number(
      amountText,
    );

    const reason = adjustmentReason.trim();

    if (
      !Number.isFinite(amountNumber)
      || amountNumber <= 0
    ) {
      setAdjustmentError(
        labels.invalidAdjustmentAmount,
      );
      return;
    }

    if (reason.length < 10) {
      setAdjustmentError(
        labels.invalidAdjustmentReason,
      );
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
    const signedAmount = (
      adjustmentModal.mode === 'debit'
        ? `-${amountText}`
        : amountText
    );

    setSubmittingAdjustment(true);
    setAdjustmentError('');
    setNotice(null);

    try {
      await axiosInstance.post(
        `/users/admin/customers/${agentId}/balance-adjustments/`,
        {
          amount: signedAmount,
          currency: adjustmentModal.currency,
          reason,
          idempotency_key: (
            adjustmentIdempotencyKey
            || createIdempotencyKey(agentId)
          ),
        },
      );

      const successMessage = (
        adjustmentModal.mode === 'debit'
          ? labels.adjustmentDebitSuccess
          : labels.adjustmentCreditSuccess
      );

      setAdjustmentModal(null);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      setAdjustmentError('');
      setAdjustmentIdempotencyKey('');

      setNotice({
        type: 'success',
        message: successMessage,
      });

      await loadAgent({
        background: true,
      });
    } catch (requestError) {
      console.error(
        'Error adjusting agent balance:',
        requestError,
      );

      setAdjustmentError(
        getApiError(
          requestError,
          labels.adjustmentFailed,
        ),
      );
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  const openCommission = () => {
    setCommissionError('');
    setCommissionRate(
      String(
        agent?.commission_rate ?? 0,
      ),
    );
    setCommissionOpen(true);
  };

  const saveCommission = async (event) => {
    event.preventDefault();

    const rate = Number(
      commissionRate,
    );

    if (
      !Number.isFinite(rate)
      || rate < 0
      || rate >= 100
    ) {
      setCommissionError(
        labels.commissionHint,
      );
      return;
    }

    setSavingCommission(true);
    setCommissionError('');

    try {
      await axiosInstance.post(
        `/agents/agent/${agentId}/commission/`,
        {
          commission_rate: rate,
        },
      );

      setCommissionOpen(false);

      setNotice({
        type: 'success',
        message: labels.success,
      });

      await loadAgent({
        background: true,
      });
    } catch (saveError) {
      setCommissionError(
        getApiError(
          saveError,
          labels.saveFailed,
        ),
      );
    } finally {
      setSavingCommission(false);
    }
  };

  const openLimits = () => {
    setLimitsError('');

    setCoverageUsd(
      String(
        agent?.coverage_limit_usd ?? 0,
      ),
    );

    setCoverageSyp(
      String(
        agent?.coverage_limit_syp ?? 0,
      ),
    );

    setLimitsOpen(true);
  };

  const saveLimits = async (event) => {
    event.preventDefault();

    const usd = Number(
      coverageUsd,
    );

    const syp = Number(
      coverageSyp,
    );

    if (
      !Number.isFinite(usd)
      || usd < 0
      || !Number.isFinite(syp)
      || syp < 0
    ) {
      setLimitsError(
        isArabic
          ? 'يجب أن تكون حدود التغطية أرقاماً صحيحة أكبر أو تساوي الصفر.'
          : 'Credit limits must be valid numbers greater than or equal to zero.',
      );
      return;
    }

    setSavingLimits(true);
    setLimitsError('');

    try {
      await axiosInstance.post(
        `/agents/agent/${agentId}/credit-limit/`,
        {
          coverage_limit_usd: usd,
          coverage_limit_syp: syp,
        },
      );

      setLimitsOpen(false);

      setNotice({
        type: 'success',
        message: labels.success,
      });

      await loadAgent({
        background: true,
      });
    } catch (saveError) {
      setLimitsError(
        getApiError(
          saveError,
          labels.saveFailed,
        ),
      );
    } finally {
      setSavingLimits(false);
    }
  };

  const saveCategory = async () => {
    if (!selectedCategoryId) {
      setCategoryError(
        isArabic
          ? 'اختر فئة للوكيل أولاً.'
          : 'Choose a category for the agent first.',
      );
      return;
    }

    if (selectedCategoryId === initialCategoryId) {
      return;
    }

    setSavingCategory(true);
    setCategoryError('');
    setNotice(null);

    try {
      await axiosInstance.post(
        '/users/assign-category/',
        {
          user_id: Number(agentId),
          category_id: Number(selectedCategoryId),
          notes: 'Changed from agent details',
        },
      );

      setNotice({
        type: 'success',
        message: labels.categoryUpdated,
      });

      await loadAgent({
        background: true,
      });
    } catch (saveError) {
      const message = getApiError(
        saveError,
        labels.categoryUpdateFailed,
      );

      setCategoryError(message);

      setNotice({
        type: 'error',
        message,
      });
    } finally {
      setSavingCategory(false);
    }
  };

  const demoteAgent = async () => {
    if (
      !window.confirm(
        labels.demoteConfirm,
      )
    ) {
      return;
    }

    setDemoting(true);
    setNotice(null);

    try {
      await axiosInstance.post(
        `/agents/demote-to-user/${agentId}/`,
      );

      setNotice({
        type: 'success',
        message: labels.demoteSuccess,
      });

      setTimeout(() => {
        navigate('/agents');
      }, 700);
    } catch (demoteError) {
      setNotice({
        type: 'error',
        message: getApiError(
          demoteError,
          labels.demoteFailed,
        ),
      });
    } finally {
      setDemoting(false);
    }
  };

  const displayName = (
    agent?.full_name
    || agent?.username
    || (
      isArabic
        ? `الوكيل #${agentId}`
        : `Agent #${agentId}`
    )
  );

  const category = (
    agent?.category_details
    || agent?.category
    || null
  );

  const tabs = [
    {
      id: 'overview',
      label: labels.overview,
      icon: <FiUser />,
    },
    {
      id: 'financial',
      label: labels.financial,
      icon: <FiDollarSign />,
    },
    {
      id: 'clients',
      label: labels.clients,
      icon: <FiUsers />,
    },
  ];

  if (loading) {
    return (
      <div
        className="flex min-h-[500px] items-center justify-center"
      >
        <div
          className="flex flex-col items-center gap-3 text-slate-400"
        >
          <FiRefreshCw
            className="animate-spin text-3xl"
          />

          <span className="text-sm font-bold">
            {labels.loading}
          </span>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        className="mt-20 px-4 md:mt-4 md:px-8 md:py-6"
      >
        <div
          className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
        >
          <FiAlertCircle
            className="mx-auto mb-3 text-3xl"
          />

          <p className="font-black">
            {error || labels.notFound}
          </p>

          <button
            type="button"
            onClick={() => navigate('/agents')}
            className="mt-4 rounded-xl px-5 py-2.5 text-sm font-black text-white"
            style={{
              backgroundColor: accentColor,
            }}
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
        <div
          className="mx-auto w-full max-w-7xl space-y-5"
        >
          <section
            className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg md:p-7"
          >
            <div
              className="pointer-events-none absolute -start-24 -top-24 h-64 w-64 rounded-full opacity-[0.08]"
              style={{
                backgroundColor: accentColor,
              }}
            />

            <div
              className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between"
            >
              <div
                className="flex min-w-0 items-center gap-4"
              >
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl text-2xl font-black text-white shadow-md"
                  style={{
                    backgroundColor: accentColor,
                  }}
                >
                  {getInitials(
                    displayName,
                  )}
                </div>

                <div className="min-w-0 text-start">
                  <div
                    className="mb-2 flex flex-wrap items-center gap-2"
                  >
                    <span
                      className="text-xs font-extrabold"
                      style={{
                        color: accentColor,
                      }}
                    >
                      {labels.category}
                    </span>

                    <span
                      className="rounded-full border px-2.5 py-1 text-xs font-extrabold"
                      style={{
                        backgroundColor: `${accentColor}12`,
                        borderColor: `${accentColor}28`,
                        color: accentColor,
                      }}
                    >
                      agent
                    </span>
                  </div>

                  <h1
                    className="truncate text-3xl font-black text-slate-950 dark:text-white md:text-4xl"
                  >
                    {displayName}
                  </h1>

                  <div
                    className="mt-2 flex flex-wrap items-center gap-3 text-sm font-bold text-slate-500 dark:text-slate-400"
                  >
                    <span dir="ltr">
                      #{agent.id}
                    </span>

                    {agent.agent_code && (
                      <span dir="ltr">
                        {agent.agent_code}
                      </span>
                    )}

                    {agent.region && (
                      <span
                        className="flex items-center gap-1"
                      >
                        <FiMapPin />
                        {agent.region}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="flex flex-col gap-2 sm:flex-row"
              >
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => (
                    loadAgent({
                      background: true,
                    })
                  )}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
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

                <button
                  type="button"
                  onClick={() => navigate('/agents')}
                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white"
                  style={{
                    backgroundColor: accentColor,
                  }}
                >
                  {isArabic
                    ? <FiArrowRight />
                    : <FiArrowLeft />}

                  {labels.back}
                </button>
              </div>
            </div>

            <div
              className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {[
                {
                  label: labels.clientsCount,
                  value: agent.clients_count ?? clients.length,
                  icon: <FiUsers />,
                },
                {
                  label: labels.productsCount,
                  value: agent.products_count ?? 0,
                  icon: <FiShoppingBag />,
                },
                {
                  label: labels.commission,
                  value: `${formatNumber(
                    agent.commission_rate,
                    {
                      maximumFractionDigits: 2,
                    },
                  )}%`,
                  icon: <FiPercent />,
                },
                {
                  label: labels.totalBalance,
                  value: formatNumber(
                    agent.balance,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  ),
                  icon: <FiCreditCard />,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                >
                  <div
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="text-start">
                      <p
                        className="text-xs font-bold text-slate-400"
                      >
                        {item.label}
                      </p>

                      <p
                        className="mt-1 text-xl font-black text-slate-900 dark:text-white"
                      >
                        {item.value}
                      </p>
                    </div>

                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${accentColor}14`,
                        color: accentColor,
                      }}
                    >
                      {item.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {notice && (
            <div
              className={`
                flex
                items-start
                gap-3
                rounded-2xl
                border
                px-4
                py-3
                text-sm
                font-bold
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
              >
                <FiX />
              </button>
            </div>
          )}

          <section
            className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg"
          >
            <div
              className="grid gap-2 md:grid-cols-3"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => (
                    setActiveTab(
                      tab.id,
                    )
                  )}
                  className={`
                    flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    px-4
                    py-3
                    text-sm
                    font-black
                    transition
                    ${
                      activeTab === tab.id
                        ? 'text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                    }
                  `}
                  style={
                    activeTab === tab.id
                      ? {
                          backgroundColor: accentColor,
                        }
                      : undefined
                  }
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {activeTab === 'overview' && (
            <div className="space-y-5">
              <section
                className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg"
              >
                <h2
                  className="mb-5 text-lg font-black text-slate-900 dark:text-white"
                >
                  {labels.accountInfo}
                </h2>

                <div
                  className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <InfoCard
                    icon={<FiHash />}
                    label={labels.id}
                    value={`#${agent.id}`}
                    accentColor={accentColor}
                    dir="ltr"
                  />

                  <InfoCard
                    icon={<FiUser />}
                    label={labels.username}
                    value={agent.username}
                    accentColor={accentColor}
                  />

                  <InfoCard
                    icon={<FiShield />}
                    label={labels.agentCode}
                    value={agent.agent_code}
                    accentColor={accentColor}
                    dir="ltr"
                  />

                  <InfoCard
                    icon={<FiMapPin />}
                    label={labels.region}
                    value={agent.region}
                    accentColor={accentColor}
                  />
                </div>
              </section>

              <section
                className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg"
              >
                <div
                  className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
                >
                  <div className="text-start">
                    <h2
                      className="text-lg font-black text-slate-900 dark:text-white"
                    >
                      {labels.categoryInfo}
                    </h2>

                    <p
                      className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500"
                    >
                      {labels.categorySubtitle}
                    </p>
                  </div>

                  <div
                    className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"
                  >
                    <label
                      className="block w-full sm:min-w-[290px]"
                    >
                      <span className="sr-only">
                        {labels.chooseCategory}
                      </span>

                      <select
                        value={selectedCategoryId}
                        disabled={savingCategory}
                        onChange={(event) => {
                          setSelectedCategoryId(
                            event.target.value,
                          );
                          setCategoryError('');
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-current disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {!categories.length && (
                          <option value="">
                            {isArabic
                              ? 'لا توجد فئات متاحة'
                              : 'No categories available'}
                          </option>
                        )}

                        {categories.map((item) => {
                          const isCurrent = (
                            String(item.id) === initialCategoryId
                          );

                          const isInactive = item.is_active === false;

                          return (
                            <option
                              key={item.id}
                              value={String(item.id)}
                              disabled={isInactive && !isCurrent}
                            >
                              {item.display_name || item.name}
                              {' '}
                              ({formatNumber(
                                item.profit_percentage,
                                {
                                  maximumFractionDigits: 2,
                                },
                              )}%)
                              {isCurrent
                                ? (isArabic
                                  ? ' - الفئة الحالية'
                                  : ' - Current')
                                : ''}
                              {isInactive
                                ? (isArabic
                                  ? ' - غير نشطة'
                                  : ' - Inactive')
                                : ''}
                              {item.is_default
                                ? (isArabic
                                  ? ' - افتراضية'
                                  : ' - Default')
                                : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    <button
                      type="button"
                      disabled={
                        savingCategory
                        || !selectedCategoryId
                        || selectedCategoryId === initialCategoryId
                      }
                      onClick={saveCategory}
                      className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        backgroundColor: accentColor,
                      }}
                    >
                      {savingCategory
                        ? <FiRefreshCw className="animate-spin" />
                        : <FiCheck />}

                      {savingCategory
                        ? labels.savingCategory
                        : labels.saveCategory}
                    </button>
                  </div>
                </div>

                {categoryError && (
                  <div
                    className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <FiAlertCircle className="mt-0.5 shrink-0" />
                    <span>{categoryError}</span>
                  </div>
                )}

                {categories.length === 0 && !categoryError && (
                  <div
                    className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                  >
                    {labels.noAvailableCategories}
                  </div>
                )}

                {!category ? (
                  <div
                    className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-400 dark:border-slate-700"
                  >
                    {labels.noCategory}
                  </div>
                ) : (
                  <div
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                  >
                    <InfoCard
                      icon={<FiUser />}
                      label={labels.categoryName}
                      value={
                        category.display_name
                        || category.name
                      }
                      accentColor={accentColor}
                    />

                    <InfoCard
                      icon={<FiPercent />}
                      label={labels.profitPercentage}
                      value={`${formatNumber(
                        category.profit_percentage,
                        {
                          maximumFractionDigits: 2,
                        },
                      )}%`}
                      accentColor={accentColor}
                    />

                    <InfoCard
                      icon={<FiShield />}
                      label={labels.categoryStatus}
                      value={
                        category.is_active === false
                          ? labels.inactive
                          : labels.active
                      }
                      accentColor={accentColor}
                    />

                    <InfoCard
                      icon={<FiEdit3 />}
                      label={labels.description}
                      value={category.description}
                      accentColor={accentColor}
                    />
                  </div>
                )}
              </section>

              <section
                className="rounded-3xl border border-red-100 bg-white p-5 shadow-sm dark:border-red-900/30 dark:bg-secondary-dark-bg"
              >
                <div
                  className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
                >
                  <div className="text-start">
                    <h2
                      className="text-lg font-black text-slate-900 dark:text-white"
                    >
                      {labels.demote}
                    </h2>

                    <p
                      className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400"
                    >
                      {labels.demoteConfirm}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={demoting}
                    onClick={demoteAgent}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {demoting
                      ? <FiRefreshCw className="animate-spin" />
                      : <FiTrash2 />}

                    {labels.demote}
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="space-y-5">
              <section
                className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg"
              >
                <div
                  className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
                >
                  <h2
                    className="text-lg font-black text-slate-900 dark:text-white"
                  >
                    {labels.financial}
                  </h2>

                  <div
                    className="flex flex-col gap-2 sm:flex-row"
                  >
                    <button
                      type="button"
                      onClick={openCommission}
                      className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white"
                      style={{
                        backgroundColor: accentColor,
                      }}
                    >
                      <FiPercent />
                      {labels.editCommission}
                    </button>

                    <button
                      type="button"
                      onClick={openLimits}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <FiEdit3 />
                      {labels.editLimits}
                    </button>
                  </div>
                </div>

                <div
                  className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <BalanceCard
                    label={labels.balanceUsd}
                    value={formatMoney(
                      agent.balance_usd,
                      'USD',
                    )}
                    accentColor={accentColor}
                    addLabel={labels.addBalance}
                    deductLabel={labels.deductBalance}
                    busy={submittingAdjustment}
                    onAdd={() => (
                      openAdjustment(
                        'credit',
                        'USD',
                      )
                    )}
                    onDeduct={() => (
                      openAdjustment(
                        'debit',
                        'USD',
                      )
                    )}
                  />

                  <BalanceCard
                    label={labels.balanceSyp}
                    value={formatMoney(
                      agent.balance_syp,
                      'SYP',
                    )}
                    accentColor={accentColor}
                    addLabel={labels.addBalance}
                    deductLabel={labels.deductBalance}
                    busy={submittingAdjustment}
                    onAdd={() => (
                      openAdjustment(
                        'credit',
                        'SYP',
                      )
                    )}
                    onDeduct={() => (
                      openAdjustment(
                        'debit',
                        'SYP',
                      )
                    )}
                  />

                  <InfoCard
                    icon={<FiPercent />}
                    label={labels.commission}
                    value={`${formatNumber(
                      agent.commission_rate,
                      {
                        maximumFractionDigits: 2,
                      },
                    )}%`}
                    accentColor={accentColor}
                  />

                  <InfoCard
                    icon={<FiCreditCard />}
                    label={labels.totalBalance}
                    value={formatNumber(
                      agent.balance,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}
                    accentColor={accentColor}
                  />

                  <InfoCard
                    icon={<FiDollarSign />}
                    label={labels.earningsUsd}
                    value={formatMoney(
                      agent.total_earnings_usd,
                      'USD',
                    )}
                    accentColor={accentColor}
                    dir="ltr"
                  />

                  <InfoCard
                    icon={<FiDollarSign />}
                    label={labels.earningsSyp}
                    value={formatMoney(
                      agent.total_earnings_syp,
                      'SYP',
                    )}
                    accentColor={accentColor}
                    dir="ltr"
                  />

                  <InfoCard
                    icon={<FiShield />}
                    label={labels.coverageUsd}
                    value={formatMoney(
                      agent.coverage_limit_usd,
                      'USD',
                    )}
                    accentColor={accentColor}
                    dir="ltr"
                  />

                  <InfoCard
                    icon={<FiShield />}
                    label={labels.coverageSyp}
                    value={formatMoney(
                      agent.coverage_limit_syp,
                      'SYP',
                    )}
                    accentColor={accentColor}
                    dir="ltr"
                  />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'clients' && (
            <section
              className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg"
            >
              <div
                className="mb-5 flex items-center justify-between gap-3"
              >
                <h2
                  className="text-lg font-black text-slate-900 dark:text-white"
                >
                  {labels.clients}
                </h2>

                <span
                  className="rounded-xl px-3 py-1.5 text-xs font-black"
                  style={{
                    backgroundColor: `${accentColor}14`,
                    color: accentColor,
                  }}
                >
                  {clients.length}
                </span>
              </div>

              {!clients.length ? (
                <div
                  className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400 dark:border-slate-700"
                >
                  {labels.noClients}
                </div>
              ) : (
                <div
                  className="grid gap-3 md:grid-cols-2"
                >
                  {clients.map((client) => {
                    const clientName = (
                      client.full_name
                      || client.name
                      || client.username
                      || `${labels.client} #${client.id}`
                    );

                    const clientStatus = client.is_banned
                      ? labels.banned
                      : (
                        client.is_active === false
                          ? labels.inactive
                          : labels.active
                      );

                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => (
                          navigate(
                            `/customers/${client.id}`,
                            {
                              state: {
                                customer: client,
                              },
                            },
                          )
                        )}
                        className="group rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-start transition hover:border-slate-200 hover:bg-white hover:shadow-md dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                      >
                        <div
                          className="flex items-center gap-3"
                        >
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                            style={{
                              backgroundColor: accentColor,
                            }}
                          >
                            {getInitials(
                              clientName,
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate font-black text-slate-900 dark:text-white"
                            >
                              {clientName}
                            </p>

                            <div
                              className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400"
                            >
                              <span dir="ltr">
                                #{client.id}
                              </span>

                              <span>•</span>

                              <span>
                                {clientStatus}
                              </span>
                            </div>
                          </div>

                          <span
                            className="text-xs font-black"
                            style={{
                              color: accentColor,
                            }}
                          >
                            {labels.openCustomer}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <ModalShell
        open={Boolean(adjustmentModal)}
        title={labels.balanceAdjustment}
        busy={submittingAdjustment}
        onClose={closeAdjustment}
      >
        <form onSubmit={submitAdjustment}>
          {adjustmentError && (
            <div
              className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              <FiAlertCircle className="mt-0.5 shrink-0" />

              <span>
                {adjustmentError}
              </span>
            </div>
          )}

          {adjustmentModal && (
            <>
              <div
                className="mb-5 grid grid-cols-2 gap-3"
              >
                <div
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <p
                    className="text-xs font-bold text-slate-400"
                  >
                    {labels.adjustmentCurrency}
                  </p>

                  <p
                    dir="ltr"
                    className="mt-1 text-lg font-black text-slate-900 dark:text-white"
                  >
                    {adjustmentModal.currency}
                  </p>
                </div>

                <div
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <p
                    className="text-xs font-bold text-slate-400"
                  >
                    {isArabic
                      ? 'نوع العملية'
                      : 'Operation'}
                  </p>

                  <p
                    className={`
                      mt-1
                      text-lg
                      font-black
                      ${
                        adjustmentModal.mode === 'debit'
                          ? 'text-red-600 dark:text-red-300'
                          : 'text-emerald-600 dark:text-emerald-300'
                      }
                    `}
                  >
                    {adjustmentModal.mode === 'debit'
                      ? labels.debitOperation
                      : labels.creditOperation}
                  </p>
                </div>
              </div>

              <div
                className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
              >
                <div
                  className="flex items-center justify-between gap-3"
                >
                  <span
                    className="text-xs font-bold text-slate-400"
                  >
                    {labels.currentBalance}
                  </span>

                  <span
                    dir="ltr"
                    className="font-black text-slate-900 dark:text-white"
                  >
                    {adjustmentModal.currency === 'USD'
                      ? formatMoney(
                        agent.balance_usd,
                        'USD',
                      )
                      : formatMoney(
                        agent.balance_syp,
                        'SYP',
                      )}
                  </span>
                </div>
              </div>

              <label className="block">
                <span
                  className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200"
                >
                  {labels.adjustmentAmount}
                </span>

                <div className="relative">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={adjustmentAmount}
                    disabled={submittingAdjustment}
                    onChange={(event) => {
                      setAdjustmentAmount(
                        event.target.value,
                      );

                      setAdjustmentError('');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pe-16 font-bold text-slate-900 outline-none transition focus:border-current disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    dir="ltr"
                    required
                    autoFocus
                  />

                  <span
                    className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400"
                  >
                    {adjustmentModal.currency}
                  </span>
                </div>
              </label>

              <label className="mt-4 block">
                <span
                  className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200"
                >
                  {labels.adjustmentReason}
                </span>

                <textarea
                  rows="4"
                  minLength="10"
                  maxLength="500"
                  value={adjustmentReason}
                  disabled={submittingAdjustment}
                  onChange={(event) => {
                    setAdjustmentReason(
                      event.target.value,
                    );

                    setAdjustmentError('');
                  }}
                  placeholder={
                    isArabic
                      ? 'مثال: إضافة رصيد للوكيل بعد استلام دفعة مالية...'
                      : 'Example: Adding balance after receiving agent payment...'
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-current disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  required
                />

                <div
                  className="mt-1 flex items-center justify-between gap-3"
                >
                  <span
                    className="text-xs font-semibold text-slate-400"
                  >
                    {labels.adjustmentReasonHint}
                  </span>

                  <span
                    dir="ltr"
                    className="text-xs font-bold text-slate-400"
                  >
                    {adjustmentReason.length}/500
                  </span>
                </div>
              </label>

              {adjustmentModal.mode === 'debit' && (
                <div
                  className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  <FiAlertCircle className="mt-0.5 shrink-0" />

                  <span>
                    {isArabic
                      ? 'سيتم خصم المبلغ مباشرة من رصيد الوكيل بعد التأكيد.'
                      : 'The amount will be deducted from the agent balance immediately after confirmation.'}
                  </span>
                </div>
              )}

              <div
                className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
              >
                <button
                  type="button"
                  disabled={submittingAdjustment}
                  onClick={closeAdjustment}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                >
                  {labels.cancel}
                </button>

                <button
                  type="submit"
                  disabled={submittingAdjustment}
                  className={`
                    flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    px-5
                    py-2.5
                    text-sm
                    font-black
                    text-white
                    transition
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                    ${
                      adjustmentModal.mode === 'debit'
                        ? 'bg-red-600 hover:bg-red-700'
                        : ''
                    }
                  `}
                  style={
                    adjustmentModal.mode === 'credit'
                      ? {
                          backgroundColor: accentColor,
                        }
                      : undefined
                  }
                >
                  {submittingAdjustment ? (
                    <FiRefreshCw className="animate-spin" />
                  ) : (
                    adjustmentModal.mode === 'debit'
                      ? <FiMinus />
                      : <FiPlus />
                  )}

                  {submittingAdjustment
                    ? labels.executingAdjustment
                    : (
                      adjustmentModal.mode === 'debit'
                        ? labels.deductBalance
                        : labels.addBalance
                    )}
                </button>
              </div>
            </>
          )}
        </form>
      </ModalShell>

      <ModalShell
        open={commissionOpen}
        title={labels.commissionModal}
        busy={savingCommission}
        onClose={() => (
          setCommissionOpen(false)
        )}
      >
        <form onSubmit={saveCommission}>
          {commissionError && (
            <div
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              {commissionError}
            </div>
          )}

          <label className="block">
            <span
              className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200"
            >
              {labels.commission}
            </span>

            <div className="relative">
              <input
                type="number"
                min="0"
                max="99.99"
                step="0.01"
                value={commissionRate}
                onChange={(event) => (
                  setCommissionRate(
                    event.target.value,
                  )
                )}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pe-12 font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                dir="ltr"
                required
              />

              <FiPercent
                className="absolute end-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>

            <span
              className="mt-2 block text-xs font-semibold text-slate-400"
            >
              {labels.commissionHint}
            </span>
          </label>

          <div
            className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
          >
            <button
              type="button"
              disabled={savingCommission}
              onClick={() => (
                setCommissionOpen(false)
              )}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              {labels.cancel}
            </button>

            <button
              type="submit"
              disabled={savingCommission}
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
              style={{
                backgroundColor: accentColor,
              }}
            >
              {savingCommission
                ? <FiRefreshCw className="animate-spin" />
                : <FiCheck />}

              {savingCommission
                ? labels.saving
                : labels.save}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={limitsOpen}
        title={labels.limitsModal}
        busy={savingLimits}
        onClose={() => (
          setLimitsOpen(false)
        )}
      >
        <form onSubmit={saveLimits}>
          {limitsError && (
            <div
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              {limitsError}
            </div>
          )}

          <div
            className="grid gap-4 sm:grid-cols-2"
          >
            <label className="block">
              <span
                className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200"
              >
                {labels.coverageUsd}
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={coverageUsd}
                onChange={(event) => (
                  setCoverageUsd(
                    event.target.value,
                  )
                )}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                dir="ltr"
                required
              />
            </label>

            <label className="block">
              <span
                className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200"
              >
                {labels.coverageSyp}
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={coverageSyp}
                onChange={(event) => (
                  setCoverageSyp(
                    event.target.value,
                  )
                )}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                dir="ltr"
                required
              />
            </label>
          </div>

          <div
            className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
          >
            <button
              type="button"
              disabled={savingLimits}
              onClick={() => (
                setLimitsOpen(false)
              )}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              {labels.cancel}
            </button>

            <button
              type="submit"
              disabled={savingLimits}
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
              style={{
                backgroundColor: accentColor,
              }}
            >
              {savingLimits
                ? <FiRefreshCw className="animate-spin" />
                : <FiCheck />}

              {savingLimits
                ? labels.saving
                : labels.save}
            </button>
          </div>
        </form>
      </ModalShell>
    </>
  );
};

export default AgentDetails;