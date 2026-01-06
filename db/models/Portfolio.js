const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
	userEmail: { type: String, required: true },
	articleName: { type: String, required: true },
	articleImage: { type: String, default: null },
	articleLanguage: { type: String, required: true },
	articleCategorie: { type: String, required: true },
	productPath: { type: String, default: null }, // Full path for direct scraping
	sellerCountry: { type: String, required: true },
	purchasePrice: { type: Number, required: true }, // Price user paid
	purchaseDate: { type: Date, default: Date.now },
	quantity: { type: Number, default: 1 },
	notes: { type: String, default: '' },
	isActive: { type: Boolean, default: true }
});

// ✅ Create a unique index to prevent duplicate entries
portfolioSchema.index(
	{
	  userEmail: 1,
	  articleName: 1,
	  articleLanguage: 1,
	  articleCategorie: 1,
	  sellerCountry: 1,
	  purchasePrice: 1
	},
	{ unique: true }
  );

module.exports = mongoose.model('Portfolio', portfolioSchema);