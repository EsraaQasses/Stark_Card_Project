import React, { useEffect } from 'react';

import { AiOutlineMenu } from 'react-icons/ai';
import { FaWallet, FaUserShield } from 'react-icons/fa';
import { BsListCheck } from 'react-icons/bs';
import {
  RiNotification3Line,
  RiLogoutBoxRLine,
} from 'react-icons/ri';
import { MdKeyboardArrowDown } from 'react-icons/md';

import { TooltipComponent } from '@syncfusion/ej2-react-popups';
import { useTranslation } from 'react-i18next';

import {
  Currencies,
  Payments,
  Notification,
  UserProfile,
  LastActions,
} from '.';

import { useStateContext } from '../contexts/ContextProvider';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

// ======================================================
// NAV ICON BUTTON
// ======================================================

const NavButton = ({
  title,
  customFunc,
  icon,
  dotColor,
  isActive,
  ariaLabel,
  accentColor,
}) => (
  <TooltipComponent
    content={title}
    position="BottomCenter"
  >
    <button
      type="button"
      onClick={customFunc}
      aria-label={ariaLabel || title}
      data-prevent-outside-close="true"
      style={
        isActive
          ? {
              color: accentColor,
              borderColor: accentColor,
            }
          : undefined
      }
      className={`
        group
        relative
        flex
        items-center
        justify-center
        w-10
        h-10
        rounded-xl
        border
        transition-all
        duration-200
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-offset-2

        ${
          isActive
            ? `
              bg-white
              dark:bg-slate-800
              shadow-sm
            `
            : `
              text-slate-500
              dark:text-slate-400
              border-transparent
              hover:text-slate-900
              dark:hover:text-white
              hover:bg-white
              dark:hover:bg-slate-800
              hover:border-slate-200
              dark:hover:border-slate-700
              hover:shadow-sm
            `
        }
      `}
    >
      <span
        className="
          text-xl
          flex
          items-center
          justify-center
          transition-transform
          duration-200
          group-hover:scale-105
        "
      >
        {icon}
      </span>

      {dotColor && (
        <span
          style={{
            backgroundColor: dotColor,
          }}
          className="
            absolute
            top-1.5
            end-1.5
            w-2
            h-2
            rounded-full
            ring-2
            ring-white
            dark:ring-slate-900
          "
        />
      )}
    </button>
  </TooltipComponent>
);

