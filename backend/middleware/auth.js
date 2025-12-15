const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'ACCESS_DENIED', message: 'Access denied. No token provided.' });

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // Validate userId format to prevent injection
    if (!decoded.userId || typeof decoded.userId !== 'string' || decoded.userId.length !== 24) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid token format' });
    }
    
    req.userId = decoded.userId;
    
    // Check if user exists and is active
    const user = await User.findById(req.userId).select('isActive subscriptionStatus subscriptionExpiry isPaused name email');
    
    if (!user) {
      return res.status(401).json({ error: 'USER_NOT_FOUND', message: 'Your account no longer exists. Please contact support.' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ error: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated. Please contact support.' });
    }
    
    // Check if subscription is paused (applies to all routes)
    if (user.subscriptionStatus === 'active' && user.isPaused) {
      return res.status(403).json({ error: 'SUBSCRIPTION_PAUSED', message: 'Your subscription has been paused by admin. Please contact support.' });
    }
    
    // Check subscription status (except for subscription and profile routes)
    const isExemptRoute = req.originalUrl.includes('/subscription') || 
                          req.originalUrl.includes('/auth/profile') ||
                          req.originalUrl.includes('/auth/verify');
    
    if (!isExemptRoute) {
      // Check if subscription is active
      if (user.subscriptionStatus === 'none') {
        return res.status(403).json({ error: 'NO_SUBSCRIPTION', message: 'Please subscribe to use this service.' });
      }
      
      if (user.subscriptionStatus === 'pending') {
        return res.status(403).json({ error: 'SUBSCRIPTION_PENDING', message: 'Your payment is under verification. Account will be activated within 1 hour.' });
      }
      
      // Check if subscription has expired
      if (user.subscriptionStatus === 'active' && user.subscriptionExpiry) {
        const now = new Date();
        if (new Date(user.subscriptionExpiry) < now) {
          // Auto-update to expired status
          await User.findByIdAndUpdate(req.userId, { subscriptionStatus: 'expired' });
          return res.status(403).json({ error: 'SUBSCRIPTION_EXPIRED', message: 'Your subscription has expired. Please renew to continue.' });
        }
      }
      
      if (user.subscriptionStatus === 'expired') {
        return res.status(403).json({ error: 'SUBSCRIPTION_EXPIRED', message: 'Your subscription has expired. Please renew to continue.' });
      }
    }
    
    // Attach user info to request for downstream use
    req.user = { id: user._id, name: user.name, email: user.email, subscriptionStatus: user.subscriptionStatus };
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Your session has expired. Please login again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid authentication token.' });
    }
    console.error('Auth middleware error:', err);
    res.status(401).json({ error: 'AUTH_ERROR', message: 'Authentication failed.' });
  }
};
