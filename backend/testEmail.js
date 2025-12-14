// Test email functionality
require('dotenv').config();
const { sendEmail, getApprovalEmail } = require('./utils/emailService');

async function testEmail() {
  console.log('Testing email configuration...');
  
  // Check environment variables
  console.log('Environment check:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Missing');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'Missing');
  console.log('OAUTH_CLIENT_ID:', process.env.OAUTH_CLIENT_ID ? 'Set' : 'Missing');
  console.log('OAUTH_CLIENT_SECRET:', process.env.OAUTH_CLIENT_SECRET ? 'Set' : 'Missing');
  console.log('OAUTH_REFRESH_TOKEN:', process.env.OAUTH_REFRESH_TOKEN ? 'Set' : 'Missing');
  
  const useOAuth = process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET && process.env.OAUTH_REFRESH_TOKEN;
  console.log('Using OAuth2:', useOAuth);
  
  // Test email
  const testEmailAddress = 'tejaspawar70238@gmail.com'; // Send to self for testing
  const testSubject = 'Test Email from Habit Tracker';
  const testHtml = getApprovalEmail('Test User');
  
  console.log('\nSending test email...');
  const result = await sendEmail(testEmailAddress, testSubject, testHtml);
  
  if (result.success) {
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
  } else {
    console.log('❌ Email failed to send');
    console.log('Error:', result.error);
  }
}

testEmail().catch(console.error);