import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axiosInstance from '../../utils/axiosConfig';

const listFrom = (data) => (Array.isArray(data) ? data : data?.results || []);
const messageFrom = (error, fallback) => error?.response?.data?.error || error?.response?.data?.detail || fallback;
const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white';

const AgentOperations = () => {
  const [tab, setTab] = useState('assignments');
  const [agents, setAgents] = useState([]);
  const [products, setProducts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [cashouts, setCashouts] = useState([]);
  const [cashoutPage, setCashoutPage] = useState(1);
  const [cashoutCount, setCashoutCount] = useState(0);
  const [cashoutNext, setCashoutNext] = useState(false);
  const [cashoutPrevious, setCashoutPrevious] = useState(false);
  const [cashoutStatus, setCashoutStatus] = useState('');
  const [assignmentForm, setAssignmentForm] = useState({ agent: '', product: '', commission_percent: '', is_active: true });
  const [regionForm, setRegionForm] = useState({ agent_id: '', region: '' });
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [agentResponse, productResponse, assignmentResponse] = await Promise.all([
        axiosInstance.get('/agents/agents/'),
        axiosInstance.get('/store/admin/products/'),
        axiosInstance.get('/agents/agent-product-assignments/'),
      ]);
      setAgents(listFrom(agentResponse.data));
      setProducts(listFrom(productResponse.data));
      setAssignments(listFrom(assignmentResponse.data));
    } catch (loadError) {
      setError(messageFrom(loadError, 'Failed to load agent operations data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCashouts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page: cashoutPage };
      if (cashoutStatus) params.status = cashoutStatus;
      const response = await axiosInstance.get('/agents/admin/cashout/', { params });
      setCashouts(listFrom(response.data));
      setCashoutCount(response.data?.count ?? listFrom(response.data).length);
      setCashoutNext(Boolean(response.data?.next));
      setCashoutPrevious(Boolean(response.data?.previous));
    } catch (loadError) {
      setError(messageFrom(loadError, 'Failed to load the cashout queue.'));
    } finally {
      setLoading(false);
    }
  }, [cashoutPage, cashoutStatus]);

  useEffect(() => {
    if (tab === 'cashouts') loadCashouts();
    else loadCore();
  }, [loadCashouts, loadCore, tab]);

  const agentById = useMemo(() => new Map(agents.map((agent) => [String(agent.id), agent])), [agents]);

  const createAssignment = async (event) => {
    event.preventDefault();
    if (mutating) return;
    const commission = Number(assignmentForm.commission_percent);
    if (!assignmentForm.agent || !assignmentForm.product || !Number.isFinite(commission) || commission < 0 || commission >= 100) {
      setError('Agent, product, and a commission from 0 to 99.99 are required.');
      return;
    }
    setMutating('assignment-create');
    setError('');
    setNotice('');
    try {
      await axiosInstance.post('/agents/agent-product-assignments/', {
        agent: Number(assignmentForm.agent),
        product: Number(assignmentForm.product),
        commission_percent: commission,
        is_active: assignmentForm.is_active,
      });
      setAssignmentForm({ agent: '', product: '', commission_percent: '', is_active: true });
      setNotice('Product assignment saved successfully.');
      await loadCore();
    } catch (saveError) {
      setError(messageFrom(saveError, 'Failed to save the product assignment.'));
    } finally {
      setMutating('');
    }
  };

  const toggleAssignment = async (assignment) => {
    if (mutating) return;
    setMutating(`assignment-${assignment.id}`);
    setError('');
    setNotice('');
    try {
      await axiosInstance.patch(`/agents/agent-product-assignments/${assignment.id}/`, { is_active: !assignment.is_active });
      setNotice('Assignment status updated.');
      await loadCore();
    } catch (saveError) {
      setError(messageFrom(saveError, 'Failed to update the assignment.'));
    } finally {
      setMutating('');
    }
  };

  const deactivateAssignment = async (assignment) => {
    if (mutating || !window.confirm(`Deactivate the assignment for ${assignment.product_name || `product #${assignment.product}`}?`)) return;
    setMutating(`assignment-${assignment.id}`);
    setError('');
    setNotice('');
    try {
      await axiosInstance.delete(`/agents/agent-product-assignments/${assignment.id}/`);
      setNotice('Assignment deactivated.');
      await loadCore();
    } catch (saveError) {
      setError(messageFrom(saveError, 'Failed to deactivate the assignment.'));
    } finally {
      setMutating('');
    }
  };

  const saveRegion = async (event) => {
    event.preventDefault();
    if (mutating || !regionForm.agent_id || !regionForm.region.trim()) return;
    setMutating('region');
    setError('');
    setNotice('');
    try {
      await axiosInstance.post('/agents/regions/', { agent_id: Number(regionForm.agent_id), region: regionForm.region.trim() });
      setNotice('Agent region saved successfully.');
      setRegionForm({ agent_id: '', region: '' });
      await loadCore();
    } catch (saveError) {
      setError(messageFrom(saveError, 'Failed to save the agent region.'));
    } finally {
      setMutating('');
    }
  };

  const clearRegion = async (agent) => {
    if (mutating || !window.confirm(`Remove the region for ${agent.full_name || agent.username || `agent #${agent.id}`}?`)) return;
    setMutating(`region-${agent.id}`);
    setError('');
    setNotice('');
    try {
      await axiosInstance.delete(`/agents/regions/${agent.id}/`);
      setNotice('Agent region removed.');
      await loadCore();
    } catch (saveError) {
      setError(messageFrom(saveError, 'Failed to remove the agent region.'));
    } finally {
      setMutating('');
    }
  };

  const selectRegionAgent = (agentId) => {
    const agent = agentById.get(String(agentId));
    setRegionForm({ agent_id: agentId, region: agent?.region || '' });
  };

  return (
    <div className="m-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-secondary-dark-bg md:m-8 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Agents</p><h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Agent operations</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage product commissions, operating regions, and review cashout requests.</p></div>
        <button type="button" onClick={tab === 'cashouts' ? loadCashouts : loadCore} disabled={loading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">Refresh</button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {[['assignments', 'Product assignments'], ['regions', 'Regions'], ['cashouts', 'Cashout queue']].map(([value, label]) => <button type="button" key={value} onClick={() => setTab(value)} className={`border-b-2 px-4 py-2 text-sm font-bold ${tab === value ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>{label}</button>)}
      </div>
      {notice && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {tab === 'assignments' && (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <form onSubmit={createAssignment} className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h2 className="font-bold text-gray-900 dark:text-white">Add or update assignment</h2>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Agent<select className={`${inputClass} mt-1`} value={assignmentForm.agent} onChange={(event) => setAssignmentForm({ ...assignmentForm, agent: event.target.value })} required><option value="">Select agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name || agent.username || `Agent #${agent.id}`}</option>)}</select></label>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Product<select className={`${inputClass} mt-1`} value={assignmentForm.product} onChange={(event) => setAssignmentForm({ ...assignmentForm, product: event.target.value })} required><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name || product.name_en || product.title || `Product #${product.id}`}</option>)}</select></label>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Commission percentage<input className={`${inputClass} mt-1`} type="number" min="0" max="99.99" step="0.01" value={assignmentForm.commission_percent} onChange={(event) => setAssignmentForm({ ...assignmentForm, commission_percent: event.target.value })} required /></label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={assignmentForm.is_active} onChange={(event) => setAssignmentForm({ ...assignmentForm, is_active: event.target.checked })} /> Active</label>
            <button type="submit" disabled={Boolean(mutating)} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{mutating === 'assignment-create' ? 'Saving…' : 'Save assignment'}</button>
          </form>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            {loading ? <div className="p-10 text-center text-gray-500">Loading assignments…</div> : assignments.length === 0 ? <div className="p-10 text-center text-gray-500">No product assignments configured.</div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{['Agent', 'Product', 'Commission', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{assignments.map((assignment) => <tr key={assignment.id}><td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{assignment.agent_name || `Agent #${assignment.agent}`}</td><td className="px-4 py-3 text-gray-700 dark:text-gray-200">{assignment.product_name || `Product #${assignment.product}`}</td><td className="px-4 py-3 text-gray-700 dark:text-gray-200">{assignment.commission_percent}%</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${assignment.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{assignment.is_active ? 'Active' : 'Inactive'}</span></td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" disabled={Boolean(mutating)} onClick={() => toggleAssignment(assignment)} className="font-semibold text-indigo-600 disabled:opacity-50">{assignment.is_active ? 'Disable' : 'Enable'}</button>{assignment.is_active && <button type="button" disabled={Boolean(mutating)} onClick={() => deactivateAssignment(assignment)} className="font-semibold text-red-600 disabled:opacity-50">Remove</button>}</div></td></tr>)}</tbody></table></div>}
          </div>
        </div>
      )}

      {tab === 'regions' && (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <form onSubmit={saveRegion} className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700"><h2 className="font-bold text-gray-900 dark:text-white">Set agent region</h2><label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Agent<select className={`${inputClass} mt-1`} value={regionForm.agent_id} onChange={(event) => selectRegionAgent(event.target.value)} required><option value="">Select agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name || agent.username || `Agent #${agent.id}`}</option>)}</select></label><label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Region<input className={`${inputClass} mt-1`} maxLength="255" value={regionForm.region} onChange={(event) => setRegionForm({ ...regionForm, region: event.target.value })} required /></label><button type="submit" disabled={Boolean(mutating) || !regionForm.region.trim()} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{mutating === 'region' ? 'Saving…' : 'Save region'}</button></form>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">{loading ? <div className="p-10 text-center text-gray-500">Loading agents…</div> : agents.length === 0 ? <div className="p-10 text-center text-gray-500">No agents found.</div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{['Agent', 'Code', 'Region', 'Action'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{agents.map((agent) => <tr key={agent.id}><td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{agent.full_name || agent.username || `Agent #${agent.id}`}</td><td className="px-4 py-3 text-gray-500">{agent.agent_code || '—'}</td><td className="px-4 py-3 text-gray-700 dark:text-gray-200">{agent.region || 'Not assigned'}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => selectRegionAgent(String(agent.id))} className="font-semibold text-indigo-600">Edit</button>{agent.region && <button type="button" disabled={Boolean(mutating)} onClick={() => clearRegion(agent)} className="font-semibold text-red-600 disabled:opacity-50">Clear</button>}</div></td></tr>)}</tbody></table></div>}</div>
        </div>
      )}

      {tab === 'cashouts' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3"><label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Status<select className={`${inputClass} ms-2 w-44`} value={cashoutStatus} onChange={(event) => { setCashoutStatus(event.target.value); setCashoutPage(1); }}><option value="">All statuses</option>{['pending', 'approved', 'rejected', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label><span className="text-xs text-gray-500">This is a read-only Admin queue; payout approval belongs to the assigned agent.</span></div>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">{loading ? <div className="p-10 text-center text-gray-500">Loading cashouts…</div> : cashouts.length === 0 ? <div className="p-10 text-center text-gray-500">No cashout requests match this status.</div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{['ID', 'Customer', 'Agent', 'Amount', 'Status', 'Created'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{cashouts.map((cashout) => <tr key={cashout.id}><td className="px-4 py-3 text-gray-500">#{cashout.id}</td><td className="px-4 py-3"><p className="font-semibold text-gray-900 dark:text-white">{cashout.user_name || `User #${cashout.user_id || '—'}`}</p><p className="text-xs text-gray-500">{cashout.user_phone || ''}</p></td><td className="px-4 py-3 text-gray-700 dark:text-gray-200">{cashout.agent_name || `Agent #${cashout.agent_id || '—'}`}</td><td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{cashout.amount} {cashout.currency || cashout.wallet_currency || ''}</td><td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{cashout.status}</span></td><td className="whitespace-nowrap px-4 py-3 text-gray-500">{cashout.created_at ? new Date(cashout.created_at).toLocaleString() : '—'}</td></tr>)}</tbody></table></div>}</div>
          {!loading && (cashoutPrevious || cashoutNext) && <div className="mt-4 flex items-center justify-between"><span className="text-sm text-gray-500">{cashoutCount} requests</span><div className="flex gap-2"><button type="button" disabled={!cashoutPrevious} onClick={() => setCashoutPage((page) => Math.max(1, page - 1))} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700">Previous</button><span className="px-2 py-1.5 text-sm">Page {cashoutPage}</span><button type="button" disabled={!cashoutNext} onClick={() => setCashoutPage((page) => page + 1)} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700">Next</button></div></div>}
        </div>
      )}
    </div>
  );
};

export default AgentOperations;
