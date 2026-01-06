const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../db/models/User');
require('dotenv').config();


passport.use(new GoogleStrategy({
	clientID: process.env.GOOGLE_ID,
	clientSecret: process.env.GOOGLE_SECRET,
	callbackURL: process.env.CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
	// console.log('Access Token:', accessToken);
	const prof = profile._json;
	// console.log("PROF:", prof);
	const googleId = prof.sub;
	const displayName = prof.name;
	const email = prof.email;
	const picture = prof.picture;
	const existingUser = await User.findOneAndUpdate(
		{ googleId: googleId },
		{
			userName: displayName,
			userEmail: email,
			userPicture: picture
		}
	);
	if (existingUser) {
		console.log(`updating existing user!`);
		return done(null, existingUser);
	}
	const newUser =  await User.create({
		googleId: googleId,
		userName: displayName,
		userEmail: email,
		userPicture: picture
	});
	console.log(`adding new user!`);
	return done(null, newUser);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  if (!id || typeof id !== 'string' || !id.match(/^[0-9a-fA-F]{24}$/)) {
    return done(null, false);
  }
  User.findById(id).then(user => done(null, user)).catch(err => done(err));
});