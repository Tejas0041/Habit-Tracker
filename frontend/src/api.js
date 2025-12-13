const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = {
  async get(endpoint, token) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`API GET ${endpoint} failed:`, res.status, text);
      throw new Error(`Request failed: ${res.status}`);
    }
    return res.json();
  },

  async post(endpoint, data, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  },

  async put(endpoint, data, token) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  },

  async delete(endpoint, token) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  }
};

export default api;
