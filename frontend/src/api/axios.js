import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Use relative URL so all requests route through the tunnel/proxy
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-attach JWT access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh token interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          // Changed to relative URL: /api/auth/token/refresh/
          const res = await axios.post('/api/auth/token/refresh/', {
            refresh: refreshToken,
          });
          localStorage.setItem('access_token', res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return api(originalRequest);
        } catch (err) {
          localStorage.clear();
          console.log(err)
          window.location.reload();
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;