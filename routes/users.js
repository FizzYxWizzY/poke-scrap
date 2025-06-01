const express = require('express');
const router = express.Router();
const User = require('../db/models/User');
const ensureAuth = require('../middlewares/auth');

// Create
router.post('/post', ensureAuth, async (req, res) => {
  const userId = req.user._id;
  // logique pour ajouter un item à la watchlist du user
  res.json({ message: 'Post effectué pour l\'utilisateur connecté' });
});
// Read all
router.get('/', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Read one
router.get('/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user);
});

// Update
router.put('/:id', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(user);
});

// Delete
router.delete('/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

module.exports = router;