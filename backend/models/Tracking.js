const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  completed: { type: Boolean, default: false },
  score: { type: Number, default: 0 } // Score earned for this completion
});

trackingSchema.index({ userId: 1, habitId: 1, date: 1 }, { unique: true });
trackingSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Tracking', trackingSchema);
