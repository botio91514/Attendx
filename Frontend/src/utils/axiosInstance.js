import axios from 'axios';

/**
 * Custom Axios Instance for AttendX
 * Handles automatic token refreshing and session persistence
 */
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Crucial for sending/receiving HTTP-only cookies
});

// Request Interceptor: Attach accessToken to every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('attendx_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle token expiration (401)
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 response and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the access token
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        if (res.data.success && res.data.token) {
          const newToken = res.data.token;
          
          // Save new token
          localStorage.setItem('attendx_token', newToken);
          
          // Update the original request header and retry
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token failed (expired or invalid)
        console.error('Session expired. Redirecting to login...');
        localStorage.removeItem('attendx_token');
        localStorage.removeItem('attendx_user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
