const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Habit = require('../models/Habit');
const auth = require('../middleware/auth');

const router = express.Router();

const defaultHabits = [
  { name: 'Running', goal: 30, color: '#FF6B6B' },
  { name: 'Meditation', goal: 25, color: '#4ECDC4' },
  { name: 'Taking a Bath', goal: 20, color: '#45B7D1' },
  { name: 'Eating healthy', goal: 25, color: '#96CEB4' },
  { name: 'Drink 2L of water', goal: 25, color: '#FFEAA7' },
  { name: 'Reading Books', goal: 15, color: '#DDA0DD' },
  { name: 'Stretching', goal: 28, color: '#98D8C8' },
  { name: 'Save $5', goal: 28, color: '#F7DC6F' },
  { name: 'Sleep early', goal: 25, color: '#BB8FCE' }
];

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let user = await User.findOne({ googleId });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({ googleId, email, name, picture });
      
      // Create default habits for new users with backdated createdAt (1 year ago)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const habitsToCreate = defaultHabits.map((h, i) => ({
        ...h,
        userId: user._id,
        order: i,
        createdAt: oneYearAgo
      }));
      await Habit.insertMany(habitsToCreate);
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user._id, name, email, picture, dob: user.dob, gender: user.gender }, isNewUser });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, name: user.name, email: user.email, picture: user.picture, dob: user.dob, gender: user.gender });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, dob, gender } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (dob !== undefined) updateData.dob = dob;
    if (gender !== undefined) updateData.gender = gender;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, name: user.name, email: user.email, picture: user.picture, dob: user.dob, gender: user.gender, createdAt: user.createdAt });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
