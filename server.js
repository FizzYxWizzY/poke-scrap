
const connectDB = require('./db/database');
const userRoutes = require('./db/routes/users');
const sellerRoutes = require('./db/routes/sellers');
const articleRoutes = require('./db/routes/articles');
const watchlistRoutes = require('./db/routes/watchlists');
require('./auth/google');
const Article = require('./db/models/Article');

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

// app.get('/run-scrapper', (req, res) => {
	
// 	const { arg1, arg2 } = req.query;
// 	console.log(`arg1 = ${arg1}, arg2 = ${arg2}`);

// 	const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

// 	Article.find({
// 		article: arg2,
// 		articleLanguage: "fr",
// 		articleCategorie: arg1,
// 		sellerCountry: "ch",
// 		lastUpdate: { $gt: fiveMinutesAgo }
// 	})
// 	.then(async foundArticles => {
// 		if (foundArticles.length > 0) {
// 			console.log(`data came from article db.`);
// 			return res.json(foundArticles);
// 		}
	

// 	const scrapper = spawn('node', ['scrapper.js', arg1, arg2]);

// 	let output = '';
// 	scrapper.stdout.on('data', data => {
// 		output += data.toString();
// 	});

// 	scrapper.stderr.on('data', data => {
// 		console.error(`Erreur scrapper : ${data}`);
// 	});

// 	scrapper.on('close', code =>  {
// 		if (code !== 0) return res.status(500).send('Erreur du scrapper');
		
// 		try {
// 			const result = JSON.parse(output);
// 			res.json(result);
// 		} catch (err) {
// 			res.status(500).send('Erreur de parsing JSON : ' + err.message);
// 		}
// 		for (const article of res) {
// 			const exists = article.findOneAndUpdate(
// 			{
// 				articleName: arg2,
// 				articlePrice: article.price,
// 				articleLanguage: "fr",
// 				articleCategorie: arg1,
// 				sellerName: article.name,
// 				sellerCountry: "ch"
// 			},
// 			{
// 				articleAmount: article.amount,
// 				sellerLevel: article.sales,
// 				lastUpdate: Date.now()
// 			});
// 			if (!exists) {
// 				article.create(
// 				{
// 					articleName: article.article,
// 					articlePrice: article.price,
// 					articleAmount: article.amount,
// 					articleLanguage: "fr",
// 					articleCategorie: article.categorie,
// 					sellerName: article.name,
// 					sellerLevel: article.sales,
// 					sellerCountry: "ch"
// 				});
// 			}
// 		}
		
// 		Article.deleteMany({
// 			lastUpdate: { $lt: fiveMinutesAgo }
// 		});
		
// 		console.log(`existing data updated from article db, and new articles.`);
// 	});
// });

app.get('/run-scrapper', async (req, res) => {
	const { arg1, arg2 } = req.query;
	console.log(`arg1 = ${arg1}, arg2 = ${arg2}`);

	const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

	try {
		const articles = await Article.find({
			articleName: arg2,
			articleLanguage: "fr",
			articleCategorie: arg1,
			sellerCountry: "ch",
			lastUpdate: { $gt: fiveMinutesAgo }
		});

		if (articles.length > 0) {
			console.log(`✅ Données récentes trouvées dans la base.`);
			// console.log('Réponse envoyée au frontend :', JSON.stringify(articles || result, null, 2));
			return res.json(articles); // stoppe ici si données présentes
		}
	} catch (err) {
		console.error('❌ Erreur lors de la recherche MongoDB :', err.message);
		return res.status(500).send('Erreur lors de la recherche en base.');
	}
	console.log(`❌ pas de données récentes trouvées dans la base.`);
	// ⚠️ Si on arrive ici, pas de données fraîches → on lance le scrapper
	const scrapper = spawn('node', ['scrapper.js', arg1, arg2]);

	let output = '';
	scrapper.stdout.on('data', data => output += data.toString());
	scrapper.stderr.on('data', data => console.error(`Erreur scrapper : ${data}`));

	scrapper.on('close', async code => {
		if (code !== 0) return res.status(500).send('Erreur du scrapper');

		try {
			const result = JSON.parse(output);

			// Nettoyage des données
			const cleanedArticles = result.map(article => ({
				articleName: arg2,
				articlePrice: article.price,
				articleAmount: article.amount,
				articleLanguage: "fr",
				articleCategorie: arg1,
				sellerName: article.name,
				sellerLevel: article.sales,
				sellerCountry: "ch",
				lastUpdate: Date.now()
			}));

			// Update ou insert
			for (const article of cleanedArticles) {
				await Article.findOneAndUpdate(
					{
						articleName: article.articleName,
						articlePrice: article.articlePrice,
						articleLanguage: article.articleLanguage,
						articleCategorie: article.articleCategorie,
						sellerName: article.sellerName,
						sellerCountry: article.sellerCountry
					},
					article,
					{ upsert: true }
				);
			}

			// Suppression des anciens
			await Article.deleteMany({
				articleName: arg2,
				articleLanguage: "fr",
				articleCategorie: arg1,
				lastUpdate: { $lt: fiveMinutesAgo }
			});

			console.log('✅ Articles mis à jour et nettoyés.');
			try {
				const art = await Article.find({
					articleName: arg2,
					articleLanguage: "fr",
					articleCategorie: arg1,
					sellerCountry: "ch",
					lastUpdate: { $gt: fiveMinutesAgo }
				});
		
				if (art.length > 0) {
					console.log(`✅ Données récentes trouvées dans la base.`);
					// console.log('Réponse envoyée au frontend :', JSON.stringify(art, null, 2));
					return res.json(art); // stoppe ici si données présentes
				}
			} catch (err) {
				console.error('❌ Erreur lors de la recherche MongoDB :', err.message);
				return res.status(500).send('Erreur lors de la recherche en base.');
			}

		} catch (err) {
			console.error('❌ Erreur parsing JSON ou enregistrement:', err.message);
			res.status(500).send('Erreur parsing JSON : ' + err.message);
		}
	});
});


app.use('/api/users', userRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/watchlists', watchlistRoutes);

app.listen(5000, () => console.log('Serveur sur le port 5000'));
