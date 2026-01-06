const mongoose = require('mongoose');

const categoryExpansionSchema = new mongoose.Schema({
  categoryId: { type: String, required: true },
  categoryName: { type: String, required: true },
  expansions: [{
    value: { type: String, required: true },
    text: { type: String, required: true }
  }],
  lastUpdate: { type: Date, default: Date.now }
});

// Compound index to ensure uniqueness
categoryExpansionSchema.index({ categoryId: 1 }, { unique: true });

module.exports = mongoose.model('CategoryExpansion', categoryExpansionSchema);