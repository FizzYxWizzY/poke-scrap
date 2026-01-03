const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cron = require('node-cron');
require('dotenv').config();

const connectDB = require('./db/database');
const ensureAuth = require('./middlewares/auth');
const { checkAllWatchlists } = require('./services/priceChecker');
const { verifyEmailConfig } = require('./services/emailService');
const { updateOptionsFromCardmarket } = require('./services/optionsService');
require('./auth/google');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const sellerRoutes = require('./routes/sellers');
const articleRoutes = require('./routes/articles');
const watchlistRoutes = require('./routes/watchlists');
const optionsRoutes = require('./routes/options');
const recentRoutes = require('./routes/recent');
const app = express();
app.use(express.json());

connectDB();

// Session (obligatoire pour Passport)
app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
	cookie: {
		secure: process.env.NODE_ENV === 'production',
		maxAge: 24 * 60 * 60 * 1000 // 24 hours
	}
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/watchlists', watchlistRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/recent', recentRoutes);


// Static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/user', ensureAuth, (req, res) => {
	res.json({
		googleId: req.user.googleId,
		name: req.user.userName,
		picture: req.user.userPicture,
		email: req.user.userEmail
	});
});

// Dashboard page (after login)
app.get('/dashboard', ensureAuth, (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'dashboard-new.html'));
});

app.get('/api/watch', ensureAuth, (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'watchlist-new.html'));
});

// Search page - PUBLIC (no auth required)
app.get('/api/scrapper', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'search-new.html'));
});

app.get('/api/logout', (req, res) => {
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
			
			// Check if this is an AJAX request
			if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json')) {
				res.json({ success: true, message: 'Logged out successfully' });
			} else {
				res.sendFile(path.join(__dirname, 'views', 'login-new.html'));
			}
		});
	});
});

// Login page
app.get('/login', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'login-new.html'));
});

// Home page redirect - now goes to search (public)
app.get('/', (req, res) => {
	res.redirect('/api/scrapper');
});

// Manual trigger for price check (admin only - protected by auth)
app.get('/api/check-prices', ensureAuth, async (req, res) => {
	console.log('🧪 Test manuel du price checker déclenché par:', req.user.userEmail);
	const result = await checkAllWatchlists();
	res.json(result);
});

// 404 handler
app.use((req, res) => {
	res.status(404).sendFile(path.join(__dirname, 'views', 'login-new.html'));
});

console.log("CALLBACK_URL ACTUEL :", process.env.CALLBACK_URL);

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
	console.log(`Serveur sur le port ${PORT} (${new Date().toISOString()})`);
	
	// Verify email configuration
	if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
		await verifyEmailConfig();
		
		// Schedule price checker to run every hour
		cron.schedule('0 * * * *', async () => {
			console.log('⏰ Cron job: Vérification des prix...');
			await checkAllWatchlists();
		});
		console.log('⏰ Cron job configuré: vérification des prix toutes les heures');
	} else {
		console.log('⚠️ Email non configuré: GMAIL_USER et GMAIL_APP_PASSWORD manquants');
	}
	
	// Schedule options update daily at 3am
	cron.schedule('0 3 * * *', async () => {
		console.log('📋 Cron job: Mise à jour des catégories/expansions...');
		await updateOptionsFromCardmarket();
	});
	console.log('📋 Cron job configuré: mise à jour des options tous les jours à 3h');
	
	// Initial load of options if DB is empty
	const Category = require('./db/models/Category');
	const categoryCount = await Category.countDocuments();
	if (categoryCount === 0) {
		console.log('📋 Base vide, chargement initial des options...');
		await updateOptionsFromCardmarket();
	}
});
