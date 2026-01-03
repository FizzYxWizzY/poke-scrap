const { body, query, param, validationResult } = require('express-validator');

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
  query('category').notEmpty().withMessage('La catégorie est requise').isIn(['etb', 'booster']).withMessage('Catégorie invalide'),
  query('language').notEmpty().withMessage('La langue est requise').isIn(['french', 'english', 'spanish', 'german', 'italian', 'portugese']).withMessage('Langue invalide'),
  query('country').notEmpty().withMessage('Le pays est requis'),
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
