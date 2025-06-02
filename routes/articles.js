const express = require('express');
const router = express.Router();
const Article = require('../db/models/Article');
const { spawn } = require('child_process');

// 🔹 CREATE
router.get('/', async (req, res) => {
	if (!req.isAuthenticated()) return res.status(401).json({ error: 'Non connecté' });
  
	const { category, language, country, serie } = req.query;
  
	if (!category || !language || !country || !serie) {
	  return res.status(400).send('Erreur : paramètres manquants');
	}
  
	const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
	try {
	  // Cherche les articles récents
	  const articles = await Article.find({
		articleName: serie,
		articleLanguage: language,
		articleCategorie: category,
		sellerCountry: country,
		lastUpdate: { $gt: fiveMinutesAgo }
	  });
  
	  // Si on a trouvé des articles récents, les retourner
	  if (articles.length > 0) {
		console.log(`✅ Données récentes trouvées dans la base. (${new Date().toISOString()})`);
		return res.json(articles);
	  }
  
	  console.log(`❌ Pas de données récentes, lancement du scrapper... (${new Date().toISOString()})`);
  
	  // Lancer le scrapper
	  console.log(`✅ Lancement du scrapper... (${new Date().toISOString()})`);
	  const scrapper = spawn('node', ['src/scrapper.js', category, serie, country, language]);
  
	  let output = '';
	  scrapper.stdout.on('data', data => output += data.toString());
	  scrapper.stderr.on('data', data => console.error(`Erreur scrapper : ${data}`));
  
	  scrapper.on('close', async code => {
		if (code !== 0) return res.status(500).send('Erreur du scrapper');
  
		try {
		  const result = JSON.parse(output);
  
		  const cleanedArticles = result.map(article => ({
			articleName: serie,
			articlePrice: article.price,
			articleAmount: article.amount,
			articleLanguage: language,
			articleCategorie: category,
			sellerName: article.name,
			sellerLevel: article.sales,
			sellerCountry: country,
			lastUpdate: Date.now()
		  }));
  
		  // Upsert chaque article
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
  
		  // Supprimer les anciens articles
		  await Article.deleteMany({
			articleName: serie,
			articleLanguage: language,
			articleCategorie: category,
			lastUpdate: { $lt: fiveMinutesAgo }
		  });
  
		  console.log(`✅ Articles mis à jour et nettoyés. (${new Date().toISOString()})`);
  
		  const articles = await Article.find({
			articleName: serie,
			articleLanguage: language,
			articleCategorie: category,
			sellerCountry: country,
			lastUpdate: { $gt: fiveMinutesAgo }
		  });
	  
		  // Si on a trouvé des articles récents, les retourner
		  if (articles.length > 0) {
			console.log(`✅ Données récentes trouvées dans la base. (${new Date().toISOString()})`);
			return res.json(articles);
		  } else {
			console.log(`❌ Aucunes données récentes trouvées dans la base. (${new Date().toISOString()})`);
			return res.status(204).send('No Data Sorry. ' + err.message);
		  }
		} catch (err) {
		  console.error('❌ Erreur parsing JSON ou enregistrement:', err.message);
		  return res.status(500).send('Erreur parsing JSON : ' + err.message);
		}
	  });
  
	} catch (err) {
	  console.error('❌ Erreur MongoDB :', err.message);
	  return res.status(500).json({ error: err.message });
	}
  });

// 🔹 READ ONE (by ID, with seller)
// router.get('/:id', async (req, res) => {
//   try {
//     const article = await Article.findById(req.params.id).populate('seller');
//     if (!article) return res.status(404).json({ error: 'Article not found' });
//     res.json(article);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// 🔹 UPDATE
router.put('/:id', async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔹 DELETE
router.delete('/:id', async (req, res) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;