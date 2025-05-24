const express = require('express');
const router = express.Router();
const Article = require('../models/Article');

// 🔹 CREATE
router.post('/', async (req, res) => {
  try {
    const article = await Article.create(req.body);
    res.status(201).json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔹 READ ALL (with seller info)
router.get('/', async (req, res) => {
  try {
    const articles = await Article.find().populate('seller');
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 READ ONE (by ID, with seller)
router.get('/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id).populate('seller');
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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