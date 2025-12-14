import React, { useState, useEffect, useCallback, createContext } from 'react';
import ReactDOM from 'react-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import api from './api';
import SubscriptionPopup from './SubscriptionPopup';

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

const NotesCell = ({ notes, entryId, expandedNotes, setExpandedNotes }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const isExpanded = expandedNotes.has(entryId);
  const hasNotes = notes && notes.trim();
  const MAX_LENGTH = 25;
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  if (!hasNotes) return <span className="notes-empty">-</span>;
  
  const isTruncated = notes.length > MAX_LENGTH;
  const truncatedText = isTruncated ? notes.substring(0, MAX_LENGTH) + '...' : notes;
  
  const toggleExpanded = () => {
    if (!isTruncated) return;
    if (isMobile) {
      const newExpanded = new Set(expandedNotes);
      if (isExpanded) {
        newExpanded.delete(entryId);
      } else {
        newExpanded.add(entryId);
      }
      setExpandedNotes(newExpanded);
    }
  };
  
  const handleMouseEnter = (e) => {
    if (isMobile) return;
    const rect = e.target.getBoundingClientRect();
    setTooltipPos({ x: rect.left, y: rect.top });
    setShowTooltip(true);
  };
  
  if (!isTruncated) {
    return <span className="notes-short">{notes}</span>;
  }
  
  return (
    <div className="notes-cell-wrapper">
      <span 
        className="notes-text truncated"
        onClick={toggleExpanded}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {truncatedText}
      </span>
      {showTooltip && !isMobile && ReactDOM.createPortal(
        <div 
          className="notes-tooltip-custom"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          {notes}
        </div>,
        document.body
      )}
      {isExpanded && isMobile && ReactDOM.createPortal(
        <div className="notes-expanded-overlay" onClick={toggleExpanded}>
          <div className="notes-expanded-content" onClick={e => e.stopPropagation()}>
            <div className="notes-expanded-header">
              <span>📝 Notes</span>
              <button className="notes-close-btn" onClick={toggleExpanded}>✕</button>
            </div>
            <div className="notes-expanded-text">{notes}</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const Popup = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', type = 'confirm' }) => {
  if (!isOpen) return null;
  return (
    <div className="popup-overlay">
      <div className="popup">
        <div className={`popup-icon ${type}`}>{type === 'warning' ? '⚠️' : type === 'success' ? '✅' : type === 'info' ? 'ℹ️' : '❓'}</div>
        <h3 className="popup-title">{title}</h3>
        <p className="popup-message" style={{ whiteSpace: 'pre-line', textAlign: 'left' }}>{message}</p>
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
  const icon = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  return (<div className={`toast ${type}`}><span className="toast-icon">{icon}</span>{message}</div>);
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

const DatePicker = ({ value, onChange, onClose, month, year, sleepData, sleepType }) => {
  const dateObj = value ? new Date(value + 'T00:00:00') : new Date();
  const [selectedDay, setSelectedDay] = useState(dateObj.getDate());
  const dayScrollRef = React.useRef(null);

  const daysInMonth = new Date(year, month, 0).getDate();
  const maxDate = getIndianDate();
  const isCurrentMonth = year === maxDate.year && month === maxDate.month;
  const maxDay = isCurrentMonth ? maxDate.day : daysInMonth;

  useEffect(() => {
    if (dayScrollRef.current) {
      const dayElement = dayScrollRef.current.querySelector('.date-option.selected');
      if (dayElement) {
        dayElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, []);

  const handleConfirm = () => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    
    // Check if sleep already exists for this date (only for night sleep)
    if (sleepType === 'night') {
      const existingSleep = sleepData.find(s => s.date === dateStr && s.sleepType === 'night');
      if (existingSleep) {
        alert('Sleep already logged for this date. Please select a different date or edit the existing entry from the table.');
        return;
      }
    }
    
    onChange(dateStr);
    onClose();
  };

  const getDayName = (day) => {
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const isDateDisabled = (day) => {
    if (sleepType !== 'night') return false;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return sleepData.some(s => s.date === dateStr && s.sleepType === 'night');
  };

  return (
    <div className="time-picker-overlay" onClick={onClose}>
      <div className="time-picker-modal date-picker-modal" onClick={e => e.stopPropagation()}>
        <h3>📅 Select Date</h3>
        <div className="date-picker-header">
          <div className="date-picker-month-year">
            {MONTHS[month - 1]} {year}
          </div>
        </div>
        <div className="date-picker-wheel-container">
          <div className="date-wheel">
            <div className="date-wheel-scroll" ref={dayScrollRef}>
              {Array.from({ length: maxDay }, (_, i) => i + 1).map(day => {
                const disabled = isDateDisabled(day);
                return (
                  <div
                    key={day}
                    className={`date-option ${selectedDay === day ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                    onClick={() => !disabled && setSelectedDay(day)}
                    title={disabled ? 'Sleep already logged for this date' : ''}
                  >
                    <span className="date-day-num">{day}</span>
                    <span className="date-day-name">{getDayName(day)}</span>
                    {disabled && <span className="date-disabled-indicator">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="date-picker-preview">
          {getDayName(selectedDay)}, {selectedDay} {MONTHS[month - 1]} {year}
        </div>
        <div className="time-picker-buttons">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

const TimePicker = ({ value, onChange, onClose, label }) => {
  const [hours, minutes] = value.split(':').map(Number);
  const [selectedHour, setSelectedHour] = useState(hours);
  const [selectedMinute, setSelectedMinute] = useState(minutes);
  const hourScrollRef = React.useRef(null);
  const minuteScrollRef = React.useRef(null);

  useEffect(() => {
    if (hourScrollRef.current) {
      const hourElement = hourScrollRef.current.querySelector('.time-option.selected');
      if (hourElement) {
        hourElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
    if (minuteScrollRef.current) {
      const minuteElement = minuteScrollRef.current.querySelector('.time-option.selected');
      if (minuteElement) {
        minuteElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, []);

  const handleConfirm = () => {
    onChange(`${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`);
    onClose();
  };

  return (
    <div className="time-picker-overlay" onClick={onClose}>
      <div className="time-picker-modal" onClick={e => e.stopPropagation()}>
        <h3>{label}</h3>
        <div className="time-picker-wheels">
          <div className="time-wheel">
            <div className="time-wheel-label">Hour</div>
            <div className="time-wheel-scroll" ref={hourScrollRef}>
              {Array.from({ length: 24 }, (_, i) => (
                <div
                  key={i}
                  className={`time-option ${selectedHour === i ? 'selected' : ''}`}
                  onClick={() => setSelectedHour(i)}
                >
                  {String(i).padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>
          <div className="time-separator">:</div>
          <div className="time-wheel">
            <div className="time-wheel-label">Minute</div>
            <div className="time-wheel-scroll" ref={minuteScrollRef}>
              {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                <div
                  key={m}
                  className={`time-option ${selectedMinute === m ? 'selected' : ''}`}
                  onClick={() => setSelectedMinute(m)}
                >
                  {String(m).padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="time-picker-preview">
          {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
        </div>
        <div className="time-picker-buttons">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm}>Confirm</button>
        </div>
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
              <h1 className="profile-name">
                {user.name}
                {user.subscriptionStatus === 'active' && (
                  <span className="verified-badge" title="Subscribed User">
                    <svg viewBox="0 0 22 22" width="20" height="20" aria-label="Verified account">
                      <g>
                        <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#d97706" />
                        </linearGradient>
                        <path fill="url(#gold-gradient)" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"></path>
                      </g>
                    </svg>
                  </span>
                )}
              </h1>
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
          <div className="profile-card subscription-card">
            <h3>💳 Subscription</h3>
            <div className="subscription-info">
              {user.subscriptionStatus === 'active' ? (
                <>
                  <div className="subscription-status active">
                    <span className="status-icon">✅</span>
                    <span className="status-text">Active Subscription</span>
                  </div>
                  <div className="subscription-details">
                    <div className="info-row">
                      <span className="info-label">Subscribed On</span>
                      <span className="info-value">{user.subscriptionDate ? formatDate(user.subscriptionDate) : 'N/A'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Expires On</span>
                      <span className="info-value">{user.subscriptionExpiry ? formatDate(user.subscriptionExpiry) : 'N/A'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Days Remaining</span>
                      <span className="info-value days-left">
                        {user.subscriptionExpiry ? Math.max(0, Math.ceil((new Date(user.subscriptionExpiry) - new Date()) / (1000 * 60 * 60 * 24))) : 0} days
                      </span>
                    </div>
                  </div>
                </>
              ) : user.subscriptionStatus === 'pending' ? (
                <div className="subscription-status pending">
                  <span className="status-icon">⏳</span>
                  <span className="status-text">Payment Under Verification</span>
                </div>
              ) : user.subscriptionStatus === 'expired' ? (
                <div className="subscription-status expired">
                  <span className="status-icon">⚠️</span>
                  <span className="status-text">Subscription Expired</span>
                </div>
              ) : (
                <div className="subscription-status none">
                  <span className="status-icon">❌</span>
                  <span className="status-text">No Active Subscription</span>
                </div>
              )}
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
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [tabsVisible, setTabsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [serverReady, setServerReady] = useState(false);
  const [checkingServer, setCheckingServer] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showSubscriptionPopup, setShowSubscriptionPopup] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('none');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingHabits, setEditingHabits] = useState([]);
  const [savingHabits, setSavingHabits] = useState(false);
  // Sleep tracker state
  const [sleepData, setSleepData] = useState([]);
  const [sleepStats, setSleepStats] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepEntry, setSleepEntry] = useState({ date: '', bedtime: '22:00', wakeTime: '06:00', hours: 8, quality: 3, notes: '', sleepType: 'night', napIndex: 0 });
  const [sleepInputMode, setSleepInputMode] = useState('time'); // 'time' or 'hours'
  const [hasExistingSleep, setHasExistingSleep] = useState(false);
  const [sleepLoading, setSleepLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerField, setTimePickerField] = useState(''); // 'bedtime' or 'wakeTime'
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [chartViewType, setChartViewType] = useState('night'); // 'night' or 'nap' for chart
  const [tableViewType, setTableViewType] = useState('night'); // 'night' or 'nap' for table
  const [isEditingEntry, setIsEditingEntry] = useState(false);

  const daysInMonth = new Date(year, month, 0).getDate();

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); }, [theme]);
  
  // PWA Install prompt - mobile only
  useEffect(() => {
    const checkMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
    setIsMobileDevice(checkMobile());
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('resize', () => setIsMobileDevice(checkMobile()));
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);
  
  const handleAddToHomescreen = async () => {
    setMobileMenuOpen(false);
    if (!deferredPrompt) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const message = isIOS 
        ? '1. Tap the Share button (square with arrow) at the bottom of Safari\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm'
        : '1. Tap the three-dot menu (⋮) in the top right\n2. Tap "Add to Home screen" or "Install app"\n3. Tap "Add" to confirm';
      
      setPopup({
        isOpen: true,
        title: 'Add to Home Screen',
        message,
        onConfirm: () => setPopup(p => ({ ...p, isOpen: false })),
        confirmText: 'Got it',
        type: 'info'
      });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setToast({ show: true, message: 'App added to homescreen!', type: 'success' });
    }
    setDeferredPrompt(null);
  };
  
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

  const forceLogout = useCallback((message) => {
    setToken(null);
    setUser(null);
    setHabits([]);
    setTracking({});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToast({ show: true, message: message || 'You have been logged out', type: 'error' });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 5000);
  }, []);

  const loadData = useCallback(async () => {
    if (!token) return;
    // Don't load data if subscription popup is showing or user doesn't have active subscription
    if (subscriptionStatus === 'none' || subscriptionStatus === 'pending') return;
    
    setLoading(true);
    try {
      const [habitsRes, trackingRes, profileRes] = await Promise.all([
        api.get(`/habits?year=${year}&month=${month}`, token), 
        api.get(`/tracking/${year}/${month}`, token),
        api.get('/auth/profile', token)
      ]);
      setHabits(habitsRes);
      const trackMap = {}; 
      trackingRes.forEach(t => { trackMap[`${t.habitId}-${t.date}`] = true; }); 
      setTracking(trackMap);
      
      // Update user data with latest from server (includes subscriptionDate)
      if (profileRes) {
        setUser(profileRes);
        localStorage.setItem('user', JSON.stringify(profileRes));
      }
      
      // Load streaks for selected month with individual error handling
      const streakData = {}; 
      await Promise.all(habitsRes.map(async (h) => {
        try {
          const streakResult = await api.get(`/tracking/streaks/${h._id}/${year}/${month}`, token); 
          streakData[h._id] = streakResult || { currentStreak: 0, longestStreak: 0 }; 
        } catch (e) {
          if (e.code === 'ACCOUNT_DEACTIVATED') throw e;
          if (e.code === 'NO_SUBSCRIPTION' || e.code === 'SUBSCRIPTION_PENDING' || e.code === 'SUBSCRIPTION_EXPIRED') throw e;
          console.error(`Failed to load streak for ${h.name}:`, e);
          streakData[h._id] = { currentStreak: 0, longestStreak: 0 };
        }
      }));
      setStreaks(streakData);
    } catch (err) { 
      console.error('Error loading data:', err);
      if (err.code === 'ACCOUNT_DEACTIVATED') {
        forceLogout('Your account has been deactivated. Please contact support.');
      } else if (err.code === 'NO_SUBSCRIPTION') {
        forceLogout('Please subscribe to access the dashboard. Login again to subscribe.');
      } else if (err.code === 'SUBSCRIPTION_PENDING') {
        forceLogout('Your payment is under verification. Please try again after 1 hour.');
      } else if (err.code === 'SUBSCRIPTION_EXPIRED') {
        forceLogout('Your subscription has expired. Please renew to continue.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, year, month, forceLogout, subscriptionStatus]);

  // Load sleep data
  const loadSleepData = useCallback(async () => {
    if (!token || subscriptionStatus !== 'active') return;
    setSleepLoading(true);
    try {
      const [sleepRes, statsRes] = await Promise.all([
        api.get(`/sleep/${year}/${month}`, token),
        api.get(`/sleep/stats/${year}/${month}`, token)
      ]);
      setSleepData(sleepRes);
      setSleepStats(statsRes);
    } catch (err) {
      console.error('Error loading sleep data:', err);
    } finally {
      setSleepLoading(false);
    }
  }, [token, year, month, subscriptionStatus]);



  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadSleepData(); }, [loadSleepData]);
  useEffect(() => { 
    const stored = localStorage.getItem('user'); 
    if (stored) {
      const parsedUser = JSON.parse(stored);
      setUser(parsedUser);
      setSubscriptionStatus(parsedUser.subscriptionStatus || 'none');
    }
  }, []);
  useEffect(() => { const h = (e) => { if (!e.target.closest('.month-selector')) { setShowMonthDropdown(false); setShowYearInput(false); } }; document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);

  const handleLogin = async (cred) => { 
    setLoading(true);
    try { 
      const res = await api.post('/auth/google', { credential: cred.credential }); 
      
      // Check subscription status BEFORE setting token
      if (res.user.subscriptionStatus === 'none') {
        // Only set token/user for subscription popup
        setToken(res.token); 
        setUser(res.user); 
        setSubscriptionStatus('none');
        localStorage.setItem('token', res.token); 
        localStorage.setItem('user', JSON.stringify(res.user)); 
        setShowSubscriptionPopup(true);
      } else if (res.user.subscriptionStatus === 'pending') {
        // Don't set token - show message and keep on home page
        setToast({ show: true, message: 'Your payment is under verification. Please try again after 1 hour.', type: 'info' });
        setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 5000);
      } else if (res.user.subscriptionStatus === 'active') {
        // Only active users can access dashboard
        setToken(res.token); 
        setUser(res.user); 
        setSubscriptionStatus('active');
        localStorage.setItem('token', res.token); 
        localStorage.setItem('user', JSON.stringify(res.user)); 
        showToast('Welcome!', 'success');
      } else if (res.user.subscriptionStatus === 'expired') {
        setToast({ show: true, message: 'Your subscription has expired. Please renew to continue.', type: 'error' });
        setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 5000);
      }
    } catch (err) { 
      if (err.code === 'ACCOUNT_DEACTIVATED' || (err.message && err.message.includes('deactivated'))) {
        showToast('Your account has been deactivated. Please contact support.', 'error');
      } else {
        showToast('Login failed', 'error');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubscriptionSkip = () => {
    setShowSubscriptionPopup(false);
    forceLogout('Please subscribe to access the dashboard. You can subscribe anytime by logging in again.');
  };
  
  const handleSubscriptionSubmit = async (screenshot) => {
    try {
      const formData = new FormData();
      formData.append('screenshot', screenshot);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/subscription/submit-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit payment');
      }
      
      // Close popup and immediately logout - don't update user state to prevent dashboard flash
      setShowSubscriptionPopup(false);
      
      // Clear token and user immediately to prevent dashboard from showing
      setToken(null);
      setUser(null);
      setHabits([]);
      setTracking({});
      setSubscriptionStatus('none');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Show success toast
      setToast({ show: true, message: 'Payment submitted! Verification will be completed within 1 hour. Please login again later.', type: 'success' });
      setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 5000);
    } catch (err) {
      showToast('Failed to submit payment. Please try again.', 'error');
      throw err;
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
  
  const enterEditMode = () => {
    setEditingHabits(habits.map(h => ({ ...h, newName: h.name, toDelete: false })));
    setIsEditMode(true);
  };
  
  const cancelEditMode = () => {
    setIsEditMode(false);
    setEditingHabits([]);
  };
  
  const handleEditHabitName = (habitId, newName) => {
    setEditingHabits(prev => prev.map(h => h._id === habitId ? { ...h, newName } : h));
  };
  
  const handleMarkForDelete = (habitId) => {
    setEditingHabits(prev => prev.map(h => h._id === habitId ? { ...h, toDelete: !h.toDelete } : h));
  };
  
  const isCurrentMonthCheck = () => {
    const indian = getIndianDate();
    return year === indian.year && month === indian.month;
  };
  
  const saveHabitChanges = async () => {
    setSavingHabits(true);
    try {
      const currentMonth = isCurrentMonthCheck();
      
      // Process deletions
      const toDelete = editingHabits.filter(h => h.toDelete);
      for (const h of toDelete) {
        await api.delete(`/habits/${h._id}`, token);
      }
      
      // Process name changes
      const toUpdate = editingHabits.filter(h => !h.toDelete && h.newName !== h.name);
      for (const h of toUpdate) {
        await api.put(`/habits/${h._id}/name`, { 
          year, 
          month, 
          name: h.newName,
          isCurrentMonth: currentMonth
        }, token);
      }
      
      setIsEditMode(false);
      setEditingHabits([]);
      loadData();
      showToast('Changes saved!', 'success');
    } catch (err) {
      showToast('Failed to save changes', 'error');
    } finally {
      setSavingHabits(false);
    }
  };

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

  // Sleep tracker functions
  const calculateSleepDuration = (bedtime, wakeTime) => {
    const [bedH, bedM] = bedtime.split(':').map(Number);
    const [wakeH, wakeM] = wakeTime.split(':').map(Number);
    let bedMinutes = bedH * 60 + bedM;
    let wakeMinutes = wakeH * 60 + wakeM;
    if (wakeMinutes <= bedMinutes) wakeMinutes += 24 * 60; // Next day
    return wakeMinutes - bedMinutes;
  };

  const formatDuration = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const openSleepModal = (date = null, sleepType = 'night', napIndex = 0) => {
    const indian = getIndianDate();
    let defaultDate;
    
    if (date) {
      defaultDate = date;
    } else {
      // If viewing current month, use today's date; otherwise use 1st of the month
      const isCurrentMonth = year === indian.year && month === indian.month;
      if (isCurrentMonth) {
        defaultDate = `${indian.year}-${String(indian.month).padStart(2, '0')}-${String(indian.day).padStart(2, '0')}`;
      } else {
        defaultDate = `${year}-${String(month).padStart(2, '0')}-01`;
      }
    }
    
    // Handle undefined sleepType for existing entries
    const actualSleepType = sleepType || 'night';
    
    // For new nap entries (no date provided), calculate next nap index
    let actualNapIndex = napIndex || 0;
    if (!date && actualSleepType === 'nap') {
      const napsOnDate = sleepData.filter(s => s.date === defaultDate && s.sleepType === 'nap');
      actualNapIndex = napsOnDate.length;
    }
    
    // Remove the early return - let the modal handle validation
    
    // Check if there's existing night sleep for this date
    const existingNightSleep = sleepData.find(s => s.date === defaultDate && s.sleepType === 'night');
    const hasExisting = actualSleepType === 'night' && !!existingNightSleep;
    
    // If date is provided (editing from table), load existing data
    // Otherwise, always open as new entry form
    if (date) {
      // Editing from table - find and load existing entry
      const existing = sleepData.find(s => 
        s.date === defaultDate && 
        (s.sleepType || 'night') === actualSleepType && 
        (s.napIndex || 0) === actualNapIndex
      );
      
      if (existing) {
        const duration = existing.duration / 60;
        setSleepEntry({ 
          date: existing.date, 
          bedtime: existing.bedtime || (actualSleepType === 'night' ? '22:00' : '14:00'), 
          wakeTime: existing.wakeTime || (actualSleepType === 'night' ? '06:00' : '16:00'),
          hours: duration,
          quality: existing.quality || 3, 
          notes: existing.notes || '',
          sleepType: actualSleepType,
          napIndex: actualNapIndex
        });
        setSleepInputMode(existing.bedtime && existing.wakeTime ? 'time' : 'hours');
        setIsEditingEntry(true);
        setHasExistingSleep(false);
      }
    } else {
      // Opening from "Log Sleep" button - always new entry form
      setSleepEntry({ 
        date: defaultDate, 
        bedtime: actualSleepType === 'night' ? '22:00' : '14:00', 
        wakeTime: actualSleepType === 'night' ? '06:00' : '16:00', 
        hours: actualSleepType === 'night' ? 8 : 2, 
        quality: 3, 
        notes: '',
        sleepType: actualSleepType,
        napIndex: actualNapIndex
      });
      setSleepInputMode('time');
      setIsEditingEntry(false);
      setHasExistingSleep(hasExisting);
    }
    setShowSleepModal(true);
  };

  const openNapModal = async () => {
    // Don't pass a date parameter so it opens as "new entry" mode
    // The openSleepModal function will set the default date internally
    openSleepModal(null, 'nap', 0);
  };

  const saveSleepEntry = async () => {
    if (!sleepEntry.date) { showToast('Please select a date', 'error'); return; }
    let duration, bedtime, wakeTime;
    
    if (sleepInputMode === 'time') {
      duration = calculateSleepDuration(sleepEntry.bedtime, sleepEntry.wakeTime);
      bedtime = sleepEntry.bedtime;
      wakeTime = sleepEntry.wakeTime;
    } else {
      duration = Math.round(sleepEntry.hours * 60);
      bedtime = null;
      wakeTime = null;
    }
    
    try {
      console.log('Saving sleep entry:', {
        date: sleepEntry.date, 
        bedtime, 
        wakeTime, 
        duration, 
        quality: sleepEntry.quality, 
        notes: sleepEntry.notes,
        sleepType: sleepEntry.sleepType,
        napIndex: sleepEntry.napIndex
      });
      
      await api.post('/sleep', { 
        date: sleepEntry.date, 
        bedtime, 
        wakeTime, 
        duration, 
        quality: sleepEntry.quality, 
        notes: sleepEntry.notes,
        sleepType: sleepEntry.sleepType,
        napIndex: sleepEntry.napIndex
      }, token);
      setShowSleepModal(false);
      loadSleepData();
      showToast(sleepEntry.sleepType === 'night' ? 'Sleep logged!' : 'Nap logged!', 'success');
    } catch (err) {
      console.error('Save error:', err.response?.data || err.message);
      
      showToast(`Failed to save: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const deleteSleepEntry = async (date, sleepType = 'night', napIndex = 0) => {
    const actualSleepType = sleepType || 'night';
    const actualNapIndex = napIndex || 0;
    showPopup('Delete', `Delete this ${actualSleepType === 'night' ? 'sleep' : 'nap'} entry?`, async () => {
      try {
        await api.delete(`/sleep/${date}?sleepType=${actualSleepType}&napIndex=${actualNapIndex}`, token);
        loadSleepData();
        closePopup();
        showToast('Deleted', 'success');
      } catch (err) {
        closePopup();
        showToast('Failed to delete', 'error');
      }
    }, closePopup, 'warning');
  };

  const getSleepChartData = () => {
    const labels = [];
    const data = [];
    const napDetails = []; // For tooltip showing nap breakdown
    
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      labels.push(d);
      
      if (chartViewType === 'night') {
        const entry = sleepData.find(s => s.date === date && s.sleepType === 'night');
        data.push(entry ? entry.duration / 60 : null);
        napDetails.push(null);
      } else {
        // Sum all naps for this date
        const naps = sleepData.filter(s => s.date === date && s.sleepType === 'nap');
        if (naps.length > 0) {
          const totalNapDuration = naps.reduce((sum, n) => sum + n.duration, 0) / 60;
          data.push(totalNapDuration);
          napDetails.push(naps.map((n, i) => ({ index: i + 1, duration: n.duration / 60 })));
        } else {
          data.push(null);
          napDetails.push(null);
        }
      }
    }
    return { labels, data, napDetails };
  };

  const getQualityEmoji = (q) => {
    const emojis = ['😫', '😕', '😐', '😊', '😴'];
    return emojis[(q || 3) - 1];
  };

  const getQualityLabel = (q) => {
    const labels = ['Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'];
    return labels[(q || 3) - 1];
  };

  if (!token) return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="home-page" data-theme={theme}>
        <Toast {...toast} />
        <Popup {...popup} />
        {loading && <Loader message="Logging in..." />}
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
          <button className="theme-toggle-btn desktop-only" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          {mobileMenuOpen && (
            <div className="mobile-menu">
              {isMobileDevice && <button className="mobile-menu-item" onClick={handleAddToHomescreen}>Add to Homescreen</button>}
            </div>
          )}
        </header>
        
        <section className="hero-section">
          <div className="hero-content">
            <h1>Build Better Habits,<br/>One Day at a Time</h1>
            <p className="hero-subtitle">Track your daily habits, visualize your progress, and achieve your goals with our simple yet powerful habit tracking app.</p>
            <div className="pricing-badge">
              <span className="price-highlight">₹49/year</span>
              <span className="price-subtext">One-time payment • 365 days access</span>
            </div>
            <div className="hero-login">
              <div className="google-signin-wrapper">
                <div className={!serverReady ? 'google-signin-disabled' : ''}>
                  {!serverReady && <div className="signin-tooltip">⏳ Server is waking up, please wait...</div>}
                  <GoogleLogin onSuccess={handleLogin} onError={() => showToast('Login Failed', 'error')} />
                </div>
                {!serverReady && <div className="signin-loader"></div>}
              </div>
            </div>
            <p className="contact-info">Need help? <a href="mailto:healthtracker.tp@gmail.com">healthtracker.tp@gmail.com</a></p>
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
          <div className="pricing-badge-cta">
            <span className="price-highlight">₹49/year</span>
            <span className="price-subtext">Affordable • Effective • Life-changing</span>
          </div>
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
          <p className="footer-contact">Contact: <a href="mailto:healthtracker.tp@gmail.com">healthtracker.tp@gmail.com</a></p>
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
              {isMobileDevice && <button className="mobile-menu-item" onClick={handleAddToHomescreen}>Add to Homescreen</button>}
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
        <SubscriptionPopup 
          isOpen={showSubscriptionPopup} 
          onClose={() => setShowSubscriptionPopup(false)}
          onSubmit={handleSubscriptionSubmit}
          onSkip={handleSubscriptionSkip}
          user={user}
        />
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
              {isMobileDevice && <button className="mobile-menu-item" onClick={handleAddToHomescreen}>Add to Homescreen</button>}
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
          <button className={activeTab === 'tracker' ? 'active' : ''} onClick={() => setActiveTab('tracker')}>📋 Habits</button>
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>📊 Overview</button>
          <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>📈 Stats</button>
          <button className={activeTab === 'sleep' ? 'active' : ''} onClick={() => setActiveTab('sleep')}>🛌 Sleep</button>
        </nav>

        <div className="main-content">
          {activeTab === 'tracker' && (
            <div className="tracker-view">
              <div className="page-header">
                <div>
                  <h2>{MONTHS[month - 1]} {year}</h2>
                  <p className="page-subtitle">{isEditMode ? (isCurrentMonthCheck() ? 'Changes apply to this & future months' : 'Changes only apply to this month') : 'Track your daily habits'}</p>
                </div>
                <div className="page-header-buttons">
                  {isEditMode ? (
                    <>
                      <button className="cancel-edit-btn" onClick={cancelEditMode} disabled={savingHabits}>Cancel</button>
                      <button className="save-habits-btn" onClick={saveHabitChanges} disabled={savingHabits}>
                        {savingHabits ? 'Saving...' : 'Save Changes'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="edit-habits-btn" onClick={enterEditMode}>✏️ Edit Habits</button>
                      <button className="add-habit-btn" onClick={() => setShowModal(true)}>+ Add Habit</button>
                    </>
                  )}
                </div>
              </div>
              <div className="card habits-grid"><div style={{ overflowX: 'auto' }}>
                <table className="habits-table">
                  <thead><tr>{isEditMode && <th className="delete-col"></th>}<th className="habit-name-cell">Habit</th><th>Goal</th>{Array.from({ length: daysInMonth }, (_, i) => <th key={i} className={`day-cell ${isFutureDate(year, month, i + 1) ? 'future-day' : ''}`}><div className="day-header"><span className="day-name">{getDayName(i + 1).slice(0, 2)}</span><span className="day-num">{i + 1}</span></div></th>)}<th>Done</th></tr></thead>
                  <tbody>{(isEditMode ? editingHabits : habits).map(h => {
                    const editH = isEditMode ? h : null;
                    const habitData = isEditMode ? h : h;
                    return (
                      <tr key={h._id} className={editH?.toDelete ? 'marked-for-delete' : ''}>
                        {isEditMode && (
                          <td className="delete-col">
                            <button 
                              className={`inline-delete-btn ${editH?.toDelete ? 'undo' : ''}`}
                              onClick={() => handleMarkForDelete(h._id)}
                              title={editH?.toDelete ? 'Undo' : 'Delete'}
                            >
                              {editH?.toDelete ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 12h18M3 12l6-6M3 12l6 6"/>
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                </svg>
                              )}
                            </button>
                          </td>
                        )}
                        <td className="habit-name-cell">
                          {isEditMode ? (
                            <div className="habit-name edit-mode">
                              <span className="habit-color" style={{ background: habitData.color }} />
                              <input 
                                type="text" 
                                className="habit-name-input"
                                value={editH?.newName || ''}
                                onChange={e => handleEditHabitName(h._id, e.target.value)}
                                disabled={editH?.toDelete}
                              />
                            </div>
                          ) : (
                            <div className="habit-name"><span className="habit-color" style={{ background: habitData.color }} />{habitData.name}</div>
                          )}
                        </td>
                        <td><input type="number" className="goal-input" value={habitData.goal} onChange={e => updateGoal(h._id, e.target.value)} min="0" disabled={isEditMode} /></td>
                        {Array.from({ length: daysInMonth }, (_, i) => { 
                          const date = `${year}-${String(month).padStart(2,'0')}-${String(i + 1).padStart(2,'0')}`; 
                          const checked = !!tracking[`${h._id}-${date}`]; 
                          const future = isFutureDate(year, month, i + 1); 
                          return <td key={i} className={`day-cell ${future ? 'future-day' : ''}`}><div className={`check-box ${checked ? 'checked' : ''} ${future || isEditMode ? 'disabled' : ''}`} onClick={() => !isEditMode && toggleHabit(h._id, i + 1)}>{checked && '✓'}</div></td>; 
                        })}
                        <td className="done-cell">{getCompleted(h._id)}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div></div>
            </div>
          )}
          {activeTab === 'overview' && (
            <div className="overview-view">
              <div className="page-header">
                <div>
                  <h2>{MONTHS[month - 1]} {year} - Habits Overview</h2>
                  <p className="page-subtitle">Daily habit completion rates organized by week</p>
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

          {activeTab === 'sleep' && (
            <div className="sleep-view">
              <div className="page-header sleep-header-with-status">
                <div className="sleep-header-left">
                  <h2>Sleep Tracker - {MONTHS[month - 1]} {year}</h2>
                  <p className="page-subtitle">Track your sleep patterns and improve your rest <span className="stats-note">(Stats show night sleep only)</span></p>
                </div>
                
                <div className="sleep-status-center">
                  {(() => {
                    const today = getIndianDate();
                    const todayStr = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
                    const isCurrentMonth = year === today.year && month === today.month;
                    
                    if (isCurrentMonth) {
                      const todaySleep = sleepData.find(s => s.date === todayStr && s.sleepType === 'night');
                      if (todaySleep) {
                        return (
                          <div className="sleep-status-message logged">
                            ✅ Today's sleep is already logged ({formatDuration(todaySleep.duration)})
                          </div>
                        );
                      } else {
                        return (
                          <div className="sleep-status-message pending">
                            ⏰ Don't forget to log today's sleep!
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
                
                <div className="sleep-action-buttons">
                  <button className="add-habit-btn" onClick={() => openSleepModal()}>+ Log Sleep</button>
                  <button className="add-habit-btn nap-btn" onClick={openNapModal}>+ Log Nap</button>
                </div>
              </div>

              {sleepLoading ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                  <div className="sleep-loader"></div>
                  <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>Loading sleep data...</p>
                </div>
              ) : (
                <>
                  {/* Sleep Stats Cards */}
                  <div className="sleep-stats-grid">
                    <div className="card sleep-stat-card">
                      <div className="sleep-stat-icon">🌙</div>
                      <div className="sleep-stat-value">{sleepStats?.totalNights || 0}</div>
                      <div className="sleep-stat-label">Nights Tracked</div>
                    </div>
                    <div className="card sleep-stat-card">
                      <div className="sleep-stat-icon">⏱️</div>
                      <div className="sleep-stat-value">{sleepStats?.avgDuration ? formatDuration(sleepStats.avgDuration) : '0h'}</div>
                      <div className="sleep-stat-label">Avg Duration</div>
                    </div>
                    <div className="card sleep-stat-card">
                      <div className="sleep-stat-icon">📈</div>
                      <div className="sleep-stat-value">{sleepStats?.maxSleep ? formatDuration(sleepStats.maxSleep.duration) : '-'}</div>
                      <div className="sleep-stat-label">Max Sleep</div>
                    </div>
                    <div className="card sleep-stat-card">
                      <div className="sleep-stat-icon">📉</div>
                      <div className="sleep-stat-value">{sleepStats?.minSleep ? formatDuration(sleepStats.minSleep.duration) : '-'}</div>
                      <div className="sleep-stat-label">Min Sleep</div>
                    </div>
                    <div className="card sleep-stat-card">
                      <div className="sleep-stat-icon">⭐</div>
                      <div className="sleep-stat-value">{sleepStats?.avgQuality?.toFixed(1) || '0'}/5</div>
                      <div className="sleep-stat-label">Avg Quality</div>
                    </div>
                  </div>

                  {/* Sleep Chart */}
                  <div className="card sleep-chart-card">
                    <div className="sleep-chart-header">
                      <div>
                        <h3>📈 {chartViewType === 'night' ? 'Sleep' : 'Nap'} Duration Trend</h3>
                        <p className="chart-subtitle">{chartViewType === 'night' ? 'Hours of sleep per night' : 'Total nap hours per day'} this month</p>
                      </div>
                      <div className="sleep-type-toggle">
                        <button 
                          className={`toggle-btn ${chartViewType === 'night' ? 'active' : ''}`}
                          onClick={() => setChartViewType('night')}
                        >
                          🌙 Night
                        </button>
                        <button 
                          className={`toggle-btn ${chartViewType === 'nap' ? 'active' : ''}`}
                          onClick={() => setChartViewType('nap')}
                        >
                          😴 Naps
                        </button>
                      </div>
                    </div>
                    <div className="sleep-chart-container">
                      <Line
                        data={{
                          labels: getSleepChartData().labels,
                          datasets: [{
                            label: 'Hours',
                            data: getSleepChartData().data,
                            borderColor: chartViewType === 'night' ? '#8b5cf6' : '#f59e0b',
                            backgroundColor: chartViewType === 'night' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 8,
                            pointBackgroundColor: chartViewType === 'night' ? '#8b5cf6' : '#f59e0b',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            spanGaps: true
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                title: (ctx) => {
                                  const day = ctx[0].label;
                                  const date = new Date(year, month - 1, day);
                                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                  const monthName = date.toLocaleDateString('en-US', { month: 'short' });
                                  const dayNum = date.getDate();
                                  const suffix = dayNum === 1 || dayNum === 21 || dayNum === 31 ? 'st' : dayNum === 2 || dayNum === 22 ? 'nd' : dayNum === 3 || dayNum === 23 ? 'rd' : 'th';
                                  return `${dayName}, ${dayNum}${suffix} ${monthName}`;
                                },
                                label: (ctx) => {
                                  if (!ctx.parsed.y) return 'No data';
                                  if (chartViewType === 'night') {
                                    return `Sleep: ${ctx.parsed.y.toFixed(1)} hours`;
                                  } else {
                                    const chartData = getSleepChartData();
                                    const napDetail = chartData.napDetails[ctx.dataIndex];
                                    if (napDetail && napDetail.length > 1) {
                                      return [`Total: ${ctx.parsed.y.toFixed(1)} hours`, ...napDetail.map(n => `  Nap ${n.index}: ${n.duration.toFixed(1)}h`)];
                                    }
                                    return `Nap: ${ctx.parsed.y.toFixed(1)} hours`;
                                  }
                                }
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              max: Math.max(chartViewType === 'night' ? 12 : 6, ...getSleepChartData().data.filter(v => v !== null).map(v => Math.ceil(v) + 1)),
                              ticks: { 
                                color: theme === 'dark' ? '#94a3b8' : '#6b7280',
                                callback: (v) => `${v}h`
                              },
                              grid: { color: theme === 'dark' ? '#334155' : '#e5e7eb' }
                            },
                            x: {
                              ticks: { color: theme === 'dark' ? '#94a3b8' : '#6b7280' },
                              grid: { color: theme === 'dark' ? '#334155' : '#e5e7eb' }
                            }
                          }
                        }}
                      />
                    </div>
                    {chartViewType === 'night' && (
                      <div className="sleep-goal-line">
                        <span className="sleep-goal-indicator"></span>
                        <span>Recommended: 7-9 hours</span>
                      </div>
                    )}
                  </div>

                  {/* Sleep Log Table */}
                  <div className="card">
                    <div className="sleep-log-header">
                      <h3>📋 {tableViewType === 'night' ? 'Sleep' : 'Nap'} Log</h3>
                      <div className="sleep-type-toggle">
                        <button 
                          className={`toggle-btn ${tableViewType === 'night' ? 'active' : ''}`}
                          onClick={() => setTableViewType('night')}
                        >
                          🌙 Night
                        </button>
                        <button 
                          className={`toggle-btn ${tableViewType === 'nap' ? 'active' : ''}`}
                          onClick={() => setTableViewType('nap')}
                        >
                          😴 Naps
                        </button>
                      </div>
                    </div>
                    <div className="sleep-log-container">
                      {(() => {
                        const filteredData = sleepData.filter(s => s.sleepType === tableViewType);
                        if (filteredData.length === 0) {
                          return (
                            <div className="empty-state">
                              <p>No {tableViewType === 'night' ? 'sleep' : 'nap'} data logged yet. Click "{tableViewType === 'night' ? 'Log Sleep' : 'Log Nap'}" to start tracking!</p>
                            </div>
                          );
                        }
                        return (
                          <table className="sleep-log-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                {tableViewType === 'nap' && <th>#</th>}
                                <th>{tableViewType === 'night' ? 'Bedtime' : 'Start'}</th>
                                <th>{tableViewType === 'night' ? 'Wake Time' : 'End'}</th>
                                <th>Duration</th>
                                <th>Quality</th>
                                <th>Notes</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredData.sort((a, b) => {
                                const dateCompare = b.date.localeCompare(a.date);
                                if (dateCompare !== 0) return dateCompare;
                                return (a.napIndex || 0) - (b.napIndex || 0);
                              }).map(entry => (
                                <tr key={`${entry.date}-${entry.sleepType}-${entry.napIndex || 0}`}>
                                  <td className="sleep-date-cell">
                                    {(() => {
                                      const d = new Date(entry.date + 'T00:00:00');
                                      const day = d.getDate();
                                      const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
                                      return `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${day}${suffix} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
                                    })()}
                                  </td>
                                  {tableViewType === 'nap' && <td className="nap-index-cell">Nap {(entry.napIndex || 0) + 1}</td>}
                                  <td>{entry.bedtime || '-'}</td>
                                  <td>{entry.wakeTime || '-'}</td>
                                  <td className="sleep-duration-cell">
                                    <span className={`duration-badge ${tableViewType === 'night' ? (entry.duration >= 420 ? 'good' : entry.duration >= 360 ? 'fair' : 'poor') : (entry.duration >= 60 ? 'good' : entry.duration >= 30 ? 'fair' : 'poor')}`}>
                                      {formatDuration(entry.duration)}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="quality-badge" title={getQualityLabel(entry.quality)}>
                                      {getQualityEmoji(entry.quality)} {entry.quality}
                                    </span>
                                  </td>
                                  <td className="sleep-notes-cell">
                                    <NotesCell 
                                      notes={entry.notes} 
                                      entryId={`${entry.date}-${entry.sleepType}-${entry.napIndex || 0}`}
                                      expandedNotes={expandedNotes}
                                      setExpandedNotes={setExpandedNotes}
                                    />
                                  </td>
                                  <td>
                                    <div className="sleep-actions">
                                      <button className="sleep-edit-btn" onClick={() => openSleepModal(entry.date, entry.sleepType, entry.napIndex)} title="Edit">✏️</button>
                                      <button className="sleep-delete-btn" onClick={() => deleteSleepEntry(entry.date, entry.sleepType, entry.napIndex)} title="Delete">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="stats-view">
              <div className="stats-header">
                <h2>{MONTHS[month - 1]} {year} - Habits Statistics</h2>
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

        {showSleepModal && (
          <div className="modal-overlay" onClick={() => setShowSleepModal(false)}>
            <div className="modal sleep-modal" onClick={e => e.stopPropagation()}>
              <h2>
                {isEditingEntry 
                  ? (sleepEntry.sleepType === 'night' ? '✏️ Edit Sleep' : '✏️ Edit Nap')
                  : (sleepEntry.sleepType === 'night' ? '😴 Log Sleep' : '💤 Log Nap')
                }
              </h2>
              
              {hasExistingSleep && (
                <div className="sleep-validation-message">
                  ⚠️ Sleep already logged for this date. Select a different date or edit from the table.
                </div>
              )}
              
              <div className="modal-form">
                <div className="modal-form-group">
                  <label>Date</label>
                  {isEditingEntry ? (
                    <div className="date-display-only">
                      {sleepEntry.date ? (() => {
                        const d = new Date(sleepEntry.date + 'T00:00:00');
                        const day = d.getDate();
                        const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
                        return `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${day}${suffix} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
                      })() : 'No Date'}
                    </div>
                  ) : (
                    <div className="date-picker-with-nav">
                      <button 
                        type="button"
                        className="date-nav-arrow"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!sleepEntry.date) return;
                          const currentDate = new Date(sleepEntry.date + 'T00:00:00');
                          currentDate.setDate(currentDate.getDate() - 1);
                          const newDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                          // Check if new date is within the current month
                          if (currentDate.getFullYear() === year && currentDate.getMonth() + 1 === month) {
                            setSleepEntry({ ...sleepEntry, date: newDateStr });
                            // Check if new date has existing sleep
                            const existingNightSleep = sleepData.find(s => s.date === newDateStr && s.sleepType === 'night');
                            setHasExistingSleep(sleepEntry.sleepType === 'night' && !!existingNightSleep);
                          }
                        }}
                        disabled={!sleepEntry.date || (() => {
                          const currentDate = new Date(sleepEntry.date + 'T00:00:00');
                          return currentDate.getDate() === 1;
                        })()}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 18l-6-6 6-6"/>
                        </svg>
                      </button>
                      <button 
                        type="button"
                        className="date-picker-button"
                        onClick={() => setShowDatePicker(true)}
                      >
                        {sleepEntry.date ? (() => {
                          const d = new Date(sleepEntry.date + 'T00:00:00');
                          const day = d.getDate();
                          const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
                          return `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${day}${suffix} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
                        })() : 'Select Date'}
                      </button>
                      <button 
                        type="button"
                        className="date-nav-arrow"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!sleepEntry.date) return;
                          const currentDate = new Date(sleepEntry.date + 'T00:00:00');
                          currentDate.setDate(currentDate.getDate() + 1);
                          const newDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                          const maxDate = getIndianDate();
                          const isCurrentMonth = year === maxDate.year && month === maxDate.month;
                          const maxDay = isCurrentMonth ? maxDate.day : new Date(year, month, 0).getDate();
                          // Check if new date is within bounds
                          if (currentDate.getFullYear() === year && currentDate.getMonth() + 1 === month && currentDate.getDate() <= maxDay) {
                            setSleepEntry({ ...sleepEntry, date: newDateStr });
                            // Check if new date has existing sleep
                            const existingNightSleep = sleepData.find(s => s.date === newDateStr && s.sleepType === 'night');
                            setHasExistingSleep(sleepEntry.sleepType === 'night' && !!existingNightSleep);
                          }
                        }}
                        disabled={!sleepEntry.date || (() => {
                          const currentDate = new Date(sleepEntry.date + 'T00:00:00');
                          const maxDate = getIndianDate();
                          const isCurrentMonth = year === maxDate.year && month === maxDate.month;
                          const maxDay = isCurrentMonth ? maxDate.day : new Date(year, month, 0).getDate();
                          return currentDate.getDate() >= maxDay;
                        })()}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="sleep-input-mode-toggle">
                  <button 
                    type="button"
                    className={`mode-toggle-btn ${sleepInputMode === 'time' ? 'active' : ''}`}
                    onClick={() => setSleepInputMode('time')}
                    disabled={hasExistingSleep}
                  >
                    🕐 Time Range
                  </button>
                  <button 
                    type="button"
                    className={`mode-toggle-btn ${sleepInputMode === 'hours' ? 'active' : ''}`}
                    onClick={() => setSleepInputMode('hours')}
                    disabled={hasExistingSleep}
                  >
                    ⏱️ Total Hours
                  </button>
                </div>

                {sleepInputMode === 'time' ? (
                  <>
                    <div className="sleep-time-row">
                      <div className="modal-form-group">
                        <label>🌙 Bedtime</label>
                        <button 
                          type="button"
                          className="time-picker-button"
                          onClick={() => {
                            setTimePickerField('bedtime');
                            setShowTimePicker(true);
                          }}
                          disabled={hasExistingSleep}
                        >
                          {sleepEntry.bedtime || '22:00'}
                        </button>
                      </div>
                      <div className="modal-form-group">
                        <label>☀️ Wake Time</label>
                        <button 
                          type="button"
                          className="time-picker-button"
                          onClick={() => {
                            setTimePickerField('wakeTime');
                            setShowTimePicker(true);
                          }}
                          disabled={hasExistingSleep}
                        >
                          {sleepEntry.wakeTime || '06:00'}
                        </button>
                      </div>
                    </div>
                    <div className={`sleep-duration-preview ${hasExistingSleep ? 'disabled' : ''}`}>
                      <span>Duration: </span>
                      <strong>{formatDuration(calculateSleepDuration(sleepEntry.bedtime, sleepEntry.wakeTime))}</strong>
                    </div>
                  </>
                ) : (
                  <div className="modal-form-group">
                    <label>Sleep Duration (hours)</label>
                    <input 
                      type="number" 
                      step="0.5"
                      min="0"
                      max="24"
                      value={sleepEntry.hours} 
                      onChange={e => setSleepEntry({ ...sleepEntry, hours: parseFloat(e.target.value) || 0 })}
                      placeholder="8"
                      disabled={hasExistingSleep}
                    />
                    <small>{sleepEntry.sleepType === 'night' ? 'Enter total hours slept (e.g., 7.5 for 7 hours 30 minutes)' : 'Enter nap duration (e.g., 1.5 for 1 hour 30 minutes)'}</small>
                  </div>
                )}
                <div className="modal-form-group">
                  <label>Sleep Quality</label>
                  <div className={`quality-slider-container ${hasExistingSleep ? 'disabled' : ''}`}>
                    <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      value={sleepEntry.quality}
                      onChange={e => setSleepEntry({ ...sleepEntry, quality: parseInt(e.target.value) })}
                      className="quality-slider"
                      disabled={hasExistingSleep}
                    />
                    <div className="quality-slider-labels">
                      {[1, 2, 3, 4, 5].map(q => (
                        <span 
                          key={q} 
                          className={`quality-slider-num ${sleepEntry.quality === q ? 'active' : ''} ${hasExistingSleep ? 'disabled' : ''}`}
                          onClick={() => !hasExistingSleep && setSleepEntry({ ...sleepEntry, quality: q })}
                        >
                          {q}
                        </span>
                      ))}
                    </div>
                    <div className="quality-display" key={sleepEntry.quality}>
                      <span className="quality-display-emoji">{getQualityEmoji(sleepEntry.quality)}</span>
                      <span className="quality-display-text">{getQualityLabel(sleepEntry.quality)}</span>
                    </div>
                  </div>
                </div>
                <div className="modal-form-group">
                  <label>Notes (optional)</label>
                  <textarea 
                    placeholder="How did you sleep? Any dreams?"
                    value={sleepEntry.notes}
                    onChange={e => setSleepEntry({ ...sleepEntry, notes: e.target.value })}
                    rows={2}
                    disabled={hasExistingSleep}
                  />
                </div>
              </div>
              <div className="modal-buttons">
                <button className="btn-secondary" onClick={() => setShowSleepModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={saveSleepEntry} disabled={hasExistingSleep}>
                  {isEditingEntry 
                    ? (sleepEntry.sleepType === 'night' ? 'Update Sleep' : 'Update Nap')
                    : (sleepEntry.sleepType === 'night' ? 'Save Sleep' : 'Save Nap')
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {showTimePicker && (
          <TimePicker
            value={sleepEntry[timePickerField]}
            onChange={(newTime) => {
              setSleepEntry({ ...sleepEntry, [timePickerField]: newTime });
            }}
            onClose={() => setShowTimePicker(false)}
            label={timePickerField === 'bedtime' ? '🌙 Select Bedtime' : '☀️ Select Wake Time'}
          />
        )}

        {showDatePicker && (
          <DatePicker
            value={sleepEntry.date}
            onChange={(newDate) => {
              setSleepEntry({ ...sleepEntry, date: newDate });
              // Check if new date has existing sleep
              const existingNightSleep = sleepData.find(s => s.date === newDate && s.sleepType === 'night');
              setHasExistingSleep(sleepEntry.sleepType === 'night' && !!existingNightSleep);
            }}
            onClose={() => setShowDatePicker(false)}
            month={month}
            year={year}
            sleepData={sleepData}
            sleepType={sleepEntry.sleepType}
          />
        )}

      </div>
    </ThemeContext.Provider>
  );
}

export default App;
