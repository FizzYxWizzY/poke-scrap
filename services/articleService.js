const { spawn } = require('child_process');
const { performPresearch } = require('../src/presearch');
const Article = require('../db/models/Article');
const { categories, languages, countries } = require('../data/cardmarket-data');

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION_MS = 5 * 60 * 1000;

// Scraping delays to avoid Cloudflare detection (in milliseconds)
const SCRAPING_DELAYS = {
  INITIAL_DELAY: 5000 + Math.random() * 3000, // 5-8 seconds
  BETWEEN_REQUESTS: 3000 + Math.random() * 2000, // 3-5 seconds
  AFTER_MAIN_PAGE: 4000 + Math.random() * 2000, // 4-6 seconds
  HUMAN_BEHAVIOR: 2000 + Math.random() * 1000, // 2-3 seconds
};

/**
 * Get articles from database or scrape if stale
 */
async function getArticles({ category, language, country, serie }) {
  const cacheThreshold = new Date(Date.now() - CACHE_DURATION_MS);

  // Normalize category input: frontend may send id ("51"), slug ("Singles") or text ("Singles")
  let categoryEntry = null;
  if (category) {
    categoryEntry = categories.find(c => c.value === category || c.slug.toLowerCase() === (category || '').toLowerCase() || c.text.toLowerCase() === (category || '').toLowerCase());
  }

  // Normalize language input: frontend may send id ("1"), code ("en") or text ("English")
  let languageEntry = null;
  if (language) {
    languageEntry = languages.find(l => l.value === language || l.code.toLowerCase() === (language || '').toLowerCase() || l.text.toLowerCase() === (language || '').toLowerCase());
  }

  // Normalize country input: frontend may send id ("12"), code ("fr") or text ("France")
  let countryEntry = null;
  if (country) {
    countryEntry = countries.find(c => c.value === country || c.code.toLowerCase() === (country || '').toLowerCase() || c.text.toLowerCase() === (country || '').toLowerCase());
  }

  // dbCategory is the human readable category stored in DB (e.g., "Singles")
  const dbCategory = categoryEntry ? categoryEntry.text : category;

  // scrapperCategory is the slug used by the scrappers (e.g., "Singles" or "Elite-Trainer-Boxes")
  const scrapperCategory = categoryEntry ? categoryEntry.slug : category;

  // scrapperLanguage is the code used by the scrappers (e.g., "en")
  const scrapperLanguage = languageEntry ? languageEntry.code : language;

  // scrapperCountry is the code used by the scrappers (e.g., "fr")
  const scrapperCountry = countryEntry ? countryEntry.code : country;

  // Check for cached articles
  const cachedArticles = await Article.find({
    articleName: serie,
    articleLanguage: language,
    articleCategorie: dbCategory,
    sellerCountry: country,
    lastUpdate: { $gt: cacheThreshold }
  });

  if (cachedArticles.length > 0) {
    console.log(`✅ Données récentes trouvées dans la base. (${new Date().toISOString()})`);
    return { success: true, articles: cachedArticles, fromCache: true };
  }

  console.log(`❌ Pas de données récentes, lancement du scrapper... (${new Date().toISOString()})`);
  
  // Handle singles and elite trainer boxes differently - need to presearch first to get the product URL
  if ((categoryEntry && categoryEntry.text === 'Singles') || (!categoryEntry && category === 'Singles')) {
    return await handleProductSearch({ serie, language: scrapperLanguage, country: scrapperCountry, category: 'Singles' });
  }

  if ((categoryEntry && categoryEntry.text === 'Elite Trainer Boxes') || (!categoryEntry && category === 'Elite-Trainer-Boxes')) {
    console.log('Elite Trainer Boxes: returning no results due to Cloudflare protection');
    // Return empty results for now due to Cloudflare blocking in server environment
    return { success: true, articles: [], noSellers: false };
  }

  // For other categories, use direct scrapper. Use the slug form expected by the scrapper script.
  const scrapperResult = await runScrapper(scrapperCategory, serie, scrapperCountry, scrapperLanguage);
  
  if (!scrapperResult.success) {
    return { success: false, error: scrapperResult.error };
  }

  // Handle "product exists but no sellers" case
  if (scrapperResult.data && scrapperResult.data.noSellers) {
    console.log(`📦 Produit trouvé mais aucun vendeur: ${scrapperResult.data.articleTitle}`);
    return { 
      success: true, 
      articles: [], 
      noSellers: true,
      productInfo: {
        articleTitle: scrapperResult.data.articleTitle,
        articleImage: scrapperResult.data.localImage
      }
    };
  }

  // Handle empty array (product doesn't exist)
  if (Array.isArray(scrapperResult.data) && scrapperResult.data.length === 0) {
    return { success: true, articles: [], noSellers: false };
  }

  // Save to database
  await saveArticles(scrapperResult.data, { category: dbCategory, language, country, serie });
  
  // Clean up old entries
  await cleanupOldArticles({ category, language, country, serie }, cacheThreshold);

  // Fetch fresh data
  const freshArticles = await Article.find({
    articleName: serie,
    articleLanguage: language,
    articleCategorie: dbCategory,
    sellerCountry: country,
    lastUpdate: { $gt: cacheThreshold }
  });

  return { success: true, articles: freshArticles, fromCache: false };
}

