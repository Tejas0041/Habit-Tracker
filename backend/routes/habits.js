const express = require('express');
const Habit = require('../models/Habit');
const Tracking = require('../models/Tracking');
const MonthlyGoal = require('../models/MonthlyGoal');
const MonthlyHabitName = require('../models/MonthlyHabitName');
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
      
      // Get monthly names for this period
      const monthlyNames = await MonthlyHabitName.find({
        userId: req.userId,
        year: parseInt(year),
        month: parseInt(month)
      });
      
      const goalMap = {};
      monthlyGoals.forEach(mg => { goalMap[mg.habitId.toString()] = mg.goal; });
      
      const nameMap = {};
      monthlyNames.forEach(mn => { nameMap[mn.habitId.toString()] = mn.name; });
      
      // Merge goals and names with habits
      const habitsWithGoals = habits.map(h => ({
        ...h.toObject(),
        goal: goalMap[h._id.toString()] !== undefined ? goalMap[h._id.toString()] : h.goal,
        name: nameMap[h._id.toString()] !== undefined ? nameMap[h._id.toString()] : h.name,
        originalName: h.name // Keep original name for reference
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

// Update name for a specific month
router.put('/:id/name', auth, async (req, res) => {
  try {
    const { year, month, name, isCurrentMonth } = req.body;
    const habitId = req.params.id;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    // Verify habit belongs to user
    const habit = await Habit.findOne({ _id: habitId, userId: req.userId });
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    
    const oldName = habit.name;
    
    if (isCurrentMonth) {
      // For current month: 
      // 1. First, preserve the old name for all PAST months that don't have an override
      // 2. Then update the habit's default name (affects current and future months)
      
      // Get all existing monthly name overrides for this habit
      const existingOverrides = await MonthlyHabitName.find({
        userId: req.userId,
        habitId
      });
      const overrideMap = {};
      existingOverrides.forEach(o => {
        overrideMap[`${o.year}-${o.month}`] = true;
      });
      
      // Create overrides for past months that don't have one (to preserve old name)
      const habitCreatedAt = new Date(habit.createdAt);
      const currentDate = new Date(yearNum, monthNum - 1, 1);
      
      const bulkOps = [];
      let checkDate = new Date(habitCreatedAt.getFullYear(), habitCreatedAt.getMonth(), 1);
      
      while (checkDate < currentDate) {
        const checkYear = checkDate.getFullYear();
        const checkMonth = checkDate.getMonth() + 1;
        const key = `${checkYear}-${checkMonth}`;
        
        // Only create override if one doesn't exist for this past month
        if (!overrideMap[key]) {
          bulkOps.push({
            updateOne: {
              filter: { userId: req.userId, habitId, year: checkYear, month: checkMonth },
              update: { $setOnInsert: { name: oldName } },
              upsert: true
            }
          });
        }
        
        // Move to next month
        checkDate.setMonth(checkDate.getMonth() + 1);
      }
      
      if (bulkOps.length > 0) {
        await MonthlyHabitName.bulkWrite(bulkOps);
      }
      
      // Now update the habit's default name (for current and future)
      await Habit.findByIdAndUpdate(habitId, { name });
      
      // Remove any monthly name override for current month since we're using the default
      await MonthlyHabitName.deleteOne({
        userId: req.userId,
        habitId,
        year: yearNum,
        month: monthNum
      });
    } else {
      // For past months: only create/update monthly name override (doesn't affect other months)
      await MonthlyHabitName.findOneAndUpdate(
        { userId: req.userId, habitId, year: yearNum, month: monthNum },
        { name },
        { upsert: true, new: true }
      );
    }
    
    res.json({ message: 'Name updated', name });
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
