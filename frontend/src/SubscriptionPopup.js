import React, { useState } from 'react';
import './SubscriptionPopup.css';

const SubscriptionPopup = ({ isOpen, onClose, onSubmit, onSkip, user }) => {
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setPaymentScreenshot(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!paymentScreenshot) {
      alert('Please upload payment screenshot');
      return;
    }

    setUploading(true);
    try {
      await onSubmit(paymentScreenshot);
    } catch (err) {
      alert('Failed to submit payment');
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  return (
    <div className="subscription-overlay">
      <div className="subscription-popup">
        <div className="subscription-header">
          <h2>🎯 Subscribe to Habit Tracker</h2>
          <p className="subscription-subtitle">Unlock full access to track your habits</p>
        </div>

        <div className="subscription-content">
          <div className="subscription-pricing">
            <div className="price-tag">
              <span className="currency">₹</span>
              <span className="amount">49</span>
              <span className="period">/year</span>
            </div>
            <p className="price-description">One-time payment for 365 days of unlimited habit tracking</p>
          </div>

          <div className="subscription-features">
            <h3>What you get:</h3>
            <ul>
              <li>✅ Unlimited habit tracking</li>
              <li>✅ Weekly & monthly analytics</li>
              <li>✅ Streak tracking</li>
              <li>✅ Custom goals</li>
              <li>✅ Dark mode</li>
              <li>✅ 1 year access</li>
            </ul>
          </div>

          <div className="payment-section">
            <h3>Payment Instructions:</h3>
            <ol>
              <li>Scan the QR code below or use UPI ID</li>
              <li>Pay ₹49 to complete your subscription</li>
              <li>Upload payment screenshot</li>
              <li>Wait for admin verification (within 1 hour)</li>
            </ol>

            <div className="qr-code-section">
              <img 
                src="/payment-qr.png" 
                alt="Payment QR Code" 
                className="qr-code"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="qr-placeholder" style={{display: 'none'}}>
                <p>QR Code</p>
                <p className="upi-id">UPI: tejaspawar62689@okicici</p>
              </div>
            </div>

            <div className="upload-section">
              <label className="upload-label">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <div className="upload-button">
                  📤 {paymentScreenshot ? 'Change Screenshot' : 'Upload Payment Screenshot'}
                </div>
              </label>
              
              {preview && (
                <div className="preview-section">
                  <img src={preview} alt="Preview" className="preview-image" />
                  <p className="preview-text">✓ Screenshot selected</p>
                </div>
              )}
            </div>
          </div>

          <div className="subscription-actions">
            <button 
              className="subscribe-btn" 
              onClick={handleSubmit}
              disabled={!paymentScreenshot || uploading}
            >
              {uploading ? 'Uploading...' : 'Submit Payment'}
            </button>
            <button className="skip-btn" onClick={handleSkip} disabled={uploading}>
              Skip for now
            </button>
          </div>

          <div className="subscription-footer">
            <p>Need help? Contact us at <a href="mailto:healthtracker.tp@gmail.com">healthtracker.tp@gmail.com</a></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPopup;
