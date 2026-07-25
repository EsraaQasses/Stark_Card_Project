import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBell, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaMoneyCheckAlt } from 'react-icons/fa';
import { MdOutlineCancel } from 'react-icons/md';
import { useStateContext } from '../contexts/ContextProvider';
import axiosInstance from '../utils/axiosConfig';

const Notification = ({ onClose }) => {
  const { t, i18n } = useTranslation(['notifications', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const { currentColor, setIsClicked, initialState } = useStateContext();
  const handleClose = onClose || (() => setIsClicked(initialState));

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        if (!event.target.closest('[data-prevent-outside-close="true"]')) {
          handleClose();
        }
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/system/notifications/');
      setNotifications(response.data);
    } catch (fetchError) {
      console.error('Error fetching notifications:', fetchError);
      setError(t('alerts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axiosInstance.patch(`/system/notifications/${notificationId}/`, {
        is_read: true,
      });

      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
    } catch (markError) {
      console.error('Error marking notification as read:', markError);
    }
  };

  const markAllAsRead = async () => {
    try {
      const updatePromises = notifications
        .filter((notif) => !notif.is_read)
        .map((notif) => axiosInstance.patch(`/system/notifications/${notif.id}/`, {
          is_read: true,
        }));

      await Promise.all(updatePromises);

      setNotifications([]);
    } catch (markAllError) {
      console.error('Error marking all notifications as read:', markAllError);
    }
  };

  const getNotificationIcon = (title, message) => {
    const titleLower = title?.toLowerCase() || '';
    const messageLower = message?.toLowerCase() || '';

    if (titleLower.includes('warning') || titleLower.includes('error') || messageLower.includes('failed')) {
      return <FaExclamationTriangle className="text-yellow-500 text-lg" />;
    }
    if (titleLower.includes('success') || titleLower.includes('approved') || messageLower.includes('successful')) {
      return <FaCheckCircle className="text-green-500 text-lg" />;
    }
    if (titleLower.includes('payment') || titleLower.includes('transaction') || messageLower.includes('payment')) {
      return <FaMoneyCheckAlt className="text-blue-500 text-lg" />;
    }
    return <FaInfoCircle className="text-gray-500 text-lg" />;
  };

  const getPriorityBadge = (title, message) => {
    const titleLower = title?.toLowerCase() || '';
    const messageLower = message?.toLowerCase() || '';

    if (titleLower.includes('urgent') || titleLower.includes('critical') || messageLower.includes('immediately')) {
      return <span className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{t('priority.high')}</span>;
    }
    if (titleLower.includes('important') || messageLower.includes('attention')) {
      return <span className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">{t('priority.medium')}</span>;
    }
    return <span className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{t('priority.low')}</span>;
  };

  const getTimeAgo = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInSeconds = Math.floor((now - created) / 1000);

    if (diffInSeconds < 60) return t('time.justNow');
    if (diffInSeconds < 3600) return t('time.minutesAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('time.hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    return t('time.daysAgo', { count: Math.floor(diffInSeconds / 86400) });
  };

  const getBorderColor = (title, message) => {
    const titleLower = title?.toLowerCase() || '';
    const messageLower = message?.toLowerCase() || '';
    const borderClass = 'border-s-4 border-';

    if (titleLower.includes('warning') || titleLower.includes('error') || messageLower.includes('failed')) {
      return `${borderClass}yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20`;
    }
    if (titleLower.includes('success') || titleLower.includes('approved') || messageLower.includes('successful')) {
      return `${borderClass}green-500 bg-green-50/50 dark:bg-green-950/20`;
    }
    if (titleLower.includes('payment') || titleLower.includes('transaction')) {
      return `${borderClass}blue-500 bg-blue-50/50 dark:bg-blue-950/20`;
    }
    return `${borderClass}gray-500 bg-gray-50/50 dark:bg-gray-800/20`;
  };

  const requiresAction = (title, message) => {
    const titleLower = title?.toLowerCase() || '';
    const messageLower = message?.toLowerCase() || '';

    return titleLower.includes('approve')
      || titleLower.includes('review')
      || messageLower.includes('action required')
      || messageLower.includes('pending');
  };

  const unreadCount = notifications.filter((notif) => !notif.is_read).length;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <p className="text-red-500 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={fetchNotifications}
            className="mt-2 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-100 text-sm font-medium"
          >
            {t('buttons.tryAgain')}
          </button>
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="text-center py-8">
          <FaBell className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">{t('states.noNotifications')}</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {t('states.caughtUp')}
          </p>
        </div>
      );
    }

    return (
      <>
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex items-start gap-3 p-3.5 rounded-xl mb-3 border border-gray-100 dark:border-gray-700/60 shadow-sm hover:shadow-md transition-all cursor-pointer ${
              getBorderColor(notification.title, notification.message)
            } ${notification.is_read ? 'opacity-60' : ''}`}
            onClick={() => markAsRead(notification.id)}
          >
            <div className="flex-shrink-0 mt-0.5 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              {getNotificationIcon(notification.title, notification.message)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2 mb-1.5">
                <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm text-start leading-tight">
                  {notification.title}
                </p>
                <div className="flex-shrink-0">
                  {getPriorityBadge(notification.title, notification.message)}
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-xs mb-2.5 text-start break-words leading-relaxed">
                {notification.message}
              </p>
              <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700/50 pt-2 text-[10px] sm:text-xs">
                <span className="text-gray-400 dark:text-gray-500">
                  {getTimeAgo(notification.created_at)}
                </span>
                <div className="flex items-center gap-2">
                  {requiresAction(notification.title, notification.message) && (
                    <span className="text-red-500 font-semibold uppercase tracking-wider text-[10px]">
                      {t('states.actionRequired')}
                    </span>
                  )}
                  {notification.is_read && (
                    <span className="text-green-500 font-medium text-[10px]">{t('states.read')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </>
    );
  };

  return (
    <div
      ref={panelRef}
      className={`nav-item fixed bottom-4 left-2 right-2 z-[9999] bg-white dark:bg-[#42464D] p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[80vh] w-[calc(100vw-16px)] mx-auto
        md:absolute md:bottom-auto md:top-full md:mt-2 md:left-1/2 md:-translate-x-1/2 md:inset-x-auto md:w-[380px] md:max-h-[70vh] ${
          isArabic ? 'text-right' : 'text-left'
        }`}
    >
      {/* Header section (fixed) */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex gap-3 items-center">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
            <FaBell className="text-xl" />
          </div>
          <div className="text-start">
            <p className="font-bold text-lg text-gray-800 dark:text-white">{t('title')}</p>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold text-white uppercase rounded px-1.5 py-0.5 bg-orange-500 inline-block mt-0.5">
                {unreadCount} {t('badge.new')}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-2xl p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          aria-label={t('common.close', 'Close')}
        >
          <MdOutlineCancel />
        </button>
      </div>

      {/* Mark All As Read Link */}
      {notifications.length > 0 && (
        <div className="flex justify-end mt-3 mb-1">
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-xs font-semibold text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            {t('buttons.markAllAsRead')}
          </button>
        </div>
      )}

      {/* Body section (scrollable) */}
      <div className="flex-1 overflow-y-auto mt-2 pr-1 pl-1 -mr-1 -ml-1">
        {renderContent()}
      </div>

      {/* Footer controls */}
      {notifications.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              handleClose();
              console.log('Navigate to full notifications page');
            }}
            style={{ backgroundColor: currentColor, borderRadius: '12px' }}
            className="text-white p-3 w-full hover:shadow-lg font-semibold text-sm transition-all hover:brightness-105 active:scale-[0.99]"
          >
            {t('buttons.seeAll')}
          </button>
        </div>
      )}
    </div>
  );
};

export default Notification;
