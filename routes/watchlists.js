const express = require('express');
const router = express.Router();
const Watchlist = require('../db/models/Watchlist');
const { ensureAuth } = require('../middlewares/auth');
const { validateWatchlistCreate, validateObjectId } = require('../middlewares/validators');

// 🔹 CREATE (ajouter un article à une watchlist)
router.post('/', ensureAuth, validateWatchlistCreate, async (req, res) => {
  const { category, language, country, serie, targetPrice, articleImage, productPath } = req.body;
  const userEmail = req.session.userEmail;

  try {
    // Check watchlist limit for free users
    if (req.user.role === 'free') {
      const currentWatchlistCount = await Watchlist.countDocuments({ userEmail: userEmail });
      if (currentWatchlistCount >= 10) {
        return res.status(400).json({ 
          error: 'Free users are limited to 10 watchlist items. Upgrade to Premium for unlimited watchlist items.' 
        });
      }
    }

    const watchlist = await Watchlist.create({
      userEmail: userEmail,
      articleName: serie,
      articleImage: articleImage || null,
      articleLanguage: language,
      articleCategorie: category,
      productPath: productPath || null,
      sellerCountry: country,
      targetPrice: targetPrice
    });
    console.log(`✅ Article ajouté a la watchlist. (${new Date().toISOString()})`);
    return res.status(201).json(watchlist);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: 'Cet article est déjà dans votre watchlist.' });
    } else {
      console.error("Erreur Watchlist:", err);
      res.status(400).json({ error: 'Impossible d\'ajouter' });
    }
  }
});

// 🔹 READ ALL pour le user connecté
router.get('/', ensureAuth, async (req, res) => {
  try {
    const watchlists = await Watchlist.find({ userEmail: req.session.userEmail });
    return res.json(watchlists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 🔹 UPDATE
router.put('/:id', ensureAuth, validateObjectId, async (req, res) => {
  try {
    const watchlist = await Watchlist.findOneAndUpdate(
      { _id: req.params.id, userEmail: req.session.userEmail },
      req.body,
      { new: true }
    );
    if (!watchlist) return res.status(404).json({ error: 'Entrée non trouvée' });
    res.json(watchlist);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔹 DELETE
router.delete('/:id', ensureAuth, validateObjectId, async (req, res) => {
  try {
    const deleted = await Watchlist.findOneAndDelete({
      _id: req.params.id,
      userEmail: req.session.userEmail
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