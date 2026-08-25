import React, {
  lazy,
  Suspense,
  useEffect,
} from 'react';

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { FiSettings } from 'react-icons/fi';
import { TooltipComponent } from '@syncfusion/ej2-react-popups';
import { useTranslation } from 'react-i18next';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import ThemeSettings from './components/ThemeSettings';
import Home from './pages/Home';

import './App.css';

import {
  useStateContext,
} from './contexts/ContextProvider';

import {
  AuthProvider,
  useAuth,
} from './contexts/AuthContext';

import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';

// ========================================
// Users
// ========================================

const Customers = lazy(() => (
  import('./pages/Users/Customers')
));

const CustomerDetails = lazy(() => (
  import('./pages/Users/CustomerDetails')
));

const Agents = lazy(() => (
  import('./pages/Users/Agents')
));

const AgentDetails = lazy(() => (
  import('./pages/Users/AgentDetails')
));

const Admin = lazy(() => (
  import('./pages/Users/Admin')
));

const Blacklist = lazy(() => (
  import('./pages/Users/BlackList')
));

const CustomerCategories = lazy(() => (
  import('./pages/Users/CustomerCategories')
));

const AgentOperations = lazy(() => (
  import('./pages/Users/AgentOperations')
));

const AgentUsers = lazy(() => (
  import('./pages/Users/AgentUsers')
));

// ========================================
// Requests
// ========================================

const Pending = lazy(() => (
  import('./pages/Requests/Pending')
));

const ShippingRequests = lazy(() => (
  import('./pages/Requests/ShippingRequests')
));

const ObjectionRequest = lazy(() => (
  import('./pages/Requests/ObjectionRequest')
));

const InProgress = lazy(() => (
  import('./pages/Requests/InProgress')
));

// ========================================
// Dashboard
// ========================================

const API = lazy(() => (
  import('./pages/Dashboard/API')
));

const Requests = lazy(() => (
  import('./pages/Dashboard/RequestsHub')
));

// هذه صفحة "طرق الدفع"
const Payments = lazy(() => (
  import('./pages/Dashboard/Payments')
));

// هذه صفحة "جميع المدفوعات"
const FullPayments = lazy(() => (
  import('./components/FullPayments')
));

const Transition = lazy(() => (
  import('./pages/Dashboard/Transition')
));

const Ads = lazy(() => (
  import('./pages/Dashboard/AdsPage')
));

const OperationalLogs = lazy(() => (
  import('./pages/Dashboard/OperationalLogs')
));

const FinanceControls = lazy(() => (
  import('./pages/Dashboard/FinanceControls')
));

const APITransactions = lazy(() => (
  import('./pages/Dashboard/APITransactions')
));

// ========================================
// Store
// ========================================

const Sections = lazy(() => (
  import('./pages/Store/Sections')
));

const Products = lazy(() => (
  import('./pages/Store/Products')
));

const AddProduct = lazy(() => (
  import('./pages/Store/AddProduct')
));

const AddSection = lazy(() => (
  import('./pages/Store/AddSection')
));

// ========================================
// Other
// ========================================

const Profile = lazy(() => (
  import('./components/Profile')
));

// ========================================
// Page Loader
// ========================================

const PageLoader = () => (
  <div
    className="
      flex
      min-h-[300px]
      w-full
      items-center
      justify-center
      p-20
    "
  >
    <div
      className="
        h-10
        w-10
        animate-spin
        rounded-full
        border-b-2
        border-indigo-600
      "
    />
  </div>
);

// ========================================
// Scroll To Top
// ========================================

const ScrollToTop = () => {
  const {
    pathname,
  } = useLocation();

  useEffect(() => {
    window.scrollTo(
      0,
      0,
    );
  }, [pathname]);

  return null;
};

// ========================================
// App Content
// ========================================

