const mongoose = require('mongoose');

const monthlyHabitNameSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12
  name: { type: String, required: true }
});

monthlyHabitNameSchema.index({ userId: 1, habitId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyHabitName', monthlyHabitNameSchema);
