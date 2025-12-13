const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: { type: String, required: true },
  picture: { type: String },
  dob: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other', ''] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
