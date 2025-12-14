const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Security error codes that should force logout
const FORCE_LOGOUT_ERRORS = [
  'USER_NOT_FOUND',
  'ACCOUNT_DEACTIVATED', 
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'ACCESS_DENIED',
  'AUTH_ERROR'
];

// Subscription error codes
const SUBSCRIPTION_ERRORS = [
  'NO_SUBSCRIPTION',
  'SUBSCRIPTION_PENDING',
  'SUBSCRIPTION_EXPIRED'
];

// Global error handler callback (set by App.js)
let globalErrorHandler = null;

const setGlobalErrorHandler = (handler) => {
  globalErrorHandler = handler;
};

const handleResponse = async (res) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error = new Error(errorData.message || errorData.error || 'Request failed');
    error.code = errorData.error;
    error.status = res.status;
    
    // Mark security and subscription errors for special handling
    if (FORCE_LOGOUT_ERRORS.includes(error.code)) {
      error.forceLogout = true;
    }
    
    if (SUBSCRIPTION_ERRORS.includes(error.code)) {
      error.subscriptionError = true;
    }
    
    throw error;
  }
  return res.json();
};

const handleApiCall = async (apiCall) => {
  try {
    return await apiCall();
  } catch (error) {
    // Handle security errors globally
    if (error.forceLogout || error.subscriptionError) {
      if (globalErrorHandler) {
        globalErrorHandler(error);
      }
      // Return null to indicate handled error - components should check for this
      return null;
    }
    // Re-throw other errors normally
    throw error;
  }
};

const api = {
  async get(endpoint, token) {
    return handleApiCall(async () => {
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return handleResponse(res);
    });
  },

  async post(endpoint, data, token) {
    return handleApiCall(async () => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      return handleResponse(res);
    });
  },

  async put(endpoint, data, token) {
    return handleApiCall(async () => {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      return handleResponse(res);
    });
  },

  async delete(endpoint, token) {
    return handleApiCall(async () => {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      return handleResponse(res);
    });
  },
  
  setGlobalErrorHandler
};

export default api;
