import axios from 'axios';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
if (!configuredApiBase && import.meta.env.PROD) {
  throw new Error('VITE_API_BASE_URL is required for production builds.');
}
const apiBaseURL = `${(configuredApiBase || 'http://127.0.0.1:8000/api')
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '')}/api`;

const axiosInstance = axios.create({
  baseURL: apiBaseURL,
  timeout: 30000,
});

let refreshPromise = null;

const clearAdminAuth = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('admin_session');
};

const redirectToLogin = () => {
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
};

const refreshAccessToken = async () => {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) throw new Error('No refresh token');

  const { data } = await axios.post(`${apiBaseURL}/users/token/refresh/`, { refresh }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  if (!data?.access) throw new Error('No access token returned');
  localStorage.setItem('access_token', data.access);
  if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
  return data.access;
};

// Simple and reliable request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    const isPublicAuthRequest = /\/users\/(?:login(?:\/|$)|setup-first-password|token\/refresh)/i
      .test(`${config.baseURL || ''}${config.url || ''}`);
    if (token && !isPublicAuthRequest) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (isPublicAuthRequest) {
      delete config.headers.Authorization;
    }
    
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Simple response interceptor - handle 401 by redirecting to login
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const original = error.config;
    const isAuthRequest = /\/users\/(?:login|token\/refresh|logout)\//.test(original?.url || '');

    if (error.response?.status === 401 && original && !original.retryAttempted && !isAuthRequest) {
      original.retryAttempted = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const access = await refreshPromise;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${access}`;
        return axiosInstance.request(original);
      } catch (refreshError) {
        clearAdminAuth();
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401) {
      clearAdminAuth();
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
