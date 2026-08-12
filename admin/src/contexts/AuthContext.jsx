import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import axiosInstance from '../utils/axiosConfig';
import { getAuthErrorMessage } from '../utils/authError';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearStoredAuth = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin_session');
  };

  const logout = async () => {
    const refresh = localStorage.getItem('refresh_token');
    try {
      if (refresh) await axiosInstance.post('users/logout/', { refresh });
    } finally {
      clearStoredAuth();
      setUser(null);
      window.location.href = '/login';
    }
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const userData = localStorage.getItem('user');

      if (!token || !userData) return;

      const cachedUser = JSON.parse(userData);
      if (cachedUser?.role !== 'admin') {
        clearStoredAuth();
        return;
      }

      // Verify token is still valid and user is admin
      const response = await axiosInstance.get('users/me/');
      const currentUser = response.data;

      // Ensure user is still admin and not banned
      if (currentUser.role === 'admin' && !currentUser.is_banned) {
        setUser(currentUser);
      } else {
        // Don't logout immediately, just clear invalid data
        clearStoredAuth();
        setUser(null);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        clearStoredAuth();
        setUser(null);
      } else if (!error.response) {
        try {
          const cachedUser = JSON.parse(localStorage.getItem('user'));
          if (cachedUser?.role === 'admin') setUser(cachedUser);
        } catch (_) {
          clearStoredAuth();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // 3-Step Admin Login
  const adminLoginStep1 = async (name, password) => {
    try {
      const response = await axiosInstance.post('users/login/admin/step1/', {
        name,
        password,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = getAuthErrorMessage(error, 'Step 1 failed. Please try again.');
      return { success: false, error: errorMessage };
    }
  };

  const adminLoginStep2 = async (sessionToken, secondPassword) => {
    try {
      const response = await axiosInstance.post('users/login/admin/step2/', {
        session_token: sessionToken,
        second_password: secondPassword,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = getAuthErrorMessage(error, 'Second password verification failed.');
      return { success: false, error: errorMessage };
    }
  };

  const adminSetupSecondPassword = async (sessionToken, secondPassword) => {
    try {
      const response = await axiosInstance.post('users/setup-first-password/', {
        session_token: sessionToken,
        second_password: secondPassword,
        confirm_password: secondPassword,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: getAuthErrorMessage(error, 'Failed to set up the second password.'),
      };
    }
  };

  const adminLoginStep3 = async (sessionToken, token) => {
    try {
      const response = await axiosInstance.post('users/login/admin/step3/', {
        session_token: sessionToken,
        otp_code: token,
      });

      const { access, refresh, user: userData } = response.data;

      // Verify user is admin
      if (userData.role !== 'admin') {
        throw new Error('Access denied. Admin privileges required.');
      }

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      return { success: true, user: userData };
    } catch (error) {
      const errorMessage = getAuthErrorMessage(error, 'Verification failed.');
      return { success: false, error: errorMessage };
    }
  };

  // Use useMemo to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    adminLoginStep1,
    adminLoginStep2,
    adminSetupSecondPassword,
    adminLoginStep3,
    logout,
    loading,
    isAuthenticated: !!user && user.role === 'admin',
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
