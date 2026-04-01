const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Generic fetch wrapper with authentication and auto-refresh logic
 */
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  let token = localStorage.getItem('attendx_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // CRITICAL: Allow sending and receiving cookies (refreshToken)
  };

  try {
    let response = await fetch(`${API_URL}${endpoint}`, fetchOptions);

    // 🔄 AUTO-REFRESH LOGIC (If Access Token Expired)
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh-token')) {
      console.log('🔄 Access token expired. Attempting to refresh token...');
      
      const refreshRes = await fetch(`${API_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newToken = refreshData.token;
        
        // Update storage
        localStorage.setItem('attendx_token', newToken);
        
        // Retry original request with NEW token
        const newHeaders = {
          ...headers,
          'Authorization': `Bearer ${newToken}`
        } as HeadersInit;
        
        response = await fetch(`${API_URL}${endpoint}`, {
          ...fetchOptions,
          headers: newHeaders
        });
      } else {
        // Refresh failed (cookie expired or missing)
        localStorage.removeItem('attendx_token');
        localStorage.removeItem('attendx_user');
        window.location.href = '/login';
        throw new Error('Session expired. Please login again.');
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

export const api = {
  get: (endpoint: string) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint: string, body: any) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint: string, body: any) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint: string) => apiRequest(endpoint, { method: 'DELETE' }),
};
