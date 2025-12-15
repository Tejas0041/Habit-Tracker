const express = require('express');
const auth = require('../middleware/auth');
const Habit = require('../models/Habit');
const Tracking = require('../models/Tracking');
const Sleep = require('../models/Sleep');

const router = express.Router();

// Get today's progress data for widget
router.get('/progress', auth, async (req, res) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    // Get user's habits
    const habits = await Habit.find({ userId: req.userId }).sort({ order: 1 });
    
    // Get today's tracking data
    const tracking = await Tracking.find({
      userId: req.userId,
      year,
      month,
      [`days.${day}`]: { $exists: true }
    });
    
    // Calculate progress
    let completed = 0;
    const habitData = habits.map(habit => {
      const habitTracking = tracking.find(t => t.habitId.toString() === habit._id.toString());
      const isCompleted = habitTracking && habitTracking.days.get(day.toString()) > 0;
      
      if (isCompleted) completed++;
      
      return {
        name: habit.name,
        completed: isCompleted
      };
    });
    
    // Calculate current streak (simplified)
    let streak = 0;
    const currentDate = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() - i);
      
      const checkYear = checkDate.getFullYear();
      const checkMonth = checkDate.getMonth() + 1;
      const checkDay = checkDate.getDate();
      
      const dayTracking = await Tracking.find({
        userId: req.userId,
        year: checkYear,
        month: checkMonth,
        [`days.${checkDay}`]: { $exists: true }
      });
      
      const completedHabits = dayTracking.filter(t => t.days.get(checkDay.toString()) > 0).length;
      const totalHabits = habits.length;
      
      if (completedHabits >= Math.ceil(totalHabits * 0.7)) { // 70% completion threshold
        streak++;
      } else {
        break;
      }
    }
    
    res.json({
      completed,
      total: habits.length,
      streak,
      habits: habitData,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Widget progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress data' });
  }
});

// Get weekly stats data for widget
router.get('/stats', auth, async (req, res) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    // Get user's habits
    const habits = await Habit.find({ userId: req.userId });
    const totalHabits = habits.length;
    
    // Get last 7 days of data
    const weeklyData = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 6; i >= 0; i--) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      
      const checkYear = checkDate.getFullYear();
      const checkMonth = checkDate.getMonth() + 1;
      const checkDay = checkDate.getDate();
      
      const dayTracking = await Tracking.find({
        userId: req.userId,
        year: checkYear,
        month: checkMonth,
        [`days.${checkDay}`]: { $exists: true }
      });
      
      const completedHabits = dayTracking.filter(t => t.days.get(checkDay.toString()) > 0).length;
      const percentage = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;
      
      weeklyData.push(percentage);
    }
    
    // Calculate stats
    const weeklyAvg = weeklyData.length > 0 ? Math.round(weeklyData.reduce((a, b) => a + b, 0) / weeklyData.length) : 0;
    const bestDayIndex = weeklyData.indexOf(Math.max(...weeklyData));
    const bestDay = days[bestDayIndex] || 'Mon';
    
    // Calculate current streak
    let currentStreak = 0;
    const currentDate = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() - i);
      
      const checkYear = checkDate.getFullYear();
      const checkMonth = checkDate.getMonth() + 1;
      const checkDay = checkDate.getDate();
      
      const dayTracking = await Tracking.find({
        userId: req.userId,
        year: checkYear,
        month: checkMonth,
        [`days.${checkDay}`]: { $exists: true }
      });
      
      const completedHabits = dayTracking.filter(t => t.days.get(checkDay.toString()) > 0).length;
      
      if (completedHabits >= Math.ceil(totalHabits * 0.7)) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    res.json({
      weeklyData,
      weeklyAvg,
      bestDay,
      totalHabits,
      currentStreak,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Widget stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats data' });
  }
});

// Get sleep data for widget
router.get('/sleep', auth, async (req, res) => {
  try {
    const today = new Date();
    
    // Get last night's sleep (most recent entry)
    const lastSleep = await Sleep.findOne({ userId: req.userId })
      .sort({ date: -1 })
      .limit(1);
    
    // Get last 7 days of sleep data
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const weeklySleep = await Sleep.find({
      userId: req.userId,
      date: { $gte: sevenDaysAgo },
      sleepType: 'night'
    }).sort({ date: 1 });
    
    // Process weekly data
    const weeklyHours = [];
    const weeklyQualities = [];
    
    // Fill in data for last 7 days
    for (let i = 6; i >= 0; i--) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const dayData = weeklySleep.find(s => s.date.toISOString().split('T')[0] === dateStr);
      
      if (dayData) {
        weeklyHours.push(dayData.hours);
        weeklyQualities.push(dayData.quality);
      } else {
        weeklyHours.push(0); // No data for this day
        weeklyQualities.push(0);
      }
    }
    
    // Calculate stats
    const validHours = weeklyHours.filter(h => h > 0);
    const weeklyAvg = validHours.length > 0 ? 
      Math.round((validHours.reduce((a, b) => a + b, 0) / validHours.length) * 10) / 10 : 0;
    
    const bestNight = validHours.length > 0 ? Math.max(...validHours) : 0;
    
    // Calculate sleep debt (assuming 8 hours target)
    const targetHours = 8;
    const totalSleepThisWeek = validHours.reduce((a, b) => a + b, 0);
    const targetSleepThisWeek = targetHours * validHours.length;
    const sleepDebt = Math.round((totalSleepThisWeek - targetSleepThisWeek) * 10) / 10;
    
    // Calculate consistency (how many days had adequate sleep)
    const adequateSleepDays = validHours.filter(h => h >= 7).length;
    const consistency = validHours.length > 0 ? 
      Math.round((adequateSleepDays / validHours.length) * 100) : 0;
    
    // Format last night's data
    const lastNight = lastSleep ? {
      hours: lastSleep.hours,
      quality: lastSleep.quality,
      bedtime: lastSleep.bedtime || '22:00',
      wakeTime: lastSleep.wakeTime || '06:00'
    } : {
      hours: 0,
      quality: 0,
      bedtime: '22:00',
      wakeTime: '06:00'
    };
    
    res.json({
      lastNight,
      weeklyHours,
      weeklyAvg,
      sleepDebt,
      bestNight,
      consistency,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Widget sleep error:', error);
    res.status(500).json({ error: 'Failed to fetch sleep data' });
  }
});

module.exports = router;