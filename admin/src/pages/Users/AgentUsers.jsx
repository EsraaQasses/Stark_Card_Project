import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';

const AgentUsers = () => {
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
      setError(loadError.response?.data?.detail || loadError.response?.data?.error || 'Failed to load the agent’s customers.');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="m-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-secondary-dark-bg md:m-8 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Agents</p><h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Agent #{agentId} customers</h1><p className="mt-1 text-sm text-gray-500">Customers currently assigned to this agent.</p></div><div className="flex gap-2"><button type="button" onClick={load} disabled={loading} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700">Refresh</button><Link to="/agents" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Back to agents</Link></div></div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">{loading ? <div className="p-10 text-center text-gray-500">Loading customers…</div> : users.length === 0 ? <div className="p-10 text-center text-gray-500">This agent has no assigned customers.</div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{['ID', 'Customer', 'Email', 'Phone', 'Status'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{users.map((user) => <tr key={user.id}><td className="px-4 py-3 text-gray-500">#{user.id}</td><td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{user.full_name || user.name || user.username || '—'}</td><td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user.email || '—'}</td><td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user.phone || '—'}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.is_active === false || user.is_banned ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{user.is_banned ? 'Banned' : user.is_active === false ? 'Inactive' : 'Active'}</span></td></tr>)}</tbody></table></div>}</div>
    </div>
  );
};

export default AgentUsers;
