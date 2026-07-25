import React, { useEffect } from 'react';
import { AiOutlineMenu } from 'react-icons/ai';
import { FaWallet, FaUserShield } from 'react-icons/fa';
import { BsListCheck } from 'react-icons/bs';
import { RiNotification3Line, RiLogoutBoxRLine } from 'react-icons/ri';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { TooltipComponent } from '@syncfusion/ej2-react-popups';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Currencies, Payments, Notification, UserProfile, LastActions } from '.';
import { useStateContext } from '../contexts/ContextProvider';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

const NavButton = ({ title, customFunc, icon, color, dotColor, isActive, ariaLabel }) => (
  <TooltipComponent content={title} position="BottomCenter">
    <button
      type="button"
      onClick={customFunc}
      aria-label={ariaLabel || title}
      data-prevent-outside-close="true"
      className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all border border-transparent hover:border-gray-250 dark:hover:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-250 dark:border-indigo-900'
          : ''
      }`}
      style={{ color: isActive ? undefined : color }}
    >
      <span className="text-xl flex items-center justify-center">{icon}</span>
      {dotColor && (
        <span
          style={{ backgroundColor: dotColor }}
          className="absolute inline-flex rounded-full h-2.5 w-2.5 right-1.5 top-1.5 border-2 border-white dark:border-gray-800 animate-pulse"
        />
      )}
    </button>
  </TooltipComponent>
);

const Navbar = () => {
  const { currentColor, activeMenu, setActiveMenu, handleClick, isClicked, setScreenSize, screenSize, setIsClicked, initialState } = useStateContext();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handleResize = () => setScreenSize(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (screenSize <= 900) {
      setActiveMenu(false);
    } else {
      setActiveMenu(true);
    }
  }, [screenSize]);

  const handleActiveMenu = () => setActiveMenu(!activeMenu);

  const handleLogout = () => {
    if (window.confirm(t('common.confirm_logout', 'Are you sure you want to logout?'))) {
      logout();
    }
  };

  const handleProfileClick = () => {
    handleClick('userProfile');
  };

  const getUserInitials = (name) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-105 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50';
      case 'agent': return 'bg-blue-105 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50';
      case 'user': return 'bg-green-105 text-green-800 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/50';
      default: return 'bg-gray-105 text-gray-850 border border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700/50';
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin': return t('common.roles.admin', 'Administrator');
      case 'agent': return t('common.roles.agent', 'Agent');
      case 'user': return t('common.roles.user', 'User');
      default: return role;
    }
  };

  return (
    <div className="w-full bg-white dark:bg-secondary-dark-bg border-b border-gray-200 dark:border-gray-800 shadow-sm px-3 md:px-6 py-1.5 md:py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between min-h-[64px] md:min-h-[72px] relative z-[999] transition-colors">
      
      {/* Row 1 on Mobile / Left Side on Desktop */}
      <div className="flex items-center justify-between md:justify-start w-full md:w-auto">
        <div className="flex items-center min-w-0">
          <NavButton
            title={t('common.menu', 'Menu')}
            customFunc={handleActiveMenu}
            color={currentColor}
            icon={<AiOutlineMenu />}
            isActive={activeMenu}
          />
          {/* Desktop Title & Subtitle */}
          <div className="ms-3 hidden md:block min-w-0">
            <h1 className="text-base font-bold text-gray-800 dark:text-white truncate">
              {t('common.dashboard_title', 'Stark Admin Dashboard')}
            </h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {t('common.welcome_back', 'Welcome back,')} {user?.name || 'Admin'}
            </p>
          </div>
          {/* Mobile Title */}
          <span className="text-base font-bold text-gray-800 dark:text-white ms-2.5 truncate max-w-[160px] md:hidden">
            {t('common.dashboard_title_short', 'Stark')}
          </span>
        </div>

        {/* Mobile Avatar (Clickable) */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            className="relative flex items-center justify-center p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            onClick={handleProfileClick}
            data-prevent-outside-close="true"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow" data-prevent-outside-close="true">
              {getUserInitials(user?.name)}
            </div>
            <span className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" data-prevent-outside-close="true" />
          </button>
        </div>
      </div>

      {/* Row 2 (Middle) - Desktop Icons Group / Mobile Icons & Lang */}
      <div className="hidden md:flex flex-1 justify-center px-4">
        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-850 p-1 rounded-2xl border border-gray-100 dark:border-gray-800">
          
          <div className="relative">
            <NavButton
              title={t('common.currencies', 'Currencies')}
              customFunc={() => handleClick('cart')}
              color={currentColor}
              icon={<FaWallet />}
              isActive={isClicked.cart}
            />
            {isClicked.cart && <Currencies onClose={() => setIsClicked({ ...initialState, cart: false })} />}
          </div>

          <div className="relative">
            <NavButton
              title={t('common.payments_log', 'Payments Log')}
              dotColor="#03C9D7"
              customFunc={() => handleClick('chat')}
              color={currentColor}
              icon={<BsListCheck />}
              isActive={isClicked.chat}
            />
            {isClicked.chat && <Payments onClose={() => setIsClicked({ ...initialState, chat: false })} />}
          </div>

          <div className="relative">
            <NavButton
              title={t('common.notifications', 'Notifications')}
              dotColor="rgb(254, 201, 15)"
              customFunc={() => handleClick('notification')}
              color={currentColor}
              icon={<RiNotification3Line />}
              isActive={isClicked.notification}
            />
            {isClicked.notification && <Notification onClose={() => setIsClicked({ ...initialState, notification: false })} />}
          </div>

          <div className="relative">
            <NavButton
              title={t('common.admin_actions', 'Admin Actions')}
              dotColor="#8B5CF6"
              customFunc={() => handleClick('adminActions')}
              color={currentColor}
              icon={<FaUserShield />}
              isActive={isClicked.adminActions}
            />
            {isClicked.adminActions && <LastActions onClose={() => setIsClicked({ ...initialState, adminActions: false })} />}
          </div>

          <span className="w-[1px] h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          
          <TooltipComponent content={t('common.logout', 'Logout')} position="BottomCenter">
            <button
              type="button"
              onClick={handleLogout}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all border border-transparent hover:border-red-200 dark:hover:border-red-950 text-red-500 hover:text-red-655 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label={t('common.logout', 'Logout')}
            >
              <span className="text-xl flex items-center justify-center"><RiLogoutBoxRLine /></span>
            </button>
          </TooltipComponent>
        </div>
      </div>

      {/* Desktop End Zone (Role Badge + Language Switcher + User Profile Card) */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getRoleBadgeColor(user?.role)}`}>
            {getRoleDisplayName(user?.role)}
          </span>
          <LanguageSwitcher />
        </div>
        
        <span className="w-[1px] h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

        <div className="relative">
          <TooltipComponent content={t('common.view_profile', 'View Profile')} position="BottomCenter">
            <button
              type="button"
              className="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-705 rounded-xl transition-all text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              onClick={handleProfileClick}
              data-prevent-outside-close="true"
            >
              <div className="relative flex-shrink-0" data-prevent-outside-close="true">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-650 flex items-center justify-center text-white font-bold text-xs shadow-sm" data-prevent-outside-close="true">
                  {getUserInitials(user?.name)}
                </div>
                <span className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" data-prevent-outside-close="true" />
              </div>

              <div className="hidden lg:block max-w-[100px]" data-prevent-outside-close="true">
                <p className="text-xs font-bold text-gray-800 dark:text-white truncate" data-prevent-outside-close="true">
                  {user?.name || 'Admin'}
                </p>
                <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-550 capitalize" data-prevent-outside-close="true">
                  {getRoleDisplayName(user?.role)}
                </p>
              </div>

              <MdKeyboardArrowDown className="text-gray-400 text-base hidden lg:block rtl:rotate-180" data-prevent-outside-close="true" />
            </button>
          </TooltipComponent>
          {isClicked.userProfile && <UserProfile onClose={() => setIsClicked({ ...initialState, userProfile: false })} />}
        </div>
      </div>

      {/* Mobile View second row (Icons and Language Switcher) */}
      {screenSize <= 768 && (
        <div className="md:hidden flex items-center justify-between gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 w-full">
          <div className="flex-shrink-0 scale-90 origin-start">
            <LanguageSwitcher />
          </div>
          <div className="overflow-x-auto whitespace-nowrap flex items-center gap-1.5 py-0.5 max-w-full no-scrollbar">
            
            <div className="relative inline-block">
              <NavButton
                title={t('common.currencies', 'Currencies')}
                customFunc={() => handleClick('cart')}
                color={currentColor}
                icon={<FaWallet />}
                isActive={isClicked.cart}
              />
              {isClicked.cart && <Currencies onClose={() => setIsClicked({ ...initialState, cart: false })} />}
            </div>

            <div className="relative inline-block">
              <NavButton
                title={t('common.payments_log', 'Payments Log')}
                dotColor="#03C9D7"
                customFunc={() => handleClick('chat')}
                color={currentColor}
                icon={<BsListCheck />}
                isActive={isClicked.chat}
              />
              {isClicked.chat && <Payments onClose={() => setIsClicked({ ...initialState, chat: false })} />}
            </div>

            <div className="relative inline-block">
              <NavButton
                title={t('common.notifications', 'Notifications')}
                dotColor="rgb(254, 201, 15)"
                customFunc={() => handleClick('notification')}
                color={currentColor}
                icon={<RiNotification3Line />}
                isActive={isClicked.notification}
              />
              {isClicked.notification && <Notification onClose={() => setIsClicked({ ...initialState, notification: false })} />}
            </div>

            <div className="relative inline-block">
              <NavButton
                title={t('common.admin_actions', 'Admin Actions')}
                dotColor="#8B5CF6"
                customFunc={() => handleClick('adminActions')}
                color={currentColor}
                icon={<FaUserShield />}
                isActive={isClicked.adminActions}
              />
              {isClicked.adminActions && <LastActions onClose={() => setIsClicked({ ...initialState, adminActions: false })} />}
            </div>

            <span className="w-[1px] h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 inline-block align-middle" />
            
            <button
              type="button"
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 focus:outline-none inline-block align-middle"
              aria-label={t('common.logout', 'Logout')}
            >
              <span className="text-xl flex items-center justify-center"><RiLogoutBoxRLine /></span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Navbar;
