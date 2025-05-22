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

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_ID,
  clientSecret: process.env.GOOGLE_SECRET,
  callbackURL: process.env.CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  // Ici tu peux enregistrer le user dans ta DB si besoin
  console.log('Access Token:', accessToken);
  console.log('Profile:', profile);
  return done(null, profile);
}));

// Routes OAuth
app.get('/auth/google',
  passport.authenticate('google', { scope: ['email', 'profile'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.send('Connecté avec succès via Google !');
  });

app.listen(5000, () => console.log('Serveur sur le port 5000'));
