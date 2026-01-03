const { spawn } = require('child_process');
const Article = require('../db/models/Article');

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * Get articles from database or scrape if stale
 */
async function getArticles({ category, language, country, serie }) {
  const cacheThreshold = new Date(Date.now() - CACHE_DURATION_MS);

  // Check for cached articles
  const cachedArticles = await Article.find({
    articleName: serie,
    articleLanguage: language,
    articleCategorie: category,
    sellerCountry: country,
    lastUpdate: { $gt: cacheThreshold }
  });

  if (cachedArticles.length > 0) {
    console.log(`✅ Données récentes trouvées dans la base. (${new Date().toISOString()})`);
    return { success: true, articles: cachedArticles, fromCache: true };
  }

  console.log(`❌ Pas de données récentes, lancement du scrapper... (${new Date().toISOString()})`);
  
  // Run scrapper
  const scrapperResult = await runScrapper(category, serie, country, language);
  
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
  await saveArticles(scrapperResult.data, { category, language, country, serie });
  
  // Clean up old entries
  await cleanupOldArticles({ category, language, country, serie }, cacheThreshold);

  // Fetch fresh data
  const freshArticles = await Article.find({
    articleName: serie,
    articleLanguage: language,
    articleCategorie: category,
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
function preSearch(category, search) {
  return new Promise((resolve) => {
    console.log(`🔍 Pre-search: ${category} / ${search} (${new Date().toISOString()})`);
    
    const scrapper = spawn('node', ['src/presearch.js', category, search]);
    let output = '';
    let errorOutput = '';

    scrapper.stdout.on('data', (data) => {
      output += data.toString();
    });

    scrapper.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`Pre-search error: ${data}`);
    });

    scrapper.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: `Pre-search exited with code ${code}: ${errorOutput}` });
        return;
      }

      try {
        const data = JSON.parse(output);
        if (data.error) {
          resolve({ success: false, error: data.error });
        } else {
          resolve({ success: true, ...data });
        }
      } catch (err) {
        console.error('❌ Pre-search JSON parse error:', err.message);
        resolve({ success: false, error: 'Failed to parse pre-search output' });
      }
    });

    scrapper.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Get articles using direct product path
 */
async function getArticlesDirect({ productPath, country, language }) {
  console.log(`🔍 Direct scrape: ${productPath} (${new Date().toISOString()})`);
  
  // Extract category and product name from path for caching
  const pathParts = productPath.split('/');
  const category = pathParts[0] || 'unknown';
  const productName = pathParts[1] || productPath;
  
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

    scrapper.on('close', (code) => {
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

module.exports = {
  getArticles,
  runScrapper,
  preSearch,
  getArticlesDirect,
  CACHE_DURATION_MS
};
