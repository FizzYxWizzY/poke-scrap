const mongoose = require('mongoose');

const productCacheSchema = new mongoose.Schema({
  categoryId: { type: String, required: true },
  expansionId: { type: String, required: true },
  // Use Mixed type to allow flexible product data (for both regular products and singles results)
  products: [mongoose.Schema.Types.Mixed],
  lastUpdate: { type: Date, default: Date.now }
});

// Compound index for fast lookups
productCacheSchema.index({ categoryId: 1, expansionId: 1 }, { unique: true });

module.exports = mongoose.model('ProductCache', productCacheSchema);
