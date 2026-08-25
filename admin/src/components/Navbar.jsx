import React, { useEffect } from 'react';

import { AiOutlineMenu } from 'react-icons/ai';
import { FaUserShield, FaWallet } from 'react-icons/fa';
import { BsListCheck } from 'react-icons/bs';
import {
  RiLogoutBoxRLine,
  RiNotification3Line,
} from 'react-icons/ri';
import { MdKeyboardArrowDown } from 'react-icons/md';

import { TooltipComponent } from '@syncfusion/ej2-react-popups';
import { useTranslation } from 'react-i18next';

import {
  Currencies,
  LastActions,
  Notification,
  Payments,
  UserProfile,
} from '.';

import { useAuth } from '../contexts/AuthContext';
import { useStateContext } from '../contexts/ContextProvider';
import LanguageSwitcher from './LanguageSwitcher';

const NavActionButton = ({
  title,
  customFunc,
  icon,
  notificationDot,
  isActive,
  accentColor,
}) => (
  <TooltipComponent
    content={title}
    position="BottomCenter"
  >
    <button
      type="button"
      onClick={customFunc}
      aria-label={title}
      data-prevent-outside-close="true"
      className={`
        relative
        flex
        h-10
        w-10
        items-center
        justify-center
        rounded-xl
        text-lg
        transition-all
        duration-200
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-offset-2
        ${
          isActive
            ? 'shadow-sm'
            : `
              text-slate-500
              hover:bg-slate-100
              hover:text-slate-900
              dark:text-slate-400
              dark:hover:bg-slate-800
              dark:hover:text-white
            `
        }
      `}
      style={
        isActive
          ? {
              backgroundColor: `${accentColor}14`,
              color: accentColor,
            }
          : undefined
      }
    >
      {icon}

      {notificationDot && (
        <span
          className="
            absolute
            end-2
            top-2
            h-2
            w-2
            rounded-full
            bg-amber-400
            ring-2
            ring-white
            dark:ring-slate-900
          "
        />
      )}
    </button>
  </TooltipComponent>
);

