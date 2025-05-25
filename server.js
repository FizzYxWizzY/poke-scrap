
const connectDB = require('./db/database');
const userRoutes = require('./db/routes/users');
const sellerRoutes = require('./db/routes/sellers');
const articleRoutes = require('./db/routes/articles');
const watchlistRoutes = require('./db/routes/watchlists');

// server.js
const { spawn } = require('child_process');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

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
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

let displayName = "";
let prof = "";

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_ID,
  clientSecret: process.env.GOOGLE_SECRET,
  callbackURL: process.env.CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  // Ici tu peux enregistrer le user dans ta DB si besoin
  console.log('Access Token:', accessToken);
  console.log('Profile:', profile._json);
  prof = profile._json;
  console.log('email:', profile.emails[0].value);
  displayName = profile.displayName;

  return done(null, profile);
}));

// Routes OAuth
app.get('/auth/google',
  passport.authenticate('google', { scope: ['email', 'profile'] })
);

app.get('/auth/google/callback',
	passport.authenticate('google', { failureRedirect: '/' }),
	(req, res) => {
    	res.sendFile(`/home/kali/Desktop/poke-scrap/test2.html`);
	// res.redirect(`/welcome?name=${encodeURIComponent(displayName)}`);
});

app.get('/user', (req, res) => {
	if (!req.isAuthenticated()) return res.status(401).json({ error: 'Non connecté' });
  
	res.json({
		name: prof.name,
		picture: prof.picture,
		email: prof.email
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
