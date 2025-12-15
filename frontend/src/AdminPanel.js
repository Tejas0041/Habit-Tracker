import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminPanel = () => {
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ total: 0, pages: 1, currentPage: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmPopup, setConfirmPopup] = useState({ show: false, title: '', message: '', onConfirm: null });
  const [theme, setTheme] = useState(localStorage.getItem('adminTheme') || 'dark');
  const [chartReady, setChartReady] = useState(false);
  const [pendingSubscriptions, setPendingSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionTab, setSubscriptionTab] = useState('all'); // 'all' or 'pending'
  const [imagePreview, setImagePreview] = useState(null);
  const [processingSubscription, setProcessingSubscription] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchTimeout = useRef(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('adminTheme', theme);
  }, [theme]);

  // PWA Installation for Admin Panel
  useEffect(() => {
    const checkMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
    setIsMobileDevice(checkMobile());
    
    // Update manifest link for admin
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.href = '/admin-manifest.json';
    } else {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/admin-manifest.json';
      document.head.appendChild(link);
    }
    
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('resize', () => setIsMobileDevice(checkMobile()));
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      // Restore original manifest when leaving admin
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        manifestLink.href = '/manifest.json';
      }
    };
  }, []);

  const handleAddToHomescreen = async () => {
    setMobileMenuOpen(false);
    if (!deferredPrompt) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const message = isIOS 
        ? '1. Tap the Share button (square with arrow) at the bottom of Safari\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm'
        : '1. Tap the three-dot menu (⋮) in the top right\n2. Tap "Add to Home screen" or "Install app"\n3. Tap "Add" to confirm';
      
      setConfirmPopup({
        show: true,
        title: 'Add Admin Panel to Home Screen',
        message,
        onConfirm: () => setConfirmPopup({ show: false, title: '', message: '', onConfirm: null })
      });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Admin panel added to homescreen!', 'success');
    }
    setDeferredPrompt(null);
  };

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  }, []);

  const apiCall = useCallback(async (endpoint, options = {}) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        ...options.headers
      }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  }, [adminToken]);

  const loadDashboard = useCallback(async () => {
    if (!adminToken) return;
    setChartReady(false);
    try {
      const data = await apiCall('/admin/dashboard');
      setDashboard(data);
      // Simulate chart rendering delay
      setTimeout(() => setChartReady(true), 100);
    } catch (err) {
      if (err.message === 'Invalid token') {
        localStorage.removeItem('adminToken');
        setAdminToken(null);
      }
    }
  }, [adminToken, apiCall]);

  const loadUsers = useCallback(async (page = 1) => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const data = await apiCall(`/admin/users?page=${page}&limit=10&search=${searchQuery}&status=${statusFilter}`);
      setUsers(data.users);
      setUsersPagination({ total: data.total, pages: data.pages, currentPage: data.currentPage });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [adminToken, apiCall, searchQuery, statusFilter, showToast]);

  const loadPendingSubscriptions = useCallback(async () => {
    if (!adminToken) return;
    setSubscriptionsLoading(true);
    try {
      const data = await apiCall('/admin/subscriptions/pending');
      setPendingSubscriptions(data.users || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubscriptionsLoading(false);
    }
  }, [adminToken, apiCall, showToast]);

  const loadAllSubscriptions = useCallback(async () => {
    if (!adminToken) return;
    try {
      const data = await apiCall('/admin/subscriptions/all');
      setAllSubscriptions(data.users || []);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [adminToken, apiCall, showToast]);

  const [reloading, setReloading] = useState(false);
  
  const handleReload = async () => {
    setReloading(true);
    try {
      if (activeTab === 'dashboard') {
        await loadDashboard();
      } else if (activeTab === 'users') {
        await loadUsers(usersPagination.currentPage);
      } else if (activeTab === 'subscriptions') {
        await loadPendingSubscriptions();
        await loadAllSubscriptions();
      }
      showToast('Data refreshed!', 'success');
    } catch (err) {
      showToast('Failed to refresh', 'error');
    } finally {
      setReloading(false);
    }
  };

  const approveSubscription = async (userId, userName) => {
    setConfirmPopup({
      show: true,
      title: 'Approve Subscription',
      message: `Are you sure you want to approve subscription for "${userName}"? They will get 1 year access.`,
      onConfirm: async () => {
        setConfirmPopup({ show: false, title: '', message: '', onConfirm: null });
        setProcessingSubscription(userId);
        try {
          await apiCall(`/admin/subscriptions/${userId}/approve`, { method: 'PUT' });
          showToast('Subscription approved successfully!', 'success');
          loadPendingSubscriptions();
          loadAllSubscriptions();
          loadDashboard();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setProcessingSubscription(null);
        }
      }
    });
  };

  const rejectSubscription = async (userId) => {
    if (processingSubscription) return;
    setProcessingSubscription(userId);
    try {
      await apiCall(`/admin/subscriptions/${userId}/reject`, { method: 'PUT' });
      showToast('Subscription rejected', 'success');
      loadPendingSubscriptions();
      loadAllSubscriptions();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setProcessingSubscription(null);
    }
  };

  const pauseSubscription = async (userId, userName) => {
    setConfirmPopup({
      show: true,
      title: 'Pause Subscription',
      message: `Are you sure you want to pause subscription for "${userName}"? Their subscription timer will be paused.`,
      onConfirm: async () => {
        setConfirmPopup({ show: false, title: '', message: '', onConfirm: null });
        setProcessingSubscription(userId);
        try {
          await apiCall(`/admin/subscriptions/${userId}/pause`, { method: 'PUT' });
          showToast('Subscription paused successfully!', 'success');
          loadAllSubscriptions();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setProcessingSubscription(null);
        }
      }
    });
  };

  const resumeSubscription = async (userId, userName) => {
    setConfirmPopup({
      show: true,
      title: 'Resume Subscription',
      message: `Are you sure you want to resume subscription for "${userName}"? Their subscription timer will continue.`,
      onConfirm: async () => {
        setConfirmPopup({ show: false, title: '', message: '', onConfirm: null });
        setProcessingSubscription(userId);
        try {
          await apiCall(`/admin/subscriptions/${userId}/resume`, { method: 'PUT' });
          showToast('Subscription resumed successfully!', 'success');
          loadAllSubscriptions();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setProcessingSubscription(null);
        }
      }
    });
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchInput]);

  useEffect(() => {
    if (adminToken) {
      loadDashboard();
      loadPendingSubscriptions();
    }
  }, [adminToken, loadDashboard, loadPendingSubscriptions]);

  // Handle admin shortcut URL parameters
  useEffect(() => {
    if (adminToken) {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      
      if (tab && ['dashboard', 'subscriptions', 'users'].includes(tab)) {
        setActiveTab(tab);
        // Clean URL after handling action
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [adminToken]);

  useEffect(() => {
    if (adminToken) {
      loadUsers(1);
    }
  }, [adminToken, searchQuery, statusFilter]);

  useEffect(() => {
    if (adminToken && activeTab === 'subscriptions') {
      loadPendingSubscriptions();
      loadAllSubscriptions();
    }
  }, [adminToken, activeTab, loadPendingSubscriptions, loadAllSubscriptions]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('adminToken', data.token);
      setAdminToken(data.token);
      showToast('Welcome, Admin!', 'success');
    } catch (err) {
      setLoginError(err.message);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setConfirmPopup({
      show: true,
      title: 'Logout',
      message: 'Are you sure you want to logout from the admin panel?',
      onConfirm: () => {
        localStorage.removeItem('adminToken');
        setAdminToken(null);
        setDashboard(null);
        setUsers([]);
        setConfirmPopup({ show: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    setConfirmPopup({
      show: true,
      title: currentStatus ? 'Deactivate User' : 'Activate User',
      message: `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`,
      onConfirm: async () => {
        try {
          await apiCall(`/admin/users/${userId}/toggle-status`, { method: 'PUT' });
          showToast(`User ${currentStatus ? 'deactivated' : 'activated'} successfully`);
          loadUsers(usersPagination.currentPage);
          loadDashboard();
        } catch (err) {
          showToast(err.message, 'error');
        }
        setConfirmPopup({ show: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const deleteUser = async (userId, userName) => {
    setConfirmPopup({
      show: true,
      title: 'Delete User',
      message: `Are you sure you want to permanently delete "${userName}" and all their data? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
          showToast('User deleted successfully');
          loadUsers(usersPagination.currentPage);
          loadDashboard();
        } catch (err) {
          showToast(err.message, 'error');
        }
        setConfirmPopup({ show: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    // Convert to IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const utc = d.getTime() + (d.getTimezoneOffset() * 60 * 1000);
    const istDate = new Date(utc + istOffset);
    
    const day = istDate.getDate();
    const month = istDate.toLocaleDateString('en-IN', { month: 'short' });
    const year = istDate.getFullYear();
    const hours = istDate.getHours().toString().padStart(2, '0');
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  // Login Page
  if (!adminToken) {
    return (
      <div className="admin-login-page" data-theme={theme}>
        <div className="admin-login-container">
          <div className="admin-login-card">
            <div className="admin-login-header">
              <div className="admin-logo">🛡️</div>
              <h1>Admin Panel</h1>
              <p>Habit Tracker Administration</p>
            </div>
            <form onSubmit={handleLogin} className="admin-login-form">
              {loginError && <div className="admin-error">{loginError}</div>}
              <div className="admin-input-group">
                <label>Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" required />
              </div>
              <div className="admin-input-group">
                <label>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required />
              </div>
              <button type="submit" className="admin-login-btn" disabled={loading}>
                {loading ? <span className="admin-spinner"></span> : 'Sign In'}
              </button>
            </form>
            <button className="admin-theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel" data-theme={theme}>
      {/* Toast */}
      {toast.show && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}

      {/* Confirm Popup */}
      {confirmPopup.show && (
        <div className="admin-popup-overlay">
          <div className="admin-popup">
            <h3>{confirmPopup.title}</h3>
            <p>{confirmPopup.message}</p>
            <div className="admin-popup-buttons">
              <button className="admin-btn secondary" onClick={() => setConfirmPopup({ show: false, title: '', message: '', onConfirm: null })}>Cancel</button>
              <button className="admin-btn danger" onClick={confirmPopup.onConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <header className="admin-mobile-header">
        <div className="admin-mobile-logo">
          <span className="admin-logo-icon">🛡️</span>
          <span>Admin</span>
        </div>
        <div className="admin-mobile-actions">
          <button className="admin-theme-btn-mobile" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="admin-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <span className={`admin-hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`admin-hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`admin-hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && <div className="admin-mobile-overlay" onClick={() => setMobileMenuOpen(false)}></div>}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <nav className="admin-nav">
          <button className={`admin-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}>
            📊 <span>Dashboard</span>
          </button>
          <button className={`admin-nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`} onClick={() => { setActiveTab('subscriptions'); setMobileMenuOpen(false); }}>
            💳 <span>Subscriptions</span>
            {pendingSubscriptions.length > 0 && <span className="admin-nav-badge">{pendingSubscriptions.length}</span>}
          </button>
          <button className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}>
            👥 <span>Users</span>
          </button>
        </nav>
        <div className="admin-sidebar-header">
          <div className="admin-logo-small">🛡️</div>
          <span>Admin Panel</span>
        </div>
        <div className="admin-sidebar-footer">
          <button className="admin-theme-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          {isMobileDevice && (
            <button className="admin-install-btn" onClick={handleAddToHomescreen}>
              📱 Add to Home
            </button>
          )}
          <button className="admin-logout-btn" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {activeTab === 'dashboard' && (
          <div className="admin-dashboard">
            <div className="admin-page-header">
              <div>
                <h1>Dashboard</h1>
                <p className="admin-subtitle">Overview of your Habit Tracker platform</p>
              </div>
              <button className="admin-reload-btn" onClick={handleReload} disabled={reloading}>
                {reloading ? <span className="admin-spinner"></span> : '🔄'} Refresh
              </button>
            </div>
            
            {!dashboard ? (
              <div className="admin-loader-container">
                <div className="admin-spinner-large"></div>
                <p>Loading dashboard...</p>
              </div>
            ) : (
              <>
            
            <div className="admin-stats-grid">
              <div className="admin-stat-card primary">
                <div className="admin-stat-icon">👥</div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value">{dashboard.totalUsers}</span>
                  <span className="admin-stat-label">Total Users</span>
                </div>
              </div>
              <div className="admin-stat-card success">
                <div className="admin-stat-icon">✅</div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value">{dashboard.activeUsers}</span>
                  <span className="admin-stat-label">Active Users</span>
                </div>
              </div>
              <div className="admin-stat-card danger">
                <div className="admin-stat-icon">🚫</div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value">{dashboard.deactivatedUsers}</span>
                  <span className="admin-stat-label">Deactivated</span>
                </div>
              </div>
              <div className="admin-stat-card warning" onClick={() => setActiveTab('subscriptions')} style={{ cursor: 'pointer' }}>
                <div className="admin-stat-icon">⏳</div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value">{dashboard.pendingSubscriptions || 0}</span>
                  <span className="admin-stat-label">Pending Subscriptions</span>
                </div>
              </div>
              <div className="admin-stat-card info">
                <div className="admin-stat-icon">💳</div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value">{dashboard.activeSubscriptions || 0}</span>
                  <span className="admin-stat-label">Active Subscriptions</span>
                </div>
              </div>
            </div>

            <div className="admin-cards-row">
              <div className="admin-card admin-growth-card">
                <h3>📈 User Growth (Last 30 Days)</h3>
                {!chartReady ? (
                  <div className="admin-chart-loader">
                    <div className="admin-spinner-large"></div>
                    <p>Rendering chart...</p>
                  </div>
                ) : dashboard.growthData && dashboard.growthData.length > 0 ? (
                  <div className="admin-chart-container">
                    <Line
                      data={{
                        labels: dashboard.growthData.map(d => d.date),
                        datasets: [{
                          label: 'New Users',
                          data: dashboard.growthData.map(d => d.users),
                          borderColor: '#10b981',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          fill: true,
                          tension: 0.4,
                          pointRadius: 3,
                          pointHoverRadius: 6,
                          pointBackgroundColor: '#10b981',
                          pointBorderColor: '#fff',
                          pointBorderWidth: 2
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          },
                          tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#f1f5f9',
                            bodyColor: '#cbd5e1',
                            borderColor: '#10b981',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                              label: (context) => `${context.parsed.y} new user${context.parsed.y !== 1 ? 's' : ''}`
                            }
                          }
                        },
                        scales: {
                          x: {
                            grid: {
                              color: 'rgba(255, 255, 255, 0.05)',
                              drawBorder: false
                            },
                            ticks: {
                              color: '#64748b',
                              maxRotation: 45,
                              minRotation: 45,
                              font: {
                                size: 10
                              }
                            }
                          },
                          y: {
                            beginAtZero: true,
                            grid: {
                              color: 'rgba(255, 255, 255, 0.05)',
                              drawBorder: false
                            },
                            ticks: {
                              color: '#64748b',
                              stepSize: 1,
                              font: {
                                size: 11
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <p className="admin-empty">No growth data available</p>
                )}
              </div>
              <div className="admin-card admin-growth-card">
                <h3>💳 Subscription Growth (Last 30 Days)</h3>
                {!chartReady ? (
                  <div className="admin-chart-loader">
                    <div className="admin-spinner-large"></div>
                    <p>Rendering chart...</p>
                  </div>
                ) : dashboard.subscriptionGrowthData && dashboard.subscriptionGrowthData.length > 0 ? (
                  <div className="admin-chart-container">
                    <Line
                      data={{
                        labels: dashboard.subscriptionGrowthData.map(d => d.date),
                        datasets: [{
                          label: 'New Subscriptions',
                          data: dashboard.subscriptionGrowthData.map(d => d.subscriptions),
                          borderColor: '#f59e0b',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          fill: true,
                          tension: 0.4,
                          pointRadius: 3,
                          pointHoverRadius: 6,
                          pointBackgroundColor: '#f59e0b',
                          pointBorderColor: '#fff',
                          pointBorderWidth: 2
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          },
                          tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#f1f5f9',
                            bodyColor: '#cbd5e1',
                            borderColor: '#f59e0b',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                              label: (context) => `${context.parsed.y} subscription${context.parsed.y !== 1 ? 's' : ''}`
                            }
                          }
                        },
                        scales: {
                          x: {
                            grid: {
                              color: 'rgba(255, 255, 255, 0.05)',
                              drawBorder: false
                            },
                            ticks: {
                              color: '#64748b',
                              maxRotation: 45,
                              minRotation: 45,
                              font: {
                                size: 10
                              }
                            }
                          },
                          y: {
                            beginAtZero: true,
                            grid: {
                              color: 'rgba(255, 255, 255, 0.05)',
                              drawBorder: false
                            },
                            ticks: {
                              color: '#64748b',
                              stepSize: 1,
                              font: {
                                size: 11
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <p className="admin-empty">No subscription data available</p>
                )}
              </div>
            </div>
            <div className="admin-cards-row full-width">
              <div className="admin-card">
                <h3>🏆 Top Active Users</h3>
                <div className="admin-top-users">
                  {dashboard.topUsers?.map((item, i) => (
                    <div key={item._id} className="admin-top-user">
                      <span className="admin-rank">#{i + 1}</span>
                      <img src={item.user?.picture || '/default-avatar.png'} alt="" className="admin-user-avatar" />
                      <div className="admin-user-info">
                        <span className="admin-user-name">{item.user?.name}</span>
                        <span className="admin-user-email">{item.user?.email}</span>
                      </div>
                      <span className="admin-user-count">{item.trackingCount} tracked</span>
                    </div>
                  ))}
                  {(!dashboard.topUsers || dashboard.topUsers.length === 0) && (
                    <p className="admin-empty">No activity yet</p>
                  )}
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="admin-users">
            <div className="admin-page-header">
              <div>
                <h1>Users Management</h1>
                <p className="admin-subtitle">Manage all registered users</p>
              </div>
              <button className="admin-reload-btn" onClick={handleReload} disabled={reloading}>
                {reloading ? <span className="admin-spinner"></span> : '🔄'} Refresh
              </button>
            </div>

            <div className="admin-users-toolbar">
              <div className="admin-search">
                <input type="text" placeholder="Search by name or email..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
                <button onClick={() => loadUsers(1)}>🔍</button>
              </div>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}>
                <option value="all">All Users</option>
                <option value="active">Active Only</option>
                <option value="deactivated">Deactivated Only</option>
              </select>
            </div>

            {loading ? (
              <div className="admin-loader-container">
                <div className="admin-spinner-large"></div>
                <p>Loading users...</p>
              </div>
            ) : (
              <div className="admin-users-table-container">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Habits</th>
                      <th>Joined</th>
                      <th>Subscribed On</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                    <tr key={user._id} className={!user.isActive ? 'deactivated' : ''}>
                      <td>
                        <div className="admin-user-cell">
                          <img src={user.picture || '/default-avatar.png'} alt="" />
                          <span>{user.name}</span>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.habitCount}</td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        {user.subscriptionStatus === 'active' && user.subscriptionDate ? (
                          <span className="admin-sub-date">{formatDate(user.subscriptionDate)}</span>
                        ) : user.subscriptionStatus === 'pending' ? (
                          <span className="admin-status-badge pending">Pending</span>
                        ) : (
                          <span className="admin-text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`admin-status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                          {user.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions">
                          <button className="admin-action-btn email" onClick={() => openEmailPopup(user)} title="Send Email">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                              <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                          </button>
                          <button className={`admin-action-btn ${user.isActive ? 'deactivate' : 'activate'}`} onClick={() => toggleUserStatus(user._id, user.isActive)} title={user.isActive ? 'Deactivate' : 'Activate'}>
                            {user.isActive ? '🚫' : '✅'}
                          </button>
                          <button className="admin-action-btn delete" onClick={() => deleteUser(user._id, user.name)} title="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && <p className="admin-empty">No users found</p>}
              </div>
            )}

            {usersPagination.pages > 1 && (
              <div className="admin-pagination">
                <button disabled={usersPagination.currentPage === 1} onClick={() => loadUsers(usersPagination.currentPage - 1)}>← Prev</button>
                <span>Page {usersPagination.currentPage} of {usersPagination.pages}</span>
                <button disabled={usersPagination.currentPage === usersPagination.pages} onClick={() => loadUsers(usersPagination.currentPage + 1)}>Next →</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="admin-subscriptions">
            <div className="admin-page-header">
              <div>
                <h1>Subscription Management</h1>
                <p className="admin-subtitle">Manage subscription requests and track all user subscriptions</p>
              </div>
              <button className="admin-reload-btn" onClick={handleReload} disabled={reloading}>
                {reloading ? <span className="admin-spinner"></span> : '🔄'} Refresh
              </button>
            </div>

            {/* Subscription Tabs */}
            <div className="admin-subscription-tabs">
              <button 
                className={`admin-tab ${subscriptionTab === 'all' ? 'active' : ''}`}
                onClick={() => setSubscriptionTab('all')}
              >
                All Subscriptions
                <span className="admin-tab-count">{allSubscriptions.length}</span>
              </button>
              <button 
                className={`admin-tab ${subscriptionTab === 'pending' ? 'active' : ''}`}
                onClick={() => setSubscriptionTab('pending')}
              >
                New Requests
                <span className="admin-tab-count">{pendingSubscriptions.length}</span>
              </button>
            </div>

            {/* All Subscriptions Tab */}
            {subscriptionTab === 'all' && (
              <div className="admin-tab-content">
                {allSubscriptions.length === 0 ? (
                  <div className="admin-empty-state">
                    <div className="admin-empty-icon">📋</div>
                    <h3>No Subscriptions Found</h3>
                    <p>No users have subscribed yet.</p>
                  </div>
                ) : (
                  <div className="admin-table-wrapper">
                    <table className="admin-subscriptions-table">
                      <thead>
                        <tr>
                          <th style={{width: '250px'}}>User</th>
                          <th style={{width: '120px'}}>Status</th>
                          <th style={{width: '140px'}}>Subscribed</th>
                          <th style={{width: '140px'}}>Expires</th>
                          <th style={{width: '100px'}}>Days Left</th>
                          <th style={{width: '150px'}}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allSubscriptions.map(user => (
                          <tr key={user._id}>
                            <td style={{width: '250px'}}>
                              <div className="admin-user-cell">
                                <img src={user.picture || '/default-avatar.png'} alt="" className="admin-table-avatar" />
                                <div>
                                  <div className="admin-user-name">{user.name}</div>
                                  <div className="admin-user-email">{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{width: '120px'}}>
                              <span className={`admin-status-badge ${user.subscriptionStatus} ${user.isPaused ? 'paused' : ''}`}>
                                {user.subscriptionStatus === 'active' && (user.isPaused ? 'Paused' : 'Active')}
                                {user.subscriptionStatus === 'expired' && 'Expired'}
                                {user.subscriptionStatus === 'pending' && 'Pending'}
                              </span>
                            </td>
                            <td style={{width: '140px'}}>
                              {user.subscriptionDate ? formatDate(user.subscriptionDate) : '-'}
                            </td>
                            <td style={{width: '140px'}}>
                              {user.subscriptionExpiry ? formatDate(user.subscriptionExpiry) : '-'}
                            </td>
                            <td style={{width: '100px'}}>
                              <span className={`admin-days-left ${user.daysLeft <= 30 ? 'warning' : user.daysLeft <= 7 ? 'danger' : 'normal'}`}>
                                {user.subscriptionStatus === 'active' ? `${user.daysLeft} days` : '-'}
                              </span>
                            </td>
                            <td style={{width: '150px'}}>
                              <div className="admin-table-actions">
                                {user.subscriptionStatus === 'active' && (
                                  user.isPaused ? (
                                    <button 
                                      className="admin-action-btn resume"
                                      onClick={() => resumeSubscription(user._id, user.name)}
                                      disabled={processingSubscription === user._id}
                                      title="Resume subscription"
                                    >
                                      {processingSubscription === user._id ? '⏳' : '▶️'}
                                    </button>
                                  ) : (
                                    <button 
                                      className="admin-action-btn pause"
                                      onClick={() => pauseSubscription(user._id, user.name)}
                                      disabled={processingSubscription === user._id}
                                      title="Pause subscription"
                                    >
                                      {processingSubscription === user._id ? '⏳' : '⏸️'}
                                    </button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Pending Requests Tab */}
            {subscriptionTab === 'pending' && (
              <div className="admin-tab-content">
                {subscriptionsLoading ? (
                  <div className="admin-loader-container">
                    <div className="admin-spinner-large"></div>
                    <p>Loading subscriptions...</p>
                  </div>
                ) : pendingSubscriptions.length === 0 ? (
                  <div className="admin-empty-state">
                    <div className="admin-empty-icon">✅</div>
                    <h3>No Pending Subscriptions</h3>
                    <p>All subscription requests have been processed.</p>
                  </div>
                ) : (
                  <div className="admin-subscriptions-grid">
                    {pendingSubscriptions.map(user => (
                      <div key={user._id} className="admin-subscription-card">
                        <div className="admin-subscription-header">
                          <img src={user.picture || '/default-avatar.png'} alt="" className="admin-subscription-avatar" />
                          <div className="admin-subscription-info">
                            <h4>{user.name}</h4>
                            <p>{user.email}</p>
                            <span className="admin-subscription-date">Submitted: {formatDate(user.createdAt)}</span>
                          </div>
                        </div>
                        
                        <div className="admin-subscription-screenshot">
                          <h5>Payment Screenshot</h5>
                          {user.paymentScreenshot ? (
                            <div className="admin-screenshot-container">
                              <img 
                                src={user.paymentScreenshot} 
                                alt="Payment Screenshot" 
                                onClick={() => setImagePreview(user.paymentScreenshot)}
                              />
                              <button className="admin-view-btn" onClick={() => setImagePreview(user.paymentScreenshot)}>
                                🔍 View Full Size
                              </button>
                            </div>
                          ) : (
                            <div className="admin-no-screenshot">
                              <span>⚠️</span>
                              <p>No screenshot uploaded</p>
                            </div>
                          )}
                        </div>

                        <div className="admin-subscription-actions">
                          <button 
                            className="admin-btn approve" 
                            onClick={() => approveSubscription(user._id, user.name)}
                            disabled={processingSubscription === user._id}
                          >
                            {processingSubscription === user._id ? <><span className="admin-spinner"></span> Processing...</> : 'Approve'}
                          </button>
                          <button 
                            className="admin-btn reject" 
                            onClick={() => rejectSubscription(user._id)}
                            disabled={processingSubscription === user._id}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Image Preview Modal */}
        {imagePreview && (
          <div className="admin-image-preview-overlay" onClick={() => setImagePreview(null)}>
            <div className="admin-image-preview-container" onClick={e => e.stopPropagation()}>
              <button className="admin-image-preview-close" onClick={() => setImagePreview(null)}>×</button>
              <img src={imagePreview} alt="Payment Screenshot" />
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default AdminPanel;
