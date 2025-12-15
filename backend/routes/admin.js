const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Habit = require('../models/Habit');
const Tracking = require('../models/Tracking');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to extract public_id from Cloudinary URL
const getCloudinaryPublicId = (url) => {
  if (!url) return null;
  try {
    // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{folder}/{public_id}.{format}
    const parts = url.split('/');
    const fileWithExt = parts[parts.length - 1];
    const folder = parts[parts.length - 2];
    const fileName = fileWithExt.split('.')[0];
    return `${folder}/${fileName}`;
  } catch (err) {
    console.error('Error extracting Cloudinary public_id:', err);
    return null;
  }
};

// Helper function to delete image from Cloudinary
const deleteCloudinaryImage = async (url) => {
  const publicId = getCloudinaryPublicId(url);
  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
      console.log('Deleted Cloudinary image:', publicId);
    } catch (err) {
      console.error('Error deleting Cloudinary image:', err);
    }
  }
};

const router = express.Router();

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ isAdmin: true, username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, admin: { username } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Verify admin token
router.get('/verify', adminAuth, (req, res) => {
  res.json({ valid: true, admin: req.admin });
});

// Get dashboard stats
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const deactivatedUsers = await User.countDocuments({ isActive: false });
    const pendingSubscriptions = await User.countDocuments({ subscriptionStatus: 'pending' });
    const activeSubscriptions = await User.countDocuments({ subscriptionStatus: 'active' });
    
    // IST offset: +5:30 hours
    const getISTDate = (daysAgo = 0) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      // Convert to IST
      const istOffset = 5.5 * 60 * 60 * 1000;
      const utc = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
      const istDate = new Date(utc + istOffset);
      istDate.setHours(0, 0, 0, 0);
      return istDate;
    };
    
    // Get users registered in last 7 days (IST)
    const weekAgo = getISTDate(7);
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: weekAgo } });
    
    // Get users registered in last 30 days (IST)
    const monthAgo = getISTDate(30);
    const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: monthAgo } });
    
    // Get recent activity (last 7 days tracking in IST)
    const recentActivity = await Tracking.countDocuments({ createdAt: { $gte: weekAgo } });
    
    // Get growth data for last 30 days (IST)
    const growthData = [];
    const subscriptionGrowthData = [];
    for (let i = 29; i >= 0; i--) {
      const date = getISTDate(i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await User.countDocuments({ 
        createdAt: { $gte: date, $lt: nextDate } 
      });
      
      // Count subscriptions approved on this day
      const subCount = await User.countDocuments({ 
        subscriptionDate: { $gte: date, $lt: nextDate },
        subscriptionStatus: 'active'
      });
      
      // Format date for display
      const displayDate = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      
      growthData.push({
        date: displayDate,
        users: count
      });
      
      subscriptionGrowthData.push({
        date: displayDate,
        subscriptions: subCount
      });
    }
    
    // Get top 5 most active users
    const topUsers = await Tracking.aggregate([
      { $group: { _id: '$userId', trackingCount: { $sum: 1 } } },
      { $sort: { trackingCount: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 1, trackingCount: 1, 'user.name': 1, 'user.email': 1, 'user.picture': 1 } }
    ]);

    res.json({
      totalUsers,
      activeUsers,
      deactivatedUsers,
      pendingSubscriptions,
      activeSubscriptions,
      newUsersThisWeek,
      newUsersThisMonth,
      growthData,
      subscriptionGrowthData,
      recentActivity,
      topUsers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users with pagination and search
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
    
    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (status === 'active') query.isActive = true;
    if (status === 'deactivated') query.isActive = false;
    
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-googleId');
    
    const total = await User.countDocuments(query);
    
    // Get habit count for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const habitCount = await Habit.countDocuments({ userId: user._id });
      const trackingCount = await Tracking.countDocuments({ userId: user._id });
      return { ...user.toObject(), habitCount, trackingCount };
    }));
    
    res.json({
      users: usersWithStats,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle user active status
router.put('/users/:id/toggle-status', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    user.isActive = !user.isActive;
    await user.save();
    
    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}`, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single user details
router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-googleId');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const habits = await Habit.find({ userId: user._id });
    const trackingCount = await Tracking.countDocuments({ userId: user._id });
    
    res.json({ user, habits, trackingCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user and all their data
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Delete all user's habits and tracking data
    await Habit.deleteMany({ userId: user._id });
    await Tracking.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User and all data deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending subscriptions
router.get('/subscriptions/pending', adminAuth, async (req, res) => {
  try {
    const pendingUsers = await User.find({ subscriptionStatus: 'pending' })
      .sort({ createdAt: -1 })
      .select('-googleId');
    
    res.json({ users: pendingUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all subscriptions (active, expired, pending)
router.get('/subscriptions/all', adminAuth, async (req, res) => {
  try {
    const allUsers = await User.find({ 
      subscriptionStatus: { $in: ['active', 'expired', 'pending'] }
    })
      .sort({ subscriptionDate: -1 })
      .select('-googleId');
    
    // Calculate days remaining for each user
    const usersWithDaysLeft = allUsers.map(user => {
      let daysLeft = 0;
      if (user.subscriptionStatus === 'active' && user.subscriptionExpiry) {
        if (!user.isPaused) {
          // For active subscriptions, calculate from current time
          const now = new Date();
          const expiry = new Date(user.subscriptionExpiry);
          daysLeft = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
        } else {
          // For paused subscriptions, calculate remaining days from pause date
          if (user.pausedAt) {
            const pausedAt = new Date(user.pausedAt);
            const expiry = new Date(user.subscriptionExpiry);
            daysLeft = Math.max(0, Math.ceil((expiry - pausedAt) / (1000 * 60 * 60 * 24)));
          }
        }
      }
      
      return {
        ...user.toObject(),
        daysLeft
      };
    });
    
    res.json({ users: usersWithDaysLeft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve subscription
router.put('/subscriptions/:id/approve', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const screenshotUrl = user.paymentScreenshot;
    
    const now = new Date();
    const expiry = new Date(now);
    expiry.setFullYear(expiry.getFullYear() + 1); // 1 year subscription
    
    user.subscriptionStatus = 'active';
    user.subscriptionDate = now;
    user.subscriptionExpiry = expiry;
    user.paymentScreenshot = null;
    await user.save();
    
    // Delete Cloudinary image in background
    if (screenshotUrl) {
      deleteCloudinaryImage(screenshotUrl).catch(() => {});
    }
    
    res.json({ message: 'Subscription approved', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject subscription
router.put('/subscriptions/:id/reject', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const screenshotUrl = user.paymentScreenshot;
    
    user.subscriptionStatus = 'none';
    user.paymentScreenshot = null;
    await user.save();
    
    // Delete Cloudinary image in background
    if (screenshotUrl) {
      deleteCloudinaryImage(screenshotUrl).catch(() => {});
    }
    
    res.json({ message: 'Subscription rejected', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pause subscription
router.put('/subscriptions/:id/pause', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.subscriptionStatus !== 'active') {
      return res.status(400).json({ error: 'Can only pause active subscriptions' });
    }
    
    if (user.isPaused) {
      return res.status(400).json({ error: 'Subscription is already paused' });
    }
    
    user.isPaused = true;
    user.pausedAt = new Date();
    await user.save();
    
    res.json({ message: 'Subscription paused successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resume subscription
router.put('/subscriptions/:id/resume', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.subscriptionStatus !== 'active') {
      return res.status(400).json({ error: 'Can only resume active subscriptions' });
    }
    
    if (!user.isPaused) {
      return res.status(400).json({ error: 'Subscription is not paused' });
    }
    
    // Calculate how long it was paused and extend expiry date
    const pausedAt = new Date(user.pausedAt);
    const now = new Date();
    const pausedDuration = now - pausedAt;
    
    if (user.subscriptionExpiry) {
      const currentExpiry = new Date(user.subscriptionExpiry);
      const newExpiry = new Date(currentExpiry.getTime() + pausedDuration);
      user.subscriptionExpiry = newExpiry;
    }
    
    user.isPaused = false;
    user.pausedAt = null;
    await user.save();
    
    res.json({ message: 'Subscription resumed successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
