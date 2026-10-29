import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  FiAlertCircle,
  FiCheck,
  FiCreditCard,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

import { useStateContext } from '../../contexts/ContextProvider';
import axiosInstance from '../../utils/axiosConfig';

const normalizeCurrency = (value) => String(value || '').trim().toLowerCase();

const getApiError = (error, fallback) => (
  error?.response?.data?.detail
  || error?.response?.data?.error
  || error?.response?.data?.message
  || error?.message
  || fallback
);

const StatCard = ({
  icon,
  label,
  value,
  helper,
  accentColor,
}) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
    <div className="flex items-start justify-between gap-3">
      <div className="text-start">
        <p className="text-xs font-extrabold text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
          {value}
        </p>
        {helper && (
          <p className="mt-1 text-xs font-semibold text-slate-400">
            {helper}
          </p>
        )}
      </div>

      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg"
        style={{
          backgroundColor: `${accentColor}14`,
          color: accentColor,
        }}
      >
        {icon}
      </div>
    </div>
  </div>
);

const PaymentMethods = () => {
  const { i18n } = useTranslation();
  const { currentColor } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    eyebrow: isArabic ? 'إدارة المدفوعات' : 'Payments Management',
    title: isArabic ? 'طرق الدفع' : 'Payment Methods',
    subtitle: isArabic
      ? 'إدارة طرق الدفع المتاحة للمستخدمين وتفاصيل الحساب والحقول المطلوبة.'
      : 'Manage user-facing payment methods, account details, and required fields.',
    refresh: isArabic ? 'تحديث البيانات' : 'Refresh data',
    add: isArabic ? 'إضافة طريقة دفع' : 'Add payment method',
    total: isArabic ? 'إجمالي الطرق' : 'Total methods',
    active: isArabic ? 'الطرق النشطة' : 'Active methods',
    usd: isArabic ? 'طرق بالدولار' : 'USD methods',
    syp: isArabic ? 'طرق بالليرة' : 'SYP methods',
    search: isArabic
      ? 'ابحث بالعنوان أو العملة أو تفاصيل الحساب...'
      : 'Search by title, currency, or account details...',
    empty: isArabic
      ? 'لا توجد طرق دفع حالياً.'
      : 'No payment methods are available.',
    noResults: isArabic
      ? 'لا توجد نتائج مطابقة للبحث.'
      : 'No methods match your search.',
    activeLabel: isArabic ? 'نشط' : 'Active',
    inactiveLabel: isArabic ? 'غير نشط' : 'Inactive',
    edit: isArabic ? 'تعديل' : 'Edit',
    activate: isArabic ? 'تفعيل' : 'Activate',
    deactivate: isArabic ? 'إيقاف' : 'Deactivate',
    delete: isArabic ? 'حذف' : 'Delete',
    accountDetails: isArabic ? 'تفاصيل الحساب' : 'Account details',
    instructions: isArabic ? 'التعليمات' : 'Instructions',
    fields: isArabic ? 'الحقول المطلوبة' : 'Required fields',
    createdAt: isArabic ? 'تاريخ الإضافة' : 'Created at',
    modalAdd: isArabic ? 'إضافة طريقة دفع' : 'Add payment method',
    modalEdit: isArabic ? 'تعديل طريقة الدفع' : 'Edit payment method',
    methodTitle: isArabic ? 'عنوان طريقة الدفع' : 'Method title',
    uniqueName: isArabic ? 'الاسم الداخلي' : 'Internal name',
    currency: isArabic ? 'العملة' : 'Currency',
    iconUrl: isArabic ? 'رابط الأيقونة' : 'Icon URL',
    description: isArabic ? 'الوصف' : 'Description',
    note: isArabic ? 'ملاحظة' : 'Note',
    formFields: isArabic ? 'حقول نموذج الدفع' : 'Payment form fields',
    formFieldsHint: isArabic
      ? 'هذه الحقول سيُطلب من المستخدم تعبئتها عند استخدام طريقة الدفع.'
      : 'Users will be asked to complete these fields when using this method.',
    addField: isArabic ? 'إضافة حقل' : 'Add field',
    fieldName: isArabic ? 'اسم الحقل' : 'Field name',
    fieldKey: isArabic ? 'المفتاح' : 'Field key',
    inputType: isArabic ? 'نوع الإدخال' : 'Input type',
    placeholder: isArabic ? 'النص التوضيحي' : 'Placeholder',
    required: isArabic ? 'حقل مطلوب' : 'Required field',
    remove: isArabic ? 'إزالة' : 'Remove',
    noFields: isArabic ? 'لا توجد حقول إضافية.' : 'No extra fields.',
    activeStatus: isArabic ? 'طريقة الدفع مفعلة' : 'Payment method is active',
    cancel: isArabic ? 'إلغاء' : 'Cancel',
    save: isArabic ? 'حفظ' : 'Save',
    saving: isArabic ? 'جاري الحفظ...' : 'Saving...',
    update: isArabic ? 'حفظ التعديلات' : 'Save changes',
    loadFailed: isArabic ? 'تعذر تحميل طرق الدفع.' : 'Failed to load payment methods.',
    saveFailed: isArabic ? 'تعذر حفظ طريقة الدفع.' : 'Failed to save payment method.',
    deleteFailed: isArabic ? 'تعذر حذف طريقة الدفع.' : 'Failed to delete payment method.',
    statusFailed: isArabic ? 'تعذر تحديث حالة طريقة الدفع.' : 'Failed to update method status.',
    deleteConfirm: isArabic
      ? 'هل تريد حذف طريقة الدفع هذه نهائياً؟'
      : 'Delete this payment method permanently?',
    deleteSuccess: isArabic ? 'تم حذف طريقة الدفع.' : 'Payment method deleted.',
    saveSuccess: isArabic ? 'تم حفظ طريقة الدفع.' : 'Payment method saved.',
  }), [isArabic]);

  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [formFields, setFormFields] = useState([]);
  const [showInstructions, setShowInstructions] = useState({});

  const fetchPaymentMethods = useCallback(async ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
    }

    setError('');

    try {
      const response = await axiosInstance.get(
        '/payment-methods/admin/payment-methods/',
      );

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];

      setMethods(data);
    } catch (fetchError) {
      setMethods([]);
      setError(getApiError(fetchError, labels.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [labels.loadFailed]);

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  const stats = useMemo(() => ({
    total: methods.length,
    active: methods.filter((item) => item.is_active).length,
    usd: methods.filter(
      (item) => normalizeCurrency(item.currency) === 'usd',
    ).length,
    syp: methods.filter(
      (item) => normalizeCurrency(item.currency) === 'syp',
    ).length,
  }), [methods]);

  const filteredMethods = useMemo(() => {
    const needle = searchText.trim().toLowerCase();

    if (!needle) {
      return methods;
    }

    return methods.filter((method) => [
      method.title,
      method.name,
      method.currency,
      method.account_details,
      method.description,
      method.instructions,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)));
  }, [methods, searchText]);

  const openAddModal = () => {
    setEditingMethod(null);
    setFormFields([]);
    setShowModal(true);
  };

  const openEditModal = (method) => {
    setEditingMethod(method);
    setFormFields(
      Array.isArray(method.fields)
        ? method.fields.map((field, index) => ({
          field_name: field.field_name || '',
          field_key: field.field_key || '',
          input_type: field.input_type || 'text',
          is_required: field.is_required !== false,
          placeholder: field.placeholder || '',
          order: field.order ?? index,
        }))
        : [],
    );
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingMethod(null);
    setFormFields([]);
  };

  const addFormField = () => {
    setFormFields((previous) => [
      ...previous,
      {
        field_name: '',
        field_key: '',
        input_type: 'text',
        is_required: true,
        placeholder: '',
        order: previous.length,
      },
    ]);
  };

  const updateFormField = (index, field, value) => {
    setFormFields((previous) => {
      const updated = [...previous];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };

      if (field === 'field_name') {
        updated[index].field_key = String(value)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      }

      return updated;
    });
  };

  const removeFormField = (index) => {
    setFormFields((previous) => (
      previous.filter((_, fieldIndex) => fieldIndex !== index)
    ));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    const formData = new FormData(event.currentTarget);

    const payload = {
      title: formData.get('title'),
      name: formData.get('name'),
      currency: formData.get('currency'),
      icon_url: formData.get('icon_url') || '',
      account_details: formData.get('account_details'),
      instructions: formData.get('instructions'),
      description: formData.get('description') || '',
      note: formData.get('note') || '',
      is_active: formData.get('is_active') === 'on',
      fields: formFields.map((field, index) => ({
        field_name: field.field_name,
        field_key: field.field_key,
        input_type: field.input_type,
        is_required: field.is_required,
        placeholder: field.placeholder || '',
        order: field.order ?? index,
      })),
    };

    try {
      if (editingMethod) {
        await axiosInstance.put(
          `/payment-methods/admin/payment-methods/${editingMethod.id}/`,
          payload,
        );
      } else {
        await axiosInstance.post(
          '/payment-methods/admin/payment-methods/',
          payload,
        );
      }

      setShowModal(false);
      setEditingMethod(null);
      setFormFields([]);
      setNotice({
        type: 'success',
        message: labels.saveSuccess,
      });
      await fetchPaymentMethods({ background: true });
    } catch (saveError) {
      setNotice({
        type: 'error',
        message: getApiError(saveError, labels.saveFailed),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (method) => {
    setNotice(null);

    try {
      await axiosInstance.put(
        `/payment-methods/admin/payment-methods/${method.id}/`,
        {
          ...method,
          is_active: !method.is_active,
        },
      );

      await fetchPaymentMethods({ background: true });
    } catch (statusError) {
      setNotice({
        type: 'error',
        message: getApiError(statusError, labels.statusFailed),
      });
    }
  };

  const handleDelete = async (method) => {
    if (!window.confirm(labels.deleteConfirm)) {
      return;
    }

    setNotice(null);

    try {
      await axiosInstance.delete(
        `/payment-methods/admin/payment-methods/${method.id}/`,
      );

      setNotice({
        type: 'success',
        message: labels.deleteSuccess,
      });
      await fetchPaymentMethods({ background: true });
    } catch (deleteError) {
      setNotice({
        type: 'error',
        message: getApiError(deleteError, labels.deleteFailed),
      });
    }
  };

  if (loading && !methods.length) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <FiRefreshCw className="animate-spin text-3xl" />
          <span className="text-sm font-bold">
            {isArabic ? 'جاري تحميل طرق الدفع...' : 'Loading payment methods...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        className="mt-20 px-3 py-4 sm:px-5 md:mt-4 md:px-8 md:py-6"
      >
        <div className="mx-auto w-full max-w-7xl space-y-5">
          <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg md:p-7">
            <div
              className="pointer-events-none absolute -end-20 -top-24 h-56 w-56 rounded-full opacity-[0.08]"
              style={{ backgroundColor: accentColor }}
            />

            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <FiCreditCard />
                </div>

                <div className="text-start">
                  <p
                    className="text-xs font-black uppercase tracking-[0.16em]"
                    style={{ color: accentColor }}
                  >
                    {labels.eyebrow}
                  </p>
                  <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
                    {labels.title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {labels.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => fetchPaymentMethods({ background: true })}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                  {labels.refresh}
                </button>

                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: accentColor }}
                >
                  <FiPlus />
                  {labels.add}
                </button>
              </div>
            </div>
          </section>

          {notice && (
            <div
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
                notice.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              {notice.type === 'error'
                ? <FiAlertCircle className="mt-0.5 shrink-0" />
                : <FiCheck className="mt-0.5 shrink-0" style={{ color: accentColor }} />}
              <span className="flex-1 text-start">
                {notice.message}
              </span>
              <button type="button" onClick={() => setNotice(null)}>
                <FiX />
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <FiAlertCircle />
              <span className="flex-1 text-start">
                {error}
              </span>
              <button
                type="button"
                onClick={() => fetchPaymentMethods()}
                className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-black"
              >
                {labels.refresh}
              </button>
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<FiCreditCard />}
              label={labels.total}
              value={stats.total}
              helper={isArabic ? 'كل طرق الدفع المسجلة' : 'All configured methods'}
              accentColor={accentColor}
            />
            <StatCard
              icon={<FiCheck />}
              label={labels.active}
              value={stats.active}
              helper={`${stats.total - stats.active} ${isArabic ? 'غير نشطة' : 'inactive'}`}
              accentColor={accentColor}
            />
            <StatCard
              icon={<span className="font-black">$</span>}
              label={labels.usd}
              value={stats.usd}
              helper="USD"
              accentColor={accentColor}
            />
            <StatCard
              icon={<span className="text-sm font-black">SYP</span>}
              label={labels.syp}
              value={stats.syp}
              helper={isArabic ? 'ليرة سورية' : 'Syrian Pound'}
              accentColor={accentColor}
            />
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-start">
                <h2 className="text-lg font-black text-slate-950 dark:text-white">
                  {isArabic ? 'طرق الدفع' : 'Payment methods'}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {isArabic
                    ? 'يمكنك البحث ثم تعديل الحالة أو تفاصيل أي طريقة.'
                    : 'Search and manage status or details for any method.'}
                </p>
              </div>

              <div className="relative w-full lg:max-w-md">
                <FiSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={labels.search}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white ps-10 pe-3 text-sm font-bold text-slate-700 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
            </div>
          </section>

          {!methods.length ? (
            <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-secondary-dark-bg">
              <FiCreditCard className="mx-auto text-4xl text-slate-300" />
              <p className="mt-3 text-sm font-black text-slate-500 dark:text-slate-300">
                {labels.empty}
              </p>
            </section>
          ) : !filteredMethods.length ? (
            <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-black text-slate-400 dark:border-slate-700 dark:bg-secondary-dark-bg">
              {labels.noResults}
            </section>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredMethods.map((method) => {
                const currency = normalizeCurrency(method.currency);
                const instructionsOpen = Boolean(showInstructions[method.id]);

                return (
                  <article
                    key={method.id}
                    className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-secondary-dark-bg"
                  >
                    <div className="border-b border-slate-100 p-5 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
                            style={{
                              backgroundColor: `${accentColor}12`,
                              color: accentColor,
                            }}
                          >
                            {method.icon_url ? (
                              <img
                                src={method.icon_url}
                                alt={method.title || 'payment'}
                                className="h-full w-full object-contain p-2"
                              />
                            ) : (
                              <FiCreditCard className="text-xl" />
                            )}
                          </div>

                          <div className="min-w-0 text-start">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-lg font-black text-slate-950 dark:text-white">
                                {method.title || method.name || '—'}
                              </h3>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                #{method.id}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-bold uppercase text-slate-400">
                              {currency || '—'}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${
                            method.is_active
                              ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                              : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                          }`}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor: method.is_active
                                ? accentColor
                                : '#ef4444',
                            }}
                          />
                          {method.is_active
                            ? labels.activeLabel
                            : labels.inactiveLabel}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 p-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.accountDetails}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-slate-700 dark:text-slate-200">
                            {method.account_details || '—'}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.fields}
                          </p>
                          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                            {Array.isArray(method.fields) ? method.fields.length : 0}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-extrabold text-slate-400">
                            {labels.instructions}
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowInstructions((previous) => ({
                              ...previous,
                              [method.id]: !previous[method.id],
                            }))}
                            className="text-slate-400 transition hover:text-slate-700 dark:hover:text-white"
                          >
                            {instructionsOpen ? <FiEyeOff /> : <FiEye />}
                          </button>
                        </div>
                        <p
                          className={`mt-2 whitespace-pre-wrap text-sm font-bold text-slate-700 dark:text-slate-200 ${
                            instructionsOpen ? '' : 'line-clamp-2'
                          }`}
                        >
                          {method.instructions || '—'}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => openEditModal(method)}
                          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition hover:opacity-90"
                          style={{ backgroundColor: accentColor }}
                        >
                          <FiEdit2 />
                          {labels.edit}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleStatus(method)}
                          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {method.is_active ? <FiEyeOff /> : <FiEye />}
                          {method.is_active ? labels.deactivate : labels.activate}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(method)}
                          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-600 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                        >
                          <FiTrash2 />
                          {labels.delete}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:p-6">
              <div className="text-start">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">
                  {editingMethod ? labels.modalEdit : labels.modalAdd}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {isArabic
                    ? 'أدخل تفاصيل طريقة الدفع والحقول التي سيطلبها النظام من المستخدم.'
                    : 'Configure method details and the fields required from the user.'}
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-5 md:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.methodTitle}
                  </span>
                  <input
                    name="title"
                    required
                    defaultValue={editingMethod?.title || ''}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.uniqueName}
                  </span>
                  <input
                    name="name"
                    required
                    dir="ltr"
                    defaultValue={editingMethod?.name || ''}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.currency}
                  </span>
                  <select
                    name="currency"
                    required
                    defaultValue={normalizeCurrency(editingMethod?.currency) || 'usd'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="usd">USD ($)</option>
                    <option value="syp">SYP</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.iconUrl}
                  </span>
                  <input
                    name="icon_url"
                    type="url"
                    dir="ltr"
                    defaultValue={editingMethod?.icon_url || ''}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                  {labels.accountDetails}
                </span>
                <textarea
                  name="account_details"
                  required
                  rows="3"
                  defaultValue={editingMethod?.account_details || ''}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                  {labels.instructions}
                </span>
                <textarea
                  name="instructions"
                  required
                  rows="3"
                  defaultValue={editingMethod?.instructions || ''}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.description}
                  </span>
                  <textarea
                    name="description"
                    rows="2"
                    defaultValue={editingMethod?.description || ''}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    {labels.note}
                  </span>
                  <textarea
                    name="note"
                    rows="2"
                    defaultValue={editingMethod?.note || ''}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>
              </div>

              <section className="rounded-3xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-start">
                    <h3 className="font-black text-slate-900 dark:text-white">
                      {labels.formFields}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {labels.formFieldsHint}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addFormField}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <FiPlus />
                    {labels.addField}
                  </button>
                </div>

                {!formFields.length ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
                    {labels.noFields}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {formFields.map((field, index) => (
                      <div
                        key={`${field.field_key}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <label className="block">
                            <span className="mb-1 block text-xs font-black text-slate-500">
                              {labels.fieldName}
                            </span>
                            <input
                              type="text"
                              required
                              value={field.field_name}
                              onChange={(event) => (
                                updateFormField(index, 'field_name', event.target.value)
                              )}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-black text-slate-500">
                              {labels.fieldKey}
                            </span>
                            <input
                              type="text"
                              readOnly
                              value={field.field_key}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500 outline-none dark:border-slate-700 dark:bg-slate-800"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-black text-slate-500">
                              {labels.inputType}
                            </span>
                            <select
                              value={field.input_type}
                              onChange={(event) => (
                                updateFormField(index, 'input_type', event.target.value)
                              )}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                              <option value="file">File</option>
                            </select>
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-black text-slate-500">
                              {labels.placeholder}
                            </span>
                            <input
                              type="text"
                              value={field.placeholder}
                              onChange={(event) => (
                                updateFormField(index, 'placeholder', event.target.value)
                              )}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                          </label>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
                            <input
                              type="checkbox"
                              checked={field.is_required}
                              onChange={(event) => (
                                updateFormField(index, 'is_required', event.target.checked)
                              )}
                            />
                            {labels.required}
                          </label>

                          <button
                            type="button"
                            onClick={() => removeFormField(index)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                          >
                            <FiTrash2 />
                            {labels.remove}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={editingMethod?.is_active ?? true}
                />
                <div className="text-start">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {labels.activeStatus}
                  </p>
                </div>
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {labels.cancel}
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {saving && <FiRefreshCw className="animate-spin" />}
                  {saving
                    ? labels.saving
                    : (editingMethod ? labels.update : labels.save)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentMethods;