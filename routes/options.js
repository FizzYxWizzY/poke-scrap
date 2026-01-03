const express = require('express');
const router = express.Router();
const ensureAuth = require('../middlewares/auth');
const { 
  getCategories, 
  getExpansions, 
  scrapeProducts,
  searchProducts,
  updateOptionsFromCardmarket 
} = require('../services/optionsService');
const { languages, countries } = require('../data/cardmarket-data');

// 🔹 GET all categories (from DB)
router.get('/categories', ensureAuth, async (req, res) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 GET all expansions (from DB)
router.get('/expansions', ensureAuth, async (req, res) => {
  try {
    const expansions = await getExpansions();
    res.json(expansions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 GET languages (from static file)
router.get('/languages', ensureAuth, (req, res) => {
  res.json(languages);
});

// 🔹 GET countries (from static file)
router.get('/countries', ensureAuth, (req, res) => {
  res.json(countries);
});

// 🔹 GET all options at once (convenience endpoint)
router.get('/', ensureAuth, async (req, res) => {
  try {
    const categories = await getCategories();
    const expansions = await getExpansions();
    res.json({ categories, expansions, languages, countries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 POST force refresh of categories/expansions from Cardmarket
router.post('/refresh', ensureAuth, async (req, res) => {
  try {
    const result = await updateOptionsFromCardmarket();
    if (result.success) {
      res.json({ 
        message: 'Options updated successfully',
        categoriesCount: result.categoriesCount,
        expansionsCount: result.expansionsCount
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 GET products for a category + expansion combo (or search for singles)
router.get('/products', ensureAuth, async (req, res) => {
  const { categoryId, expansionId, searchString, country, language } = req.query;
  
  // For singles: use searchString with country/language (required)
  if (searchString) {
    if (!categoryId || !country || !language) {
      return res.status(400).json({ error: 'categoryId, country, and language are required for singles search' });
    }
    
    try {
      const result = await searchProducts(categoryId, searchString, country, language);
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }
  
  // For other categories: use categoryId + expansionId
  if (!categoryId || !expansionId) {
    return res.status(400).json({ error: 'categoryId and expansionId are required' });
  }
  
  try {
    const result = await scrapeProducts(categoryId, expansionId);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
