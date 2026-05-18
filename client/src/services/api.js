import axios from 'axios';

const rawApiUrl = String(import.meta.env.VITE_API_URL || '').trim();
const normalizedApiUrl = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, '').replace(/\/api\/?$/i, '')
  : '';

const api = axios.create({
  baseURL: normalizedApiUrl ? `${normalizedApiUrl}/api` : '/api',
  timeout: 120000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ptt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const redirectPath = '/login';

      localStorage.removeItem('ptt_token');
      localStorage.removeItem('ptt_user');
      if (window.location.pathname !== redirectPath) {
        window.location.href = redirectPath;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
