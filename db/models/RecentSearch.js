const mongoose = require('mongoose');

const recentSearchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  productPath: {
    type: String,
    required: true,
    unique: true
  },
  image: {
    type: String,
    default: null
  },
  searchedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for sorting by most recent
recentSearchSchema.index({ searchedAt: -1 });

module.exports = mongoose.model('RecentSearch', recentSearchSchema);
