const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// OAuth2 Configuration
const OAuth2 = google.auth.OAuth2;

// Cache for OAuth2 access token
let cachedAccessToken = null;
let tokenExpiry = null;

const getAccessToken = async () => {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
    return cachedAccessToken;
  }
  
  const oauth2Client = new OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.OAUTH_REFRESH_TOKEN
  });

  const { token } = await oauth2Client.getAccessToken();
  cachedAccessToken = token;
  tokenExpiry = Date.now() + 3600000;
  return token;
};

const createTransporter = async () => {
  if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET || !process.env.OAUTH_REFRESH_TOKEN) {
    throw new Error('OAuth2 credentials must be set');
  }
  
  if (!process.env.EMAIL_USER) {
    throw new Error('EMAIL_USER must be set');
  }

  const accessToken = await getAccessToken();

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.EMAIL_USER,
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      refreshToken: process.env.OAUTH_REFRESH_TOKEN,
      accessToken: accessToken
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
};

// Base email template
const getEmailTemplate = (content, showFooter = true) => {
  const logoUrl = process.env.LOGO_URL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/habits.png`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Habit Tracker</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0fdfa;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); padding: 32px; text-align: center;">
      <div style="display: inline-flex; align-items: center; background: white; border-radius: 12px; padding: 12px 20px; margin-bottom: 16px;">
        <img src="${logoUrl}" alt="Habit Tracker" style="width: 36px; height: 36px; border-radius: 8px;" />
        <span style="font-size: 22px; font-weight: 700; color: #0f172a; margin-left: 10px;">Habit Tracker</span>
      </div>
      <p style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin: 0;">Build Better Habits, One Day at a Time</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px;">
      ${content}
    </div>
    
    ${showFooter ? `
    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
      <div style="margin-bottom: 12px;">
        <img src="${logoUrl}" alt="Habit Tracker" style="width: 28px; height: 28px; border-radius: 6px; vertical-align: middle;" />
        <span style="font-size: 14px; font-weight: 600; color: #0f172a; margin-left: 6px; vertical-align: middle;">Habit Tracker</span>
      </div>
      <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0;">
        This email was sent by Habit Tracker
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} Habit Tracker. All rights reserved.
      </p>
      <div style="margin-top: 16px;">
        <a href="mailto:${process.env.CONTACT_EMAIL || 'support@habittracker.com'}" style="color: #10b981; text-decoration: none; font-size: 13px;">Contact Support</a>
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>
`;
};

// Subscription Approved Email
const getApprovalEmail = (userName) => {
  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #0f172a; font-size: 24px; margin: 0 0 8px 0;">Subscription Activated!</h1>
      <p style="color: #64748b; font-size: 16px; margin: 0;">Welcome to the Habit Tracker family</p>
    </div>
    
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
      Hi <strong>${userName}</strong>,
    </p>
    
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
      Great news! Your payment has been verified and your subscription is now <strong style="color: #10b981;">active</strong>. You now have full access to all premium features for the next <strong>365 days</strong>.
    </p>
    
    <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%); border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #10b981;">
      <h3 style="color: #0f172a; font-size: 16px; margin: 0 0 12px 0;">🎉 What you can do now:</h3>
      <ul style="color: #334155; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
        <li>Track unlimited habits</li>
        <li>View detailed analytics & streaks</li>
        <li>Set monthly goals</li>
        <li>Access your data across devices</li>
        <li>Get the verified badge on your profile</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
        Start Tracking Now →
      </a>
    </div>
    
    <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
      Thank you for supporting Habit Tracker. We're excited to help you build better habits!
    </p>
  `;
  return getEmailTemplate(content);
};

// Subscription Rejected Email
const getRejectionEmail = (userName, reason) => {
  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #0f172a; font-size: 24px; margin: 0 0 8px 0;">Subscription Request Declined</h1>
      <p style="color: #64748b; font-size: 16px; margin: 0;">We couldn't verify your payment</p>
    </div>
    
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
      Hi <strong>${userName}</strong>,
    </p>
    
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
      Unfortunately, we were unable to approve your subscription request. Our team has reviewed your payment details and found an issue.
    </p>
    
    <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #ef4444;">
      <h3 style="color: #991b1b; font-size: 16px; margin: 0 0 8px 0;">📋 Reason for Rejection:</h3>
      <p style="color: #7f1d1d; font-size: 14px; line-height: 1.6; margin: 0;">
        ${reason || 'Payment verification failed. Please ensure you submit a clear screenshot of the completed payment.'}
      </p>
    </div>
    
    <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #10b981;">
      <h3 style="color: #166534; font-size: 16px; margin: 0 0 12px 0;">🔄 What you can do:</h3>
      <ol style="color: #334155; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
        <li>Make sure the payment is completed successfully</li>
        <li>Take a clear screenshot showing the transaction details</li>
        <li>Login again and submit a new subscription request</li>
      </ol>
    </div>
    
    <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
      If you believe this was a mistake or need assistance, please contact us at 
      <a href="mailto:${process.env.CONTACT_EMAIL || 'support@habittracker.com'}" style="color: #10b981; text-decoration: none;">${process.env.CONTACT_EMAIL || 'support@habittracker.com'}</a>
    </p>
  `;
  return getEmailTemplate(content);
};

// Custom Email Template
const getCustomEmail = (subject, body, imageUrl = null) => {
  const imageHtml = imageUrl ? `
    <div style="margin: 24px 0; text-align: center;">
      <img src="${imageUrl}" alt="Email Image" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);" />
    </div>
  ` : '';
  
  const content = `
    <h2 style="color: #0f172a; font-size: 22px; margin: 0 0 20px 0; text-align: center;">${subject}</h2>
    
    ${imageHtml}
    
    <div style="color: #334155; font-size: 15px; line-height: 1.7;">
      ${body.replace(/\n/g, '<br>')}
    </div>
  `;
  return getEmailTemplate(content);
};

// Send email function with minimal retry
const sendEmail = async (to, subject, html, retries = 1) => {
  const mailOptions = {
    from: `"Habit Tracker" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  };
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const transporter = await createTransporter();
      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent to:', to);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Email error:', error.message);
      
      if (attempt === retries) {
        return { success: false, error: error.message };
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return { success: false, error: 'Failed to send email' };
};

module.exports = {
  sendEmail,
  getApprovalEmail,
  getRejectionEmail,
  getCustomEmail
};
