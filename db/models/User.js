const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	googleId: { type: String, unique: true, required: true },
	userName: { type: String, required: true },
	userEmail: { type: String, required: true },
	userPicture: { type: String }
});

module.exports = mongoose.model('User', userSchema);