const AppContent = () => {
  const {
    t,
  } = useTranslation('common');

  const {
    setCurrentColor,
    setCurrentMode,
    currentMode,

    activeMenu,
    setActiveMenu,
    screenSize,

    currentColor,

    themeSettings,
    setThemeSettings,

    isClicked,
  } = useStateContext();

  const {
    user,
    loading,
    logout,
  } = useAuth();

  const isDesktop = (
    screenSize > 900
  );

  // ========================================
  // Load Theme
  // ========================================

  useEffect(() => {
    const currentThemeColor =
      localStorage.getItem(
        'colorMode',
      );

    const currentThemeMode =
      localStorage.getItem(
        'themeMode',
      );

    if (
      currentThemeColor
      && currentThemeMode
    ) {
      setCurrentColor(
        currentThemeColor,
      );

      setCurrentMode(
        currentThemeMode,
      );
    }
  }, [
    setCurrentColor,
    setCurrentMode,
  ]);

  // ========================================
  // Loading
  // ========================================

  if (loading) {
    return (
      <div
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-gray-50
          dark:bg-main-dark-bg
        "
      >
        <div className="text-center">
          <div
            className="
              mx-auto
              h-16
              w-16
              animate-spin
              rounded-full
              border-b-2
              border-indigo-600
            "
          />

          <p
            className="
              mt-4
              text-gray-600
              dark:text-gray-300
            "
          >
            {t(
              'common.securingDashboard',
            )}
          </p>
        </div>
      </div>
    );
  }

  // ========================================
  // Not Logged In
  // ========================================

  if (!user) {
    return <Login />;
  }

  // ========================================
  // Not Admin
  // ========================================

  if (
    user.role !== 'admin'
  ) {
    return (
      <div
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-gray-50
          dark:bg-main-dark-bg
        "
      >
        <div className="text-center">
          <div
            className="
              mx-auto
              mb-4
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-full
              bg-red-100
            "
          >
            <svg
              className="
                h-8
                w-8
                text-red-600
              "
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="
                  M12 15v2m-6 4h12
                  a2 2 0 002-2v-6
                  a2 2 0 00-2-2H6
                  a2 2 0 00-2 2v6
                  a2 2 0 002 2zm10-10V7
                  a4 4 0 00-8 0v4h8z
                "
              />
            </svg>
          </div>

          <h2
            className="
              mb-2
              text-2xl
              font-bold
              text-gray-900
              dark:text-white
            "
          >
            {t(
              'common.accessRestricted',
            )}
          </h2>

          <p
            className="
              mb-4
              text-gray-600
              dark:text-gray-300
            "
          >
            {t(
              'common.adminDashboardRequired',
            )}
          </p>

          <button
            type="button"
            onClick={logout}
            className="
              rounded-lg
              bg-indigo-600
              px-6
              py-2
              text-white
              transition
              hover:bg-indigo-700
            "
          >
            {t(
              'common.returnToLogin',
            )}
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // Main Application
  // ========================================

  return (
    <div
      className={
        currentMode === 'Dark'
          ? 'dark'
          : ''
      }
    >
      <ScrollToTop />

      <div
        className="
          relative
          min-h-screen
          w-full
          overflow-x-hidden
          bg-main-bg
          dark:bg-main-dark-bg
        "
      >
        {/* =====================================
            SETTINGS BUTTON
        ===================================== */}

        {!isClicked?.cart && (
          <div
            className="
              fixed
              bottom-4
              right-4
              z-[1200]
              rtl:left-4
              rtl:right-auto
            "
          >
            <TooltipComponent
              content={t(
                'common.settings',
              )}
              position="Top"
            >
              <button
                type="button"
                onClick={() => (
                  setThemeSettings(true)
                )}
                style={{
                  backgroundColor:
                    currentColor,
                }}
                className="
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-full
                  text-2xl
                  text-white
                  shadow-lg
                  transition-all
                  duration-200
                  hover:scale-105
                  hover:shadow-xl
                "
              >
                <FiSettings />
              </button>
            </TooltipComponent>
          </div>
        )}

        {/* =====================================
            MOBILE / TABLET OVERLAY
        ===================================== */}

        {activeMenu
          && !isDesktop && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => (
              setActiveMenu(false)
            )}
            className="
              fixed
              inset-0
              z-[1040]
              cursor-default
              bg-black/30
              backdrop-blur-[1px]
            "
          />
        )}

        {/* =====================================
            SIDEBAR
        ===================================== */}

        <aside
          className={`
            fixed
            bottom-0
            left-0
            top-0
            z-[1100]
            w-72
            max-w-[88vw]
            transform
            border-e
            border-gray-100
            bg-white
            shadow-xl
            transition-transform
            duration-300
            ease-in-out
            dark:border-gray-800
            dark:bg-secondary-dark-bg
            rtl:left-auto
            rtl:right-0

            ${
              activeMenu
                ? 'translate-x-0'
                : '-translate-x-full rtl:translate-x-full'
            }
          `}
        >
          <Sidebar />
        </aside>

        {/* =====================================
            MAIN CONTENT
        ===================================== */}

        <main
          style={{
            marginInlineStart:
              isDesktop
              && activeMenu
                ? '18rem'
                : '0',

            width:
              isDesktop
              && activeMenu
                ? 'calc(100% - 18rem)'
                : '100%',

            transition:
              'margin-inline-start 300ms ease, width 300ms ease, background-color 200ms ease',
          }}
          className="
            relative
            z-0
            flex
            min-h-screen
            min-w-0
            flex-col
            bg-main-bg
            dark:bg-main-dark-bg
          "
        >
          {/* =================================
              NAVBAR
          ================================= */}

          <div
            className="
              sticky
              top-0
              z-[900]
              w-full
              min-w-0
              border-b
              border-gray-100
              bg-white
              shadow-sm
              dark:border-gray-800
              dark:bg-secondary-dark-bg
            "
          >
            <Navbar />
          </div>

          {/* =================================
              PAGE CONTENT
          ================================= */}

          <div
            className="
              w-full
              min-w-0
              flex-1
              overflow-x-hidden
            "
          >
            {themeSettings && (
              <ThemeSettings />
            )}

            <Suspense
              fallback={
                <PageLoader />
              }
            >
              <Routes>
                {/* ========================== */}
                {/* Dashboard */}
                {/* ========================== */}

                <Route
                  path="/"
                  element={(
                    <ProtectedRoute>
                      <Home />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/home"
                  element={(
                    <ProtectedRoute>
                      <Home />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/api"
                  element={(
                    <ProtectedRoute>
                      <API />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/requests"
                  element={(
                    <ProtectedRoute>
                      <Requests />
                    </ProtectedRoute>
                  )}
                />

                {/* ========================== */}
                {/* Payments */}
                {/* ========================== */}

                <Route
                  path="/payment"
                  element={(
                    <Navigate
                      to="/payments"
                      replace
                    />
                  )}
                />

                {/* طرق الدفع */}
                <Route
                  path="/payments"
                  element={(
                    <ProtectedRoute>
                      <Payments />
                    </ProtectedRoute>
                  )}
                />

                {/* جميع المدفوعات */}
                <Route
                  path="/all-payments"
                  element={(
                    <ProtectedRoute>
                      <FullPayments />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/transition"
                  element={(
                    <ProtectedRoute>
                      <Transition />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/ads"
                  element={(
                    <ProtectedRoute>
                      <Ads />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/operational-logs"
                  element={(
                    <ProtectedRoute>
                      <OperationalLogs />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/finance-controls"
                  element={(
                    <ProtectedRoute>
                      <FinanceControls />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/api-transactions"
                  element={(
                    <ProtectedRoute>
                      <APITransactions />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/profile"
                  element={(
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  )}
                />

                {/* ========================== */}
                {/* Requests */}
                {/* ========================== */}

                <Route
                  path="/shipping-requests"
                  element={(
                    <ProtectedRoute>
                      <ShippingRequests />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/pending"
                  element={(
                    <ProtectedRoute>
                      <Pending />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/in-progress"
                  element={(
                    <ProtectedRoute>
                      <InProgress />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/objection-requests"
                  element={(
                    <ProtectedRoute>
                      <ObjectionRequest />
                    </ProtectedRoute>
                  )}
                />

                {/* ========================== */}
                {/* Users */}
                {/* ========================== */}

                <Route
                  path="/customers"
                  element={(
                    <ProtectedRoute>
                      <Customers />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/customers/:customerId"
                  element={(
                    <ProtectedRoute>
                      <CustomerDetails />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/agents"
                  element={(
                    <ProtectedRoute>
                      <Agents />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/agents/:agentId"
                  element={(
                    <ProtectedRoute>
                      <AgentDetails />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/blacklist"
                  element={(
                    <ProtectedRoute>
                      <Blacklist />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/admins"
                  element={(
                    <ProtectedRoute>
                      <Admin />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/customer-categories"
                  element={(
                    <ProtectedRoute>
                      <CustomerCategories />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/agent-operations"
                  element={(
                    <ProtectedRoute>
                      <AgentOperations />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/agent-users/:agentId"
                  element={(
                    <ProtectedRoute>
                      <AgentUsers />
                    </ProtectedRoute>
                  )}
                />

                {/* ========================== */}
                {/* Store */}
                {/* ========================== */}

                <Route
                  path="/sections"
                  element={(
                    <ProtectedRoute>
                      <Sections />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/products"
                  element={(
                    <ProtectedRoute>
                      <Products />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/product/add"
                  element={(
                    <ProtectedRoute>
                      <AddProduct />
                    </ProtectedRoute>
                  )}
                />

                <Route
                  path="/section/add"
                  element={(
                    <ProtectedRoute>
                      <AddSection />
                    </ProtectedRoute>
                  )}
                />

                {/* ========================== */}
                {/* Fallback */}
                {/* ========================== */}

                <Route
                  path="*"
                  element={(
                    <Navigate
                      to="/"
                      replace
                    />
                  )}
                />
              </Routes>
            </Suspense>
          </div>

          <Footer />
        </main>
      </div>
    </div>
  );
};

// ========================================
// App
// ========================================

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  </AuthProvider>
);

export default App;