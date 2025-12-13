const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  goal: { type: Number, default: 30 },
  color: { type: String, default: '#4CAF50' },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null }
});

habitSchema.index({ userId: 1, order: 1 });

module.exports = mongoose.model('Habit', habitSchema);
