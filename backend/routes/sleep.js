const express = require('express');
const Sleep = require('../models/Sleep');
const auth = require('../middleware/auth');

const router = express.Router();

// Get sleep data for a specific month
router.get('/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    
    const sleepData = await Sleep.find({
      userId: req.userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort('date');
    
    res.json(sleepData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sleep statistics for a month (night sleep only)
router.get('/stats/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    
    const sleepData = await Sleep.find({
      userId: req.userId,
      date: { $gte: startDate, $lte: endDate },
      sleepType: 'night'
    });
    
    if (sleepData.length === 0) {
      return res.json({
        totalNights: 0,
        avgDuration: 0,
        avgQuality: 0,
        maxSleep: null,
        minSleep: null,
        totalSleepHours: 0
      });
    }
    
    const totalDuration = sleepData.reduce((sum, s) => sum + s.duration, 0);
    const qualityData = sleepData.filter(s => s.quality);
    const avgQuality = qualityData.length > 0 
      ? qualityData.reduce((sum, s) => sum + s.quality, 0) / qualityData.length 
      : 0;
    
    const sorted = [...sleepData].sort((a, b) => b.duration - a.duration);
    
    res.json({
      totalNights: sleepData.length,
      avgDuration: Math.round(totalDuration / sleepData.length),
      avgQuality: Math.round(avgQuality * 10) / 10,
      maxSleep: sorted[0],
      minSleep: sorted[sorted.length - 1],
      totalSleepHours: Math.round(totalDuration / 60 * 10) / 10
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add or update sleep entry
router.post('/', auth, async (req, res) => {
  try {
    const { date, bedtime, wakeTime, duration, quality, notes, sleepType = 'night', napIndex = 0 } = req.body;
    
    if (!date || !duration) {
      return res.status(400).json({ error: 'Date and duration are required' });
    }
    
    const sleepEntry = await Sleep.findOneAndUpdate(
      { userId: req.userId, date, sleepType, napIndex },
      { 
        bedtime, 
        wakeTime, 
        duration, 
        quality: quality || null, 
        notes: notes || null,
        sleepType,
        napIndex
      },
      { upsert: true, new: true }
    );
    
    res.json(sleepEntry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete sleep entry
router.delete('/:date', auth, async (req, res) => {
  try {
    const { sleepType = 'night', napIndex = 0 } = req.query;
    await Sleep.findOneAndDelete({
      userId: req.userId,
      date: req.params.date,
      sleepType,
      napIndex: parseInt(napIndex)
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get next nap index for a date
router.get('/next-nap-index/:date', auth, async (req, res) => {
  try {
    const naps = await Sleep.find({
      userId: req.userId,
      date: req.params.date,
      sleepType: 'nap'
    });
    res.json({ nextIndex: naps.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Migration route to fix index issue
router.post('/migrate-indexes', auth, async (req, res) => {
  try {
    const collection = Sleep.collection;
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);
    
    // Drop ALL indexes except _id
    for (const index of indexes) {
      if (index.name !== '_id_') {
        try {
          await collection.dropIndex(index.name);
          console.log(`Dropped index: ${index.name}`);
        } catch (err) {
          console.log(`Failed to drop index ${index.name}:`, err.message);
        }
      }
    }
    
    // Create only the non-unique compound index for performance
    await collection.createIndex(
      { userId: 1, date: 1, sleepType: 1, napIndex: 1 }, 
      { unique: false, name: 'userId_date_sleepType_napIndex' }
    );
    
    console.log('Created new non-unique compound index');
    res.json({ message: 'Index migration completed - removed all unique constraints' });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
