import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  FiActivity,
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFilter,
  FiGlobe,
  FiHash,
  FiRefreshCw,
  FiSearch,
  FiServer,
  FiShield,
  FiTrash2,
  FiUser,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { localizeRuntimeValue } from '../../utils/runtimeLocalization';
import { useStateContext } from '../../contexts/ContextProvider';

const PAGE_SIZE = 25;

const listFrom = (data) => (
  Array.isArray(data)
    ? data
    : data?.results || []
);

const errorMessage = (error, fallback) => (
  error?.response?.data?.detail
  || error?.response?.data?.error
  || fallback
);

const createEmptyFilters = () => ({
  action: '',
  resource_type: '',
  user_id: '',
  start_date: '',
  end_date: '',
});

const getInitials = (value) => {
  const text = String(value || '').trim();

  if (!text) {
    return 'U';
  }

  const parts = text
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

const humanizeValue = (value) => {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return '—';
  }

  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(
      /(^|\s)\S/g,
      (letter) => letter.toUpperCase(),
    );
};

const inputClass = `
  h-11
  w-full
  rounded-xl
  border
  border-slate-200
  bg-white
  px-3.5
  text-sm
  font-semibold
  text-slate-900
  outline-none
  transition
  placeholder:text-slate-400
  focus:border-slate-300
  focus:ring-4
  focus:ring-slate-100
  dark:border-slate-700
  dark:bg-slate-900
  dark:text-white
  dark:focus:ring-slate-800
`;

const StatCard = ({
  icon,
  label,
  value,
  accentColor,
}) => (
  <div
    className="
      flex
      items-center
      gap-3
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
        text-lg
      "
      style={{
        backgroundColor: `${accentColor}14`,
        color: accentColor,
      }}
    >
      {icon}
    </div>

    <div className="min-w-0 text-start">
      <p
        className="
          truncate
          text-xs
          font-bold
          text-slate-400
        "
      >
        {label}
      </p>

      <p
        className="
          mt-0.5
          text-xl
          font-black
          text-slate-900
          dark:text-white
        "
      >
        {value}
      </p>
    </div>
  </div>
);

const MetaItem = ({
  icon,
  label,
  value,
  dir,
}) => (
  <div
    className="
      min-w-0
      rounded-xl
      border
      border-slate-100
      bg-slate-50/70
      p-3
      dark:border-slate-700
      dark:bg-slate-900/40
    "
  >
    <div
      className="
        mb-1.5
        flex
        items-center
        gap-1.5
        text-[11px]
        font-bold
        text-slate-400
      "
    >
      {icon}
      {label}
    </div>

    <p
      dir={dir}
      className="
        truncate
        text-sm
        font-extrabold
        text-slate-800
        dark:text-slate-100
      "
      title={
        value === null
        || value === undefined
          ? ''
          : String(value)
      }
    >
      {value === null
        || value === undefined
        || value === ''
        ? '—'
        : String(value)}
    </p>
  </div>
);

