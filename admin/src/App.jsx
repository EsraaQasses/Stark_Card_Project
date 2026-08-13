import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { FiSettings } from 'react-icons/fi';
import { TooltipComponent } from '@syncfusion/ej2-react-popups';
import { useTranslation } from 'react-i18next';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import ThemeSettings from './components/ThemeSettings';
import Home from './pages/Home';
import './App.css';

const Customers = lazy(() => import('./pages/Users/Customers'));
const Agents = lazy(() => import('./pages/Users/Agents'));
const Admin = lazy(() => import('./pages/Users/Admin'));
const Blacklist = lazy(() => import('./pages/Users/BlackList'));
const CustomerCategories = lazy(() => import('./pages/Users/CustomerCategories'));
const AgentOperations = lazy(() => import('./pages/Users/AgentOperations'));
const AgentUsers = lazy(() => import('./pages/Users/AgentUsers'));

const Pending = lazy(() => import('./pages/Requests/Pending'));
const ShippingRequests = lazy(() => import('./pages/Requests/ShippingRequests'));
const ObjectionRequest = lazy(() => import('./pages/Requests/ObjectionRequest'));
const InProgress = lazy(() => import('./pages/Requests/InProgress'));
const API = lazy(() => import('./pages/Dashboard/API'));
const Requests = lazy(() => import('./pages/Dashboard/RequestsHub'));
const Payments = lazy(() => import('./pages/Dashboard/Payments'));
const Transition = lazy(() => import('./pages/Dashboard/Transition'));
const Ads = lazy(() => import('./pages/Dashboard/AdsPage'));
const OperationalLogs = lazy(() => import('./pages/Dashboard/OperationalLogs'));
const FinanceControls = lazy(() => import('./pages/Dashboard/FinanceControls'));
const APITransactions = lazy(() => import('./pages/Dashboard/APITransactions'));
const Sections = lazy(() => import('./pages/Store/Sections'));
const Products = lazy(() => import('./pages/Store/Products'));
const AddProduct = lazy(() => import('./pages/Store/AddProduct'));
const AddSection = lazy(() => import('./pages/Store/AddSection'));
const Profile = lazy(() => import('./components/Profile'));
const FullPayments = lazy(() => import('./components/FullPayments'));

import { useStateContext } from './contexts/ContextProvider';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';

const PageLoader = () => (
  <div className="flex items-center justify-center p-20 min-h-[300px] w-full">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
  </div>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const AppContent = () => {
  const { t } = useTranslation('common');
  const { setCurrentColor, setCurrentMode, currentMode, activeMenu, currentColor, themeSettings, setThemeSettings, isClicked } = useStateContext();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    const currentThemeColor = localStorage.getItem('colorMode');
    const currentThemeMode = localStorage.getItem('themeMode');
    if (currentThemeColor && currentThemeMode) {
      setCurrentColor(currentThemeColor);
      setCurrentMode(currentThemeMode);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-main-dark-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">{t('common.securingDashboard')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-main-dark-bg">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('common.accessRestricted')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{t('common.adminDashboardRequired')}</p>
          <button
            type="button"
            onClick={logout}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            {t('common.returnToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={currentMode === 'Dark' ? 'dark' : ''}>
      <ScrollToTop />
      <div className="flex relative dark:bg-main-dark-bg">
        {!isClicked?.cart && (
          <div className="fixed right-4 rtl:left-4 rtl:right-auto bottom-4" style={{ zIndex: '1000' }}>
            <TooltipComponent content={t('common.settings')} position="Top">
              <button
                type="button"
                onClick={() => setThemeSettings(true)}
                style={{ background: currentColor, borderRadius: '50%' }}
                className="text-3xl text-white p-3 hover:drop-shadow-xl hover:bg-light-gray"
              >
                <FiSettings />
              </button>
            </TooltipComponent>
          </div>
        )}

        {activeMenu ? (
          <div className="w-72 fixed sidebar dark:bg-secondary-dark-bg bg-white left-0 rtl:right-0 rtl:left-auto">
            <Sidebar />
          </div>
        ) : (
          <div className="w-0 dark:bg-secondary-dark-bg">
            <Sidebar />
          </div>
        )}

        <div
          className={
            activeMenu
              ? 'dark:bg-main-dark-bg bg-main-bg min-h-screen md:ms-72 w-full'
              : 'bg-main-bg dark:bg-main-dark-bg w-full min-h-screen flex-2'
          }
        >
          <div className="fixed md:static bg-main-bg dark:bg-main-dark-bg navbar w-full ">
            <Navbar />
          </div>
          <div>
            {themeSettings && (<ThemeSettings />)}

            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* All routes are protected and require admin role */}
                <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/api" element={<ProtectedRoute><API /></ProtectedRoute>} />
                <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
                <Route path="/payment" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                <Route path="/transition" element={<ProtectedRoute><Transition /></ProtectedRoute>} />
                <Route path="/ads" element={<ProtectedRoute><Ads /></ProtectedRoute>} />
                <Route path="/operational-logs" element={<ProtectedRoute><OperationalLogs /></ProtectedRoute>} />
                <Route path="/finance-controls" element={<ProtectedRoute><FinanceControls /></ProtectedRoute>} />
                <Route path="/api-transactions" element={<ProtectedRoute><APITransactions /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><FullPayments /></ProtectedRoute>} />

                {/* Requests */}
                <Route path="/shipping-requests" element={<ProtectedRoute><ShippingRequests /></ProtectedRoute>} />
                <Route path="/pending" element={<ProtectedRoute><Pending /></ProtectedRoute>} />
                <Route path="/in-progress" element={<ProtectedRoute><InProgress /></ProtectedRoute>} />
                <Route path="/objection-requests" element={<ProtectedRoute><ObjectionRequest /></ProtectedRoute>} />

                {/* Users */}
                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
                <Route path="/blacklist" element={<ProtectedRoute><Blacklist /></ProtectedRoute>} />
                <Route path="/admins" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/customer-categories" element={<ProtectedRoute><CustomerCategories /></ProtectedRoute>} />
                <Route path="/agent-operations" element={<ProtectedRoute><AgentOperations /></ProtectedRoute>} />
                <Route path="/agent-users/:agentId" element={<ProtectedRoute><AgentUsers /></ProtectedRoute>} />

                {/* Store */}
                <Route path="/sections" element={<ProtectedRoute><Sections /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
                <Route path="/product/add" element={<ProtectedRoute><AddProduct /></ProtectedRoute>} />
                <Route path="/section/add" element={<ProtectedRoute><AddSection /></ProtectedRoute>} />

                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
