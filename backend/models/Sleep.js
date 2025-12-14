const mongoose = require('mongoose');

const sleepSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD format
  sleepType: { type: String, enum: ['night', 'nap'], default: 'night' },
  napIndex: { type: Number, default: 0 }, // For multiple naps on same day (0, 1, 2...)
  bedtime: { type: String }, // HH:MM format (24hr)
  wakeTime: { type: String }, // HH:MM format (24hr)
  duration: { type: Number, required: true }, // Duration in minutes
  quality: { type: Number, min: 1, max: 5 }, // 1-5 rating
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// NO UNIQUE INDEXES - Allow multiple entries per date
// Only add a compound index for performance, not uniqueness
sleepSchema.index({ userId: 1, date: 1, sleepType: 1, napIndex: 1 });

module.exports = mongoose.model('Sleep', sleepSchema);
