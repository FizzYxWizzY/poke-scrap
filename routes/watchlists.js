const express = require('express');
const router = express.Router();
const Watchlist = require('../db/models/Watchlist');
const mongoose = require('mongoose');

// app.use(express.json());

// 🔹 CREATE (ajouter un article à une watchlist)
router.post('/', async (req, res) => {
  console.log(`Req body: ${req.body}`);
  const { category, language, country, serie, targetPrice } = req.body; // <== req.body ici !
  const userEmail = req.session.userEmail;
  console.log(`cat: ${category}, lang: ${language}, country: ${country}, serie: ${serie}, targetPrice: ${targetPrice}`);
  if (!userEmail) {
    return res.status(401).json({ error: "Non connecté" });
  }
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

// 🔹 READ ALL (pour un utilisateur donné, avec article lié)
// router.get('/user/:userId', async (req, res) => {
//   try {
//     const watchlists = await Watchlist.find({ user: req.params.userId })
//       .populate('article')
//       .populate('user');
//     res.json(watchlists);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// 🔹 READ ONE
// router.get('/:id', async (req, res) => {
//   try {
//     const watchlist = await Watchlist.findById(req.params.id)
//       .populate('article')
//       .populate('user');
//     if (!watchlist) return res.status(404).json({ error: 'Entrée non trouvée' });
//     res.json(watchlist);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// 🔹 UPDATE
// router.put('/:id', async (req, res) => {
//   try {
//     const watchlist = await Watchlist.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     if (!watchlist) return res.status(404).json({ error: 'Entrée non trouvée' });
//     res.json(watchlist);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// 🔹 DELETE
// router.delete('/:id', async (req, res) => {
//   try {
//     const watchlist = await Watchlist.findByIdAndDelete(req.params.id);
//     if (!watchlist) return res.status(404).json({ error: 'Entrée non trouvée' });
//     res.sendStatus(204);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

module.exports = router;