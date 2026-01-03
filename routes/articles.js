const express = require('express');
const router = express.Router();
const Article = require('../db/models/Article');
const ensureAuth = require('../middlewares/auth');
const { validateArticleSearch, validateObjectId } = require('../middlewares/validators');
const { getArticles, preSearch, getArticlesDirect } = require('../services/articleService');
const { categories, languages, countries } = require('../data/cardmarket-data');

// 🔹 GET Cardmarket options (categories, languages, countries) - PUBLIC
router.get('/options', (req, res) => {
  res.json({ categories, languages, countries });
});

// 🔹 PRE-SEARCH: Get all matching products for a category + search term - PUBLIC
router.get('/presearch', async (req, res) => {
  const { category, search } = req.query;
  
  if (!category || !search) {
    return res.status(400).json({ error: 'category and search are required' });
  }
  
  try {
    const result = await preSearch(category, search);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    return res.json(result);
  } catch (err) {
    console.error('❌ Pre-search error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// 🔹 DIRECT SEARCH: Scrape a specific product by its path - PUBLIC
router.get('/direct', async (req, res) => {
  const { productPath, country, language } = req.query;
  
  if (!productPath || !country || !language) {
    return res.status(400).json({ error: 'productPath, country, and language are required' });
  }
  
  try {
    const result = await getArticlesDirect({ productPath, country, language });
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    if (result.noSellers) {
      return res.json({ 
        noSellers: true, 
        productInfo: result.productInfo,
        articles: []
      });
    }
    
    if (result.articles.length === 0) {
      return res.status(204).json({ message: 'Produit non trouvé' });
    }
    
    return res.json(result.articles);
  } catch (err) {
    console.error('❌ Direct search error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// 🔹 SEARCH (with scrapper fallback)
router.get('/', ensureAuth, validateArticleSearch, async (req, res) => {
  const { category, language, country, serie } = req.query;

  try {
    const result = await getArticles({ category, language, country, serie });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Product exists but no sellers
    if (result.noSellers && result.productInfo) {
      return res.json({ 
        noSellers: true, 
        productInfo: result.productInfo,
        articles: []
      });
    }

    // Product doesn't exist (empty array, noSellers is false)
    if (result.articles.length === 0 && !result.noSellers) {
      return res.status(204).json({ message: 'Aucun article trouvé' });
    }

    return res.json(result.articles);
  } catch (err) {
    console.error('❌ Erreur MongoDB :', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// 🔹 UPDATE
router.put('/:id', ensureAuth, validateObjectId, async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔹 DELETE
router.delete('/:id', ensureAuth, validateObjectId, async (req, res) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;