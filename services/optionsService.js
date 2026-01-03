const { spawn } = require('child_process');
const Category = require('../db/models/Category');
const Expansion = require('../db/models/Expansion');
const ProductCache = require('../db/models/ProductCache');

// Cache duration: 1 hour for product list
const PRODUCT_CACHE_DURATION_MS = 60 * 60 * 1000;

/**
 * Service to manage Cardmarket options (categories & expansions)
 */

/**
 * Scrape and update categories/expansions from Cardmarket
 */
async function updateOptionsFromCardmarket() {
  console.log(`🔄 Updating categories/expansions from Cardmarket... (${new Date().toISOString()})`);
  
  return new Promise((resolve) => {
    const scrapper = spawn('node', ['src/scrape-options.js']);
    let output = '';
    let errorOutput = '';

    scrapper.stdout.on('data', (data) => {
      output += data.toString();
    });

    scrapper.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`Options scrapper error: ${data}`);
    });

    scrapper.on('close', async (code) => {
      if (code !== 0) {
        console.error(`❌ Options scrapper failed with code ${code}`);
        resolve({ success: false, error: errorOutput });
        return;
      }

      try {
        const data = JSON.parse(output);
        
        if (!data.success) {
          resolve({ success: false, error: data.error });
          return;
        }

        // Update categories in DB
        for (const cat of data.categories) {
          await Category.findOneAndUpdate(
            { value: cat.value },
            { value: cat.value, text: cat.text, lastUpdate: new Date() },
            { upsert: true }
          );
        }

        // Update expansions in DB
        for (const exp of data.expansions) {
          await Expansion.findOneAndUpdate(
            { value: exp.value },
            { value: exp.value, text: exp.text, lastUpdate: new Date() },
            { upsert: true }
          );
        }

        console.log(`✅ Updated ${data.categories.length} categories and ${data.expansions.length} expansions (${new Date().toISOString()})`);
        
        resolve({ 
          success: true, 
          categoriesCount: data.categories.length,
          expansionsCount: data.expansions.length
        });

      } catch (err) {
        console.error('❌ Failed to parse options:', err.message);
        resolve({ success: false, error: err.message });
      }
    });

    scrapper.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Get all categories from DB
 */
async function getCategories() {
  return await Category.find({}).sort({ text: 1 });
}

/**
 * Get all expansions from DB
 */
async function getExpansions() {
  return await Expansion.find({}).sort({ text: 1 });
}

/**
 * Scrape products for a category + expansion combo (with caching)
 */
async function scrapeProducts(categoryId, expansionId) {
  const cacheThreshold = new Date(Date.now() - PRODUCT_CACHE_DURATION_MS);
  
  // Check cache first
  const cached = await ProductCache.findOne({
    categoryId,
    expansionId,
    lastUpdate: { $gt: cacheThreshold }
  });

  if (cached) {
    console.log(`✅ Product cache hit for category=${categoryId}, expansion=${expansionId} (${new Date().toISOString()})`);
    return {
      success: true,
      products: cached.products,
      productsCount: cached.products.length,
      fromCache: true,
      cacheAge: Math.round((Date.now() - cached.lastUpdate.getTime()) / 1000 / 60) + ' min'
    };
  }

  // No cache, scrape fresh
  console.log(`🔍 Scraping products: category=${categoryId}, expansion=${expansionId} (${new Date().toISOString()})`);
  
  return new Promise((resolve) => {
    const scrapper = spawn('node', ['src/scrape-products.js', categoryId, expansionId]);
    let output = '';
    let errorOutput = '';

    scrapper.stdout.on('data', (data) => {
      output += data.toString();
    });

    scrapper.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    scrapper.on('close', async (code) => {
      if (code !== 0) {
        resolve({ success: false, error: errorOutput });
        return;
      }

      try {
        const data = JSON.parse(output);
        
        // Save to cache if successful
        if (data.success && data.products) {
          await ProductCache.findOneAndUpdate(
            { categoryId, expansionId },
            { 
              categoryId,
              expansionId,
              products: data.products,
              lastUpdate: new Date()
            },
            { upsert: true, new: true }
          );
          console.log(`💾 Products cached for category=${categoryId}, expansion=${expansionId}`);
        }
        
        resolve({ ...data, fromCache: false });
      } catch (err) {
        resolve({ success: false, error: 'Failed to parse products output' });
      }
    });

    scrapper.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Search products for singles (cards) by searchString (e.g., "lor042")
 * Follows redirect and applies language/country filters
 */
async function searchProducts(categoryId, searchString, country, language) {
  // Cache key includes country and language since results vary
  const cacheKey = `singles:${searchString.toLowerCase()}:${country}:${language}`;
  const cacheThreshold = new Date(Date.now() - PRODUCT_CACHE_DURATION_MS);
  
  // Check cache first
  const cached = await ProductCache.findOne({
    categoryId,
    expansionId: cacheKey,
    lastUpdate: { $gt: cacheThreshold }
  });

  if (cached) {
    console.log(`✅ Singles search cache hit for "${searchString}" (${new Date().toISOString()})`);
    return {
      success: true,
      ...cached.products[0], // Return the cached result object
      fromCache: true,
      cacheAge: Math.round((Date.now() - cached.lastUpdate.getTime()) / 1000 / 60) + ' min'
    };
  }

  // No cache, search fresh
  console.log(`🔍 Searching singles: "${searchString}" country=${country} language=${language} (${new Date().toISOString()})`);
  
  return new Promise((resolve) => {
    const scrapper = spawn('node', ['src/scrape-singles.js', searchString, country, language]);
    let output = '';
    let errorOutput = '';

    scrapper.stdout.on('data', (data) => {
      output += data.toString();
    });

    scrapper.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    scrapper.on('close', async (code) => {
      if (code !== 0) {
        resolve({ success: false, error: errorOutput });
        return;
      }

      try {
        const data = JSON.parse(output);
        
        // Save to cache if successful
        // For singles, we store the entire result object (not just products array)
        if (data.success) {
          await ProductCache.findOneAndUpdate(
            { categoryId, expansionId: cacheKey },
            { 
              categoryId,
              expansionId: cacheKey,
              products: [data], // Store entire result as single item
              lastUpdate: new Date()
            },
            { upsert: true, new: true }
          );
          console.log(`💾 Singles search cached for "${searchString}"`);
        }
        
        resolve({ ...data, fromCache: false });
      } catch (err) {
        resolve({ success: false, error: 'Failed to parse singles search output' });
      }
    });

    scrapper.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

module.exports = {
  updateOptionsFromCardmarket,
  getCategories,
  getExpansions,
  scrapeProducts,
  searchProducts
};
