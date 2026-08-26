import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import axiosInstance from '../utils/axiosConfig';
import { getAuthErrorMessage } from '../utils/authError';

const AuthContext = createContext();

const clearStoredAuth = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('admin_session');
};

const getCachedAdmin = () => {
  try {
    const token = localStorage.getItem('access_token');
    const rawUser = localStorage.getItem('user');

    if (!token || !rawUser) {
      return null;
    }

    const cachedUser = JSON.parse(rawUser);

    if (cachedUser?.role !== 'admin') {
      clearStoredAuth();
      return null;
    }

    return cachedUser;
  } catch (_) {
    clearStoredAuth();
    return null;
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export const AuthProvider = ({ children }) => {
  /*
   * Important performance change:
   * - Hydrate the cached admin synchronously.
   * - Do NOT block the whole dashboard while /users/me/ is running.
   * - Verify the cached session in the background.
   *
   * Backend authorization remains the security boundary. If the access token
   * is expired/invalid, axiosConfig refreshes it or redirects to login on 401.
   */
  const [user, setUser] = useState(() => getCachedAdmin());
  const [loading, setLoading] = useState(() => !getCachedAdmin());

  const logout = async () => {
    const refresh = localStorage.getItem('refresh_token');

    try {
      if (refresh) {
        await axiosInstance.post('users/logout/', { refresh });
      }
    } finally {
      clearStoredAuth();
      setUser(null);
      window.location.href = '/login';
    }
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    const cachedUser = getCachedAdmin();

    if (!token || !cachedUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    /*
     * Show the dashboard immediately from the cached admin session.
     * The verification request continues in the background.
     */
    setUser(cachedUser);
    setLoading(false);

    try {
      const response = await axiosInstance.get('users/me/');
      const currentUser = response.data;

      if (
        currentUser?.role === 'admin'
        && !currentUser?.is_banned
      ) {
        setUser(currentUser);
        localStorage.setItem(
          'user',
          JSON.stringify(currentUser),
        );
        return;
      }

      clearStoredAuth();
      setUser(null);
    } catch (error) {
      /*
       * axiosConfig already handles 401:
       * - refresh token once when possible
       * - otherwise clear auth and redirect to login
       *
       * On a temporary network failure, keep the cached admin visible so the
       * application does not blank out. Protected API calls still enforce
       * backend authorization.
       */
      if (error.response?.status === 401) {
        clearStoredAuth();
        setUser(null);
      }
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const adminLoginStep1 = async (name, password) => {
    try {
      const response = await axiosInstance.post(
        'users/login/admin/step1/',
        {
          name,
          password,
        },
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: getAuthErrorMessage(
          error,
          'Step 1 failed. Please try again.',
        ),
      };
    }
  };

  const adminLoginStep2 = async (
    sessionToken,
    secondPassword,
  ) => {
    try {
      const response = await axiosInstance.post(
        'users/login/admin/step2/',
        {
          session_token: sessionToken,
          second_password: secondPassword,
        },
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: getAuthErrorMessage(
          error,
          'Second password verification failed.',
        ),
      };
    }
  };

  const adminSetupSecondPassword = async (
    sessionToken,
    secondPassword,
  ) => {
    try {
      const response = await axiosInstance.post(
        'users/setup-first-password/',
        {
          session_token: sessionToken,
          second_password: secondPassword,
          confirm_password: secondPassword,
        },
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: getAuthErrorMessage(
          error,
          'Failed to set up the second password.',
        ),
      };
    }
  };

  const adminLoginStep3 = async (
    sessionToken,
    token,
  ) => {
    try {
      const response = await axiosInstance.post(
        'users/login/admin/step3/',
        {
          session_token: sessionToken,
          otp_code: token,
        },
      );

      const {
        access,
        refresh,
        user: userData,
      } = response.data;

      if (userData.role !== 'admin') {
        throw new Error(
          'Access denied. Admin privileges required.',
        );
      }

      localStorage.setItem(
        'access_token',
        access,
      );

      localStorage.setItem(
        'refresh_token',
        refresh,
      );

      localStorage.setItem(
        'user',
        JSON.stringify(userData),
      );

      setUser(userData);
      setLoading(false);

      return {
        success: true,
        user: userData,
      };
    } catch (error) {
      return {
        success: false,
        error: getAuthErrorMessage(
          error,
          'Verification failed.',
        ),
      };
    }
  };

  const value = useMemo(() => ({
    user,
    adminLoginStep1,
    adminLoginStep2,
    adminSetupSecondPassword,
    adminLoginStep3,
    logout,
    loading,
    isAuthenticated: Boolean(
      user
      && user.role === 'admin'
    ),
  }), [
    loading,
    user,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;