import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../../utils/axiosConfig';

const PAGE_SIZE = 25;
const listFrom = (data) => (Array.isArray(data) ? data : data?.results || []);
const errorMessage = (error, fallback) => error?.response?.data?.detail || error?.response?.data?.error || fallback;
const inputClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white';

const OperationalLogs = () => {
  const { t, i18n } = useTranslation(['activity', 'common']);
  const [tab, setTab] = useState('audit');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditCount, setAuditCount] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditNext, setAuditNext] = useState(false);
  const [auditPrevious, setAuditPrevious] = useState(false);
  const [systemLogs, setSystemLogs] = useState([]);
  const [systemPage, setSystemPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', resource_type: '', user_id: '', start_date: '', end_date: '' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const locale = i18n.resolvedLanguage || i18n.language;
  const dateTime = (value) => (value ? new Date(value).toLocaleString(locale) : '—');

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page: auditPage };
      Object.entries(appliedFilters).forEach(([key, value]) => { if (value) params[key] = value; });
      const response = await axiosInstance.get('/users/audit-logs/', { params });
      setAuditLogs(listFrom(response.data));
      setAuditCount(response.data?.count ?? listFrom(response.data).length);
      setAuditNext(Boolean(response.data?.next));
      setAuditPrevious(Boolean(response.data?.previous));
    } catch (loadError) {
      setError(errorMessage(loadError, t('operationalLogs.errors.audit')));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, auditPage, t]);

  const loadSystem = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get('/system/system-logs/');
      setSystemLogs(listFrom(response.data));
    } catch (loadError) {
      setError(errorMessage(loadError, t('operationalLogs.errors.system')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { if (tab === 'audit') loadAudit(); else loadSystem(); }, [loadAudit, loadSystem, tab]);

  const displayedSystemLogs = useMemo(() => {
    const start = (systemPage - 1) * PAGE_SIZE;
    return systemLogs.slice(start, start + PAGE_SIZE);
  }, [systemLogs, systemPage]);
  const systemPages = Math.max(1, Math.ceil(systemLogs.length / PAGE_SIZE));

  const applyFilters = (event) => {
    event.preventDefault();
    setAuditPage(1);
    setAppliedFilters(filters);
  };
  const clearFilters = () => {
    const cleared = { action: '', resource_type: '', user_id: '', start_date: '', end_date: '' };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setAuditPage(1);
  };
  const auditHeaders = ['time', 'admin', 'action', 'resource', 'ip', 'details'];
  const systemHeaders = ['time', 'user', 'operation', 'url', 'ip', 'description'];

  return (
    <div className="m-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-secondary-dark-bg md:m-8 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{t('operationalLogs.category')}</p><h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{t('operationalLogs.title')}</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('operationalLogs.subtitle')}</p></div>
        <button type="button" onClick={tab === 'audit' ? loadAudit : loadSystem} disabled={loading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">{t('operationalLogs.refresh')}</button>
      </div>
      <div className="mb-5 flex gap-2 border-b border-gray-200 dark:border-gray-700">{['audit', 'system'].map((value) => <button type="button" key={value} onClick={() => setTab(value)} className={`border-b-2 px-4 py-2 text-sm font-bold ${tab === value ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>{t(`operationalLogs.tabs.${value}`)}</button>)}</div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {tab === 'audit' && (
        <form onSubmit={applyFilters} className="mb-5 grid gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50 md:grid-cols-3 xl:grid-cols-6">
          <input className={inputClass} placeholder={t('operationalLogs.filters.action')} value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })} />
          <input className={inputClass} placeholder={t('operationalLogs.filters.resourceType')} value={filters.resource_type} onChange={(event) => setFilters({ ...filters, resource_type: event.target.value })} />
          <input className={inputClass} type="number" min="1" placeholder={t('operationalLogs.filters.adminUserId')} value={filters.user_id} onChange={(event) => setFilters({ ...filters, user_id: event.target.value })} />
          <input className={inputClass} type="date" aria-label={t('operationalLogs.filters.startDate')} value={filters.start_date} onChange={(event) => setFilters({ ...filters, start_date: event.target.value })} />
          <input className={inputClass} type="date" aria-label={t('operationalLogs.filters.endDate')} value={filters.end_date} onChange={(event) => setFilters({ ...filters, end_date: event.target.value })} />
          <div className="flex gap-2"><button type="submit" className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white">{t('operationalLogs.filters.apply')}</button><button type="button" onClick={clearFilters} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">{t('operationalLogs.filters.clear')}</button></div>
        </form>
      )}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        {loading ? <div className="p-10 text-center text-gray-500">{t('operationalLogs.loading')}</div> : (tab === 'audit' ? auditLogs : displayedSystemLogs).length === 0 ? <div className="p-10 text-center text-gray-500">{t('operationalLogs.empty')}</div> : (
          <div className="overflow-x-auto">
            {tab === 'audit' ? (
              <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{auditHeaders.map((heading) => <th key={heading} className="px-4 py-3 text-start font-semibold text-gray-600 dark:text-gray-300">{t(`operationalLogs.auditHeaders.${heading}`)}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{auditLogs.map((log) => <tr key={log.id}><td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">{dateTime(log.created_at)}</td><td className="px-4 py-3"><p className="font-semibold text-gray-900 dark:text-white">{log.user_name || t('operationalLogs.labels.userNumber', { id: log.user ?? '—' })}</p><p className="text-xs text-gray-500" dir="ltr">{log.user_email || ''}</p></td><td className="px-4 py-3"><span className="rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{log.action}</span></td><td className="px-4 py-3 text-gray-700 dark:text-gray-200">{log.resource_type || '—'} {log.resource_id ? <bdi>#{log.resource_id}</bdi> : ''}</td><td className="px-4 py-3 text-gray-600 dark:text-gray-300" dir="ltr">{log.ip_address || '—'}</td><td className="max-w-sm px-4 py-3"><pre className="max-h-28 overflow-auto whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300" dir="ltr">{log.details ? JSON.stringify(log.details, null, 2) : '—'}</pre></td></tr>)}</tbody></table>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{systemHeaders.map((heading) => <th key={heading} className="px-4 py-3 text-start font-semibold text-gray-600 dark:text-gray-300">{t(`operationalLogs.systemHeaders.${heading}`)}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{displayedSystemLogs.map((log) => <tr key={log.id}><td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">{dateTime(log.created_at)}</td><td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{log.user_name || t('operationalLogs.labels.system')}</td><td className="px-4 py-3"><p className="font-semibold text-gray-800 dark:text-gray-100">{log.operation_name || log.operation_type}</p><p className="text-xs text-gray-500">{log.operation_type}</p></td><td className="max-w-xs break-all px-4 py-3 text-gray-600 dark:text-gray-300" dir="ltr">{log.url || '—'}</td><td className="px-4 py-3 text-gray-600 dark:text-gray-300" dir="ltr">{log.ip_address || '—'}</td><td className="max-w-sm px-4 py-3 text-gray-600 dark:text-gray-300">{log.description || '—'}</td></tr>)}</tbody></table>
            )}
          </div>
        )}
      </div>
      {!loading && tab === 'audit' && (auditPrevious || auditNext) && <div className="mt-4 flex items-center justify-between"><span className="text-sm text-gray-500">{t('operationalLogs.labels.auditCount', { count: auditCount })}</span><div className="flex gap-2"><button type="button" disabled={!auditPrevious} onClick={() => setAuditPage((page) => Math.max(1, page - 1))} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700">{t('operationalLogs.buttons.previous')}</button><span className="px-2 py-1.5 text-sm">{t('operationalLogs.labels.page', { page: auditPage })}</span><button type="button" disabled={!auditNext} onClick={() => setAuditPage((page) => page + 1)} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700">{t('operationalLogs.buttons.next')}</button></div></div>}
      {!loading && tab === 'system' && systemPages > 1 && <div className="mt-4 flex items-center justify-between"><span className="text-sm text-gray-500">{t('operationalLogs.labels.systemCount', { count: systemLogs.length })}</span><div className="flex gap-2"><button type="button" disabled={systemPage === 1} onClick={() => setSystemPage((page) => page - 1)} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700">{t('operationalLogs.buttons.previous')}</button><span className="px-2 py-1.5 text-sm">{t('operationalLogs.labels.pageOf', { page: systemPage, pages: systemPages })}</span><button type="button" disabled={systemPage === systemPages} onClick={() => setSystemPage((page) => page + 1)} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700">{t('operationalLogs.buttons.next')}</button></div></div>}
    </div>
  );
};

export default OperationalLogs;
