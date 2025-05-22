// require("name.js");
// server.js
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

require('dotenv').config();
const app = express();

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
	}
);


// app.get('/user', (req, res) => {
// 	res.send(prof.json);
// })

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
		req.session.destroy(() => {
		res.sendFile("/home/kali/Desktop/poke-scrap/test.html"); // Or any page you want
	  });
	});
  });

app.listen(5000, () => console.log('Serveur sur le port 5000'));
