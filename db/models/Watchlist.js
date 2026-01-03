const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
	userEmail: { type: String, required: true },
	articleName: { type: String, required: true },
	articleImage: { type: String, default: null },
	articleLanguage: { type: String, required: true },
	articleCategorie: { type: String, required: true },
	productPath: { type: String, default: null }, // Full path for direct scraping
	sellerCountry: { type: String, required: true },
	targetPrice: { type: Number, required: true },
	lastNotified: { type: Date, default: null },
	isActive: { type: Boolean, default: true }
});

// ✅ Crée un index unique sur l'ensemble des champs clés (hors prix)
watchlistSchema.index(
	{
	  userEmail: 1,
	  articleName: 1,
	  articleLanguage: 1,
	  articleCategorie: 1,
	  sellerCountry: 1
	},
	{ unique: true }
  );

module.exports = mongoose.model('Watchlist', watchlistSchema);