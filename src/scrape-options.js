const puppeteer = require('puppeteer');

/**
 * Scrapes Cardmarket search page to get all categories and expansions
 * Run daily via cron to keep data up to date
 * 
 * Usage: node src/scrape-options.js
 */

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

    await page.goto('https://www.cardmarket.com/en/Pokemon/Products/Search', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for the select elements to be loaded
    await page.waitForSelector('select[id^="idCategory"]', { timeout: 15000 });
    await page.waitForSelector('select[id^="idExpansion"]', { timeout: 15000 });

    const data = await page.evaluate(() => {
      // Get categories
      const catSelect = document.querySelector('select[id^="idCategory"]');
      const categories = [];
      if (catSelect) {
        catSelect.querySelectorAll('option').forEach(opt => {
          if (opt.value && opt.value !== '0') {
            categories.push({ 
              value: opt.value, 
              text: opt.textContent.trim() 
            });
          }
        });
      }

      // Get expansions
      const expSelect = document.querySelector('select[id^="idExpansion"]');
      const expansions = [];
      if (expSelect) {
        expSelect.querySelectorAll('option').forEach(opt => {
          if (opt.value && opt.value !== '0') {
            expansions.push({ 
              value: opt.value, 
              text: opt.textContent.trim() 
            });
          }
        });
      }

      return { categories, expansions };
    });

    console.log(JSON.stringify({
      success: true,
      categoriesCount: data.categories.length,
      expansionsCount: data.expansions.length,
      categories: data.categories,
      expansions: data.expansions
    }));

  } catch (err) {
    console.log(JSON.stringify({ 
      success: false, 
      error: err.message 
    }));
  } finally {
    await browser.close();
  }
})();