/**
 * Run the scrapper script
 */
function runScrapper(category, serie, country, language) {
  return new Promise((resolve) => {
    console.log(`✅ Lancement du scrapper... (${new Date().toISOString()})`);
    
    const scrapper = spawn('node', ['src/scrapper.js', category, serie, country, language]);
    let output = '';
    let errorOutput = '';

    scrapper.stdout.on('data', (data) => {
      output += data.toString();
    });

    scrapper.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`Erreur scrapper : ${data}`);
    });

    scrapper.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: `Scrapper exited with code ${code}: ${errorOutput}` });
        return;
      }

      try {
        const data = JSON.parse(output);
        resolve({ success: true, data });
      } catch (err) {
        console.error('❌ Erreur parsing JSON:', err.message);
        resolve({ success: false, error: 'Failed to parse scrapper output' });
      }
    });

    scrapper.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Save scraped articles to database
 */
async function saveArticles(scrapperData, { category, language, country, serie }) {
  const articles = scrapperData.map(item => ({
    articleName: serie,
    articleImage: item.localImage || null, // Use local image filename
    articlePrice: item.price,
    articleAmount: item.amount,
    articleLanguage: language,
    articleCategorie: category,
    sellerName: item.name,
    sellerLevel: item.sales,
    sellerCountry: country,
    sellerComment: item.comment || null,
    lastUpdate: Date.now()
  }));

  for (const article of articles) {
    await Article.findOneAndUpdate(
      {
        articleName: article.articleName,
        articlePrice: article.articlePrice,
        articleLanguage: article.articleLanguage,
        articleCategorie: article.articleCategorie,
        sellerName: article.sellerName,
        sellerCountry: article.sellerCountry
      },
      article,
      { upsert: true }
    );
  }

  console.log(`✅ Articles mis à jour. (${new Date().toISOString()})`);
}

/**
 * Remove stale articles from database
 */
async function cleanupOldArticles({ category, language, country, serie }, threshold) {
  await Article.deleteMany({
    articleName: serie,
    articleLanguage: language,
    articleCategorie: category,
    sellerCountry: country,
    lastUpdate: { $lt: threshold }
  });
  console.log(`✅ Anciens articles nettoyés. (${new Date().toISOString()})`);
}

/**
 * Pre-search: Find all matching products for a category + search term
 */
