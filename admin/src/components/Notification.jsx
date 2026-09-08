import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  FaBell,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaMoneyCheckAlt,
} from 'react-icons/fa';

import { MdOutlineCancel } from 'react-icons/md';

import axiosInstance from '../utils/axiosConfig';
import { useStateContext } from '../contexts/ContextProvider';

const normalizeNotifications = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const Notification = ({ onClose }) => {
  const {
    t,
    i18n,
  } = useTranslation([
    'notifications',
    'common',
  ]);

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const {
    currentColor,
    setIsClicked,
    initialState,
  } = useStateContext();

  const panelRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }

    setIsClicked(initialState);
  }, [
    initialState,
    onClose,
    setIsClicked,
  ]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axiosInstance.get(
        '/system/notifications/',
      );

      setNotifications(
        normalizeNotifications(response.data),
      );
    } catch (fetchError) {
      console.error(
        'Error fetching notifications:',
        fetchError,
      );

      setNotifications([]);
      setError(
        t(
          'alerts.loadFailed',
          'تعذر تحميل الإشعارات.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        panelRef.current
        && !panelRef.current.contains(event.target)
        && !event.target.closest(
          '[data-prevent-outside-close="true"]',
        )
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    );

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      );

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [handleClose]);

  const markAsRead = async (notificationId) => {
    try {
      await axiosInstance.patch(
        `/system/notifications/${notificationId}/`,
        {
          is_read: true,
        },
      );

      setNotifications((previous) => (
        previous.filter(
          (notification) => (
            notification.id !== notificationId
          ),
        )
      ));
    } catch (markError) {
      console.error(
        'Error marking notification as read:',
        markError,
      );
    }
  };

  const markAllAsRead = async () => {
    try {
      await axiosInstance.post(
        '/system/notifications/mark-all-read/',
        {},
      );

      setNotifications([]);
    } catch (markAllError) {
      console.error(
        'Error marking all notifications as read:',
        markAllError,
      );
    }
  };

  const getNotificationIcon = (
    title,
    message,
  ) => {
    const titleLower = (
      String(title || '').toLowerCase()
    );

    const messageLower = (
      String(message || '').toLowerCase()
    );

    if (
      titleLower.includes('warning')
      || titleLower.includes('error')
      || messageLower.includes('failed')
    ) {
      return (
        <FaExclamationTriangle
          className="text-lg text-yellow-500"
        />
      );
    }

    if (
      titleLower.includes('success')
      || titleLower.includes('approved')
      || messageLower.includes('successful')
    ) {
      return (
        <FaCheckCircle
          className="text-lg text-green-500"
        />
      );
    }

    if (
      titleLower.includes('payment')
      || titleLower.includes('transaction')
      || messageLower.includes('payment')
    ) {
      return (
        <FaMoneyCheckAlt
          className="text-lg text-blue-500"
        />
      );
    }

    return (
      <FaInfoCircle
        className="text-lg text-gray-500"
      />
    );
  };

  const getPriorityBadge = (
    title,
    message,
  ) => {
    const titleLower = (
      String(title || '').toLowerCase()
    );

    const messageLower = (
      String(message || '').toLowerCase()
    );

    if (
      titleLower.includes('urgent')
      || titleLower.includes('critical')
      || messageLower.includes('immediately')
    ) {
      return (
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {t('priority.high', 'عالية')}
        </span>
      );
    }

    if (
      titleLower.includes('important')
      || messageLower.includes('attention')
    ) {
      return (
        <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          {t('priority.medium', 'متوسطة')}
        </span>
      );
    }

    return (
      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
        {t('priority.low', 'عادية')}
      </span>
    );
  };

  const getTimeAgo = (createdAt) => {
    if (!createdAt) {
      return '';
    }

    const now = new Date();
    const created = new Date(createdAt);

    if (Number.isNaN(created.getTime())) {
      return '';
    }

    const diffInSeconds = Math.max(
      0,
      Math.floor(
        (now.getTime() - created.getTime()) / 1000,
      ),
    );

    if (diffInSeconds < 60) {
      return t('time.justNow', 'الآن');
    }

    if (diffInSeconds < 3600) {
      return t(
        'time.minutesAgo',
        {
          count: Math.floor(
            diffInSeconds / 60,
          ),
          defaultValue:
            'منذ {{count}} دقيقة',
        },
      );
    }

    if (diffInSeconds < 86400) {
      return t(
        'time.hoursAgo',
        {
          count: Math.floor(
            diffInSeconds / 3600,
          ),
          defaultValue:
            'منذ {{count}} ساعة',
        },
      );
    }

    return t(
      'time.daysAgo',
      {
        count: Math.floor(
          diffInSeconds / 86400,
        ),
        defaultValue:
          'منذ {{count}} يوم',
      },
    );
  };

  const getBorderClass = (
    title,
    message,
  ) => {
    const titleLower = (
      String(title || '').toLowerCase()
    );

    const messageLower = (
      String(message || '').toLowerCase()
    );

    if (
      titleLower.includes('warning')
      || titleLower.includes('error')
      || messageLower.includes('failed')
    ) {
      return (
        'border-s-4 border-s-yellow-500 '
        + 'bg-yellow-50/50 dark:bg-yellow-950/20'
      );
    }

    if (
      titleLower.includes('success')
      || titleLower.includes('approved')
      || messageLower.includes('successful')
    ) {
      return (
        'border-s-4 border-s-green-500 '
        + 'bg-green-50/50 dark:bg-green-950/20'
      );
    }

    if (
      titleLower.includes('payment')
      || titleLower.includes('transaction')
    ) {
      return (
        'border-s-4 border-s-blue-500 '
        + 'bg-blue-50/50 dark:bg-blue-950/20'
      );
    }

    return (
      'border-s-4 border-s-gray-400 '
      + 'bg-gray-50/50 dark:bg-gray-800/20'
    );
  };

  const requiresAction = (
    title,
    message,
  ) => {
    const titleLower = (
      String(title || '').toLowerCase()
    );

    const messageLower = (
      String(message || '').toLowerCase()
    );

    return (
      titleLower.includes('approve')
      || titleLower.includes('review')
      || messageLower.includes(
        'action required',
      )
      || messageLower.includes('pending')
    );
  };

  const unreadCount = notifications.filter(
    (notification) => (
      !notification.is_read
    ),
  ).length;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="py-8 text-center">
          <p className="text-red-500 dark:text-red-400">
            {error}
          </p>

          <button
            type="button"
            onClick={fetchNotifications}
            className="mt-3 text-sm font-bold text-blue-500 hover:text-blue-700"
          >
            {t(
              'buttons.tryAgain',
              'إعادة المحاولة',
            )}
          </button>
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="py-8 text-center">
          <FaBell className="mx-auto mb-3 text-4xl text-gray-300 dark:text-gray-600" />

          <p className="text-gray-500 dark:text-gray-400">
            {t(
              'states.noNotifications',
              'لا توجد إشعارات',
            )}
          </p>

          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            {t(
              'states.caughtUp',
              'أنت مطّلع على كل جديد.',
            )}
          </p>
        </div>
      );
    }

    return notifications.map(
      (notification) => (
        <button
          key={notification.id}
          type="button"
          onClick={() => (
            markAsRead(notification.id)
          )}
          className={`
            mb-3
            flex
            w-full
            items-start
            gap-3
            rounded-xl
            border
            border-gray-100
            p-3.5
            text-start
            shadow-sm
            transition-all
            hover:shadow-md
            dark:border-gray-700/60
            ${getBorderClass(
              notification.title,
              notification.message,
            )}
            ${
              notification.is_read
                ? 'opacity-60'
                : ''
            }
          `}
        >
          <div className="mt-0.5 shrink-0 rounded-lg bg-white p-2 shadow-sm dark:bg-gray-800">
            {getNotificationIcon(
              notification.title,
              notification.message,
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-tight text-gray-800 dark:text-gray-200">
                {notification.title || '—'}
              </p>

              <div className="shrink-0">
                {getPriorityBadge(
                  notification.title,
                  notification.message,
                )}
              </div>
            </div>

            <p className="mb-2.5 break-words text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              {notification.message || '—'}
            </p>

            <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[10px] dark:border-gray-700/50 sm:text-xs">
              <span className="text-gray-400 dark:text-gray-500">
                {getTimeAgo(
                  notification.created_at,
                )}
              </span>

              <div className="flex items-center gap-2">
                {requiresAction(
                  notification.title,
                  notification.message,
                ) && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500">
                    {t(
                      'states.actionRequired',
                      'يتطلب إجراء',
                    )}
                  </span>
                )}

                {notification.is_read && (
                  <span className="text-[10px] font-medium text-green-500">
                    {t(
                      'states.read',
                      'مقروء',
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      ),
    );
  };

  return (
    <div
      ref={panelRef}
      dir={isArabic ? 'rtl' : 'ltr'}
      className="
        nav-item
        fixed
        bottom-4
        left-2
        right-2
        z-[9999]
        mx-auto
        flex
        max-h-[80vh]
        w-[calc(100vw-16px)]
        flex-col
        rounded-xl
        border
        border-gray-200
        bg-white
        p-4
        shadow-2xl
        dark:border-gray-800
        dark:bg-[#42464D]
        md:absolute
        md:bottom-auto
        md:left-1/2
        md:right-auto
        md:top-full
        md:mt-2
        md:max-h-[70vh]
        md:w-[380px]
        md:-translate-x-1/2
      "
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <FaBell className="text-xl" />
          </div>

          <div className="text-start">
            <p className="text-lg font-bold text-gray-800 dark:text-white">
              {t(
                'title',
                'إشعارات النظام',
              )}
            </p>

            {unreadCount > 0 && (
              <span className="mt-0.5 inline-block rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                {unreadCount}{' '}
                {t(
                  'badge.new',
                  'جديد',
                )}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="rounded-full p-2 text-2xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          aria-label={t(
            'common.close',
            'إغلاق',
          )}
        >
          <MdOutlineCancel />
        </button>
      </div>

      {notifications.length > 0 && (
        <div className="mb-1 mt-3 flex justify-end">
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-xs font-semibold text-blue-500 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t(
              'buttons.markAllAsRead',
              'تحديد الكل كمقروء',
            )}
          </button>
        </div>
      )}

      <div className="mt-2 flex-1 overflow-y-auto px-1">
        {renderContent()}
      </div>
    </div>
  );
};

export default Notification;
