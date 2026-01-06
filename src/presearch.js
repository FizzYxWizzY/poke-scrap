const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { categories, languages, countries } = require('../data/cardmarket-data');

// Use all stealth plugins
puppeteer.use(StealthPlugin());
//   stripHeadless: true,
//   makeWindows: true
// }));

/**
 * Simulate human-like behavior to avoid detection
 */
async function simulateHumanBehavior(page) {
  // Random mouse movements
  const viewport = await page.viewport();
  const x = Math.random() * (viewport.width - 100) + 50;
  const y = Math.random() * (viewport.height - 100) + 50;
  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
  
  // Random scroll
  await page.evaluate(() => {
    const scrollAmount = Math.random() * 500;
    window.scrollTo({
      top: scrollAmount,
      behavior: 'smooth'
    });
  });
  
  // Random pause
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 500));
  
  // Sometimes click on random elements (safely)
  try {
    const clickableElements = await page.$$('a, button, [role="button"], [onclick]');
    if (clickableElements.length > 0 && Math.random() < 0.1) { // 10% chance
      const randomElement = clickableElements[Math.floor(Math.random() * clickableElements.length)];
      await randomElement.hover();
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 200));
    }
  } catch (e) {
    // Ignore if clicking fails
  }
}

/**
 * Main presearch function that can be imported as a module
 */
async function performPresearch(categorySlug, searchTerm) {
  // Support legacy format
  const legacyMap = { 'etb': 'Elite-Trainer-Boxes', 'booster': 'Boosters' };
  if (legacyMap[categorySlug.toLowerCase()]) {
    categorySlug = legacyMap[categorySlug.toLowerCase()];
  }
  
  // Find category value for the search form
  const categoryData = categories.find(c => c.slug.toLowerCase() === categorySlug.toLowerCase());
  if (!categoryData) {
    return { error: 'Category not found', availableCategories: categories.map(c => c.slug) };
  }
  
  let browser;
  try {
    // Launch browser with stealth plugin
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set realistic viewport
    await page.setViewport({
      width: 1920,
      height: 1080
    });
    
    // Add initial delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    
    // Go directly to search URL (skip main page visit to avoid detection)
    const searchUrl = `https://www.cardmarket.com/en/Pokemon/Products/Singles?name=${encodeURIComponent(searchTerm)}&language=1&idCategory=${categoryData.value}`;
    console.log('Navigating directly to search URL:', searchUrl);
    
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    
    console.log('Search page loaded, checking content...');
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check if we're blocked by Cloudflare
    const pageContent = await page.content();
    if (pageContent.includes('Just a moment') || pageContent.includes('Checking your browser') || pageContent.includes('challenge-platform')) {
      console.log('Cloudflare protection detected, returning empty results for fallback processing');
      return { success: true, products: [], cloudflareBlocked: true, searchTerm: searchTerm, category: categorySlug };
    }
    
    // Extract product data
    console.log('Extracting product data...');
    const products = await page.evaluate(() => {
      console.log('Page URL:', window.location.href);
      console.log('Page title:', document.title);
      
      const results = [];
      const productRows = document.querySelectorAll('table tbody tr');
      console.log('Found', productRows.length, 'table rows');
      
      for (const row of productRows) {
        const link = row.querySelector('a[href*="Products/Singles"]');
        const nameElement = row.querySelector('.col-10 a, .col-8 a');
        const priceElement = row.querySelector('.col-price');
        const rarityElement = row.querySelector('.col-rarity img');
        
        if (link && nameElement) {
          const url = link.href;
          const name = nameElement.textContent.trim();
          const price = priceElement ? priceElement.textContent.trim() : '';
          const rarity = rarityElement ? rarityElement.alt || rarityElement.title : '';
          
          // Extract product ID from URL
          const productIdMatch = url.match(/\/(\d+)$/);
          const productId = productIdMatch ? productIdMatch[1] : '';
          
          results.push({
            id: productId,
            name: name,
            url: url,
            price: price,
            rarity: rarity
          });
        }
      }
      
      console.log('Extracted', results.length, 'products');
      return results;
    });
    
    return { success: true, products: products, searchTerm: searchTerm, category: categorySlug };
    
  } catch (error) {
    return { error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Export the function for use as a module
module.exports = { performPresearch };

// If run directly from command line, execute the search
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log(JSON.stringify({ error: 'Usage: node presearch.js <category> <search>' }));
      return;
    }
    
    const categorySlug = args[0];
    const searchTerm = args[1];
    
    const result = await performPresearch(categorySlug, searchTerm);
    console.log(JSON.stringify(result));
  })();
}
