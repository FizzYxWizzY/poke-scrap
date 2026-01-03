const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true },
  text: { type: String, required: true },
  lastUpdate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Category', categorySchema);
