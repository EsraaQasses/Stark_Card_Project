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
  FiRefreshCw,
  FiSearch,
  FiServer,
  FiShield,
  FiTrash2,
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

const inputClass = `
  w-full
  rounded-xl
  border
  border-slate-200
  bg-white
  px-3.5
  py-2.5
  text-sm
  text-slate-900
  outline-none
  transition-all
  duration-200
  placeholder:text-slate-400
  focus:border-cyan-400
  focus:ring-2
  focus:ring-cyan-100
  dark:border-slate-700
  dark:bg-slate-900
  dark:text-white
  dark:focus:ring-cyan-900/30
`;

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

  const [tab, setTab] = useState('audit');

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditCount, setAuditCount] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditNext, setAuditNext] = useState(false);
  const [auditPrevious, setAuditPrevious] = useState(false);

  const [systemLogs, setSystemLogs] = useState([]);
  const [systemPage, setSystemPage] = useState(1);

  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    user_id: '',
    start_date: '',
    end_date: '',
  });

  const [appliedFilters, setAppliedFilters] = useState(filters);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const locale = (
    i18n.resolvedLanguage
    || i18n.language
  );

  const dateTime = (value) => (
    value
      ? new Date(value).toLocaleString(locale)
      : '—'
  );

  const runtimeLabel = (prefix, value) => (
    localizeRuntimeValue({
      t,
      i18n,
      value,
      namespace: 'activity',
      prefix: `operationalLogs.${prefix}`,
      fallback: () => (
        t('operationalLogs.labels.unknownSystemValue')
      ),
    })
  );

  // ====================================================
  // Audit logs
  // ====================================================

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

      setAuditLogs(
        listFrom(response.data),
      );

      setAuditCount(
        response.data?.count
        ?? listFrom(response.data).length,
      );

      setAuditNext(
        Boolean(response.data?.next),
      );

      setAuditPrevious(
        Boolean(response.data?.previous),
      );
    } catch (loadError) {
      setError(
        errorMessage(
          loadError,
          t('operationalLogs.errors.audit'),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [
    appliedFilters,
    auditPage,
    t,
  ]);

  // ====================================================
  // System logs
  // ====================================================

  const loadSystem = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axiosInstance.get(
        '/system/system-logs/',
      );

      setSystemLogs(
        listFrom(response.data),
      );
    } catch (loadError) {
      setError(
        errorMessage(
          loadError,
          t('operationalLogs.errors.system'),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (tab === 'audit') {
      loadAudit();
    } else {
      loadSystem();
    }
  }, [
    tab,
    loadAudit,
    loadSystem,
  ]);

  // ====================================================
  // System pagination
  // ====================================================

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

  // ====================================================
  // Filters
  // ====================================================

  const applyFilters = (event) => {
    event.preventDefault();

    setAuditPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    const cleared = {
      action: '',
      resource_type: '',
      user_id: '',
      start_date: '',
      end_date: '',
    };

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

  const auditHeaders = [
    'time',
    'admin',
    'action',
    'resource',
    'ip',
    'details',
  ];

  const systemHeaders = [
    'time',
    'user',
    'operation',
    'url',
    'ip',
    'description',
  ];

  const currentRows = tab === 'audit'
    ? auditLogs
    : displayedSystemLogs;

  return (
    <div
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
          space-y-6
        "
      >
        {/* =========================================
            Header
        ========================================= */}

        <section
          className="
            relative
            overflow-hidden
            rounded-2xl
            border
            border-slate-100
            bg-white
            px-5
            py-5
            shadow-sm
            dark:border-slate-800
            dark:bg-secondary-dark-bg
            md:px-7
            md:py-6
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              -start-16
              -top-20
              h-52
              w-52
              rounded-full
              opacity-[0.07]
            "
            style={{
              backgroundColor: currentColor,
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
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="
                    text-sm
                    font-bold
                    md:text-base
                  "
                  style={{
                    color: currentColor,
                  }}
                >
                  {t(
                    'operationalLogs.category',
                  )}
                </span>
              </div>

              <h1
                className="
                  text-2xl
                  font-extrabold
                  tracking-tight
                  text-slate-900
                  dark:text-white
                  md:text-3xl
                  lg:text-4xl
                "
              >
                {t(
                  'operationalLogs.title',
                )}
              </h1>

              <p
                className="
                  mt-2
                  max-w-2xl
                  text-sm
                  leading-6
                  text-slate-500
                  dark:text-slate-400
                "
              >
                {t(
                  'operationalLogs.subtitle',
                )}
              </p>

              <div
                className="
                  mt-4
                  flex
                  items-center
                  gap-1.5
                "
              >
                <span
                  className="h-1 w-14 rounded-full"
                  style={{
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="
                    h-1
                    w-6
                    rounded-full
                    opacity-60
                  "
                  style={{
                    backgroundColor: currentColor,
                  }}
                />

                <span
                  className="
                    h-1
                    w-2
                    rounded-full
                    opacity-30
                  "
                  style={{
                    backgroundColor: currentColor,
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              style={{
                backgroundColor: currentColor,
              }}
              className="
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                px-5
                py-2.5
                text-sm
                font-bold
                text-white
                shadow-md
                transition-all
                duration-200
                hover:opacity-90
                hover:shadow-lg
                active:scale-95
                disabled:cursor-not-allowed
                disabled:opacity-60
                sm:w-auto
              "
            >
              <FiRefreshCw
                className={
                  loading
                    ? 'animate-spin'
                    : ''
                }
              />

              {t(
                'operationalLogs.refresh',
              )}
            </button>
          </div>
        </section>

        {/* =========================================
            Tabs
        ========================================= */}

        <div className="flex justify-start">
          <div
            className="
              inline-flex
              items-center
              gap-1
              rounded-xl
              border
              border-slate-200
              bg-slate-100
              p-1
              dark:border-slate-700
              dark:bg-slate-800
            "
          >
            {[
              'audit',
              'system',
            ].map((value) => {
              const active = tab === value;

              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => {
                    setTab(value);
                    setError('');

                    if (value === 'system') {
                      setSystemPage(1);
                    }
                  }}
                  style={
                    active
                      ? {
                          backgroundColor: currentColor,
                        }
                      : undefined
                  }
                  className={`
                    flex
                    items-center
                    gap-2
                    rounded-lg
                    px-4
                    py-2
                    text-sm
                    font-bold
                    transition-all
                    duration-200

                    ${
                      active
                        ? 'text-white shadow-sm'
                        : `
                          text-slate-500
                          hover:bg-white
                          hover:text-slate-800
                          dark:text-slate-400
                          dark:hover:bg-slate-700
                          dark:hover:text-white
                        `
                    }
                  `}
                >
                  {value === 'audit'
                    ? <FiShield />
                    : <FiServer />}

                  {t(
                    `operationalLogs.tabs.${value}`,
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* =========================================
            Error
        ========================================= */}

        {error && (
          <div
            className="
              flex
              items-start
              gap-3
              rounded-xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3.5
              text-sm
              text-red-700
              dark:border-red-900
              dark:bg-red-950/30
              dark:text-red-300
            "
          >
            <FiAlertCircle
              className="
                mt-0.5
                flex-shrink-0
                text-lg
              "
            />

            <span className="flex-1">
              {error}
            </span>

            <button
              type="button"
              onClick={() => setError('')}
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-lg
                hover:bg-red-100
                dark:hover:bg-red-900/50
              "
            >
              <FiX />
            </button>
          </div>
        )}

        {/* =========================================
            Filters
        ========================================= */}

        {tab === 'audit' && (
          <section
            className="
              rounded-2xl
              border
              border-slate-100
              bg-white
              p-5
              shadow-sm
              dark:border-slate-800
              dark:bg-secondary-dark-bg
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
                  color: currentColor,
                  backgroundColor: `${currentColor}15`,
                }}
              >
                <FiFilter />
              </div>

              <div>
                <p
                  className="
                    font-extrabold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {t(
                    'operationalLogs.tabs.audit',
                  )}
                </p>

                <p
                  className="
                    text-xs
                    text-slate-400
                  "
                >
                  {auditCount}
                </p>
              </div>
            </div>

            <form
              onSubmit={applyFilters}
              className="
                grid
                gap-3
                md:grid-cols-2
                xl:grid-cols-6
              "
            >
              <input
                className={inputClass}
                placeholder={t(
                  'operationalLogs.filters.action',
                )}
                value={filters.action}
                onChange={(event) => (
                  setFilters({
                    ...filters,
                    action: event.target.value,
                  })
                )}
              />

              <input
                className={inputClass}
                placeholder={t(
                  'operationalLogs.filters.resourceType',
                )}
                value={filters.resource_type}
                onChange={(event) => (
                  setFilters({
                    ...filters,
                    resource_type: event.target.value,
                  })
                )}
              />

              <input
                className={inputClass}
                type="number"
                min="1"
                placeholder={t(
                  'operationalLogs.filters.adminUserId',
                )}
                value={filters.user_id}
                onChange={(event) => (
                  setFilters({
                    ...filters,
                    user_id: event.target.value,
                  })
                )}
              />

              <input
                className={inputClass}
                type="date"
                aria-label={t(
                  'operationalLogs.filters.startDate',
                )}
                value={filters.start_date}
                onChange={(event) => (
                  setFilters({
                    ...filters,
                    start_date: event.target.value,
                  })
                )}
              />

              <input
                className={inputClass}
                type="date"
                aria-label={t(
                  'operationalLogs.filters.endDate',
                )}
                value={filters.end_date}
                onChange={(event) => (
                  setFilters({
                    ...filters,
                    end_date: event.target.value,
                  })
                )}
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  style={{
                    backgroundColor: currentColor,
                  }}
                  className="
                    flex
                    flex-1
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    px-3
                    py-2.5
                    text-sm
                    font-bold
                    text-white
                    transition-all
                    hover:opacity-90
                  "
                >
                  <FiSearch />

                  {t(
                    'operationalLogs.filters.apply',
                  )}
                </button>

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
                    px-3
                    py-2.5
                    text-sm
                    font-semibold
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

                  {t(
                    'operationalLogs.filters.clear',
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* =========================================
            Logs Card
        ========================================= */}

        <section
          className="
            min-w-0
            overflow-hidden
            rounded-2xl
            border
            border-slate-100
            bg-white
            shadow-sm
            dark:border-slate-800
            dark:bg-secondary-dark-bg
          "
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
                  color: currentColor,
                  backgroundColor: `${currentColor}15`,
                }}
              >
                {tab === 'audit'
                  ? <FiShield />
                  : <FiActivity />}
              </div>

              <div>
                <h2
                  className="
                    font-extrabold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {t(
                    `operationalLogs.tabs.${tab}`,
                  )}
                </h2>

                <p
                  className="
                    mt-0.5
                    text-xs
                    text-slate-400
                  "
                >
                  {tab === 'audit'
                    ? auditCount
                    : systemLogs.length}
                </p>
              </div>
            </div>
          </div>

          {/* Loading */}

          {loading && (
            <div
              className="
                flex
                min-h-[320px]
                items-center
                justify-center
              "
            >
              <div
                className="
                  flex
                  flex-col
                  items-center
                  gap-3
                  text-slate-400
                "
              >
                <FiRefreshCw
                  className="
                    animate-spin
                    text-3xl
                  "
                />

                <span className="text-sm">
                  {t(
                    'operationalLogs.loading',
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Empty */}

          {!loading && currentRows.length === 0 && (
            <div
              className="
                flex
                min-h-[320px]
                flex-col
                items-center
                justify-center
                px-5
                text-center
              "
            >
              <div
                className="
                  mb-3
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-slate-100
                  text-2xl
                  text-slate-400
                  dark:bg-slate-800
                "
              >
                <FiActivity />
              </div>

              <p
                className="
                  font-semibold
                  text-slate-500
                  dark:text-slate-400
                "
              >
                {t(
                  'operationalLogs.empty',
                )}
              </p>
            </div>
          )}

          {/* Tables */}

          {!loading && currentRows.length > 0 && (
            <div className="overflow-x-auto">
              {tab === 'audit' ? (
                <table
                  className="
                    min-w-full
                    divide-y
                    divide-slate-100
                    text-sm
                    dark:divide-slate-800
                  "
                >
                  <thead
                    className="
                      bg-slate-50
                      dark:bg-slate-900/60
                    "
                  >
                    <tr>
                      {auditHeaders.map((heading) => (
                        <th
                          key={heading}
                          className="
                            whitespace-nowrap
                            px-4
                            py-3.5
                            text-start
                            text-xs
                            font-bold
                            text-slate-500
                            dark:text-slate-400
                          "
                        >
                          {t(
                            `operationalLogs.auditHeaders.${heading}`,
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody
                    className="
                      divide-y
                      divide-slate-100
                      dark:divide-slate-800
                    "
                  >
                    {auditLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="
                          transition-colors
                          hover:bg-slate-50/70
                          dark:hover:bg-slate-800/40
                        "
                      >
                        <td
                          className="
                            whitespace-nowrap
                            px-4
                            py-4
                            text-xs
                            text-slate-500
                          "
                        >
                          <div
                            className="
                              flex
                              items-center
                              gap-2
                            "
                          >
                            <FiClock />

                            {dateTime(
                              log.created_at,
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <p
                            className="
                              font-bold
                              text-slate-900
                              dark:text-white
                            "
                          >
                            {log.user_name
                              || t(
                                'operationalLogs.labels.userNumber',
                                {
                                  id: log.user ?? '—',
                                },
                              )}
                          </p>

                          <p
                            className="
                              mt-0.5
                              text-xs
                              text-slate-400
                            "
                            dir="ltr"
                          >
                            {log.user_email || ''}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className="
                              inline-flex
                              rounded-full
                              bg-cyan-50
                              px-2.5
                              py-1
                              text-xs
                              font-bold
                              text-cyan-700
                              dark:bg-cyan-950/30
                              dark:text-cyan-300
                            "
                          >
                            {runtimeLabel(
                              'actions',
                              log.action,
                            )}
                          </span>
                        </td>

                        <td
                          className="
                            px-4
                            py-4
                            text-slate-700
                            dark:text-slate-200
                          "
                        >
                          {runtimeLabel(
                            'resources',
                            log.resource_type,
                          )}

                          {log.resource_id && (
                            <>
                              {' '}
                              <bdi>
                                #{log.resource_id}
                              </bdi>
                            </>
                          )}
                        </td>

                        <td
                          className="
                            whitespace-nowrap
                            px-4
                            py-4
                            text-xs
                            text-slate-500
                          "
                          dir="ltr"
                        >
                          {log.ip_address || '—'}
                        </td>

                        <td
                          className="
                            max-w-sm
                            px-4
                            py-4
                          "
                        >
                          <pre
                            className="
                              max-h-28
                              overflow-auto
                              whitespace-pre-wrap
                              rounded-lg
                              bg-slate-50
                              p-2.5
                              text-xs
                              text-slate-600
                              dark:bg-slate-900
                              dark:text-slate-300
                            "
                            dir="ltr"
                          >
                            {log.details
                              ? JSON.stringify(
                                  log.details,
                                  null,
                                  2,
                                )
                              : '—'}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table
                  className="
                    min-w-full
                    divide-y
                    divide-slate-100
                    text-sm
                    dark:divide-slate-800
                  "
                >
                  <thead
                    className="
                      bg-slate-50
                      dark:bg-slate-900/60
                    "
                  >
                    <tr>
                      {systemHeaders.map((heading) => (
                        <th
                          key={heading}
                          className="
                            whitespace-nowrap
                            px-4
                            py-3.5
                            text-start
                            text-xs
                            font-bold
                            text-slate-500
                            dark:text-slate-400
                          "
                        >
                          {t(
                            `operationalLogs.systemHeaders.${heading}`,
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody
                    className="
                      divide-y
                      divide-slate-100
                      dark:divide-slate-800
                    "
                  >
                    {displayedSystemLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="
                          transition-colors
                          hover:bg-slate-50/70
                          dark:hover:bg-slate-800/40
                        "
                      >
                        <td
                          className="
                            whitespace-nowrap
                            px-4
                            py-4
                            text-xs
                            text-slate-500
                          "
                        >
                          {dateTime(
                            log.created_at,
                          )}
                        </td>

                        <td
                          className="
                            px-4
                            py-4
                            font-bold
                            text-slate-900
                            dark:text-white
                          "
                        >
                          {log.user_name
                            || t(
                              'operationalLogs.labels.system',
                            )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className="
                              inline-flex
                              rounded-full
                              bg-violet-50
                              px-2.5
                              py-1
                              text-xs
                              font-bold
                              text-violet-700
                              dark:bg-violet-950/30
                              dark:text-violet-300
                            "
                          >
                            {runtimeLabel(
                              'operations',
                              log.operation_type
                              || log.operation_name,
                            )}
                          </span>
                        </td>

                        <td
                          className="
                            max-w-xs
                            break-all
                            px-4
                            py-4
                            text-xs
                            text-slate-500
                          "
                          dir="ltr"
                        >
                          {log.url || '—'}
                        </td>

                        <td
                          className="
                            whitespace-nowrap
                            px-4
                            py-4
                            text-xs
                            text-slate-500
                          "
                          dir="ltr"
                        >
                          {log.ip_address || '—'}
                        </td>

                        <td
                          className="
                            max-w-sm
                            px-4
                            py-4
                            text-slate-600
                            dark:text-slate-300
                          "
                        >
                          {log.description || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        {/* =========================================
            Pagination
        ========================================= */}

        {!loading
          && tab === 'audit'
          && (
            auditPrevious
            || auditNext
          ) && (
          <div
            className="
              flex
              flex-col
              items-center
              justify-between
              gap-3
              rounded-xl
              border
              border-slate-100
              bg-white
              px-4
              py-3
              dark:border-slate-800
              dark:bg-secondary-dark-bg
              sm:flex-row
            "
          >
            <span
              className="
                text-sm
                text-slate-500
                dark:text-slate-400
              "
            >
              {t(
                'operationalLogs.labels.auditCount',
                {
                  count: auditCount,
                },
              )}
            </span>

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
                    (page) => Math.max(
                      1,
                      page - 1,
                    ),
                  )
                )}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-slate-200
                  text-slate-500
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                  dark:border-slate-700
                  dark:hover:bg-slate-800
                "
              >
                <FiChevronRight />
              </button>

              <span
                className="
                  min-w-[80px]
                  text-center
                  text-sm
                  font-bold
                  text-slate-700
                  dark:text-slate-200
                "
              >
                {t(
                  'operationalLogs.labels.page',
                  {
                    page: auditPage,
                  },
                )}
              </span>

              <button
                type="button"
                disabled={!auditNext}
                onClick={() => (
                  setAuditPage(
                    (page) => page + 1,
                  )
                )}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-slate-200
                  text-slate-500
                  transition
                  hover:bg-slate-50
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                  dark:border-slate-700
                  dark:hover:bg-slate-800
                "
              >
                <FiChevronLeft />
              </button>
            </div>
          </div>
        )}

        {!loading
          && tab === 'system'
          && systemPages > 1 && (
          <div
            className="
              flex
              flex-col
              items-center
              justify-between
              gap-3
              rounded-xl
              border
              border-slate-100
              bg-white
              px-4
              py-3
              dark:border-slate-800
              dark:bg-secondary-dark-bg
              sm:flex-row
            "
          >
            <span
              className="
                text-sm
                text-slate-500
                dark:text-slate-400
              "
            >
              {t(
                'operationalLogs.labels.systemCount',
                {
                  count: systemLogs.length,
                },
              )}
            </span>

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
                    (page) => page - 1,
                  )
                )}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-slate-200
                  text-slate-500
                  transition
                  hover:bg-slate-50
                  disabled:opacity-30
                  dark:border-slate-700
                  dark:hover:bg-slate-800
                "
              >
                <FiChevronRight />
              </button>

              <span
                className="
                  min-w-[100px]
                  text-center
                  text-sm
                  font-bold
                  text-slate-700
                  dark:text-slate-200
                "
              >
                {t(
                  'operationalLogs.labels.pageOf',
                  {
                    page: systemPage,
                    pages: systemPages,
                  },
                )}
              </span>

              <button
                type="button"
                disabled={
                  systemPage === systemPages
                }
                onClick={() => (
                  setSystemPage(
                    (page) => page + 1,
                  )
                )}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-slate-200
                  text-slate-500
                  transition
                  hover:bg-slate-50
                  disabled:opacity-30
                  dark:border-slate-700
                  dark:hover:bg-slate-800
                "
              >
                <FiChevronLeft />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationalLogs;