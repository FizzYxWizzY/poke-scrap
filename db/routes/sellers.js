const express = require('express');
const router = express.Router();
const Seller = require('../models/Seller');

router.post('/', async (req, res) => {
  try {
    const seller = await Seller.create(req.body);
    res.json(seller);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const sellers = await Seller.find();
  res.json(sellers);
});

router.get('/:id', async (req, res) => {
  const seller = await Seller.findById(req.params.id);
  res.json(seller);
});

router.put('/:id', async (req, res) => {
  const seller = await Seller.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(seller);
});

router.delete('/:id', async (req, res) => {
  await Seller.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

module.exports = router;