async function preSearch(category, search) {
  console.log(`🔍 Pre-search: ${category} / ${search} (${new Date().toISOString()})`);

  try {
    const result = await performPresearch(category, search);
    if (result.error) {
      return { success: false, error: result.error };
    } else {
      return { success: true, ...result };
    }
  } catch (err) {
    console.error('❌ Pre-search error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get articles using direct product path
 */
async function getArticlesDirect({ productPath, country, language }) {
  console.log(`🔍 Direct scrape: ${productPath} (${new Date().toISOString()})`);
  
  // Extract category and product name from path for caching
  // Singles paths are like: Singles/Lost-Origin/Snover-LOR042
  // Other paths are like: Elite-Trainer-Boxes/151-Elite-Trainer-Box
  const pathParts = productPath.split('/');
  let category, productName;
  
  if (pathParts[0] === 'Singles' && pathParts.length >= 3) {
    // For Singles: use "Singles" as category and the card name as productName
    category = 'Singles';
    productName = pathParts[pathParts.length - 1]; // e.g., "Snover-LOR042"
  } else {
    category = pathParts[0] || 'unknown';
    productName = pathParts[pathParts.length - 1] || productPath;
  }
  
  const cacheThreshold = new Date(Date.now() - CACHE_DURATION_MS);

  // Check for cached articles
  const cachedArticles = await Article.find({
    articleName: productName,
    articleLanguage: language,
    articleCategorie: category,
    sellerCountry: country,
    lastUpdate: { $gt: cacheThreshold }
  });

  if (cachedArticles.length > 0) {
    console.log(`✅ Cache hit for ${productName} (${new Date().toISOString()})`);
    return { success: true, articles: cachedArticles, fromCache: true };
  }

  // Run direct scrapper
  const scrapperResult = await runDirectScrapper(productPath, country, language);
  
  if (!scrapperResult.success) {
    return { success: false, error: scrapperResult.error };
  }

  // Handle no sellers case
  if (scrapperResult.data && scrapperResult.data.noSellers) {
    return { 
      success: true, 
      articles: [], 
      noSellers: true,
      productInfo: {
        articleTitle: scrapperResult.data.articleTitle,
        articleImage: scrapperResult.data.localImage,
        productPath: productPath
      }
    };
  }

  // Handle empty array
  if (Array.isArray(scrapperResult.data) && scrapperResult.data.length === 0) {
    return { success: true, articles: [], noSellers: false };
  }

  // Save to database
  await saveArticlesDirect(scrapperResult.data, { category, language, country, productName });
  
  // Fetch fresh data
  const freshArticles = await Article.find({
    articleName: productName,
    articleLanguage: language,
    articleCategorie: category,
    sellerCountry: country,
    lastUpdate: { $gt: cacheThreshold }
  });

  return { success: true, articles: freshArticles, fromCache: false };
}

/**
 * Run the direct scrapper script
 */
function runDirectScrapper(productPath, country, language) {
  return new Promise((resolve) => {
    const scrapper = spawn('node', ['src/scrapper-direct.js', productPath, country, language]);
    let output = '';
    let errorOutput = '';

    scrapper.stdout.on('data', (data) => {
      output += data.toString();
    });

    scrapper.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      scrapper.kill('SIGKILL');
      resolve({ success: false, error: 'Scrapper timeout' });
    }, 25000); // 25 second timeout

    scrapper.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({ success: false, error: `Scrapper exited with code ${code}: ${errorOutput}` });
        return;
      }

      try {
        const data = JSON.parse(output);
        if (data.error) {
          resolve({ success: false, error: data.error });
        } else {
          resolve({ success: true, data });
        }
      } catch (err) {
        resolve({ success: false, error: 'Failed to parse scrapper output' });
      }
    });

    scrapper.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Save articles from direct scrapper
 */
async function saveArticlesDirect(scrapperData, { category, language, country, productName }) {
  const articles = scrapperData.map(item => ({
    articleName: productName,
    articleImage: item.localImage || null,
    articlePrice: item.price,
    articleAmount: item.amount,
    articleLanguage: language,
    articleCategorie: category,
    sellerName: item.name,
    sellerLevel: item.sales,
    sellerCountry: country,
    sellerComment: item.comment || null,
    lastUpdate: Date.now()
  }));

  for (const article of articles) {
    await Article.findOneAndUpdate(
      {
        articleName: article.articleName,
        articlePrice: article.articlePrice,
        articleLanguage: article.articleLanguage,
        articleCategorie: article.articleCategorie,
        sellerName: article.sellerName,
        sellerCountry: article.sellerCountry
      },
      article,
      { upsert: true }
    );
  }

  console.log(`✅ Direct articles saved. (${new Date().toISOString()})`);
}

/**
 * Handle product search - presearch first, then direct scrape
 * Used for categories like Singles and Elite Trainer Boxes that need product lookup
 */
async function handleProductSearch({ serie, language, country, category }) {
  console.log(`🔍 Handling ${category} search for: ${serie} (${new Date().toISOString()})`);
  
  // Common set abbreviations for fallback URL construction and alternative searches
  const setMappings = {
    'LOR': 'Lost-Origin',
    'SIT': 'Silver-Tempest', 
    'CRZ': 'Crown-Zenith',
    'ASR': 'Astral-Radiance',
    'BRS': 'Brilliant-Stars',
    'FST': 'Fusion-Strike',
    'CEL': 'Celebrations',
    'EVO': 'Evolutions',
    'PAL': 'Paldea-Evolved',
    'OBF': 'Obsidian-Flames',
    'MEW': 'Mewtwo',
    'PIK': 'Pikachu',
    'CHAR': 'Charizard',
    'TG': 'Trainer-Gallery',
    'TWM': 'Twilight-Masquerade',
    'SFA': 'Shrouded-Fable',
    'SSP': 'Secret-Super-Secret',
    'SCR': 'Scarlet-Violet',
    'SVP': 'Scarlet-Violet-Promos'
  };
  
  // First, presearch to find the exact product URL
  let preSearchResult = await preSearch(category, serie);
  
  // If Cloudflare blocked the search, try a simple fallback
  if (preSearchResult.cloudflareBlocked) {
    console.log(`🛡️ Cloudflare blocked presearch for: ${serie}, trying simple fallback`);
    // Try the exact term as a direct path
    const simplePath = `${category}/${serie}`;
    return await getArticlesDirect({ productPath: simplePath, country, language });
  }
  
  // If presearch found results, use them
  if (preSearchResult.success && preSearchResult.products.length > 0) {
    const validProduct = preSearchResult.products.find(p => p.url && p.id);
    if (validProduct) {
      const productPath = validProduct.url.split('/').slice(-3).join('/'); // Extract path from URL
      console.log(`✅ Found product path: ${productPath}`);
      return await getArticlesDirect({ productPath, country, language });
    }
  }
  
  // If presearch failed or found no results, try simple fallback
  console.log(`❌ Presearch failed for: ${serie}, trying simple fallback`);
  const simplePath = `${category}/${serie}`;
  return await getArticlesDirect({ productPath: simplePath, country, language });
}


module.exports = {
  getArticles,
  runScrapper,
  preSearch,
  getArticlesDirect,
  CACHE_DURATION_MS
};
