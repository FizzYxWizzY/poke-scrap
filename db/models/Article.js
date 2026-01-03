const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
	articleName: { type: String, required: true },
	articleImage: { type: String, default: null },
	articlePrice: { type: String, required: true },
	articleAmount: { type: String, required: true },
	articleLanguage: { type: String, required: true },
	articleCategorie: { type: String, required: true },
	sellerName: { type: String, required: true },
	sellerLevel: { type: String, required: true },
	sellerCountry: { type: String, required: true },
	sellerComment: { type: String, default: null },
	lastUpdate: { type: Date, default: Date.now }
});
  
  module.exports = mongoose.model('Article', articleSchema);