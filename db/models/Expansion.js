const mongoose = require('mongoose');

const expansionSchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true },
  text: { type: String, required: true },
  lastUpdate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Expansion', expansionSchema);
