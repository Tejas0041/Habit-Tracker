import React, { useState, useEffect, useCallback, createContext } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import api from './api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WEEK_COLORS = ['#8dd3c7', '#bebada', '#fb8072', '#80b1d3', '#fdb462'];
const ThemeContext = createContext();

const getIndianDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const istDate = new Date(utc + istOffset);
  return { year: istDate.getFullYear(), month: istDate.getMonth() + 1, day: istDate.getDate() };
};

const Popup = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', type = 'confirm' }) => {
  if (!isOpen) return null;
  return (
    <div className="popup-overlay">
      <div className="popup">
        <div className={`popup-icon ${type}`}>{type === 'warning' ? '⚠️' : type === 'success' ? '✅' : '❓'}</div>
        <h3 className="popup-title">{title}</h3>
        <p className="popup-message">{message}</p>
        <div className="popup-buttons">
          {onCancel && <button className="popup-btn cancel" onClick={onCancel}>{cancelText}</button>}
          <button className="popup-btn confirm" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

const Toast = ({ show, message, type = 'error' }) => {
  if (!show) return null;
  return (<div className={`toast ${type}`}><span className="toast-icon">{type === 'error' ? '⚠️' : '✅'}</span>{message}</div>);
};

const Loader = ({ message = 'Loading...', subtext = '' }) => {
  return (
    <div className="loader-overlay">
      <div className="loader-container">
        <div className="loader">
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
        </div>
        <div className="loader-text">{message}</div>
        {subtext && <div className="loader-subtext">{subtext}</div>}
      </div>
    </div>
  );
};

const DailyBar = ({ day, dayName, completed, goal, color }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const percent = goal ? Math.round((completed / goal) * 100) : 0;
  const height = goal ? (completed / goal) * 100 : 0;
  
  return (
    <div 
      className="bar-wrapper" 
      onMouseEnter={() => setShowTooltip(true)} 
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="daily-bar" style={{ height: `${height}%`, backgroundColor: color }}>
        {showTooltip && (
          <div className="bar-tooltip">
            <div className="bar-tooltip-title">Day {day} ({dayName})</div>
            <div className="bar-tooltip-row"><span>Completed:</span><span>{completed}/{goal}</span></div>
            <div className="bar-tooltip-row"><span>Progress:</span><span>{percent}%</span></div>
          </div>
        )}
      </div>
    </div>
  );
};


const ProfilePage = ({ user, token, onBack, onUpdateUser, showToast }) => {
  const [name, setName] = useState(user.name || '');
  const [dob, setDob] = useState(user.dob ? user.dob.split('T')[0] : '');
  const [gender, setGender] = useState(user.gender || '');
  const [saving, setSaving] = useState(false);

  const originalData = { name: user.name || '', dob: user.dob ? user.dob.split('T')[0] : '', gender: user.gender || '' };
  const hasChanges = name !== originalData.name || dob !== originalData.dob || gender !== originalData.gender;

  const calculateAge = () => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
    return `${day}${suffix} ${month}, ${year}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.put('/auth/profile', { name: name || null, dob: dob || null, gender: gender || null }, token);
      onUpdateUser(updated);
      showToast('Profile updated!', 'success');
    } catch (err) { showToast('Failed to update', 'error'); }
    setSaving(false);
  };

  const age = calculateAge();

  return (
    <div className="profile-page">
      <button className="back-btn" onClick={onBack}>← Back to Dashboard</button>
      <div className="profile-container">
        <div className="profile-header-card">
          <div className="profile-avatar-section">
            {user.picture ? <img src={user.picture} alt="" className="profile-avatar" /> : <div className="profile-avatar-placeholder">{user.name?.charAt(0)}</div>}
            <div className="profile-info">
              <h1 className="profile-name">{user.name}</h1>
              <p className="profile-email">{user.email}</p>
              {age && <p className="profile-age">{age} years old</p>}
            </div>
          </div>
        </div>
        <div className="profile-cards">
          <div className="profile-card full-width">
            <h3>👤 Personal Information</h3>
            <div className="profile-form">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {age && (
                <div className="form-group">
                  <label>Age</label>
                  <div className="age-display">{age} years</div>
                </div>
              )}
              {hasChanges && <button className="save-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>}
            </div>
          </div>
          <div className="profile-card">
            <h3>📅 Current Date (IST)</h3>
            <div className="date-display">
              <div className="date-item">
                <span className="date-value">{getIndianDate().day}</span>
                <span className="date-label">{MONTHS[getIndianDate().month - 1]}</span>
              </div>
              <div className="date-item">
                <span className="date-value">{getIndianDate().year}</span>
                <span className="date-label">Year</span>
              </div>
            </div>
          </div>
          <div className="profile-card">
            <h3>📊 Account Info</h3>
            <div className="account-info">
              <div className="info-row">
                <span className="info-label">Member Since</span>
                <span className="info-value">{formatDate(user.createdAt || Date.now())}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [habits, setHabits] = useState([]);
  const [tracking, setTracking] = useState({});
  const [streaks, setStreaks] = useState({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [showModal, setShowModal] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', goal: 30 });
  const [activeTab, setActiveTab] = useState('tracker');
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearInput, setShowYearInput] = useState(false);
  const [yearInput, setYearInput] = useState(year);
  const [showProfile, setShowProfile] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const [topHabitsView, setTopHabitsView] = useState('current'); // 'current' or 'overall'
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [popup, setPopup] = useState({ isOpen: false, title: '', message: '', onConfirm: null, onCancel: null, type: 'confirm' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tabsVisible, setTabsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [serverReady, setServerReady] = useState(false);
  const [checkingServer, setCheckingServer] = useState(true);
  const [loading, setLoading] = useState(false);

  const daysInMonth = new Date(year, month, 0).getDate();

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); }, [theme]);
  
  // Server health check
  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/health`);
        if (response.ok) {
          setServerReady(true);
        }
      } catch (error) {
        console.log('Server not ready, retrying...');
        setTimeout(checkServer, 2000); // Retry after 2 seconds
      } finally {
        setCheckingServer(false);
      }
    };
    checkServer();
  }, []);
  
  // Scroll behavior for tabs bar
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setTabsVisible(false); // scrolling down
      } else {
        setTabsVisible(true); // scrolling up
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);
  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  const showToast = (message, type = 'error') => { setToast({ show: true, message, type }); setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 3000); };
  const showPopup = (title, message, onConfirm, onCancel = null, type = 'confirm') => setPopup({ isOpen: true, title, message, onConfirm, onCancel, type });
  const closePopup = () => setPopup({ ...popup, isOpen: false });
  const isFutureDate = (y, m, d) => { const indian = getIndianDate(); return new Date(y, m - 1, d) > new Date(indian.year, indian.month - 1, indian.day); };

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [habitsRes, trackingRes] = await Promise.all([api.get(`/habits?year=${year}&month=${month}`, token), api.get(`/tracking/${year}/${month}`, token)]);
      setHabits(habitsRes);
      const trackMap = {}; 
      trackingRes.forEach(t => { trackMap[`${t.habitId}-${t.date}`] = true; }); 
      setTracking(trackMap);
      
      // Load streaks for selected month with individual error handling
      const streakData = {}; 
      await Promise.all(habitsRes.map(async (h) => {
        try {
          const streakResult = await api.get(`/tracking/streaks/${h._id}/${year}/${month}`, token); 
          streakData[h._id] = streakResult || { currentStreak: 0, longestStreak: 0 }; 
        } catch (e) {
          console.error(`Failed to load streak for ${h.name}:`, e);
          streakData[h._id] = { currentStreak: 0, longestStreak: 0 };
        }
      }));
      setStreaks(streakData);
    } catch (err) { 
      console.error('Error loading data:', err); 
    } finally {
      setLoading(false);
    }
  }, [token, year, month]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const stored = localStorage.getItem('user'); if (stored) setUser(JSON.parse(stored)); }, []);
  useEffect(() => { const h = (e) => { if (!e.target.closest('.month-selector')) { setShowMonthDropdown(false); setShowYearInput(false); } }; document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);

  const handleLogin = async (cred) => { 
    setLoading(true);
    try { 
      const res = await api.post('/auth/google', { credential: cred.credential }); 
      setToken(res.token); 
      setUser(res.user); 
      localStorage.setItem('token', res.token); 
      localStorage.setItem('user', JSON.stringify(res.user)); 
      showToast('Welcome!', 'success'); 
    } catch { 
      showToast('Login failed', 'error'); 
    } finally {
      setLoading(false);
    }
  };
  const handleLogout = () => showPopup('Logout', 'Are you sure?', () => { setToken(null); setUser(null); setHabits([]); setTracking({}); localStorage.removeItem('token'); localStorage.removeItem('user'); closePopup(); }, closePopup, 'warning');
  const handleUpdateUser = (u) => { setUser(u); localStorage.setItem('user', JSON.stringify(u)); };


  const toggleHabit = async (habitId, day) => { 
    if (isFutureDate(year, month, day)) { showToast("Can't mark future dates!", 'error'); return; } 
    const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`; 
    const key = `${habitId}-${date}`; 
    const newCompleted = !tracking[key];
    setTracking(prev => ({ ...prev, [key]: newCompleted })); 
    await api.post('/tracking/toggle', { habitId, date, completed: newCompleted }, token); 
    // Reload streak for this habit (month-specific)
    try {
      const updatedStreak = await api.get(`/tracking/streaks/${habitId}/${year}/${month}`, token);
      setStreaks(prev => ({ ...prev, [habitId]: updatedStreak }));
    } catch (err) {
      console.error('Failed to update streak:', err);
    }
  };
  const addHabit = async () => { if (!newHabit.name.trim()) { showToast('Enter habit name', 'error'); return; } await api.post('/habits', newHabit, token); setNewHabit({ name: '', goal: 30 }); setShowModal(false); loadData(); showToast('Habit added!', 'success'); };
  const updateGoal = async (habitId, goal) => { const g = parseInt(goal) || 0; setHabits(prev => prev.map(h => h._id === habitId ? { ...h, goal: g } : h)); await api.put(`/habits/${habitId}/goal`, { year, month, goal: g }, token); };
  const deleteHabit = (habitId) => { const h = habits.find(x => x._id === habitId); showPopup('Delete', `Delete "${h?.name}"?`, async () => { await api.delete(`/habits/${habitId}`, token); loadData(); closePopup(); showToast('Deleted', 'success'); }, closePopup, 'warning'); };

  const getCompleted = (habitId) => { let c = 0; for (let d = 1; d <= daysInMonth; d++) { if (tracking[`${habitId}-${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`]) c++; } return c; };
  const getDayName = (d) => DAYS[new Date(year, month - 1, d).getDay()];
  const getWeekNumber = (d) => Math.floor((d - 1) / 7);
  const handleMonthChange = (m) => { setMonth(m); setShowMonthDropdown(false); };
  const handleYearSubmit = (e) => { e.preventDefault(); const y = parseInt(yearInput); if (y >= 2020 && y <= 2030) setYear(y); setShowYearInput(false); };
  const handlePrevMonth = () => { if (month > 1) setMonth(month - 1); else { setMonth(12); setYear(year - 1); } };
  const handleNextMonth = () => { if (month < 12) setMonth(month + 1); else { setMonth(1); setYear(year + 1); } };

  const getDailyData = () => { const data = []; for (let d = 1; d <= daysInMonth; d++) { const date = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`; let c = 0; habits.forEach(h => { if (tracking[`${h._id}-${date}`]) c++; }); data.push({ day: d, dayName: getDayName(d), completed: c, goal: habits.length, left: habits.length - c, week: getWeekNumber(d) }); } return data; };
  const getWeeklyData = () => { const daily = getDailyData(); const weeks = []; for (let w = 0; w < 5; w++) { const days = daily.filter(d => d.week === w); if (!days.length) continue; const c = days.reduce((s, d) => s + d.completed, 0); const t = days.reduce((s, d) => s + d.goal, 0); weeks.push({ name: `Week ${w + 1}`, completed: c, total: t, percent: t ? Math.round((c / t) * 100) : 0, days, startDay: days[0].day, endDay: days[days.length - 1].day }); } return weeks; };
  const getTotalStats = () => { let c = 0, g = 0; habits.forEach(h => { c += getCompleted(h._id); g += h.goal; }); return { completed: c, goal: g, left: Math.max(0, g - c), percent: g ? Math.round((c / g) * 100) : 0 }; };
  const getHabitStats = () => habits.map(h => { 
    const c = getCompleted(h._id); 
    const s = streaks[h._id] || { currentStreak: 0, longestStreak: 0 }; 
    return { 
      ...h, 
      completed: c, 
      left: Math.max(0, h.goal - c), 
      percent: h.goal ? Math.round((c / h.goal) * 100) : 0, 
      currentStreak: s.currentStreak !== undefined ? s.currentStreak : 0, 
      longestStreak: s.longestStreak !== undefined ? s.longestStreak : 0 
    }; 
  });


  if (!token) return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="home-page" data-theme={theme}>
        <Toast {...toast} />
        {loading && <Loader message="Logging in..." />}
        <header className="home-header">
          <div className="home-logo">
            <img src="/habits.png" alt="Habit Tracker" className="logo-icon" />
            <span>Habit Tracker</span>
          </div>
          <button className="theme-toggle-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
        </header>
        
        <section className="hero-section">
          <div className="hero-content">
            <h1>Build Better Habits,<br/>One Day at a Time</h1>
            <p className="hero-subtitle">Track your daily habits, visualize your progress, and achieve your goals with our simple yet powerful habit tracking app.</p>
            <div className="hero-login">
              <div className="google-signin-wrapper">
                <div className={!serverReady ? 'google-signin-disabled' : ''}>
                  {!serverReady && <div className="signin-tooltip">⏳ Server is waking up, please wait...</div>}
                  <GoogleLogin onSuccess={handleLogin} onError={() => showToast('Login Failed', 'error')} />
                </div>
                {!serverReady && <div className="signin-loader"></div>}
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-card">
              <div className="hero-habit-row"><span className="hero-check done">✓</span> Morning Exercise</div>
              <div className="hero-habit-row"><span className="hero-check done">✓</span> Read 30 mins</div>
              <div className="hero-habit-row"><span className="hero-check done">✓</span> Meditation</div>
              <div className="hero-habit-row"><span className="hero-check"></span> Learn coding</div>
            </div>
          </div>
        </section>

        <section className="features-section">
          <h2>Why Habit Tracker?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <h3>Daily Tracking</h3>
              <p>Mark your habits complete each day with a simple click. See your progress at a glance.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Weekly Overview</h3>
              <p>Visualize your weekly performance with beautiful charts and completion rates.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔥</div>
              <h3>Streak Tracking</h3>
              <p>Build momentum with streak tracking. See your current and best streaks for each habit.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Statistics</h3>
              <p>Detailed statistics help you understand your habits and improve over time.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Custom Goals</h3>
              <p>Set monthly goals for each habit and track your progress towards achieving them.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🌙</div>
              <h3>Dark Mode</h3>
              <p>Easy on the eyes with a beautiful dark mode. Switch anytime you want.</p>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <h2>Start Your Journey Today</h2>
          <p>Join thousands of users building better habits every day.</p>
          <div className="cta-login">
            <div className="google-signin-wrapper">
              <div className={!serverReady ? 'google-signin-disabled' : ''}>
                {!serverReady && <div className="signin-tooltip">⏳ Server is waking up, please wait...</div>}
                <GoogleLogin onSuccess={handleLogin} onError={() => showToast('Login Failed', 'error')} />
              </div>
              {!serverReady && <div className="signin-loader"></div>}
            </div>
          </div>
        </section>

        <footer className="home-footer">
          <p>Made by <a href="https://tejaspawar.vercel.app" target="_blank" rel="noopener noreferrer">Tejas Pawar</a></p>
        </footer>
      </div>
    </ThemeContext.Provider>
  );
  if (showProfile) return (<ThemeContext.Provider value={{ theme, toggleTheme }}><div className="app" data-theme={theme}><Toast {...toast} /><ProfilePage user={user} token={token} onBack={() => setShowProfile(false)} onUpdateUser={handleUpdateUser} showToast={showToast} /></div></ThemeContext.Provider>);
  
  if (showHome) return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="home-page" data-theme={theme}>
        <Toast {...toast} />
        <Popup {...popup} />
        <header className="home-header">
          <div className="home-logo">
            <img src="/habits.png" alt="Habit Tracker" className="logo-icon" />
            <span>Habit Tracker</span>
          </div>
          <div className="home-header-right-mobile">
            <button className="theme-toggle-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button className="hamburger-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            </button>
          </div>
          <div className="home-header-right">
            <button className="theme-toggle-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button className="back-to-app-btn" onClick={() => setShowHome(false)}>Back to App</button>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
          {mobileMenuOpen && (
            <div className="mobile-menu home-mobile-menu">
              <button className="mobile-menu-item" onClick={() => { setShowHome(false); setMobileMenuOpen(false); }}>Back to App</button>
              <button className="mobile-menu-item logout" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>Logout</button>
            </div>
          )}
        </header>
        
        <section className="hero-section">
          <div className="hero-content">
            <h1>Build Better Habits,<br/>One Day at a Time</h1>
            <p className="hero-subtitle">Track your daily habits, visualize your progress, and achieve your goals with our simple yet powerful habit tracking app.</p>
          </div>
          <div className="hero-visual">
            <div className="hero-card">
              <div className="hero-habit-row"><span className="hero-check done">✓</span> Morning Exercise</div>
              <div className="hero-habit-row"><span className="hero-check done">✓</span> Read 30 mins</div>
              <div className="hero-habit-row"><span className="hero-check done">✓</span> Meditation</div>
              <div className="hero-habit-row"><span className="hero-check"></span> Learn coding</div>
            </div>
          </div>
        </section>

        <section className="features-section">
          <h2>Why Habit Tracker?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <h3>Daily Tracking</h3>
              <p>Mark your habits complete each day with a simple click. See your progress at a glance.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Weekly Overview</h3>
              <p>Visualize your weekly performance with beautiful charts and completion rates.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔥</div>
              <h3>Streak Tracking</h3>
              <p>Build momentum with streak tracking. See your current and best streaks for each habit.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Statistics</h3>
              <p>Detailed statistics help you understand your habits and improve over time.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Custom Goals</h3>
              <p>Set monthly goals for each habit and track your progress towards achieving them.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🌙</div>
              <h3>Dark Mode</h3>
              <p>Easy on the eyes with a beautiful dark mode. Switch anytime you want.</p>
            </div>
          </div>
        </section>

        <footer className="home-footer">
          <p>Made by <a href="https://tejaspawar.vercel.app" target="_blank" rel="noopener noreferrer">Tejas Pawar</a></p>
        </footer>
      </div>
    </ThemeContext.Provider>
  );

  const stats = getTotalStats(); const weeklyData = getWeeklyData(); const dailyData = getDailyData(); const habitStats = getHabitStats();
  const chartOpts = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color: theme === 'dark' ? '#94a3b8' : '#6b7280' }, grid: { color: theme === 'dark' ? '#334155' : '#e5e7eb' } }, x: { ticks: { color: theme === 'dark' ? '#94a3b8' : '#6b7280' }, grid: { color: theme === 'dark' ? '#334155' : '#e5e7eb' } } }, plugins: { legend: { display: false } } };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="app" data-theme={theme}>
        <Toast {...toast} />
        <Popup {...popup} />
        {loading && <Loader message="Loading your habits..." />}
        <header className="header">
          <div className="header-left">
            <img src="/habits.png" alt="Habit Tracker" className="logo-icon" />
            <h1 className="app-title">Habit Tracker</h1>
          </div>
          <div className="header-center">
            <div className="month-selector">
              <button className="nav-btn" onClick={handlePrevMonth}>‹</button>
              <div className="month-year-display">
                <span className="month-text clickable" onClick={(e) => { e.stopPropagation(); setShowMonthDropdown(!showMonthDropdown); setShowYearInput(false); }}>{MONTHS[month - 1]}</span>
                <span className="year-text clickable" onClick={(e) => { e.stopPropagation(); setShowYearInput(!showYearInput); setShowMonthDropdown(false); setYearInput(year); }}>{year}</span>
                {showMonthDropdown && <div className="month-dropdown">{MONTHS.map((m, i) => <div key={i} className={`month-option ${month === i + 1 ? 'active' : ''}`} onClick={() => handleMonthChange(i + 1)}>{m}</div>)}</div>}
                {showYearInput && <form className="year-input-form" onSubmit={handleYearSubmit} onClick={e => e.stopPropagation()}><input type="number" value={yearInput} onChange={e => setYearInput(e.target.value)} min="2020" max="2030" autoFocus /><button type="submit">Go</button></form>}
              </div>
              <button className="nav-btn" onClick={handleNextMonth}>›</button>
            </div>
          </div>
          <div className="header-right-mobile">
            <button className="theme-toggle-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button className="hamburger-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            </button>
          </div>
          <div className="header-right">
            <button className="home-nav-btn" onClick={() => setShowHome(true)}>Home</button>
            <button className="theme-toggle-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            {user && <div className="user-info" onClick={() => setShowProfile(true)}>{user.picture && <img src={user.picture} alt="" />}<span>{user.name}</span></div>}
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
          {mobileMenuOpen && (
            <div className="mobile-menu">
              <button className="mobile-menu-item" onClick={() => { setShowHome(true); setMobileMenuOpen(false); }}>Home</button>
              {user && <button className="mobile-menu-item" onClick={() => { setShowProfile(true); setMobileMenuOpen(false); }}>Profile</button>}
              <button className="mobile-menu-item logout" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>Logout</button>
            </div>
          )}
        </header>
        <div className="mobile-month-row">
          <div className="month-selector">
            <button className="nav-btn" onClick={handlePrevMonth}>‹</button>
            <div className="month-year-display">
              <span className="month-text clickable" onClick={(e) => { e.stopPropagation(); setShowMonthDropdown(!showMonthDropdown); setShowYearInput(false); }}>{MONTHS[month - 1]}</span>
              <span className="year-text clickable" onClick={(e) => { e.stopPropagation(); setShowYearInput(!showYearInput); setShowMonthDropdown(false); setYearInput(year); }}>{year}</span>
              {showMonthDropdown && <div className="month-dropdown">{MONTHS.map((m, i) => <div key={i} className={`month-option ${month === i + 1 ? 'active' : ''}`} onClick={() => handleMonthChange(i + 1)}>{m}</div>)}</div>}
              {showYearInput && <form className="year-input-form" onSubmit={handleYearSubmit} onClick={e => e.stopPropagation()}><input type="number" value={yearInput} onChange={e => setYearInput(e.target.value)} min="2020" max="2030" autoFocus /><button type="submit">Go</button></form>}
            </div>
            <button className="nav-btn" onClick={handleNextMonth}>›</button>
          </div>
        </div>
        <div className="gradient-line"></div>
        <nav className={`tabs-bar ${tabsVisible ? '' : 'hidden'}`}>
          <button className={activeTab === 'tracker' ? 'active' : ''} onClick={() => setActiveTab('tracker')}>📋 Tracker</button>
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>📊 Overview</button>
          <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>📈 Stats</button>
        </nav>

        <div className="main-content">
          {activeTab === 'tracker' && (
            <div className="tracker-view">
              <div className="page-header">
                <div>
                  <h2>{MONTHS[month - 1]} {year}</h2>
                  <p className="page-subtitle">Track your daily habits</p>
                </div>
                <button className="add-habit-btn" onClick={() => setShowModal(true)}>+ Add Habit</button>
              </div>
              <div className="card habits-grid"><div style={{ overflowX: 'auto' }}>
                <table className="habits-table">
                  <thead><tr><th className="habit-name-cell">Habit</th><th>Goal</th>{Array.from({ length: daysInMonth }, (_, i) => <th key={i} className={`day-cell ${isFutureDate(year, month, i + 1) ? 'future-day' : ''}`}><div className="day-header"><span className="day-name">{getDayName(i + 1).slice(0, 2)}</span><span className="day-num">{i + 1}</span></div></th>)}<th>Done</th><th></th></tr></thead>
                  <tbody>{habits.map(h => <tr key={h._id}><td className="habit-name-cell"><div className="habit-name"><span className="habit-color" style={{ background: h.color }} />{h.name}</div></td><td><input type="number" className="goal-input" value={h.goal} onChange={e => updateGoal(h._id, e.target.value)} min="0" /></td>{Array.from({ length: daysInMonth }, (_, i) => { const date = `${year}-${String(month).padStart(2,'0')}-${String(i + 1).padStart(2,'0')}`; const checked = !!tracking[`${h._id}-${date}`]; const future = isFutureDate(year, month, i + 1); return <td key={i} className={`day-cell ${future ? 'future-day' : ''}`}><div className={`check-box ${checked ? 'checked' : ''} ${future ? 'disabled' : ''}`} onClick={() => toggleHabit(h._id, i + 1)}>{checked && '✓'}</div></td>; })}<td className="done-cell">{getCompleted(h._id)}</td><td><button className="delete-btn" onClick={() => deleteHabit(h._id)}>×</button></td></tr>)}</tbody>
                </table>
              </div></div>
            </div>
          )}
          {activeTab === 'overview' && (
            <div className="overview-view">
              <div className="page-header">
                <div>
                  <h2>{MONTHS[month - 1]} {year} - Weekly Overview</h2>
                  <p className="page-subtitle">Daily completion rates organized by week</p>
                </div>
              </div>
              <div className="card weekly-overview-card"><h3>WEEKLY OVERVIEW</h3>
              <div className="week-headers-container"><div className="week-label-spacer"></div><div className="week-headers">{weeklyData.map((w, i) => <div key={i} className="week-header" style={{ backgroundColor: WEEK_COLORS[i], gridColumn: `${w.startDay} / ${w.endDay + 1}` }}>{w.name.toUpperCase()}</div>)}</div></div>
              <div className="day-labels-container"><div className="overview-label-cell"></div><div className="day-labels">{dailyData.map((d, i) => <div key={i} className="day-label" style={{ backgroundColor: `${WEEK_COLORS[d.week]}40` }}><span className="day-abbr">{d.dayName.slice(0, 3)}</span><span className="day-number">{d.day}</span></div>)}</div></div>
              <div className="daily-bars-container"><div className="overview-label-cell"><div className="global-stat">GLOBAL</div><div className="global-value">{stats.completed}/{stats.goal}</div><div className="global-percent">{stats.percent}%</div></div><div className="daily-bars">{dailyData.map((d, i) => <DailyBar key={i} day={d.day} dayName={d.dayName} completed={d.completed} goal={d.goal} color={WEEK_COLORS[d.week]} />)}</div></div>
              <div className="stats-row-container"><div className="overview-label-cell">DONE</div><div className="stats-cells">{dailyData.map((d, i) => <div key={i} className="stat-cell">{d.completed}</div>)}</div></div>
              <div className="stats-row-container"><div className="overview-label-cell">GOAL</div><div className="stats-cells">{dailyData.map((d, i) => <div key={i} className="stat-cell">{d.goal}</div>)}</div></div>
              <div className="stats-row-container"><div className="overview-label-cell">LEFT</div><div className="stats-cells">{dailyData.map((d, i) => <div key={i} className="stat-cell">{d.left}</div>)}</div></div>
              <div className="weekly-progress-container"><div className="overview-label-cell">WEEKLY</div><div className="weekly-progress-cells">{weeklyData.map((w, i) => <div key={i} className="weekly-progress-cell" style={{ gridColumn: `${w.startDay} / ${w.endDay + 1}` }}><span>{w.completed}/{w.total}</span><span className="week-pct">{w.percent}%</span></div>)}</div></div>
            </div></div>
          )}

          {activeTab === 'stats' && (
            <div className="stats-view">
              <div className="stats-header">
                <h2>{MONTHS[month - 1]} {year} Statistics</h2>
                <p className="stats-subtitle">Overview of your habit completion for this month</p>
              </div>
              <div className="stats-grid">
                <div className="card stats-summary">
                  <h3>Monthly Summary</h3>
                  <div className="summary-stats">
                    <div className="summary-item">
                      <div className="summary-value">{stats.completed}</div>
                      <div className="summary-label">Completed</div>
                      <small className="summary-help">Total habits done</small>
                    </div>
                    <div className="summary-item">
                      <div className="summary-value">{stats.goal}</div>
                      <div className="summary-label">Total Goal</div>
                      <small className="summary-help">{habits.length} habits × their goals</small>
                    </div>
                    <div className="summary-item">
                      <div className="summary-value">{stats.left}</div>
                      <div className="summary-label">Remaining</div>
                      <small className="summary-help">Still to complete</small>
                    </div>
                    <div className="summary-item highlight">
                      <div className="summary-value">{stats.percent}%</div>
                      <div className="summary-label">Success Rate</div>
                      <small className="summary-help">Overall completion</small>
                    </div>
                  </div>
                </div>
                <div className="card donut-card">
                  <h3>Overall Progress</h3>
                  <div className="donut-container">
                    <Doughnut data={{ labels: ['Completed', 'Remaining'], datasets: [{ data: [stats.completed, Math.max(0, stats.goal - stats.completed)], backgroundColor: ['#4ade80', theme === 'dark' ? '#334155' : '#e5e7eb'], borderWidth: 0 }] }} options={{ cutout: '75%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} habits` } } } }} />
                    <div className="donut-center"><span className="donut-percent">{stats.percent}%</span><span className="donut-sublabel">Complete</span></div>
                  </div>
                </div>
              </div>
              <div className="card habit-stats-card">
                <h3>Individual Habit Performance</h3>
                <table className="habit-stats-table">
                  <thead><tr><th>Habit</th><th>Goal</th><th>Completed</th><th>Remaining</th><th>%</th><th className="progress-col">Progress</th><th>Current Streak</th><th>Best Streak</th></tr></thead>
                  <tbody>{habitStats.map(h => <tr key={h._id}><td className="habit-name-cell"><span className="habit-color" style={{ background: h.color }} />{h.name}</td><td className="goal-cell">{h.goal}</td><td>{h.completed}</td><td>{h.left}</td><td>{h.percent}%</td><td className="progress-col"><div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(100, h.percent)}%` }} /></div></td><td><span className="streak-badge current">{h.currentStreak} 🔥</span></td><td><span className="streak-badge longest">{h.longestStreak} ⭐</span></td></tr>)}</tbody>
                </table>
              </div>
              <div className="card">
                <h3>Daily Completion Trend</h3>
                <p className="chart-subtitle">Track your daily completion percentage throughout the month</p>
                <div className="bar-chart-container">
                  <Line 
                    data={{ 
                      labels: dailyData.map(d => d.day), 
                      datasets: [{ 
                        label: 'Completion %',
                        data: dailyData.map(d => d.goal ? Math.round((d.completed / d.goal) * 100) : 0), 
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
                      ...chartOpts,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => {
                              const day = dailyData[ctx.dataIndex];
                              return [
                                `Day ${day.day}: ${ctx.parsed.y}%`,
                                `Completed: ${day.completed}/${day.goal} habits`
                              ];
                            }
                          }
                        },
                        filler: {
                          propagate: true
                        }
                      }
                    }} 
                  />
                </div>
              </div>
              <div className="card top-habits-card">
                <div className="top-habits-header">
                  <div>
                    <h3>Top 10 Daily Habits</h3>
                    <p className="chart-subtitle">Best performing habits</p>
                  </div>
                  <div className="top-habits-toggle">
                    <button 
                      className={topHabitsView === 'current' ? 'active' : ''} 
                      onClick={() => setTopHabitsView('current')}
                    >
                      Current Month
                    </button>
                    <button 
                      className={topHabitsView === 'overall' ? 'active' : ''} 
                      onClick={() => setTopHabitsView('overall')}
                    >
                      Overall
                    </button>
                  </div>
                </div>
                <div className="top-habits-list">
                  {habitStats
                    .sort((a, b) => b.percent - a.percent)
                    .slice(0, 10)
                    .map((h, i) => (
                      <div key={h._id} className="top-habit-item">
                        <div className="top-habit-rank">{i + 1}</div>
                        <div className="top-habit-info">
                          <div className="top-habit-name">
                            <span className="habit-color" style={{ background: h.color }} />
                            {h.name}
                          </div>
                          <div className="top-habit-stats">
                            {topHabitsView === 'current' 
                              ? `${h.completed}/${h.goal} completed this month` 
                              : `${h.percent}% overall completion`}
                          </div>
                        </div>
                        <div className="top-habit-percent">{h.percent}%</div>
                      </div>
                    ))}
                  {habitStats.length === 0 && (
                    <div className="empty-state">No habits tracked this month</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Add New Habit</h2>
              <div className="modal-form">
                <div className="modal-form-group">
                  <label>Habit Name</label>
                  <input placeholder="e.g., Morning Exercise" value={newHabit.name} onChange={e => setNewHabit({ ...newHabit, name: e.target.value })} />
                </div>
                <div className="modal-form-group">
                  <label>Monthly Goal (days)</label>
                  <input type="number" placeholder="30" value={newHabit.goal} onChange={e => setNewHabit({ ...newHabit, goal: parseInt(e.target.value) || 0 })} />
                  <small>How many days per month do you want to complete this habit?</small>
                </div>
              </div>
              <div className="modal-buttons">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={addHabit}>Add Habit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
