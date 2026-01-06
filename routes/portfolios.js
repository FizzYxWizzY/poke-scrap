const express = require('express');
const router = express.Router();
const Portfolio = require('../db/models/Portfolio');
const { ensureAuth } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validators');

// 🔹 CREATE (ajouter un article au portfolio)
router.post('/', ensureAuth, async (req, res) => {
  const { category, language, country, serie, purchasePrice, quantity, notes, articleImage, productPath } = req.body;
  const userEmail = req.user.userEmail;

  try {
    const portfolio = await Portfolio.create({
      userEmail: userEmail,
      articleName: serie,
      articleImage: articleImage || null,
      articleLanguage: language,
      articleCategorie: category,
      productPath: productPath || null,
      sellerCountry: country,
      purchasePrice: parseFloat(purchasePrice),
      quantity: parseInt(quantity) || 1,
      notes: notes || ''
    });
    console.log(`✅ Article ajouté au portfolio. (${new Date().toISOString()})`);
    return res.status(201).json(portfolio);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: 'Cet article est déjà dans votre portfolio.' });
    } else {
      console.error("Erreur Portfolio:", err);
      res.status(400).json({ error: 'Impossible d\'ajouter' });
    }
  }
});

// 🔹 READ ALL pour le user connecté
router.get('/', ensureAuth, async (req, res) => {
  try {
    const portfolios = await Portfolio.find({ userEmail: req.user.userEmail });
    return res.json(portfolios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 🔹 READ avec calculs de prix actuels
router.get('/with-prices', ensureAuth, async (req, res) => {
  try {
    const portfolios = await Portfolio.find({ userEmail: req.user.userEmail });

    // Pour chaque item du portfolio, récupérer le prix actuel
    const portfolioWithPrices = await Promise.all(
      portfolios.map(async (item) => {
        try {
          // Essayer de récupérer le prix actuel via l'API
          const response = await fetch(`${process.env.CALLBACK_URL || 'http://localhost:5000'}/api/articles/direct?productPath=${encodeURIComponent(item.productPath)}&country=${item.sellerCountry}&language=${item.articleLanguage}`);

          let currentPrice = null;
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              currentPrice = Math.min(...data.map(article => parseFloat(article.articlePrice)));
            }
          }

          return {
            ...item.toObject(),
            currentPrice: currentPrice,
            profit: currentPrice ? (currentPrice - item.purchasePrice) * item.quantity : null,
            profitPercentage: currentPrice ? ((currentPrice - item.purchasePrice) / item.purchasePrice) * 100 : null
          };
        } catch (error) {
          console.error(`Erreur récupération prix pour ${item.articleName}:`, error);
          return {
            ...item.toObject(),
            currentPrice: null,
            profit: null,
            profitPercentage: null
          };
        }
      })
    );

    // Calculs totaux
    const totalPaid = portfolioWithPrices.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0);
    const totalCurrent = portfolioWithPrices.reduce((sum, item) => sum + (item.currentPrice ? item.currentPrice * item.quantity : 0), 0);
    const totalProfit = totalCurrent - totalPaid;
    const totalProfitPercentage = totalPaid > 0 ? (totalProfit / totalPaid) * 100 : 0;

    return res.json({
      items: portfolioWithPrices,
      summary: {
        totalPaid: totalPaid,
        totalCurrent: totalCurrent,
        totalProfit: totalProfit,
        totalProfitPercentage: totalProfitPercentage,
        itemCount: portfolioWithPrices.length
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 🔹 UPDATE
router.put('/:id', ensureAuth, validateObjectId, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: req.params.id, userEmail: req.user.userEmail },
      req.body,
      { new: true }
    );
    if (!portfolio) return res.status(404).json({ error: 'Entrée non trouvée' });
    res.json(portfolio);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔹 DELETE
router.delete('/:id', ensureAuth, validateObjectId, async (req, res) => {
  try {
    const deleted = await Portfolio.findOneAndDelete({
      _id: req.params.id,
      userEmail: req.user.userEmail
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Élément non trouvé ou non autorisé' });
    }

    res.json({ message: 'Élément supprimé avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;