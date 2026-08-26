import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FiActivity,
  FiAlertCircle,
  FiBarChart2,
  FiCheck,
  FiClock,
  FiDatabase,
  FiExternalLink,
  FiKey,
  FiLink,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiServer,
  FiSettings,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProviderDistribution from '../../components/ProviderDistribution';

import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

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

const getApiError = (error, fallback) => {
  const data = error?.response?.data;

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  return (
    data?.error
    || data?.detail
    || data?.message
    || error?.message
    || fallback
  );
};

const getProviderName = (provider, isArabic) => {
  const map = {
    daily: isArabic ? 'ديلي' : 'Daily',
    alfaour: isArabic ? 'الفاغور' : 'Alfaour',
    alaaeddin: isArabic ? 'علاء الدين' : 'Alaaeddin',
  };

  return map[provider] || provider || (isArabic ? 'غير محدد' : 'Unknown');
};

const formatLimit = (value, isArabic) => {
  if (value === null || value === undefined || value === '') {
    return isArabic ? 'بلا حد' : 'No limit';
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return numeric.toLocaleString(isArabic ? 'ar-SY' : 'en-US', {
    maximumFractionDigits: 2,
  });
};

const StatCard = ({
  icon,
  label,
  value,
  helper,
  accentColor,
}) => (
  <div
    className="
      rounded-2xl border border-slate-100 bg-white p-4 shadow-sm
      transition duration-200 hover:-translate-y-0.5 hover:shadow-md
      dark:border-slate-800 dark:bg-secondary-dark-bg
    "
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 text-start">
        <p className="text-xs font-extrabold text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
          {value}
        </p>
        {helper && (
          <p className="mt-1 truncate text-xs font-semibold text-slate-400">
            {helper}
          </p>
        )}
      </div>

      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg"
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

const StatusBadge = ({ active, isArabic }) => (
  <span
    className={`
      inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black
      ${
        active
          ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
          : 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/40'
      }
    `}
  >
    <span
      className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-current' : 'bg-red-500'}`}
    />
    {active
      ? (isArabic ? 'نشط' : 'Active')
      : (isArabic ? 'غير نشط' : 'Inactive')}
  </span>
);

const ConnectionBadge = ({ connected, isArabic, accentColor }) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ring-1"
    style={connected
      ? {
        backgroundColor: `${accentColor}10`,
        color: accentColor,
        boxShadow: `inset 0 0 0 1px ${accentColor}22`,
      }
      : undefined}
  >
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={{
        backgroundColor: connected ? accentColor : '#94a3b8',
      }}
    />
    {connected
      ? (isArabic ? 'متصل' : 'Connected')
      : (isArabic ? 'غير متصل' : 'Disconnected')}
  </span>
);

const InfoRow = ({ icon, label, value, dir }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
    <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-400">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
    <p
      dir={dir}
      className="break-words text-sm font-black text-slate-800 dark:text-slate-100"
    >
      {value || '—'}
    </p>
  </div>
);

const ApiCard = ({
  api,
  isArabic,
  accentColor,
  testing,
  syncing,
  onTest,
  onSync,
  onLogs,
}) => {
  const providerName = getProviderName(api.provider, isArabic);

  return (
    <article
      className="
        overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm
        transition duration-200 hover:-translate-y-0.5 hover:shadow-md
        dark:border-slate-800 dark:bg-secondary-dark-bg
      "
    >
      <div className="border-b border-slate-100 p-5 dark:border-slate-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
              style={{
                backgroundColor: `${accentColor}14`,
                color: accentColor,
              }}
            >
              <FiServer />
            </div>

            <div className="min-w-0 text-start">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-black text-slate-950 dark:text-white">
                  {api.name || (isArabic ? 'واجهة بدون اسم' : 'Unnamed API')}
                </h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  #{api.id}
                </span>
              </div>

              <p className="mt-1 text-xs font-bold text-slate-400">
                {providerName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge active={Boolean(api.is_active)} isArabic={isArabic} />
            <ConnectionBadge
              connected={Boolean(api.is_connected)}
              isArabic={isArabic}
              accentColor={accentColor}
            />
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoRow
            icon={<FiLink />}
            label={isArabic ? 'الرابط الأساسي' : 'Base URL'}
            value={api.base_url}
            dir="ltr"
          />
          <InfoRow
            icon={<FiZap />}
            label={isArabic ? 'الأولوية' : 'Priority'}
            value={String(api.priority ?? 1)}
          />
          <InfoRow
            icon={<FiClock />}
            label={isArabic ? 'الحد اليومي' : 'Daily limit'}
            value={formatLimit(api.max_daily_limit, isArabic)}
          />
          <InfoRow
            icon={<FiPackage />}
            label={isArabic ? 'عدد المنتجات' : 'Products'}
            value={String(api.products_count ?? 0)}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <InfoRow
            icon={<FiKey />}
            label={isArabic ? 'مفتاح API' : 'API key'}
            value={api.encrypted_api_key
              ? (isArabic ? 'مُعد ومشفّر' : 'Configured & encrypted')
              : (isArabic ? 'غير محدد' : 'Not configured')}
          />
          <InfoRow
            icon={<FiSettings />}
            label={isArabic ? 'الوصف' : 'Description'}
            value={api.description || (isArabic ? 'لا يوجد وصف' : 'No description')}
          />
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={testing}
            onClick={onTest}
            className="
              inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4
              text-sm font-black text-white transition hover:opacity-90
              disabled:cursor-not-allowed disabled:opacity-50
            "
            style={{ backgroundColor: accentColor }}
          >
            {testing ? <FiRefreshCw className="animate-spin" /> : <FiActivity />}
            {testing
              ? (isArabic ? 'جاري الاختبار...' : 'Testing...')
              : (isArabic ? 'اختبار الاتصال' : 'Test connection')}
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={onSync}
            className="
              inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border
              border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition
              hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50
              dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800
            "
          >
            {syncing ? <FiRefreshCw className="animate-spin" /> : <FiRefreshCw />}
            {syncing
              ? (isArabic ? 'جاري المزامنة...' : 'Syncing...')
              : (isArabic ? 'مزامنة المنتجات' : 'Sync products')}
          </button>

          <button
            type="button"
            onClick={onLogs}
            className="
              inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border
              border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-600 transition
              hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70
              dark:text-slate-300 dark:hover:bg-slate-800
            "
          >
            <FiBarChart2 />
            {isArabic ? 'السجلات' : 'Logs'}
            <FiExternalLink className="text-xs" />
          </button>
        </div>
      </div>
    </article>
  );
};

const ModalShell = ({
  open,
  title,
  subtitle,
  onClose,
  busy,
  accentColor,
  children,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="relative overflow-hidden border-b border-slate-100 px-5 py-5 dark:border-slate-800 md:px-6">
          <div
            className="pointer-events-none absolute -end-16 -top-20 h-40 w-40 rounded-full opacity-[0.08]"
            style={{ backgroundColor: accentColor }}
          />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0 text-start">
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                {title}
              </h3>
              {subtitle && (
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white"
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

const FieldLabel = ({ children }) => (
  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
    {children}
  </span>
);

const fieldClassName = `
  w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold
  text-slate-900 outline-none transition focus:border-slate-400
  dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-slate-500
`;

const AddApiModal = ({
  open,
  onClose,
  onSave,
  busy,
  isArabic,
  accentColor,
}) => {
  const initialForm = useMemo(() => ({
    name: '',
    provider: 'daily',
    base_url: '',
    description: '',
    api_key: '',
    priority: 1,
    max_daily_limit: '',
    is_active: true,
  }), []);

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setErrors({});
    }
  }, [initialForm, open]);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((previous) => ({
        ...previous,
        [field]: '',
      }));
    }
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = isArabic ? 'اسم الـ API مطلوب.' : 'API name is required.';
    }

    if (!form.base_url.trim()) {
      nextErrors.base_url = isArabic ? 'الرابط الأساسي مطلوب.' : 'Base URL is required.';
    } else {
      try {
        new URL(form.base_url);
      } catch (_) {
        nextErrors.base_url = isArabic ? 'الرابط غير صالح.' : 'Invalid URL.';
      }
    }

    if (!form.api_key.trim()) {
      nextErrors.api_key = isArabic ? 'مفتاح API مطلوب.' : 'API key is required.';
    }

    const priority = Number(form.priority);
    if (!Number.isFinite(priority) || priority < 1 || priority > 10) {
      nextErrors.priority = isArabic
        ? 'الأولوية يجب أن تكون بين 1 و10.'
        : 'Priority must be between 1 and 10.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const saved = await onSave(form);
    if (saved) {
      setForm(initialForm);
      setErrors({});
    }
  };

  return (
    <ModalShell
      open={open}
      title={isArabic ? 'إضافة واجهة API جديدة' : 'Add new API'}
      subtitle={isArabic
        ? 'أدخل بيانات المزود والاتصال ثم احفظ الواجهة.'
        : 'Enter provider and connection details, then save.'}
      onClose={onClose}
      busy={busy}
      accentColor={accentColor}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <FieldLabel>{isArabic ? 'اسم API' : 'API name'}</FieldLabel>
            <input
              type="text"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              className={`${fieldClassName} ${errors.name ? 'border-red-400' : ''}`}
              placeholder={isArabic ? 'مثال: Daily' : 'Example: Daily'}
            />
            {errors.name && (
              <p className="mt-1 text-xs font-bold text-red-500">{errors.name}</p>
            )}
          </label>

          <label className="block">
            <FieldLabel>{isArabic ? 'المزود' : 'Provider'}</FieldLabel>
            <select
              value={form.provider}
              onChange={(event) => updateField('provider', event.target.value)}
              className={fieldClassName}
            >
              <option value="daily">Daily</option>
              <option value="alfaour">Alfaour</option>
              <option value="alaaeddin">Alaaeddin</option>
            </select>
          </label>
        </div>

        <label className="block">
          <FieldLabel>{isArabic ? 'الرابط الأساسي' : 'Base URL'}</FieldLabel>
          <input
            type="url"
            dir="ltr"
            value={form.base_url}
            onChange={(event) => updateField('base_url', event.target.value)}
            className={`${fieldClassName} ${errors.base_url ? 'border-red-400' : ''}`}
            placeholder="https://api.example.com"
          />
          {errors.base_url && (
            <p className="mt-1 text-xs font-bold text-red-500">{errors.base_url}</p>
          )}
        </label>

        <label className="block">
          <FieldLabel>{isArabic ? 'مفتاح API' : 'API key'}</FieldLabel>
          <input
            type="password"
            dir="ltr"
            value={form.api_key}
            onChange={(event) => updateField('api_key', event.target.value)}
            className={`${fieldClassName} ${errors.api_key ? 'border-red-400' : ''}`}
            placeholder="••••••••••••••••"
          />
          {errors.api_key && (
            <p className="mt-1 text-xs font-bold text-red-500">{errors.api_key}</p>
          )}
        </label>

        <label className="block">
          <FieldLabel>{isArabic ? 'الوصف' : 'Description'}</FieldLabel>
          <textarea
            rows="3"
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            className={`${fieldClassName} resize-none`}
            placeholder={isArabic ? 'ملاحظات اختيارية عن المزود...' : 'Optional provider notes...'}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <FieldLabel>{isArabic ? 'الأولوية' : 'Priority'}</FieldLabel>
            <input
              type="number"
              min="1"
              max="10"
              value={form.priority}
              onChange={(event) => updateField('priority', event.target.value)}
              className={`${fieldClassName} ${errors.priority ? 'border-red-400' : ''}`}
            />
            {errors.priority && (
              <p className="mt-1 text-xs font-bold text-red-500">{errors.priority}</p>
            )}
          </label>

          <label className="block">
            <FieldLabel>{isArabic ? 'الحد اليومي' : 'Daily limit'}</FieldLabel>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.max_daily_limit}
              onChange={(event) => updateField('max_daily_limit', event.target.value)}
              className={fieldClassName}
              placeholder={isArabic ? 'اتركه فارغاً بلا حد' : 'Leave empty for no limit'}
            />
          </label>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => updateField('is_active', event.target.checked)}
            className="h-4 w-4 rounded"
          />
          <div className="text-start">
            <p className="text-sm font-black text-slate-800 dark:text-slate-100">
              {isArabic ? 'تفعيل الواجهة مباشرة' : 'Activate immediately'}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">
              {isArabic
                ? 'يمكن تغيير حالة الاتصال لاحقاً من إعدادات المزود.'
                : 'Connection status can be changed later from provider settings.'}
            </p>
          </div>
        </label>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {busy ? <FiRefreshCw className="animate-spin" /> : <FiPlus />}
            {busy
              ? (isArabic ? 'جاري الإضافة...' : 'Adding...')
              : (isArabic ? 'إضافة الواجهة' : 'Add API')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

const Api = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { currentColor } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    eyebrow: isArabic ? 'لوحة التحكم' : 'Dashboard',
    title: isArabic ? 'إعدادات API' : 'API Settings',
    subtitle: isArabic
      ? 'إدارة واجهات الربط الخارجية، اختبار الاتصال، ومزامنة المنتجات.'
      : 'Manage external integrations, test connectivity, and sync products.',
    add: isArabic ? 'إضافة واجهة' : 'Add API',
    refresh: isArabic ? 'تحديث البيانات' : 'Refresh data',
    syncingAll: isArabic ? 'جاري المزامنة...' : 'Syncing...',
    syncAll: isArabic ? 'مزامنة كل الواجهات النشطة' : 'Sync all active APIs',
    total: isArabic ? 'إجمالي واجهات الربط' : 'Total APIs',
    active: isArabic ? 'الواجهات النشطة' : 'Active APIs',
    connected: isArabic ? 'واجهات متصلة' : 'Connected APIs',
    products: isArabic ? 'إجمالي المنتجات' : 'Total products',
    providers: isArabic ? 'توزيع المزودين' : 'Provider distribution',
    providersHint: isArabic
      ? 'عدد الواجهات المسجلة لكل مزود.'
      : 'Registered integrations by provider.',
    listTitle: isArabic ? 'واجهات الربط' : 'Integrations',
    listHint: isArabic
      ? 'اختبر الاتصال أو زامن المنتجات أو افتح سجل العمليات لكل واجهة.'
      : 'Test connectivity, sync products, or open operation logs for each integration.',
    search: isArabic ? 'ابحث باسم الواجهة أو الرابط...' : 'Search by name or URL...',
    allProviders: isArabic ? 'كل المزودين' : 'All providers',
    allStatuses: isArabic ? 'كل الحالات' : 'All statuses',
    activeOnly: isArabic ? 'نشط' : 'Active',
    inactiveOnly: isArabic ? 'غير نشط' : 'Inactive',
    noResults: isArabic
      ? 'لا توجد واجهات مطابقة للفلاتر الحالية.'
      : 'No APIs match the current filters.',
    empty: isArabic
      ? 'لا توجد واجهات API بعد. أضف أول واجهة للبدء.'
      : 'No APIs yet. Add your first integration to get started.',
    loadFailed: isArabic ? 'تعذر تحميل واجهات API.' : 'Failed to load APIs.',
    addSuccess: isArabic ? 'تمت إضافة واجهة API بنجاح.' : 'API added successfully.',
    addFailed: isArabic ? 'تعذر إضافة واجهة API.' : 'Failed to add API.',
    testSuccess: isArabic ? 'نجح اختبار الاتصال.' : 'Connection test succeeded.',
    testFailed: isArabic ? 'فشل اختبار الاتصال.' : 'Connection test failed.',
    syncSuccess: isArabic ? 'تمت مزامنة المنتجات.' : 'Products synced successfully.',
    syncFailed: isArabic ? 'تعذرت مزامنة المنتجات.' : 'Product sync failed.',
  }), [isArabic]);

  const [apis, setApis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [testingConnection, setTestingConnection] = useState(null);
  const [syncingProducts, setSyncingProducts] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const fetchApis = useCallback(async ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
    }

    setError('');

    try {
      const response = await axiosInstance.get('third_party_apis/apis/');
      const list = normalizeList(response.data);

      if (mountedRef.current) {
        setApis(list);
      }
    } catch (loadError) {
      if (mountedRef.current) {
        setError(getApiError(loadError, labels.loadFailed));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [labels.loadFailed]);

  useEffect(() => {
    fetchApis();
  }, [fetchApis]);

  const stats = useMemo(() => ({
    total: apis.length,
    active: apis.filter((item) => item.is_active).length,
    connected: apis.filter((item) => item.is_connected).length,
    products: apis.reduce(
      (sum, item) => sum + Number(item.products_count || 0),
      0,
    ),
  }), [apis]);

  const providerStats = useMemo(() => {
    const values = ['daily', 'alfaour', 'alaaeddin'];

    return values.map((provider) => ({
      provider,
      label: getProviderName(provider, isArabic),
      count: apis.filter((item) => item.provider === provider).length,
    }));
  }, [apis, isArabic]);

  const providerChartData = useMemo(() => (
    providerStats
      .filter((item) => item.count > 0)
      .map((item, index) => ({
        x: item.label,
        y: item.count,
        text: String(item.count),
        fill: [accentColor, '#64748b', '#cbd5e1'][index],
      }))
  ), [accentColor, providerStats]);

  const filteredApis = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    return apis.filter((item) => {
      const matchesSearch = !needle || [
        item.name,
        item.provider,
        item.base_url,
        item.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));

      const matchesProvider = (
        providerFilter === 'all'
        || item.provider === providerFilter
      );

      const matchesStatus = (
        statusFilter === 'all'
        || (statusFilter === 'active' && item.is_active)
        || (statusFilter === 'inactive' && !item.is_active)
      );

      return matchesSearch && matchesProvider && matchesStatus;
    });
  }, [apis, providerFilter, searchTerm, statusFilter]);

  const showNotice = (type, message, details = '') => {
    setNotice({ type, message, details });
  };

  const handleAddApi = async (form) => {
    setAdding(true);
    setError('');

    try {
      await axiosInstance.post('third_party_apis/apis/', {
        name: form.name.trim(),
        provider: form.provider,
        base_url: form.base_url.trim(),
        description: form.description.trim(),
        api_key: form.api_key.trim(),
        priority: Number(form.priority),
        max_daily_limit: form.max_daily_limit || null,
        is_active: Boolean(form.is_active),
      });

      if (!mountedRef.current) {
        return false;
      }

      setShowAddModal(false);
      showNotice('success', labels.addSuccess);
      await fetchApis({ background: true });
      return true;
    } catch (saveError) {
      if (mountedRef.current) {
        showNotice('error', labels.addFailed, getApiError(saveError, labels.addFailed));
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setAdding(false);
      }
    }
  };

  const handleTestConnection = async (api) => {
    setTestingConnection(api.id);
    setNotice(null);

    try {
      const response = await axiosInstance.post(
        `third_party_apis/apis/${api.id}/test_connection/`,
      );

      const result = response.data || {};
      const success = Boolean(result.connected || result.success);

      if (!success) {
        throw new Error(result.error || labels.testFailed);
      }

      const detailParts = [];

      if (result.balance_test?.success) {
        detailParts.push(
          `${isArabic ? 'الرصيد' : 'Balance'}: ${result.balance_test.balance ?? 'N/A'}`,
        );
      }

      if (result.products_test) {
        detailParts.push(
          `${isArabic ? 'المنتجات' : 'Products'}: ${result.products_test.products_count ?? 0}`,
        );
      }

      if (result.details) {
        detailParts.push(String(result.details));
      }

      showNotice('success', labels.testSuccess, detailParts.join(' • '));
      await fetchApis({ background: true });
    } catch (testError) {
      showNotice('error', labels.testFailed, getApiError(testError, labels.testFailed));
    } finally {
      if (mountedRef.current) {
        setTestingConnection(null);
      }
    }
  };

  const syncOneApi = async (api, { silent = false } = {}) => {
    if (!silent) {
      setSyncingProducts(api.id);
      setNotice(null);
    }

    try {
      const response = await axiosInstance.post(
        `third_party_apis/apis/${api.id}/sync_products/`,
      );

      if (!response.data?.success) {
        throw new Error(response.data?.error || labels.syncFailed);
      }

      if (!silent) {
        const detail = [
          `${isArabic ? 'جديد' : 'New'}: ${response.data.synced_count ?? 0}`,
          `${isArabic ? 'محدث' : 'Updated'}: ${response.data.updated_count ?? 0}`,
          `${isArabic ? 'نشط' : 'Active'}: ${response.data.active_products ?? 0}/${response.data.total_products ?? 0}`,
        ].join(' • ');

        showNotice('success', labels.syncSuccess, detail);
      }

      return true;
    } catch (syncError) {
      if (!silent) {
        showNotice('error', labels.syncFailed, getApiError(syncError, labels.syncFailed));
      }
      return false;
    } finally {
      if (!silent && mountedRef.current) {
        setSyncingProducts(null);
      }
    }
  };

  const handleSyncProducts = async (api) => {
    const success = await syncOneApi(api);

    if (success) {
      await fetchApis({ background: true });
    }
  };

  const handleSyncAll = async () => {
    const activeApis = apis.filter((item) => item.is_active);

    if (!activeApis.length) {
      showNotice(
        'error',
        isArabic ? 'لا توجد واجهات نشطة للمزامنة.' : 'No active APIs to sync.',
      );
      return;
    }

    setSyncingAll(true);
    setNotice(null);

    try {
      const results = await Promise.all(
        activeApis.map((api) => syncOneApi(api, { silent: true })),
      );

      const successCount = results.filter(Boolean).length;
      const failedCount = results.length - successCount;

      showNotice(
        failedCount ? 'error' : 'success',
        failedCount
          ? (isArabic ? 'اكتملت المزامنة مع بعض الأخطاء.' : 'Sync completed with some errors.')
          : (isArabic ? 'تمت مزامنة كل الواجهات النشطة.' : 'All active APIs synced.'),
        `${isArabic ? 'نجح' : 'Succeeded'}: ${successCount} • ${isArabic ? 'فشل' : 'Failed'}: ${failedCount}`,
      );

      await fetchApis({ background: true });
    } finally {
      if (mountedRef.current) {
        setSyncingAll(false);
      }
    }
  };

  const openLogs = (api) => {
    navigate(
      `/api-transactions?api=${api.id}&name=${encodeURIComponent(api.name || '')}`,
    );
  };

  if (loading && !apis.length) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <FiRefreshCw className="animate-spin text-3xl" />
          <span className="text-sm font-bold">
            {isArabic ? 'جاري تحميل واجهات API...' : 'Loading APIs...'}
          </span>
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
          <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg md:p-7">
            <div
              className="pointer-events-none absolute -start-24 -top-24 h-64 w-64 rounded-full opacity-[0.08]"
              style={{ backgroundColor: accentColor }}
            />

            <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl text-white shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  <FiServer />
                </div>

                <div className="min-w-0 text-start">
                  <p
                    className="text-xs font-black uppercase tracking-[0.18em]"
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
                  disabled={loading}
                  onClick={() => fetchApis({ background: true })}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                  {labels.refresh}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: accentColor }}
                >
                  <FiPlus />
                  {labels.add}
                </button>
              </div>
            </div>
          </section>

          {notice && (
            <div
              className={`
                flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold
                ${
                  notice.type === 'success'
                    ? 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
                }
              `}
            >
              {notice.type === 'success'
                ? <FiCheck className="mt-0.5 shrink-0" style={{ color: accentColor }} />
                : <FiAlertCircle className="mt-0.5 shrink-0" />}

              <div className="min-w-0 flex-1 text-start">
                <p>{notice.message}</p>
                {notice.details && (
                  <p className="mt-1 text-xs font-semibold opacity-80">
                    {notice.details}
                  </p>
                )}
              </div>

              <button type="button" onClick={() => setNotice(null)}>
                <FiX />
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<FiDatabase />}
              label={labels.total}
              value={stats.total}
              helper={`${stats.active} ${isArabic ? 'نشطة' : 'active'}`}
              accentColor={accentColor}
            />
            <StatCard
              icon={<FiActivity />}
              label={labels.active}
              value={stats.active}
              helper={isArabic ? 'جاهزة للاستخدام' : 'Ready to use'}
              accentColor={accentColor}
            />
            <StatCard
              icon={<FiLink />}
              label={labels.connected}
              value={stats.connected}
              helper={`${stats.total - stats.connected} ${isArabic ? 'غير متصلة' : 'disconnected'}`}
              accentColor={accentColor}
            />
            <StatCard
              icon={<FiPackage />}
              label={labels.products}
              value={stats.products.toLocaleString(isArabic ? 'ar-SY' : 'en-US')}
              helper={isArabic ? 'منتجات مرتبطة بالمزودين' : 'Products across providers'}
              accentColor={accentColor}
            />
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-start">
                <h2 className="text-lg font-black text-slate-950 dark:text-white">
                  {labels.providers}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {labels.providersHint}
                </p>
              </div>

              <button
                type="button"
                disabled={syncingAll}
                onClick={handleSyncAll}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FiRefreshCw className={syncingAll ? 'animate-spin' : ''} />
                {syncingAll ? labels.syncingAll : labels.syncAll}
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="min-h-[320px] rounded-2xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                {providerChartData.length ? (
                  <ProviderDistribution
                    data={providerStats
                      .filter((item) => item.count > 0)
                      .map((item) => ({
                        x: item.label,
                        y: item.count,
                      }))}
                    emptyText={
                      isArabic
                        ? 'لا توجد بيانات للمخطط.'
                        : 'No chart data available.'
                    }
                  />
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-sm font-bold text-slate-400">
                    {isArabic ? 'لا توجد بيانات للمخطط.' : 'No chart data available.'}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {providerStats.map((item) => (
                  <div
                    key={item.provider}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-start">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          {isArabic ? 'عدد واجهات الربط' : 'Registered APIs'}
                        </p>
                      </div>
                      <span
                        className="flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-black"
                        style={{
                          backgroundColor: `${accentColor}14`,
                          color: accentColor,
                        }}
                      >
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="text-start">
                <h2 className="text-lg font-black text-slate-950 dark:text-white">
                  {labels.listTitle}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {labels.listHint}
                </p>
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-auto">
                <div className="relative min-w-[240px]">
                  <FiSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={labels.search}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white ps-10 pe-3 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>

                <select
                  value={providerFilter}
                  onChange={(event) => setProviderFilter(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="all">{labels.allProviders}</option>
                  <option value="daily">Daily</option>
                  <option value="alfaour">Alfaour</option>
                  <option value="alaaeddin">Alaaeddin</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="all">{labels.allStatuses}</option>
                  <option value="active">{labels.activeOnly}</option>
                  <option value="inactive">{labels.inactiveOnly}</option>
                </select>
              </div>
            </div>
          </section>

          {!apis.length ? (
            <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-secondary-dark-bg">
              <FiServer className="mx-auto text-4xl text-slate-300" />
              <p className="mt-3 text-sm font-black text-slate-500 dark:text-slate-300">
                {labels.empty}
              </p>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white"
                style={{ backgroundColor: accentColor }}
              >
                <FiPlus />
                {labels.add}
              </button>
            </section>
          ) : !filteredApis.length ? (
            <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-black text-slate-400 dark:border-slate-700 dark:bg-secondary-dark-bg">
              {labels.noResults}
            </section>
          ) : (
            <div className="space-y-4">
              {filteredApis.map((api) => (
                <ApiCard
                  key={api.id}
                  api={api}
                  isArabic={isArabic}
                  accentColor={accentColor}
                  testing={testingConnection === api.id}
                  syncing={syncingProducts === api.id}
                  onTest={() => handleTestConnection(api)}
                  onSync={() => handleSyncProducts(api)}
                  onLogs={() => openLogs(api)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AddApiModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddApi}
        busy={adding}
        isArabic={isArabic}
        accentColor={accentColor}
      />
    </>
  );
};

export default Api;