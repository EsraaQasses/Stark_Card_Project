import React, { useEffect, useRef } from 'react';
import { MdOutlineCancel } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStateContext } from '../contexts/ContextProvider';
import { useAuth } from '../contexts/AuthContext';
import { userProfileData } from '../data/userProfile';

const UserProfile = ({ onClose }) => {
  const { currentColor, setIsClicked, initialState, handleClick } = useStateContext();
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation(['common']);
  const isArabic = i18n.resolvedLanguage === 'ar';
  const navigate = useNavigate();

  const handleClose = onClose || (() => setIsClicked(initialState));
  const panelRef = useRef(null);

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

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin': return t('common.roles.admin', 'Administrator');
      case 'agent': return t('common.roles.agent', 'Agent');
      case 'user': return t('common.roles.user', 'User');
      default: return role;
    }
  };

  return (
    <div
      ref={panelRef}
      className={`nav-item fixed bottom-4 left-2 right-2 z-[9999] bg-white dark:bg-[#42464D] p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[80vh] w-[calc(100vw-16px)] mx-auto
        md:absolute md:bottom-auto md:top-full md:mt-2 md:inset-x-auto md:w-[320px] md:max-h-[70vh] ${
          isArabic
            ? 'md:left-0 md:right-auto text-right'
            : 'md:right-0 md:left-auto text-left'
        }`}
    >
      <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-700">
        <p className="font-bold text-lg dark:text-gray-200">{t('profile.title', 'User Profile')}</p>
        <button
          type="button"
          onClick={handleClose}
          className="text-2xl p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 focus:outline-none transition-colors"
          aria-label={t('common.close', 'Close')}
        >
          <MdOutlineCancel />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mt-4 pr-1 pl-1 -mr-1 -ml-1">
        <div className="flex gap-5 items-center pb-6 border-b border-gray-100 dark:border-gray-700">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-md">
            {user?.name ? user.name.split(' ').map(w => w.charAt(0)).join('').substring(0, 2).toUpperCase() : 'AD'}
          </div>
          <div className="text-start">
            <p className="font-bold text-xl dark:text-gray-200 text-gray-800">{user?.name || 'Admin User'}</p>
            <p className="text-gray-500 text-sm dark:text-gray-400 mt-0.5">{getRoleDisplayName(user?.role)}</p>
            <p className="text-gray-400 text-xs dark:text-gray-500 mt-1 truncate max-w-[200px]">{user?.email || 'info@StarkCard.com'}</p>
          </div>
        </div>

        <div className="mt-4">
          {userProfileData.map((item, index) => (
            <div
              key={index}
              onClick={() => {
                handleClose();
                if (item.title === 'My Profile') {
                  navigate('/profile');
                } else if (item.title === 'My Actions') {
                  handleClick('adminActions');
                }
              }}
              className="flex gap-5 items-center border-b border-gray-50 dark:border-gray-800/60 p-4 hover:bg-light-gray cursor-pointer dark:hover:bg-gray-800/50 rounded-xl transition-all"
            >
              <button
                type="button"
                style={{ color: item.iconColor, backgroundColor: item.iconBg }}
                className="text-xl rounded-xl p-3 hover:scale-105 transition-transform"
              >
                {item.icon}
              </button>

              <div className="text-start">
                <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                  {t('profile.' + item.title.replace(' ', '').toLowerCase(), item.title)}
                </p>
                <p className="text-gray-500 text-xs dark:text-gray-400 mt-0.5">
                  {t('profile.' + item.desc.replace(' ', '').toLowerCase(), item.desc)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => {
              handleClose();
              if (window.confirm(t('common.confirm_logout', 'Are you sure you want to logout?'))) {
                logout();
              }
            }}
            style={{ backgroundColor: currentColor, borderRadius: '12px' }}
            className="text-white p-3 w-full hover:shadow-lg font-semibold text-sm transition-all hover:brightness-105 active:scale-[0.99]"
          >
            {t('common.logout', 'Logout')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