// ======================================================
// NAVBAR
// ======================================================

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

  const { t } = useTranslation();

  // ====================================================
  // SCREEN SIZE
  // ====================================================

  useEffect(() => {
    const handleResize = () => {
      setScreenSize(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);

    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [setScreenSize]);

  useEffect(() => {
    if (screenSize <= 900) {
      setActiveMenu(false);
    } else {
      setActiveMenu(true);
    }
  }, [screenSize, setActiveMenu]);

  // ====================================================
  // ACTIONS
  // ====================================================

  const handleActiveMenu = () => {
    setActiveMenu(!activeMenu);
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
    handleClick('userProfile');
  };

  // ====================================================
  // USER HELPERS
  // ====================================================

  const getUserInitials = (name) => {
    if (!name) {
      return 'AD';
    }

    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
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

  // ====================================================
  // CLOSE DROPDOWNS
  // ====================================================

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

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <header
      className="
        w-full
        min-h-[68px]
        md:min-h-[74px]

        bg-white/95
        dark:bg-secondary-dark-bg

        backdrop-blur-xl

        border-b
        border-slate-200/80
        dark:border-slate-800

        px-3
        sm:px-4
        md:px-5
        lg:px-7

        py-2

        flex
        flex-col
        md:flex-row

        items-stretch
        md:items-center

        justify-between

        gap-2

        relative
        z-[999]

        transition-colors
        duration-200
      "
    >
      {/* ==================================================
          START AREA
          Menu + Dashboard title
      ================================================== */}

      <div
        className="
          flex
          items-center
          justify-between
          md:justify-start
          w-full
          md:w-auto
          min-w-0
        "
      >
        <div className="flex items-center min-w-0">
          {/* Menu Button */}
          <button
            type="button"
            onClick={handleActiveMenu}
            aria-label={t('common.menu', 'Menu')}
            style={{
              color: currentColor,
            }}
            className="
              flex
              items-center
              justify-center

              w-10
              h-10

              rounded-xl

              bg-slate-50
              dark:bg-slate-800

              border
              border-slate-100
              dark:border-slate-700

              hover:bg-slate-100
              dark:hover:bg-slate-700

              transition-all
              duration-200

              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-offset-2

              flex-shrink-0
            "
          >
            <AiOutlineMenu className="text-xl" />
          </button>

          {/* Desktop Dashboard Title */}
          <div
            className="
              hidden
              md:block
              ms-3
              min-w-0
            "
          >
            <h1
              className="
                text-[15px]
                lg:text-base
                font-extrabold
                text-slate-900
                dark:text-white
                leading-tight
                truncate
              "
            >
              {t(
                'common.dashboard_title',
                'Stark Admin Dashboard',
              )}
            </h1>

            <p
              className="
                text-[10px]
                lg:text-[11px]
                text-slate-400
                dark:text-slate-500
                mt-1
                truncate
              "
            >
              {t(
                'common.welcome_back',
                'Welcome back,',
              )}{' '}
              {user?.name || 'Admin'}
            </p>
          </div>

          {/* Mobile Dashboard Title */}
          <div
            className="
              md:hidden
              ms-3
              min-w-0
            "
          >
            <p
              className="
                text-sm
                font-extrabold
                text-slate-900
                dark:text-white
                truncate
                max-w-[170px]
              "
            >
              {t(
                'common.dashboard_title_short',
                'Stark',
              )}
            </p>
          </div>
        </div>

        {/* Mobile User Avatar */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={handleProfileClick}
            data-prevent-outside-close="true"
            className="
              relative
              flex
              items-center
              justify-center
              rounded-xl
              p-1
              hover:bg-slate-100
              dark:hover:bg-slate-800
              transition
            "
          >
            <div
              data-prevent-outside-close="true"
              style={{
                backgroundColor: currentColor,
              }}
              className="
                w-9
                h-9
                rounded-xl
                flex
                items-center
                justify-center
                text-white
                font-bold
                text-xs
                shadow-sm
              "
            >
              {getUserInitials(user?.name)}
            </div>

            <span
              data-prevent-outside-close="true"
              className="
                absolute
                bottom-0.5
                end-0.5
                w-2.5
                h-2.5
                bg-emerald-500
                rounded-full
                ring-2
                ring-white
                dark:ring-slate-900
              "
            />
          </button>

          {isClicked.userProfile && (
            <UserProfile
              onClose={closeUserProfile}
            />
          )}
        </div>
      </div>

      {/* ==================================================
          CENTER ACTIONS - DESKTOP
      ================================================== */}

      <div
        className="
          hidden
          md:flex
          flex-1
          justify-center
          px-4
        "
      >
        <div
          className="
            flex
            items-center
            gap-1

            bg-slate-50/90
            dark:bg-slate-900/60

            border
            border-slate-100
            dark:border-slate-800

            rounded-2xl

            p-1.5

            shadow-sm
          "
        >
          {/* Currencies */}
          <div className="relative">
            <NavButton
              title={t(
                'common.currencies',
                'Currencies',
              )}
              customFunc={() => handleClick('cart')}
              icon={<FaWallet />}
              isActive={isClicked.cart}
              accentColor={currentColor}
            />

            {isClicked.cart && (
              <Currencies
                onClose={closeCurrencies}
              />
            )}
          </div>

          {/* Payments */}
          <div className="relative">
            <NavButton
              title={t(
                'common.payments_log',
                'Payments Log',
              )}
              customFunc={() => handleClick('chat')}
              icon={<BsListCheck />}
              dotColor={currentColor}
              isActive={isClicked.chat}
              accentColor={currentColor}
            />

            {isClicked.chat && (
              <Payments
                onClose={closePayments}
              />
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <NavButton
              title={t(
                'common.notifications',
                'Notifications',
              )}
              customFunc={() => handleClick('notification')}
              icon={<RiNotification3Line />}
              dotColor="#F59E0B"
              isActive={isClicked.notification}
              accentColor={currentColor}
            />

            {isClicked.notification && (
              <Notification
                onClose={closeNotifications}
              />
            )}
          </div>

          {/* Admin Actions */}
          <div className="relative">
            <NavButton
              title={t(
                'common.admin_actions',
                'Admin Actions',
              )}
              customFunc={() => handleClick('adminActions')}
              icon={<FaUserShield />}
              dotColor={currentColor}
              isActive={isClicked.adminActions}
              accentColor={currentColor}
            />

            {isClicked.adminActions && (
              <LastActions
                onClose={closeAdminActions}
              />
            )}
          </div>

          {/* Divider */}
          <div
            className="
              w-px
              h-6
              bg-slate-200
              dark:bg-slate-700
              mx-1
            "
          />

          {/* Logout */}
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
                group
                relative
                flex
                items-center
                justify-center

                w-10
                h-10

                rounded-xl

                text-slate-400
                dark:text-slate-500

                border
                border-transparent

                hover:text-red-500
                hover:bg-red-50
                hover:border-red-100

                dark:hover:bg-red-950/30
                dark:hover:border-red-900/40

                transition-all
                duration-200

                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-red-400
              "
            >
              <RiLogoutBoxRLine
                className="
                  text-xl
                  transition-transform
                  group-hover:scale-105
                "
              />
            </button>
          </TooltipComponent>
        </div>
      </div>

      {/* ==================================================
          END AREA - DESKTOP
          Language + Role + Profile
      ================================================== */}

      <div
        className="
          hidden
          md:flex
          items-center
          gap-2
          flex-shrink-0
        "
      >
        {/* Language */}
        <div className="flex items-center">
          <LanguageSwitcher />
        </div>

        {/* Role Badge */}
        <div
          className="
            hidden
            lg:flex
            items-center
            gap-2

            px-3
            h-9

            rounded-xl

            bg-slate-50
            dark:bg-slate-800

            border
            border-slate-100
            dark:border-slate-700
          "
        >
          <span
            style={{
              backgroundColor: currentColor,
            }}
            className="
              w-2
              h-2
              rounded-full
            "
          />

          <span
            className="
              text-xs
              font-bold
              text-slate-600
              dark:text-slate-300
              whitespace-nowrap
            "
          >
            {getRoleDisplayName(user?.role)}
          </span>
        </div>

        {/* Divider */}
        <div
          className="
            hidden
            lg:block
            w-px
            h-7
            bg-slate-200
            dark:bg-slate-700
            mx-1
          "
        />

        {/* User Profile */}
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
              className="
                group
                flex
                items-center
                gap-2.5

                p-1.5
                pe-2.5

                rounded-xl

                border
                border-slate-100
                dark:border-slate-700

                bg-white
                dark:bg-slate-900/40

                hover:bg-slate-50
                dark:hover:bg-slate-800

                hover:border-slate-200
                dark:hover:border-slate-600

                transition-all
                duration-200

                text-start

                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-offset-2
              "
            >
              {/* Avatar */}
              <div
                data-prevent-outside-close="true"
                className="
                  relative
                  flex-shrink-0
                "
              >
                <div
                  data-prevent-outside-close="true"
                  style={{
                    backgroundColor: currentColor,
                  }}
                  className="
                    w-9
                    h-9
                    rounded-xl

                    flex
                    items-center
                    justify-center

                    text-white
                    font-extrabold
                    text-xs

                    shadow-sm
                  "
                >
                  {getUserInitials(user?.name)}
                </div>

                <span
                  data-prevent-outside-close="true"
                  className="
                    absolute
                    -bottom-0.5
                    -end-0.5

                    w-2.5
                    h-2.5

                    bg-emerald-500
                    rounded-full

                    ring-2
                    ring-white
                    dark:ring-slate-900
                  "
                />
              </div>

              {/* User Details */}
              <div
                data-prevent-outside-close="true"
                className="
                  hidden
                  xl:block
                  min-w-0
                  max-w-[120px]
                "
              >
                <p
                  data-prevent-outside-close="true"
                  className="
                    text-xs
                    font-extrabold
                    text-slate-800
                    dark:text-white
                    truncate
                  "
                >
                  {user?.name || 'Admin'}
                </p>

                <p
                  data-prevent-outside-close="true"
                  className="
                    text-[10px]
                    text-slate-400
                    dark:text-slate-500
                    mt-0.5
                    truncate
                  "
                >
                  {getRoleDisplayName(user?.role)}
                </p>
              </div>

              <MdKeyboardArrowDown
                data-prevent-outside-close="true"
                className="
                  hidden
                  xl:block
                  text-slate-400
                  text-base
                  transition-transform
                  group-hover:translate-y-0.5
                "
              />
            </button>
          </TooltipComponent>

          {isClicked.userProfile && (
            <UserProfile
              onClose={closeUserProfile}
            />
          )}
        </div>
      </div>

      {/* ==================================================
          MOBILE SECOND ROW
      ================================================== */}

      {screenSize <= 768 && (
        <div
          className="
            md:hidden

            flex
            items-center
            justify-between

            gap-3

            mt-1
            pt-2

            border-t
            border-slate-100
            dark:border-slate-800

            w-full
          "
        >
          {/* Language */}
          <div
            className="
              flex-shrink-0
              scale-90
              origin-start
            "
          >
            <LanguageSwitcher />
          </div>

          {/* Mobile Icons */}
          <div
            className="
              flex
              items-center
              gap-1

              overflow-x-auto
              whitespace-nowrap

              py-0.5

              max-w-full

              no-scrollbar
            "
          >
            {/* Currencies */}
            <div className="relative inline-block">
              <NavButton
                title={t(
                  'common.currencies',
                  'Currencies',
                )}
                customFunc={() => handleClick('cart')}
                icon={<FaWallet />}
                isActive={isClicked.cart}
                accentColor={currentColor}
              />

              {isClicked.cart && (
                <Currencies
                  onClose={closeCurrencies}
                />
              )}
            </div>

            {/* Payments */}
            <div className="relative inline-block">
              <NavButton
                title={t(
                  'common.payments_log',
                  'Payments Log',
                )}
                customFunc={() => handleClick('chat')}
                icon={<BsListCheck />}
                dotColor={currentColor}
                isActive={isClicked.chat}
                accentColor={currentColor}
              />

              {isClicked.chat && (
                <Payments
                  onClose={closePayments}
                />
              )}
            </div>

            {/* Notifications */}
            <div className="relative inline-block">
              <NavButton
                title={t(
                  'common.notifications',
                  'Notifications',
                )}
                customFunc={() => handleClick('notification')}
                icon={<RiNotification3Line />}
                dotColor="#F59E0B"
                isActive={isClicked.notification}
                accentColor={currentColor}
              />

              {isClicked.notification && (
                <Notification
                  onClose={closeNotifications}
                />
              )}
            </div>

            {/* Admin Actions */}
            <div className="relative inline-block">
              <NavButton
                title={t(
                  'common.admin_actions',
                  'Admin Actions',
                )}
                customFunc={() => handleClick('adminActions')}
                icon={<FaUserShield />}
                dotColor={currentColor}
                isActive={isClicked.adminActions}
                accentColor={currentColor}
              />

              {isClicked.adminActions && (
                <LastActions
                  onClose={closeAdminActions}
                />
              )}
            </div>

            {/* Mobile Divider */}
            <div
              className="
                w-px
                h-5
                bg-slate-200
                dark:bg-slate-700
                mx-1
                flex-shrink-0
              "
            />

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              aria-label={t(
                'common.logout',
                'Logout',
              )}
              className="
                flex
                items-center
                justify-center

                w-10
                h-10

                rounded-xl

                text-slate-400

                hover:text-red-500
                hover:bg-red-50

                dark:hover:text-red-400
                dark:hover:bg-red-950/20

                flex-shrink-0

                transition-all
                duration-200
              "
            >
              <RiLogoutBoxRLine className="text-xl" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;