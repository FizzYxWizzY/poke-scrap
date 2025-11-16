const express = require('express');
const router = express.Router();
const Watchlist = require('../db/models/Watchlist');
// const mongoose = require('mongoose');

// 🔹 CREATE (ajouter un article à une watchlist)
router.post('/', async (req, res) => {
  console.log(`Req body: ${req.body}`);
  const { category, language, country, serie, targetPrice } = req.body; // <== req.body ici !
  const userEmail = req.session.userEmail;
  console.log(`cat: ${category}, lang: ${language}, country: ${country}, serie: ${serie}, targetPrice: ${targetPrice}`);
  if (!userEmail) {
    return res.status(401).json({ error: "Non connecté" });
  }
  // pour vider toute la watchlist (pck j ai pas encore d autre fonction)
  // decommenter -> add a la watchlist = clear all, et refait une avec l entree actuel (comme sa j peux add a chaque fois la meme et pas apprendre le nom des series pokemachin)
  // await mongoose.connection.db.dropCollection('watchlists')
  //   .then(() => console.log('✅ Collection "watchlists" supprimée.'))
  //   .catch(err => console.log('❌ Erreur :', err));
  try {
    const watchlist = await Watchlist.create({
      userEmail: userEmail,
      articleName: serie,
      articleLanguage: language,
      articleCategorie: category,
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

// 🔹 READ ALL pour le user connecter
router.get('/', async (req, res) => {
  if (!req.session.googleId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié' });
  }

  try {
    const watchlists = await Watchlist.find({ userEmail: req.session.userEmail });
    return res.json(watchlists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 🔹 UPDATE
router.put('/:id', async (req, res) => {
  if (!req.session.googleId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const watchlist = await Watchlist.findByIdAndUpdate(req.params.userEmail, req.body, { new: true });
    if (!watchlist) return res.status(404).json({ error: 'Entrée non trouvée' });
    res.json(watchlist);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔹 DELETE
router.delete('/:id', async (req, res) => {
  if (!req.session.googleId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

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