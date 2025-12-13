const express = require('express');
const Habit = require('../models/Habit');
const Tracking = require('../models/Tracking');
const MonthlyGoal = require('../models/MonthlyGoal');
const auth = require('../middleware/auth');

const router = express.Router();

// Get habits with goals for a specific month
router.get('/', auth, async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (year && month) {
      // Get the first and last day of the requested month
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      
      // One-time migration: backdate habits that don't have proper createdAt
      const recentHabits = await Habit.find({
        userId: req.userId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Created in last 24 hours
      });
      
      if (recentHabits.length > 0) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        await Habit.updateMany(
          { _id: { $in: recentHabits.map(h => h._id) } },
          { createdAt: oneYearAgo }
        );
      }
      
      // Find habits that existed during this month (created before end of month, not deleted or deleted after start of month)
      const habits = await Habit.find({
        userId: req.userId,
        createdAt: { $lte: endOfMonth },
        $or: [
          { deletedAt: null },
          { deletedAt: { $gt: endOfMonth } }
        ]
      }).sort('order');
      
      // Get monthly goals for this period
      const monthlyGoals = await MonthlyGoal.find({
        userId: req.userId,
        year: parseInt(year),
        month: parseInt(month)
      });
      
      const goalMap = {};
      monthlyGoals.forEach(mg => { goalMap[mg.habitId.toString()] = mg.goal; });
      
      // Merge goals with habits
      const habitsWithGoals = habits.map(h => ({
        ...h.toObject(),
        goal: goalMap[h._id.toString()] !== undefined ? goalMap[h._id.toString()] : h.goal
      }));
      
      return res.json(habitsWithGoals);
    }
    
    // For current view, only show non-deleted habits
    const habits = await Habit.find({ userId: req.userId, deletedAt: null }).sort('order');
    res.json(habits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const count = await Habit.countDocuments({ userId: req.userId });
    const habit = await Habit.create({
      ...req.body,
      userId: req.userId,
      order: count
    });
    res.status(201).json(habit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    res.json(habit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update goal for a specific month (and future months)
router.put('/:id/goal', auth, async (req, res) => {
  try {
    const { year, month, goal } = req.body;
    const habitId = req.params.id;
    
    // Verify habit belongs to user
    const habit = await Habit.findOne({ _id: habitId, userId: req.userId });
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    
    // Update or create monthly goal for current and future months
    await MonthlyGoal.findOneAndUpdate(
      { userId: req.userId, habitId, year, month },
      { goal },
      { upsert: true, new: true }
    );
    
    // Update default goal for future months (on the habit itself)
    await Habit.findByIdAndUpdate(habitId, { goal });
    
    res.json({ message: 'Goal updated', goal });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    // Soft delete: mark as deleted instead of removing
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { deletedAt: new Date() },
      { new: true }
    );
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    // Don't delete tracking data - keep it for historical purposes
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
