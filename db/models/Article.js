const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
	articleName: { type: String, required: true },
	articlePrice: { type: Number, required: true },
	articleAmount: { type: Number },
	articleLanguage: { type: String },
	articleType: { type: String },
	lastUpdate: { type: Date, default: Date.now },
	seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' }
});
  
  module.exports = mongoose.model('Article', articleSchema);