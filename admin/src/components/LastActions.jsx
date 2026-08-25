import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineCancel, MdHistory, MdPerson, MdAdminPanelSettings } from 'react-icons/md';
import { FaUserShield, FaUserCheck, FaUserTimes, FaMoneyBillWave } from 'react-icons/fa';
import { useStateContext } from '../contexts/ContextProvider';
import axiosInstance from '../utils/axiosConfig';

const LastActions = ({ onClose }) => {
  const { t, i18n } = useTranslation(['activity', 'common']);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const { currentColor, setIsClicked, initialState } = useStateContext();
  const handleClose = onClose || (() => setIsClicked(initialState));

  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    fetchAdminActions();
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

  const fetchAdminActions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get('/system/admin-actions/');
      setActions(response.data);
    } catch (fetchError) {
      console.error('Error fetching admin actions:', fetchError);
      setError(t('alerts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType, description) => {
    const actionLower = actionType?.toLowerCase() || '';
    const descLower = description?.toLowerCase() || '';

    if (actionLower.includes('ban') || descLower.includes('ban') || descLower.includes('banned')) {
      return <FaUserTimes className="text-red-500 text-lg" />;
    }
    if (actionLower.includes('unban') || descLower.includes('unban') || descLower.includes('unbanned')) {
      return <FaUserCheck className="text-green-500 text-lg" />;
    }
    if (actionLower.includes('promote') || descLower.includes('promote') || descLower.includes('admin')) {
      return <MdAdminPanelSettings className="text-purple-500 text-lg" />;
    }
    if (actionLower.includes('payment') || descLower.includes('payment') || descLower.includes('approve')) {
      return <FaMoneyBillWave className="text-blue-500 text-lg" />;
    }
    if (actionLower.includes('user') || descLower.includes('user')) {
      return <MdPerson className="text-orange-500 text-lg" />;
    }
    return <MdHistory className="text-gray-500 text-lg" />;
  };

  const getActionColor = (actionType, description) => {
    const actionLower = actionType?.toLowerCase() || '';
    const descLower = description?.toLowerCase() || '';
    const borderClass = 'border-s-4 border-';

    if (actionLower.includes('ban') || descLower.includes('ban')) {
      return `${borderClass}red-500 bg-red-50/50 dark:bg-red-950/20`;
    }
    if (actionLower.includes('unban') || descLower.includes('unban')) {
      return `${borderClass}green-500 bg-green-50/50 dark:bg-green-950/20`;
    }
    if (actionLower.includes('promote') || descLower.includes('promote')) {
      return `${borderClass}purple-500 bg-purple-50/50 dark:bg-purple-950/20`;
    }
    if (actionLower.includes('payment') || descLower.includes('payment')) {
      return `${borderClass}blue-500 bg-blue-50/50 dark:bg-blue-950/20`;
    }
    return `${borderClass}gray-500 bg-gray-50/50 dark:bg-gray-800/20`;
  };

  const getActionTypeBadge = (actionType, description) => {
    const actionLower = actionType?.toLowerCase() || '';
    const descLower = description?.toLowerCase() || '';

    if (actionLower.includes('ban') || descLower.includes('ban')) {
      return <span className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{t('action.ban')}</span>;
    }
    if (actionLower.includes('unban') || descLower.includes('unban')) {
      return <span className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{t('action.unban')}</span>;
    }
    if (actionLower.includes('promote') || descLower.includes('promote')) {
      return <span className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">{t('action.promote')}</span>;
    }
    if (actionLower.includes('post') || actionLower.includes('create')) {
      return <span className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{t('action.create')}</span>;
    }
    if (actionLower.includes('put') || actionLower.includes('update')) {
      return <span className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">{t('action.update')}</span>;
    }
    if (actionLower.includes('delete')) {
      return <span className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{t('action.delete')}</span>;
    }
    return <span className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">{t('action.action')}</span>;
  };

  const getTimeAgo = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInSeconds = Math.floor((now - created) / 1000);

    if (diffInSeconds < 60) return t('time.justNow');
    if (diffInSeconds < 3600) return t('time.minutesAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('time.hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    if (diffInSeconds < 604800) return t('time.daysAgo', { count: Math.floor(diffInSeconds / 86400) });

    return created.toLocaleDateString(i18n.resolvedLanguage, {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatActionDescription = (description) => {
    if (!description) return t('states.noDescription');

    try {
      const parsed = JSON.parse(description);
      if (typeof parsed === 'object') {
        return Object.entries(parsed)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      }
      return String(parsed);
    } catch {
      return description.length > 100
        ? `${description.substring(0, 100)}...`
        : description;
    }
  };

  const getTodayActionsCount = () => {
    const today = new Date();
    return actions.filter((action) => {
      const actionDate = new Date(action.created_at);
      return actionDate.toDateString() === today.toDateString();
    }).length;
  };

  const getThisWeekActionsCount = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return actions.filter((action) => {
      const actionDate = new Date(action.created_at);
      return actionDate > weekAgo;
    }).length;
  };

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
            onClick={fetchAdminActions}
            className="mt-2 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-100 text-sm font-medium"
          >
            {t('buttons.tryAgain')}
          </button>
        </div>
      );
    }

    if (actions.length === 0) {
      return (
        <div className="text-center py-8">
          <MdHistory className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">{t('states.noActions')}</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {t('states.noActionsDesc')}
          </p>
        </div>
      );
    }

    return actions.map((action) => (
      <div
        key={action.id}
        className={`flex items-start gap-3 p-3.5 rounded-xl mb-3 border border-gray-100 dark:border-gray-700/60 shadow-sm hover:shadow-md transition-all ${
          getActionColor(action.action_type, action.description)
        }`}
      >
        <div className="flex-shrink-0 mt-0.5 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          {getActionIcon(action.action_type, action.description)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2 mb-1.5">
            <div className="text-start">
              <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm leading-tight">
                {action.admin_name || t('states.systemAdmin')}
              </p>
              {action.target_name && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('action.target', { name: action.target_name })}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              {getActionTypeBadge(action.action_type, action.description)}
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-300 text-xs mb-2.5 text-start break-words leading-relaxed">
            {formatActionDescription(action.description)}
          </p>

          <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700/50 pt-2 text-[10px] sm:text-xs">
            <span className="text-gray-400 dark:text-gray-500">
              {getTimeAgo(action.created_at)}
            </span>
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[10px] font-medium uppercase tracking-wider">
              {getActionTypeBadge(action.action_type, action.description)}
            </span>
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div
      ref={panelRef}
      className={`nav-item fixed bottom-4 left-2 right-2 z-[9999] bg-white dark:bg-[#42464D] p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[80vh] w-[calc(100vw-16px)] mx-auto
        md:absolute md:bottom-auto md:top-full md:mt-2 md:left-1/2 md:-translate-x-1/2 md:inset-x-auto md:w-[400px] md:max-h-[70vh] ${
          isArabic ? 'text-right' : 'text-left'
        }`}
    >
      {/* Header section (fixed) */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex gap-3 items-center">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
            <FaUserShield className="text-xl" />
          </div>
          <div className="text-start">
            <p className="font-bold text-lg text-gray-800 dark:text-white">{t('title')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
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

      {/* Body section (scrollable) */}
      <div className="flex-1 overflow-y-auto mt-4 pr-1 pl-1 -mr-1 -ml-1">
        {renderContent()}
      </div>

      {/* Footer statistics and controls */}
      {actions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-2 border border-gray-100/50 dark:border-gray-700/50">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">{t('stats.total')}</p>
              <p className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">{actions.length}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-2 border border-gray-100/50 dark:border-gray-700/50">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">{t('stats.today')}</p>
              <p className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">
                {getTodayActionsCount()}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-2 border border-gray-100/50 dark:border-gray-700/50">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">{t('stats.thisWeek')}</p>
              <p className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">
                {getThisWeekActionsCount()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchAdminActions}
            style={{ backgroundColor: currentColor, borderRadius: '12px' }}
            className="text-white p-3 w-full hover:shadow-lg font-semibold text-sm transition-all hover:brightness-105 active:scale-[0.99]"
          >
            {t('buttons.refresh')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LastActions;
