const express = require('express');
const Tracking = require('../models/Tracking');
const auth = require('../middleware/auth');

const router = express.Router();

// IMPORTANT: Specific routes MUST come before parameterized routes
// Otherwise /streaks/:habitId would match /:year/:month

router.post('/toggle', auth, async (req, res) => {
  try {
    const { habitId, date, completed, score } = req.body;
    
    const tracking = await Tracking.findOneAndUpdate(
      { userId: req.userId, habitId, date },
      { completed, score: completed ? (score || 0) : 0 },
      { upsert: true, new: true }
    );
    
    res.json(tracking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Debug endpoint to see raw tracking data
router.get('/debug/:habitId', auth, async (req, res) => {
  try {
    const trackings = await Tracking.find({
      userId: req.userId,
      habitId: req.params.habitId
    }).lean();
    res.json({ count: trackings.length, trackings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Streak calculation for a specific month
router.get('/streaks/:habitId/:year/:month', auth, async (req, res) => {
  try {
    const { habitId, year, month } = req.params;
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;

    const trackings = await Tracking.find({
      userId: req.userId,
      habitId: habitId,
      date: { $gte: startDate, $lte: endDate },
      completed: true
    }).lean();

    if (trackings.length === 0) {
      return res.json({ currentStreak: 0, longestStreak: 0 });
    }

    // Sort dates
    const sortedDates = trackings.map(t => t.date).sort((a, b) => a.localeCompare(b));

    let currentStreak = 0, longestStreak = 0, tempStreak = 0;
    let prevDate = null;
    let lastStreakEnd = null;

    for (const dateStr of sortedDates) {
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const prev = new Date(prevDate);
        const curr = new Date(dateStr);
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      prevDate = dateStr;
      lastStreakEnd = dateStr;
    }

    // For current streak: check if the last completed date is today or yesterday (IST)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const istDate = new Date(utc + istOffset);
    const today = istDate.toISOString().split('T')[0];

    if (lastStreakEnd) {
      const lastDate = new Date(lastStreakEnd);
      const todayDate = new Date(today);
      const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      
      // Current streak is active if last completion was today or yesterday
      currentStreak = (diffDays === 0 || diffDays === 1) ? tempStreak : 0;
    }

    res.json({ currentStreak, longestStreak });
  } catch (err) {
    console.error('Streak calculation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get daily score summary for a month
router.get('/scores/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    
    const trackings = await Tracking.find({
      userId: req.userId,
      date: { $gte: startDate, $lte: endDate },
      completed: true
    }).lean();
    
    // Group scores by date
    const scoresByDate = {};
    trackings.forEach(t => {
      if (!scoresByDate[t.date]) {
        scoresByDate[t.date] = 0;
      }
      scoresByDate[t.date] += t.score || 0;
    });
    
    res.json(scoresByDate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// This route MUST be last because /:year/:month would match any two-segment path
router.get('/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    
    const trackings = await Tracking.find({
      userId: req.userId,
      date: { $gte: startDate, $lte: endDate },
      completed: true
    });
    
    res.json(trackings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
