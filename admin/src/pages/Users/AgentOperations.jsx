import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../../utils/axiosConfig';

const listFrom = (data) => (Array.isArray(data) ? data : data?.results || []);
const messageFrom = (error, fallback) => error?.response?.data?.error || error?.response?.data?.detail || fallback;
const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white';

const AgentOperations = () => {
  const { t, i18n } = useTranslation(['agents', 'common']);
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
      setError(messageFrom(loadError, t('operations.errors.load')));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setError(messageFrom(loadError, t('operations.errors.loadCashouts')));
    } finally {
      setLoading(false);
    }
  }, [cashoutPage, cashoutStatus, t]);

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
      setError(t('operations.validation.assignment'));
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
      setNotice(t('operations.notices.assignmentSaved'));
      await loadCore();
    } catch (saveError) {
      setError(messageFrom(saveError, t('operations.errors.saveAssignment')));
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
      setNotice(t('operations.notices.assignmentUpdated'));
      await loadCore();
    } catch (saveError) {
      setError(messageFrom(saveError, t('operations.errors.updateAssignment')));
    } finally {
      setMutating('');
    }
  };

  const deactivateAssignment = async (assignment) => {
    if (mutating || !window.confirm(t('operations.confirm.deactivateAssignment', { product: assignment.product_name || t('operations.labels.productNumber', { id: assignment.product }) }))) return;
    setMutating(`assignment-${assignment.id}`);
    setError('');
    setNotice('');
    try {
      await axiosInstance.delete(`/agents/agent-product-assignments/${assignment.id}/`);
      setNotice(t('operations.notices.assignmentDeactivated'));
      await loadCore();
    } catch (saveError) {
      setError(messageFrom(saveError, t('operations.errors.deactivateAssignment')));
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
      setNotice(t('operations.notices.regionSaved'));
      setRegionForm({ agent_id: '', region: '' });
      await loadCore();
    } catch (saveError) {
      setError(messageFrom(saveError, t('operations.errors.saveRegion')));
    } finally {
      setMutating('');
    }
  };

  const clearRegion = async (agent) => {
    if (mutating || !window.confirm(t('operations.confirm.removeRegion', { agent: agent.full_name || agent.username || t('operations.labels.agentNumber', { id: agent.id }) }))) return;
    setMutating(`region-${agent.id}`);
    setError('');
    setNotice('');
    try {
      await axiosInstance.delete(`/agents/regions/${agent.id}/`);
      setNotice(t('operations.notices.regionRemoved'));
      await loadCore();
    } catch (saveError) {
      setError(messageFrom(saveError, t('operations.errors.removeRegion')));
    } finally {
      setMutating('');
    }
  };

  const selectRegionAgent = (agentId) => {
    const agent = agentById.get(String(agentId));
    setRegionForm({ agent_id: agentId, region: agent?.region || '' });
  };

  const locale = i18n.resolvedLanguage || i18n.language;
  const assignmentHeaders = ['agent', 'product', 'commission', 'status', 'actions'];
  const regionHeaders = ['agent', 'code', 'region', 'action'];
  const cashoutHeaders = ['id', 'customer', 'agent', 'amount', 'status', 'created'];

  return (
    <div className="m-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-secondary-dark-bg md:m-8 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{t('operations.category')}</p><h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{t('operations.title')}</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('operations.subtitle')}</p></div>
        <button type="button" onClick={tab === 'cashouts' ? loadCashouts : loadCore} disabled={loading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">{t('operations.buttons.refresh')}</button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {['assignments', 'regions', 'cashouts'].map((value) => <button type="button" key={value} onClick={() => setTab(value)} className={`border-b-2 px-4 py-2 text-sm font-bold ${tab === value ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>{t(`operations.tabs.${value}`)}</button>)}
      </div>
      {notice && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {tab === 'assignments' && (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <form onSubmit={createAssignment} className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h2 className="font-bold text-gray-900 dark:text-white">{t('operations.assignments.title')}</h2>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">{t('operations.assignments.agent')}<select className={`${inputClass} mt-1`} value={assignmentForm.agent} onChange={(event) => setAssignmentForm({ ...assignmentForm, agent: event.target.value })} required><option value="">{t('operations.assignments.selectAgent')}</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name || agent.username || t('operations.labels.agentNumber', { id: agent.id })}</option>)}</select></label>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">{t('operations.assignments.product')}<select className={`${inputClass} mt-1`} value={assignmentForm.product} onChange={(event) => setAssignmentForm({ ...assignmentForm, product: event.target.value })} required><option value="">{t('operations.assignments.selectProduct')}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name || product.name_en || product.title || t('operations.labels.productNumber', { id: product.id })}</option>)}</select></label>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">{t('operations.assignments.commission')}<input className={`${inputClass} mt-1`} type="number" min="0" max="99.99" step="0.01" value={assignmentForm.commission_percent} onChange={(event) => setAssignmentForm({ ...assignmentForm, commission_percent: event.target.value })} required /></label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={assignmentForm.is_active} onChange={(event) => setAssignmentForm({ ...assignmentForm, is_active: event.target.checked })} /> {t('operations.assignments.active')}</label>
            <button type="submit" disabled={Boolean(mutating)} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{mutating === 'assignment-create' ? t('operations.buttons.saving') : t('operations.buttons.saveAssignment')}</button>
          </form>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            {loading ? <div className="p-10 text-center text-gray-500">{t('operations.assignments.loading')}</div> : assignments.length === 0 ? <div className="p-10 text-center text-gray-500">{t('operations.assignments.empty')}</div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{assignmentHeaders.map((heading) => <th key={heading} className="px-4 py-3 text-start font-semibold text-gray-600 dark:text-gray-300">{t(`operations.headers.${heading}`)}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{assignments.map((assignment) => <tr key={assignment.id}><td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{assignment.agent_name || t('operations.labels.agentNumber', { id: assignment.agent })}</td><td className="px-4 py-3 text-gray-700 dark:text-gray-200">{assignment.product_name || t('operations.labels.productNumber', { id: assignment.product })}</td><td className="px-4 py-3 text-gray-700 dark:text-gray-200">{assignment.commission_percent}%</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${assignment.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{assignment.is_active ? t('status.active') : t('status.inactive')}</span></td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" disabled={Boolean(mutating)} onClick={() => toggleAssignment(assignment)} className="font-semibold text-indigo-600 disabled:opacity-50">{assignment.is_active ? t('operations.buttons.disable') : t('operations.buttons.enable')}</button>{assignment.is_active && <button type="button" disabled={Boolean(mutating)} onClick={() => deactivateAssignment(assignment)} className="font-semibold text-red-600 disabled:opacity-50">{t('operations.buttons.remove')}</button>}</div></td></tr>)}</tbody></table></div>}
          </div>
        </div>
      )}

      {tab === 'regions' && (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <form onSubmit={saveRegion} className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700"><h2 className="font-bold text-gray-900 dark:text-white">{t('operations.regions.title')}</h2><label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">{t('operations.assignments.agent')}<select className={`${inputClass} mt-1`} value={regionForm.agent_id} onChange={(event) => selectRegionAgent(event.target.value)} required><option value="">{t('operations.assignments.selectAgent')}</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name || agent.username || t('operations.labels.agentNumber', { id: agent.id })}</option>)}</select></label><label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">{t('operations.regions.region')}<input className={`${inputClass} mt-1`} maxLength="255" value={regionForm.region} onChange={(event) => setRegionForm({ ...regionForm, region: event.target.value })} required /></label><button type="submit" disabled={Boolean(mutating) || !regionForm.region.trim()} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{mutating === 'region' ? t('operations.buttons.saving') : t('operations.buttons.saveRegion')}</button></form>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">{loading ? <div className="p-10 text-center text-gray-500">{t('operations.regions.loading')}</div> : agents.length === 0 ? <div className="p-10 text-center text-gray-500">{t('operations.regions.empty')}</div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{regionHeaders.map((heading) => <th key={heading} className="px-4 py-3 text-start font-semibold text-gray-600 dark:text-gray-300">{t(`operations.headers.${heading}`)}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{agents.map((agent) => <tr key={agent.id}><td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{agent.full_name || agent.username || t('operations.labels.agentNumber', { id: agent.id })}</td><td className="px-4 py-3 text-gray-500" dir="ltr">{agent.agent_code || '—'}</td><td className="px-4 py-3 text-gray-700 dark:text-gray-200">{agent.region || t('operations.regions.notAssigned')}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => selectRegionAgent(String(agent.id))} className="font-semibold text-indigo-600">{t('operations.buttons.edit')}</button>{agent.region && <button type="button" disabled={Boolean(mutating)} onClick={() => clearRegion(agent)} className="font-semibold text-red-600 disabled:opacity-50">{t('operations.buttons.clear')}</button>}</div></td></tr>)}</tbody></table></div>}</div>
        </div>
      )}

      {tab === 'cashouts' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3"><label className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('operations.cashouts.status')}<select className={`${inputClass} ms-2 w-44`} value={cashoutStatus} onChange={(event) => { setCashoutStatus(event.target.value); setCashoutPage(1); }}><option value="">{t('operations.cashouts.allStatuses')}</option>{['pending', 'approved', 'rejected', 'cancelled'].map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}</select></label><span className="text-xs text-gray-500">{t('operations.cashouts.readOnlyHint')}</span></div>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">{loading ? <div className="p-10 text-center text-gray-500">{t('operations.cashouts.loading')}</div> : cashouts.length === 0 ? <div className="p-10 text-center text-gray-500">{t('operations.cashouts.empty')}</div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr>{cashoutHeaders.map((heading) => <th key={heading} className="px-4 py-3 text-start font-semibold text-gray-600 dark:text-gray-300">{t(`operations.headers.${heading}`)}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{cashouts.map((cashout) => <tr key={cashout.id}><td className="px-4 py-3 text-gray-500" dir="ltr">#{cashout.id}</td><td className="px-4 py-3"><p className="font-semibold text-gray-900 dark:text-white">{cashout.user_name || t('operations.labels.userNumber', { id: cashout.user_id || '—' })}</p><p className="text-xs text-gray-500" dir="ltr">{cashout.user_phone || ''}</p></td><td className="px-4 py-3 text-gray-700 dark:text-gray-200">{cashout.agent_name || t('operations.labels.agentNumber', { id: cashout.agent_id || '—' })}</td><td className="px-4 py-3 font-semibold text-gray-900 dark:text-white"><bdi>{cashout.amount} {cashout.currency || cashout.wallet_currency || ''}</bdi></td><td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{t(`status.${cashout.status}`, { defaultValue: cashout.status })}</span></td><td className="whitespace-nowrap px-4 py-3 text-gray-500">{cashout.created_at ? new Date(cashout.created_at).toLocaleString(locale) : '—'}</td></tr>)}</tbody></table></div>}</div>
          {!loading && (cashoutPrevious || cashoutNext) && <div className="mt-4 flex items-center justify-between"><span className="text-sm text-gray-500">{t('operations.cashouts.count', { count: cashoutCount })}</span><div className="flex gap-2"><button type="button" disabled={!cashoutPrevious} onClick={() => setCashoutPage((page) => Math.max(1, page - 1))} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700">{t('operations.buttons.previous')}</button><span className="px-2 py-1.5 text-sm">{t('operations.cashouts.page', { page: cashoutPage })}</span><button type="button" disabled={!cashoutNext} onClick={() => setCashoutPage((page) => page + 1)} className="rounded border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700">{t('operations.buttons.next')}</button></div></div>}
        </div>
      )}
    </div>
  );
};

export default AgentOperations;
