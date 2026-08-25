import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  FiAlertCircle,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiHash,
  FiKey,
  FiMail,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';

import axiosInstance from '../../utils/axiosConfig';
import { useStateContext } from '../../contexts/ContextProvider';

const PAGE_SIZE = 12;

const normalizeList = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
};

const getInitials = (name) => {
  const value = String(name || '').trim();

  if (!value) {
    return 'AD';
  }

  const parts = value
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`
    .toUpperCase();
};

const getApiError = (error, fallback) => (
  error?.response?.data?.error
  || error?.response?.data?.detail
  || error?.response?.data?.message
  || fallback
);

const ModalShell = ({
  open,
  title,
  subtitle,
  children,
  onClose,
  busy,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className="
        fixed
        inset-0
        z-[1300]
        flex
        items-center
        justify-center
        bg-slate-950/60
        p-4
        backdrop-blur-sm
      "
    >
      <div
        className="
          flex
          max-h-[92vh]
          w-full
          max-w-5xl
          flex-col
          overflow-hidden
          rounded-3xl
          border
          border-slate-200
          bg-white
          shadow-2xl
          dark:border-slate-700
          dark:bg-slate-900
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
            gap-4
            border-b
            border-slate-100
            px-5
            py-4
            dark:border-slate-800
          "
        >
          <div className="min-w-0 text-start">
            <h3
              className="
                truncate
                text-lg
                font-black
                text-slate-900
                dark:text-white
              "
            >
              {title}
            </h3>

            {subtitle && (
              <p
                className="
                  mt-1
                  truncate
                  text-xs
                  font-semibold
                  text-slate-400
                "
              >
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              text-slate-400
              transition
              hover:bg-slate-100
              hover:text-slate-700
              disabled:cursor-not-allowed
              disabled:opacity-50
              dark:hover:bg-slate-800
              dark:hover:text-white
            "
          >
            <FiX />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

const InfoCard = ({
  icon,
  label,
  value,
  accentColor,
  dir,
}) => (
  <div
    className="
      rounded-2xl
      border
      border-slate-100
      bg-slate-50/70
      p-4
      dark:border-slate-700
      dark:bg-slate-900/40
    "
  >
    <div
      className="
        mb-3
        flex
        items-center
        gap-2
      "
    >
      <div
        className="
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-xl
        "
        style={{
          backgroundColor: `${accentColor}14`,
          color: accentColor,
        }}
      >
        {icon}
      </div>

      <span
        className="
          text-xs
          font-bold
          text-slate-400
        "
      >
        {label}
      </span>
    </div>

    <p
      dir={dir}
      className="
        break-words
        text-base
        font-black
        text-slate-900
        dark:text-white
      "
    >
      {value === null
        || value === undefined
        || value === ''
        ? '—'
        : String(value)}
    </p>
  </div>
);

const Admins = () => {
  const {
    i18n,
  } = useTranslation();

  const {
    currentColor,
  } = useStateContext();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const locale = (
    i18n.resolvedLanguage
    || i18n.language
    || (isArabic ? 'ar' : 'en')
  );

  const accentColor = currentColor || '#06b6d4';

  const labels = useMemo(() => ({
    category: isArabic
      ? 'إدارة المستخدمين'
      : 'User Management',

    title: isArabic
      ? 'المدراء'
      : 'Administrators',

    subtitle: isArabic
      ? 'إدارة حسابات المدراء والحماية الإضافية وصلاحيات الوصول من مكان واحد.'
      : 'Manage administrator accounts, additional security, and access privileges from one place.',

    refresh: isArabic
      ? 'تحديث البيانات'
      : 'Refresh',

    searchPlaceholder: isArabic
      ? 'ابحث باسم المدير أو رقم ID...'
      : 'Search by administrator name or ID...',

    total: isArabic
      ? 'إجمالي المدراء'
      : 'Total admins',

    active: isArabic
      ? 'المدراء النشطون'
      : 'Active admins',

    superAdmins: isArabic
      ? 'Super Admin'
      : 'Super admins',

    secured: isArabic
      ? 'الحماية الإضافية'
      : 'Extra security',

    shown: isArabic
      ? 'النتائج الظاهرة'
      : 'Visible results',

    loading: isArabic
      ? 'جاري تحميل المدراء...'
      : 'Loading administrators...',

    loadFailed: isArabic
      ? 'تعذر تحميل قائمة المدراء.'
      : 'Failed to load administrators.',

    empty: isArabic
      ? 'لا يوجد مدراء مطابقون للبحث.'
      : 'No administrators match your search.',

    openProfile: isArabic
      ? 'عرض تفاصيل المدير'
      : 'View administrator details',

    page: isArabic
      ? 'صفحة'
      : 'Page',

    of: isArabic
      ? 'من'
      : 'of',

    admin: isArabic
      ? 'مدير'
      : 'Admin',

    super: isArabic
      ? 'Super'
      : 'Super',

    activeStatus: isArabic
      ? 'نشط'
      : 'Active',

    inactiveStatus: isArabic
      ? 'غير نشط'
      : 'Inactive',

    securedStatus: isArabic
      ? 'الحماية مفعّلة'
      : 'Security enabled',

    securityNeeded: isArabic
      ? 'بحاجة لإعداد'
      : 'Setup needed',

    securityWarning: isArabic
      ? 'يوجد مدير أو أكثر لم يتم إعداد كلمة المرور الإضافية له بعد.'
      : 'One or more administrators still need an additional password configured.',

    detailsTitle: isArabic
      ? 'تفاصيل المدير'
      : 'Administrator Details',

    overview: isArabic
      ? 'نظرة عامة'
      : 'Overview',

    security: isArabic
      ? 'الحماية'
      : 'Security',

    actions: isArabic
      ? 'الإجراءات'
      : 'Actions',

    basicInfo: isArabic
      ? 'المعلومات الأساسية'
      : 'Basic information',

    accountStatus: isArabic
      ? 'حالة الحساب'
      : 'Account status',

    username: isArabic
      ? 'اسم المستخدم'
      : 'Username',

    fullName: isArabic
      ? 'الاسم الكامل'
      : 'Full name',

    email: isArabic
      ? 'البريد الإلكتروني'
      : 'Email',

    phone: isArabic
      ? 'رقم الهاتف'
      : 'Phone',

    joined: isArabic
      ? 'تاريخ الانضمام'
      : 'Joined date',

    lastLogin: isArabic
      ? 'آخر تسجيل دخول'
      : 'Last login',

    staff: isArabic
      ? 'Staff access'
      : 'Staff access',

    categoryLabel: isArabic
      ? 'الفئة'
      : 'Category',

    permissions: isArabic
      ? 'الصلاحيات'
      : 'Permissions',

    groups: isArabic
      ? 'المجموعات'
      : 'Groups',

    userPermissions: isArabic
      ? 'صلاحيات المستخدم'
      : 'User permissions',

    noPermissions: isArabic
      ? 'لا توجد صلاحيات مخصصة.'
      : 'No custom permissions.',

    secondPassword: isArabic
      ? 'كلمة المرور الإضافية'
      : 'Additional password',

    passwordConfigured: isArabic
      ? 'تم إعداد كلمة المرور الإضافية لهذا المدير.'
      : 'The additional password is configured for this administrator.',

    passwordNotConfigured: isArabic
      ? 'لم يتم إعداد كلمة المرور الإضافية بعد.'
      : 'The additional password has not been configured yet.',

    lastUpdated: isArabic
      ? 'آخر تحديث'
      : 'Last updated',

    newPassword: isArabic
      ? 'كلمة المرور الجديدة'
      : 'New password',

    confirmPassword: isArabic
      ? 'تأكيد كلمة المرور'
      : 'Confirm password',

    passwordRules: isArabic
      ? 'يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وصغير ورقم ورمز خاص.'
      : 'Use at least 8 characters with uppercase, lowercase, number, and special character.',

    updatePassword: isArabic
      ? 'تحديث كلمة المرور'
      : 'Update password',

    updatingPassword: isArabic
      ? 'جاري التحديث...'
      : 'Updating...',

    passwordUpdated: isArabic
      ? 'تم تحديث كلمة المرور الإضافية بنجاح.'
      : 'Additional password updated successfully.',

    passwordsMismatch: isArabic
      ? 'كلمتا المرور غير متطابقتين.'
      : 'Passwords do not match.',

    passwordInvalid: isArabic
      ? 'كلمة المرور لا تحقق شروط الأمان المطلوبة.'
      : 'Password does not meet the required security rules.',

    passwordFailed: isArabic
      ? 'تعذر تحديث كلمة المرور الإضافية.'
      : 'Failed to update the additional password.',

    dangerTitle: isArabic
      ? 'إزالة صلاحية المدير'
      : 'Remove administrator role',

    dangerDescription: isArabic
      ? 'سيتم تحويل هذا الحساب إلى مستخدم عادي وإزالة صلاحيات Staff وSuperuser. لا يمكن للمدير إزالة صلاحية حسابه بنفسه.'
      : 'This account will be demoted to a regular user and Staff/Superuser privileges will be removed. Administrators cannot demote their own account.',

    removeAdmin: isArabic
      ? 'إزالة صلاحية المدير'
      : 'Remove admin role',

    removing: isArabic
      ? 'جاري التنفيذ...'
      : 'Removing...',

    removeConfirm: isArabic
      ? 'هل أنت متأكد من إزالة صلاحية المدير لهذا الحساب؟'
      : 'Are you sure you want to remove administrator privileges from this account?',

    removeSuccess: isArabic
      ? 'تم تحويل الحساب إلى مستخدم عادي.'
      : 'The account was demoted to a regular user.',

    removeFailed: isArabic
      ? 'تعذر إزالة صلاحية المدير.'
      : 'Failed to remove administrator role.',

    detailsFailed: isArabic
      ? 'تعذر تحميل تفاصيل المدير.'
      : 'Failed to load administrator details.',

    close: isArabic
      ? 'إغلاق'
      : 'Close',
  }), [isArabic]);

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [adminDetails, setAdminDetails] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [removingAdmin, setRemovingAdmin] = useState(false);
  const [notice, setNotice] = useState(null);

  const fetchAdmins = useCallback(
    async ({ background = false } = {}) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const response = await axiosInstance.get(
          '/users/admin-users/',
        );

        setAdmins(
          normalizeList(response.data),
        );
      } catch (loadError) {
        console.error(
          'Error loading admins:',
          loadError,
        );

        setError(
          getApiError(
            loadError,
            labels.loadFailed,
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [labels.loadFailed],
  );

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredAdmins = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return admins;
    }

    return admins.filter((admin) => {
      const values = [
        admin?.id,
        admin?.name,
        admin?.full_name,
        admin?.email,
        admin?.phone,
      ];

      return values.some((value) => (
        value !== null
        && value !== undefined
        && String(value)
          .toLowerCase()
          .includes(query)
      ));
    });
  }, [
    admins,
    search,
  ]);

  const stats = useMemo(() => {
    const total = admins.length;
    const active = admins.filter(
      (admin) => admin.is_active,
    ).length;
    const superAdmins = admins.filter(
      (admin) => admin.is_superuser,
    ).length;
    const secured = admins.filter(
      (admin) => admin.has_second_password,
    ).length;

    return {
      total,
      active,
      superAdmins,
      secured,
      securityPercent: total > 0
        ? Math.round(
            (secured / total) * 100,
          )
        : 0,
    };
  }, [admins]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredAdmins.length / PAGE_SIZE,
    ),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const visibleAdmins = useMemo(() => {
    const start = (
      currentPage - 1
    ) * PAGE_SIZE;

    return filteredAdmins.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [
    currentPage,
    filteredAdmins,
  ]);

  const formatDate = useCallback(
    (value) => {
      if (!value) {
        return '—';
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return date.toLocaleString(locale);
    },
    [locale],
  );

  const loadAdminDetails = useCallback(
    async (admin) => {
      setSelectedAdmin(admin);
      setAdminDetails(null);
      setDetailsError('');
      setActiveTab('overview');
      setPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setDetailsOpen(true);
      setDetailsLoading(true);

      try {
        const response = await axiosInstance.get(
          `/users/admin-users/${admin.id}/`,
        );

        setAdminDetails(
          response.data,
        );
      } catch (loadError) {
        console.error(
          'Error loading admin details:',
          loadError,
        );

        setDetailsError(
          getApiError(
            loadError,
            labels.detailsFailed,
          ),
        );
      } finally {
        setDetailsLoading(false);
      }
    },
    [labels.detailsFailed],
  );

  const closeDetails = () => {
    if (
      updatingPassword
      || removingAdmin
    ) {
      return;
    }

    setDetailsOpen(false);
    setSelectedAdmin(null);
    setAdminDetails(null);
    setDetailsError('');
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const updateSecondPassword = async (event) => {
    event.preventDefault();

    if (!selectedAdmin) {
      return;
    }

    if (
      password.length < 8
      || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/.test(
        password,
      )
    ) {
      setPasswordError(
        labels.passwordInvalid,
      );
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError(
        labels.passwordsMismatch,
      );
      return;
    }

    setUpdatingPassword(true);
    setPasswordError('');

    try {
      await axiosInstance.post(
        `/users/set-admin-password/${selectedAdmin.id}/`,
        {
          second_password: password,
          confirm_password: confirmPassword,
        },
      );

      setPassword('');
      setConfirmPassword('');

      setNotice({
        type: 'success',
        message: labels.passwordUpdated,
      });

      await fetchAdmins({
        background: true,
      });

      const response = await axiosInstance.get(
        `/users/admin-users/${selectedAdmin.id}/`,
      );

      setAdminDetails(
        response.data,
      );
    } catch (updateError) {
      setPasswordError(
        getApiError(
          updateError,
          labels.passwordFailed,
        ),
      );
    } finally {
      setUpdatingPassword(false);
    }
  };

  const removeAdminRole = async () => {
    if (!selectedAdmin) {
      return;
    }

    if (
      !window.confirm(
        labels.removeConfirm,
      )
    ) {
      return;
    }

    setRemovingAdmin(true);
    setNotice(null);

    try {
      await axiosInstance.post(
        `/users/remove-admin/${selectedAdmin.id}/`,
      );

      closeDetails();

      setNotice({
        type: 'success',
        message: labels.removeSuccess,
      });

      await fetchAdmins({
        background: true,
      });
    } catch (removeError) {
      setNotice({
        type: 'error',
        message: getApiError(
          removeError,
          labels.removeFailed,
        ),
      });
    } finally {
      setRemovingAdmin(false);
    }
  };

  const details = (
    adminDetails
    || selectedAdmin
  );

  const hasSecondPassword = (
    adminDetails?.security?.has_second_password
    ?? selectedAdmin?.has_second_password
    ?? false
  );

  const secondPasswordSetAt = (
    adminDetails?.security?.second_password_set_at
    ?? selectedAdmin?.second_password_set_at
    ?? null
  );

  const tabs = [
    {
      id: 'overview',
      label: labels.overview,
      icon: <FiUser />,
    },
    {
      id: 'security',
      label: labels.security,
      icon: <FiShield />,
    },
    {
      id: 'actions',
      label: labels.actions,
      icon: <FiTrash2 />,
    },
  ];

  return (
    <>
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
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
            space-y-5
          "
        >
          <section
            className="
              relative
              overflow-hidden
              rounded-3xl
              border
              border-slate-100
              bg-white
              px-5
              py-6
              shadow-sm
              dark:border-slate-800
              dark:bg-secondary-dark-bg
              md:px-7
              md:py-7
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                -start-24
                -top-28
                h-64
                w-64
                rounded-full
                opacity-[0.08]
              "
              style={{
                backgroundColor: accentColor,
              }}
            />

            <div
              className="
                pointer-events-none
                absolute
                -bottom-24
                end-10
                h-48
                w-48
                rounded-full
                opacity-[0.04]
              "
              style={{
                backgroundColor: accentColor,
              }}
            />

            <div
              className="
                relative
                z-10
                flex
                flex-col
                gap-6
                xl:flex-row
                xl:items-end
                xl:justify-between
              "
            >
              <div className="max-w-2xl text-start">
                <div
                  className="
                    mb-3
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
                      backgroundColor: accentColor,
                    }}
                  />

                  <span
                    className="
                      text-sm
                      font-extrabold
                    "
                    style={{
                      color: accentColor,
                    }}
                  >
                    {labels.category}
                  </span>
                </div>

                <h1
                  className="
                    text-3xl
                    font-black
                    tracking-tight
                    text-slate-950
                    dark:text-white
                    md:text-4xl
                  "
                >
                  {labels.title}
                </h1>

                <p
                  className="
                    mt-2
                    max-w-xl
                    text-sm
                    font-medium
                    leading-7
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  {labels.subtitle}
                </p>
              </div>

              <div
                className="
                  flex
                  w-full
                  flex-col
                  gap-3
                  sm:flex-row
                  xl:w-auto
                "
              >
                <div
                  className="
                    relative
                    min-w-0
                    flex-1
                    xl:w-[360px]
                  "
                >
                  <FiSearch
                    className="
                      pointer-events-none
                      absolute
                      start-4
                      top-1/2
                      -translate-y-1/2
                      text-slate-400
                    "
                  />

                  <input
                    type="search"
                    value={search}
                    onChange={(event) => (
                      setSearch(
                        event.target.value,
                      )
                    )}
                    placeholder={labels.searchPlaceholder}
                    className="
                      h-12
                      w-full
                      rounded-2xl
                      border
                      border-slate-200
                      bg-white
                      ps-11
                      pe-4
                      text-sm
                      font-semibold
                      text-slate-900
                      outline-none
                      transition
                      placeholder:text-slate-400
                      focus:border-slate-300
                      focus:ring-4
                      focus:ring-slate-100
                      dark:border-slate-700
                      dark:bg-slate-900
                      dark:text-white
                      dark:focus:ring-slate-800
                    "
                  />
                </div>

                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => (
                    fetchAdmins({
                      background: true,
                    })
                  )}
                  className="
                    flex
                    h-12
                    shrink-0
                    items-center
                    justify-center
                    gap-2
                    rounded-2xl
                    px-5
                    text-sm
                    font-extrabold
                    text-white
                    shadow-sm
                    transition
                    hover:opacity-90
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                  style={{
                    backgroundColor: accentColor,
                  }}
                >
                  <FiRefreshCw
                    className={
                      refreshing
                        ? 'animate-spin'
                        : ''
                    }
                  />

                  {labels.refresh}
                </button>
              </div>
            </div>
          </section>

          <section
            className="
              grid
              gap-3
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >
            {[
              {
                label: labels.total,
                value: stats.total,
                icon: <FiUsers />,
              },
              {
                label: labels.active,
                value: stats.active,
                icon: <FiCheck />,
              },
              {
                label: labels.superAdmins,
                value: stats.superAdmins,
                icon: <FiShield />,
              },
              {
                label: labels.secured,
                value: `${stats.secured} / ${stats.total}`,
                icon: <FiKey />,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="
                  flex
                  items-center
                  gap-4
                  rounded-2xl
                  border
                  border-slate-100
                  bg-white
                  p-4
                  shadow-sm
                  dark:border-slate-800
                  dark:bg-secondary-dark-bg
                "
              >
                <div
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                  "
                  style={{
                    backgroundColor: `${accentColor}14`,
                    color: accentColor,
                  }}
                >
                  {stat.icon}
                </div>

                <div className="text-start">
                  <p
                    className="
                      text-xs
                      font-bold
                      text-slate-400
                    "
                  >
                    {stat.label}
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-2xl
                      font-black
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </section>

          {stats.securityPercent < 100
            && stats.total > 0 && (
            <div
              className="
                flex
                items-start
                gap-3
                rounded-2xl
                border
                border-amber-200
                bg-amber-50
                px-4
                py-3
                text-sm
                font-bold
                text-amber-800
                dark:border-amber-900/40
                dark:bg-amber-950/30
                dark:text-amber-300
              "
            >
              <FiAlertCircle
                className="
                  mt-0.5
                  shrink-0
                "
              />

              <span>
                {labels.securityWarning}
              </span>
            </div>
          )}

          {notice && (
            <div
              className={`
                flex
                items-start
                gap-3
                rounded-2xl
                border
                px-4
                py-3
                text-sm
                font-bold
                ${
                  notice.type === 'success'
                    ? 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
                }
              `}
            >
              {notice.type === 'success'
                ? (
                  <FiCheck
                    className="
                      mt-0.5
                      shrink-0
                    "
                    style={{
                      color: accentColor,
                    }}
                  />
                )
                : (
                  <FiAlertCircle
                    className="
                      mt-0.5
                      shrink-0
                    "
                  />
                )}

              <span className="flex-1">
                {notice.message}
              </span>

              <button
                type="button"
                onClick={() => setNotice(null)}
              >
                <FiX />
              </button>
            </div>
          )}

          {error && (
            <div
              className="
                rounded-2xl
                border
                border-red-200
                bg-red-50
                px-4
                py-3
                text-sm
                font-bold
                text-red-700
                dark:border-red-900/40
                dark:bg-red-950/30
                dark:text-red-300
              "
            >
              {error}
            </div>
          )}

          <section
            className="
              rounded-3xl
              border
              border-slate-100
              bg-white
              p-4
              shadow-sm
              dark:border-slate-800
              dark:bg-secondary-dark-bg
              sm:p-5
            "
          >
            {loading ? (
              <div
                className="
                  flex
                  min-h-[360px]
                  flex-col
                  items-center
                  justify-center
                  gap-3
                  text-slate-400
                "
              >
                <FiRefreshCw
                  className="
                    animate-spin
                    text-3xl
                  "
                />

                <p className="text-sm font-bold">
                  {labels.loading}
                </p>
              </div>
            ) : visibleAdmins.length === 0 ? (
              <div
                className="
                  flex
                  min-h-[320px]
                  flex-col
                  items-center
                  justify-center
                  gap-4
                  text-center
                "
              >
                <div
                  className="
                    flex
                    h-16
                    w-16
                    items-center
                    justify-center
                    rounded-2xl
                  "
                  style={{
                    backgroundColor: `${accentColor}12`,
                    color: accentColor,
                  }}
                >
                  <FiShield className="text-2xl" />
                </div>

                <p
                  className="
                    text-sm
                    font-bold
                    text-slate-400
                  "
                >
                  {labels.empty}
                </p>
              </div>
            ) : (
              <div
                className="
                  grid
                  gap-3
                  sm:grid-cols-2
                  xl:grid-cols-3
                "
              >
                {visibleAdmins.map((admin) => {
                  const name = (
                    admin.full_name
                    || admin.name
                    || `${labels.admin} #${admin.id}`
                  );

                  return (
                    <button
                      key={admin.id}
                      type="button"
                      onClick={() => (
                        loadAdminDetails(
                          admin,
                        )
                      )}
                      className="
                        group
                        relative
                        overflow-hidden
                        rounded-2xl
                        border
                        border-slate-100
                        bg-slate-50/70
                        p-4
                        text-start
                        transition-all
                        duration-200
                        hover:-translate-y-0.5
                        hover:border-slate-200
                        hover:bg-white
                        hover:shadow-md
                        dark:border-slate-700
                        dark:bg-slate-900/40
                        dark:hover:border-slate-600
                        dark:hover:bg-slate-900
                      "
                    >
                      <div
                        className="
                          absolute
                          inset-y-0
                          start-0
                          w-1
                          opacity-0
                          transition-opacity
                          group-hover:opacity-100
                        "
                        style={{
                          backgroundColor: accentColor,
                        }}
                      />

                      <div
                        className="
                          flex
                          items-start
                          gap-4
                        "
                      >
                        <div
                          className="
                            flex
                            h-12
                            w-12
                            shrink-0
                            items-center
                            justify-center
                            rounded-2xl
                            text-sm
                            font-black
                            text-white
                            shadow-sm
                          "
                          style={{
                            backgroundColor: accentColor,
                          }}
                        >
                          {getInitials(name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div
                            className="
                              flex
                              flex-wrap
                              items-center
                              gap-2
                            "
                          >
                            <p
                              className="
                                truncate
                                text-base
                                font-black
                                text-slate-900
                                dark:text-white
                              "
                            >
                              {name}
                            </p>

                            {admin.is_superuser && (
                              <span
                                className="
                                  rounded-full
                                  border
                                  px-2
                                  py-0.5
                                  text-[10px]
                                  font-black
                                "
                                style={{
                                  backgroundColor: `${accentColor}10`,
                                  borderColor: `${accentColor}28`,
                                  color: accentColor,
                                }}
                              >
                                {labels.super}
                              </span>
                            )}
                          </div>

                          <div
                            className="
                              mt-1.5
                              flex
                              flex-wrap
                              items-center
                              gap-2
                            "
                          >
                            <span
                              className="
                                rounded-lg
                                bg-white
                                px-2
                                py-1
                                text-xs
                                font-extrabold
                                text-slate-500
                                shadow-sm
                                dark:bg-slate-800
                                dark:text-slate-300
                              "
                              dir="ltr"
                            >
                              #{admin.id}
                            </span>

                            <span
                              className="
                                text-xs
                                font-bold
                                text-slate-400
                              "
                            >
                              {admin.is_active
                                ? labels.activeStatus
                                : labels.inactiveStatus}
                            </span>
                          </div>
                        </div>

                        <div
                          className="
                            flex
                            h-9
                            w-9
                            shrink-0
                            items-center
                            justify-center
                            rounded-xl
                            bg-white
                            text-slate-400
                            shadow-sm
                            transition
                            group-hover:text-slate-700
                            dark:bg-slate-800
                            dark:group-hover:text-white
                          "
                        >
                          {isArabic
                            ? <FiChevronLeft />
                            : <FiChevronRight />}
                        </div>
                      </div>

                      <div
                        className="
                          mt-4
                          flex
                          items-center
                          justify-between
                          border-t
                          border-slate-100
                          pt-3
                          dark:border-slate-700
                        "
                      >
                        <span
                          className="
                            flex
                            items-center
                            gap-1.5
                            text-xs
                            font-bold
                            text-slate-400
                          "
                        >
                          <FiKey />

                          {admin.has_second_password
                            ? labels.securedStatus
                            : labels.securityNeeded}
                        </span>

                        <span
                          className="
                            text-xs
                            font-black
                          "
                          style={{
                            color: accentColor,
                          }}
                        >
                          {labels.openProfile}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {!loading
            && filteredAdmins.length > 0
            && totalPages > 1 && (
            <section
              className="
                flex
                flex-col
                gap-3
                rounded-2xl
                border
                border-slate-100
                bg-white
                px-4
                py-3
                shadow-sm
                dark:border-slate-800
                dark:bg-secondary-dark-bg
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <p
                className="
                  text-sm
                  font-bold
                  text-slate-500
                  dark:text-slate-400
                "
              >
                {labels.page}{' '}
                <span
                  className="
                    font-black
                    text-slate-900
                    dark:text-white
                  "
                >
                  {currentPage}
                </span>{' '}
                {labels.of}{' '}
                <span
                  className="
                    font-black
                    text-slate-900
                    dark:text-white
                  "
                >
                  {totalPages}
                </span>
              </p>

              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => (
                    setPage(
                      (previous) => Math.max(
                        1,
                        previous - 1,
                      ),
                    )
                  )}
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    text-slate-500
                    transition
                    hover:bg-slate-50
                    disabled:cursor-not-allowed
                    disabled:opacity-30
                    dark:border-slate-700
                    dark:bg-slate-900
                    dark:text-slate-300
                  "
                >
                  {isArabic
                    ? <FiChevronRight />
                    : <FiChevronLeft />}
                </button>

                <div
                  className="
                    min-w-[72px]
                    rounded-xl
                    px-3
                    py-2
                    text-center
                    text-sm
                    font-black
                    text-white
                  "
                  style={{
                    backgroundColor: accentColor,
                  }}
                >
                  {currentPage} / {totalPages}
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => (
                    setPage(
                      (previous) => Math.min(
                        totalPages,
                        previous + 1,
                      ),
                    )
                  )}
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    text-slate-500
                    transition
                    hover:bg-slate-50
                    disabled:cursor-not-allowed
                    disabled:opacity-30
                    dark:border-slate-700
                    dark:bg-slate-900
                    dark:text-slate-300
                  "
                >
                  {isArabic
                    ? <FiChevronLeft />
                    : <FiChevronRight />}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      <ModalShell
        open={detailsOpen}
        busy={
          updatingPassword
          || removingAdmin
        }
        onClose={closeDetails}
        title={
          details
            ? (
              details.full_name
              || details.name
              || labels.detailsTitle
            )
            : labels.detailsTitle
        }
        subtitle={
          selectedAdmin
            ? `#${selectedAdmin.id}`
            : ''
        }
      >
        {detailsLoading ? (
          <div
            className="
              flex
              min-h-[420px]
              flex-col
              items-center
              justify-center
              gap-3
              text-slate-400
            "
          >
            <FiRefreshCw
              className="
                animate-spin
                text-3xl
              "
            />

            <span className="text-sm font-bold">
              {labels.loading}
            </span>
          </div>
        ) : detailsError ? (
          <div
            className="
              m-5
              rounded-2xl
              border
              border-red-200
              bg-red-50
              p-4
              text-sm
              font-bold
              text-red-700
              dark:border-red-900/40
              dark:bg-red-950/30
              dark:text-red-300
            "
          >
            {detailsError}
          </div>
        ) : details ? (
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className="p-5"
          >
            <div
              className="
                mb-5
                flex
                flex-col
                gap-4
                rounded-2xl
                border
                border-slate-100
                bg-slate-50/70
                p-4
                dark:border-slate-700
                dark:bg-slate-900/40
                sm:flex-row
                sm:items-center
              "
            >
              <div
                className="
                  flex
                  h-16
                  w-16
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  text-xl
                  font-black
                  text-white
                "
                style={{
                  backgroundColor: accentColor,
                }}
              >
                {getInitials(
                  details.full_name
                  || details.name,
                )}
              </div>

              <div className="min-w-0 flex-1 text-start">
                <div
                  className="
                    flex
                    flex-wrap
                    items-center
                    gap-2
                  "
                >
                  <h4
                    className="
                      truncate
                      text-xl
                      font-black
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {details.full_name
                      || details.name}
                  </h4>

                  {details.is_superuser && (
                    <span
                      className="
                        rounded-full
                        border
                        px-2.5
                        py-1
                        text-[10px]
                        font-black
                      "
                      style={{
                        backgroundColor: `${accentColor}10`,
                        borderColor: `${accentColor}28`,
                        color: accentColor,
                      }}
                    >
                      {labels.super}
                    </span>
                  )}
                </div>

                <p
                  className="
                    mt-1
                    text-sm
                    font-bold
                    text-slate-400
                  "
                  dir="ltr"
                >
                  #{details.id} · @{details.name}
                </p>
              </div>
            </div>

            <div
              className="
                mb-5
                grid
                gap-2
                rounded-2xl
                border
                border-slate-100
                bg-white
                p-2
                dark:border-slate-800
                dark:bg-slate-950/20
                md:grid-cols-3
              "
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => (
                    setActiveTab(
                      tab.id,
                    )
                  )}
                  className={`
                    flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    px-4
                    py-3
                    text-sm
                    font-black
                    transition
                    ${
                      activeTab === tab.id
                        ? 'text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                    }
                  `}
                  style={
                    activeTab === tab.id
                      ? {
                          backgroundColor: accentColor,
                        }
                      : undefined
                  }
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-5">
                <section>
                  <h5
                    className="
                      mb-4
                      text-base
                      font-black
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {labels.basicInfo}
                  </h5>

                  <div
                    className="
                      grid
                      gap-3
                      sm:grid-cols-2
                      xl:grid-cols-3
                    "
                  >
                    <InfoCard
                      icon={<FiHash />}
                      label="ID"
                      value={`#${details.id}`}
                      accentColor={accentColor}
                      dir="ltr"
                    />

                    <InfoCard
                      icon={<FiUser />}
                      label={labels.username}
                      value={details.name}
                      accentColor={accentColor}
                    />

                    <InfoCard
                      icon={<FiUser />}
                      label={labels.fullName}
                      value={details.full_name}
                      accentColor={accentColor}
                    />

                    <InfoCard
                      icon={<FiMail />}
                      label={labels.email}
                      value={details.email}
                      accentColor={accentColor}
                      dir="ltr"
                    />

                    <InfoCard
                      icon={<FiPhone />}
                      label={labels.phone}
                      value={details.phone}
                      accentColor={accentColor}
                      dir="ltr"
                    />

                    <InfoCard
                      icon={<FiUsers />}
                      label={labels.categoryLabel}
                      value={
                        details.category?.display_name
                        || details.category
                      }
                      accentColor={accentColor}
                    />
                  </div>
                </section>

                <section>
                  <h5
                    className="
                      mb-4
                      text-base
                      font-black
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {labels.accountStatus}
                  </h5>

                  <div
                    className="
                      grid
                      gap-3
                      sm:grid-cols-2
                      xl:grid-cols-4
                    "
                  >
                    <InfoCard
                      icon={<FiCheck />}
                      label={labels.accountStatus}
                      value={
                        details.is_active
                          ? labels.activeStatus
                          : labels.inactiveStatus
                      }
                      accentColor={accentColor}
                    />

                    <InfoCard
                      icon={<FiShield />}
                      label={labels.superAdmins}
                      value={
                        details.is_superuser
                          ? labels.super
                          : '—'
                      }
                      accentColor={accentColor}
                    />

                    <InfoCard
                      icon={<FiShield />}
                      label={labels.staff}
                      value={
                        details.is_staff
                          ? 'Yes'
                          : 'No'
                      }
                      accentColor={accentColor}
                    />

                    <InfoCard
                      icon={<FiClock />}
                      label={labels.joined}
                      value={formatDate(
                        details.date_joined,
                      )}
                      accentColor={accentColor}
                    />

                    <InfoCard
                      icon={<FiClock />}
                      label={labels.lastLogin}
                      value={formatDate(
                        details.last_login,
                      )}
                      accentColor={accentColor}
                    />
                  </div>
                </section>

                <section>
                  <h5
                    className="
                      mb-4
                      text-base
                      font-black
                      text-slate-900
                      dark:text-white
                    "
                  >
                    {labels.permissions}
                  </h5>

                  <div
                    className="
                      grid
                      gap-3
                      md:grid-cols-2
                    "
                  >
                    <div
                      className="
                        rounded-2xl
                        border
                        border-slate-100
                        bg-slate-50/70
                        p-4
                        dark:border-slate-700
                        dark:bg-slate-900/40
                      "
                    >
                      <p
                        className="
                          mb-3
                          text-xs
                          font-black
                          text-slate-400
                        "
                      >
                        {labels.groups}
                      </p>

                      <div
                        className="
                          flex
                          flex-wrap
                          gap-2
                        "
                      >
                        {details.permissions?.groups?.length ? (
                          details.permissions.groups.map((group) => (
                            <span
                              key={group}
                              className="
                                rounded-xl
                                border
                                px-2.5
                                py-1
                                text-xs
                                font-bold
                              "
                              style={{
                                backgroundColor: `${accentColor}10`,
                                borderColor: `${accentColor}24`,
                                color: accentColor,
                              }}
                            >
                              {group}
                            </span>
                          ))
                        ) : (
                          <span
                            className="
                              text-sm
                              font-semibold
                              text-slate-400
                            "
                          >
                            {labels.noPermissions}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className="
                        rounded-2xl
                        border
                        border-slate-100
                        bg-slate-50/70
                        p-4
                        dark:border-slate-700
                        dark:bg-slate-900/40
                      "
                    >
                      <p
                        className="
                          mb-3
                          text-xs
                          font-black
                          text-slate-400
                        "
                      >
                        {labels.userPermissions}
                      </p>

                      <div
                        className="
                          flex
                          flex-wrap
                          gap-2
                        "
                      >
                        {details.permissions?.user_permissions?.length ? (
                          details.permissions.user_permissions.map(
                            (permission) => (
                              <span
                                key={permission}
                                className="
                                  rounded-xl
                                  border
                                  px-2.5
                                  py-1
                                  text-xs
                                  font-bold
                                "
                                style={{
                                  backgroundColor: `${accentColor}10`,
                                  borderColor: `${accentColor}24`,
                                  color: accentColor,
                                }}
                              >
                                {permission}
                              </span>
                            ),
                          )
                        ) : (
                          <span
                            className="
                              text-sm
                              font-semibold
                              text-slate-400
                            "
                          >
                            {labels.noPermissions}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-5">
                <div
                  className="
                    rounded-2xl
                    border
                    border-slate-100
                    bg-slate-50/70
                    p-4
                    dark:border-slate-700
                    dark:bg-slate-900/40
                  "
                >
                  <div
                    className="
                      flex
                      flex-col
                      gap-4
                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                    "
                  >
                    <div className="text-start">
                      <p
                        className="
                          text-base
                          font-black
                          text-slate-900
                          dark:text-white
                        "
                      >
                        {labels.secondPassword}
                      </p>

                      <p
                        className="
                          mt-1
                          text-sm
                          font-semibold
                          text-slate-500
                          dark:text-slate-400
                        "
                      >
                        {hasSecondPassword
                          ? labels.passwordConfigured
                          : labels.passwordNotConfigured}
                      </p>

                      {secondPasswordSetAt && (
                        <p
                          className="
                            mt-2
                            text-xs
                            font-bold
                            text-slate-400
                          "
                        >
                          {labels.lastUpdated}: {formatDate(
                            secondPasswordSetAt,
                          )}
                        </p>
                      )}
                    </div>

                    <div
                      className="
                        flex
                        h-12
                        w-12
                        items-center
                        justify-center
                        rounded-2xl
                      "
                      style={{
                        backgroundColor: `${accentColor}14`,
                        color: accentColor,
                      }}
                    >
                      <FiKey className="text-xl" />
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={updateSecondPassword}
                  className="
                    rounded-2xl
                    border
                    border-slate-100
                    bg-white
                    p-4
                    dark:border-slate-700
                    dark:bg-slate-950/20
                  "
                >
                  {passwordError && (
                    <div
                      className="
                        mb-4
                        rounded-xl
                        border
                        border-red-200
                        bg-red-50
                        p-3
                        text-sm
                        font-bold
                        text-red-700
                        dark:border-red-900/40
                        dark:bg-red-950/30
                        dark:text-red-300
                      "
                    >
                      {passwordError}
                    </div>
                  )}

                  <div
                    className="
                      grid
                      gap-4
                      md:grid-cols-2
                    "
                  >
                    <label className="block">
                      <span
                        className="
                          mb-2
                          block
                          text-sm
                          font-black
                          text-slate-700
                          dark:text-slate-200
                        "
                      >
                        {labels.newPassword}
                      </span>

                      <input
                        type="password"
                        value={password}
                        onChange={(event) => (
                          setPassword(
                            event.target.value,
                          )
                        )}
                        className="
                          w-full
                          rounded-xl
                          border
                          border-slate-200
                          bg-white
                          px-4
                          py-3
                          font-semibold
                          text-slate-900
                          outline-none
                          transition
                          focus:border-slate-300
                          focus:ring-4
                          focus:ring-slate-100
                          dark:border-slate-700
                          dark:bg-slate-950
                          dark:text-white
                          dark:focus:ring-slate-800
                        "
                        required
                      />
                    </label>

                    <label className="block">
                      <span
                        className="
                          mb-2
                          block
                          text-sm
                          font-black
                          text-slate-700
                          dark:text-slate-200
                        "
                      >
                        {labels.confirmPassword}
                      </span>

                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => (
                          setConfirmPassword(
                            event.target.value,
                          )
                        )}
                        className="
                          w-full
                          rounded-xl
                          border
                          border-slate-200
                          bg-white
                          px-4
                          py-3
                          font-semibold
                          text-slate-900
                          outline-none
                          transition
                          focus:border-slate-300
                          focus:ring-4
                          focus:ring-slate-100
                          dark:border-slate-700
                          dark:bg-slate-950
                          dark:text-white
                          dark:focus:ring-slate-800
                        "
                        required
                      />
                    </label>
                  </div>

                  <p
                    className="
                      mt-3
                      text-xs
                      font-semibold
                      text-slate-400
                    "
                  >
                    {labels.passwordRules}
                  </p>

                  <button
                    type="submit"
                    disabled={
                      updatingPassword
                      || !password
                      || !confirmPassword
                    }
                    className="
                      mt-5
                      flex
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      px-4
                      py-2.5
                      text-sm
                      font-black
                      text-white
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                    style={{
                      backgroundColor: accentColor,
                    }}
                  >
                    {updatingPassword
                      ? <FiRefreshCw className="animate-spin" />
                      : <FiKey />}

                    {updatingPassword
                      ? labels.updatingPassword
                      : labels.updatePassword}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'actions' && (
              <div
                className="
                  rounded-2xl
                  border
                  border-red-200
                  bg-red-50
                  p-5
                  dark:border-red-900/40
                  dark:bg-red-950/20
                "
              >
                <div
                  className="
                    flex
                    flex-col
                    justify-between
                    gap-4
                    sm:flex-row
                    sm:items-center
                  "
                >
                  <div className="text-start">
                    <h5
                      className="
                        text-lg
                        font-black
                        text-red-700
                        dark:text-red-300
                      "
                    >
                      {labels.dangerTitle}
                    </h5>

                    <p
                      className="
                        mt-1
                        max-w-2xl
                        text-sm
                        font-semibold
                        leading-6
                        text-red-600
                        dark:text-red-400
                      "
                    >
                      {labels.dangerDescription}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={removingAdmin}
                    onClick={removeAdminRole}
                    className="
                      flex
                      shrink-0
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-red-600
                      px-4
                      py-2.5
                      text-sm
                      font-black
                      text-white
                      transition
                      hover:bg-red-700
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    {removingAdmin
                      ? <FiRefreshCw className="animate-spin" />
                      : <FiTrash2 />}

                    {removingAdmin
                      ? labels.removing
                      : labels.removeAdmin}
                  </button>
                </div>
              </div>
            )}

            <div
              className="
                mt-6
                flex
                justify-end
                border-t
                border-slate-100
                pt-4
                dark:border-slate-800
              "
            >
              <button
                type="button"
                disabled={
                  updatingPassword
                  || removingAdmin
                }
                onClick={closeDetails}
                className="
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-black
                  text-slate-600
                  transition
                  hover:bg-slate-50
                  disabled:opacity-50
                  dark:border-slate-700
                  dark:bg-slate-950
                  dark:text-slate-300
                  dark:hover:bg-slate-800
                "
              >
                {labels.close}
              </button>
            </div>
          </div>
        ) : null}
      </ModalShell>
    </>
  );
};

export default Admins;