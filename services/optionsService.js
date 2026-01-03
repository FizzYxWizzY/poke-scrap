const { spawn } = require('child_process');
const Category = require('../db/models/Category');
const Expansion = require('../db/models/Expansion');

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
 * Scrape products for a category + expansion combo
 */
function scrapeProducts(categoryId, expansionId) {
  return new Promise((resolve) => {
    console.log(`🔍 Scraping products: category=${categoryId}, expansion=${expansionId}`);
    
    const scrapper = spawn('node', ['src/scrape-products.js', categoryId, expansionId]);
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
        resolve({ success: false, error: errorOutput });
        return;
      }

      try {
        const data = JSON.parse(output);
        resolve(data);
      } catch (err) {
        resolve({ success: false, error: 'Failed to parse products output' });
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
  scrapeProducts
};
