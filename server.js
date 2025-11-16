const connectDB = require('./db/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const sellerRoutes = require('./routes/sellers');
const articleRoutes = require('./routes/articles');
const watchlistRoutes = require('./routes/watchlists');
require('./auth/google');
// require('./middlewares/auth');
const Article = require('./db/models/Article');

// server.js
const { spawn } = require('child_process');
const passport = require('passport');
const express = require('express');
const session = require('express-session');

require('dotenv').config();
const app = express();
app.use(express.json());

connectDB();

// Session (obligatoire pour Passport)
app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/watchlists', watchlistRoutes);


// sa doit etre useless, il y a ces info dans req.session.XXX
app.get('/user', (req, res) => {
	if (!req.isAuthenticated()) return res.status(401).json({ error: 'Non connecté' });
	res.json({
		googleId: req.user.googleId,
		name: req.user.userName,
		picture: req.user.userPicture,
		email: req.user.userEmail
	});

});

app.get('/watch', (req, res) => {
	if (!req.isAuthenticated()) return res.status(401).json({ error: 'Non connecté' });
	res.sendFile("/home/kali/Desktop/poke-scrap/views/test5.html");
	
});

app.get('/scrapper', (req, res) => {
	if (!req.isAuthenticated()) return res.status(401).json({ error: 'Non connecté' });
	res.sendFile("/home/kali/Desktop/poke-scrap/views/test4.html");
	
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
			res.sendFile("/home/kali/Desktop/poke-scrap/views/test.html"); // Or any page you want
	  });
	});
});

app.listen(5000, () => console.log(`Serveur sur le port 5000 (${new Date().toISOString()})`));
