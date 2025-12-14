const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = decoded.userId;
    
    // Check if user is still active
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated. Please contact support.' });
    }
    
    // Check subscription status (except for subscription and profile routes)
    const isSubscriptionRoute = req.originalUrl.includes('/subscription') || req.originalUrl.includes('/auth/profile');
    if (!isSubscriptionRoute) {
      if (user.subscriptionStatus === 'none') {
        return res.status(403).json({ error: 'NO_SUBSCRIPTION', message: 'Please subscribe to use this service.' });
      }
      if (user.subscriptionStatus === 'pending') {
        return res.status(403).json({ error: 'SUBSCRIPTION_PENDING', message: 'Your payment is under verification. Account will be activated within 1 hour.' });
      }
      if (user.subscriptionStatus === 'expired') {
        return res.status(403).json({ error: 'SUBSCRIPTION_EXPIRED', message: 'Your subscription has expired. Please renew.' });
      }
    }
    
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
