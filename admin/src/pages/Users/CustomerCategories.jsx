import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
      setError(apiMessage(loadError, 'Failed to load customer-category data.'));
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError('Name, display name, and a profit percentage between 0 and 100 are required.');
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
        setNotice('Category updated successfully.');
      } else {
        await axiosInstance.post('/users/categories/', payload);
        setNotice('Category created successfully.');
      }
      resetForm();
      await load();
    } catch (saveError) {
      setError(apiMessage(saveError, 'Failed to save the category.'));
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
    if (deletingId || !window.confirm(`Delete category “${category.display_name || category.name}”?`)) return;
    setDeletingId(category.id);
    setError('');
    setNotice('');
    try {
      await axiosInstance.delete(`/users/categories/${category.id}/`);
      setNotice('Category deleted successfully.');
      if (editingId === category.id) resetForm();
      await load();
    } catch (deleteError) {
      setError(apiMessage(deleteError, 'Failed to delete the category. It may still have assigned users.'));
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
      setNotice(assignment.category_id ? 'Customer category assigned successfully.' : 'Customer category assignment removed.');
      setAssignment({ user_id: '', category_id: '', notes: '' });
      await load();
    } catch (assignError) {
      setError(apiMessage(assignError, 'Failed to update the customer category assignment.'));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="m-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-secondary-dark-bg md:m-8 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Users</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Customer categories</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage pricing categories and customer assignments.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
          Refresh
        </button>
      </div>

      {notice && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">Configured categories</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading categories…</div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No customer categories are configured.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {['Category', 'Profit %', 'Users', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {categories.map((category) => (
                      <tr key={category.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 dark:text-white">{category.display_name || category.name}</p>
                          <p className="text-xs text-gray-500">{category.name}{category.is_default ? ' · Default' : ''}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{category.profit_percentage}%</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{category.users_count ?? 0}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${category.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{category.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => editCategory(category)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">Edit</button>
                            <button type="button" onClick={() => deleteCategory(category)} disabled={deletingId === category.id} className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">{deletingId === category.id ? 'Deleting…' : 'Delete'}</button>
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
            <h2 className="mb-4 font-bold text-gray-900 dark:text-white">Category report</h2>
            {!report ? <p className="text-sm text-gray-500">No report data available.</p> : (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-indigo-50 p-3"><p className="text-xs text-indigo-600">Total users</p><p className="text-xl font-bold text-indigo-900">{report.summary?.total_users ?? 0}</p></div>
                  <div className="rounded-lg bg-green-50 p-3"><p className="text-xs text-green-600">Assigned</p><p className="text-xl font-bold text-green-900">{report.users_with_categories ?? 0}</p></div>
                  <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-600">Uncategorized</p><p className="text-xl font-bold text-amber-900">{report.users_without_categories ?? 0}</p></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(report.categories || []).map((item) => (
                    <div key={item.category_id ?? 'uncategorized'} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <p className="font-semibold text-gray-900 dark:text-white">{item.category_name}</p>
                      <p className="text-xs text-gray-500">{item.users_count} users · {item.profit_percentage}%</p>
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
              <h2 className="font-bold text-gray-900 dark:text-white">{editingId ? 'Edit category' : 'Create category'}</h2>
              {editingId && <button type="button" onClick={resetForm} className="text-xs font-semibold text-gray-500">Cancel</button>}
            </div>
            <Field label="Internal name"><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={100} required /></Field>
            <Field label="Display name"><input className={inputClass} value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} maxLength={150} required /></Field>
            <Field label="Profit percentage"><input className={inputClass} type="number" min="0" max="100" step="0.01" value={form.profit_percentage} onChange={(event) => setForm({ ...form, profit_percentage: event.target.value })} required /></Field>
            <Field label="Description"><textarea className={inputClass} rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Active</label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={form.is_default} onChange={(event) => setForm({ ...form, is_default: event.target.checked })} /> Default category</label>
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Update category' : 'Create category'}</button>
          </form>

          <form onSubmit={submitAssignment} className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Assign customer category</h2>
              <p className="text-xs text-gray-500">Leave category empty to remove a direct assignment.</p>
            </div>
            <Field label="Customer"><select className={inputClass} value={assignment.user_id} onChange={(event) => setAssignment({ ...assignment, user_id: event.target.value })} required><option value="">Select customer</option>{sortedUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.name || user.email || `User #${user.id}`}</option>)}</select></Field>
            <Field label="Category"><select className={inputClass} value={assignment.category_id} onChange={(event) => setAssignment({ ...assignment, category_id: event.target.value })}><option value="">Use default / remove assignment</option>{categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.display_name || category.name}</option>)}</select></Field>
            <Field label="Notes"><textarea className={inputClass} rows="2" value={assignment.notes} onChange={(event) => setAssignment({ ...assignment, notes: event.target.value })} /></Field>
            <button type="submit" disabled={assigning || !assignment.user_id} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{assigning ? 'Applying…' : 'Apply assignment'}</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerCategories;
