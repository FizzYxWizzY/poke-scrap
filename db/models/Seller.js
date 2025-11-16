const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
	sellerName: { type: String, required: true },
	sellerLevel: { type: String },
	sellerCountry: { type: String }
  });
  
  module.exports = mongoose.model('Seller', sellerSchema); 