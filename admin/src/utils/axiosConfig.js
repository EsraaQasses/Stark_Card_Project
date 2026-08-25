import axios from 'axios';

const apiBaseURL = 'http://37.120.185.235/api';

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

  if (!refresh) {
    throw new Error('No refresh token');
  }

  const { data } = await axios.post(
    `${apiBaseURL}/users/token/refresh/`,
    { refresh },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  if (!data?.access) {
    throw new Error('No access token returned');
  }

  localStorage.setItem('access_token', data.access);

  if (data.refresh) {
    localStorage.setItem('refresh_token', data.refresh);
  }

  return data.access;
};

// ==============================
// Request Interceptor
// ==============================
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');

    const requestUrl = `${config.baseURL || ''}${config.url || ''}`;

    const isPublicAuthRequest = /\/users\/(?:login(?:\/|$)|setup-first-password|token\/refresh)/i.test(
      requestUrl
    );

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
  (error) => Promise.reject(error)
);

// ==============================
// Response Interceptor
// ==============================
axiosInstance.interceptors.response.use(
  (response) => response,

  async (error) => {
    const original = error.config;

    const isAuthRequest = /\/users\/(?:login|token\/refresh|logout)\//.test(
      original?.url || ''
    );

    if (
      error.response?.status === 401
      && original
      && !original.retryAttempted
      && !isAuthRequest
    ) {
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