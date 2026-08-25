import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  FiAlertCircle,
  FiBarChart2,
  FiCheckCircle,
  FiEdit2,
  FiPercent,
  FiRefreshCw,
  FiTag,
  FiTrash2,
  FiUserPlus,
  FiUsers,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

const emptyForm = {
  name: '',
  display_name: '',
  profit_percentage: '',
  description: '',
  is_active: true,
  is_default: false,
};

const listFrom = (data) => (
  Array.isArray(data)
    ? data
    : data?.results || []
);

const apiMessage = (error, fallback) => {
  const data = error?.response?.data;

  if (typeof data?.error === 'string') {
    return data.error;
  }

  if (typeof data?.detail === 'string') {
    return data.detail;
  }

  if (data && typeof data === 'object') {
    const first = Object.values(data)
      .flat()
      .find(Boolean);

    if (first) {
      return String(first);
    }
  }

  return fallback;
};

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
  disabled:cursor-not-allowed
  disabled:opacity-60
  dark:border-slate-700
  dark:bg-slate-900
  dark:text-white
  dark:focus:ring-cyan-900/30
`;

const Field = ({
  label,
  children,
}) => (
  <label
    className="
      block
      text-sm
      font-bold
      text-slate-700
      dark:text-slate-200
    "
  >
    <span className="mb-2 block">
      {label}
    </span>

    {children}
  </label>
);

const CustomerCategories = () => {
  const { t } = useTranslation([
    'customers',
    'common',
  ]);

  const {
    currentColor,
  } = useStateContext();

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

  const [assignment, setAssignment] = useState({
    user_id: '',
    category_id: '',
    notes: '',
  });

  const [assigning, setAssigning] = useState(false);

  // ====================================================
  // Load
  // ====================================================

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [
        categoryResponse,
        reportResponse,
        usersResponse,
      ] = await Promise.all([
        axiosInstance.get('/users/categories/'),
        axiosInstance.get('/users/category-report/'),
        axiosInstance.get('/users/users-simple/'),
      ]);

      setCategories(
        listFrom(categoryResponse.data),
      );

      setReport(reportResponse.data);

      setUsers(
        listFrom(usersResponse.data),
      );
    } catch (loadError) {
      setError(
        apiMessage(
          loadError,
          t('categories.errors.load'),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // ====================================================
  // Users
  // ====================================================

  const sortedUsers = useMemo(
    () => (
      [...users].sort((a, b) => {
        const first = (
          a.full_name
          || a.name
          || a.email
          || String(a.id)
        );

        const second = (
          b.full_name
          || b.name
          || b.email
          || String(b.id)
        );

        return first.localeCompare(second);
      })
    ),
    [users],
  );

  // ====================================================
  // Category Form
  // ====================================================

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submitCategory = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    const profit = Number(
      form.profit_percentage,
    );

    if (
      !form.name.trim()
      || !form.display_name.trim()
      || !Number.isFinite(profit)
      || profit < 0
      || profit > 100
    ) {
      setError(
        t('categories.validation'),
      );

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
        await axiosInstance.patch(
          `/users/categories/${editingId}/`,
          payload,
        );

        setNotice(
          t('categories.notices.updated'),
        );
      } else {
        await axiosInstance.post(
          '/users/categories/',
          payload,
        );

        setNotice(
          t('categories.notices.created'),
        );
      }

      resetForm();

      await load();
    } catch (saveError) {
      setError(
        apiMessage(
          saveError,
          t('categories.errors.save'),
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category) => {
    setEditingId(category.id);

    setForm({
      name: category.name || '',
      display_name: category.display_name || '',
      profit_percentage: String(
        category.profit_percentage ?? '',
      ),
      description: category.description || '',
      is_active: category.is_active !== false,
      is_default: category.is_default === true,
    });

    setError('');
    setNotice('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const deleteCategory = async (category) => {
    if (
      deletingId
      || !window.confirm(
        t(
          'categories.confirmDelete',
          {
            name:
              category.display_name
              || category.name,
          },
        ),
      )
    ) {
      return;
    }

    setDeletingId(category.id);

    setError('');
    setNotice('');

    try {
      await axiosInstance.delete(
        `/users/categories/${category.id}/`,
      );

      setNotice(
        t('categories.notices.deleted'),
      );

      if (editingId === category.id) {
        resetForm();
      }

      await load();
    } catch (deleteError) {
      setError(
        apiMessage(
          deleteError,
          t('categories.errors.delete'),
        ),
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ====================================================
  // Assignment
  // ====================================================

  const submitAssignment = async (event) => {
    event.preventDefault();

    if (
      assigning
      || !assignment.user_id
    ) {
      return;
    }

    setAssigning(true);
    setError('');
    setNotice('');

    try {
      await axiosInstance.post(
        '/users/assign-category/',
        {
          user_id: Number(
            assignment.user_id,
          ),

          category_id:
            assignment.category_id
              ? Number(
                assignment.category_id,
              )
              : null,

          notes:
            assignment.notes.trim(),
        },
      );

      setNotice(
        assignment.category_id
          ? t(
              'categories.notices.assigned',
            )
          : t(
              'categories.notices.removed',
            ),
      );

      setAssignment({
        user_id: '',
        category_id: '',
        notes: '',
      });

      await load();
    } catch (assignError) {
      setError(
        apiMessage(
          assignError,
          t('categories.errors.assign'),
        ),
      );
    } finally {
      setAssigning(false);
    }
  };

  // ====================================================
  // Render
  // ====================================================

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
            HEADER
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
                    'categories.category',
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
                  'categories.title',
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
                  'categories.subtitle',
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
              onClick={load}
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
                'categories.refresh',
              )}
            </button>
          </div>
        </section>

        {/* =========================================
            NOTICE
        ========================================= */}

        {notice && (
          <div
            className="
              flex
              items-start
              gap-3
              rounded-xl
              border
              border-emerald-200
              bg-emerald-50
              px-4
              py-3.5
              text-sm
              text-emerald-800
              dark:border-emerald-900
              dark:bg-emerald-950/30
              dark:text-emerald-300
            "
          >
            <FiCheckCircle
              className="
                mt-0.5
                flex-shrink-0
                text-lg
              "
            />

            <span className="flex-1">
              {notice}
            </span>

            <button
              type="button"
              onClick={() => setNotice('')}
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-lg
                hover:bg-emerald-100
                dark:hover:bg-emerald-900/50
              "
            >
              <FiX />
            </button>
          </div>
        )}

        {/* =========================================
            ERROR
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
            CONTENT
        ========================================= */}

        <div
          className="
            grid
            gap-6
            xl:grid-cols-[minmax(0,1fr)_380px]
          "
        >
          {/* =====================================
              LEFT SIDE
          ===================================== */}

          <div className="min-w-0 space-y-6">
            {/* Categories */}
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
                    <FiTag />
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
                        'categories.configured',
                      )}
                    </h2>

                    <p className="text-xs text-slate-400">
                      {categories.length}
                    </p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div
                  className="
                    flex
                    min-h-[280px]
                    items-center
                    justify-center
                  "
                >
                  <FiRefreshCw
                    className="
                      animate-spin
                      text-3xl
                      text-slate-400
                    "
                  />
                </div>
              ) : categories.length === 0 ? (
                <div
                  className="
                    flex
                    min-h-[280px]
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
                    <FiTag />
                  </div>

                  <p
                    className="
                      text-sm
                      font-semibold
                      text-slate-500
                      dark:text-slate-400
                    "
                  >
                    {t(
                      'categories.empty',
                    )}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                        {[
                          'category',
                          'profit',
                          'users',
                          'status',
                          'actions',
                        ].map((heading) => (
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
                              `categories.headers.${heading}`,
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
                      {categories.map((category) => (
                        <tr
                          key={category.id}
                          className="
                            transition-colors
                            hover:bg-slate-50/70
                            dark:hover:bg-slate-800/40
                          "
                        >
                          <td className="px-4 py-4">
                            <p
                              className="
                                font-bold
                                text-slate-900
                                dark:text-white
                              "
                            >
                              {category.display_name
                                || category.name}
                            </p>

                            <p
                              className="
                                mt-1
                                text-xs
                                text-slate-400
                              "
                            >
                              {category.name}

                              {category.is_default
                                ? ` · ${t(
                                    'categories.status.default',
                                  )}`
                                : ''}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className="
                                inline-flex
                                items-center
                                gap-1
                                font-bold
                                text-slate-700
                                dark:text-slate-200
                              "
                            >
                              <FiPercent />

                              {category.profit_percentage}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className="
                                inline-flex
                                items-center
                                gap-2
                                font-semibold
                                text-slate-700
                                dark:text-slate-200
                              "
                            >
                              <FiUsers />

                              {category.users_count ?? 0}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                px-2.5
                                py-1
                                text-xs
                                font-bold

                                ${
                                  category.is_active
                                    ? `
                                      bg-emerald-50
                                      text-emerald-700
                                      dark:bg-emerald-950/40
                                      dark:text-emerald-300
                                    `
                                    : `
                                      bg-slate-100
                                      text-slate-500
                                      dark:bg-slate-800
                                      dark:text-slate-400
                                    `
                                }
                              `}
                            >
                              <span
                                className={`
                                  h-1.5
                                  w-1.5
                                  rounded-full

                                  ${
                                    category.is_active
                                      ? 'bg-emerald-500'
                                      : 'bg-slate-400'
                                  }
                                `}
                              />

                              {category.is_active
                                ? t(
                                    'categories.status.active',
                                  )
                                : t(
                                    'categories.status.inactive',
                                  )}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <div
                              className="
                                flex
                                items-center
                                gap-2
                              "
                            >
                              <button
                                type="button"
                                onClick={() => (
                                  editCategory(category)
                                )}
                                style={{
                                  color: currentColor,
                                }}
                                className="
                                  flex
                                  h-9
                                  items-center
                                  gap-1.5
                                  rounded-lg
                                  border
                                  border-slate-200
                                  px-3
                                  text-xs
                                  font-bold
                                  transition
                                  hover:bg-slate-50
                                  dark:border-slate-700
                                  dark:hover:bg-slate-800
                                "
                              >
                                <FiEdit2 />

                                {t(
                                  'categories.buttons.edit',
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => (
                                  deleteCategory(category)
                                )}
                                disabled={
                                  deletingId === category.id
                                }
                                className="
                                  flex
                                  h-9
                                  items-center
                                  gap-1.5
                                  rounded-lg
                                  border
                                  border-red-100
                                  px-3
                                  text-xs
                                  font-bold
                                  text-red-600
                                  transition
                                  hover:bg-red-50
                                  disabled:opacity-50
                                  dark:border-red-900/50
                                  dark:hover:bg-red-950/30
                                "
                              >
                                {deletingId === category.id ? (
                                  <FiRefreshCw
                                    className="animate-spin"
                                  />
                                ) : (
                                  <FiTrash2 />
                                )}

                                {deletingId === category.id
                                  ? t(
                                      'categories.buttons.deleting',
                                    )
                                  : t(
                                      'categories.buttons.delete',
                                    )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Report */}
            <section
              className="
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
                  gap-3
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
                  <FiBarChart2 />
                </div>

                <h2
                  className="
                    font-extrabold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {t(
                    'categories.reportTitle',
                  )}
                </h2>
              </div>

              <div className="p-5">
                {!report ? (
                  <div
                    className="
                      flex
                      min-h-[160px]
                      items-center
                      justify-center
                      text-center
                    "
                  >
                    <p
                      className="
                        text-sm
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      {t(
                        'categories.noReport',
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      className="
                        mb-5
                        grid
                        gap-3
                        sm:grid-cols-3
                      "
                    >
                      <div
                        className="
                          rounded-xl
                          border
                          border-blue-100
                          bg-blue-50
                          p-4
                          dark:border-blue-900/40
                          dark:bg-blue-950/20
                        "
                      >
                        <p
                          className="
                            text-xs
                            font-bold
                            text-blue-600
                            dark:text-blue-300
                          "
                        >
                          {t(
                            'categories.stats.totalUsers',
                          )}
                        </p>

                        <p
                          className="
                            mt-2
                            text-2xl
                            font-black
                            text-blue-900
                            dark:text-blue-100
                          "
                        >
                          {report.summary?.total_users ?? 0}
                        </p>
                      </div>

                      <div
                        className="
                          rounded-xl
                          border
                          border-emerald-100
                          bg-emerald-50
                          p-4
                          dark:border-emerald-900/40
                          dark:bg-emerald-950/20
                        "
                      >
                        <p
                          className="
                            text-xs
                            font-bold
                            text-emerald-600
                            dark:text-emerald-300
                          "
                        >
                          {t(
                            'categories.stats.assigned',
                          )}
                        </p>

                        <p
                          className="
                            mt-2
                            text-2xl
                            font-black
                            text-emerald-900
                            dark:text-emerald-100
                          "
                        >
                          {report.users_with_categories ?? 0}
                        </p>
                      </div>

                      <div
                        className="
                          rounded-xl
                          border
                          border-amber-100
                          bg-amber-50
                          p-4
                          dark:border-amber-900/40
                          dark:bg-amber-950/20
                        "
                      >
                        <p
                          className="
                            text-xs
                            font-bold
                            text-amber-600
                            dark:text-amber-300
                          "
                        >
                          {t(
                            'categories.stats.uncategorized',
                          )}
                        </p>

                        <p
                          className="
                            mt-2
                            text-2xl
                            font-black
                            text-amber-900
                            dark:text-amber-100
                          "
                        >
                          {report.users_without_categories ?? 0}
                        </p>
                      </div>
                    </div>

                    <div
                      className="
                        grid
                        gap-3
                        sm:grid-cols-2
                        lg:grid-cols-3
                      "
                    >
                      {(report.categories || []).map(
                        (item) => (
                          <div
                            key={
                              item.category_id
                              ?? 'uncategorized'
                            }
                            className="
                              rounded-xl
                              border
                              border-slate-100
                              bg-slate-50
                              p-4
                              dark:border-slate-700
                              dark:bg-slate-800/50
                            "
                          >
                            <p
                              className="
                                font-bold
                                text-slate-900
                                dark:text-white
                              "
                            >
                              {item.category_name}
                            </p>

                            <p
                              className="
                                mt-1
                                text-xs
                                text-slate-500
                                dark:text-slate-400
                              "
                            >
                              {t(
                                'categories.stats.usersCount',
                                {
                                  count:
                                    item.users_count,
                                  percent:
                                    item.profit_percentage,
                                },
                              )}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* =====================================
              RIGHT SIDE
          ===================================== */}

          <div className="space-y-6">
            {/* Category Form */}
            <form
              onSubmit={submitCategory}
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
                  mb-5
                  flex
                  items-start
                  justify-between
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    items-start
                    gap-3
                  "
                >
                  <div
                    className="
                      flex
                      h-10
                      w-10
                      flex-shrink-0
                      items-center
                      justify-center
                      rounded-xl
                    "
                    style={{
                      color: currentColor,
                      backgroundColor: `${currentColor}15`,
                    }}
                  >
                    <FiTag />
                  </div>

                  <div>
                    <h2
                      className="
                        font-extrabold
                        text-slate-900
                        dark:text-white
                      "
                    >
                      {editingId
                        ? t(
                            'categories.form.editTitle',
                          )
                        : t(
                            'categories.form.createTitle',
                          )}
                    </h2>
                  </div>
                </div>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="
                      text-xs
                      font-bold
                      text-slate-400
                      hover:text-slate-700
                      dark:hover:text-white
                    "
                  >
                    {t(
                      'categories.buttons.cancel',
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <Field
                  label={t(
                    'categories.form.internalName',
                  )}
                >
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(event) => (
                      setForm({
                        ...form,
                        name: event.target.value,
                      })
                    )}
                    maxLength={100}
                    required
                  />
                </Field>

                <Field
                  label={t(
                    'categories.form.displayName',
                  )}
                >
                  <input
                    className={inputClass}
                    value={form.display_name}
                    onChange={(event) => (
                      setForm({
                        ...form,
                        display_name:
                          event.target.value,
                      })
                    )}
                    maxLength={150}
                    required
                  />
                </Field>

                <Field
                  label={t(
                    'categories.form.profitPercentage',
                  )}
                >
                  <div className="relative">
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={
                        form.profit_percentage
                      }
                      onChange={(event) => (
                        setForm({
                          ...form,
                          profit_percentage:
                            event.target.value,
                        })
                      )}
                      required
                    />

                    <FiPercent
                      className="
                        pointer-events-none
                        absolute
                        end-3
                        top-1/2
                        -translate-y-1/2
                        text-slate-400
                      "
                    />
                  </div>
                </Field>

                <Field
                  label={t(
                    'categories.form.description',
                  )}
                >
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows="3"
                    value={form.description}
                    onChange={(event) => (
                      setForm({
                        ...form,
                        description:
                          event.target.value,
                      })
                    )}
                  />
                </Field>

                <div
                  className="
                    space-y-3
                    rounded-xl
                    bg-slate-50
                    p-3
                    dark:bg-slate-800/50
                  "
                >
                  <label
                    className="
                      flex
                      cursor-pointer
                      items-center
                      gap-2
                      text-sm
                      font-semibold
                      text-slate-700
                      dark:text-slate-200
                    "
                  >
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => (
                        setForm({
                          ...form,
                          is_active:
                            event.target.checked,
                        })
                      )}
                    />

                    {t(
                      'categories.form.active',
                    )}
                  </label>

                  <label
                    className="
                      flex
                      cursor-pointer
                      items-center
                      gap-2
                      text-sm
                      font-semibold
                      text-slate-700
                      dark:text-slate-200
                    "
                  >
                    <input
                      type="checkbox"
                      checked={form.is_default}
                      onChange={(event) => (
                        setForm({
                          ...form,
                          is_default:
                            event.target.checked,
                        })
                      )}
                    />

                    {t(
                      'categories.form.default',
                    )}
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving}
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
                    px-4
                    py-3
                    text-sm
                    font-bold
                    text-white
                    shadow-sm
                    transition-all
                    hover:opacity-90
                    hover:shadow-md
                    disabled:opacity-50
                  "
                >
                  {saving && (
                    <FiRefreshCw
                      className="animate-spin"
                    />
                  )}

                  {saving
                    ? t(
                        'categories.buttons.saving',
                      )
                    : editingId
                      ? t(
                          'categories.buttons.update',
                        )
                      : t(
                          'categories.buttons.create',
                        )}
                </button>
              </div>
            </form>

            {/* Assignment */}
            <form
              onSubmit={submitAssignment}
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
                  mb-5
                  flex
                  items-start
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    flex-shrink-0
                    items-center
                    justify-center
                    rounded-xl
                  "
                  style={{
                    color: currentColor,
                    backgroundColor: `${currentColor}15`,
                  }}
                >
                  <FiUserPlus />
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
                      'categories.assignment.title',
                    )}
                  </h2>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-slate-500
                      dark:text-slate-400
                    "
                  >
                    {t(
                      'categories.assignment.hint',
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Field
                  label={t(
                    'categories.assignment.customer',
                  )}
                >
                  <select
                    className={inputClass}
                    value={assignment.user_id}
                    onChange={(event) => (
                      setAssignment({
                        ...assignment,
                        user_id:
                          event.target.value,
                      })
                    )}
                    required
                  >
                    <option value="">
                      {t(
                        'categories.assignment.selectCustomer',
                      )}
                    </option>

                    {sortedUsers.map((user) => (
                      <option
                        key={user.id}
                        value={user.id}
                      >
                        {user.full_name
                          || user.name
                          || user.email
                          || t(
                            'categories.assignment.userNumber',
                            {
                              id: user.id,
                            },
                          )}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label={t(
                    'categories.assignment.category',
                  )}
                >
                  <select
                    className={inputClass}
                    value={
                      assignment.category_id
                    }
                    onChange={(event) => (
                      setAssignment({
                        ...assignment,
                        category_id:
                          event.target.value,
                      })
                    )}
                  >
                    <option value="">
                      {t(
                        'categories.assignment.useDefault',
                      )}
                    </option>

                    {categories
                      .filter(
                        (category) => (
                          category.is_active
                        ),
                      )
                      .map((category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.display_name
                            || category.name}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field
                  label={t(
                    'categories.assignment.notes',
                  )}
                >
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows="2"
                    value={assignment.notes}
                    onChange={(event) => (
                      setAssignment({
                        ...assignment,
                        notes:
                          event.target.value,
                      })
                    )}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={
                    assigning
                    || !assignment.user_id
                  }
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
                    px-4
                    py-3
                    text-sm
                    font-bold
                    text-white
                    shadow-sm
                    transition-all
                    hover:opacity-90
                    hover:shadow-md
                    disabled:opacity-50
                  "
                >
                  {assigning && (
                    <FiRefreshCw
                      className="animate-spin"
                    />
                  )}

                  {assigning
                    ? t(
                        'categories.buttons.applying',
                      )
                    : t(
                        'categories.buttons.apply',
                      )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCategories;