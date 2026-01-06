const { body, query, param, validationResult } = require('express-validator');
const { categories, languages, countries } = require('../data/cardmarket-data');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Article search validation
const validateArticleSearch = [
  query('category').notEmpty().withMessage('La catégorie est requise').isIn(categories.map(c => c.value)).withMessage('Catégorie invalide'),
  query('language').notEmpty().withMessage('La langue est requise').isIn(languages.map(l => l.value)).withMessage('Langue invalide'),
  query('country').notEmpty().withMessage('Le pays est requis').isIn(countries.map(c => c.value)).withMessage('Pays invalide'),
  query('serie').notEmpty().withMessage('La série est requise').trim().escape(),
  validate
];

// Watchlist creation validation
const validateWatchlistCreate = [
  body('category').notEmpty().withMessage('La catégorie est requise').trim(),
  body('language').notEmpty().withMessage('La langue est requise'),
  body('country').notEmpty().withMessage('Le pays est requis'),
  body('serie').notEmpty().withMessage('La série est requise').trim(),
  body('targetPrice').isFloat({ min: 0.01 }).withMessage('Le prix doit être un nombre positif'),
  validate
];

// MongoDB ObjectId validation
const validateObjectId = [
  param('id').isMongoId().withMessage('ID invalide'),
  validate
];

module.exports = {
  validate,
  validateArticleSearch,
  validateWatchlistCreate,
  validateObjectId
};
