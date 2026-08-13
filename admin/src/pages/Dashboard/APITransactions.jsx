import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../../utils/axiosConfig';

const APITransactions = () => {
  const { t, i18n } = useTranslation(['transactions', 'common']);
  const [searchParams] = useSearchParams();
  const apiId = searchParams.get('api');
  const apiName = searchParams.get('name') || (apiId ? t('apiTransactions.apiNumber', { id: apiId }) : t('apiTransactions.allApis'));
  const [transactions, setTransactions] = useState([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = apiId
        ? await axiosInstance.get(`/third_party_apis/apis/${apiId}/transactions/`, { params: { limit, offset } })
        : await axiosInstance.get('/third_party_apis/transactions/', { params: { limit, offset } });
      const data = response.data;
      const rows = Array.isArray(data) ? data : data?.transactions || data?.results || [];
      setTransactions(rows);
      setTotal(data?.total ?? data?.count ?? rows.length);
    } catch (loadError) {
      setError(loadError.response?.data?.detail || loadError.response?.data?.error || t('apiTransactions.error'));
    } finally {
      setLoading(false);
    }
  }, [apiId, offset, t]);

  useEffect(() => { load(); }, [load]);

  const headings = ['time', 'api', 'endpoint', 'http', 'result', 'externalId', 'error'];
  const locale = i18n.resolvedLanguage || i18n.language;

  return (
    <div className="m-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-secondary-dark-bg md:m-8 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{t('apiTransactions.category')}</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{t('apiTransactions.title', { name: apiName })}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('apiTransactions.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} disabled={loading} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700">{t('apiTransactions.refresh')}</button>
          <Link to="/api" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{t('apiTransactions.back')}</Link>
        </div>
      </div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        {loading ? <div className="p-10 text-center text-gray-500">{t('apiTransactions.loading')}</div> : transactions.length === 0 ? <div className="p-10 text-center text-gray-500">{t('apiTransactions.empty')}</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800"><tr>{headings.map((heading) => <th key={heading} className="px-4 py-3 text-start font-semibold text-gray-600 dark:text-gray-300">{t(`apiTransactions.headers.${heading}`)}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{transaction.request_timestamp ? new Date(transaction.request_timestamp).toLocaleString(locale) : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{transaction.api_name || t('apiTransactions.apiNumber', { id: transaction.api_config || apiId || '—' })}</td>
                    <td className="max-w-xs break-all px-4 py-3 text-gray-600 dark:text-gray-300" dir="ltr">{transaction.endpoint_used || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300" dir="ltr">{transaction.http_status_code ?? '—'}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${transaction.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{transaction.success ? t('apiTransactions.result.success') : t('apiTransactions.result.failed')}</span></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300" dir="ltr">{transaction.external_transaction_id || '—'}</td>
                    <td className="max-w-sm px-4 py-3 text-red-600">{transaction.error_message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && total > limit && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">{t('apiTransactions.count', { count: total })}</span>
          <div className="flex gap-2">
            <button type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - limit))} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700">{t('apiTransactions.previous')}</button>
            <span className="px-2 py-1.5 text-sm">{Math.floor(offset / limit) + 1}</span>
            <button type="button" disabled={offset + limit >= total} onClick={() => setOffset((value) => value + limit)} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700">{t('apiTransactions.next')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default APITransactions;
