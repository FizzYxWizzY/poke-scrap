const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	googleId: { type: String, unique: true, required: true },
	userName: { type: String, required: true },
	userEmail: { type: String, unique: true, required: true },
	userPicture: { type: String },
	role: { 
		type: String, 
		enum: ['free', 'paid', 'betatester', 'admin'], 
		default: 'free' 
	}
});

module.exports = mongoose.model('User', userSchema);