const DetailsPanel = ({
  details,
  labels,
  accentColor,
}) => {
  if (!details) {
    return null;
  }

  const entries = (
    typeof details === 'object'
    && !Array.isArray(details)
  )
    ? Object.entries(details)
    : [];

  return (
    <details
      className="
        mt-4
        overflow-hidden
        rounded-xl
        border
        border-slate-100
        bg-white
        dark:border-slate-700
        dark:bg-slate-900
      "
    >
      <summary
        className="
          cursor-pointer
          select-none
          px-4
          py-3
          text-sm
          font-extrabold
          text-slate-600
          transition
          hover:bg-slate-50
          dark:text-slate-300
          dark:hover:bg-slate-800
        "
      >
        <span
          style={{
            color: accentColor,
          }}
        >
          {labels.showDetails}
        </span>
      </summary>

      <div
        className="
          border-t
          border-slate-100
          p-4
          dark:border-slate-800
        "
      >
        {entries.length > 0 && (
          <div
            className="
              mb-4
              grid
              gap-2
              sm:grid-cols-2
              lg:grid-cols-3
            "
          >
            {entries
              .slice(0, 9)
              .map(([key, value]) => (
                <div
                  key={key}
                  className="
                    rounded-xl
                    bg-slate-50
                    p-3
                    dark:bg-slate-800/70
                  "
                >
                  <p
                    className="
                      text-[11px]
                      font-bold
                      text-slate-400
                    "
                  >
                    {humanizeValue(key)}
                  </p>

                  <p
                    className="
                      mt-1
                      break-words
                      text-sm
                      font-extrabold
                      text-slate-800
                      dark:text-slate-100
                    "
                    dir={
                      typeof value === 'number'
                      || /^-?\d+([.,]\d+)?$/.test(
                        String(value || ''),
                      )
                        ? 'ltr'
                        : undefined
                    }
                  >
                    {typeof value === 'object'
                    && value !== null
                      ? JSON.stringify(value)
                      : String(value ?? '—')}
                  </p>
                </div>
              ))}
          </div>
        )}

        <div
          className="
            rounded-xl
            bg-slate-950
            p-4
          "
        >
          <pre
            className="
              max-h-72
              overflow-auto
              whitespace-pre-wrap
              break-words
              text-xs
              leading-6
              text-slate-200
            "
            dir="ltr"
          >
            {JSON.stringify(
              details,
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </details>
  );
};

const OperationalLogs = () => {
  const {
    t,
    i18n,
  } = useTranslation([
    'activity',
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

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    category: t(
      'operationalLogs.category',
      isArabic
        ? 'المراقبة والتدقيق'
        : 'Monitoring & Audit',
    ),

    title: t(
      'operationalLogs.title',
      isArabic
        ? 'سجلات التشغيل'
        : 'Operational Logs',
    ),

    subtitle: t(
      'operationalLogs.subtitle',
      isArabic
        ? 'راجع نشاط الإدارة وسجلات النظام بشكل واضح ومنظم.'
        : 'Review administrator activity and system logs in a clear, organized view.',
    ),

    refresh: t(
      'operationalLogs.refresh',
      isArabic
        ? 'تحديث البيانات'
        : 'Refresh',
    ),

    audit: t(
      'operationalLogs.tabs.audit',
      isArabic
        ? 'سجل التدقيق'
        : 'Audit log',
    ),

    system: t(
      'operationalLogs.tabs.system',
      isArabic
        ? 'سجل النظام'
        : 'System log',
    ),

    totalRecords: isArabic
      ? 'إجمالي السجلات'
      : 'Total records',

    currentPage: isArabic
      ? 'الصفحة الحالية'
      : 'Current page',

    activeFilters: isArabic
      ? 'الفلاتر المطبقة'
      : 'Active filters',

    shownRecords: isArabic
      ? 'السجلات الظاهرة'
      : 'Visible records',

    filterTitle: isArabic
      ? 'تصفية سجل التدقيق'
      : 'Filter audit log',

    filterSubtitle: isArabic
      ? 'استخدم الحقول التالية للوصول للسجل المطلوب بسرعة.'
      : 'Use the fields below to quickly find the record you need.',

    action: t(
      'operationalLogs.filters.action',
      isArabic
        ? 'الإجراء'
        : 'Action',
    ),

    resourceType: t(
      'operationalLogs.filters.resourceType',
      isArabic
        ? 'نوع المورد'
        : 'Resource type',
    ),

    adminId: t(
      'operationalLogs.filters.adminUserId',
      isArabic
        ? 'معرف المدير'
        : 'Admin ID',
    ),

    startDate: t(
      'operationalLogs.filters.startDate',
      isArabic
        ? 'من تاريخ'
        : 'From date',
    ),

    endDate: t(
      'operationalLogs.filters.endDate',
      isArabic
        ? 'إلى تاريخ'
        : 'To date',
    ),

    apply: t(
      'operationalLogs.filters.apply',
      isArabic
        ? 'تطبيق'
        : 'Apply',
    ),

    clear: t(
      'operationalLogs.filters.clear',
      isArabic
        ? 'مسح'
        : 'Clear',
    ),

    loading: t(
      'operationalLogs.loading',
      isArabic
        ? 'جاري تحميل السجلات...'
        : 'Loading logs...',
    ),

    empty: t(
      'operationalLogs.empty',
      isArabic
        ? 'لا توجد سجلات.'
        : 'No logs found.',
    ),

    time: isArabic
      ? 'الوقت'
      : 'Time',

    admin: isArabic
      ? 'المدير'
      : 'Administrator',

    user: isArabic
      ? 'المستخدم'
      : 'User',

    resource: isArabic
      ? 'المورد'
      : 'Resource',

    ip: isArabic
      ? 'عنوان IP'
      : 'IP address',

    operation: isArabic
      ? 'العملية'
      : 'Operation',

    url: isArabic
      ? 'الرابط'
      : 'URL',

    description: isArabic
      ? 'الوصف'
      : 'Description',

    showDetails: isArabic
      ? 'عرض التفاصيل'
      : 'Show details',

    recordNumber: isArabic
      ? 'سجل'
      : 'Record',

    systemUser: t(
      'operationalLogs.labels.system',
      isArabic
        ? 'النظام'
        : 'System',
    ),

    page: isArabic
      ? 'صفحة'
      : 'Page',

    of: isArabic
      ? 'من'
      : 'of',
  }), [
    isArabic,
    t,
  ]);

  const [tab, setTab] = useState('audit');

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditCount, setAuditCount] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditNext, setAuditNext] = useState(false);
  const [auditPrevious, setAuditPrevious] = useState(false);

  const [systemLogs, setSystemLogs] = useState([]);
  const [systemPage, setSystemPage] = useState(1);

  const [filters, setFilters] = useState(
    createEmptyFilters,
  );

  const [appliedFilters, setAppliedFilters] = useState(
    createEmptyFilters,
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const dateTime = useCallback(
    (value) => {
      if (!value) {
        return '—';
      }

      const date = new Date(value);

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return String(value);
      }

      return date.toLocaleString(
        locale,
      );
    },
    [locale],
  );

  const runtimeLabel = useCallback(
    (prefix, value) => {
      if (
        value === null
        || value === undefined
        || value === ''
      ) {
        return '—';
      }

      const normalized = String(value)
        .trim()
        .toUpperCase();

      if (
        prefix === 'actions'
        && normalized === 'BALANCE_ADJUSTMENT'
      ) {
        return isArabic
          ? 'تعديل الرصيد'
          : 'Balance adjustment';
      }

      return localizeRuntimeValue({
        t,
        i18n,
        value,
        namespace: 'activity',
        prefix: `operationalLogs.${prefix}`,
        fallback: () => humanizeValue(value),
      });
    },
    [
      i18n,
      isArabic,
      t,
    ],
  );

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        page: auditPage,
      };

      Object.entries(appliedFilters).forEach(
        ([key, value]) => {
          if (value) {
            params[key] = value;
          }
        },
      );

      const response = await axiosInstance.get(
        '/users/audit-logs/',
        {
          params,
        },
      );

      const rows = listFrom(
        response.data,
      );

      setAuditLogs(rows);

      setAuditCount(
        response.data?.count
        ?? rows.length,
      );

      setAuditNext(
        Boolean(
          response.data?.next,
        ),
      );

      setAuditPrevious(
        Boolean(
          response.data?.previous,
        ),
      );
    } catch (loadError) {
      setError(
        errorMessage(
          loadError,
          t(
            'operationalLogs.errors.audit',
            isArabic
              ? 'تعذر تحميل سجل التدقيق.'
              : 'Failed to load audit log.',
          ),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [
    appliedFilters,
    auditPage,
    isArabic,
    t,
  ]);

  const loadSystem = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axiosInstance.get(
        '/system/system-logs/',
      );

      setSystemLogs(
        listFrom(
          response.data,
        ),
      );
    } catch (loadError) {
      setError(
        errorMessage(
          loadError,
          t(
            'operationalLogs.errors.system',
            isArabic
              ? 'تعذر تحميل سجل النظام.'
              : 'Failed to load system log.',
          ),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [
    isArabic,
    t,
  ]);

  useEffect(() => {
    if (tab === 'audit') {
      loadAudit();
    } else {
      loadSystem();
    }
  }, [
    loadAudit,
    loadSystem,
    tab,
  ]);

  const displayedSystemLogs = useMemo(() => {
    const start = (
      systemPage - 1
    ) * PAGE_SIZE;

    return systemLogs.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [
    systemLogs,
    systemPage,
  ]);

  const systemPages = Math.max(
    1,
    Math.ceil(
      systemLogs.length / PAGE_SIZE,
    ),
  );

  const appliedFilterCount = useMemo(
    () => Object.values(
      appliedFilters,
    ).filter(Boolean).length,
    [appliedFilters],
  );

  const currentRows = (
    tab === 'audit'
      ? auditLogs
      : displayedSystemLogs
  );

  const currentTotal = (
    tab === 'audit'
      ? auditCount
      : systemLogs.length
  );

  const currentPage = (
    tab === 'audit'
      ? auditPage
      : systemPage
  );

  const applyFilters = (event) => {
    event.preventDefault();
    setAuditPage(1);
    setAppliedFilters({
      ...filters,
    });
  };

  const clearFilters = () => {
    const cleared = createEmptyFilters();

    setFilters(cleared);
    setAppliedFilters(cleared);
    setAuditPage(1);
  };

  const handleRefresh = () => {
    if (tab === 'audit') {
      loadAudit();
    } else {
      loadSystem();
    }
  };

  const updateFilter = (key, value) => {
    setFilters(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  };

  const renderAuditCard = (log, index) => {
    const userName = (
      log.user_name
      || t(
        'operationalLogs.labels.userNumber',
        {
          id: log.user ?? '—',
          defaultValue: isArabic
            ? `مستخدم #${log.user ?? '—'}`
            : `User #${log.user ?? '—'}`,
        },
      )
    );

    const actionLabel = runtimeLabel(
      'actions',
      log.action,
    );

    const resourceLabel = runtimeLabel(
      'resources',
      log.resource_type,
    );

    return (
      <article
        key={
          log.id
          || `audit-${auditPage}-${index}`
        }
        className="
          group
          rounded-2xl
          border
          border-slate-100
          bg-white
          p-4
          shadow-sm
          transition
          hover:border-slate-200
          hover:shadow-md
          dark:border-slate-800
          dark:bg-secondary-dark-bg
          dark:hover:border-slate-700
          sm:p-5
        "
      >
        <div
          className="
            flex
            flex-col
            gap-4
            lg:flex-row
            lg:items-start
            lg:justify-between
          "
        >
          <div
            className="
              flex
              min-w-0
              items-start
              gap-3
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
                text-lg
              "
              style={{
                backgroundColor: `${accentColor}14`,
                color: accentColor,
              }}
            >
              <FiShield />
            </div>

            <div className="min-w-0 text-start">
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
                    rounded-full
                    border
                    px-2.5
                    py-1
                    text-xs
                    font-black
                  "
                  style={{
                    backgroundColor: `${accentColor}10`,
                    borderColor: `${accentColor}28`,
                    color: accentColor,
                  }}
                >
                  {actionLabel}
                </span>

                {log.id && (
                  <span
                    className="
                      text-xs
                      font-bold
                      text-slate-400
                    "
                    dir="ltr"
                  >
                    #{log.id}
                  </span>
                )}
              </div>

              <div
                className="
                  mt-2
                  flex
                  flex-wrap
                  items-center
                  gap-x-3
                  gap-y-1
                "
              >
                <p
                  className="
                    font-black
                    text-slate-900
                    dark:text-white
                  "
                >
                  {userName}
                </p>

                {log.user_email && (
                  <p
                    dir="ltr"
                    className="
                      text-xs
                      font-semibold
                      text-slate-400
                    "
                  >
                    {log.user_email}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div
            className="
              flex
              shrink-0
              items-center
              gap-2
              text-xs
              font-bold
              text-slate-400
            "
          >
            <FiClock />
            <span>
              {dateTime(
                log.created_at,
              )}
            </span>
          </div>
        </div>

        <div
          className="
            mt-4
            grid
            gap-3
            md:grid-cols-3
          "
        >
          <MetaItem
            icon={<FiHash />}
            label={labels.resource}
            value={
              log.resource_id
                ? `${resourceLabel} #${log.resource_id}`
                : resourceLabel
            }
          />

          <MetaItem
            icon={<FiGlobe />}
            label={labels.ip}
            value={log.ip_address}
            dir="ltr"
          />

          <MetaItem
            icon={<FiUser />}
            label={labels.admin}
            value={
              log.user
                ? `#${log.user}`
                : '—'
            }
            dir="ltr"
          />
        </div>

        <DetailsPanel
          details={log.details}
          labels={labels}
          accentColor={accentColor}
        />
      </article>
    );
  };

  const renderSystemCard = (log, index) => {
    const operationLabel = runtimeLabel(
      'operations',
      log.operation_type
      || log.operation_name,
    );

    return (
      <article
        key={
          log.id
          || `system-${systemPage}-${index}`
        }
        className="
          rounded-2xl
          border
          border-slate-100
          bg-white
          p-4
          shadow-sm
          transition
          hover:border-slate-200
          hover:shadow-md
          dark:border-slate-800
          dark:bg-secondary-dark-bg
          dark:hover:border-slate-700
          sm:p-5
        "
      >
        <div
          className="
            flex
            flex-col
            gap-4
            lg:flex-row
            lg:items-start
            lg:justify-between
          "
        >
          <div
            className="
              flex
              min-w-0
              items-start
              gap-3
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
                text-lg
              "
              style={{
                backgroundColor: `${accentColor}14`,
                color: accentColor,
              }}
            >
              <FiServer />
            </div>

            <div className="min-w-0 text-start">
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
                    rounded-full
                    border
                    px-2.5
                    py-1
                    text-xs
                    font-black
                  "
                  style={{
                    backgroundColor: `${accentColor}10`,
                    borderColor: `${accentColor}28`,
                    color: accentColor,
                  }}
                >
                  {operationLabel}
                </span>

                {log.id && (
                  <span
                    className="
                      text-xs
                      font-bold
                      text-slate-400
                    "
                    dir="ltr"
                  >
                    #{log.id}
                  </span>
                )}
              </div>

              <p
                className="
                  mt-2
                  font-black
                  text-slate-900
                  dark:text-white
                "
              >
                {log.user_name
                  || labels.systemUser}
              </p>
            </div>
          </div>

          <div
            className="
              flex
              shrink-0
              items-center
              gap-2
              text-xs
              font-bold
              text-slate-400
            "
          >
            <FiClock />
            <span>
              {dateTime(
                log.created_at,
              )}
            </span>
          </div>
        </div>

        <div
          className="
            mt-4
            grid
            gap-3
            md:grid-cols-2
            xl:grid-cols-3
          "
        >
          <MetaItem
            icon={<FiGlobe />}
            label={labels.ip}
            value={log.ip_address}
            dir="ltr"
          />

          <MetaItem
            icon={<FiServer />}
            label={labels.url}
            value={log.url}
            dir="ltr"
          />

          <MetaItem
            icon={<FiActivity />}
            label={labels.description}
            value={log.description}
          />
        </div>
      </article>
    );
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
              pointer-events-none
              absolute
              -bottom-24
              end-10
              h-48
              w-48
              rounded-full
              opacity-[0.04]
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
              onClick={handleRefresh}
              disabled={loading}
              className="
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-2xl
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
                sm:w-auto
              "
              style={{
                backgroundColor: accentColor,
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
            rounded-2xl
            border
            border-slate-100
            bg-white
            p-2
            shadow-sm
            dark:border-slate-800
            dark:bg-secondary-dark-bg
          "
        >
          <div
            className="
              grid
              gap-2
              sm:grid-cols-2
            "
          >
            {[
              {
                id: 'audit',
                label: labels.audit,
                icon: <FiShield />,
              },
              {
                id: 'system',
                label: labels.system,
                icon: <FiServer />,
              },
            ].map((item) => {
              const active = (
                tab === item.id
              );

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setError('');

                    if (
                      item.id === 'system'
                    ) {
                      setSystemPage(1);
                    }
                  }}
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
                      active
                        ? 'text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                    }
                  `}
                  style={
                    active
                      ? {
                          backgroundColor: accentColor,
                        }
                      : undefined
                  }
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
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
          <StatCard
            icon={
              tab === 'audit'
                ? <FiShield />
                : <FiServer />
            }
            label={labels.totalRecords}
            value={currentTotal}
            accentColor={accentColor}
          />

          <StatCard
            icon={<FiHash />}
            label={labels.currentPage}
            value={currentPage}
            accentColor={accentColor}
          />

          <StatCard
            icon={<FiActivity />}
            label={labels.shownRecords}
            value={currentRows.length}
            accentColor={accentColor}
          />

          <StatCard
            icon={<FiFilter />}
            label={labels.activeFilters}
            value={
              tab === 'audit'
                ? appliedFilterCount
                : '—'
            }
            accentColor={accentColor}
          />
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
            <FiAlertCircle
              className="
                mt-0.5
                shrink-0
              "
            />

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

        {tab === 'audit' && (
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
                mb-5
                flex
                flex-col
                gap-3
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div
                className="
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
                    {labels.filterTitle}
                  </h2>

                  <p
                    className="
                      mt-0.5
                      text-xs
                      font-semibold
                      text-slate-400
                    "
                  >
                    {labels.filterSubtitle}
                  </p>
                </div>
              </div>

              {appliedFilterCount > 0 && (
                <span
                  className="
                    rounded-full
                    border
                    px-3
                    py-1
                    text-xs
                    font-black
                  "
                  style={{
                    backgroundColor: `${accentColor}10`,
                    borderColor: `${accentColor}28`,
                    color: accentColor,
                  }}
                >
                  {appliedFilterCount} {labels.activeFilters}
                </span>
              )}
            </div>

            <form
              onSubmit={applyFilters}
              className="
                grid
                gap-3
                md:grid-cols-2
                xl:grid-cols-5
              "
            >
              <input
                className={inputClass}
                placeholder={labels.action}
                value={filters.action}
                onChange={(event) => (
                  updateFilter(
                    'action',
                    event.target.value,
                  )
                )}
              />

              <input
                className={inputClass}
                placeholder={labels.resourceType}
                value={filters.resource_type}
                onChange={(event) => (
                  updateFilter(
                    'resource_type',
                    event.target.value,
                  )
                )}
              />

              <input
                className={inputClass}
                type="number"
                min="1"
                placeholder={labels.adminId}
                value={filters.user_id}
                onChange={(event) => (
                  updateFilter(
                    'user_id',
                    event.target.value,
                  )
                )}
              />

              <label
                className="
                  relative
                  block
                "
              >
                <span
                  className="
                    pointer-events-none
                    absolute
                    start-3.5
                    top-1/2
                    -translate-y-1/2
                    text-xs
                    font-bold
                    text-slate-400
                  "
                >
                  {labels.startDate}
                </span>

                <input
                  className={`
                    ${inputClass}
                    ps-24
                  `}
                  type="date"
                  aria-label={labels.startDate}
                  value={filters.start_date}
                  onChange={(event) => (
                    updateFilter(
                      'start_date',
                      event.target.value,
                    )
                  )}
                />
              </label>

              <label
                className="
                  relative
                  block
                "
              >
                <span
                  className="
                    pointer-events-none
                    absolute
                    start-3.5
                    top-1/2
                    -translate-y-1/2
                    text-xs
                    font-bold
                    text-slate-400
                  "
                >
                  {labels.endDate}
                </span>

                <input
                  className={`
                    ${inputClass}
                    ps-24
                  `}
                  type="date"
                  aria-label={labels.endDate}
                  value={filters.end_date}
                  onChange={(event) => (
                    updateFilter(
                      'end_date',
                      event.target.value,
                    )
                  )}
                />
              </label>

              <div
                className="
                  flex
                  gap-2
                  md:col-span-2
                  xl:col-span-5
                  xl:justify-end
                "
              >
                <button
                  type="button"
                  onClick={clearFilters}
                  className="
                    flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-4
                    py-2.5
                    text-sm
                    font-black
                    text-slate-600
                    transition
                    hover:bg-slate-50
                    dark:border-slate-700
                    dark:bg-slate-900
                    dark:text-slate-300
                    dark:hover:bg-slate-800
                  "
                >
                  <FiTrash2 />
                  {labels.clear}
                </button>

                <button
                  type="submit"
                  className="
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
                    hover:opacity-90
                  "
                  style={{
                    backgroundColor: accentColor,
                  }}
                >
                  <FiSearch />
                  {labels.apply}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="space-y-3">
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
              <FiRefreshCw
                className="
                  animate-spin
                  text-3xl
                "
              />

              <span className="text-sm font-bold">
                {labels.loading}
              </span>
            </div>
          ) : currentRows.length === 0 ? (
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
                <FiActivity className="text-2xl" />
              </div>

              <p
                className="
                  text-sm
                  font-bold
                  text-slate-400
                "
              >
                {labels.empty}
              </p>
            </div>
          ) : (
            currentRows.map(
              tab === 'audit'
                ? renderAuditCard
                : renderSystemCard,
            )
          )}
        </section>

        {!loading
          && tab === 'audit'
          && (
            auditPrevious
            || auditNext
          ) && (
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
              {labels.totalRecords}:{' '}
              <span
                className="
                  font-black
                  text-slate-900
                  dark:text-white
                "
              >
                {auditCount}
              </span>
            </p>

            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <button
                type="button"
                disabled={!auditPrevious}
                onClick={() => (
                  setAuditPage(
                    (value) => Math.max(
                      1,
                      value - 1,
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
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
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
                {labels.page} {auditPage}
              </div>

              <button
                type="button"
                disabled={!auditNext}
                onClick={() => (
                  setAuditPage(
                    (value) => value + 1,
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
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
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

        {!loading
          && tab === 'system'
          && systemPages > 1 && (
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
              {labels.totalRecords}:{' '}
              <span
                className="
                  font-black
                  text-slate-900
                  dark:text-white
                "
              >
                {systemLogs.length}
              </span>
            </p>

            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <button
                type="button"
                disabled={systemPage === 1}
                onClick={() => (
                  setSystemPage(
                    (value) => Math.max(
                      1,
                      value - 1,
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
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
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
                  min-w-[110px]
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
                {systemPage} / {systemPages}
              </div>

              <button
                type="button"
                disabled={
                  systemPage >= systemPages
                }
                onClick={() => (
                  setSystemPage(
                    (value) => Math.min(
                      systemPages,
                      value + 1,
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
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
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
  );
};

export default OperationalLogs;