const Navbar = () => {
  const {
    currentColor,
    activeMenu,
    setActiveMenu,
    handleClick,
    isClicked,
    setScreenSize,
    screenSize,
    setIsClicked,
    initialState,
  } = useStateContext();

  const {
    user,
    logout,
  } = useAuth();

  const {
    t,
    i18n,
  } = useTranslation();

  const isArabic = (
    i18n.resolvedLanguage === 'ar'
    || i18n.language === 'ar'
  );

  const accentColor = currentColor || '#06b6d4';

  useEffect(() => {
    const handleResize = () => {
      setScreenSize(
        window.innerWidth,
      );
    };

    window.addEventListener(
      'resize',
      handleResize,
    );

    handleResize();

    return () => {
      window.removeEventListener(
        'resize',
        handleResize,
      );
    };
  }, [setScreenSize]);

  useEffect(() => {
    if (screenSize <= 900) {
      setActiveMenu(false);
    } else {
      setActiveMenu(true);
    }
  }, [
    screenSize,
    setActiveMenu,
  ]);

  const handleActiveMenu = () => {
    setActiveMenu(
      !activeMenu,
    );
  };

  const handleLogout = () => {
    const confirmed = window.confirm(
      t(
        'common.confirm_logout',
        'Are you sure you want to logout?',
      ),
    );

    if (confirmed) {
      logout();
    }
  };

  const handleProfileClick = () => {
    handleClick(
      'userProfile',
    );
  };

  const getUserInitials = (name) => {
    if (!name) {
      return 'AD';
    }

    const parts = name
      .trim()
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

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin':
        return t(
          'common.roles.admin',
          'Administrator',
        );

      case 'agent':
        return t(
          'common.roles.agent',
          'Agent',
        );

      case 'user':
        return t(
          'common.roles.user',
          'User',
        );

      default:
        return role || '';
    }
  };

  const closeCurrencies = () => {
    setIsClicked({
      ...initialState,
      cart: false,
    });
  };

  const closePayments = () => {
    setIsClicked({
      ...initialState,
      chat: false,
    });
  };

  const closeNotifications = () => {
    setIsClicked({
      ...initialState,
      notification: false,
    });
  };

  const closeAdminActions = () => {
    setIsClicked({
      ...initialState,
      adminActions: false,
    });
  };

  const closeUserProfile = () => {
    setIsClicked({
      ...initialState,
      userProfile: false,
    });
  };

  const renderActions = () => (
    <>
      <div className="relative">
        <NavActionButton
          title={t(
            'common.currencies',
            'Currencies',
          )}
          customFunc={() => (
            handleClick('cart')
          )}
          icon={<FaWallet />}
          isActive={isClicked.cart}
          accentColor={accentColor}
        />

        {isClicked.cart && (
          <Currencies
            onClose={closeCurrencies}
          />
        )}
      </div>

      <div className="relative">
        <NavActionButton
          title={t(
            'common.payments_log',
            'Payments Log',
          )}
          customFunc={() => (
            handleClick('chat')
          )}
          icon={<BsListCheck />}
          isActive={isClicked.chat}
          accentColor={accentColor}
        />

        {isClicked.chat && (
          <Payments
            onClose={closePayments}
          />
        )}
      </div>

      <div className="relative">
        <NavActionButton
          title={t(
            'common.notifications',
            'Notifications',
          )}
          customFunc={() => (
            handleClick(
              'notification',
            )
          )}
          icon={<RiNotification3Line />}
          notificationDot
          isActive={isClicked.notification}
          accentColor={accentColor}
        />

        {isClicked.notification && (
          <Notification
            onClose={closeNotifications}
          />
        )}
      </div>

      <div className="relative">
        <NavActionButton
          title={t(
            'common.admin_actions',
            'Admin Actions',
          )}
          customFunc={() => (
            handleClick(
              'adminActions',
            )
          )}
          icon={<FaUserShield />}
          isActive={isClicked.adminActions}
          accentColor={accentColor}
        />

        {isClicked.adminActions && (
          <LastActions
            onClose={closeAdminActions}
          />
        )}
      </div>
    </>
  );

  return (
    <header
      dir={isArabic ? 'rtl' : 'ltr'}
      className="
        relative
        z-[999]
        w-full
        border-b
        border-slate-200/70
        bg-white/95
        backdrop-blur-xl
        transition-colors
        dark:border-slate-800
        dark:bg-secondary-dark-bg/95
      "
    >
      <div
        className="
          flex
          min-h-[72px]
          items-center
          justify-between
          gap-4
          px-4
          sm:px-5
          lg:px-6
        "
      >
        {/* Brand / Menu */}
        <div
          className="
            flex
            min-w-0
            items-center
            gap-3
          "
        >
          <button
            type="button"
            onClick={handleActiveMenu}
            aria-label={t(
              'common.menu',
              'Menu',
            )}
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-xl
              text-xl
              transition
              hover:opacity-90
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-offset-2
            "
            style={{
              backgroundColor: `${accentColor}12`,
              color: accentColor,
            }}
          >
            <AiOutlineMenu />
          </button>

          <div
            className="
              min-w-0
              text-start
            "
          >
            <h1
              className="
                truncate
                text-[15px]
                font-black
                leading-tight
                text-slate-900
                dark:text-white
                sm:text-base
              "
            >
              {t(
                'common.dashboard_title',
                'Stark Admin Dashboard',
              )}
            </h1>

            <div
              className="
                mt-1
                hidden
                items-center
                gap-2
                lg:flex
              "
            >
              <span
                className="
                  h-1.5
                  w-1.5
                  rounded-full
                "
                style={{
                  backgroundColor: accentColor,
                }}
              />

              <span
                className="
                  truncate
                  text-[11px]
                  font-semibold
                  text-slate-400
                  dark:text-slate-500
                "
              >
                {getRoleDisplayName(
                  user?.role,
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Quick Actions */}
        <nav
          aria-label={t(
            'common.quick_actions',
            'Quick actions',
          )}
          className="
            hidden
            items-center
            gap-1
            md:flex
          "
        >
          {renderActions()}
        </nav>

        {/* Desktop Account Area */}
        <div
          className="
            hidden
            shrink-0
            items-center
            gap-2
            md:flex
          "
        >
          <LanguageSwitcher />

          <div
            className="
              mx-1
              hidden
              h-7
              w-px
              bg-slate-200
              dark:bg-slate-700
              lg:block
            "
          />

          <div className="relative">
            <TooltipComponent
              content={t(
                'common.view_profile',
                'View Profile',
              )}
              position="BottomCenter"
            >
              <button
                type="button"
                onClick={handleProfileClick}
                data-prevent-outside-close="true"
                className={`
                  group
                  flex
                  items-center
                  gap-2.5
                  rounded-xl
                  px-1.5
                  py-1.5
                  text-start
                  transition
                  hover:bg-slate-100
                  dark:hover:bg-slate-800
                  ${
                    isClicked.userProfile
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : ''
                  }
                `}
              >
                <div
                  data-prevent-outside-close="true"
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    text-xs
                    font-black
                    text-white
                    shadow-sm
                  "
                  style={{
                    backgroundColor: accentColor,
                  }}
                >
                  {getUserInitials(
                    user?.name,
                  )}
                </div>

                <div
                  data-prevent-outside-close="true"
                  className="
                    hidden
                    min-w-0
                    max-w-[135px]
                    xl:block
                  "
                >
                  <p
                    data-prevent-outside-close="true"
                    className="
                      truncate
                      text-xs
                      font-black
                      text-slate-800
                      dark:text-white
                    "
                  >
                    {user?.name || 'Admin'}
                  </p>

                  <p
                    data-prevent-outside-close="true"
                    className="
                      mt-0.5
                      truncate
                      text-[10px]
                      font-semibold
                      text-slate-400
                      dark:text-slate-500
                    "
                  >
                    {getRoleDisplayName(
                      user?.role,
                    )}
                  </p>
                </div>

                <MdKeyboardArrowDown
                  data-prevent-outside-close="true"
                  className={`
                    hidden
                    text-lg
                    text-slate-400
                    transition-transform
                    xl:block
                    ${
                      isClicked.userProfile
                        ? 'rotate-180'
                        : ''
                    }
                  `}
                />
              </button>
            </TooltipComponent>

            {isClicked.userProfile && (
              <UserProfile
                onClose={closeUserProfile}
              />
            )}
          </div>

          <TooltipComponent
            content={t(
              'common.logout',
              'Logout',
            )}
            position="BottomCenter"
          >
            <button
              type="button"
              onClick={handleLogout}
              aria-label={t(
                'common.logout',
                'Logout',
              )}
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                text-lg
                text-slate-400
                transition
                hover:bg-red-50
                hover:text-red-500
                dark:text-slate-500
                dark:hover:bg-red-950/30
                dark:hover:text-red-400
              "
            >
              <RiLogoutBoxRLine />
            </button>
          </TooltipComponent>
        </div>

        {/* Mobile Profile */}
        <div
          className="
            relative
            md:hidden
          "
        >
          <button
            type="button"
            onClick={handleProfileClick}
            data-prevent-outside-close="true"
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              text-xs
              font-black
              text-white
              shadow-sm
            "
            style={{
              backgroundColor: accentColor,
            }}
          >
            {getUserInitials(
              user?.name,
            )}
          </button>

          {isClicked.userProfile && (
            <UserProfile
              onClose={closeUserProfile}
            />
          )}
        </div>
      </div>

      {/* Mobile Quick Actions */}
      {screenSize <= 768 && (
        <div
          className="
            flex
            items-center
            justify-between
            gap-3
            border-t
            border-slate-100
            px-4
            py-2
            dark:border-slate-800
            md:hidden
          "
        >
          <LanguageSwitcher />

          <div
            className="
              flex
              items-center
              gap-1
            "
          >
            {renderActions()}

            <button
              type="button"
              onClick={handleLogout}
              aria-label={t(
                'common.logout',
                'Logout',
              )}
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                text-lg
                text-slate-400
                transition
                hover:bg-red-50
                hover:text-red-500
                dark:hover:bg-red-950/30
                dark:hover:text-red-400
              "
            >
              <RiLogoutBoxRLine />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;