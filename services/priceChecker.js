const Watchlist = require('../db/models/Watchlist');
const { getArticles, getArticlesDirect } = require('./articleService');
const { sendConsolidatedAlert } = require('./emailService');

// Cooldown between notifications for same watchlist item (24 hours)
const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Parse price string to number (handles European format: "10.000,00 €" or "270,00 €")
 */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  // Remove currency symbol and spaces
  let cleaned = priceStr.replace(/[€\s]/g, '');
  // Remove thousands separator (dot) and convert decimal comma to dot
  // European format: 10.000,00 -> 10000.00
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

/**
 * Check all active watchlist items for price matches
 */
async function checkAllWatchlists() {
  console.log(`\n🔍 Démarrage de la vérification des prix... (${new Date().toISOString()})`);

  try {
    // Get all active watchlist items
    const watchlists = await Watchlist.find({ isActive: true });
    
    if (watchlists.length === 0) {
      console.log('📋 Aucune watchlist active à vérifier.');
      return { checked: 0, alerts: 0 };
    }

    console.log(`📋 ${watchlists.length} watchlist(s) à vérifier.`);

    // Collect all alerts grouped by user email
    const alertsByUser = {};

    // Group watchlists by search criteria to minimize scraping
    const groupedWatchlists = groupWatchlistsBySearch(watchlists);

    for (const [searchKey, items] of Object.entries(groupedWatchlists)) {
      const { category, language, country, serie, productPath } = items[0];

      try {
        // Get current articles - use direct scraper if productPath available
        let result;
        if (productPath) {
          console.log(`🔍 Vérification directe: ${productPath}`);
          result = await getArticlesDirect({ productPath, country, language });
        } else {
          console.log(`🔍 Vérification legacy: ${serie} (${category})`);
          result = await getArticles({ category, language, country, serie });
        }

        if (!result.success || result.articles.length === 0) {
          console.log(`⚠️ Pas d'articles trouvés pour: ${productPath || serie}`);
          continue;
        }

        // Check each watchlist item against current prices
        for (const watchlistItem of items) {
          const matchingArticles = findMatchingArticles(result.articles, watchlistItem.targetPrice);

          if (matchingArticles.length > 0 && canNotify(watchlistItem)) {
            const userEmail = watchlistItem.userEmail;
            
            // Initialize user's alerts array if needed
            if (!alertsByUser[userEmail]) {
              alertsByUser[userEmail] = [];
            }

            // Add this alert to user's collection
            alertsByUser[userEmail].push({
              watchlistId: watchlistItem._id,
              articleName: watchlistItem.articleName,
              category: watchlistItem.articleCategorie,
              language: watchlistItem.articleLanguage,
              country: watchlistItem.sellerCountry,
              targetPrice: watchlistItem.targetPrice,
              productPath: watchlistItem.productPath,
              matchingArticles: matchingArticles
            });
          } else if (matchingArticles.length > 0) {
            console.log(`⏰ Cooldown actif pour ${watchlistItem.userEmail} - ${watchlistItem.articleName}`);
          }
        }
      } catch (err) {
        console.error(`❌ Erreur pour ${searchKey}:`, err.message);
      }

      // Small delay between searches to avoid rate limiting
      await sleep(5000 + Math.random() * 3000); // 5-8 seconds
    }

    // Send one consolidated email per user
    let alertsSent = 0;
    for (const [userEmail, alerts] of Object.entries(alertsByUser)) {
      const emailResult = await sendConsolidatedAlert({
        to: userEmail,
        alerts: alerts
      });

      if (emailResult.success) {
        // Update lastNotified for all watchlist items in this email
        for (const alert of alerts) {
          await Watchlist.findByIdAndUpdate(alert.watchlistId, {
            lastNotified: new Date()
          });
        }
        alertsSent++;
        console.log(`📧 Email consolidé envoyé à ${userEmail} (${alerts.length} article(s))`);
      }
    }

    console.log(`✅ Vérification terminée. ${alertsSent} email(s) envoyé(s).\n`);
    return { checked: watchlists.length, alerts: alertsSent };

  } catch (err) {
    console.error('❌ Erreur lors de la vérification des watchlists:', err.message);
    return { checked: 0, alerts: 0, error: err.message };
  }
}

/**
 * Group watchlist items by search criteria
 */
function groupWatchlistsBySearch(watchlists) {
  const groups = {};

  for (const item of watchlists) {
    // Use productPath if available, otherwise use legacy search
    const key = item.productPath 
      ? `direct|${item.productPath}|${item.articleLanguage}|${item.sellerCountry}`
      : `legacy|${item.articleCategorie}|${item.articleLanguage}|${item.sellerCountry}|${item.articleName}`;
    
    if (!groups[key]) {
      groups[key] = [];
    }
    
    groups[key].push({
      ...item.toObject(),
      category: item.articleCategorie,
      language: item.articleLanguage,
      country: item.sellerCountry,
      serie: item.articleName,
      productPath: item.productPath
    });
  }

  return groups;
}

/**
 * Find articles below target price
 */
function findMatchingArticles(articles, targetPrice) {
  return articles
    .filter(article => {
      const price = parsePrice(article.articlePrice);
      return price !== null && price <= targetPrice;
    })
    .sort((a, b) => parsePrice(a.articlePrice) - parsePrice(b.articlePrice));
}

/**
 * Check if we can send a notification (respecting cooldown)
 */
function canNotify(watchlistItem) {
  if (!watchlistItem.lastNotified) return true;

  const timeSinceLastNotification = Date.now() - new Date(watchlistItem.lastNotified).getTime();
  return timeSinceLastNotification >= NOTIFICATION_COOLDOWN_MS;
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  checkAllWatchlists,
  parsePrice,
  NOTIFICATION_COOLDOWN_MS
};
