import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../../utils/axiosConfig';

const emptyForm = {
  name: '',
  display_name: '',
  profit_percentage: '',
  description: '',
  is_active: true,
  is_default: false,
};

const listFrom = (data) => (Array.isArray(data) ? data : data?.results || []);

const apiMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const first = Object.values(data).flat().find(Boolean);
    if (first) return String(first);
  }
  return fallback;
};

const Field = ({ label, children }) => (
  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
    <span className="mb-1 block">{label}</span>
    {children}
  </label>
);

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white';

const CustomerCategories = () => {
  const { t } = useTranslation(['customers', 'common']);
  const [categories, setCategories] = useState([]);
  const [report, setReport] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [assignment, setAssignment] = useState({ user_id: '', category_id: '', notes: '' });
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [categoryResponse, reportResponse, usersResponse] = await Promise.all([
        axiosInstance.get('/users/categories/'),
        axiosInstance.get('/users/category-report/'),
        axiosInstance.get('/users/users-simple/'),
      ]);
      setCategories(listFrom(categoryResponse.data));
      setReport(reportResponse.data);
      setUsers(listFrom(usersResponse.data));
    } catch (loadError) {
      setError(apiMessage(loadError, t('categories.errors.load')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedUsers = useMemo(() => [...users].sort((a, b) => {
    const first = a.full_name || a.name || a.email || String(a.id);
    const second = b.full_name || b.name || b.email || String(b.id);
    return first.localeCompare(second);
  }), [users]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submitCategory = async (event) => {
    event.preventDefault();
    if (saving) return;
    const profit = Number(form.profit_percentage);
    if (!form.name.trim() || !form.display_name.trim() || !Number.isFinite(profit) || profit < 0 || profit > 100) {
      setError(t('categories.validation'));
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    const payload = {
      ...form,
      name: form.name.trim(),
      display_name: form.display_name.trim(),
      description: form.description.trim(),
      profit_percentage: profit,
    };
    try {
      if (editingId) {
        await axiosInstance.patch(`/users/categories/${editingId}/`, payload);
        setNotice(t('categories.notices.updated'));
      } else {
        await axiosInstance.post('/users/categories/', payload);
        setNotice(t('categories.notices.created'));
      }
      resetForm();
      await load();
    } catch (saveError) {
      setError(apiMessage(saveError, t('categories.errors.save')));
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category) => {
    setEditingId(category.id);
    setForm({
      name: category.name || '',
      display_name: category.display_name || '',
      profit_percentage: String(category.profit_percentage ?? ''),
      description: category.description || '',
      is_active: category.is_active !== false,
      is_default: category.is_default === true,
    });
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteCategory = async (category) => {
    if (deletingId || !window.confirm(t('categories.confirmDelete', { name: category.display_name || category.name }))) return;
    setDeletingId(category.id);
    setError('');
    setNotice('');
    try {
      await axiosInstance.delete(`/users/categories/${category.id}/`);
      setNotice(t('categories.notices.deleted'));
      if (editingId === category.id) resetForm();
      await load();
    } catch (deleteError) {
      setError(apiMessage(deleteError, t('categories.errors.delete')));
    } finally {
      setDeletingId(null);
    }
  };

  const submitAssignment = async (event) => {
    event.preventDefault();
    if (assigning || !assignment.user_id) return;
    setAssigning(true);
    setError('');
    setNotice('');
    try {
      await axiosInstance.post('/users/assign-category/', {
        user_id: Number(assignment.user_id),
        category_id: assignment.category_id ? Number(assignment.category_id) : null,
        notes: assignment.notes.trim(),
      });
      setNotice(assignment.category_id ? t('categories.notices.assigned') : t('categories.notices.removed'));
      setAssignment({ user_id: '', category_id: '', notes: '' });
      await load();
    } catch (assignError) {
      setError(apiMessage(assignError, t('categories.errors.assign')));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="m-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-secondary-dark-bg md:m-8 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{t('categories.category')}</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{t('categories.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('categories.subtitle')}</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
          {t('categories.refresh')}
        </button>
      </div>

      {notice && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">{t('categories.configured')}</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-500">{t('categories.loading')}</div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center text-gray-500">{t('categories.empty')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {['category', 'profit', 'users', 'status', 'actions'].map((heading) => <th key={heading} className="px-4 py-3 text-start font-semibold text-gray-600 dark:text-gray-300">{t(`categories.headers.${heading}`)}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {categories.map((category) => (
                      <tr key={category.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 dark:text-white">{category.display_name || category.name}</p>
                          <p className="text-xs text-gray-500">{category.name}{category.is_default ? ` · ${t('categories.status.default')}` : ''}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{category.profit_percentage}%</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{category.users_count ?? 0}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${category.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{category.is_active ? t('categories.status.active') : t('categories.status.inactive')}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => editCategory(category)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">{t('categories.buttons.edit')}</button>
                            <button type="button" onClick={() => deleteCategory(category)} disabled={deletingId === category.id} className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">{deletingId === category.id ? t('categories.buttons.deleting') : t('categories.buttons.delete')}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h2 className="mb-4 font-bold text-gray-900 dark:text-white">{t('categories.reportTitle')}</h2>
            {!report ? <p className="text-sm text-gray-500">{t('categories.noReport')}</p> : (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-indigo-50 p-3"><p className="text-xs text-indigo-600">{t('categories.stats.totalUsers')}</p><p className="text-xl font-bold text-indigo-900">{report.summary?.total_users ?? 0}</p></div>
                  <div className="rounded-lg bg-green-50 p-3"><p className="text-xs text-green-600">{t('categories.stats.assigned')}</p><p className="text-xl font-bold text-green-900">{report.users_with_categories ?? 0}</p></div>
                  <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-600">{t('categories.stats.uncategorized')}</p><p className="text-xl font-bold text-amber-900">{report.users_without_categories ?? 0}</p></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(report.categories || []).map((item) => (
                    <div key={item.category_id ?? 'uncategorized'} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <p className="font-semibold text-gray-900 dark:text-white">{item.category_name}</p>
                      <p className="text-xs text-gray-500">{t('categories.stats.usersCount', { count: item.users_count, percent: item.profit_percentage })}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <form onSubmit={submitCategory} className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 dark:text-white">{editingId ? t('categories.form.editTitle') : t('categories.form.createTitle')}</h2>
              {editingId && <button type="button" onClick={resetForm} className="text-xs font-semibold text-gray-500">{t('categories.buttons.cancel')}</button>}
            </div>
            <Field label={t('categories.form.internalName')}><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={100} required /></Field>
            <Field label={t('categories.form.displayName')}><input className={inputClass} value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} maxLength={150} required /></Field>
            <Field label={t('categories.form.profitPercentage')}><input className={inputClass} type="number" min="0" max="100" step="0.01" value={form.profit_percentage} onChange={(event) => setForm({ ...form, profit_percentage: event.target.value })} required /></Field>
            <Field label={t('categories.form.description')}><textarea className={inputClass} rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> {t('categories.form.active')}</label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={form.is_default} onChange={(event) => setForm({ ...form, is_default: event.target.checked })} /> {t('categories.form.default')}</label>
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? t('categories.buttons.saving') : editingId ? t('categories.buttons.update') : t('categories.buttons.create')}</button>
          </form>

          <form onSubmit={submitAssignment} className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">{t('categories.assignment.title')}</h2>
              <p className="text-xs text-gray-500">{t('categories.assignment.hint')}</p>
            </div>
            <Field label={t('categories.assignment.customer')}><select className={inputClass} value={assignment.user_id} onChange={(event) => setAssignment({ ...assignment, user_id: event.target.value })} required><option value="">{t('categories.assignment.selectCustomer')}</option>{sortedUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.name || user.email || t('categories.assignment.userNumber', { id: user.id })}</option>)}</select></Field>
            <Field label={t('categories.assignment.category')}><select className={inputClass} value={assignment.category_id} onChange={(event) => setAssignment({ ...assignment, category_id: event.target.value })}><option value="">{t('categories.assignment.useDefault')}</option>{categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.display_name || category.name}</option>)}</select></Field>
            <Field label={t('categories.assignment.notes')}><textarea className={inputClass} rows="2" value={assignment.notes} onChange={(event) => setAssignment({ ...assignment, notes: event.target.value })} /></Field>
            <button type="submit" disabled={assigning || !assignment.user_id} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{assigning ? t('categories.buttons.applying') : t('categories.buttons.apply')}</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerCategories;
