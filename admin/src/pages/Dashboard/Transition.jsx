import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  FiAlertCircle,
  FiCheck,
  FiClock,
  FiDownload,
  FiEye,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../contexts/AuthContext';
import { useStateContext } from '../../contexts/ContextProvider';
import axiosInstance from '../../utils/axiosConfig';
import { localizeRuntimeValue } from '../../utils/runtimeLocalization';

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.results)) {
    return value.results;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  return [];
};

const getApiError = (error, fallback) => (
  error?.response?.data?.detail
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const pickPersonName = (person) => {
  if (!person || typeof person !== 'object') {
    return '';
  }

  return (
    person.name
    || person.full_name
    || person.username
    || person.email
    || person.display_name
    || person.first_name
    || ''
  );
};

const pickPersonId = (person) => {
  if (!person || typeof person !== 'object') {
    return null;
  }

  return (
    person.id
    ?? person.user_id
    ?? person.agent_id
    ?? person.admin_id
    ?? null
  );
};

const Transactions = () => {
  const { t, i18n } = useTranslation(['transactions', 'common']);
  const { user, isAuthenticated } = useAuth();
  const { currentColor } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    eyebrow: isArabic ? 'الإدارة المالية' : 'Finance Management',
    title: isArabic ? 'التحويلات المالية' : 'Financial Transactions',
    subtitle: isArabic
      ? 'سجل موحد لكل الحركات المالية مع إظهار منفذ العملية بوضوح.'
      : 'A unified transaction log with a clear actor for each operation.',
    refresh: isArabic ? 'تحديث البيانات' : 'Refresh data',
    export: isArabic ? 'تصدير CSV' : 'Export CSV',
    total: isArabic ? 'إجمالي التحويلات' : 'Total transactions',
    approved: isArabic ? 'المقبولة' : 'Approved',
    pending: isArabic ? 'المعلقة' : 'Pending',
    usdVolume: isArabic ? 'حجم الدولار' : 'USD volume',
    sypVolume: isArabic ? 'حجم الليرة' : 'SYP volume',
    search: isArabic
      ? 'ابحث بالمعرف أو منفذ العملية أو الملاحظة...'
      : 'Search by ID, actor, or note...',
    allCurrencies: isArabic ? 'كل العملات' : 'All currencies',
    allStatuses: isArabic ? 'كل الحالات' : 'All statuses',
    allTypes: isArabic ? 'كل الأنواع' : 'All types',
    clear: isArabic ? 'مسح الفلاتر' : 'Clear filters',
    id: isArabic ? 'معرف العملية' : 'Transaction ID',
    date: isArabic ? 'التاريخ والوقت' : 'Date & time',
    type: isArabic ? 'النوع' : 'Type',
    actor: isArabic ? 'منفذ العملية' : 'Performed by',
    source: isArabic ? 'المصدر' : 'Source',
    target: isArabic ? 'الوجهة' : 'Destination',
    amount: isArabic ? 'المبلغ' : 'Amount',
    currency: isArabic ? 'العملة' : 'Currency',
    status: isArabic ? 'الحالة' : 'Status',
    actions: isArabic ? 'الإجراءات' : 'Actions',
    details: isArabic ? 'التفاصيل' : 'Details',
    approve: isArabic ? 'موافقة' : 'Approve',
    reject: isArabic ? 'رفض' : 'Reject',
    noActor: isArabic
      ? 'غير مرجع من الـ API'
      : 'Not provided by API',
    customer: isArabic ? 'عميل' : 'Customer',
    agent: isArabic ? 'وكيل' : 'Agent',
    admin: isArabic ? 'أدمن' : 'Admin',
    walletOwner: isArabic ? 'صاحب المحفظة' : 'Wallet owner',
    system: isArabic ? 'النظام' : 'System',
    noResults: isArabic
      ? 'لا توجد عمليات مطابقة للفلاتر الحالية.'
      : 'No transactions match the current filters.',
    loadFailed: isArabic ? 'تعذر تحميل التحويلات.' : 'Failed to load transactions.',
    actionFailed: isArabic ? 'تعذر تنفيذ العملية.' : 'Failed to complete the action.',
    approveConfirm: isArabic ? 'هل تريد الموافقة على العملية؟' : 'Approve this transaction?',
    rejectPrompt: isArabic ? 'اكتب سبب الرفض:' : 'Enter rejection reason:',
    modalTitle: isArabic ? 'تفاصيل العملية المالية' : 'Transaction details',
    basic: isArabic ? 'البيانات الأساسية' : 'Basic information',
    financial: isArabic ? 'البيانات المالية' : 'Financial information',
    parties: isArabic ? 'الأطراف ومنفذ العملية' : 'Parties & actor',
    notes: isArabic ? 'الملاحظات' : 'Notes',
    close: isArabic ? 'إغلاق' : 'Close',
  }), [isArabic]);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [filters, setFilters] = useState({
    currency: 'All',
    status: 'All',
    type: 'All',
    startDate: '',
    endDate: '',
  });

  const transactionValue = useCallback((prefix, value, fallbackKey) => (
    localizeRuntimeValue({
      t,
      i18n,
      value,
      namespace: 'transactions',
      prefix,
      fallback: () => t(fallbackKey),
    })
  ), [i18n, t]);

  const fetchTransactions = useCallback(async ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
    }

    setError('');

    try {
      const response = await axiosInstance.get('transactions/transactions/');
      setTransactions(normalizeList(response.data));
    } catch (fetchError) {
      setTransactions([]);
      setError(getApiError(fetchError, labels.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [labels.loadFailed]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTransactions();
    }
  }, [fetchTransactions, isAuthenticated]);

  const getWalletCurrency = useCallback((wallet) => {
    if (wallet && typeof wallet === 'object') {
      return wallet.currency || wallet.currency_code || 'USD';
    }

    return 'USD';
  }, []);

  const resolveActor = useCallback((transaction) => {
    const wallet = transaction.wallet && typeof transaction.wallet === 'object'
      ? transaction.wallet
      : null;

    const candidates = [
      {
        person: transaction.performed_by,
        role: transaction.performed_by?.role || '',
        source: 'performed_by',
      },
      {
        person: transaction.created_by,
        role: transaction.created_by?.role || '',
        source: 'created_by',
      },
      {
        person: transaction.initiated_by,
        role: transaction.initiated_by?.role || '',
        source: 'initiated_by',
      },
      {
        person: transaction.actor,
        role: transaction.actor?.role || '',
        source: 'actor',
      },
      {
        person: transaction.user,
        role: labels.customer,
        source: 'user',
      },
      {
        person: transaction.agent,
        role: labels.agent,
        source: 'agent',
      },
      {
        person: transaction.admin,
        role: labels.admin,
        source: 'admin',
      },
      {
        person: wallet?.user,
        role: labels.customer,
        source: 'wallet.user',
      },
      {
        person: wallet?.agent,
        role: labels.agent,
        source: 'wallet.agent',
      },
      {
        person: wallet?.admin,
        role: labels.admin,
        source: 'wallet.admin',
      },
      {
        person: wallet?.owner,
        role: wallet?.owner?.role || labels.walletOwner,
        source: 'wallet.owner',
      },
      {
        person: wallet?.customer,
        role: labels.customer,
        source: 'wallet.customer',
      },
    ];

    const matched = candidates.find((candidate) => (
      candidate.person
      && typeof candidate.person === 'object'
      && (
        pickPersonName(candidate.person)
        || pickPersonId(candidate.person) !== null
      )
    ));

    if (matched) {
      return {
        name: pickPersonName(matched.person) || `#${pickPersonId(matched.person)}`,
        id: pickPersonId(matched.person),
        role: matched.role || matched.person.role || '',
        source: matched.source,
        isFallback: false,
      };
    }

    const flatName = (
      transaction.performed_by_name
      || transaction.created_by_name
      || transaction.actor_name
      || transaction.user_name
      || transaction.username
      || transaction.agent_name
      || transaction.admin_name
      || wallet?.user_name
      || wallet?.owner_name
      || ''
    );

    const flatId = (
      transaction.performed_by_id
      ?? transaction.created_by_id
      ?? transaction.actor_id
      ?? transaction.user_id
      ?? transaction.agent_id
      ?? transaction.admin_id
      ?? wallet?.user_id
      ?? wallet?.owner_id
      ?? null
    );

    if (flatName || flatId !== null) {
      return {
        name: flatName || `#${flatId}`,
        id: flatId,
        role: (
          transaction.performed_by_role
          || transaction.actor_role
          || transaction.role
          || ''
        ),
        source: 'flat-fields',
        isFallback: false,
      };
    }

    return {
      name: labels.noActor,
      id: null,
      role: '',
      source: 'missing',
      isFallback: true,
    };
  }, [
    labels.admin,
    labels.agent,
    labels.customer,
    labels.noActor,
    labels.walletOwner,
  ]);

  const getSource = useCallback((transaction, actor) => {
    if (transaction.source && typeof transaction.source === 'object') {
      return pickPersonName(transaction.source)
        || transaction.source.name
        || `#${pickPersonId(transaction.source)}`;
    }

    if (transaction.source_name) {
      return transaction.source_name;
    }

    if (transaction.transaction_type === 'purchase') {
      return actor.isFallback ? labels.noActor : actor.name;
    }

    if (
      transaction.user
      || transaction.agent
      || transaction.admin
      || transaction.wallet
    ) {
      return actor.isFallback ? labels.noActor : actor.name;
    }

    return labels.system;
  }, [labels.noActor, labels.system]);

  const getTarget = useCallback((transaction) => {
    const recipientWallet = (
      transaction.recipient_wallet
      && typeof transaction.recipient_wallet === 'object'
    )
      ? transaction.recipient_wallet
      : null;

    const recipient = (
      recipientWallet?.user
      || recipientWallet?.agent
      || recipientWallet?.owner
      || null
    );

    if (recipient && typeof recipient === 'object') {
      return pickPersonName(recipient)
        || `#${pickPersonId(recipient)}`;
    }

    if (transaction.recipient_name) {
      return transaction.recipient_name;
    }

    if (transaction.transaction_type === 'purchase') {
      return isArabic ? 'شراء من المتجر' : 'Store purchase';
    }

    if (transaction.transaction_type === 'deposit') {
      return isArabic ? 'إيداع محفظة' : 'Wallet deposit';
    }

    if (transaction.transaction_type === 'transfer') {
      return isArabic ? 'محفظة مستلمة' : 'Recipient wallet';
    }

    return labels.system;
  }, [isArabic, labels.system]);

  const transformed = useMemo(() => transactions.map((item) => {
    const actor = resolveActor(item);

    return {
      ...item,
      transactionId: `TXN-${String(item.id).padStart(6, '0')}`,
      timestamp: item.created_at,
      type: item.transaction_type,
      statusValue: item.status,
      amountValue: Number(item.amount || 0),
      currencyValue: getWalletCurrency(item.wallet),
      actor,
      sourceValue: getSource(item, actor),
      targetValue: getTarget(item),
    };
  }), [
    getSource,
    getTarget,
    getWalletCurrency,
    resolveActor,
    transactions,
  ]);

  const filteredData = useMemo(() => {
    const needle = searchText.trim().toLowerCase();

    return transformed.filter((item) => {
      if (
        filters.currency !== 'All'
        && item.currencyValue !== filters.currency
      ) {
        return false;
      }

      if (
        filters.status !== 'All'
        && item.statusValue !== filters.status
      ) {
        return false;
      }

      if (
        filters.type !== 'All'
        && item.type !== filters.type
      ) {
        return false;
      }

      if (
        filters.startDate
        && new Date(item.timestamp) < new Date(filters.startDate)
      ) {
        return false;
      }

      if (
        filters.endDate
        && new Date(item.timestamp) > new Date(`${filters.endDate}T23:59:59`)
      ) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        item.transactionId,
        item.actor?.name,
        item.actor?.role,
        item.sourceValue,
        item.targetValue,
        item.note,
        item.type,
        item.statusValue,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [filters, searchText, transformed]);

  const stats = useMemo(() => {
    const approvedItems = filteredData.filter(
      (item) => item.statusValue === 'approved',
    );

    const usdVolume = approvedItems
      .filter((item) => item.currencyValue === 'USD')
      .reduce((sum, item) => sum + item.amountValue, 0);

    const sypVolume = approvedItems
      .filter((item) => item.currencyValue === 'SYP')
      .reduce((sum, item) => sum + item.amountValue, 0);

    return {
      total: filteredData.length,
      approved: approvedItems.length,
      pending: filteredData.filter(
        (item) => item.statusValue === 'pending',
      ).length,
      usdVolume,
      sypVolume,
    };
  }, [filteredData]);

  const clearFilters = () => {
    setSearchText('');
    setFilters({
      currency: 'All',
      status: 'All',
      type: 'All',
      startDate: '',
      endDate: '',
    });
  };

  const formatAmount = (item) => {
    if (item.currencyValue === 'USD') {
      return `$${item.amountValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    return `${item.amountValue.toLocaleString(
      isArabic ? 'ar-SY' : 'en-US',
    )} SYP`;
  };

  const handleExport = () => {
    const headers = [
      labels.id,
      labels.date,
      labels.type,
      labels.actor,
      labels.source,
      labels.target,
      labels.amount,
      labels.currency,
      labels.status,
    ];

    const escapeCell = (value) => (
      `"${String(value ?? '').replace(/"/g, '""')}"`
    );

    const rows = filteredData.map((item) => [
      item.transactionId,
      item.timestamp,
      item.type,
      item.actor?.name,
      item.sourceValue,
      item.targetValue,
      item.amountValue,
      item.currencyValue,
      item.statusValue,
    ]);

    const csvContent = [
      headers.map(escapeCell).join(','),
      ...rows.map((row) => row.map(escapeCell).join(',')),
    ].join('\n');

    const blob = new Blob(
      [csvContent],
      { type: 'text/csv;charset=utf-8;' },
    );

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    anchor.click();

    window.URL.revokeObjectURL(url);
  };

  const handleApprove = async (transactionId) => {
    if (!window.confirm(labels.approveConfirm)) {
      return;
    }

    setActionLoading(transactionId);

    try {
      await axiosInstance.post(
        `transactions/approve/${transactionId}/`,
        { action: 'approve' },
      );

      await fetchTransactions({ background: true });
    } catch (actionError) {
      window.alert(getApiError(actionError, labels.actionFailed));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (transactionId) => {
    const reason = window.prompt(labels.rejectPrompt);

    if (!reason) {
      return;
    }

    setActionLoading(transactionId);

    try {
      await axiosInstance.post(
        `transactions/approve/${transactionId}/`,
        {
          action: 'reject',
          reason,
        },
      );

      await fetchTransactions({ background: true });
    } catch (actionError) {
      window.alert(getApiError(actionError, labels.actionFailed));
    } finally {
      setActionLoading(null);
    }
  };

  const statusClass = (status) => {
    if (status === 'rejected') {
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300';
    }

    if (status === 'pending') {
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300';
    }

    return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  };

  const StatCard = ({
    label,
    value,
    icon,
    helper,
  }) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
      <div className="flex items-start justify-between gap-3">
        <div className="text-start">
          <p className="text-xs font-extrabold text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">
            {value}
          </p>
          {helper && (
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {helper}
            </p>
          )}
        </div>

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: `${accentColor}14`,
            color: accentColor,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );

  if (loading && !transactions.length) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <FiRefreshCw className="animate-spin text-3xl text-slate-400" />
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
          <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg md:p-7">
            <div
              className="pointer-events-none absolute -end-24 -top-24 h-60 w-60 rounded-full opacity-[0.08]"
              style={{ backgroundColor: accentColor }}
            />

            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <FiRefreshCw />
                </div>

                <div className="text-start">
                  <p
                    className="text-xs font-black uppercase tracking-[0.16em]"
                    style={{ color: accentColor }}
                  >
                    {labels.eyebrow}
                  </p>
                  <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
                    {labels.title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {labels.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => fetchTransactions({ background: true })}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                  {labels.refresh}
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: accentColor }}
                >
                  <FiDownload />
                  {labels.export}
                </button>
              </div>
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <FiAlertCircle />
              <span className="flex-1 text-start">
                {error}
              </span>
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label={labels.total}
              value={stats.total}
              helper={isArabic ? 'حسب الفلاتر الحالية' : 'Current filters'}
              icon={<FiFilter />}
            />
            <StatCard
              label={labels.approved}
              value={stats.approved}
              icon={<FiCheck />}
            />
            <StatCard
              label={labels.pending}
              value={stats.pending}
              icon={<FiClock />}
            />
            <StatCard
              label={labels.usdVolume}
              value={`$${stats.usdVolume.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              icon={<span className="font-black">$</span>}
            />
            <StatCard
              label={labels.sypVolume}
              value={stats.sypVolume.toLocaleString(
                isArabic ? 'ar-SY' : 'en-US',
              )}
              helper="SYP"
              icon={<span className="text-xs font-black">SYP</span>}
            />
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-start">
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {isArabic ? 'تصفية التحويلات' : 'Filter transactions'}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    {isArabic
                      ? 'الاسم الظاهر في الجدول مأخوذ من منفذ العملية أو صاحب المحفظة الموجود في استجابة الـ API.'
                      : 'The actor shown below is resolved from the API actor or wallet owner.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  {labels.clear}
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                <div className="relative xl:col-span-2">
                  <FiSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder={labels.search}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white ps-10 pe-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>

                <select
                  value={filters.currency}
                  onChange={(event) => setFilters((previous) => ({
                    ...previous,
                    currency: event.target.value,
                  }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="All">{labels.allCurrencies}</option>
                  <option value="USD">USD</option>
                  <option value="SYP">SYP</option>
                </select>

                <select
                  value={filters.status}
                  onChange={(event) => setFilters((previous) => ({
                    ...previous,
                    status: event.target.value,
                  }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="All">{labels.allStatuses}</option>
                  <option value="approved">
                    {transactionValue('status', 'approved', 'status.unknown')}
                  </option>
                  <option value="pending">
                    {transactionValue('status', 'pending', 'status.unknown')}
                  </option>
                  <option value="rejected">
                    {transactionValue('status', 'rejected', 'status.unknown')}
                  </option>
                </select>

                <select
                  value={filters.type}
                  onChange={(event) => setFilters((previous) => ({
                    ...previous,
                    type: event.target.value,
                  }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="All">{labels.allTypes}</option>
                  <option value="deposit">
                    {transactionValue('type', 'deposit', 'type.other')}
                  </option>
                  <option value="transfer">
                    {transactionValue('type', 'transfer', 'type.other')}
                  </option>
                  <option value="purchase">
                    {transactionValue('type', 'purchase', 'type.other')}
                  </option>
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(event) => setFilters((previous) => ({
                      ...previous,
                      startDate: event.target.value,
                    }))}
                    className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(event) => setFilters((previous) => ({
                      ...previous,
                      endDate: event.target.value,
                    }))}
                    className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>
          </section>

          {!filteredData.length ? (
            <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-black text-slate-400 dark:border-slate-700 dark:bg-secondary-dark-bg">
              {labels.noResults}
            </section>
          ) : (
            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
              <div className="overflow-x-auto">
                <table className="min-w-[1320px] w-full">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/60">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.id}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.date}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.type}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.actor}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.source}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.target}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.amount}</th>
                      <th className="px-4 py-3 text-start text-xs font-black text-slate-400">{labels.status}</th>
                      <th className="px-4 py-3 text-center text-xs font-black text-slate-400">{labels.actions}</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredData.map((item) => (
                      <tr
                        key={item.id}
                        className="transition hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
                      >
                        <td className="px-4 py-4 text-sm font-black text-slate-900 dark:text-white">
                          {item.transactionId}
                        </td>

                        <td className="px-4 py-4 text-sm font-bold text-slate-500 dark:text-slate-400">
                          {new Date(item.timestamp).toLocaleString(
                            i18n.resolvedLanguage,
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm font-black text-slate-700 dark:text-slate-200">
                          {transactionValue('type', item.type, 'type.other')}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                              style={{
                                backgroundColor: `${accentColor}14`,
                                color: accentColor,
                              }}
                            >
                              <FiUser />
                            </div>

                            <div className="min-w-0 text-start">
                              <p
                                className={`max-w-[190px] truncate text-sm font-black ${
                                  item.actor.isFallback
                                    ? 'text-amber-600 dark:text-amber-300'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                                title={item.actor.name}
                              >
                                {item.actor.name}
                              </p>

                              {!item.actor.isFallback && (
                                <p className="mt-0.5 text-xs font-semibold text-slate-400">
                                  {[
                                    item.actor.role,
                                    item.actor.id !== null
                                      ? `#${item.actor.id}`
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' • ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                          {item.sourceValue}
                        </td>

                        <td className="px-4 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                          {item.targetValue}
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-sm font-black text-slate-950 dark:text-white">
                            {formatAmount(item)}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-400">
                            {item.currencyValue}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(item.statusValue)}`}
                          >
                            {transactionValue(
                              'status',
                              item.statusValue,
                              'status.unknown',
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedTransaction(item)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              title={labels.details}
                            >
                              <FiEye />
                            </button>

                            {item.statusValue === 'pending' && user?.role === 'admin' && (
                              <>
                                <button
                                  type="button"
                                  disabled={actionLoading === item.id}
                                  onClick={() => handleApprove(item.id)}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition hover:opacity-90 disabled:opacity-50"
                                  style={{ backgroundColor: accentColor }}
                                  title={labels.approve}
                                >
                                  {actionLoading === item.id
                                    ? <FiRefreshCw className="animate-spin" />
                                    : <FiCheck />}
                                </button>

                                <button
                                  type="button"
                                  disabled={actionLoading === item.id}
                                  onClick={() => handleReject(item.id)}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                                  title={labels.reject}
                                >
                                  <FiX />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>

      {selectedTransaction && (
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800 md:p-6">
              <div className="text-start">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">
                  {labels.modalTitle}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {selectedTransaction.transactionId}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4 p-5 md:p-6">
              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <h3 className="font-black text-slate-900 dark:text-white">
                  {labels.actor}
                </h3>

                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${accentColor}14`,
                      color: accentColor,
                    }}
                  >
                    <FiUser />
                  </div>

                  <div className="text-start">
                    <p className="font-black text-slate-900 dark:text-white">
                      {selectedTransaction.actor.name}
                    </p>

                    {!selectedTransaction.actor.isFallback && (
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {[
                          selectedTransaction.actor.role,
                          selectedTransaction.actor.id !== null
                            ? `ID: ${selectedTransaction.actor.id}`
                            : '',
                          `source: ${selectedTransaction.actor.source}`,
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <h3 className="font-black text-slate-900 dark:text-white">
                    {labels.basic}
                  </h3>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="font-bold text-slate-400">
                        {labels.id}
                      </span>
                      <span className="font-black text-slate-800 dark:text-slate-100">
                        {selectedTransaction.transactionId}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="font-bold text-slate-400">
                        {labels.type}
                      </span>
                      <span className="font-black text-slate-800 dark:text-slate-100">
                        {transactionValue(
                          'type',
                          selectedTransaction.type,
                          'type.other',
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="font-bold text-slate-400">
                        {labels.status}
                      </span>
                      <span className="font-black text-slate-800 dark:text-slate-100">
                        {transactionValue(
                          'status',
                          selectedTransaction.statusValue,
                          'status.unknown',
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="font-bold text-slate-400">
                        {labels.date}
                      </span>
                      <span className="text-end font-black text-slate-800 dark:text-slate-100">
                        {new Date(
                          selectedTransaction.timestamp,
                        ).toLocaleString(i18n.resolvedLanguage)}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <h3 className="font-black text-slate-900 dark:text-white">
                    {labels.financial}
                  </h3>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="font-bold text-slate-400">
                        {labels.amount}
                      </span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {formatAmount(selectedTransaction)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="font-bold text-slate-400">
                        {labels.currency}
                      </span>
                      <span className="font-black text-slate-800 dark:text-slate-100">
                        {selectedTransaction.currencyValue}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <h3 className="font-black text-slate-900 dark:text-white">
                  {labels.parties}
                </h3>

                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="text-start">
                    <p className="text-xs font-black text-slate-400">
                      {labels.source}
                    </p>
                    <p className="mt-1 font-black text-slate-800 dark:text-slate-100">
                      {selectedTransaction.sourceValue}
                    </p>
                  </div>

                  <div className="text-start">
                    <p className="text-xs font-black text-slate-400">
                      {labels.target}
                    </p>
                    <p className="mt-1 font-black text-slate-800 dark:text-slate-100">
                      {selectedTransaction.targetValue}
                    </p>
                  </div>
                </div>
              </section>

              {selectedTransaction.note && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <h3 className="font-black text-amber-800 dark:text-amber-300">
                    {labels.notes}
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-amber-700 dark:text-amber-200">
                    {selectedTransaction.note}
                  </p>
                </section>
              )}

              <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedTransaction(null)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  {labels.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Transactions;