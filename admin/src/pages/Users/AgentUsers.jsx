import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../../utils/axiosConfig';

const AgentUsers = () => {
  const { t } = useTranslation(['agents', 'common']);
  const { agentId } = useParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get(`/agents/${agentId}/users/`);
      setUsers(Array.isArray(response.data) ? response.data : response.data?.results || []);
    } catch (loadError) {
      setError(loadError.response?.data?.detail || loadError.response?.data?.error || t('agentUsers.error'));
    } finally {
      setLoading(false);
    }
  }, [agentId, t]);

  useEffect(() => { load(); }, [load]);

  const headings = ['id', 'customer', 'email', 'phone', 'status'];

  return (
    <div className="m-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-secondary-dark-bg md:m-8 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{t('agentUsers.category')}</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{t('agentUsers.title', { id: agentId })}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('agentUsers.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} disabled={loading} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700">{t('agentUsers.refresh')}</button>
          <Link to="/agents" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{t('agentUsers.back')}</Link>
        </div>
      </div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        {loading ? <div className="p-10 text-center text-gray-500">{t('agentUsers.loading')}</div> : users.length === 0 ? <div className="p-10 text-center text-gray-500">{t('agentUsers.empty')}</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800"><tr>{headings.map((heading) => <th key={heading} className="px-4 py-3 text-start font-semibold text-gray-600 dark:text-gray-300">{t(`agentUsers.headers.${heading}`)}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-gray-500" dir="ltr">#{user.id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{user.full_name || user.name || user.username || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300" dir="ltr">{user.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300" dir="ltr">{user.phone || '—'}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.is_active === false || user.is_banned ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{user.is_banned ? t('agentUsers.status.banned') : user.is_active === false ? t('agentUsers.status.inactive') : t('agentUsers.status.active')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentUsers;
