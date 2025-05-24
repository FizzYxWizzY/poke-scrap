const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
	targetPrice: { type: Number, required: true }
}, {
	timestamps: true
});
  
watchlistSchema.index({ user: 1, article: 1 }, { unique: true });
  
module.exports = mongoose.model('Watchlist', watchlistSchema);