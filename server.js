
const connectDB = require('./db/database');
const userRoutes = require('./db/routes/users');
const sellerRoutes = require('./db/routes/sellers');
const articleRoutes = require('./db/routes/articles');
const watchlistRoutes = require('./db/routes/watchlists');
require('./auth/google');

// server.js
const { spawn } = require('child_process');
const passport = require('passport');
const express = require('express');
const session = require('express-session');

require('dotenv').config();
const app = express();

connectDB();

// Session (obligatoire pour Passport)
app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// Serialisation
// passport.serializeUser((user, done) => done(null, user));
// passport.deserializeUser((obj, done) => done(null, obj));

// let googleId = "";
// let displayName = "";
// let email = "";
// let picture = "";
let prof = "";

// Google OAuth Strategy
// passport.use(new GoogleStrategy({
// 	clientID: process.env.GOOGLE_ID,
// 	clientSecret: process.env.GOOGLE_SECRET,
// 	callbackURL: process.env.CALLBACK_URL
// }, async (accessToken, refreshToken, profile, done) => {
// 	// console.log('Access Token:', accessToken);
// 	prof = profile._json;
// 	googleId = prof.sub;
// 	displayName = prof.name;
// 	email = prof.email;
// 	picture = prof.picture;
// 	const existingUser = await User.findOne({ googleId: profile.id });
// 	if (existingUser) return done(null, existingUser);
// 	const newUser =  await User.create({
// 		googleId: googleId,
// 		name: displayName,
// 		email: email,
// 		picture: picture
// 	});
// 	return done(null, profile);
// }));

// Routes OAuth
app.get('/auth/google',
	passport.authenticate('google', { scope: ['email', 'profile'] })
);

app.get('/auth/google/callback',
	passport.authenticate('google', { failureRedirect: '/' }),
	(req, res) => {
    	res.sendFile(`/home/kali/Desktop/poke-scrap/test2.html`);
});

app.get('/user', (req, res) => {
	if (!req.isAuthenticated()) return res.status(401).json({ error: 'Non connecté' });
	res.json({
		googleId: req.user.googleId,
		name: req.user.userName,
		picture: req.user.userPicture,
		email: req.user.userEmail
	});

});

app.get('/logout', (req, res) => {
	req.logout(err => {
		if (err) {
			console.error('Logout error:', err);
			return res.status(500).send('Logout failed.');
		}
		req.session.destroy((err) => {
			if (err) {
				console.error('Session destroy error:', err);
				return res.status(500).send('Session failed.');
			}
			res.clearCookie('connect.sid');
			res.sendFile("/home/kali/Desktop/poke-scrap/test.html"); // Or any page you want
	  });
	});
});

app.get('/scrapper', (req, res) => {
	if (!req.isAuthenticated()) return res.status(401).json({ error: 'Non connecté' });
	res.sendFile("/home/kali/Desktop/poke-scrap/test3.html");
	
});

app.get('/run-scrapper', (req, res) => {
	// if (!req.isAuthenticated()) return res.status(401).json({ error: 'Non connecté' });
	// const arg1 = req.query.arg1 || 'etb';
	// const arg1 = 'etb';
	// const arg2 = req.query.arg2 || 'prismatic evolutions';
	// const arg2 = 'prismatic evolutions';

	const { arg1, arg2 } = req.query;
	console.log(`arg1 = ${arg1}, arg2 = ${arg2}`);
	const scrapper = spawn('node', ['scrapper.js', arg1, arg2]);

	let output = '';
	scrapper.stdout.on('data', data => {
		output += data.toString();
	});

	scrapper.stderr.on('data', data => {
		console.error(`Erreur scrapper : ${data}`);
	});

	scrapper.stderr.on('data', data => {
		console.error(`Erreur scrapper : ${data}`);
	});

	scrapper.on('close', code => {
		if (code !== 0) return res.status(500).send('Erreur du scrapper');
	
		try {
			const result = JSON.parse(output);
			res.json(result);
		} catch (err) {
			res.status(500).send('Erreur de parsing JSON : ' + err.message);
		}
	  });
});




app.use('/api/users', userRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/watchlists', watchlistRoutes);

app.listen(5000, () => console.log('Serveur sur le port 5000'));
